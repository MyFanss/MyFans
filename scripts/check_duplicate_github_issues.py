#!/usr/bin/env python3
"""
Find GitHub issues that share the same title (e.g. after running the engagement script twice).

Fetches **all** matching issues via the REST API (paginated), not only the first page.

Requires: `gh` CLI authenticated.

Usage:
  python3 scripts/check_duplicate_github_issues.py --repo MyFanss/MyFans
  python3 scripts/check_duplicate_github_issues.py --repo MyFanss/MyFans --suggest-closes
  python3 scripts/check_duplicate_github_issues.py --repo MyFanss/MyFans --close-duplicates --yes

By default, "duplicate" means **two or more OPEN issues with the exact same title**
(closed issues can still share a title with an open one; that is not flagged).
Use `--count-closed-as-dupes` to include closed issues in the duplicate report (historical).
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from collections import defaultdict


def gh_api_get_issues_page(repo: str, state: str, page: int) -> list:
    """GET /repos/{owner}/{repo}/issues (one page)."""
    state_q = {"open": "open", "closed": "closed", "all": "all"}[state]
    path = f"repos/{repo}/issues?state={state_q}&per_page=100&page={page}"
    cmd = ["gh", "api", path, "-H", "Accept: application/vnd.github+json"]
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode != 0:
        sys.stderr.write(p.stderr or p.stdout or "gh api failed\n")
        sys.exit(p.returncode)
    return json.loads(p.stdout or "[]")


def fetch_all_issues(repo: str, state: str) -> list[dict]:
    """Paginate GitHub issues (excludes PRs returned by the issues endpoint)."""
    page = 1
    collected: list[dict] = []
    while True:
        batch = gh_api_get_issues_page(repo, state, page)
        if not isinstance(batch, list):
            sys.exit("Unexpected API response (expected a list of issues)")
        for item in batch:
            if item.get("pull_request") is not None:
                continue
            collected.append(
                {
                    "number": item["number"],
                    "title": (item.get("title") or "").strip(),
                    "state": item.get("state", ""),
                    "createdAt": item.get("created_at", ""),
                }
            )
        if len(batch) < 100:
            break
        page += 1
    return collected


def resolve_repo(explicit: str | None) -> str:
    if explicit:
        return explicit
    import os

    env = os.environ.get("GITHUB_REPOSITORY")
    if env:
        return env
    p = subprocess.run(
        ["gh", "repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"],
        capture_output=True,
        text=True,
        check=True,
    )
    slug = (p.stdout or "").strip()
    if not slug:
        sys.exit("Pass --repo owner/name or set GITHUB_REPOSITORY.")
    return slug


def close_issue(repo: str, number: int, comment: str) -> None:
    subprocess.run(
        [
            "gh",
            "issue",
            "close",
            str(number),
            "--repo",
            repo,
            "--comment",
            comment,
        ],
        check=True,
    )


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--repo", default=None)
    ap.add_argument(
        "--state",
        choices=("open", "closed", "all"),
        default="all",
        help="Which issues to scan (default: all)",
    )
    ap.add_argument(
        "--suggest-closes",
        action="store_true",
        help="Print gh issue close commands (keep lowest # per title; does not run them)",
    )
    ap.add_argument(
        "--count-closed-as-dupes",
        action="store_true",
        help="Treat same title on closed issues as duplicates too (default: only OPEN issues)",
    )
    ap.add_argument(
        "--close-duplicates",
        action="store_true",
        help="Close every duplicate except the lowest # per title (requires --yes)",
    )
    ap.add_argument(
        "--yes",
        action="store_true",
        help="Confirm destructive --close-duplicates",
    )
    ap.add_argument(
        "--sleep",
        type=float,
        default=0.25,
        help="Seconds between close API calls (rate limits)",
    )
    args = ap.parse_args()

    if args.close_duplicates and not args.yes:
        sys.exit("--close-duplicates requires --yes (safety).")

    repo = resolve_repo(args.repo)
    issues = fetch_all_issues(repo, args.state)
    by_title: dict[str, list[dict]] = defaultdict(list)
    for it in issues:
        if not it["title"]:
            continue
        by_title[it["title"]].append(it)

    def is_open(it: dict) -> bool:
        return (it.get("state") or "").lower() == "open"

    dupes_all = {t: lst for t, lst in by_title.items() if len(lst) > 1}
    dupes_open: dict[str, list[dict]] = {}
    for t, lst in by_title.items():
        open_lst = [x for x in lst if is_open(x)]
        if len(open_lst) > 1:
            dupes_open[t] = open_lst

    dupes = dupes_all if args.count_closed_as_dupes else dupes_open
    if not dupes:
        scope = "open issues" if not args.count_closed_as_dupes else f"issues ({args.state})"
        print(f"No duplicate titles among {len(issues)} scanned ({scope}) on {repo}.")
        return

    # Always close extras among *open* duplicates only (cannot re-close).
    to_close: list[tuple[int, int, str]] = []
    for title, lst in dupes_open.items():
        lst_sorted = sorted(lst, key=lambda x: x["number"])
        keep = lst_sorted[0]["number"]
        for it in lst_sorted[1:]:
            to_close.append((it["number"], keep, title))

    print(f"Scanned {len(issues)} issues on {repo} ({args.state}).")
    mode = "all states (same title)" if args.count_closed_as_dupes else "OPEN only"
    print(
        f"Duplicate titles ({mode}): {len(dupes)}. "
        f"Open duplicates to close: {len(to_close)} (keep lowest # per title among open).\n"
    )

    for title in sorted(dupes.keys(), key=lambda t: (-len(dupes[t]), t)):
        lst = dupes[title]
        nums = ", ".join(str(x["number"]) for x in sorted(lst, key=lambda x: x["number"]))
        print(f"  ×{len(lst)}  #{nums}")
        print(f"      {title[:100]}{'…' if len(title) > 100 else ''}\n")

    if args.suggest_closes:
        print("--- Suggested closes (keep lowest #; review then run manually) ---\n")
        for n, keep, _title in sorted(to_close, key=lambda x: x[0]):
            msg = f"Duplicate of #{keep}; closing in favor of canonical issue."
            safe = msg.replace('"', '\\"')
            print(f'gh issue close {n} --repo {repo} --comment "{safe}"')
        print()

    if args.close_duplicates:
        for n, keep, _title in sorted(to_close, key=lambda x: x[0]):
            comment = f"Duplicate of #{keep}; closing in favor of canonical issue."
            print(f"Closing #{n} (keep #{keep})…", flush=True)
            close_issue(repo, n, comment)
            time.sleep(args.sleep)
        print(f"\nClosed {len(to_close)} duplicate issues on {repo}.")


if __name__ == "__main__":
    main()
