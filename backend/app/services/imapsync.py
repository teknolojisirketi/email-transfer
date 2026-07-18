from __future__ import annotations

import re
import subprocess
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from app.config import settings
from app.crypto import decrypt_password
from app.database import Account, AppSettings
from app.services.imap_folders import (
    build_unmapped_folder_args,
    filter_folders_by_names,
    list_imap_folders,
)
from app.services.folder_filter import build_include_args, format_folders_label
from app.services.job_cancel import (
    CANCELLED_BY_USER,
    kill_orphan_imapsync_for_account,
    start_cancel_watcher,
    terminate_process,
)
from app.services.job_log import CANCELLED_LOG_LINE, job_log_marker, job_log_path
from app.services.year_filter import build_search1_args

UNMAPPED_FOLDER_PARENT = "Yandex"


@dataclass
class ImapSyncResult:
    success: bool
    messages_transferred: int
    error_message: str | None
    log_content: str


def parse_messages_transferred(log_content: str) -> int:
    """Sum transferred messages across all folders from imapsync log."""
    total = 0
    for match in re.finditer(r"Messages transferred\s*:\s*(\d+)", log_content, re.IGNORECASE):
        total += int(match.group(1))
    if total > 0:
        return total

    for match in re.finditer(r"Total messages transferred\s*:\s*(\d+)", log_content, re.IGNORECASE):
        return int(match.group(1))

    # Aktif klasör ilerlemesi: "msg 12/340 msgs transferred"
    folder_total = 0
    for match in re.finditer(r"msg\s+(\d+)/\d+\s+msgs\s+transferred", log_content, re.IGNORECASE):
        folder_total += int(match.group(1))
    if folder_total > 0:
        return folder_total

    return 0


def build_imapsync_command(
    account: Account,
    app_settings: AppSettings,
    passfile1: Path,
    passfile2: Path,
    extra_args: list[str] | None = None,
) -> list[str]:
    yandex_password = decrypt_password(account.yandex_password_enc)

    cmd = [
        "imapsync",
        "--host1", app_settings.yandex_imap_host,
        "--port1", str(app_settings.yandex_imap_port),
        "--user1", account.yandex_email,
        "--passfile1", str(passfile1),
        "--host2", account.cpanel_imap_host,
        "--port2", str(app_settings.cpanel_imap_port),
        "--user2", account.cpanel_email,
        "--passfile2", str(passfile2),
        "--sep1", "/",
        "--sep2", ".",
        "--automap",
        "--syncinternaldates",
        "--syncflags",
        "--useheader", "Message-Id",
        "--nofoldersizes",
    ]

    if extra_args:
        cmd.extend(extra_args)

    if app_settings.yandex_imap_ssl:
        cmd.append("--ssl1")
    if app_settings.cpanel_imap_ssl:
        cmd.append("--ssl2")

    return cmd


