import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.sale import PaymentMethod, SaleStatus


class CartItem(BaseModel):
    product_id: uuid.UUID
    quantity: int = Field(..., gt=0)


class SaleCreate(BaseModel):
    items: list[CartItem] = Field(..., min_length=1, max_length=50)
    payment_method: PaymentMethod
    cash_received: Decimal | None = Field(default=None, ge=0, decimal_places=2)


class SaleItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    product_id: uuid.UUID
    quantity: int
    unit_price: Decimal
    subtotal: Decimal


class SaleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    cashier_id: uuid.UUID
    branch_id: uuid.UUID | None
    subtotal: Decimal
    tax: Decimal
    total: Decimal
    payment_method: PaymentMethod
    cash_received: Decimal | None
    change_given: Decimal | None
    status: SaleStatus
    created_at: datetime


class RefundItem(BaseModel):
    sale_item_id: uuid.UUID
    quantity: int = Field(..., gt=0)


class RefundRequest(BaseModel):
    items: list[RefundItem] = Field(..., min_length=1)
    reason: str | None = Field(default=None, max_length=500)
