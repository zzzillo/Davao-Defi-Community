import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch
from xml.etree import ElementTree

from fastapi import HTTPException
from sqlalchemy.dialects import postgresql

from app.services import sitemap_service
from app.services.sitemap_service import SitemapEntry, render_sitemap

NS = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}


def compiled(query) -> str:
    return str(query.compile(dialect=postgresql.dialect()))


class SitemapRenderTests(unittest.TestCase):
    def test_renders_valid_xml_with_absolute_urls_and_utc_dates(self) -> None:
        manila = timezone(timedelta(hours=8))
        xml = render_sitemap([
            SitemapEntry("/"),
            SitemapEntry("/blog/a%26b", datetime(2026, 11, 22, 3, 0, tzinfo=manila)),
        ])

        root = ElementTree.fromstring(xml)
        urls = root.findall("sm:url", NS)
        self.assertEqual(urls[0].find("sm:loc", NS).text, "https://davaodeficommunity.com/")
        self.assertIsNone(urls[0].find("sm:lastmod", NS))
        self.assertEqual(urls[1].find("sm:loc", NS).text, "https://davaodeficommunity.com/blog/a%26b")
        # 03:00 in Manila is the previous day in UTC.
        self.assertEqual(urls[1].find("sm:lastmod", NS).text, "2026-11-21")

    def test_escapes_xml_special_characters(self) -> None:
        xml = render_sitemap([SitemapEntry("/blog/a&b")])
        self.assertIn("<loc>https://davaodeficommunity.com/blog/a&amp;b</loc>", xml)
        ElementTree.fromstring(xml)


class SitemapPathTests(unittest.TestCase):
    def test_event_paths_carry_the_title_slug_like_the_frontend(self) -> None:
        # Same inputs and outputs as frontend/src/utils/publicPaths.test.ts.
        self.assertEqual(
            sitemap_service.titled_path("/events", "p1", "Sundown Avalanche — Night 2!"),
            "/events/p1/sundown-avalanche-night-2",
        )
        self.assertEqual(sitemap_service.titled_path("/rsvp", "e1", "DeFi Meetup @ Ateneo"), "/rsvp/e1/defi-meetup-ateneo")

    def test_titles_without_a_slug_fall_back_to_the_bare_id(self) -> None:
        self.assertEqual(sitemap_service.titled_path("/events", "p1", None), "/events/p1")
        self.assertEqual(sitemap_service.titled_path("/rsvp", "e1", "活动"), "/rsvp/e1")


class SitemapQueryTests(unittest.TestCase):
    def test_only_public_content_is_listed(self) -> None:
        self.assertIn("blogs.published IS true", compiled(sitemap_service.published_blogs_query()))
        self.assertIn("posts.published IS true", compiled(sitemap_service.published_posts_query()))
        self.assertIn("events.published IS true", compiled(sitemap_service.published_events_query()))
        contributors = compiled(sitemap_service.public_contributors_query())
        self.assertIn("users.show_in_contributor_directory IS true", contributors)
        self.assertIn("users.status =", contributors)
        self.assertIn("users.public_slug IS NOT NULL", contributors)

    def test_every_query_is_bounded(self) -> None:
        for query in (
            sitemap_service.published_blogs_query(),
            sitemap_service.published_posts_query(),
            sitemap_service.published_events_query(),
            sitemap_service.public_contributors_query(),
        ):
            self.assertIn("LIMIT", compiled(query))


class SitemapRouteTests(unittest.IsolatedAsyncioTestCase):
    async def test_success_is_xml_and_cacheable(self) -> None:
        from app.routers.sitemap import get_sitemap

        entries = [SitemapEntry("/"), SitemapEntry("/blog/hello")]
        with patch("app.routers.sitemap.collect_entries", new=AsyncMock(return_value=entries)):
            response = await get_sitemap()

        self.assertEqual(response.media_type, "application/xml")
        self.assertEqual(response.headers["cache-control"], sitemap_service.SITEMAP_CACHE_CONTROL)
        self.assertIn(b"https://davaodeficommunity.com/blog/hello", response.body)

    async def test_database_failure_is_never_cached(self) -> None:
        from app.routers.sitemap import get_sitemap

        with patch("app.routers.sitemap.collect_entries", new=AsyncMock(side_effect=RuntimeError("down"))):
            with self.assertRaises(HTTPException) as raised:
                await get_sitemap()

        self.assertEqual(raised.exception.status_code, 503)
        self.assertEqual(raised.exception.headers["Cache-Control"], "no-store")


if __name__ == "__main__":
    unittest.main()
