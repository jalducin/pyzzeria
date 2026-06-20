---
description: Estrategia de ramas, flujo de sprint y reglas de merge. Aplica a todos los cambios del proyecto.
alwaysApply: true
---

# Estándares de Git y flujo de trabajo por sprint

## 1. Modelo de ramas

```
main              ← producción (PROTEGIDA — solo merge via PR con CI verde)
└── sprint/YYYY-NN   ← rama de sprint (ej. sprint/2026-01)
    └── feature/[spec-name]  ← rama por spec/cambio (ej. feature/pos-venta)
```

### Reglas inamovibles

- **Nunca hacer push directo a `main`**. Todo cambio llega vía PR desde `sprint/*`.
- **Nunca hacer push directo a `sprint/*`**. Todo cambio llega vía PR desde `feature/*`.
- Un PR solo puede mergearse si el CI está en verde (ver `golden-rules.md`).

## 2. Ciclo de vida de un sprint

### Inicio de sprint
```bash
# Crear rama de sprint desde main actualizado
git checkout main && git pull origin main
git checkout -b sprint/YYYY-NN
git push -u origin sprint/YYYY-NN
```

### Por cada spec del sprint
```bash
# Crear feature branch desde la rama de sprint
git checkout sprint/YYYY-NN
git checkout -b feature/[spec-name]
# ... implementación ...
# PR: feature/[spec-name] → sprint/YYYY-NN
```

### Cierre de sprint (merge a prod)
```bash
# PR: sprint/YYYY-NN → main
# Requiere: CI verde + revisión + todos los specs archivados en OpenSpec
```

## 3. Convenciones de nombre

| Tipo | Patrón | Ejemplo |
|------|--------|---------|
| Sprint | `sprint/YYYY-NN` | `sprint/2026-01` |
| Feature/spec | `feature/[spec-name]` | `feature/pos-venta` |
| Bugfix | `fix/[descripcion]` | `fix/stock-race-condition` |
| Hotfix prod | `hotfix/[descripcion]` | `hotfix/401-en-sales` |

## 4. Commits

Seguir [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(pos-venta): implementar POST /api/sales con validación de stock
fix(auth): corregir 401 cuando token expira en medio de venta
test(pos-venta): agregar caso de concurrencia en test_sales.py
docs(git): actualizar estándares de ramas
chore(ci): agregar check de swagger en CI
```

## 5. Protección de `main` (configurar en GitHub)

Activar en Settings → Branches → Branch protection rules para `main`:
- [x] Require a pull request before merging
- [x] Require status checks to pass (CI: `Tests + Swagger check`)
- [x] Require branches to be up to date before merging
- [x] Do not allow bypassing the above settings

## 6. Integración con OpenSpec

- Cada spec completada se archiva (`opsx:archive`) antes de mergear su feature branch.
- El PR de sprint a main va acompañado del commit de cierre del sprint en OpenSpec.
- **Nunca mergear a sprint sin que el spec esté en `openspec/changes/archive/`.**
