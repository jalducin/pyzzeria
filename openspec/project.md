# Contexto del proyecto

## Qué es

**Pyzzeria** — sistema de pedidos de pizza serverless en AWS Free Tier, demo de portafolio.
Un visitante elige tamaño y toppings, deja su nombre, y ve el tracker en tiempo real durante ~70 segundos
mientras su pedido "avanza" por 5 estados (recibido → preparando → horno → listo → entregado).

Objetivo: demostrar Lambda, DynamoDB, Step Functions, API Gateway WebSocket y S3+CloudFront
en un solo proyecto desplegable con un comando (`sam build && sam deploy`).

## Stack tecnológico

- **Lenguaje**: Python 3.12
- **Framework backend**: FastAPI + Mangum (adaptador ASGI→Lambda)
- **Base de datos**: DynamoDB on-demand (sin instancia persistente)
- **IaC**: AWS SAM (`template.yaml`)
- **Frontend**: HTML + CSS + JS vainilla (SPA 4 pantallas), servido desde S3 + CloudFront

## Arquitectura

```
Visitante
  ├─ GET /api/menu/*         → Lambda (FastAPI+Mangum) → menú hardcoded
  ├─ POST /api/orders        → Lambda → DynamoDB + Step Functions Express start
  ├─ GET /api/orders/{id}    → Lambda → DynamoDB
  ├─ WSS connect             → Lambda WS @connect → DynamoDB ws_connections
  └─ Step Functions Express (~70s):
       cada estado → Lambda status_update → DynamoDB UPDATE + WSS push → stepper avanza
Frontend (S3 + CloudFront, HTTPS)
```

## Convenciones

- Idioma: documentación y comentarios en español; identificadores de código en inglés.
- Commits: conventional commits.
- Ramas: `feature/[spec]` → `sprint/YYYY-NN` → `main`.
- Estándares en `docs/base-standards.md` y `docs/documentation-standards.md`.

## Comandos clave

- Instalar dependencias: `pip install -r requirements.txt`
- Dev local (sin DynamoDB): `uvicorn backend.main:app --reload`
- Ejecutar pruebas: `pytest --cov=backend`
- Build IaC: `sam build`
- Deploy completo: `sam deploy` (primera vez: `sam deploy --guided`)
- Seed data: `python scripts/seed.py --table-name pyzzeria-orders --region us-east-2`
