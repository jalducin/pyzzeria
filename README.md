# 🛒 POS Retail — Sistema de Punto de Venta

Proyecto de práctica desarrollado con **Spec-Driven Development (SDD)** usando Claude Code.

## Stack
- Python 3.11 + FastAPI
- PostgreSQL + Redis
- AWS Lambda + API Gateway + Step Functions
- JWT Auth + RBAC

## Documentación SDD
| Archivo | Descripción | Estado |
|---|---|---|
| [requirements.md](docs/sdd/requirements.md) | Casos de uso y requerimientos | ✅ v1.0 |
| [design.md](docs/sdd/design.md) | Arquitectura, modelos y endpoints | ✅ v1.0 |
| [tasks.md](docs/sdd/tasks.md) | Sprints y tareas de implementación | ✅ v1.0 |

## Flujo SDD
```
requirements.md → design.md → tasks.md → implementación
```

## Setup (próximamente)
```bash
git clone <repo>
cd pos-retail
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Versionado
Este proyecto sigue [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` nueva funcionalidad
- `fix:` corrección de bug
- `docs:` cambios en documentación
- `chore:` tareas de mantenimiento
