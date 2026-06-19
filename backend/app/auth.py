from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import HTTPException, status

from app.config import settings

ALGORITHM = "HS256"


def auth_is_configured() -> bool:
    return bool(settings.admin_password and settings.jwt_secret)


def verify_admin_credentials(username: str, password: str) -> bool:
    if not auth_is_configured():
        return False
    user_ok = secrets.compare_digest(username, settings.admin_username)
    pass_ok = secrets.compare_digest(password, settings.admin_password)
    return user_ok and pass_ok


def create_access_token(subject: str) -> tuple[str, int]:
    if not settings.jwt_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Kimlik doğrulama yapılandırılmamış (JWT_SECRET eksik)",
        )
    expires_hours = settings.jwt_expire_hours
    expire = datetime.now(timezone.utc) + timedelta(hours=expires_hours)
    payload = {"sub": subject, "exp": expire}
    token = jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)
    return token, expires_hours * 3600


def decode_access_token(token: str) -> str:
    if not settings.jwt_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Kimlik doğrulama yapılandırılmamış",
        )
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Oturum süresi doldu",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz oturum",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None

    subject = payload.get("sub")
    if not subject or subject != settings.admin_username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz oturum",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return subject
