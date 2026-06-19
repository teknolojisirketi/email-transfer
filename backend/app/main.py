from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import accounts, auth, jobs, settings as settings_api
from app.database import init_db
from app.services.settings_service import ensure_logs_dir, get_or_create_app_settings


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    ensure_logs_dir()
    get_or_create_app_settings()
    yield


app = FastAPI(
    title="Email Transfer",
    description="Yandex to cPanel email migration via imapsync",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(accounts.router, prefix="/api")
app.include_router(jobs.router, prefix="/api")
app.include_router(settings_api.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}
