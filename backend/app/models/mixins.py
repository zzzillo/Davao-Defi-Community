"""Column groups shared by more than one table.

A mixin is a plain class, not a model: no __tablename__, no table of its own.
SQLAlchemy copies its columns into every model that inherits it, which is how
Events - and later Blogs and Partners - get identical timestamps without three
copies of the same two lines drifting apart.
"""

from datetime import datetime

from sqlalchemy import DateTime, func
from sqlalchemy.orm import Mapped, mapped_column


class TimestampMixin:
    """created_at and updated_at, stamped by Postgres rather than by Python.

    server_default and onupdate both render NOW() into the SQL, so the values
    come from the database's clock. One clock means no drift between app
    instances and no dependence on the timezone a server happens to run in.
    """

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    # onupdate fires on ORM updates. A hand-written UPDATE in psql will not
    # touch it - that would need a database trigger, which is not worth it yet.
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
