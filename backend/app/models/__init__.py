# Relationships reference each other by class name ("Team", "User", "Event"),
# which SQLAlchemy resolves from its registry at mapper configuration time.
# Importing every model here guarantees they are all registered as soon as any
# one of them is, since importing a submodule runs this file first.
from app.models.event import Event
from app.models.post import Post
from app.models.post_image import PostImage
from app.models.team import Team
from app.models.user import User

__all__ = ["Event", "Post", "PostImage", "Team", "User"]
