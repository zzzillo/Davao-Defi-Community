"""Schemas shared by more than one module.

A file that earns its place the moment a second module needs the same shape.
Posts wanted exactly what Events already had for showing an author, and two
copies of that would be two places to get it wrong.
"""

from uuid import UUID

from pydantic import BaseModel, ConfigDict


class PublicUserResponse(BaseModel):
    """The slice of a user that is safe to show to anybody.

    Not UserResponse, and never UserResponse. The endpoints that embed this are
    public: UserResponse carries clerk_user_id, role, and permissions, so
    including it would publish a list of who your officials are and exactly
    what each of them can do, to anyone who loads a page.

    A display name and an id are all a byline needs.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    display_name: str
