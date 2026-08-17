# Relationships reference each other by class name ("Team", "User"), which
# SQLAlchemy resolves from its registry at mapper configuration time. Importing
# both models here guarantees they are registered as soon as any one of them is,
# since importing a submodule runs this file first.
from app.models.team import Team
from app.models.user import User

__all__ = ["Team", "User"]
