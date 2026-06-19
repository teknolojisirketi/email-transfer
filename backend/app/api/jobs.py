from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
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
from app.services.log_parser import parse_folder_progress
from app.services.queue_service import cancel_migration, enqueue_migration

router = APIRouter(
    prefix="/jobs",
    tags=["jobs"],
    dependencies=[Depends(get_current_user)],
)


def _to_response(job: MigrationJob, account: Account | None = None) -> JobResponse:
    return JobResponse(
        id=job.id,
        account_id=job.account_id,
        status=job.status,
        messages_transferred=job.messages_transferred or 0,
        error_message=job.error_message,
        log_file=job.log_file,
        started_at=job.started_at,
        finished_at=job.finished_at,
        created_at=job.created_at,
        yandex_email=account.yandex_email if account else None,
        cpanel_email=account.cpanel_email if account else None,
    )


@router.get("", response_model=list[JobResponse])
def list_jobs(db: Session = Depends(get_db)):
    jobs = db.query(MigrationJob).order_by(MigrationJob.id.desc()).all()
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

    job_ids = []
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

        job = MigrationJob(account_id=account.id, status="pending")
        db.add(job)
        db.flush()

        rq_job_id = enqueue_migration(job.id)
        job.rq_job_id = rq_job_id
        job_ids.append(job.id)

    db.commit()
    return StartMigrationResponse(jobs_created=len(job_ids), job_ids=job_ids)


@router.post("/{job_id}/retry", response_model=JobResponse)
def retry_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(MigrationJob).filter(MigrationJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status == "running":
        raise HTTPException(status_code=400, detail="Job is still running")

    new_job = MigrationJob(account_id=job.account_id, status="pending")
    db.add(new_job)
    db.flush()

    rq_job_id = enqueue_migration(new_job.id)
    new_job.rq_job_id = rq_job_id
    db.commit()
    db.refresh(new_job)

    account = db.query(Account).filter(Account.id == new_job.account_id).first()
    return _to_response(new_job, account)


@router.get("/{job_id}", response_model=JobResponse)
def get_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(MigrationJob).filter(MigrationJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    account = db.query(Account).filter(Account.id == job.account_id).first()
    return _to_response(job, account)


@router.get("/{job_id}/log", response_model=JobLogResponse)
def get_job_log(job_id: int, db: Session = Depends(get_db)):
    job = db.query(MigrationJob).filter(MigrationJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    log_path = Path(settings.logs_dir) / f"job-{job_id}.log"
    if log_path.exists():
        content = log_path.read_text(encoding="utf-8", errors="replace")
    elif job.log_file and Path(job.log_file).exists():
        content = Path(job.log_file).read_text(encoding="utf-8", errors="replace")
    else:
        content = ""

    folders = parse_folder_progress(content)
    messages = parse_messages_transferred(content) or (job.messages_transferred or 0)

    return JobLogResponse(
        job_id=job_id,
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


@router.delete("/{job_id}", status_code=204)
def delete_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(MigrationJob).filter(MigrationJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status == "running":
        raise HTTPException(
            status_code=400,
            detail="Çalışan iş silinemez. Bitmesini bekleyin veya worker'ı durdurun.",
        )
    if job.status == "pending":
        cancel_migration(job.rq_job_id)
    db.delete(job)
    db.commit()
