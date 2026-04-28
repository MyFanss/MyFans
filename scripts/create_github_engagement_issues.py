#!/usr/bin/env python3
"""
Create GitHub issues from ENGAGEMENT_ISSUES_125.md (or another file with the same shape).

Formatting matches the project's issue template:
  Description (<Area>)
  <summary>
  Tasks
  ...
  Additional Requirements
  ...
  Acceptance Criteria
  ...

Labels:
  - Every issue: "Stellar Wave"
  - First (total − skip_last) issues: also one of "frontend", "backend", "contract"
  - Last `skip_last` issues (default 14): only "Stellar Wave" (no area label)

Requires: GitHub CLI (`gh`) authenticated (`gh auth login`) or `GH_TOKEN` with `repo` scope.

Usage:
  ./scripts/create_github_engagement_issues.py --dry-run
  ./scripts/create_github_engagement_issues.py
  ./scripts/create_github_engagement_issues.py --file ./ENGAGEMENT_ISSUES_125.md --skip-last 14
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
import time
from pathlib import Path


def parse_issues(markdown: str) -> list[tuple[int, str, str]]:
    """Return list of (number, title, summary_body) from ## NNN — Title blocks."""
    pattern = re.compile(r"^## (\d{3}) — (.+)$", re.MULTILINE)
    matches = list(pattern.finditer(markdown))
    out: list[tuple[int, str, str]] = []
    for i, m in enumerate(matches):
        num = int(m.group(1))
        title = m.group(2).strip()
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(markdown)
        raw = markdown[start:end].strip()
        summary = raw.split("\n\n")[0].strip() if raw else title
        out.append((num, title, summary))
    out.sort(key=lambda x: x[0])
    return out


def area_for_index(n: int) -> str:
    """Map 1-based issue index to GitHub label: frontend | backend | contract."""
    if 1 <= n <= 25:
        return "backend"
    if 26 <= n <= 50:
        return "contract"
    if 51 <= n <= 75:
        return "frontend"
    if 76 <= n <= 111:
        return ["backend", "contract", "frontend"][(n - 76) % 3]
    return ""  # 112+ handled by caller (no area label)


def area_display_label(area: str) -> str:
    return {"frontend": "Frontend", "backend": "Backend", "contract": "Contract"}[area]


def format_body(area: str, title: str, summary: str) -> str:
    disp = area_display_label(area)
    summary_text = summary if summary else title
    return (
        f"Description ({disp})\n\n"
        f"{summary_text}\n\n"
        "Tasks\n\n"
        "- Implement the change in the relevant code paths\n"
        "- Wire or persist state where the feature touches runtime behavior\n"
        "- Add tests (unit, integration, and/or contract/UI as appropriate)\n\n"
        "Additional Requirements\n\n"
        "- Handle stale, disconnected, or invalid states gracefully where applicable\n"
        "- Follow existing patterns in this repository (linting, modules, security)\n\n"
        "Acceptance Criteria\n\n"
        f"- {title} is done and verifiable (CI and/or a short manual checklist)\n"
        "- No regressions in closely related user or API flows\n"
    )


def format_body_platform(title: str, summary: str) -> str:
    """Last N issues: only label Stellar Wave; description is not tied to FE/BE/contract."""
    summary_text = summary if summary else title
    return (
        "Description (Platform)\n\n"
        f"{summary_text}\n\n"
        "Tasks\n\n"
        "- Break down the work and land it in sensible PRs\n"
        "- Add or update documentation where maintainers will look first\n"
        "- Add tests or checklists appropriate to the change\n\n"
        "Additional Requirements\n\n"
        "- Coordinate across frontend, backend, and contracts if the work spans layers\n"
        "- Keep changes reviewable and reversible\n\n"
        "Acceptance Criteria\n\n"
        f"- {title} is done and verifiable (CI and/or a short manual checklist)\n"
        "- Stakeholders agree the outcome matches the intent\n"
    )


