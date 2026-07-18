from __future__ import annotations

import json
import re


def normalize_folders(folders: list[str] | None) -> list[str] | None:
    if not folders:
        return None
    cleaned: list[str] = []
    seen: set[str] = set()
    for folder in folders:
        name = folder.strip()
        if not name or name in seen:
            continue
        seen.add(name)
        cleaned.append(name)
    return cleaned or None


def folders_to_storage(folders: list[str] | None) -> str | None:
    normalized = normalize_folders(folders)
    if not normalized:
        return None
    return json.dumps(normalized, ensure_ascii=False)


def storage_to_folders(value: str | None) -> list[str] | None:
    if not value or not value.strip():
        return None
    try:
        data = json.loads(value)
        if isinstance(data, list):
            return normalize_folders([str(item) for item in data])
    except json.JSONDecodeError:
        pass
    return normalize_folders([part.strip() for part in value.split(",") if part.strip()])


def build_include_args(folders: list[str] | None) -> list[str]:
    normalized = normalize_folders(folders)
    if not normalized:
        return []
    args: list[str] = []
    for folder in normalized:
        args.extend(["--include", f"^{re.escape(folder)}$"])
    return args


def format_folders_label(folders: list[str] | None) -> str | None:
    normalized = normalize_folders(folders)
    if not normalized:
        return None
    if len(normalized) <= 3:
        return ", ".join(normalized)
    return f"{', '.join(normalized[:2])}, +{len(normalized) - 2} more"
