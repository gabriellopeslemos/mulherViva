# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Mulher Viva is a medical scheduling system for a clinic: a public booking flow, a token-based patient self-service flow, and a Google-SSO admin panel. Backend (`backend/app/`, FastAPI + SQLAlchemy) and frontend (`src/`, React + Vite) are separate apps that only talk over HTTP — check which one you're in before assuming a command.

## Commands

### Frontend (repo root)

```bash
npm run dev       # Vite dev server at http://localhost:5173
npm run build     # production build to dist/
npm run preview   # serve the dist/ build locally
npm run lint      # ESLint (flat config, eslint.config.js)
```

There is no frontend test runner configured.

### Backend (`backend/`)

```bash
python -m venv .venv && .venv\Scripts\activate   # Windows; use source .venv/bin/activate elsewhere
pip install -r requirements.txt

python -m uvicorn app.main:app --reload   # dev server at http://localhost:8000, docs at /docs

pytest                        # run all backend tests
pytest tests/test_slots.py    # single file
pytest tests/test_slots.py::test_basic_window_chopped_into_slots   # single test
```

Tests are plain unit tests (no `conftest.py`, no live DB/HTTP fixtures) — e.g. `tests/test_slots.py` builds `SimpleNamespace` stand-ins for ORM rows and calls service functions directly. Follow that pattern for new tests of pure logic rather than spinning up a DB session.

`backend/.env.example` documents every backend setting — check it before adding a new one.

## Backend architecture

`backend/app/main.py` wires CORS, four routers (`auth`, `public`, `admin`, `google_calendar`), a static `/uploads` mount, and a `lifespan` startup hook.

- **No Alembic.** Schema changes to *existing* tables are applied by hand-adding an entry to the `_TABLE_COLUMNS` dict in `main.py` (table → `{column: SQL type}`), which runs `ALTER TABLE ... ADD COLUMN` for any column missing on an existing DB. New tables need no entry — `create_all` handles those. Forgetting this step means the column exists in `models.py` but never appears in anyone's actual database.
- Two background `asyncio` loops run conditionally on settings flags: Instagram sync (every 24h, if `IG_AUTO_SYNC`) and appointment reminders (hourly, if `NOTIFICATIONS_ENABLED`).
- Always read config through `get_settings()` (`app/config.py`), never `os.environ` directly — comma-separated vars like `CORS_ORIGINS`/`ALLOWED_ADMIN_EMAILS` only get parsed into lists on that object (`cors_origins_list`, etc.).

### Auth model

Two independent trust boundaries, both in `app/auth.py`:
- `verify_google_credential` — verifies a Google ID token against `GOOGLE_CLIENT_ID`, returns the verified email.
- `create_access_token` / `get_current_admin` — the app's own JWT (HS256, `SECRET_KEY`); `get_current_admin` re-checks the email against `allowed_admin_emails_list` on *every request*, not just at issuance, so removing an admin from the allowlist revokes existing tokens immediately.
- `DEV_AUTH_BYPASS=true` enables `/api/auth/dev-login` (admin JWT without Google). Dev-only, never production.
- Google Calendar sync (`app/routers/google_calendar.py`) is a **separate** OAuth flow (its own client secret, refresh token, and signed `state` JWT) — don't conflate it with the admin-login Google flow above.

### Domain flow

- `/api/slots` is computed on the fly, not stored (`services/slots.py::compute_day_slots` chops `AvailabilityRule` windows into fixed slots, subtracts `AvailabilityOverride`s and existing `Appointment`s).
- Patient self-service (`/gerenciar/{token}`) is anonymous, scoped only by a per-appointment random token — there is no patient login. Cancelling triggers the next waitlist entry for that specialty/day.
- Admin booking-policy settings (`AppSetting` rows, `services/settings.py`) override the env defaults at request time — check there before assuming a policy value comes from `.env`.

## Frontend architecture

`src/App.jsx` is the landing page itself (~900 lines, heavy Framer Motion scroll/parallax). `react-router-dom` only covers `/blog` and `/blog/:id`; everything else on `/` is a **state-driven overlay, not a route**:

- `adminScreen` state (`null | 'hub' | 'agenda' | 'blog'`) toggles admin panels as overlays, gated by `isAdminAuthed` (JWT presence in `localStorage`).
- The patient self-service view is triggered by reading a `?manage=<token>` query param on mount, not a route.
- `src/lib/api.js` is the only HTTP client (`api.get/post/patch/delete/upload`, throws `ApiError`) — route new backend calls through it instead of calling `fetch` directly.

### Images

Two image directories exist on purpose: `public/` (served as-is) and root-level `images/` (site content photos, referenced as `/images/...`). A custom Vite plugin (`rootImagesPlugin` in `vite.config.js`) serves `images/` in dev and copies it into `dist/images` on build — new content photos go in root `images/`, not `public/` or `src/assets/`.

### Styling

Tailwind is present but unused for color — the real design system is CSS custom properties in `src/index.css`: five `--palette-1..5` values are the only colors meant to be used anywhere, with every other token (`--bg`, `--text`, `--accent`, ...) derived from them via `color-mix()`. Change a `--palette-*` value rather than hardcoding a new color.

## Agent skills

### Issue tracker

Issues live as GitHub issues in `gabriellopeslemos/mulherViva`, managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default canonical labels (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout (`CONTEXT.md` + `docs/adr/` at the repo root, created lazily). See `docs/agents/domain.md`.
