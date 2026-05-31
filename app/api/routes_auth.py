from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import db_session
from app.core.config import get_settings
from app.core.errors import AuthRequired
from app.core.security import create_access_token, verify_password
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(db_session)) -> TokenResponse:
    user = db.execute(select(User).where(User.email == payload.email, User.is_active.is_(True))).scalar_one_or_none()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise AuthRequired("Credenciales inválidas")

    settings = get_settings()
    token = create_access_token(subject=str(user.id), role=user.role.value, branch_id=str(user.branch_id) if user.branch_id else None)
    return TokenResponse(access_token=token, expires_in_hours=settings.jwt_expiration_hours)
