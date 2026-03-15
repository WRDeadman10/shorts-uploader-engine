"""Interactive Meta setup link wizard for Instagram/Facebook Reels publishing.

This script shows setup links one by one so you can complete each task
in sequence (app creation, permissions, tokens, IDs, app review, etc).
"""

from __future__ import annotations

import argparse
import json
import webbrowser
from pathlib import Path
from typing import Any, Dict, List

PROGRESS_FILE = ".meta_setup_progress.json"

STEPS: List[Dict[str, str]] = [
    {
        "id": "create_app",
        "title": "Create Meta App",
        "desc": "Create your Meta app (Business type) and open the app dashboard.",
        "url": "https://developers.facebook.com/docs/development/create-an-app/",
    },
    {
        "id": "fb_login_setup",
        "title": "Enable Facebook Login for Business",
        "desc": "Set up Facebook Login flow needed for Page/Instagram permissions.",
        "url": "https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/",
    },
    {
        "id": "ig_content_publish_doc",
        "title": "Instagram Content Publishing Requirements",
        "desc": "Review required permissions, host URLs, and publishing flow.",
        "url": "https://developers.facebook.com/docs/instagram-platform/content-publishing/",
    },
    {
        "id": "fb_reels_doc",
        "title": "Facebook Reels Publishing Requirements",
        "desc": "Review Page Reel API requirements and permissions.",
        "url": "https://developers.facebook.com/docs/video-api/guides/reels-publishing/",
    },
    {
        "id": "permissions_reference",
        "title": "Permissions Reference",
        "desc": "Review/confirm permissions you'll request.",
        "url": "https://developers.facebook.com/docs/permissions",
    },
    {
        "id": "token_docs",
        "title": "Access Token Docs",
        "desc": "Understand user tokens, long-lived tokens, and page tokens.",
        "url": "https://developers.facebook.com/docs/facebook-login/guides/access-tokens",
    },
    {
        "id": "page_token_docs",
        "title": "Page Access Token",
        "desc": "Generate/retrieve Page access token from user token.",
        "url": "https://developers.facebook.com/docs/pages/access-tokens/",
    },
    {
        "id": "graph_explorer",
        "title": "Graph API Explorer",
        "desc": "Use Explorer to request permissions and generate/test token.",
        "url": "https://developers.facebook.com/tools/explorer/",
    },
    {
        "id": "token_debugger",
        "title": "Access Token Debugger",
        "desc": "Validate expiry/scopes of your token.",
        "url": "https://developers.facebook.com/tools/debug/accesstoken/",
    },
    {
        "id": "app_review",
        "title": "App Review / Live Mode",
        "desc": "Request advanced access permissions and move app to Live mode.",
        "url": "https://developers.facebook.com/docs/resp-plat-initiatives/app-review",
    },
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Open and track Meta setup links one by one."
    )
    parser.add_argument(
        "--progress-file",
        default=PROGRESS_FILE,
        help="Path to save setup progress JSON.",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Reset progress and start from step 1.",
    )
    parser.add_argument(
        "--open",
        action="store_true",
        help="Automatically open each link in default browser when shown.",
    )
    return parser.parse_args()


def load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return default


def save_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def print_step(index: int, total: int, step: Dict[str, str]) -> None:
    print("\n" + "=" * 72)
    print(f"Step {index}/{total}: {step['title']}")
    print("-" * 72)
    print(step["desc"])
    print(f"Link: {step['url']}")
    print("=" * 72)
    print("Actions: [o] open link  [d] done/next  [s] skip  [q] quit")


def main() -> int:
    args = parse_args()
    progress_file = Path(args.progress_file).resolve()

    progress = load_json(progress_file, default={"completed_step_ids": []})
    if not isinstance(progress, dict):
        progress = {"completed_step_ids": []}
    completed = progress.get("completed_step_ids", [])
    if not isinstance(completed, list):
        completed = []

    if args.reset:
        completed = []

    total_steps = len(STEPS)
    print(f"[info] progress file: {progress_file}")
    print(f"[info] completed steps: {len(completed)}/{total_steps}")

    for idx, step in enumerate(STEPS, start=1):
        step_id = step["id"]
        if step_id in completed:
            continue

        print_step(idx, total_steps, step)
        if args.open:
            webbrowser.open(step["url"])
            print("[info] link opened in browser.")

        while True:
            choice = input("Enter action (o/d/s/q): ").strip().lower()
            if choice == "o":
                webbrowser.open(step["url"])
                print("[info] link opened in browser.")
                continue
            if choice in {"d", ""}:
                completed.append(step_id)
                progress["completed_step_ids"] = completed
                save_json(progress_file, progress)
                print(f"[ok] marked done: {step['title']}")
                break
            if choice == "s":
                print(f"[skip] {step['title']}")
                break
            if choice == "q":
                progress["completed_step_ids"] = completed
                save_json(progress_file, progress)
                print("[done] exited early. Progress saved.")
                return 0
            print("[warn] invalid action. Use o/d/s/q.")

    done_count = len(completed)
    print("\n[done] setup wizard finished.")
    print(f"[done] completed steps: {done_count}/{total_steps}")
    print("\nRequired values for your uploader script:")
    print("- META_PAGE_ACCESS_TOKEN")
    print("- INSTAGRAM_USER_ID")
    print("- FACEBOOK_PAGE_ID")
    print("\nThen run:")
    print(
        "python metaBatchReelsUpload.py --platform both "
        "--access-token \"<META_PAGE_ACCESS_TOKEN>\" "
        "--ig-user-id \"<INSTAGRAM_USER_ID>\" "
        "--facebook-page-id \"<FACEBOOK_PAGE_ID>\""
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
