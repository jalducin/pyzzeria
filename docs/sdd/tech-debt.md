# Tech Debt — Sistema POS Tienda Retail

## Metadata
- Versión: 1.0.0
- Fecha de inicio: 2026-05-31
- Metodología: SDD (Spec-Driven Development)

## Regla operativa

Cada vez que se agregue un punto nuevo (FR, NFR, decisión de diseño, tarea, endpoint, modelo) **y quede algo sin cerrar**, se registra una entrada de deuda en este archivo con la siguiente estructura mínima:

```
### DT-XX: <título corto>
- **Categoría:** SCOPE-CUT | ATAJO | GAP-CALIDAD | INCONSISTENCIA-DOCS
- **Origen:** <documento + sección donde se introdujo>
- **Motivo:** <por qué se difiere>
- **Impacto si no se resuelve:** <riesgo concreto>
- **Dueño:** <persona o "sin asignar">
- **Trigger de resolución:** <evento que dispara cerrar la deuda — fecha, métrica, milestone>
- **Estado:** ABIERTO | EN-CURSO | CERRADO
```

## Categorías

| Código | Categoría | Descripción |
|---|---|---|
| SCOPE-CUT | Decisión diferida | Funcionalidad recortada conscientemente del alcance actual (ej. modo offline, CFDI) |
| ATAJO | Atajo técnico | Implementación simplificada que sabemos hay que mejorar (mock de terminal, sin refresh-token) |
| GAP-CALIDAD | Gap de calidad | Tests faltantes, observabilidad incompleta, cobertura insuficiente, sin circuit breakers |
| INCONSISTENCIA-DOCS | Inconsistencia entre documentos SDD | Cuando un cambio en un .md no se propaga a los otros dos dentro del mismo PR |

## Registro

### DT-01: Modo offline real diferido
- **Categoría:** SCOPE-CUT
- **Origen:** requirements.md §6 (Out of Scope), introducido en v1.1.0
- **Motivo:** v1.0 asume red estable en horario operativo. Implementar cola offline + reconciliación supera el alcance de 4 sprints.
- **Impacto si no se resuelve:** Si una sucursal pierde conectividad, el POS deja de procesar ventas hasta que la red regrese.
- **Dueño:** sin asignar
- **Trigger de resolución:** v2.0 o incidente real de pérdida de ventas por caída de red.
- **Estado:** ABIERTO

### DT-02: Terminal bancaria mock
- **Categoría:** ATAJO
- **Origen:** requirements.md §6 + design.md (planeado v1.1.0)
- **Motivo:** Integración real con adquirente (e.g. Banorte/Prosa) requiere certificación PCI fuera del alcance del piloto.
- **Impacto si no se resuelve:** No se pueden procesar pagos con tarjeta reales en producción.
- **Dueño:** sin asignar
- **Trigger de resolución:** decisión de pasar a piloto productivo con cobro real.
- **Estado:** ABIERTO

### DT-03: Sin refresh-token en JWT
- **Categoría:** ATAJO
- **Origen:** design.md §5 Seguridad
- **Motivo:** Simplificar v1.0; tokens expiran a 8h y el cajero re-loguea.
- **Impacto si no se resuelve:** UX degradada en turnos > 8h; mayor fricción para cajeros.
- **Dueño:** sin asignar
- **Trigger de resolución:** feedback negativo en piloto o turno > 8h frecuente.
- **Estado:** ABIERTO

### DT-04: Sin emisión CFDI 4.0
- **Categoría:** SCOPE-CUT
- **Origen:** requirements.md §6
- **Motivo:** Integración con PAC y SAT excede el alcance del piloto retail; el ticket simplificado es suficiente para la operación inicial.
- **Impacto si no se resuelve:** El cliente no puede facturar la venta directamente desde el POS.
- **Dueño:** sin asignar
- **Trigger de resolución:** requerimiento fiscal del operador o solicitud de cliente corporativo.
- **Estado:** ABIERTO

## Convención de IDs en docs SDD
| Prefijo | Significado | Documento de origen |
|---|---|---|
| FR-XX | Requerimiento funcional | requirements.md |
| NFR-XX | Requerimiento no funcional | requirements.md |
| UC-XX | Caso de uso | requirements.md |
| CA-XX.Y | Criterio de aceptación | requirements.md |
| DT-XX | Deuda técnica | tech-debt.md |
| T-XX | Tarea de implementación | tasks.md |

## Changelog
| Versión | Fecha | Descripción |
|---|---|---|
| 1.0.0 | 2026-05-31 | Versión inicial con regla operativa, 4 categorías y registros DT-01..DT-04 |
