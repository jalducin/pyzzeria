from collections.abc import Iterable

from fastapi import Depends, Header
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.errors import AuthRequired, Forbidden
from app.core.security import decode_access_token
from app.models.user import UserRole


def get_current_claims(authorization: str | None = Header(default=None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise AuthRequired()
    token = authorization.split(" ", 1)[1]
    try:
        return decode_access_token(token)
    except ValueError as exc:
        raise AuthRequired(str(exc)) from exc


def require_roles(*allowed: UserRole):
    allowed_set: set[str] = {r.value for r in allowed}

    def _dep(claims: dict = Depends(get_current_claims)) -> dict:
        role = claims.get("role")
        if role not in allowed_set:
            raise Forbidden(f"Rol '{role}' no autorizado")
        return claims

    return _dep


def db_session(db: Session = Depends(get_db)) -> Session:
    return db


__all__: Iterable[str] = ("get_current_claims", "require_roles", "db_session")
