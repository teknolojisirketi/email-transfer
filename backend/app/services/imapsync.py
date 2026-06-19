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
from app.services.imap_folders import build_unmapped_folder_args, list_imap_folders

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
    job_id: int,
    on_progress: Callable[[int], None] | None = None,
) -> ImapSyncResult:
    logs_dir = Path(settings.logs_dir)
    logs_dir.mkdir(parents=True, exist_ok=True)
    log_file = logs_dir / f"job-{job_id}.log"

    yandex_password = decrypt_password(account.yandex_password_enc)
    cpanel_password = decrypt_password(account.cpanel_password_enc)

    passfile1 = passfile2 = None
    try:
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
            folder_args = build_unmapped_folder_args(yandex_folders, UNMAPPED_FOLDER_PARENT)
        except Exception as folder_exc:
            folder_args = []
            folder_list_error = str(folder_exc)
        else:
            folder_list_error = None

        cmd = build_imapsync_command(account, app_settings, passfile1, passfile2, folder_args)

        with open(log_file, "w", encoding="utf-8") as log_f:
            log_f.write(f"=== Job {job_id} started ===\n")
            if folder_list_error:
                log_f.write(f"=== Klasör listesi uyarısı: {folder_list_error} ===\n")
            if folder_args:
                log_f.write(f"=== Özel klasör eşlemeleri (hedef: INBOX.{UNMAPPED_FOLDER_PARENT}.<yandex_adı>) ===\n")
                for i in range(0, len(folder_args), 2):
                    if folder_args[i] == "--f1f2":
                        log_f.write(f"  {folder_args[i + 1]}\n")
            elif not folder_list_error:
                log_f.write("=== Tüm klasörler automap ile eşleşiyor ===\n")
            log_f.flush()

            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
            )

            last_progress = time.time()
            assert proc.stdout is not None
            for line in proc.stdout:
                log_f.write(line)
                log_f.flush()
                if on_progress and time.time() - last_progress >= 5:
                    on_progress(parse_messages_transferred(log_file.read_text(encoding="utf-8", errors="replace")))
                    last_progress = time.time()

            try:
                proc.wait(timeout=86400)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()
                return ImapSyncResult(
                    success=False,
                    messages_transferred=0,
                    error_message="imapsync timed out after 24 hours",
                    log_content=log_file.read_text(encoding="utf-8", errors="replace"),
                )

        log_content = log_file.read_text(encoding="utf-8", errors="replace")
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
        log_content = log_file.read_text(encoding="utf-8", errors="replace") if log_file.exists() else ""
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
