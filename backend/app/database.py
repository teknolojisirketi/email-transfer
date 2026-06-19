from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, create_engine
from sqlalchemy.orm import DeclarativeBase, relationship, sessionmaker

from app.config import settings


class Base(DeclarativeBase):
    pass


class AppSettings(Base):
    __tablename__ = "app_settings"

    id = Column(Integer, primary_key=True)
    yandex_imap_host = Column(String(255), nullable=False, default="imap.yandex.com")
    yandex_imap_port = Column(Integer, nullable=False, default=993)
    yandex_imap_ssl = Column(Boolean, nullable=False, default=True)
    cpanel_imap_port = Column(Integer, nullable=False, default=993)
    cpanel_imap_ssl = Column(Boolean, nullable=False, default=True)
    worker_concurrency = Column(Integer, nullable=False, default=2)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True)
    yandex_email = Column(String(255), nullable=False)
    yandex_password_enc = Column(Text, nullable=False)
    cpanel_email = Column(String(255), nullable=False)
    cpanel_password_enc = Column(Text, nullable=False)
    cpanel_imap_host = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    jobs = relationship("MigrationJob", back_populates="account", cascade="all, delete-orphan")


class MigrationJob(Base):
    __tablename__ = "migration_jobs"

    id = Column(Integer, primary_key=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    status = Column(String(50), nullable=False, default="pending")
    messages_transferred = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    log_file = Column(String(512), nullable=True)
    rq_job_id = Column(String(255), nullable=True)
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    account = relationship("Account", back_populates="jobs")


engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db() -> None:
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
