import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.deps import db_session, get_current_claims, require_roles
from app.core.errors import NotFound
from app.models.product import Product
from app.models.user import UserRole
from app.schemas.product import ProductCreate, ProductOut, ProductUpdate

router = APIRouter(prefix="/products", tags=["products"])


@router.get("", response_model=list[ProductOut])
def list_products(
    db: Session = Depends(db_session),
    _claims: dict = Depends(get_current_claims),
    category: str | None = None,
    in_stock: bool | None = None,
    limit: int = Query(50, ge=1, le=200),
) -> list[Product]:
    stmt = select(Product).where(Product.is_active.is_(True))
    if category:
        stmt = stmt.where(Product.category == category)
    if in_stock:
        stmt = stmt.where(Product.stock > 0)
    return list(db.execute(stmt.limit(limit)).scalars())


@router.get("/search", response_model=list[ProductOut])
def search_products(
    q: str = Query(..., min_length=1, max_length=100),
    db: Session = Depends(db_session),
    _claims: dict = Depends(get_current_claims),
) -> list[Product]:
    like = f"%{q}%"
    stmt = select(Product).where(Product.is_active.is_(True), or_(Product.name.ilike(like), Product.barcode == q, Product.sku == q))
    return list(db.execute(stmt.limit(50)).scalars())


@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: uuid.UUID, db: Session = Depends(db_session), _claims: dict = Depends(get_current_claims)) -> Product:
    product = db.get(Product, product_id)
    if product is None or not product.is_active:
        raise NotFound("Producto no encontrado")
    return product


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(
    payload: ProductCreate,
    db: Session = Depends(db_session),
    _claims: dict = Depends(require_roles(UserRole.admin)),
) -> Product:
    product = Product(**payload.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.put("/{product_id}", response_model=ProductOut)
def update_product(
    product_id: uuid.UUID,
    payload: ProductUpdate,
    db: Session = Depends(db_session),
    _claims: dict = Depends(require_roles(UserRole.admin)),
) -> Product:
    product = db.get(Product, product_id)
    if product is None:
        raise NotFound("Producto no encontrado")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(product, field, value)
    db.commit()
    db.refresh(product)
    return product


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def soft_delete_product(
    product_id: uuid.UUID,
    db: Session = Depends(db_session),
    _claims: dict = Depends(require_roles(UserRole.admin)),
) -> None:
    product = db.get(Product, product_id)
    if product is None:
        raise NotFound("Producto no encontrado")
    product.is_active = False
    db.commit()
