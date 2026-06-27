from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.crypto import decrypt_password, encrypt_password
from app.database import Account, MigrationJob, get_db
from app.schemas import (
    AccountCreate,
    AccountResponse,
    AccountTestResponse,
    AccountUpdate,
    BulkImportRequest,
    BulkImportResponse,
    ImapTestResultResponse,
)
from app.deps import get_current_user
from app.services.imap_test import test_imap_connection
from app.services.job_sync import sync_active_jobs
from app.services.settings_service import get_or_create_app_settings

router = APIRouter(
    prefix="/accounts",
    tags=["accounts"],
    dependencies=[Depends(get_current_user)],
)


def _derive_imap_host(cpanel_email: str, cpanel_imap_host: str) -> str:
    host = cpanel_imap_host.strip()
    if host:
        return host
    if "@" in cpanel_email:
        domain = cpanel_email.split("@", 1)[1]
        return f"mail.{domain}"
    return ""


def _latest_job_info(db: Session, account_id: int) -> tuple[str | None, str | None, int, str | None]:
    active = (
        db.query(MigrationJob)
        .filter(
            MigrationJob.account_id == account_id,
            MigrationJob.status.in_(["pending", "running"]),
        )
        .order_by(MigrationJob.created_at.desc())
        .first()
    )
    if active:
        return (
            active.uuid,
            active.status,
            active.messages_transferred or 0,
            active.error_message,
        )

    latest = (
        db.query(MigrationJob)
        .filter(MigrationJob.account_id == account_id)
        .order_by(MigrationJob.created_at.desc())
        .first()
    )
    if latest:
        return (
            latest.uuid,
            latest.status,
            latest.messages_transferred or 0,
            latest.error_message,
        )
    return None, None, 0, None


def _to_response(
    account: Account,
    *,
    latest_job_uuid: str | None = None,
    latest_job_status: str | None = None,
    messages_transferred: int = 0,
    latest_job_error: str | None = None,
) -> AccountResponse:
    return AccountResponse(
        id=account.id,
        yandex_email=account.yandex_email,
        cpanel_email=account.cpanel_email,
        cpanel_imap_host=account.cpanel_imap_host,
        created_at=account.created_at,
        latest_job_uuid=latest_job_uuid,
        latest_job_status=latest_job_status,
        messages_transferred=messages_transferred,
        latest_job_error=latest_job_error,
    )


def _run_account_test(
    yandex_email: str,
    yandex_password: str,
    cpanel_email: str,
    cpanel_password: str,
    cpanel_imap_host: str,
) -> AccountTestResponse:
    app_settings = get_or_create_app_settings()
    imap_host = _derive_imap_host(cpanel_email, cpanel_imap_host)
    if not imap_host:
        cpanel_result = ImapTestResultResponse(
            success=False,
            message="cPanel IMAP host belirlenemedi",
        )
        yandex_result = ImapTestResultResponse(success=False, message="Test atlandı")
        return AccountTestResponse(
            yandex=yandex_result,
            cpanel=cpanel_result,
            overall_success=False,
        )

    yandex_result = test_imap_connection(
        host=app_settings.yandex_imap_host,
        port=app_settings.yandex_imap_port,
        email=yandex_email,
        password=yandex_password,
        use_ssl=app_settings.yandex_imap_ssl,
    )
    cpanel_result = test_imap_connection(
        host=imap_host,
        port=app_settings.cpanel_imap_port,
        email=cpanel_email,
        password=cpanel_password,
        use_ssl=app_settings.cpanel_imap_ssl,
    )

    return AccountTestResponse(
        yandex=ImapTestResultResponse(
            success=yandex_result.success,
            message=yandex_result.message,
            folder_count=yandex_result.folder_count,
            inbox_messages=yandex_result.inbox_messages,
        ),
        cpanel=ImapTestResultResponse(
            success=cpanel_result.success,
            message=cpanel_result.message,
            folder_count=cpanel_result.folder_count,
            inbox_messages=cpanel_result.inbox_messages,
        ),
        overall_success=yandex_result.success and cpanel_result.success,
    )


@router.post("/test", response_model=AccountTestResponse)
def test_connection(payload: AccountCreate):
    return _run_account_test(
        yandex_email=payload.yandex_email.strip(),
        yandex_password=payload.yandex_password,
        cpanel_email=payload.cpanel_email.strip(),
        cpanel_password=payload.cpanel_password,
        cpanel_imap_host=payload.cpanel_imap_host,
    )


