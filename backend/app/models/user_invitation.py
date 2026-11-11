from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.auth.permissions import Role
from app.database import Base


class InvitationStatus(StrEnum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REVOKED = "revoked"
    EXPIRED = "expired"
    FAILED = "failed"


class UserInvitation(Base):
    """Local record of an invitation, including its provider lifecycle id."""

    __tablename__ = "user_invitations"
    __table_args__ = (
        CheckConstraint(
            "assigned_role IN ('member', 'official', 'admin', 'superadmin')",
            name="ck_user_invitations_assigned_role",
        ),
        CheckConstraint(
            "status IN ('pending', 'accepted', 'revoked', 'expired', 'failed')",
            name="ck_user_invitations_status",
        ),
        UniqueConstraint("clerk_invitation_id", name="uq_user_invitations_clerk_invitation_id"),
        UniqueConstraint("invited_by_user_id", "idempotency_key", name="uq_user_invitations_inviter_idempotency"),
        Index("ix_user_invitations_email_status", "email", "status"),
        Index("ix_user_invitations_email_created", "email", "created_at"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    assigned_role: Mapped[str] = mapped_column(
        String(20), nullable=False, default=Role.MEMBER.value, server_default=Role.MEMBER.value
    )
    profile_details: Mapped[dict | None] = mapped_column(JSONB)
    invited_by_user_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    clerk_invitation_id: Mapped[str | None] = mapped_column(String(255))
    accepted_clerk_user_id: Mapped[str | None] = mapped_column(String(255))
    idempotency_key: Mapped[str | None] = mapped_column(String(128))
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=InvitationStatus.PENDING.value,
        server_default=InvitationStatus.PENDING.value,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    failed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    failure_reason: Mapped[str | None] = mapped_column(String(100))
    delivery_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    delivery_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    clerk_event_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
