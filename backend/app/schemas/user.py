from uuid import UUID

from pydantic import BaseModel, ConfigDict


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    clerk_user_id: str
    first_name: str
    last_name: str
    display_name: str
    bio: str | None
    team_id: UUID | None