#!/usr/bin/env python3
"""Phase 3.3 prep: cluster drifted CSS hex colours against the design tokens.

Scans src/styles/*.css with scope awareness (values inside `body.theme-dark`
blocks are compared against the dark token palette, everything else against
the light palette), computes CIE76 deltaE to the nearest chromatic token, and
writes a markdown mapping report for user sign-off.

No CSS is modified. Usage:  python3 scripts/color_normalization_report.py
"""

from __future__ import annotations

import re
from collections import defaultdict
from pathlib import Path

FRONTEND = Path(__file__).resolve().parent.parent
STYLES = FRONTEND / "src" / "styles"
REPORT = FRONTEND.parent / "docs" / "COLOR_NORMALIZATION_REPORT.md"

CONSERVATIVE_DELTA_E = 5.0   # proposed: visually near-identical
REVIEW_DELTA_E = 12.0        # listed but excluded: noticeable shift

HEX_RE = re.compile(r"#([0-9a-fA-F]{3,8})\b")
TOKEN_DEF_RE = re.compile(r"^\s*--nm-([a-z0-9-]+)\s*:\s*#([0-9a-fA-F]{6})\s*;")


def selector_is_dark(selectors: list[str]) -> bool:
    """Dark scope iff a selector references .theme-dark OUTSIDE any :not()."""
    for selector in selectors:
        stripped = re.sub(r":not\([^)]*\)", "", selector)
        if "theme-dark" in stripped:
            return True
    return False


def expand_hex(raw: str) -> str | None:
    """Normalize to lowercase 6-digit rgb hex; None for alpha/invalid lengths."""
    if len(raw) == 3:
        raw = "".join(ch * 2 for ch in raw)
    if len(raw) != 6:
        return None
    return raw.lower()


def hex_to_lab(hex6: str) -> tuple[float, float, float]:
    r, g, b = (int(hex6[i:i + 2], 16) / 255.0 for i in (0, 2, 4))

    def to_linear(c: float) -> float:
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = to_linear(r), to_linear(g), to_linear(b)
    x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
    y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883

    def f(t: float) -> float:
        return t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116

    fx, fy, fz = f(x), f(y), f(z)
    return 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)


def delta_e(a: str, b: str) -> float:
    la, lb = hex_to_lab(a), hex_to_lab(b)
    return sum((p - q) ** 2 for p, q in zip(la, lb)) ** 0.5


def parse_token_palette() -> tuple[dict[str, str], dict[str, str]]:
    """Return (light, dark) palettes: token name -> 6-digit hex."""
    light: dict[str, str] = {}
    for line in (STYLES / "tokens.css").read_text().splitlines():
        m = TOKEN_DEF_RE.match(line)
        if m:
            light[m.group(1)] = m.group(2).lower()
    dark = dict(light)
    in_flip = False
    for line in (STYLES / "theme-dark.css").read_text().splitlines():
        if line.startswith("body.theme-dark {"):
            in_flip = True
            continue
        if in_flip and line.startswith("}"):
            break
        if in_flip:
            m = TOKEN_DEF_RE.match(line)
            if m:
                dark[m.group(1)] = m.group(2).lower()
    return light, dark


def scan_styles() -> tuple[dict[tuple[str, str], list[tuple[str, int]]], int]:
    """Collect {(scope, hex6): [(file:line, count)]} plus a count of alpha hexes.

    Scope is "dark" when any selector on the block stack mentions theme-dark,
    else "light". Token-definition lines are skipped.
    """
    occurrences: dict[tuple[str, str], list[tuple[str, int]]] = defaultdict(list)
    alpha_hexes = 0
    for css_file in sorted(STYLES.glob("*.css")):
        stack: list[str] = []
        pending_selector = ""
        for lineno, line in enumerate(css_file.read_text().splitlines(), start=1):
            if TOKEN_DEF_RE.match(line):
                pending_selector = ""
                continue
            for raw in HEX_RE.findall(line):
                if len(raw) in (4, 8):
                    alpha_hexes += 1
                    continue
                hex6 = expand_hex(raw)
                if hex6 is None:
                    continue
                scope = "dark" if selector_is_dark(stack) else "light"
                occurrences[(scope, hex6)].append((f"{css_file.name}:{lineno}", 1))
            # Track selector nesting AFTER extracting values on this line.
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
    return occurrences, alpha_hexes


