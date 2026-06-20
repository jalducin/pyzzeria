import sqlite3
import os

DB_PATH = os.getenv("DB_PATH", "pos.db")


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    conn = get_connection()
    with conn:
        conn.executescript("""
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

        count = conn.execute("SELECT COUNT(*) FROM products").fetchone()[0]
        if count == 0:
            conn.executemany(
                "INSERT INTO products (name, price, stock, category) VALUES (?, ?, ?, ?)",
                [
                    ("Café americano", 35.0, 50, "Bebidas"),
                    ("Café con leche", 42.0, 50, "Bebidas"),
                    ("Agua mineral", 25.0, 80, "Bebidas"),
                    ("Torta jamón", 65.0, 30, "Comida"),
                    ("Papas fritas", 22.0, 45, "Snacks"),
                ],
            )
    conn.close()


if __name__ == "__main__":
    init_db()
    print(f"Base de datos inicializada en {DB_PATH}")
