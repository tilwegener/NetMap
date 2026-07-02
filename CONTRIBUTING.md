# Contributing to NetMap

Thanks for your interest in contributing. This document covers how to set up a local development environment, validate changes, and follow the project's workflow before opening a pull request.

---

## Table of contents

- [Project overview](#project-overview)
- [Prerequisites](#prerequisites)
- [Getting started](#getting-started)
- [Running locally](#running-locally)
- [Project structure](#project-structure)
- [Validating changes](#validating-changes)
- [Code style](#code-style)
- [Submitting a pull request](#submitting-a-pull-request)
- [Reporting bugs](#reporting-bugs)
- [Feature requests](#feature-requests)

---

## Project overview

NetMap is a self-hosted network mapping and monitoring application. Everything runs inside a single Docker container (nginx + uvicorn + a syslog receiver, managed by tini).

- **Backend** — FastAPI, SQLite (two databases: `netmap.db` and `firewall.db`), Python 3.12+
- **Frontend** — React + TypeScript SPA, built with Vite
- **Container** — single `aio.Dockerfile`, published to Docker Hub as `xoriin/netmap`

---

## Prerequisites

| Tool | Notes |
|------|-------|
| Docker + Compose | Required to build and run the container |
| Node.js 20+ | Frontend build and type-checking |
| Python 3.12+ with [uv](https://github.com/astral-sh/uv) | Backend linting and tests |
| nmap | Required at runtime inside the container; not needed on the host for development |

---

## Getting started

```bash
# Clone the repo
git clone https://github.com/xoriin/netmap.git
cd netmap

# Copy the example env file — edit values as needed for local use
cp netmap.env.example netmap.env
```

No additional setup is required. The rebuild script generates a `MASTER_KEY` automatically on first run if one isn't already set.

---

## Running locally

The `rebuild-aio.sh` script builds the container image from source and starts it:

```bash
./rebuild-aio.sh
```

This runs `docker compose -f docker-compose.aio.yml up --build --force-recreate -d`. The app will be available at `http://localhost:8090` by default.

On first start, navigate to `http://localhost:8090` and complete the setup wizard to create your first admin account.

---

## Project structure

```
backend/app/
  api/v1/          — FastAPI route handlers
  core/config.py   — Settings (pydantic-settings)
  db/              — SQLAlchemy sessions (netmap.db + firewall.db)
  models/          — SQLAlchemy models
  services/        — Business logic (discovery, alerting, syslog, exports)

frontend/src/
  api/client.ts    — Typed API client
  App.tsx          — Root component, auth, routing
  Sidebar.tsx      — Navigation shell
  components/      — Shared atom components
  features/        — Page-level workspaces (devices, topology, monitoring, etc.)
  styles/global.css — All CSS (single file)
  utils/           — Shared helpers

docker/
  aio.Dockerfile   — Single-container build
```

---

## Validating changes

Run both checks before opening a PR. Neither should produce errors or new warnings.

**Frontend (TypeScript + build)**

```bash
cd frontend
npm exec tsc -- --noEmit
node node_modules/vite/bin/vite.js build
```

**Backend (tests)**

```bash
cd backend
uv run --extra dev python -m pytest tests
```

---

## Code style

- **No comments explaining what the code does** — well-named identifiers do that. Add a comment only when the *why* is non-obvious (a hidden constraint, a workaround, a subtle invariant).
- **No speculative abstractions** — don't refactor or add helpers beyond what the task actually needs.
- **Frontend** — React functional components, TypeScript strict mode, no `any`. CSS lives in `global.css`; follow the existing naming conventions (BEM-adjacent, feature-prefixed: `mon-`, `ep-`, `dash-`, etc.).
- **Backend** — follow existing patterns for route handlers (thin handlers, logic in `services/`). New database columns require a migration script in `backend/app/db/migrations/`.
- **Commit messages** — short present-tense summary, no ticket prefixes. Keep it descriptive of the actual change.

---

## Submitting a pull request

1. Fork the repository and create a branch from `main`.
2. Make your changes and validate them (see above).
3. Open a pull request against `main` with a clear description of what changed and why.
4. If your change is user-visible, add an entry to `CHANGELOG.md` under an `## [Unreleased]` section using [Keep a Changelog](https://keepachangelog.com/) format (`### Added`, `### Changed`, `### Fixed`).

Pull requests that break the TypeScript check or backend tests won't be merged.

---

## Releasing

NetMap uses `CHANGELOG.md` as the single source of truth for release notes:

1. Move `[Unreleased]` entries into a dated `## [X.Y.Z] - YYYY-MM-DD` section and bump `VERSION`.
2. Mirror to `test/`, push branch `test`, and validate the Docker Hub test image.
3. Merge to `main`, tag `vX.Y.Z`, and push the tag.

Pushing a `v*` tag runs CI that:

- builds and publishes the Docker Hub release image (`xoriin/netmap:vX.Y.Z` and `latest`), and
- publishes a **GitHub Release** for the same tag using the matching `CHANGELOG.md` section (`scripts/release-notes-from-changelog.py`). Existing releases are updated in place; new tags create a verified release marked as latest.

The in-app What's New modal reads the same baked `CHANGELOG.md` from the running image, so you do not maintain a separate release-notes document. Do not hand-write GitHub release bodies anymore; edit `CHANGELOG.md` only.

---

## Reporting bugs

Open an issue at [github.com/xoriin/netmap/issues](https://github.com/xoriin/netmap/issues). Include:

- NetMap version (shown in the sidebar or Admin panel)
- How you're running it (Docker Compose, direct, etc.)
- Steps to reproduce
- What you expected vs. what happened
- Relevant logs (`docker logs <container>`)

---

## Feature requests

Open an issue with the `enhancement` label. Describe the use case, not just the solution — it helps evaluate fit with the project's scope.