def main() -> None:
    light, dark = parse_token_palette()
    palettes = {"light": light, "dark": dark}
    occurrences, alpha_hexes = scan_styles()

    exact: list[tuple] = []
    proposed: list[tuple] = []
    review: list[tuple] = []
    unmapped_count = 0
    unmapped_occurrences = 0

    for (scope, hex6), sites in sorted(occurrences.items()):
        palette = palettes[scope]
        best_token, best_de = None, float("inf")
        for token, value in palette.items():
            de = delta_e(hex6, value)
            if de < best_de:
                best_token, best_de = token, de
        count = len(sites)
        files = sorted({site.split(":")[0] for site, _ in sites})
        row = (scope, hex6, best_token, best_de, count, files)
        if best_de == 0:
            exact.append(row)
        elif best_de <= CONSERVATIVE_DELTA_E:
            proposed.append(row)
        elif best_de <= REVIEW_DELTA_E:
            review.append(row)
        else:
            unmapped_count += 1
            unmapped_occurrences += count

    proposed.sort(key=lambda r: (-r[4], r[3]))
    review.sort(key=lambda r: (-r[4], r[3]))
    exact.sort(key=lambda r: -r[4])

    def table(rows: list[tuple]) -> str:
        lines = [
            "| Scope | Hex | → Token | ΔE | Uses | Files |",
            "|---|---|---|---|---|---|",
        ]
        for scope, hex6, token, de, count, files in rows:
            lines.append(
                f"| {scope} | `#{hex6}` | `--nm-{token}` | {de:.1f} | {count} | {', '.join(files)} |"
            )
        return "\n".join(lines)

    total_unique = len(occurrences)
    total_occ = sum(len(sites) for sites in occurrences.values())
    proposed_occ = sum(r[4] for r in proposed)
    review_occ = sum(r[4] for r in review)
    exact_occ = sum(r[4] for r in exact)

    report = f"""# Colour Normalization Mapping Report (Phase 3.3 — for sign-off)

Generated by `frontend/scripts/color_normalization_report.py`. **No CSS has
been changed.** Scope-aware: hexes inside `body.theme-dark` blocks are
compared against the dark token palette, all others against the light palette.
Only solid 3/6-digit hexes are considered ({alpha_hexes} alpha (4/8-digit)
hexes and all `rgba()` values are out of scope for this pass).

## Summary

| Metric | Value |
|---|---|
| Unique (scope, hex) pairs found | {total_unique} |
| Total occurrences | {total_occ} |
| **Proposed for tokenization (ΔE ≤ {CONSERVATIVE_DELTA_E:g})** | **{len(proposed)} unique / {proposed_occ} occurrences** |
| Exact token matches (ΔE = 0, mechanical) | {len(exact)} unique / {exact_occ} occurrences |
| Excluded — noticeable drift ({CONSERVATIVE_DELTA_E:g} < ΔE ≤ {REVIEW_DELTA_E:g}) | {len(review)} unique / {review_occ} occurrences |
| Unmapped — no nearby token (ΔE > {REVIEW_DELTA_E:g}) | {unmapped_count} unique / {unmapped_occurrences} occurrences |

Approving this report authorizes replacing the **proposed** (and exact) rows
with their token `var()`s, then re-running the screenshot suite — only diffs
within the approved rows' colour deltas are acceptable.

**Caveat the application pass must handle:** a "light"-scope hex may live in a
selector that applies in *both* themes (most of the app's CSS is shared;
`theme-dark.css` also contains shared selectors after the token-flip block).
Replacing such a hex with `var()` changes its **dark**-mode rendering too —
either a `body.theme-dark` override already re-styles that property (fine), or
the dark screenshot baseline will flag it. Every replacement is validated
against BOTH theme baselines; dark diffs outside the approved deltas get the
replacement reverted for that site.

## Proposed mappings (conservative tier, ΔE ≤ {CONSERVATIVE_DELTA_E:g})

{table(proposed)}

## Exact matches (mechanical, no visual change)

{table(exact)}

## Excluded: noticeable drift ({CONSERVATIVE_DELTA_E:g} < ΔE ≤ {REVIEW_DELTA_E:g}) — needs a separate decision

{table(review)}
"""
    REPORT.write_text(report)
    print(f"wrote {REPORT}")
    print(f"unique={total_unique} occurrences={total_occ} proposed={len(proposed)}/{proposed_occ} exact={len(exact)}/{exact_occ} review={len(review)}/{review_occ} unmapped={unmapped_count}/{unmapped_occurrences}")


if __name__ == "__main__":
    main()
