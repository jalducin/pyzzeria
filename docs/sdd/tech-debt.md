# Tech Debt — Sistema POS Tienda Retail

## Metadata

- Versión: 1.2.0
- Fecha de inicio: 2026-05-31
- Metodología: SDD (Spec-Driven Development)

## Regla operativa

Cada vez que se agregue un punto nuevo (FR, NFR, decisión de diseño, tarea, endpoint, modelo) **y quede algo sin cerrar**, se registra una entrada de deuda en este archivo con la siguiente estructura mínima:

```text
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
| --- | --- | --- |
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
- **Origen:** design.md §6 Seguridad
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

### DT-05: Rate limiting naïve (sin sliding window Redis)

- **Categoría:** ATAJO
- **Origen:** design.md §6 Seguridad + §9 D-05; tasks.md T4-09
- **Motivo:** Para el piloto basta con el rate limiting nativo de API Gateway (token bucket por IP). Una implementación sliding-window por usuario en Redis es más justa pero requiere infra adicional y operación.
- **Impacto si no se resuelve:** Posibles falsos positivos (varias cajas tras un mismo NAT pueden compartir IP) y posibles falsos negativos (un actor malicioso con IPs rotatorias evade el límite).
- **Dueño:** sin asignar
- **Trigger de resolución:** primer incidente de 429 reportado en producción por compartir IP, o detección de abuso por IP rotatoria.
- **Estado:** ABIERTO

### DT-06: Compensación manual en falla de UpdateInventory

- **Categoría:** GAP-CALIDAD
- **Origen:** design.md §5 (manejo de errores del flujo Step Functions)
- **Motivo:** Si `UpdateInventory` falla después de `ProcessPayment`, hoy se documenta "compensación manual + alerta CloudWatch" en vez de saga automática.
- **Impacto si no se resuelve:** Posibles cargas cobradas sin descontar inventario; requiere intervención operativa para conciliar.
- **Dueño:** sin asignar
- **Trigger de resolución:** primer incidente real o > 0.1% de ventas requiriendo compensación manual en 30 días.
- **Estado:** ABIERTO

### DT-07: Typo "difierido" en changelog de requirements.md

- **Categoría:** INCONSISTENCIA-DOCS
- **Origen:** requirements.md §Changelog v1.1.0 ("modo offline difierido" en vez de "diferido")
- **Motivo:** Detectado durante v1.1.0 de design/tasks. Se decidió no tocar contenido del changelog histórico en esta iteración para preservar el estado documentado.
- **Impacto si no se resuelve:** Cosmético; afecta legibilidad.
- **Dueño:** sin asignar
- **Trigger de resolución:** próxima edición de contenido del changelog de requirements.
- **Estado:** ABIERTO

### DT-09: process_sale con complejidad cognitiva > 15

- **Categoría:** GAP-CALIDAD
- **Origen:** `app/services/sales_service.py::process_sale` (scaffolding Sprint 1)
- **Motivo:** El servicio actual aglutina todos los pasos del flujo (CheckIdempotency, ValidateCart, CalculateTotals, ProcessPayment, UpdateInventory, PersistSale) en una sola función. El linter reporta complejidad cognitiva 18 > 15.
- **Impacto si no se resuelve:** Mantenibilidad y testabilidad limitadas; cada paso debería poder testearse en aislamiento, especialmente cuando se migre a Step Functions reales.
- **Dueño:** sin asignar
- **Trigger de resolución:** T3-03..T3-11 (descomposición en Steps individuales del Sprint 3).
- **Estado:** ABIERTO

### DT-10: Idempotency-Key sin TTL en Redis

- **Categoría:** ATAJO
- **Origen:** `app/services/sales_service.py` + design §5
- **Motivo:** El scaffolding consulta `Sale.idempotency_key` directamente en PostgreSQL. El design prescribe TTL de 24h en Redis como capa rápida.
- **Impacto si no se resuelve:** Latencia mayor por consulta a DB en cada POST /sales; la deduplicación funciona pero no es óptima.
- **Dueño:** sin asignar
- **Trigger de resolución:** T1-09 (setup Redis) + T3-03 (CheckIdempotency step con Redis).
- **Estado:** ABIERTO

### DT-08: AuditLog sin retención ni archivado definido

- **Categoría:** GAP-CALIDAD
- **Origen:** design.md §3 AuditLog (introducido v1.1.0)
- **Motivo:** Se persiste todo en PostgreSQL sin política de retención ni archivado a S3. La tabla puede crecer indefinidamente.
- **Impacto si no se resuelve:** Crecimiento descontrolado de la DB, costo de storage, degradación de queries sobre AuditLog.
- **Dueño:** sin asignar
- **Trigger de resolución:** AuditLog > 5 GB o > 6 meses en operación, lo que ocurra primero.
- **Estado:** ABIERTO

## Convención de IDs en docs SDD

| Prefijo | Significado | Documento de origen |
| --- | --- | --- |
| FR-XX | Requerimiento funcional | requirements.md |
| NFR-XX | Requerimiento no funcional | requirements.md |
| UC-XX | Caso de uso | requirements.md |
| CA-XX.Y | Criterio de aceptación | requirements.md |
| DT-XX | Deuda técnica | tech-debt.md |
| T{S}-NN | Tarea de implementación (S = número de sprint, NN = correlativo) | tasks.md |
| D-XX | Decisión arquitectónica (ADR ligero) | design.md §9 |

## Changelog

| Versión | Fecha | Descripción |
| --- | --- | --- |
| 1.0.0 | 2026-05-31 | Versión inicial con regla operativa, 4 categorías y registros DT-01..DT-04 |
| 1.1.0 | 2026-05-31 | Agregadas DT-05 (rate limiting naïve), DT-06 (compensación manual inventario), DT-07 (typo changelog), DT-08 (retención AuditLog). Convención de IDs extendida con T{S}-NN y D-XX. Origen de DT-03 actualizado a design §6. |
| 1.2.0 | 2026-05-31 | Agregadas DT-09 (process_sale complejidad cognitiva > 15) y DT-10 (Idempotency-Key sin TTL Redis), derivadas del scaffolding backend. |
