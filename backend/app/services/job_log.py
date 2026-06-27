from __future__ import annotations

from pathlib import Path

from app.config import settings


def job_log_path(job_uuid: str) -> Path:
    return Path(settings.logs_dir) / f"job-{job_uuid}.log"


def job_log_marker(job_uuid: str) -> str:
    return f"=== Job {job_uuid} started ==="


def read_log_text(job_uuid: str) -> str:
    path = job_log_path(job_uuid)
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8", errors="replace")


def log_matches_job(job_uuid: str, content: str) -> bool:
    return job_log_marker(job_uuid) in content[:300]


def delete_job_log(job_uuid: str) -> None:
    job_log_path(job_uuid).unlink(missing_ok=True)
