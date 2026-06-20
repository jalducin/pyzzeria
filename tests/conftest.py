import os
import tempfile
import pytest
from fastapi.testclient import TestClient

# Base de datos temporal aislada por sesión de tests
@pytest.fixture(scope="session")
def tmp_db(tmp_path_factory):
    db_file = tmp_path_factory.mktemp("db") / "test_pos.db"
    return str(db_file)


@pytest.fixture(scope="session")
def client(tmp_db):
    os.environ["DB_PATH"] = tmp_db
    # Importar después de setear DB_PATH para que database.py lo tome
    from backend.main import app
    from backend.database import init_db
    init_db()
    with TestClient(app) as c:
        yield c
    if os.path.exists(tmp_db):
        os.remove(tmp_db)
