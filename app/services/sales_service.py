import uuid
from decimal import ROUND_HALF_EVEN, Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import PaymentDeclined, StockInsufficient, ValidationError
from app.models.product import Product
from app.models.sale import PaymentMethod, Sale, SaleStatus
from app.models.sale_item import SaleItem
from app.schemas.sale import SaleCreate

_CENT = Decimal("0.01")


def _round_cents(value: Decimal) -> Decimal:
    return value.quantize(_CENT, rounding=ROUND_HALF_EVEN)


def process_sale(
    db: Session,
    cashier_id: uuid.UUID,
    branch_id: uuid.UUID | None,
    payload: SaleCreate,
    idempotency_key: str | None = None,
) -> Sale:
    """Step Functions equivalente local: CheckIdempotency → ValidateCart → CalculateTotals → ProcessPayment → UpdateInventory → PersistSale."""

    if idempotency_key:
        existing = db.execute(select(Sale).where(Sale.idempotency_key == idempotency_key)).scalar_one_or_none()
        if existing is not None:
            return existing

    product_ids = [item.product_id for item in payload.items]
    products = {p.id: p for p in db.execute(select(Product).where(Product.id.in_(product_ids))).scalars()}

    for item in payload.items:
        product = products.get(item.product_id)
        if product is None or not product.is_active:
            raise ValidationError(f"Producto {item.product_id} inválido o inactivo")
        if product.stock < item.quantity:
            raise StockInsufficient(
                "Stock insuficiente",
                details={"product_id": str(product.id), "sku": product.sku, "available": product.stock, "requested": item.quantity},
            )

    iva_rate = Decimal(str(get_settings().iva_rate))
    sale_items: list[SaleItem] = []
    subtotal = Decimal("0")
    for item in payload.items:
        product = products[item.product_id]
        line_subtotal = _round_cents(product.price * item.quantity)
        subtotal += line_subtotal
        sale_items.append(
            SaleItem(product_id=product.id, quantity=item.quantity, unit_price=product.price, subtotal=line_subtotal)
        )
    subtotal = _round_cents(subtotal)
    tax = _round_cents(subtotal * iva_rate)
    total = _round_cents(subtotal + tax)

    cash_received: Decimal | None = None
    change_given: Decimal | None = None
    status = SaleStatus.completed

    if payload.payment_method == PaymentMethod.cash:
        if payload.cash_received is None or payload.cash_received < total:
            raise ValidationError("Efectivo recibido insuficiente", details={"total": str(total)})
        cash_received = _round_cents(payload.cash_received)
        change_given = _round_cents(cash_received - total)
    elif payload.payment_method == PaymentMethod.card:
        if not _mock_card_terminal_approves(total):
            raise PaymentDeclined("Terminal rechazó el cobro")

    sale = Sale(
        cashier_id=cashier_id,
        branch_id=branch_id,
        idempotency_key=idempotency_key,
        subtotal=subtotal,
        tax=tax,
        total=total,
        payment_method=payload.payment_method,
        cash_received=cash_received,
        change_given=change_given,
        status=status,
    )
    db.add(sale)
    db.flush()
    for sale_item in sale_items:
        sale_item.sale_id = sale.id
        db.add(sale_item)
        products[sale_item.product_id].stock -= sale_item.quantity

    db.commit()
    db.refresh(sale)
    return sale


def _mock_card_terminal_approves(total: Decimal) -> bool:
    """Mock determinístico: aprueba salvo totales que terminan en .13 (testing). Ver DT-02."""
    return total.quantize(_CENT) % Decimal("1.00") != Decimal("0.13")
