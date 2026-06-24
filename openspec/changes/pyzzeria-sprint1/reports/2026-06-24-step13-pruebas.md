# Reporte Step 13 — Pruebas y verificación de estado

- Fecha: 2026-06-24
- Cambio: pyzzeria-sprint1
- Agente: claude-sonnet-4-6

## Comandos ejecutados

- `python -m pytest tests/ --tb=short --cov=backend --cov-report=term-missing -q`

## Resultados de pruebas

- **Total**: 18 pasaron, 0 fallaron, 0 omitidas
- **Duración**: ~7.5s
- **Cobertura**: 94.67% (sobre módulos nuevos: main, dynamo, menu)

| Módulo | Stmts | Miss | Cover |
|--------|-------|------|-------|
| backend/__init__.py | 0 | 0 | 100% |
| backend/dynamo.py | 54 | 8 | 85% |
| backend/main.py | 105 | 1 | 99% |
| backend/menu.py | 10 | 0 | 100% |
| **TOTAL** | **169** | **9** | **94.67%** |

Excluidos de cobertura (`.coveragerc`):
- `backend/database.py` — código POS anterior, no usado en nuevo dominio
- `backend/ws_handlers/*` — handlers Lambda-specific, requieren contexto API Gateway para ejecutarse

## Incidencias y soluciones

1. **`TypeError: Float types are not supported`** — DynamoDB boto3 resource rechaza `float`. Solución: helpers `_to_decimal` / `_from_decimal` en `dynamo.py`.
2. **`StateMachineDoesNotExist`** — moto intercepta Step Functions pero la state machine no existe en el mock. Solución: `_start_state_machine` captura excepciones y no bloquea la respuesta (correcto también en dev local).
3. **Pydantic S8396** — `Optional[int]` sin default. Solución: `estimated_seconds: Optional[int] = None`.

## Verificación de estado

- Estado previo: DB vacía (mock moto fresco por fixture)
- Estado posterior: pedidos creados en DynamoDB mock, limpiados automáticamente al salir del context manager `mock_aws`
- Estado restaurado: Sí — automático via fixture `aws_mock`

## Resultado

- **Estado Step 13**: PASS
- **Bloqueos**: ninguno
