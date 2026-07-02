#!/usr/bin/env python3
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.services.changelog import extract_release_section, read_changelog_text  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Extract a Keep a Changelog release section for GitHub release notes.",
    )
    parser.add_argument(
        "tag",
        help="Release tag or version (e.g. v1.3.1 or 1.3.1)",
    )
    parser.add_argument(
        "--changelog",
        type=Path,
        default=ROOT / "CHANGELOG.md",
        help="Path to CHANGELOG.md (default: repository root CHANGELOG.md)",
    )
    args = parser.parse_args()

    if args.changelog.exists():
        text = args.changelog.read_text(encoding="utf-8")
    else:
        text = read_changelog_text()
    if not text:
        print(f"Could not read changelog from {args.changelog}", file=sys.stderr)
        return 1

    section = extract_release_section(text, args.tag)
    if not section:
        version = args.tag.lstrip("v")
        print(f"No ## [{version}] section found in {args.changelog}", file=sys.stderr)
        return 1

    print(section)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
