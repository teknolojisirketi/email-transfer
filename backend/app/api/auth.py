from fastapi import APIRouter, Depends, HTTPException, status

from app.auth import auth_is_configured, create_access_token, verify_admin_credentials
from app.deps import get_current_user
from app.schemas import LoginRequest, LoginResponse, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest):
    if not auth_is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ADMIN_PASSWORD ve JWT_SECRET .env dosyasında tanımlanmalı",
        )
    if not verify_admin_credentials(payload.username.strip(), payload.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Kullanıcı adı veya şifre hatalı",
        )
    token, expires_in = create_access_token(payload.username.strip())
    return LoginResponse(access_token=token, token_type="bearer", expires_in=expires_in)


@router.get("/me", response_model=UserResponse)
def me(username: str = Depends(get_current_user)):
    return UserResponse(username=username)
