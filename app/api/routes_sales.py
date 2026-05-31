import uuid

from fastapi import APIRouter, Depends, Header, status
from sqlalchemy.orm import Session

from app.api.deps import db_session, get_current_claims
from app.core.errors import NotFound
from app.models.sale import Sale
from app.schemas.sale import SaleCreate, SaleOut
from app.services.sales_service import process_sale

router = APIRouter(prefix="/sales", tags=["sales"])


@router.post("", response_model=SaleOut, status_code=status.HTTP_201_CREATED)
def create_sale(
    payload: SaleCreate,
    db: Session = Depends(db_session),
    claims: dict = Depends(get_current_claims),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key", max_length=64),
) -> Sale:
    cashier_id = uuid.UUID(claims["sub"])
    branch_id = uuid.UUID(claims["branch_id"]) if claims.get("branch_id") else None
    return process_sale(
        db=db,
        cashier_id=cashier_id,
        branch_id=branch_id,
        payload=payload,
        idempotency_key=idempotency_key,
    )


@router.get("/{sale_id}", response_model=SaleOut)
def get_sale(sale_id: uuid.UUID, db: Session = Depends(db_session), _claims: dict = Depends(get_current_claims)) -> Sale:
    sale = db.get(Sale, sale_id)
    if sale is None:
        raise NotFound("Venta no encontrada")
    return sale
