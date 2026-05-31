def test_app_imports():
    from app.main import app

    paths = {r.path for r in app.routes}
    assert "/health" in paths
    assert "/auth/login" in paths
    assert "/products" in paths
    assert "/sales" in paths


def test_models_registered_on_metadata():
    from app.core.db import Base
    from app.models import AuditLog, Branch, CreditNote, Product, RefundLog, Sale, SaleItem, User  # noqa: F401

    tables = set(Base.metadata.tables.keys())
    assert {"branches", "users", "products", "sales", "sale_items", "refund_logs", "credit_notes", "audit_logs"} <= tables


def test_calculate_totals_banker_rounding():
    from decimal import Decimal

    from app.services.sales_service import _round_cents

    assert _round_cents(Decimal("10.125")) == Decimal("10.12")
    assert _round_cents(Decimal("10.135")) == Decimal("10.14")


def test_error_contract_shape():
    from app.core.errors import StockInsufficient

    exc = StockInsufficient("test", details={"sku": "X"})
    assert exc.code == "STOCK_INSUFFICIENT"
    assert exc.status_code == 409
    assert exc.details == {"sku": "X"}
