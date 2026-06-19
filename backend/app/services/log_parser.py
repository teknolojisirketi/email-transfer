from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass
class FolderProgress:
    name: str
    index: int
    total: int
    source_messages: int | None = None
    transferred: int | None = None
    status: str = "running"  # running | completed


def parse_folder_progress(log_content: str) -> list[FolderProgress]:
    """Parse imapsync stdout log into per-folder progress."""
    folders: list[FolderProgress] = []
    current: FolderProgress | None = None

    for line in log_content.splitlines():
        folder_match = re.search(
            r"Folder\s+(\d+)/(\d+)\s+\[([^\]]+)\]",
            line,
            re.IGNORECASE,
        )
        if folder_match:
            if current is not None:
                if current.status != "completed":
                    folders.append(current)
            current = FolderProgress(
                index=int(folder_match.group(1)),
                total=int(folder_match.group(2)),
                name=folder_match.group(3).strip(),
                status="running",
            )
            continue

        if current is not None:
            host1_match = re.search(
                r"Host1: folder \[([^\]]+)\] has (\d+) messages",
                line,
                re.IGNORECASE,
            )
            if host1_match and host1_match.group(1) == current.name:
                current.source_messages = int(host1_match.group(2))

            transferred_match = re.search(
                r"Messages transferred\s*:\s*(\d+)",
                line,
                re.IGNORECASE,
            )
            if transferred_match:
                current.transferred = int(transferred_match.group(1))
                current.status = "completed"
                folders.append(current)
                current = None

    if current is not None:
        folders.append(current)

    return folders
