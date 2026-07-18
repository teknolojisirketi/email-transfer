from __future__ import annotations

import imaplib
import re
from dataclasses import dataclass

# imapsync --automap ile eşleşen standart klasörler (Yandex Rusça adlar dahil)
AUTOMAP_FOLDER_NAMES = frozenset({
    "INBOX",
    "Inbox",
    "Sent",
    "Sent Messages",
    "Sent Items",
    "Drafts",
    "Draft",
    "Trash",
    "Deleted",
    "Deleted Items",
    "Deleted Messages",
    "Junk",
    "Spam",
    "Bulk Mail",
    "Archive",
    "Отправленные",
    "Черновики",
    "Удалённые",
    "Удаленные",
    "Спам",
    "Входящие",
    "Архив",
})

SPECIAL_USE_FLAGS = frozenset({
    r"\inbox",
    r"\sent",
    r"\drafts",
    r"\trash",
    r"\junk",
    r"\archive",
    r"\all",
})


@dataclass
class ImapFolder:
    name: str
    flags: list[str]


def _parse_list_line(line: str) -> ImapFolder | None:
    match = re.match(r'\(([^)]*)\)\s+"([^"]*)"\s+(.+)', line.strip())
    if not match:
        return None
    raw_flags = match.group(1).split()
    flags = [f.strip() for f in raw_flags if f.strip()]
    name = match.group(3).strip().strip('"')
    return ImapFolder(name=name, flags=flags)


def list_imap_folders(
    host: str,
    port: int,
    email: str,
    password: str,
    use_ssl: bool = True,
    timeout: int = 60,
) -> list[ImapFolder]:
    imap = None
    try:
        if use_ssl:
            imap = imaplib.IMAP4_SSL(host, port, timeout=timeout)
        else:
            imap = imaplib.IMAP4(host, port, timeout=timeout)
        imap.login(email, password)
        status, data = imap.list()
        if status != "OK" or not data:
            return []
        folders: list[ImapFolder] = []
        for item in data:
            line = item.decode("utf-8", errors="replace") if isinstance(item, bytes) else str(item)
            parsed = _parse_list_line(line)
            if parsed:
                folders.append(parsed)
        return folders
    finally:
        if imap is not None:
            try:
                imap.logout()
            except Exception:
                pass


def _is_automap_folder(folder: ImapFolder) -> bool:
    if folder.name.upper() == "INBOX":
        return True
    if folder.name in AUTOMAP_FOLDER_NAMES:
        return True
    for flag in folder.flags:
        if flag.lower() in SPECIAL_USE_FLAGS:
            return True
    return False


def _to_cpanel_path(yandex_folder: str, parent: str = "Yandex") -> str:
    """Yandex klasör adını cPanel yoluna çevir: INBOX.Yandex.{orijinal_ad}"""
    if yandex_folder.upper() == "INBOX":
        return "INBOX"
    # Hiyerarşi: Foo/Bar -> INBOX.Yandex.Foo.Bar
    normalized = yandex_folder.replace("/", ".")
    return f"INBOX.{parent}.{normalized}"


def build_unmapped_folder_args(
    folders: list[ImapFolder],
    parent: str = "Yandex",
) -> list[str]:
    args: list[str] = []
    for folder in folders:
        if _is_automap_folder(folder):
            continue
        dest = _to_cpanel_path(folder.name, parent)
        args.extend(["--f1f2", f"{folder.name}={dest}"])
    return args


def filter_folders_by_names(
    folders: list[ImapFolder],
    selected_names: list[str] | None,
) -> list[ImapFolder]:
    if not selected_names:
        return folders
    selected = set(selected_names)
    return [folder for folder in folders if folder.name in selected]
