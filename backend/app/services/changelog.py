from __future__ import annotations

import re
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path

_GITHUB_REPO = "xoriin/netmap"
_REMOTE_CHANGELOG_TTL = 3600

CHANGELOG_FILE_CANDIDATES = (
    Path("/app/CHANGELOG.md"),
    Path(__file__).resolve().parents[3] / "CHANGELOG.md",
)

_VERSION_HEADER = re.compile(r"^## \[(\d+\.\d+\.\d+)\]")
_CATEGORY_HEADER = re.compile(r"^### (.+)$")
_BULLET = re.compile(r"^- ")

_remote_changelog_cache: dict[str, tuple[str | None, float]] = {}


@dataclass
class ChangelogSection:
    category: str
    items: list[str] = field(default_factory=list)


@dataclass
class ChangelogRelease:
    version: str
    sections: list[ChangelogSection] = field(default_factory=list)


def read_changelog_text() -> str | None:
    for path in CHANGELOG_FILE_CANDIDATES:
        try:
            text = path.read_text(encoding="utf-8")
            if text.strip():
                return text
        except OSError:
            continue
    return None


def parse_changelog(text: str) -> list[ChangelogRelease]:
    releases: dict[str, ChangelogRelease] = {}
    current_release: ChangelogRelease | None = None
    current_section: ChangelogSection | None = None

    for raw_line in text.splitlines():
        line = raw_line.rstrip()
        if not line.strip():
            continue

        version_match = _VERSION_HEADER.match(line)
        if version_match:
            version = version_match.group(1)
            current_release = releases.get(version)
            if current_release is None:
                current_release = ChangelogRelease(version=version)
                releases[version] = current_release
            current_section = None
            continue

        if current_release is None:
            continue

        category_match = _CATEGORY_HEADER.match(line)
        if category_match:
            category = category_match.group(1).strip()
            current_section = next(
                (section for section in current_release.sections if section.category == category),
                None,
            )
            if current_section is None:
                current_section = ChangelogSection(category=category)
                current_release.sections.append(current_section)
            continue

        if current_section is not None and _BULLET.match(line):
            item = _BULLET.sub("", line, count=1).strip()
            if item:
                current_section.items.append(item)

    return sorted(releases.values(), key=lambda release: _version_sort_key(release.version), reverse=True)


def extract_release_section(text: str, version: str) -> str | None:
    normalized = version.lstrip("v")
    pattern = re.compile(
        rf"^## \[{re.escape(normalized)}\].*?(?=^## \[|\Z)",
        re.MULTILINE | re.DOTALL,
    )
    match = pattern.search(text)
    if not match:
        return None
    body = match.group(0).strip()
    return body or None


def _version_sort_key(version: str) -> tuple[int, int, int]:
    match = re.fullmatch(r"v?(\d+)\.(\d+)\.(\d+)", version.strip())
    if not match:
        return (0, 0, 0)
    return tuple(int(part) for part in match.groups())


def version_tuple(version: str) -> tuple[int, int, int] | None:
    key = _version_sort_key(version)
    if key == (0, 0, 0) and not re.fullmatch(r"v?\d+\.\d+\.\d+", version.strip()):
        return None
    return key


def _fetch_remote_changelog_text(version: str, user_agent: str = "netmap") -> str | None:
    normalized = version.lstrip("v")
    now = time.monotonic()
    cached = _remote_changelog_cache.get(normalized)
    if cached is not None and (now - cached[1]) < _REMOTE_CHANGELOG_TTL:
        return cached[0]

    url = f"https://raw.githubusercontent.com/{_GITHUB_REPO}/v{normalized}/CHANGELOG.md"
    text: str | None = None
    try:
        req = urllib.request.Request(url, headers={"User-Agent": user_agent})
        with urllib.request.urlopen(req, timeout=5) as resp:
            payload = resp.read().decode("utf-8").strip()
            text = payload or None
    except (OSError, urllib.error.URLError, UnicodeDecodeError):
        text = None

    _remote_changelog_cache[normalized] = (text, now)
    return text


def release_from_remote_changelog(version: str, user_agent: str = "netmap") -> ChangelogRelease | None:
    remote_text = _fetch_remote_changelog_text(version, user_agent=user_agent)
    if not remote_text:
        return None
    section_text = extract_release_section(remote_text, version)
    if not section_text:
        return None
    releases = parse_changelog(section_text)
    normalized = version.lstrip("v")
    for release in releases:
        if release.version == normalized:
            return release
    return None


def _merge_highlights(
    highlights: list[ChangelogRelease],
    current: str,
    latest: str,
    user_agent: str = "netmap",
) -> list[ChangelogRelease]:
    current_tuple = version_tuple(current)
    latest_tuple = version_tuple(latest)
    if current_tuple is None or latest_tuple is None:
        return highlights

    covered = {release.version for release in highlights}
    merged = list(highlights)

    if current_tuple >= latest_tuple:
        if latest not in covered:
            remote_release = release_from_remote_changelog(latest, user_agent=user_agent)
            if remote_release is not None:
                merged = [remote_release]
        return sorted(merged, key=lambda release: _version_sort_key(release.version), reverse=True)

    if latest not in covered:
        remote_release = release_from_remote_changelog(latest, user_agent=user_agent)
        if remote_release is not None:
            merged.append(remote_release)

    return sorted(merged, key=lambda release: _version_sort_key(release.version), reverse=True)


def changelog_for_installed_version(
    current: str,
    text: str | None = None,
    *,
    user_agent: str = "netmap",
) -> list[ChangelogRelease]:
    normalized = current.lstrip("v")
    source = text if text is not None else read_changelog_text()
    if source:
        for release in parse_changelog(source):
            if release.version == normalized and release.sections:
                return [release]

    remote_release = release_from_remote_changelog(normalized, user_agent=user_agent)
    if remote_release is not None and remote_release.sections:
        return [remote_release]
    return []


def changelog_highlights(
    current: str,
    latest: str | None,
    text: str | None = None,
    *,
    user_agent: str = "netmap",
) -> list[ChangelogRelease]:
    if not latest:
        return []

    source = text if text is not None else read_changelog_text()

    current_tuple = version_tuple(current)
    latest_tuple = version_tuple(latest)
    if current_tuple is None or latest_tuple is None:
        return []

    highlights: list[ChangelogRelease] = []
    if source:
        parsed = parse_changelog(source)
        if current_tuple >= latest_tuple:
            highlights = [release for release in parsed if version_tuple(release.version) == latest_tuple]
        else:
            for release in parsed:
                release_tuple = version_tuple(release.version)
                if release_tuple is None:
                    continue
                if current_tuple < release_tuple <= latest_tuple:
                    highlights.append(release)

    return _merge_highlights(highlights, current, latest, user_agent=user_agent)


def changelog_release_to_dict(release: ChangelogRelease) -> dict:
    return {
        "version": release.version,
        "sections": [
            {"category": section.category, "items": list(section.items)}
            for section in release.sections
            if section.items
        ],
    }
