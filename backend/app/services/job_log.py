from __future__ import annotations

from pathlib import Path

from app.config import settings

CANCELLED_LOG_LINE = "=== Job cancelled by user ==="


def job_log_path(job_uuid: str) -> Path:
    return Path(settings.logs_dir) / f"job-{job_uuid}.log"


def job_log_marker(job_uuid: str) -> str:
    return f"=== Job {job_uuid} started ==="


def ensure_job_log_header(job_uuid: str) -> None:
    path = job_log_path(job_uuid)
    if path.exists():
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(f"{job_log_marker(job_uuid)}\n", encoding="utf-8")


def append_cancelled_to_job_log(job_uuid: str) -> None:
    """Record user cancellation in the job log (idempotent)."""
    ensure_job_log_header(job_uuid)
    path = job_log_path(job_uuid)
    content = path.read_text(encoding="utf-8", errors="replace")
    if CANCELLED_LOG_LINE in content:
        return
    with path.open("a", encoding="utf-8") as f:
        f.write(f"{CANCELLED_LOG_LINE}\n")


def read_log_text(job_uuid: str) -> str:
    path = job_log_path(job_uuid)
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8", errors="replace")


def log_matches_job(job_uuid: str, content: str) -> bool:
    return job_log_marker(job_uuid) in content[:300]


def delete_job_log(job_uuid: str) -> None:
    job_log_path(job_uuid).unlink(missing_ok=True)
