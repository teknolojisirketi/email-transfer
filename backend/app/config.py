from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    encryption_key: str = ""
    yandex_imap_host: str = "imap.yandex.com.tr"
    yandex_imap_port: int = 993
    yandex_imap_ssl: bool = True
    cpanel_imap_port: int = 993
    cpanel_imap_ssl: bool = True
    worker_concurrency: int = 2
    redis_url: str = "redis://redis:6379/0"
    database_url: str = "sqlite:////data/email_transfer.db"
    logs_dir: str = "/logs"
    admin_username: str = "admin"
    admin_password: str = ""
    jwt_secret: str = ""
    jwt_expire_hours: int = 24


settings = Settings()
