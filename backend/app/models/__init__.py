# Relationships reference each other by class name ("Team", "User", "Event"),
# which SQLAlchemy resolves from its registry at mapper configuration time.
# Importing every model here guarantees they are all registered as soon as any
# one of them is, since importing a submodule runs this file first.
from app.models.activity_log import ActivityLog
from app.models.blog import Blog
from app.models.clerk_webhook_event import ClerkWebhookEvent
from app.models.event import Event
from app.models.media_asset import MediaAsset
from app.models.partner import Partner
from app.models.post import Post
from app.models.post_image import PostImage
from app.models.team import Team
from app.models.user import User
from app.models.user_invitation import UserInvitation

__all__ = [
    "ActivityLog", "Blog", "Event", "MediaAsset", "Partner", "Post", "PostImage",
    "Team", "User", "UserInvitation", "ClerkWebhookEvent",
]