def run_imapsync(
    account: Account,
    app_settings: AppSettings,
    job_uuid: str,
    on_progress: Callable[[int], None] | None = None,
    migrate_years: list[int] | None = None,
    migrate_folders: list[str] | None = None,
    should_cancel: Callable[[], bool] | None = None,
) -> ImapSyncResult:
    logs_dir = Path(settings.logs_dir)
    logs_dir.mkdir(parents=True, exist_ok=True)
    log_file = job_log_path(job_uuid)

    yandex_password = decrypt_password(account.yandex_password_enc)
    cpanel_password = decrypt_password(account.cpanel_password_enc)

    passfile1 = passfile2 = None
    log_parts: list[str] = []
    try:
        if should_cancel and should_cancel():
            return ImapSyncResult(
                success=False,
                messages_transferred=0,
                error_message=CANCELLED_BY_USER,
                log_content="",
            )

        with tempfile.NamedTemporaryFile(mode="w", delete=False, dir=logs_dir) as f1:
            f1.write(yandex_password)
            passfile1 = Path(f1.name)
        with tempfile.NamedTemporaryFile(mode="w", delete=False, dir=logs_dir) as f2:
            f2.write(cpanel_password)
            passfile2 = Path(f2.name)
        passfile1.chmod(0o600)
        passfile2.chmod(0o600)

        folder_args: list[str] = []
        try:
            yandex_folders = list_imap_folders(
                host=app_settings.yandex_imap_host,
                port=app_settings.yandex_imap_port,
                email=account.yandex_email,
                password=yandex_password,
                use_ssl=app_settings.yandex_imap_ssl,
            )
            if migrate_folders:
                yandex_folders = filter_folders_by_names(yandex_folders, migrate_folders)
            folder_args = build_unmapped_folder_args(yandex_folders, UNMAPPED_FOLDER_PARENT)
        except Exception as folder_exc:
            folder_args = []
            folder_list_error = str(folder_exc)
        else:
            folder_list_error = None

        if should_cancel and should_cancel():
            return ImapSyncResult(
                success=False,
                messages_transferred=0,
                error_message=CANCELLED_BY_USER,
                log_content="",
            )

        cmd = build_imapsync_command(account, app_settings, passfile1, passfile2, folder_args)
        include_args = build_include_args(migrate_folders)
        if include_args:
            cmd.extend(include_args)
        year_args = build_search1_args(migrate_years)
        if year_args:
            cmd.extend(year_args)

        header_lines = [f"{job_log_marker(job_uuid)}\n"]
        if migrate_years:
            from app.services.year_filter import format_years_label

            label = format_years_label(migrate_years)
            header_lines.append(f"=== Year filter: {label} ===\n")
        if migrate_folders:
            label = format_folders_label(migrate_folders)
            header_lines.append(f"=== Selected folders: {label} ===\n")
            for folder_name in migrate_folders:
                header_lines.append(f"  - {folder_name}\n")
        if folder_list_error:
            header_lines.append(f"=== Folder list warning: {folder_list_error} ===\n")
        if folder_args:
            header_lines.append(
                f"=== Custom folder mappings (target: INBOX.{UNMAPPED_FOLDER_PARENT}.<yandex_name>) ===\n"
            )
            for i in range(0, len(folder_args), 2):
                if folder_args[i] == "--f1f2":
                    header_lines.append(f"  {folder_args[i + 1]}\n")
        elif not folder_list_error:
            header_lines.append("=== All folders matched via automap ===\n")

        log_parts = list(header_lines)

        with open(log_file, "w", encoding="utf-8") as log_f:
            log_f.writelines(header_lines)
            log_f.flush()

            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
            )

            cancel_stopped, cancel_threads = (
                start_cancel_watcher(
                    proc,
                    should_cancel,
                    job_uuid=job_uuid,
                    on_cancel=lambda: kill_orphan_imapsync_for_account(
                        account.yandex_email, account.cpanel_email
                    ),
                )
                if should_cancel
                else (None, None)
            )

            last_progress = time.time()
            user_cancelled = False
            assert proc.stdout is not None
            try:
                for line in proc.stdout:
                    if should_cancel and should_cancel():
                        user_cancelled = True
                        terminate_process(proc)
                        log_f.write(f"{CANCELLED_LOG_LINE}\n")
                        log_f.flush()
                        break

                    log_f.write(line)
                    log_parts.append(line)
                    log_f.flush()
                    if on_progress and time.time() - last_progress >= 5:
                        on_progress(parse_messages_transferred("".join(log_parts)))
                        last_progress = time.time()
            finally:
                if cancel_stopped is not None:
                    cancel_stopped.set()
                if cancel_threads is not None:
                    for thread in cancel_threads:
                        thread.join(timeout=1)

            if user_cancelled or (should_cancel and should_cancel()):
                log_content = "".join(log_parts)
                messages = parse_messages_transferred(log_content)
                if on_progress:
                    on_progress(messages)
                return ImapSyncResult(
                    success=False,
                    messages_transferred=messages,
                    error_message=CANCELLED_BY_USER,
                    log_content=log_content,
                )

            try:
                proc.wait(timeout=86400)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()
                log_content = "".join(log_parts)
                return ImapSyncResult(
                    success=False,
                    messages_transferred=0,
                    error_message="imapsync timed out after 24 hours",
                    log_content=log_content,
                )

        log_content = "".join(log_parts)
        messages = parse_messages_transferred(log_content)
        success = proc.returncode == 0
        error_message = None if success else _extract_error(log_content, proc.returncode or 1)

        if on_progress:
            on_progress(messages)

        return ImapSyncResult(
            success=success,
            messages_transferred=messages,
            error_message=error_message,
            log_content=log_content,
        )
    except Exception as exc:
        log_content = "".join(log_parts) if log_parts else ""
        if not log_content and log_file.exists():
            log_content = log_file.read_text(encoding="utf-8", errors="replace")
        return ImapSyncResult(
            success=False,
            messages_transferred=0,
            error_message=str(exc),
            log_content=log_content,
        )
    finally:
        for path in (passfile1, passfile2):
            if path and path.exists():
                path.unlink(missing_ok=True)


def _extract_error(log_content: str, return_code: int) -> str:
    for line in reversed(log_content.splitlines()):
        lower = line.lower()
        if "error" in lower or "failed" in lower or "can't" in lower:
            return line.strip()[:500]
    return f"imapsync exited with code {return_code}"
