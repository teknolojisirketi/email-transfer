from pathlib import Path

from app.config import settings
from app.database import AppSettings, SessionLocal


def get_or_create_app_settings() -> AppSettings:
    db = SessionLocal()
    try:
        row = db.query(AppSettings).first()
        if row is None:
            row = AppSettings(
                yandex_imap_host=settings.yandex_imap_host,
                yandex_imap_port=settings.yandex_imap_port,
                yandex_imap_ssl=settings.yandex_imap_ssl,
                cpanel_imap_port=settings.cpanel_imap_port,
                cpanel_imap_ssl=settings.cpanel_imap_ssl,
                worker_concurrency=settings.worker_concurrency,
            )
            db.add(row)
            db.commit()
            db.refresh(row)
        return row
    finally:
        db.close()


def ensure_logs_dir() -> Path:
    path = Path(settings.logs_dir)
    path.mkdir(parents=True, exist_ok=True)
    return path
