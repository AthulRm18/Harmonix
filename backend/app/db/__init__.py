"""Database engine, session, and base model."""

from __future__ import annotations

from pathlib import Path

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings


class Base(DeclarativeBase):
    """SQLAlchemy declarative base for all models."""

    pass


def _build_engine():
    settings = get_settings()
    url = settings.DATABASE_URL
    connect_args = {}
    if url.startswith("sqlite"):
        connect_args = {"check_same_thread": False}
        if ":///" in url:
            db_file = url.split(":///", 1)[1]
            if db_file and db_file != ":memory:":
                Path(db_file).parent.mkdir(parents=True, exist_ok=True)
    return create_async_engine(
        url,
        echo=settings.DATABASE_ECHO,
        connect_args=connect_args,
    )


engine = _build_engine()
async_engine = engine  # alias used by seed script
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
AsyncSessionLocal = async_session  # alias used by seed script


async def get_db() -> AsyncSession:  # type: ignore[misc]
    """FastAPI dependency that yields a DB session."""
    async with async_session() as session:
        yield session
