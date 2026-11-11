"""Offline Stage 2 authorization and contract tests."""

from __future__ import annotations

import unittest

from app.auth.permissions import Permission, Role, has_permission, role_at_least


class FixedRoleAuthorizationTests(unittest.TestCase):
    def test_roles_grant_the_cumulative_module_matrix_without_permission_lists(self) -> None:
        expected = {
            Role.MEMBER: {
                Permission.BLOGS_READ,
                Permission.BLOGS_CREATE,
                Permission.BLOGS_UPDATE,
                Permission.BLOGS_DELETE,
            },
            Role.OFFICIAL: {
                Permission.BLOGS_READ,
                Permission.BLOGS_CREATE,
                Permission.BLOGS_UPDATE,
                Permission.BLOGS_DELETE,
                Permission.EVENTS_READ,
                Permission.EVENTS_CREATE,
                Permission.EVENTS_UPDATE,
                Permission.EVENTS_DELETE,
                Permission.POSTS_READ,
                Permission.POSTS_CREATE,
                Permission.POSTS_UPDATE,
                Permission.POSTS_DELETE,
                Permission.PARTNERS_READ,
                Permission.PARTNERS_CREATE,
                Permission.PARTNERS_UPDATE,
                Permission.PARTNERS_DELETE,
            },
            Role.ADMIN: set(Permission),
            Role.SUPERADMIN: set(Permission),
        }

        for role, allowed in expected.items():
            for permission in Permission:
                with self.subTest(role=role, permission=permission):
                    self.assertEqual(has_permission(role, permission), permission in allowed)

    def test_role_hierarchy_includes_superadmin_above_admin(self) -> None:
        self.assertTrue(role_at_least(Role.SUPERADMIN, Role.ADMIN))
        self.assertTrue(role_at_least(Role.SUPERADMIN, Role.SUPERADMIN))
        self.assertFalse(role_at_least(Role.ADMIN, Role.SUPERADMIN))


class Stage2ContractTests(unittest.TestCase):
    def test_role_update_contract_does_not_accept_arbitrary_permissions(self) -> None:
        from app.schemas.user import UserRoleUpdate

        self.assertEqual(set(UserRoleUpdate.model_fields), {"role"})

    def test_public_contributor_identity_has_a_distinct_slug_field(self) -> None:
        from app.models.user import User

        self.assertIn("public_slug", User.__table__.c)
        self.assertIn("alias", User.__table__.c)

    def test_public_contributor_response_omits_private_and_internal_fields(self) -> None:
        from app.schemas.user import ContributorResponse

        fields = set(ContributorResponse.model_fields)
        self.assertTrue(
            {"email", "role", "status", "clerk_user_id", "id"}.isdisjoint(fields)
        )

    def test_profile_update_rejects_null_for_non_nullable_json_values(self) -> None:
        from pydantic import ValidationError

        from app.schemas.user import UserProfileUpdate

        for payload in ({"contributions": None}, {"social_links": None}):
            with self.subTest(payload=payload), self.assertRaises(ValidationError):
                UserProfileUpdate.model_validate(payload)

    def test_delayed_clerk_update_preserves_app_profile_and_authorization(self) -> None:
        from app.models.user import User
        from app.services.user_service import _apply_clerk_identity

        user = User(
            clerk_user_id="user_stage2",
            display_name="App Edited Name",
            role=Role.ADMIN.value,
            status="suspended",
            bio="Profile written in the app",
            alias="app.alias",
        )
        _apply_clerk_identity(
            user,
            {
                "id": "user_stage2",
                "primary_email_address_id": "email_stage2",
                "first_name": "Old",
                "last_name": "Clerk Name",
                "email_addresses": [
                    {
                        "id": "email_stage2",
                        "email_address": "new@example.test",
                        "verification": {"status": "verified"},
                    }
                ],
                "public_metadata": {"role": "superadmin", "permissions": ["*" ]},
            },
            is_new=False,
        )

        self.assertEqual(user.display_name, "App Edited Name")
        self.assertEqual(user.role, Role.ADMIN.value)
        self.assertEqual(user.status, "suspended")
        self.assertEqual(user.bio, "Profile written in the app")
        self.assertEqual(user.alias, "app.alias")
        self.assertEqual(user.email, "new@example.test")

    def test_activity_audience_and_owner_are_part_of_audit_rows(self) -> None:
        from app.models.activity_log import ActivityLog

        self.assertIn("owner_id", ActivityLog.__table__.c)
        self.assertIn("audience", ActivityLog.__table__.c)


if __name__ == "__main__":
    unittest.main()