def run_gh(args: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(["gh", *args], capture_output=True, text=True, check=check)


def ensure_labels(repo: str) -> None:
    specs = [
        ("Stellar Wave", "5319E7", "Cross-cutting / engagement batch"),
        ("frontend", "0E8A16", "Next.js app and client"),
        ("backend", "1D76DB", "NestJS API and services"),
        ("contract", "B60205", "Soroban / Rust contracts"),
    ]
    for name, color, desc in specs:
        p = run_gh(
            [
                "label",
                "create",
                name,
                "--color",
                color,
                "--description",
                desc,
                "--repo",
                repo,
                "--force",
            ],
            check=False,
        )
        if p.returncode not in (0, 1):
            sys.stderr.write(p.stderr or p.stdout or "")
            p.check_returncode()


def resolve_repo(explicit: str | None) -> str:
    if explicit:
        return explicit
    import os

    env = os.environ.get("GITHUB_REPOSITORY")
    if env:
        return env
    p = run_gh(["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"])
    slug = (p.stdout or "").strip()
    if not slug:
        sys.exit("Could not resolve repo. Pass --repo owner/name or set GITHUB_REPOSITORY.")
    return slug


def create_issue(
    repo: str,
    title: str,
    body: str,
    labels: list[str],
    dry_run: bool,
) -> None:
    if dry_run:
        print("--- DRY RUN ---")
        print("Title:", title[:120] + ("…" if len(title) > 120 else ""))
        print("Labels:", ", ".join(labels))
        print(body[:400] + ("…\n" if len(body) > 400 else "\n"))
        return
    with Path("/tmp/gh_issue_body_myfans.md").open("w", encoding="utf-8") as f:
        f.write(body)
    args = [
        "issue",
        "create",
        "--repo",
        repo,
        "--title",
        title,
        "--body-file",
        "/tmp/gh_issue_body_myfans.md",
    ]
    for lb in labels:
        args.extend(["--label", lb])
    run_gh(args)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--file",
        type=Path,
        default=Path("ENGAGEMENT_ISSUES_125.md"),
        help="Markdown file with ## NNN — Title sections",
    )
    ap.add_argument(
        "--skip-last",
        type=int,
        default=14,
        help="Do not add frontend/backend/contract on the last N issues (by number); Stellar Wave only",
    )
    ap.add_argument("--repo", type=str, default=None, help="owner/name (default: gh repo view)")
    ap.add_argument("--dry-run", action="store_true", help="Print only; do not call GitHub")
    ap.add_argument("--sleep", type=float, default=0.35, help="Seconds between API creates")
    args = ap.parse_args()

    if not args.file.is_file():
        sys.exit(f"File not found: {args.file.resolve()}\nGenerate it or pass --file.")

    text = args.file.read_text(encoding="utf-8")
    items = parse_issues(text)
    if not items:
        sys.exit("No ## NNN — Title sections found.")

    repo = resolve_repo(args.repo)
    if not args.dry_run:
        try:
            run_gh(["auth", "status"], check=True)
        except (subprocess.CalledProcessError, FileNotFoundError) as e:
            sys.exit(f"GitHub CLI not ready: {e}\nInstall `gh` and run `gh auth login`.")

    if not args.dry_run:
        ensure_labels(repo)

    nums = [n for n, _, _ in items]
    max_num = max(nums)
    skip_from = max_num - args.skip_last + 1 if args.skip_last > 0 else max_num + 1

    for num, title, summary in items:
        if num >= skip_from:
            labels = ["Stellar Wave"]
            body = format_body_platform(title, summary)
        else:
            area = area_for_index(num)
            if not area:
                area = "backend"
            labels = ["Stellar Wave", area]
            body = format_body(area, title, summary)

        create_issue(repo, title, body, labels, args.dry_run)
        if args.dry_run:
            print()
        else:
            time.sleep(args.sleep)

    if args.dry_run:
        print(f"Would create {len(items)} issues on {repo} (last {args.skip_last} without area label).")
    else:
        print(f"Created {len(items)} issues on {repo}.")


if __name__ == "__main__":
    main()
