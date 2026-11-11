from collections.abc import AsyncGenerator
from functools import lru_cache

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    create_async_engine,
    async_sessionmaker,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import get_database_url


@lru_cache(maxsize=1)
def get_engine():
    """Create the async engine on first database use, not during app import."""
    return create_async_engine(get_database_url(), echo=False, pool_pre_ping=True)


@lru_cache(maxsize=1)
def _get_session_factory():
    return async_sessionmaker(get_engine(), expire_on_commit=False)


def AsyncSessionLocal(*args, **kwargs) -> AsyncSession:
    """Keep the existing callable API while deferring engine creation."""
    return _get_session_factory()(*args, **kwargs)

class Base(DeclarativeBase):
    pass

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    try:
        session_factory = _get_session_factory()
    except (RuntimeError, ValueError) as exc:
        reason = (
            "database_not_configured"
            if isinstance(exc, RuntimeError)
            else "database_configuration_invalid"
        )
        raise HTTPException(
            status_code=503,
            detail={"reason": reason},
        ) from exc

    async with session_factory() as session:
        yield session
