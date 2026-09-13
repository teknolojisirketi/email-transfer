from datetime import datetime

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
    yandex_imap_host: str | None = None
    yandex_imap_port: int | None = None
    yandex_imap_ssl: bool | None = None
    cpanel_imap_port: int | None = None
    cpanel_imap_ssl: bool | None = None
    worker_concurrency: int | None = Field(None, ge=1, le=10)


class AccountCreate(BaseModel):
    yandex_email: str
    yandex_password: str
    cpanel_email: str
    cpanel_password: str
    cpanel_imap_host: str


class AccountUpdate(BaseModel):
    yandex_email: str | None = None
    yandex_password: str | None = None
    cpanel_email: str | None = None
    cpanel_password: str | None = None
    cpanel_imap_host: str | None = None


class AccountResponse(BaseModel):
    id: int
    yandex_email: str
    cpanel_email: str
    cpanel_imap_host: str
    created_at: datetime
    latest_job_uuid: str | None = None
    latest_job_status: str | None = None
    messages_transferred: int = 0
    latest_job_error: str | None = None
    last_test_success: bool | None = None
    last_test_at: datetime | None = None
    last_test_yandex_message: str | None = None
    last_test_cpanel_message: str | None = None

    model_config = {"from_attributes": True}

    @field_serializer("created_at")
    def serialize_created_at(self, value: datetime) -> str:
        return serialize_utc_datetime(value) or ""

    @field_serializer("last_test_at")
    def serialize_last_test_at(self, value: datetime | None) -> str | None:
        return serialize_utc_datetime(value)


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
    error_message: str | None
    log_file: str | None
    migrate_years: str | None = None
    migrate_folders: str | None = None
    started_at: datetime | None
    finished_at: datetime | None
    created_at: datetime
    yandex_email: str | None = None
    cpanel_email: str | None = None

    model_config = {"from_attributes": True}

    @field_serializer("started_at", "finished_at", "created_at")
    def serialize_datetimes(self, value: datetime | None) -> str | None:
        return serialize_utc_datetime(value)


class FolderProgressItem(BaseModel):
    name: str
    index: int
    total: int
    source_messages: int | None = None
    transferred: int | None = None
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


class BulkDeleteAccountsRequest(BaseModel):
    ids: list[int]


class BulkDeleteJobsRequest(BaseModel):
    uuids: list[str]


class BulkDeleteResponse(BaseModel):
    deleted: int
    skipped: int = 0
