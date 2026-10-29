"""Rendering smoke, not end-to-end business acceptance; no API mocks."""
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[3]
BASE = os.environ.get("QA_BASE_URL", "http://127.0.0.1:5178").rstrip("/")
if urlparse(BASE).hostname not in {"127.0.0.1", "localhost", "::1"}:
    raise SystemExit("Rendering smoke is restricted to an authorized loopback test server.")
OUT = ROOT / "artifacts/qa/sprint-3" / datetime.now(timezone.utc).strftime("browser-%Y%m%dT%H%M%SZ")
OUT.mkdir(parents=True, exist_ok=True)
results = []
errors = []

with sync_playwright() as playwright:
    launch = {"headless": True}
    if os.environ.get("QA_BROWSER_EXECUTABLE"):
        launch["executable_path"] = os.environ["QA_BROWSER_EXECUTABLE"]
    browser = playwright.chromium.launch(**launch)
    try:
        context_options = {"viewport": {"width": 1440, "height": 900}}
        if os.environ.get("QA_RECORD_VIDEO") == "1":
            context_options["record_video_dir"] = str(OUT / "video")
        context = browser.new_context(**context_options)
        page = context.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)))
        for name, route in [("home", "/"), ("booking", "/booking"), ("search", "/search"), ("staff", "/staff")]:
            response = page.goto(BASE + route, wait_until="networkidle", timeout=30000)
            page.screenshot(path=str(OUT / (name + "-desktop.png")), full_page=True)
            results.append({"name": name, "status": response.status, "finalPath": urlparse(page.url).path,
                            "headings": page.get_by_role("heading").all_text_contents()})
        page.set_viewport_size({"width": 390, "height": 844})
        page.goto(BASE + "/booking", wait_until="networkidle")
        page.screenshot(path=str(OUT / "booking-mobile.png"), full_page=True)
        results.append({"name": "booking-mobile", "viewport": 390,
                        "documentWidth": page.evaluate("document.documentElement.scrollWidth")})
        context.close()
    finally:
        browser.close()

(OUT / "results.json").write_text(json.dumps({"scope": "Rendering only; no API mocks or business acceptance",
                                             "routes": results, "pageErrors": errors}, ensure_ascii=False, indent=2), encoding="utf-8")
print("Evidence:", OUT)
if errors or any(item.get("status", 200) >= 400 for item in results):
    raise SystemExit(1)
