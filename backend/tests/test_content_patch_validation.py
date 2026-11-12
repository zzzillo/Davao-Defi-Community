import unittest

from pydantic import ValidationError

from app.schemas.blog import BlogUpdate
from app.schemas.event import EventUpdate
from app.schemas.partner import PartnerUpdate
from app.schemas.post import PostUpdate


class ContentPatchValidationTests(unittest.TestCase):
    def test_non_nullable_fields_reject_explicit_null(self) -> None:
        for schema, fields in (
            (BlogUpdate, ("title", "slug", "published")),
            (EventUpdate, ("title", "start_datetime", "published")),
            (PartnerUpdate, ("name",)),
            (PostUpdate, ("post_date", "published")),
        ):
            for field in fields:
                with self.subTest(schema=schema.__name__, field=field):
                    with self.assertRaises(ValidationError) as raised:
                        schema.model_validate({field: None})
                    self.assertEqual(raised.exception.errors()[0]["loc"], (field,))

    def test_omitted_fields_stay_omitted_and_nullable_fields_can_be_cleared(self) -> None:
        for schema, field in (
            (BlogUpdate, "excerpt"),
            (EventUpdate, "end_datetime"),
            (PartnerUpdate, "logo_key"),
            (PostUpdate, "event_id"),
        ):
            with self.subTest(schema=schema.__name__):
                self.assertEqual(schema().model_dump(exclude_unset=True), {})
                self.assertEqual(
                    schema.model_validate({field: None}).model_dump(exclude_unset=True),
                    {field: None},
                )
