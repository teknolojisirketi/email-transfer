from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import Account, MigrationJob, get_db
from app.deps import get_current_user
from app.schemas import (
    FolderProgressItem,
    JobLogResponse,
    JobResponse,
    StartMigrationRequest,
    StartMigrationResponse,
)
from app.services.imapsync import parse_messages_transferred
from app.services.job_cancel import CANCELLED_BY_USER, mark_job_cancelled
from app.services.job_log import append_cancelled_to_job_log, delete_job_log
from app.services.job_sync import read_job_log_content, sync_active_jobs, sync_job_status
from app.services.log_parser import parse_folder_progress
from app.services.queue_service import cancel_migration, enqueue_migration
from app.services.year_filter import normalize_years, years_to_storage

router = APIRouter(
    prefix="/jobs",
    tags=["jobs"],
    dependencies=[Depends(get_current_user)],
)


def _get_job(db: Session, job_uuid: str) -> MigrationJob:
    job = db.query(MigrationJob).filter(MigrationJob.uuid == job_uuid).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


def _to_response(job: MigrationJob, account: Account | None = None) -> JobResponse:
    return JobResponse(
        uuid=job.uuid,
        account_id=job.account_id,
        status=job.status,
        messages_transferred=job.messages_transferred or 0,
        error_message=job.error_message,
        log_file=job.log_file,
        migrate_years=job.migrate_years,
        started_at=job.started_at,
        finished_at=job.finished_at,
        created_at=job.created_at,
        yandex_email=account.yandex_email if account else None,
        cpanel_email=account.cpanel_email if account else None,
    )


@router.get("", response_model=list[JobResponse])
def list_jobs(db: Session = Depends(get_db)):
    sync_active_jobs(db)
    jobs = db.query(MigrationJob).order_by(MigrationJob.created_at.desc()).all()
    result = []
    for job in jobs:
        account = db.query(Account).filter(Account.id == job.account_id).first()
        result.append(_to_response(job, account))
    return result


@router.post("/start", response_model=StartMigrationResponse)
def start_migration(
    payload: StartMigrationRequest | None = None,
    db: Session = Depends(get_db),
):
    account_ids = payload.account_ids if payload else None
    query = db.query(Account)
    if account_ids:
        query = query.filter(Account.id.in_(account_ids))
    accounts = query.all()

    if not accounts:
        raise HTTPException(status_code=400, detail="No accounts found to migrate")

    years = normalize_years(payload.years if payload else None)
    migrate_years = years_to_storage(years)

    job_uuids = []
    for account in accounts:
        active = (
            db.query(MigrationJob)
            .filter(
                MigrationJob.account_id == account.id,
                MigrationJob.status.in_(["pending", "running"]),
            )
            .first()
        )
        if active:
            continue

        job = MigrationJob(
            account_id=account.id,
            status="pending",
            migrate_years=migrate_years,
        )
        db.add(job)
        db.flush()

        rq_job_id = enqueue_migration(job.uuid)
        job.rq_job_id = rq_job_id
        job_uuids.append(job.uuid)

    db.commit()
    return StartMigrationResponse(jobs_created=len(job_uuids), job_uuids=job_uuids)


@router.post("/{job_uuid}/retry", response_model=JobResponse)
def retry_job(job_uuid: str, db: Session = Depends(get_db)):
    job = _get_job(db, job_uuid)
    if job.status == "running":
        raise HTTPException(status_code=400, detail="Job is still running")

    new_job = MigrationJob(
        account_id=job.account_id,
        status="pending",
        migrate_years=job.migrate_years,
    )
    db.add(new_job)
    db.flush()

    rq_job_id = enqueue_migration(new_job.uuid)
    new_job.rq_job_id = rq_job_id
    db.commit()
    db.refresh(new_job)

    account = db.query(Account).filter(Account.id == new_job.account_id).first()
    return _to_response(new_job, account)


@router.get("/{job_uuid}", response_model=JobResponse)
def get_job(job_uuid: str, db: Session = Depends(get_db)):
    job = _get_job(db, job_uuid)
    sync_job_status(job, db)
    account = db.query(Account).filter(Account.id == job.account_id).first()
    return _to_response(job, account)


@router.get("/{job_uuid}/log", response_model=JobLogResponse)
def get_job_log(job_uuid: str, db: Session = Depends(get_db)):
    job = _get_job(db, job_uuid)
    sync_job_status(job, db)

    content = read_job_log_content(job.uuid, started_at=job.started_at, status=job.status)
    folders = parse_folder_progress(content)
    messages = parse_messages_transferred(content) or (job.messages_transferred or 0)

    return JobLogResponse(
        job_uuid=job.uuid,
        log=content,
        folders=[
            FolderProgressItem(
                name=f.name,
                index=f.index,
                total=f.total,
                source_messages=f.source_messages,
                transferred=f.transferred,
                status=f.status,
            )
            for f in folders
        ],
        messages_transferred=messages,
    )


@router.post("/{job_uuid}/cancel", response_model=JobResponse)
def cancel_job(job_uuid: str, db: Session = Depends(get_db)):
    job = _get_job(db, job_uuid)
    if job.status not in ("pending", "running"):
        raise HTTPException(
            status_code=400,
            detail="Only pending or running jobs can be cancelled",
        )

    account = db.query(Account).filter(Account.id == job.account_id).first()
    yandex_email = account.yandex_email if account else None

    mark_job_cancelled(job.uuid, yandex_email)
    cancel_migration(job.rq_job_id)
    append_cancelled_to_job_log(job.uuid)
    job.status = "failed"
    job.error_message = CANCELLED_BY_USER
    job.finished_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(job)

    return _to_response(job, account)


@router.delete("/{job_uuid}", status_code=204)
def delete_job(job_uuid: str, db: Session = Depends(get_db)):
    job = _get_job(db, job_uuid)
    if job.status == "running":
        raise HTTPException(
            status_code=400,
            detail="Cannot delete a running job. Cancel it first or wait for completion.",
        )
    if job.status == "pending":
        cancel_migration(job.rq_job_id)
    delete_job_log(job.uuid)
    db.delete(job)
    db.commit()
