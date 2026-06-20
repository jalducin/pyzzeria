---
description: Reglas de oro del proyecto — no negociables. Aplican a todo servicio o endpoint nuevo.
alwaysApply: true
---

# Reglas de oro

Estas reglas son **no negociables** y aplican a cada servicio, endpoint o caso nuevo que se implemente.
El CI las verifica automáticamente; el agente las valida manualmente antes de marcar cualquier tarea como completa.

## Regla 1 — Swagger / OpenAPI obligatorio

**Todo servicio debe estar documentado y accesible vía Swagger.**

- El endpoint `/openapi.json` debe responder HTTP 200 con el schema completo.
- El endpoint `/docs` (Swagger UI) debe ser accesible.
- Cada endpoint nuevo debe tener: `summary`, `description` (si la lógica no es trivial), `response` schemas y códigos de error documentados (`400`, `401`, `404`, `409`, `422` según aplique).
- El CI verifica que `/openapi.json` y `/docs` respondan antes de permitir el merge.

```python
# Ejemplo mínimo en FastAPI
@router.post(
    "/api/sales",
    summary="Registrar venta",
    response_model=SaleResponse,
    responses={
        409: {"description": "Stock insuficiente"},
        422: {"description": "Carrito vacío o datos inválidos"},
    },
)
```

## Regla 2 — Autenticación obligatoria en endpoints protegidos

**Todo endpoint que modifique estado o acceda a datos sensibles debe requerir autenticación.**

- Usar JWT Bearer token (header `Authorization: Bearer <token>`).
- El endpoint `POST /auth/login` es el único que no requiere token.
- Los endpoints de solo lectura públicos (ej. catálogo de productos en POS demo) pueden ser abiertos si está justificado en el spec.
- **Justificación explícita en el spec** si un endpoint no requiere auth (ej. "fuera de alcance en v1").
- La ausencia de auth en un endpoint protegido es un blocker de merge.

```python
# Dependencia de autenticación en FastAPI
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer

security = HTTPBearer()

async def require_auth(token = Depends(security)):
    # validar token JWT
    ...
```

## Regla 3 — Pruebas unitarias por cada caso nuevo

**Cada escenario del spec debe tener al menos un test automatizado.**

- Por cada `Scenario` en `openspec/specs/[name]/spec.md`, debe existir al menos un test en `tests/`.
- Los tests cubren tanto el happy path como los casos de error (4xx).
- Nomenclatura: `test_[feature]_[scenario_en_snake_case]` (ej. `test_sales_stock_insuficiente`).
- Los tests se ejecutan en CI con `pytest --tb=short`.
- Cobertura mínima del módulo nuevo: **80%** (medida con `pytest-cov`).
- **Nunca marcar un spec como completo sin que todos sus tests pasen en CI.**

```python
# Ejemplo de estructura de tests
def test_sales_venta_exitosa(client, db):
    ...

def test_sales_stock_insuficiente_retorna_409(client, db):
    ...

def test_sales_carrito_vacio_retorna_422(client):
    ...
```

## Checklist de merge (aplica a todo PR)

Antes de mergear cualquier `feature/*` → `sprint/*`:

- [ ] `/openapi.json` y `/docs` accesibles (CI lo verifica)
- [ ] Todos los endpoints nuevos tienen `summary` y schemas documentados
- [ ] Endpoints protegidos requieren JWT (o justificación en spec si son públicos)
- [ ] Cada escenario del spec tiene al menos un test
- [ ] Cobertura del módulo nuevo ≥ 80%
- [ ] CI en verde (todas las checks pasando)
- [ ] Spec archivado en `openspec/changes/archive/` o en progreso documentado
