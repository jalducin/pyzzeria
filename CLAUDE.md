# Contexto del proyecto

Lee y aplica los estándares base del proyecto: @docs/base-standards.md

Flujo de trabajo: Spec-Driven Development (OpenSpec). Ver README.md.

## Proyecto

Sistema POS demo — @openspec/project.md

## Modo de operación — Auto-avance

Operar en **modo auto-avance**: ejecutar cada paso del tasks.md sin pedir confirmación al usuario,
salvo que la acción sea destructiva o afecte producción (push a main, drop de base de datos, etc.).

Flujo esperado por tarea:
1. Leer el spec relevante en `openspec/specs/`.
2. Implementar.
3. Ejecutar pruebas y verificación manual el agente mismo.
4. Marcar la tarea como `[x]` solo tras verificar.
5. Avanzar a la siguiente tarea sin pausa.

## Reglas cargadas automáticamente

Al iniciar cualquier tarea, leer y aplicar:
- @docs/golden-rules.md — Swagger + auth + tests (no negociables)
- @docs/git-standards.md — estrategia de ramas por sprint
- @.claude/rules/openspec-tasks-mandatory-steps.md — pasos obligatorios en tasks
