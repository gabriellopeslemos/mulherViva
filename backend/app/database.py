from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import get_settings

settings = get_settings()

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False}
    if settings.database_url.startswith("sqlite")
    else {},
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def run_migrations() -> None:
    """Lightweight, idempotent column additions for existing databases.

    `Base.metadata.create_all` creates missing tables but never alters
    existing ones, so new columns on already-created tables are added here.
    """
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())

    with engine.begin() as conn:
        if "availability_rules" in tables:
            cols = {c["name"] for c in inspector.get_columns("availability_rules")}
            if "type" not in cols:
                conn.execute(
                    text(
                        "ALTER TABLE availability_rules "
                        "ADD COLUMN type VARCHAR(15) NOT NULL DEFAULT 'presencial'"
                    )
                )
        if "availability_overrides" in tables:
            cols = {c["name"] for c in inspector.get_columns("availability_overrides")}
            if "type" not in cols:
                conn.execute(
                    text("ALTER TABLE availability_overrides ADD COLUMN type VARCHAR(15)")
                )
                conn.execute(
                    text(
                        "UPDATE availability_overrides SET type = 'presencial' "
                        "WHERE kind = 'open' AND type IS NULL"
                    )
                )
        if "appointments" in tables:
            cols = {c["name"] for c in inspector.get_columns("appointments")}
            if "client_email" not in cols:
                conn.execute(
                    text("ALTER TABLE appointments ADD COLUMN client_email VARCHAR(150)")
                )
        if "blog_posts" in tables:
            cols = {c["name"] for c in inspector.get_columns("blog_posts")}
            if "pinned" not in cols:
                conn.execute(
                    text(
                        "ALTER TABLE blog_posts "
                        "ADD COLUMN pinned BOOLEAN NOT NULL DEFAULT 0"
                    )
                )
