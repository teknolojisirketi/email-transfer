from __future__ import annotations

from datetime import datetime, timezone

from rq.job import Job as RqJob
from sqlalchemy.orm import Session

from app.database import MigrationJob
from app.services.job_log import job_log_path, log_matches_job, read_log_text
from app.services.queue_service import get_redis

STALE_LOG_MINUTES = 15
STALE_PARSING_MINUTES = 90


def _log_tail(content: str) -> str:
    lines = [ln.strip() for ln in content.splitlines() if ln.strip()]
    return "\n".join(lines[-5:])


def _is_parsing_headers_phase(content: str) -> bool:
    tail = _log_tail(content).lower()
    if "exiting with return value" in tail:
        return False
    return "parsing headers of folder" in tail and "be patient" in tail


def _log_shows_success(job_uuid: str) -> bool:
    content = read_log_text(job_uuid)
    if not content or not log_matches_job(job_uuid, content):
        return False
    return "Exiting with return value 0 (EX_OK" in content


def read_job_log_content(job_uuid: str, *, started_at: datetime | None, status: str) -> str:
    if status == "pending" and not started_at:
        return ""
    content = read_log_text(job_uuid)
    if content and log_matches_job(job_uuid, content):
        return content
    return ""


def _error_from_log(job_uuid: str) -> str | None:
    content = read_log_text(job_uuid)
    if not content or not log_matches_job(job_uuid, content):
        return None
    for line in reversed(content.splitlines()):
        if "Exiting with return value" in line:
            if "0 (EX_OK" in line:
                return None
            return line.strip()[:500]
        lower = line.lower()
        if "detected " in lower and "error" in lower:
            return line.strip()[:500]
    return None


def _log_is_stale(job_uuid: str) -> bool:
    path = job_log_path(job_uuid)
    if not path.exists():
        return False
    content = read_log_text(job_uuid)
    if not log_matches_job(job_uuid, content):
        return False
    stale_minutes = STALE_PARSING_MINUTES if _is_parsing_headers_phase(content) else STALE_LOG_MINUTES
    mtime = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)
    age_seconds = (datetime.now(timezone.utc) - mtime).total_seconds()
    return age_seconds > stale_minutes * 60


def _rq_state(rq_job_id: str | None) -> tuple[str | None, str | None]:
    if not rq_job_id:
        return None, None
    try:
        rq_job = RqJob.fetch(rq_job_id, connection=get_redis())
        exc = rq_job.exc_info
        if exc and isinstance(exc, str):
            exc = exc.strip()[:500]
        status = rq_job.get_status()
        if hasattr(status, "value"):
            status = status.value
        return str(status), exc
    except Exception:
        return None, None


def sync_job_status(job: MigrationJob, db: Session) -> bool:
    """Sync DB job status with worker/queue state. Returns True if changed."""
    rq_status, rq_exc = _rq_state(job.rq_job_id)

    if job.status == "failed" and rq_status == "started":
        job.status = "running"
        job.error_message = None
        job.finished_at = None
        db.commit()
        db.refresh(job)
        return True

    if job.status == "running" and job.started_at and _log_shows_success(job.uuid):
        from app.services.imapsync import parse_messages_transferred

        content = read_log_text(job.uuid)
        job.status = "completed"
        job.error_message = None
        job.messages_transferred = parse_messages_transferred(content)
        job.finished_at = job.finished_at or datetime.now(timezone.utc)
        db.commit()
        db.refresh(job)
        return True

    if job.status not in ("pending", "running"):
        return False

    now = datetime.now(timezone.utc)
    error_message: str | None = None

    if job.status == "pending":
        if rq_status == "failed":
            error_message = rq_exc or "Queue job failed"
        elif rq_status in ("finished", "canceled"):
            if not _log_shows_success(job.uuid):
                error_message = rq_exc or "Pending job did not complete successfully"
        elif rq_status is None and job.rq_job_id:
            error_message = "Queue record not found (worker may have restarted)"

    if job.status == "running":
        if rq_status == "started":
            return False

        log_error = _error_from_log(job.uuid)
        if log_error:
            error_message = log_error
        elif rq_status == "failed":
            error_message = rq_exc or "Job marked failed by worker"
        elif rq_status is None:
            error_message = "Job record not found (worker may have restarted)"
        elif rq_status not in ("started", "queued", "deferred") and rq_status is not None:
            error_message = rq_exc or "Job ended unexpectedly"
        elif _log_is_stale(job.uuid):
            error_message = (
                "Job appears stuck — log has not been updated for a long time. "
                "The worker may have restarted."
            )

    if not error_message:
        return False

    job.status = "failed"
    job.error_message = error_message
    job.finished_at = now
    db.commit()
    db.refresh(job)
    return True


def sync_active_jobs(db: Session) -> None:
    jobs = (
        db.query(MigrationJob)
        .filter(MigrationJob.status.in_(["pending", "running", "failed"]))
        .all()
    )
    for job in jobs:
        sync_job_status(job, db)
