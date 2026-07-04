#!/usr/bin/env python3
"""Phase 3.3 application pass (user-approved 2026-07-04).

Replaces every hex in the approved tiers (proposed ΔE ≤ 5 + exact) of
COLOR_NORMALIZATION_REPORT.md with its token var(), using the same
scope-aware block parsing as the report script: hexes inside `body.theme-dark`
blocks map against the dark palette, everything else against the light
palette. Token-definition lines (`--nm-*`) and comment spans are left alone.

Usage:  python3 scripts/apply_color_normalization.py [--dry-run]
"""

from __future__ import annotations

import re
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from color_normalization_report import (  # noqa: E402
    CONSERVATIVE_DELTA_E, HEX_RE, TOKEN_DEF_RE, STYLES,
    delta_e, expand_hex, parse_token_palette,
)


def selector_is_dark(selectors: list[str]) -> bool:
    """Dark scope iff a selector references .theme-dark OUTSIDE any :not()."""
    for selector in selectors:
        stripped = re.sub(r":not\([^)]*\)", "", selector)
        if "theme-dark" in stripped:
            return True
    return False


def nearest_token(palette: dict[str, str], hex6: str) -> tuple[str, float]:
    best_token, best_de = "", float("inf")
    for token, value in palette.items():
        de = delta_e(hex6, value)
        if de < best_de:
            best_token, best_de = token, de
    return best_token, best_de


def main() -> None:
    dry_run = "--dry-run" in sys.argv
    light, dark = parse_token_palette()
    palettes = {"light": light, "dark": dark}
    decision_cache: dict[tuple[str, str], str | None] = {}

    def replacement_for(scope: str, hex6: str) -> str | None:
        cache_key = (scope, hex6)
        if cache_key not in decision_cache:
            token, de = nearest_token(palettes[scope], hex6)
            decision_cache[cache_key] = f"var(--nm-{token})" if de <= CONSERVATIVE_DELTA_E else None
        return decision_cache[cache_key]

    replaced = Counter()
    per_file = Counter()

    for css_file in sorted(STYLES.glob("*.css")):
        stack: list[str] = []
        pending_selector = ""
        in_comment = False
        out_lines: list[str] = []
        for line in css_file.read_text().splitlines():
            if TOKEN_DEF_RE.match(line):
                out_lines.append(line)
                pending_selector = ""
                continue

            scope = "dark" if selector_is_dark(stack) else "light"

            # Replace hexes outside comment spans on this line.
            result: list[str] = []
            i = 0
            while i < len(line):
                if in_comment:
                    end = line.find("*/", i)
                    if end == -1:
                        result.append(line[i:])
                        i = len(line)
                    else:
                        result.append(line[i:end + 2])
                        i = end + 2
                        in_comment = False
                    continue
                start = line.find("/*", i)
                segment = line[i:] if start == -1 else line[i:start]

                def sub(match: re.Match[str]) -> str:
                    hex6 = expand_hex(match.group(1))
                    if hex6 is None:
                        return match.group(0)
                    repl = replacement_for(scope, hex6)
                    if repl is None:
                        return match.group(0)
                    replaced[(scope, "#" + hex6, repl)] += 1
                    per_file[css_file.name] += 1
                    return repl

                result.append(HEX_RE.sub(sub, segment))
                if start == -1:
                    i = len(line)
                else:
                    result.append("/*")
                    i = start + 2
                    in_comment = True
            new_line = "".join(result)
            out_lines.append(new_line)

            # Track nesting AFTER substitution, using the original line.
            for ch in line:
                if ch == "{":
                    stack.append(pending_selector.strip())
                    pending_selector = ""
                elif ch == "}":
                    if stack:
                        stack.pop()
                    pending_selector = ""
                else:
                    pending_selector += ch

        if not dry_run:
            css_file.write_text("\n".join(out_lines) + "\n")

    total = sum(replaced.values())
    unique = len(replaced)
    print(f"{'DRY RUN — ' if dry_run else ''}replaced {total} occurrences of {unique} unique (scope, hex) pairs")
    for name, count in sorted(per_file.items()):
        print(f"  {name}: {count}")


if __name__ == "__main__":
    main()
