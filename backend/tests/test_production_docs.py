from __future__ import annotations

import json
import os
import subprocess
import sys
import unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_DIR = BACKEND_DIR.parent


def request_paths_for_environment(environment: str, *, docs_override: str | None = None) -> dict[str, int]:
    code = """
import json
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
paths = ('/docs', '/redoc', '/openapi.json', '/auth_test')
print(json.dumps({path: client.get(path).status_code for path in paths}))
"""
    env = os.environ.copy()
    env.update({"APP_ENV": environment, "RENDER": "false"})
    env.pop("API_DOCS_ENABLED", None)
    if docs_override is not None:
        env["API_DOCS_ENABLED"] = docs_override
    result = subprocess.run(
        [sys.executable, "-c", code],
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise AssertionError(result.stderr)
    return json.loads(result.stdout)


class ProductionDocsTests(unittest.TestCase):
    def test_docs_are_hidden_in_production_but_auth_route_stays_protected(self) -> None:
        statuses = request_paths_for_environment("production")
        self.assertEqual(statuses["/docs"], 404)
        self.assertEqual(statuses["/redoc"], 404)
        self.assertEqual(statuses["/openapi.json"], 404)
        self.assertEqual(statuses["/auth_test"], 401)

    def test_docs_are_available_in_development_by_default(self) -> None:
        statuses = request_paths_for_environment("development")
        self.assertEqual(statuses["/docs"], 200)
        self.assertEqual(statuses["/redoc"], 200)
        self.assertEqual(statuses["/openapi.json"], 200)

    def test_production_docs_can_be_explicitly_reenabled(self) -> None:
        statuses = request_paths_for_environment("production", docs_override="true")
        self.assertEqual(statuses["/docs"], 200)
        self.assertEqual(statuses["/openapi.json"], 200)

    def test_cors_preflight_still_allows_production_origin_only(self) -> None:
        code = """
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
allowed = client.options('/auth_test', headers={
    'Origin': 'https://davao-defi-community.vercel.app',
    'Access-Control-Request-Method': 'GET',
    'Access-Control-Request-Headers': 'authorization',
})
blocked = client.options('/auth_test', headers={
    'Origin': 'https://unrelated.example',
    'Access-Control-Request-Method': 'GET',
    'Access-Control-Request-Headers': 'authorization',
})
assert allowed.headers.get('access-control-allow-origin') == 'https://davao-defi-community.vercel.app'
assert 'access-control-allow-origin' not in blocked.headers
"""
        env = os.environ.copy()
        env.update({
            "APP_ENV": "development",
            "RENDER": "false",
            "ALLOWED_ORIGINS": "https://davao-defi-community.vercel.app",
        })
        result = subprocess.run(
            [sys.executable, "-c", code],
            cwd=BACKEND_DIR,
            env=env,
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_public_snapshot_and_image_proxy_rules_remain_public_and_cacheable(self) -> None:
        config = json.loads((REPO_DIR / "frontend" / "vercel.json").read_text())
        rewrites = {rule["source"]: rule["destination"] for rule in config["rewrites"]}
        self.assertEqual(
            rewrites["/landing/v1/snapshot.json"],
            "https://pub-faa5f7e843ea40be96bbaa950ecc40d1.r2.dev/landing/v1/snapshot.json",
        )
        self.assertEqual(
            rewrites["/r2/:path*"],
            "https://pub-faa5f7e843ea40be96bbaa950ecc40d1.r2.dev/:path*",
        )
        snapshot_headers = next(
            rule["headers"] for rule in config["headers"]
            if rule["source"] == "/landing/v1/snapshot.json"
        )
        snapshot_header_values = {item["key"].lower(): item["value"] for item in snapshot_headers}
        self.assertEqual(snapshot_header_values["cdn-cache-control"], "max-age=45")
        self.assertEqual(
            snapshot_header_values["cache-control"],
            "public, max-age=0, must-revalidate",
        )
        image_headers = next(
            rule["headers"] for rule in config["headers"]
            if rule["source"] == "/r2/:path*"
        )
        self.assertIn(
            {"key": "x-vercel-enable-rewrite-caching", "value": "1"},
            image_headers,
        )
        all_header_keys = {
            header["key"].lower()
            for rule in config["headers"]
            for header in rule["headers"]
        }
        self.assertNotIn("strict-transport-security", all_header_keys)
        self.assertNotIn("x-xss-protection", all_header_keys)

    def test_general_response_rule_has_browser_security_headers(self) -> None:
        config = json.loads((REPO_DIR / "frontend" / "vercel.json").read_text())
        general = next(rule for rule in config["headers"] if rule["source"] == "/(.*)")
        headers = {item["key"].lower(): item["value"] for item in general["headers"]}
        self.assertEqual(headers["x-content-type-options"], "nosniff")
        self.assertEqual(headers["referrer-policy"], "strict-origin-when-cross-origin")
        self.assertEqual(headers["content-security-policy"], "frame-ancestors 'none'")
        self.assertEqual(headers["x-frame-options"], "DENY")

        report_only = headers["content-security-policy-report-only"]
        self.assertIn("sha256-uj7eRx3FSszixAFnII+JEH8pGHQDBfhYg1aHsyueECw=", report_only)
        self.assertIn("https://ddc-api-yo88.onrender.com", report_only)
        self.assertIn("https://generous-egret-3876.clerk.accounts.dev", report_only)
        self.assertIn("https://fonts.googleapis.com", report_only)
        self.assertIn("https://photon.komoot.io", report_only)
        self.assertNotIn("'unsafe-inline'", report_only.split("script-src ", 1)[1].split(";", 1)[0])


if __name__ == "__main__":
    unittest.main()
