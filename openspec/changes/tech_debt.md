# Deuda Técnica y Propuestas de Mejora (SDD)

Este documento registra la deuda técnica y propuestas de mejora identificadas tras la revisión del código fuente del proyecto **POS Demo**, alineadas con los principios de *Spec-Driven Development (SDD)* y buenas prácticas de desarrollo.

## 1. Backend (FastAPI & SQLite)

### 1.1 Gestión de Transacciones en SQLite
En el archivo `backend/main.py` (`create_sale`), se maneja la transacción manualmente con `conn.execute("BEGIN")` y un bloque `try/except/finally` con ROLLBACK/COMMIT manuales.
**Deuda/Propuesta:** Utilizar el manejador de contexto nativo de SQLite que gestiona las transacciones (`COMMIT` / `ROLLBACK`) automáticamente cuando ocurre una excepción:
```python
try:
    with conn: # Inicia la transacción y hace auto-commit si no hay excepciones
        cur = conn.execute("INSERT INTO sales...")
        # ... demás operaciones de insert/update
except Exception as e:
    # ... manejo de error, el rollback ya se ejecutó implícitamente
```

### 1.2 Trazabilidad de Specs en el Código (SDD)
**Deuda/Propuesta:** Para fortalecer el enlace entre el código y los requerimientos de SDD definidos en `openspec/specs/pos-venta/spec.md`, faltan anotaciones, docstrings o tags explícitas en los endpoints de FastAPI que hagan referencia al requerimiento exacto. 
Por ejemplo, en `create_sale` documentar: `Cumple con Requirement: Confirmar venta - Scenario: Venta exitosa`.

### 1.3 Paginación Completa en el Historial
El endpoint `/api/sales` usa un parámetro simple `limit: int = 20`.
**Deuda/Propuesta:** Implementar una paginación estándar con `offset` y `limit` (o un sistema basado en cursores) para prevenir problemas de rendimiento conforme crezca el histórico de ventas.

### 1.4 Gestión Robusta de Configuración
En `backend/database.py`, `DB_PATH` se obtiene directamente con `os.getenv`.
**Deuda/Propuesta:** Utilizar `pydantic-settings` u otra herramienta de validación de variables de entorno al iniciar la aplicación (junto con la configuración de CORS en `main.py`). Esto asegura el principio "fail-fast".

## 2. Frontend (Vanilla JS)

### 2.1 Formateo de Divisas Localizado
En `frontend/app.js` se utiliza `.toFixed(2)` junto a interpolación de strings (`$${p.price.toFixed(2)}`) para mostrar precios.
**Deuda/Propuesta:** Usar la API nativa de internacionalización para garantizar que la moneda se formatee de acuerdo con la convención adecuada:
```javascript
const formatCurrency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
```

### 2.2 Centralización de Llamadas a la API
Actualmente, las invocaciones de red con `fetch` están incrustadas dentro de las lógicas de negocio (`cargarCatalogo` y `confirmarCobro`).
**Deuda/Propuesta:** Crear un módulo (ej. `apiClient.js`) que centralice las llamadas HTTP para facilitar el manejo de errores global y simplificar los mocks en futuras pruebas E2E.

### 2.3 Prevención de Condiciones de Carrera (Doble Click)
**Deuda/Propuesta:** El botón "Cobrar" se deshabilita después de empezar a procesar, pero en redes muy lentas puede colarse un doble click. Asegurar con un state flag (`estado.procesando = true`) para prevenir envíos paralelos.

## 3. Pruebas y Coherencia de Spec

### 3.1 Pruebas de Integración End-to-End ausentes
El archivo `project.md` menciona que se usarán pruebas con `pytest` pero su extensión no se explora completamente en los archivos de la estructura.
**Deuda/Propuesta:** Crear un archivo de tests (ej. `tests/test_sales_spec.py`) que implemente pruebas exactas por cada bloque **Scenario** definido en el markdown (E.g. *Scenario: Bloqueo por stock insuficiente*, *Scenario: Concurrencia*), usando el `TestClient` de FastAPI.

### 3.2 Observación de Concurrencia de SQLite
**Deuda/Propuesta:** El Spec plantea un caso de **Concurrencia — dos cajeros, último producto**. Si la app escala, SQLite podría lanzar `database is locked`. Como deuda a mediano plazo, contemplar preparar la abstracción de base de datos para una posible migración a PostgreSQL.

## 4. Autenticación y Seguridad

### 4.1 Pantalla de Login Ausente
Las credenciales de usuarios (`cajero1@pos.com`, `admin@pos.com`) existen pre-cargadas en la base de datos (ver `database.py`), sin embargo, en la versión v1 la autenticación está fuera de alcance y todos los endpoints son públicos. 
**Deuda/Propuesta:** Implementar una pantalla de Login en el frontend y proteger los endpoints del backend usando tokens (ej. JWT) o sesiones. Esto permitirá asociar cada venta directamente al cajero que la realiza en la base de datos, en lugar de manejar el POS de manera anónima.

## 5. Resultados de Pruebas Manuales (Happy Path)

Se ejecutó con éxito una prueba en navegador del "Happy Path" validando el comportamiento E2E:
- Se cargó el catálogo y las categorías correctamente desde `/api/products`.
- Se añadieron productos al carrito interactuando con la interfaz gráfica (ej. `Café americano` y `Torta jamón`).
- Se validó el cálculo del subtotal en el frontend.
- Se completó la venta haciendo clic en "Cobrar".
- **Validación SDD:** La venta se registró de manera atómica (HTTP 201) en `/api/sales`, el inventario visible en la UI decreció en tiempo real, y el ticket conservó el snapshot de los precios, cumpliendo exitosamente el escenario principal (*Venta exitosa*) documentado en los requerimientos.
