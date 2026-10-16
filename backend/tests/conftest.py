"""Pytest test configuration and fixtures."""

from __future__ import annotations

import asyncio
from collections.abc import Generator

import pytest

from app.db import Base, engine


@pytest.fixture(scope="session", autouse=True)
def setup_test_db() -> Generator[None, None, None]:
    """Ensure database tables are initialized before running test suite."""

    async def _init_db() -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    asyncio.run(_init_db())
    yield
