# Pyzzeria 🍕

Sistema de pedidos de pizza **serverless en AWS Free Tier** — demo de portafolio construido con
metodología **Spec-Driven Development (SDD)**.

Un visitante elige tamaño y toppings, deja su nombre, y ve el pedido avanzar en tiempo real
durante ~70 segundos a través de 5 estados, sin EC2 ni servidores de costo fijo.

**[Ver demo →]** *(URL disponible tras `sam deploy`)*

## Stack

| Capa | Tecnología |
|------|-----------|
| Backend | Python 3.12 + FastAPI + **Mangum** → AWS Lambda |
| Base de datos | **DynamoDB** on-demand (sin instancia) |
| API | API Gateway HTTP API + **WebSocket API** |
| Orquestación | **Step Functions** Express Workflow |
| Frontend | HTML + CSS + JS vainilla → **S3 + CloudFront** |
| IaC | **AWS SAM** (`template.yaml`) |

## Quickstart — desarrollo local

```bash
pip install -r requirements.txt
uvicorn backend.main:app --reload
# Abre http://localhost:8000
# Nota: POST /api/orders requiere DynamoDB — usar sam deploy para E2E completo
```

## Deploy a AWS (Free Tier)

```bash
sam build
sam deploy --guided   # primera vez — configura stack "pyzzeria", región us-east-2
```

Tras el deploy, actualiza `frontend/config.js` con las URLs del output:

```js
const API_BASE_URL = 'https://<id>.execute-api.us-east-2.amazonaws.com';
const WS_URL       = 'wss://<id>.execute-api.us-east-2.amazonaws.com/prod';
```

Luego sincroniza el frontend y carga datos demo:

```bash
aws s3 sync frontend/ s3://<bucket>/ --delete
aws cloudfront create-invalidation --distribution-id <id> --paths "/*"
python scripts/seed.py --table-name pyzzeria-orders --region us-east-2
```

## Pruebas

```bash
pytest --cov=backend   # 18 tests, cobertura ~95%
```

## Metodología (SDD / OpenSpec)

```
Propuesta → Specs → Design → Tasks → Código → Tests → Archive
```

Los artefactos viven en `openspec/changes/pyzzeria-sprint1/`:
- `proposal.md` — por qué
- `specs/` — qué (requisitos y escenarios verificables)
- `design.md` — cómo (decisiones técnicas y trade-offs)
- `tasks.md` — plan de implementación paso a paso

**Regla principal**: si necesitas cambiar el comportamiento, actualiza el spec primero.

## Estructura

```
pyzzeria/
├── backend/
│   ├── main.py          # FastAPI app + Mangum handler
│   ├── menu.py          # Menú hardcoded (tamaños + toppings)
│   ├── dynamo.py        # Helpers DynamoDB
│   └── ws_handlers/     # Lambdas WebSocket (@connect, @disconnect, status_update)
├── frontend/            # SPA 4 pantallas (S3 + CloudFront)
├── statemachine/        # ASL del Step Functions Express Workflow
├── scripts/
│   └── seed.py          # Carga 3 pedidos demo en DynamoDB
├── tests/               # pytest + moto (18 tests, ~95% cobertura)
├── template.yaml        # SAM IaC — todos los recursos AWS
└── samconfig.toml       # Config de deploy (stack, región)
```

## Fuera de alcance (v1)

- Autenticación de usuarios
- Pagos reales
- Múltiples cocinas / ubicaciones
- Cancelaciones / reembolsos
