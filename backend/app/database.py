from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import get_settings

settings = get_settings()

engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def run_idempotent_migrations():
    """Apply lightweight SQL migrations for legacy databases."""
    statements = [
        "ALTER TABLE downloads ADD COLUMN IF NOT EXISTS series_id INTEGER",
        "ALTER TABLE downloads ADD COLUMN IF NOT EXISTS category_id VARCHAR",
        "ALTER TABLE downloads ADD COLUMN IF NOT EXISTS category_name VARCHAR",
        "ALTER TABLE downloads ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0",
        "ALTER TABLE downloads ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ",
        "ALTER TABLE downloads ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ",
        "ALTER TABLE downloads ADD COLUMN IF NOT EXISTS last_progress_at TIMESTAMPTZ",
        "ALTER TABLE downloads ADD COLUMN IF NOT EXISTS last_error_at TIMESTAMPTZ",
        "CREATE INDEX IF NOT EXISTS ix_downloads_status ON downloads (status)",
        "CREATE INDEX IF NOT EXISTS ix_downloads_content_type ON downloads (content_type)",
        "CREATE INDEX IF NOT EXISTS ix_downloads_category_id ON downloads (category_id)",
        "CREATE INDEX IF NOT EXISTS ix_downloads_series_id ON downloads (series_id)",
        "CREATE INDEX IF NOT EXISTS ix_downloads_next_retry_at ON downloads (next_retry_at)",
    ]
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
