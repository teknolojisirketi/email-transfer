from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_serializer

from app.datetime_utils import serialize_utc_datetime


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class UserResponse(BaseModel):
    username: str


class SettingsResponse(BaseModel):
    yandex_imap_host: str
    yandex_imap_port: int
    yandex_imap_ssl: bool
    cpanel_imap_port: int
    cpanel_imap_ssl: bool
    worker_concurrency: int


class SettingsUpdate(BaseModel):
    yandex_imap_host: Optional[str] = None
    yandex_imap_port: Optional[int] = None
    yandex_imap_ssl: Optional[bool] = None
    cpanel_imap_port: Optional[int] = None
    cpanel_imap_ssl: Optional[bool] = None
    worker_concurrency: Optional[int] = Field(None, ge=1, le=10)


class AccountCreate(BaseModel):
    yandex_email: str
    yandex_password: str
    cpanel_email: str
    cpanel_password: str
    cpanel_imap_host: str


class AccountUpdate(BaseModel):
    yandex_email: Optional[str] = None
    yandex_password: Optional[str] = None
    cpanel_email: Optional[str] = None
    cpanel_password: Optional[str] = None
    cpanel_imap_host: Optional[str] = None


class AccountResponse(BaseModel):
    id: int
    yandex_email: str
    cpanel_email: str
    cpanel_imap_host: str
    created_at: datetime
    latest_job_uuid: Optional[str] = None
    latest_job_status: Optional[str] = None
    messages_transferred: int = 0
    latest_job_error: Optional[str] = None

    model_config = {"from_attributes": True}

    @field_serializer("created_at")
    def serialize_created_at(self, value: datetime) -> str:
        return serialize_utc_datetime(value) or ""


class BulkImportRequest(BaseModel):
    accounts: list[AccountCreate]
    replace_existing: bool = False


class BulkImportResponse(BaseModel):
    imported: int
    skipped: int


class ImapTestResultResponse(BaseModel):
    success: bool
    message: str
    folder_count: int = 0
    inbox_messages: int = 0


class AccountTestResponse(BaseModel):
    yandex: ImapTestResultResponse
    cpanel: ImapTestResultResponse
    overall_success: bool


class AccountFolderItem(BaseModel):
    name: str
    is_standard: bool


class AccountFoldersResponse(BaseModel):
    account_id: int
    yandex_email: str
    folders: list[AccountFolderItem]


class JobResponse(BaseModel):
    uuid: str
    account_id: int
    status: str
    messages_transferred: int
    error_message: Optional[str]
    log_file: Optional[str]
    migrate_years: Optional[str] = None
    migrate_folders: Optional[str] = None
    started_at: Optional[datetime]
    finished_at: Optional[datetime]
    created_at: datetime
    yandex_email: Optional[str] = None
    cpanel_email: Optional[str] = None

    model_config = {"from_attributes": True}

    @field_serializer("started_at", "finished_at", "created_at")
    def serialize_datetimes(self, value: Optional[datetime]) -> Optional[str]:
        return serialize_utc_datetime(value)


class FolderProgressItem(BaseModel):
    name: str
    index: int
    total: int
    source_messages: Optional[int] = None
    transferred: Optional[int] = None
    status: str


class JobLogResponse(BaseModel):
    job_uuid: str
    log: str
    folders: list[FolderProgressItem] = []
    messages_transferred: int = 0


class StartMigrationRequest(BaseModel):
    account_ids: list[int] | None = None
    years: list[int] | None = None
    folders: list[str] | None = None


class StartMigrationResponse(BaseModel):
    jobs_created: int
    job_uuids: list[str]
