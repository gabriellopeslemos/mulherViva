import os
import sys
from pathlib import Path

# Make `app` importable and force a self-contained, throwaway configuration so
# tests never read a developer's real backend/.env.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

os.environ.update(
    {
        "ENVIRONMENT": "development",
        "SECRET_KEY": "test-secret-key-for-pytest-only-0123456789abcdef",
        "DATABASE_URL": "sqlite://",
        "NOTIFICATIONS_ENABLED": "false",
        "IG_AUTO_SYNC": "false",
        "RATE_LIMIT_ENABLED": "false",
        "GOOGLE_CLIENT_ID": "test-client-id",
        "ALLOWED_ADMIN_EMAILS": "admin@example.com",
        "TIMEZONE": "America/Sao_Paulo",
    }
)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402


@pytest.fixture
def db_session():
    """A fresh in-memory database, shared across connections for one test."""
    from app.database import Base
    from app import models  # noqa: F401  (registers the tables)

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    session = Session()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture
def client(db_session):
    """TestClient wired to the throwaway database."""
    from app.database import get_db
    from app.main import app

    app.dependency_overrides[get_db] = lambda: db_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def admin_headers():
    from app.auth import create_access_token

    return {"Authorization": f"Bearer {create_access_token('admin@example.com')}"}
