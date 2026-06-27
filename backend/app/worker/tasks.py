from datetime import datetime, timezone

from app.database import Account, MigrationJob, SessionLocal
from app.services.imapsync import run_imapsync
from app.services.job_cancel import (
    CANCELLED_BY_USER,
    check_job_cancelled,
    is_job_cancelled,
    kill_orphan_imapsync_for_account,
    make_cancel_checker,
)
from app.services.job_log import append_cancelled_to_job_log, job_log_path
from app.services.settings_service import get_or_create_app_settings
from app.services.year_filter import storage_to_years


def _cancelled_result(job_uuid: str, messages: int = 0) -> dict:
    append_cancelled_to_job_log(job_uuid)
    return {
        "success": False,
        "messages_transferred": messages,
        "error": CANCELLED_BY_USER,
    }


def migrate_account(job_uuid: str) -> dict:
    db = SessionLocal()
    try:
        job = db.query(MigrationJob).filter(MigrationJob.uuid == job_uuid).first()
        if not job:
            return {"success": False, "error": f"Job {job_uuid} not found"}

        if check_job_cancelled(job_uuid):
            return _cancelled_result(job_uuid)

        account = db.query(Account).filter(Account.id == job.account_id).first()
        if not account:
            job.status = "failed"
            job.error_message = "Account not found"
            job.finished_at = datetime.now(timezone.utc)
            db.commit()
            return {"success": False, "error": "Account not found"}

        kill_orphan_imapsync_for_account(account.yandex_email, account.cpanel_email)

        if check_job_cancelled(job_uuid):
            return _cancelled_result(job_uuid)

        app_settings = get_or_create_app_settings()
        log_path = job_log_path(job_uuid)
        now = datetime.now(timezone.utc)
        updated = (
            db.query(MigrationJob)
            .filter(
                MigrationJob.uuid == job_uuid,
                MigrationJob.status == "pending",
            )
            .update(
                {
                    MigrationJob.status: "running",
                    MigrationJob.started_at: now,
                    MigrationJob.log_file: str(log_path),
                    MigrationJob.error_message: None,
                },
                synchronize_session=False,
            )
        )
        db.commit()

        job = db.query(MigrationJob).filter(MigrationJob.uuid == job_uuid).first()
        if not job:
            return {"success": False, "error": f"Job {job_uuid} not found"}

        if job.status != "running":
            if check_job_cancelled(job_uuid):
                kill_orphan_imapsync_for_account(account.yandex_email, account.cpanel_email)
                return _cancelled_result(job_uuid)
            return {"success": False, "error": "Job is not pending"}

        def on_progress(count: int) -> None:
            if check_job_cancelled(job_uuid):
                return
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
            should_cancel=make_cancel_checker(job_uuid),
        )

        kill_orphan_imapsync_for_account(account.yandex_email, account.cpanel_email)

        job = db.query(MigrationJob).filter(MigrationJob.uuid == job_uuid).first()
        if not job:
            return {"success": False, "error": f"Job {job_uuid} not found"}

        if check_job_cancelled(job_uuid) or result.error_message == CANCELLED_BY_USER:
            job.messages_transferred = result.messages_transferred
            job.finished_at = job.finished_at or datetime.now(timezone.utc)
            db.commit()
            return _cancelled_result(job_uuid, result.messages_transferred)

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
        if job and not check_job_cancelled(job_uuid):
            job.status = "failed"
            job.error_message = str(exc)
            job.finished_at = datetime.now(timezone.utc)
            db.commit()
        raise
    finally:
        db.close()