@router.post("/{account_id}/test", response_model=AccountTestResponse)
def test_saved_account(account_id: int, db: Session = Depends(get_db)):
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    return _run_account_test(
        yandex_email=account.yandex_email,
        yandex_password=decrypt_password(account.yandex_password_enc),
        cpanel_email=account.cpanel_email,
        cpanel_password=decrypt_password(account.cpanel_password_enc),
        cpanel_imap_host=account.cpanel_imap_host,
    )


@router.get("", response_model=list[AccountResponse])
def list_accounts(db: Session = Depends(get_db)):
    sync_active_jobs(db)
    accounts = db.query(Account).order_by(Account.id).all()
    result = []
    for account in accounts:
        job_uuid, job_status, messages, job_error = _latest_job_info(db, account.id)
        result.append(
            _to_response(
                account,
                latest_job_uuid=job_uuid,
                latest_job_status=job_status,
                messages_transferred=messages,
                latest_job_error=job_error,
            )
        )
    return result


@router.post("", response_model=AccountResponse, status_code=201)
def create_account(payload: AccountCreate, db: Session = Depends(get_db)):
    cpanel_email = payload.cpanel_email.strip()
    imap_host = _derive_imap_host(cpanel_email, payload.cpanel_imap_host)
    if not imap_host:
        raise HTTPException(status_code=400, detail="cpanel_imap_host could not be determined")

    account = Account(
        yandex_email=payload.yandex_email.strip(),
        yandex_password_enc=encrypt_password(payload.yandex_password),
        cpanel_email=cpanel_email,
        cpanel_password_enc=encrypt_password(payload.cpanel_password),
        cpanel_imap_host=imap_host,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return _to_response(account)


@router.post("/bulk", response_model=BulkImportResponse)
def bulk_import(payload: BulkImportRequest, db: Session = Depends(get_db)):
    if payload.replace_existing:
        db.query(Account).delete()
        db.commit()

    imported = 0
    skipped = 0

    for item in payload.accounts:
        yandex = item.yandex_email.strip()
        cpanel = item.cpanel_email.strip()
        imap_host = _derive_imap_host(cpanel, item.cpanel_imap_host)
        if not yandex or not cpanel or not imap_host:
            skipped += 1
            continue

        existing = (
            db.query(Account)
            .filter(Account.yandex_email == yandex, Account.cpanel_email == cpanel)
            .first()
        )
        if existing and not payload.replace_existing:
            existing.yandex_password_enc = encrypt_password(item.yandex_password)
            existing.cpanel_password_enc = encrypt_password(item.cpanel_password)
            existing.cpanel_imap_host = imap_host
            imported += 1
            continue

        account = Account(
            yandex_email=yandex,
            yandex_password_enc=encrypt_password(item.yandex_password),
            cpanel_email=cpanel,
            cpanel_password_enc=encrypt_password(item.cpanel_password),
            cpanel_imap_host=imap_host,
        )
        db.add(account)
        imported += 1

    db.commit()
    return BulkImportResponse(imported=imported, skipped=skipped)


@router.put("/{account_id}", response_model=AccountResponse)
def update_account(account_id: int, payload: AccountUpdate, db: Session = Depends(get_db)):
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    if payload.yandex_email is not None:
        account.yandex_email = payload.yandex_email.strip()
    if payload.yandex_password is not None:
        account.yandex_password_enc = encrypt_password(payload.yandex_password)
    if payload.cpanel_email is not None:
        account.cpanel_email = payload.cpanel_email.strip()
    if payload.cpanel_password is not None:
        account.cpanel_password_enc = encrypt_password(payload.cpanel_password)
    if payload.cpanel_imap_host is not None:
        account.cpanel_imap_host = payload.cpanel_imap_host.strip()
    elif payload.cpanel_email is not None:
        account.cpanel_imap_host = _derive_imap_host(account.cpanel_email, "")

    db.commit()
    db.refresh(account)
    return _to_response(account)


@router.delete("/{account_id}", status_code=204)
def delete_account(account_id: int, db: Session = Depends(get_db)):
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    db.delete(account)
    db.commit()


@router.delete("", status_code=204)
def delete_all_accounts(db: Session = Depends(get_db)):
    db.query(Account).delete()
    db.commit()
