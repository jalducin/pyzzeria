import hashlib
import os
import sqlite3

DB_PATH = os.getenv("DB_PATH", "pos.db")


def _hash(password: str) -> str:
    """SHA-256 simple para datos demo. En producción usar bcrypt."""
    return hashlib.sha256(password.encode()).hexdigest()


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    conn = get_connection()
    with conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                name       TEXT    NOT NULL,
                email      TEXT    NOT NULL UNIQUE,
                password   TEXT    NOT NULL,
                role       TEXT    NOT NULL DEFAULT 'cajero'
                               CHECK(role IN ('admin', 'cajero')),
                is_active  INTEGER NOT NULL DEFAULT 1
            );

            CREATE TABLE IF NOT EXISTS products (
                id       INTEGER PRIMARY KEY AUTOINCREMENT,
                name     TEXT    NOT NULL,
                price    REAL    NOT NULL CHECK(price >= 0),
                stock    INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0),
                category TEXT    DEFAULT 'General'
            );

            CREATE TABLE IF NOT EXISTS sales (
                id         INTEGER   PRIMARY KEY AUTOINCREMENT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                total      REAL      NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sale_items (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                sale_id    INTEGER NOT NULL REFERENCES sales(id),
                product_id INTEGER NOT NULL REFERENCES products(id),
                name       TEXT    NOT NULL,
                price      REAL    NOT NULL,
                quantity   INTEGER NOT NULL CHECK(quantity > 0),
                subtotal   REAL    NOT NULL
            );
        """)

        # --- Seed usuarios ---
        if conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0:
            conn.executemany(
                "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
                [
                    ("Administrador",  "admin@pos.com",    _hash("admin123"),   "admin"),
                    ("María Cajera",   "cajero1@pos.com",  _hash("cajero123"),  "cajero"),
                    ("Carlos Cajero",  "cajero2@pos.com",  _hash("cajero123"),  "cajero"),
                ],
            )

        # --- Seed productos ---
        if conn.execute("SELECT COUNT(*) FROM products").fetchone()[0] == 0:
            conn.executemany(
                "INSERT INTO products (name, price, stock, category) VALUES (?, ?, ?, ?)",
                [
                    # Bebidas
                    ("Café americano",       35.0,  80, "Bebidas"),
                    ("Café con leche",       42.0,  70, "Bebidas"),
                    ("Café capuchino",       52.0,  60, "Bebidas"),
                    ("Agua mineral 500ml",   20.0, 120, "Bebidas"),
                    ("Agua mineral 1L",      30.0, 100, "Bebidas"),
                    ("Jugo naranja natural", 45.0,  40, "Bebidas"),
                    ("Té verde",             38.0,  50, "Bebidas"),
                    ("Refresco cola 355ml",  28.0,  90, "Bebidas"),
                    # Comida
                    ("Torta jamón",          65.0,  25, "Comida"),
                    ("Torta milanesa",       75.0,  20, "Comida"),
                    ("Torta vegana",         70.0,  15, "Comida"),
                    ("Tacos de canasta x3",  55.0,  30, "Comida"),
                    ("Quesadilla queso",     48.0,  35, "Comida"),
                    ("Ensalada César",       85.0,  18, "Comida"),
                    # Snacks
                    ("Papas fritas chicas",  22.0,  60, "Snacks"),
                    ("Papas fritas grandes", 35.0,  50, "Snacks"),
                    ("Nachos con queso",     42.0,  40, "Snacks"),
                    ("Cacahuates salados",   18.0,  75, "Snacks"),
                    ("Barrita de granola",   28.0,  55, "Snacks"),
                    # Panadería
                    ("Concha",               18.0,  40, "Panadería"),
                    ("Cuernito mantequilla", 22.0,  35, "Panadería"),
                    ("Muffin chocolate",     32.0,  30, "Panadería"),
                    ("Donut glaseado",       28.0,  25, "Panadería"),
                    # Lácteos
                    ("Yogurt natural",       35.0,  45, "Lácteos"),
                    ("Leche 250ml",          22.0,  60, "Lácteos"),
                ],
            )
    conn.close()


if __name__ == "__main__":
    init_db()
    print(f"Base de datos inicializada en {DB_PATH}")
    conn = get_connection()
    users = conn.execute("SELECT name, email, role FROM users").fetchall()
    products = conn.execute("SELECT COUNT(*) FROM products").fetchone()[0]
    print(f"Usuarios: {len(users)}")
    for u in users:
        print(f"  [{u['role']}] {u['name']} — {u['email']}")
    print(f"Productos: {products}")
    conn.close()
