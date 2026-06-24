# Spec — order-tracker

## User Story

Como visitante del portafolio,
quiero ver en tiempo real cómo avanza mi pedido de pizza por los 5 estados del proceso,
para experimentar una demo interactiva que muestre WebSockets y Step Functions en acción.

## Requirements

### REQ-01 — Estados del pedido

El pedido pasa por exactamente 5 estados en orden secuencial:

```
recibido → preparando → horno → listo → entregado
```

No hay estados intermedios ni saltos. El estado solo avanza, nunca retrocede.

### REQ-02 — Tiempos de transición simulados (Step Functions)

| Transición | Delay |
|-----------|-------|
| recibido → preparando | 8 segundos |
| preparando → horno | 12 segundos |
| horno → listo | 20 segundos |
| listo → entregado | 30 segundos |

Las transiciones son automáticas — el visitante no hace ninguna acción.
Tiempo total del ciclo demo: ~70 segundos.

### REQ-03 — Push en tiempo real vía WebSocket

El backend DEBE notificar al cliente via WebSocket en cada transición de estado.
El cliente NO hace polling — espera mensajes push.

Protocolo de conexión:
```
wss://{api-gw-domain}/ws?orderId={uuid}
```

Mensaje push (servidor → cliente):
```json
{
  "type": "status_update",
  "orderId": "550e8400-...",
  "status": "horno",
  "updatedAt": "2026-06-20T14:30:00Z",
  "estimatedSeconds": 20
}
```

`estimatedSeconds` indica el tiempo al siguiente estado (null cuando status = "entregado").

### REQ-04 — Stepper visual en frontend

El frontend DEBE mostrar un stepper de 5 pasos con:
- Ícono representativo por estado (🍕 recibido / 👨‍🍳 preparando / 🔥 horno / ✅ listo / 🎉 entregado)
- Estado activo destacado visualmente
- Estados completados marcados
- Nombre del cliente y resumen del pedido visible durante el tracking

### REQ-05 — Reconexión automática

Si la conexión WebSocket se pierde, el frontend DEBE intentar reconectar hasta 3 veces
con backoff exponencial (1s, 2s, 4s). Si no reconecta, mostrar botón "Consultar estado"
que hace `GET /api/orders/{id}`.

### REQ-06 — Limpieza de conexiones

Las entradas de `ws_connections` en DynamoDB tienen TTL de 2 horas.
Si el backend intenta push a una conexión muerta (respuesta 410), la elimina de DynamoDB.

### REQ-07 — Seed data demo (pedidos congelados)

3 pedidos pre-cargados visibles en el frontend como "pedidos en curso":
- No avanzan automáticamente (Step Functions no se inicia para seed data)
- Sirven para que el panel no esté vacío en la primera visita
- Se distinguen visualmente con etiqueta "demo" si aplica

## Scenarios

### Scenario: Conexión WebSocket exitosa
WHEN el cliente conecta a `wss://.../ws?orderId={uuid}` con un UUID de pedido válido
THEN el servidor almacena `connectionId` + `orderId` en `ws_connections`
     y la conexión queda abierta esperando mensajes

### Scenario: Push de transición de estado
WHEN Step Functions ejecuta la tarea `UpdateStatus(preparando)`
THEN el Lambda actualiza `orders.status = "preparando"` en DynamoDB
     Y envía mensaje push a todos los `connectionId` asociados a ese `orderId`
     Y el stepper del cliente avanza al paso 2

### Scenario: Ciclo completo
WHEN se crea un pedido nuevo
THEN en ~70 segundos el visitante ve el stepper pasar por los 5 estados automáticamente

### Scenario: Conexión perdida y reconexión
WHEN el WebSocket se desconecta inesperadamente durante el tracking
THEN el frontend intenta reconectar (máx 3 intentos, backoff 1s/2s/4s)
     Y si reconecta, el estado actual se muestra correctamente (lee desde DynamoDB via GET)

### Scenario: Conexión muerta detectada en push
WHEN el Lambda intenta enviar push y recibe HTTP 410 de API Gateway Management API
THEN elimina esa entrada de `ws_connections` en DynamoDB

### Scenario: Desconexión limpia
WHEN el cliente cierra la pestaña o navega fuera
THEN el Lambda `@disconnect` elimina la entrada de `ws_connections`

### Scenario: Consulta de estado sin WebSocket
WHEN `GET /api/orders/{id}` es llamado en cualquier momento
THEN responde el estado actual del pedido (funciona como fallback al WS)
