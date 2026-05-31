# POS Retail — Sistema de Punto de Venta

Proyecto desarrollado con **Spec-Driven Development (SDD)** usando Claude Code.

## Stack

- Python 3.12 + FastAPI
- PostgreSQL (prod/staging) · SQLite (dev/test) · Redis (sesiones e idempotencia)
- AWS Lambda + API Gateway + Step Functions
- JWT Auth + RBAC

## Documentación SDD

| Archivo | Descripción | Versión |
| --- | --- | --- |
| [requirements.md](docs/sdd/requirements.md) | Casos de uso, FR/NFR, criterios de aceptación | 1.1.1 |
| [design.md](docs/sdd/design.md) | Arquitectura, modelos, endpoints, ADR | 1.1.1 |
| [tasks.md](docs/sdd/tasks.md) | Sprints y tareas con DoD | 1.1.0 |
| [tech-debt.md](docs/sdd/tech-debt.md) | Registro de deuda técnica (DT-01..DT-12) | 1.3.0 |

## Flujo SDD

```text
requirements.md → design.md → tasks.md → implementación
       └─ deuda registrada en tech-debt.md cuando un punto nuevo queda sin cerrar
```

## Quickstart local (SQLite)

Sin Postgres ni Redis — usa SQLite por defecto. Pensado para desarrollo y para que Gemini pueda probar el frontend contra una API real.

```powershell
# 1. Entorno
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# 2. Migración inicial (crea pos_local.db con las 8 tablas)
python -m alembic upgrade head

# 3. Seed de datos de prueba (admin + cajero + 5 productos)
python -m scripts.seed_dev

# 4. Arrancar la API
uvicorn app.main:app --reload
# Swagger:  http://127.0.0.1:8000/docs
# Health:   http://127.0.0.1:8000/health
```

**Usuarios sembrados:**

- `admin@pos.com` / `admin123` (rol admin)
- `cajero@pos.com` / `cajero123` (rol cashier)

> Nota: usamos dominios `.com` y no `.local` porque Pydantic `EmailStr` rechaza dominios reservados (RFC 6762). Ver `DT-13`.

## Frontend (Vite + JS vanilla)

```powershell
cd frontend
npm install
npm run dev
# SPA en http://localhost:5173
```

El frontend espera la API en `VITE_API_URL` (default `http://localhost:8000`). CORS habilitado en backend para `localhost:5173`.

**Tests:**

```powershell
pytest -v
```

Usa SQLite in-memory con `StaticPool`; no toca `pos_local.db`.

**Switch a Postgres:** define `DATABASE_URL=postgresql+psycopg://user:pass@host:5432/db` en `.env`. Ver `docs/sdd/design.md §8` y la deuda `DT-11`.

## Versionado

Este proyecto sigue [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` nueva funcionalidad
- `fix:` corrección de bug
- `docs:` cambios en documentación
- `chore:` tareas de mantenimiento
