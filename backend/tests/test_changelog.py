from unittest.mock import patch

from app.services.changelog import (
    changelog_for_installed_version,
    changelog_highlights,
    extract_release_section,
    parse_changelog,
)

SAMPLE_CHANGELOG = """# Changelog

## Unreleased

### Added
- **Draft feature** — not released yet.

## [1.3.1] - 2026-06-28

### Added
- **Topology radial layout** — new layout option.

### Fixed
- **Modal buttons** — styling no longer overridden.

## [1.3.0] - 2026-06-18

### Security
- **PyJWT migration** — removed python-jose.

### Added
- **Monitoring favourites filter** — star toggle in Monitoring.

## [1.2.9] - 2026-06-15

### Fixed
- **Older fix** — legacy release.
"""


def test_parse_changelog_skips_unreleased_and_sorts_newest_first() -> None:
    releases = parse_changelog(SAMPLE_CHANGELOG)

    assert [release.version for release in releases] == ["1.3.1", "1.3.0", "1.2.9"]
    assert releases[0].sections[0].category == "Added"
    assert "Topology radial layout" in releases[0].sections[0].items[0]


def test_parse_changelog_merges_duplicate_version_sections() -> None:
    text = """## [1.0.0] - 2026-01-01

### Added
- **First** — one.

## [1.0.0] - 2026-01-02

### Fixed
- **Second** — two.
"""
    releases = parse_changelog(text)

    assert len(releases) == 1
    assert [section.category for section in releases[0].sections] == ["Added", "Fixed"]


def test_changelog_for_installed_version_returns_current_release_only() -> None:
    releases = changelog_for_installed_version("1.3.0", SAMPLE_CHANGELOG)

    assert len(releases) == 1
    assert releases[0].version == "1.3.0"
    assert releases[0].sections[0].category == "Security"


def test_changelog_for_installed_version_fetches_missing_release_from_remote() -> None:
    local_changelog = """## [1.3.0] - 2026-06-18

### Added
- **Local only** — item.
"""
    remote_changelog = """# Changelog

## [1.3.1] - 2026-06-28

### Added
- **Topology radial layout** — new layout option.
"""
    with patch("app.services.changelog._fetch_remote_changelog_text", return_value=remote_changelog):
        releases = changelog_for_installed_version("1.3.1", local_changelog, user_agent="test")

    assert len(releases) == 1
    assert releases[0].version == "1.3.1"


def test_changelog_highlights_returns_versions_between_current_and_latest() -> None:
    highlights = changelog_highlights("1.2.9", "1.3.1", SAMPLE_CHANGELOG)

    assert [release.version for release in highlights] == ["1.3.1", "1.3.0"]


def test_changelog_highlights_returns_latest_section_when_up_to_date() -> None:
    highlights = changelog_highlights("1.3.1", "1.3.1", SAMPLE_CHANGELOG)

    assert len(highlights) == 1
    assert highlights[0].version == "1.3.1"


def test_extract_release_section_returns_markdown_block() -> None:
    section = extract_release_section(SAMPLE_CHANGELOG, "1.3.0")

    assert section is not None
    assert section.startswith("## [1.3.0]")
    assert "### Security" in section
    assert "## [1.2.9]" not in section


def test_changelog_highlights_fetches_missing_latest_from_remote() -> None:
    local_changelog = """## [1.3.0] - 2026-06-18

### Added
- **Local only** — item.
"""
    remote_changelog = """# Changelog

## [1.3.1] - 2026-06-28

### Added
- **Topology radial layout** — new layout option.
"""
    with patch("app.services.changelog._fetch_remote_changelog_text", return_value=remote_changelog):
        highlights = changelog_highlights("1.3.0", "1.3.1", local_changelog, user_agent="test")

    assert [release.version for release in highlights] == ["1.3.1"]
    assert highlights[0].sections[0].items[0].startswith("**Topology radial layout**")


def test_extract_release_section_accepts_v_prefix() -> None:
    section = extract_release_section(SAMPLE_CHANGELOG, "v1.3.1")

    assert section is not None
    assert "Topology radial layout" in section
