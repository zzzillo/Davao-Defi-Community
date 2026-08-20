from uuid import UUID

from pydantic import BaseModel, ConfigDict, model_validator

from app.auth.permissions import Permission, Role


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

class UserListResponse(BaseModel):
    """A page of users plus the unfiltered-by-page total.

    total is what the admin table needs to render "showing 1-50 of 214" and to
    know whether a next page exists. Returning a bare list would leave the UI
    guessing.
    """

    items: list[UserResponse]
    total: int


class UserRoleUpdate(BaseModel):
    """Request body for PATCH /admin/users/{id}/role.

    role and permissions are typed as enums, not strings. FastAPI therefore
    rejects an unknown value with a 422 before a single line of handler code
    runs - "superadmin" cannot reach the service layer at all. That is input
    validation doing security work, not just documentation.
    """

    role: Role
    permissions: list[Permission] = []

    @model_validator(mode="after")
    def only_officials_carry_permissions(self):
        """Refuse input the system would have to silently discard.

        Admin implies everything and member is allowed nothing, so a permission
        list on either is meaningless. Accepting and dropping it would tell the
        caller their request was honoured when half of it was not.
        """
        if self.permissions and self.role is not Role.OFFICIAL:
            raise ValueError("Only officials carry permissions")

        return self
