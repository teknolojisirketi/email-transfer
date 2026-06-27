from datetime import datetime, timezone

from app.config import settings
from app.database import Account, MigrationJob, SessionLocal
from app.services.imapsync import run_imapsync
from app.services.job_log import job_log_path
from app.services.settings_service import get_or_create_app_settings
from app.services.year_filter import storage_to_years


def migrate_account(job_uuid: str) -> dict:
    db = SessionLocal()
    try:
        job = db.query(MigrationJob).filter(MigrationJob.uuid == job_uuid).first()
        if not job:
            return {"success": False, "error": f"Job {job_uuid} not found"}

        account = db.query(Account).filter(Account.id == job.account_id).first()
        if not account:
            job.status = "failed"
            job.error_message = "Account not found"
            job.finished_at = datetime.now(timezone.utc)
            db.commit()
            return {"success": False, "error": "Account not found"}

        app_settings = get_or_create_app_settings()
        log_path = job_log_path(job_uuid)
        job.status = "running"
        job.started_at = datetime.now(timezone.utc)
        job.log_file = str(log_path)
        job.error_message = None
        db.commit()

        def on_progress(count: int) -> None:
            progress_db = SessionLocal()
            try:
                row = progress_db.query(MigrationJob).filter(MigrationJob.uuid == job_uuid).first()
                if row and row.status == "running":
                    row.messages_transferred = count
                    progress_db.commit()
            finally:
                progress_db.close()

        result = run_imapsync(
            account,
            app_settings,
            job_uuid,
            on_progress=on_progress,
            migrate_years=storage_to_years(job.migrate_years),
        )

        job = db.query(MigrationJob).filter(MigrationJob.uuid == job_uuid).first()
        if not job:
            return {"success": False, "error": f"Job {job_uuid} not found"}

        job.messages_transferred = result.messages_transferred
        job.finished_at = datetime.now(timezone.utc)

        if result.success:
            job.status = "completed"
            job.error_message = None
        else:
            job.status = "failed"
            job.error_message = result.error_message

        db.commit()
        return {
            "success": result.success,
            "messages_transferred": result.messages_transferred,
            "error": result.error_message,
        }
    except Exception as exc:
        job = db.query(MigrationJob).filter(MigrationJob.uuid == job_uuid).first()
        if job:
            job.status = "failed"
            job.error_message = str(exc)
            job.finished_at = datetime.now(timezone.utc)
            db.commit()
        raise
    finally:
        db.close()
