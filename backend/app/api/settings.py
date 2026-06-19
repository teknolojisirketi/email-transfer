from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.deps import get_current_user
from app.database import AppSettings, get_db
from app.schemas import SettingsResponse, SettingsUpdate
from app.services.settings_service import get_or_create_app_settings

router = APIRouter(
    prefix="/settings",
    tags=["settings"],
    dependencies=[Depends(get_current_user)],
)


def _to_response(row: AppSettings) -> SettingsResponse:
    return SettingsResponse(
        yandex_imap_host=row.yandex_imap_host,
        yandex_imap_port=row.yandex_imap_port,
        yandex_imap_ssl=row.yandex_imap_ssl,
        cpanel_imap_port=row.cpanel_imap_port,
        cpanel_imap_ssl=row.cpanel_imap_ssl,
        worker_concurrency=row.worker_concurrency,
    )


@router.get("", response_model=SettingsResponse)
def get_settings():
    row = get_or_create_app_settings()
    return _to_response(row)


@router.put("", response_model=SettingsResponse)
def update_settings(payload: SettingsUpdate, db: Session = Depends(get_db)):
    row = db.query(AppSettings).first()
    if row is None:
        row = get_or_create_app_settings()
        row = db.query(AppSettings).first()

    if payload.yandex_imap_host is not None:
        row.yandex_imap_host = payload.yandex_imap_host.strip()
    if payload.yandex_imap_port is not None:
        row.yandex_imap_port = payload.yandex_imap_port
    if payload.yandex_imap_ssl is not None:
        row.yandex_imap_ssl = payload.yandex_imap_ssl
    if payload.cpanel_imap_port is not None:
        row.cpanel_imap_port = payload.cpanel_imap_port
    if payload.cpanel_imap_ssl is not None:
        row.cpanel_imap_ssl = payload.cpanel_imap_ssl
    if payload.worker_concurrency is not None:
        row.worker_concurrency = payload.worker_concurrency

    db.commit()
    db.refresh(row)
    return _to_response(row)
