from uuid import UUID

from pydantic import BaseModel, ConfigDict


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    clerk_user_id: str
    first_name: str | None
    last_name: str | None
    display_name: str
    bio: str | None
    # Typed as plain str, not Role, on purpose: a response schema must never be
    # able to fail on data we already stored. Serving is the wrong moment to
    # discover a value we no longer recognise. The typed vocabulary lives in
    # app/auth/permissions.py, where decisions are actually made.
    role: str
    permissions: list[str]
    team_id: UUID | None
