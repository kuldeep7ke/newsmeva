# Guide: Admin Settings & Database

Everything an admin touches beyond day-to-day tasks. Admin = first signup
(`access_level 1`) or a member the admin promoted to level 1/2.

> All endpoints require `Authorization: Bearer <JWT>`. "Admin" below means
> `authorizeAdminOrDev` (admins + developer login). User/global cleanups
> additionally require a real admin (`authorize(1)`).

## Where Settings lives

The **Settings** page in the sidebar:

- **Admin-only card** — app-level settings that become the source of truth for
  the UI (e.g. API base URL / contact links shown on login & landing pages).
- **Database card** — connection to Supabase (or none = local SQLite mode),
  saved connections, live test.
- **Backups page → Database tab** — the operational view: sync status, row
  counts, database data actions.

If a UI shows the wrong API URL on first load, it's this settings source —
fix/refresh it in Settings → Admin card.

## Database connections

The backend runs in one of two modes:

| Mode | When | Behave |
|------|------|--------|
| **Local (SQLite)** | `DATABASE_URL` empty/missing | Everything in `backend/workstation.db` (sql.js mirror). No external dependency; fit for a LAN office with no internet |
| **Supabase/PostgreSQL** | `DATABASE_URL` set | Schema reconciled on boot, writes mirrored to PG, outbox sync (`sync_outbox`) replays on reconnect |

### API surface (Settings page / Database card)

| Endpoint | Purpose |
|----------|---------|
| `GET /api/settings/database` | Current state (mode, env presence) |
| `POST /api/settings/database` | Set a live connection string (validated, tested) then switch to it |
| `POST /api/settings/database/env` | Write `DATABASE_URL` (and PORT if missing) into `backend/.env` |
| `POST /api/settings/database/test` | Test an arbitrary URL |
| `POST /api/settings/database/test-saved` | Test a saved connection by id |
| `GET /api/settings/database/saved` | List saved connections |
| `POST /api/settings/database/saved` | Save a connection (`saved-connections.json`) |
| `POST /api/settings/database/use` | Switch to a saved connection |
| `DELETE /api/settings/database/saved/:id` | Forget a saved connection |
| `GET /api/settings/database/state` | Live row counts per table + sync info |
| `POST /api/settings/database/reset` | Wipe + reseed (admin, online only — otherwise 503) |
| `POST /api/settings/clean-user-data` | Real admin: remove users/login data |
| `POST /api/settings/clean-all-data` | Real admin: full wipe → fresh start |

### Tying it together

1. Get a Supabase project + `DATABASE_URL` ([SETUP-SUPABASE.md](SETUP-SUPABASE.md)).
2. In the app: **Settings → Database** → paste URL → **Test** → **Save** →
   **Use**.
3. Watch **Backups → Database tab** go online; `GET /api/sync/status` shows
   `mode`, `engine`, `online`, queue counts.

## Fresh-start reset

Reset the whole database (admin only) when you want to hand a clean copy to a
new user:

- **Clean for Fresh Start** (`clean-all-data`): wipes tables and reseeds
  defaults for a blank template.

> Resets require an **online** connection in PG mode. Local SQLite mode: the
> mirror IS the DB, so a reset regenerates it on disk. Always run the 262-check
> feature suite on a mission-important instance afterward.

## Sync status (Backups → Database tab)

| Field | Meaning |
|-------|---------|
| `online` | PostgreSQL reachable |
| `queuePending` | Outbox rows waiting (`applied_pg = 0`) |
| `syncedWrites` / `failedWrites` | Replayed / blocked rows |
| `lastSyncAt` / `lastError` | Last successful replay / last error |

**Sync Now** → `POST /api/sync/replay`. If the queue never drains, restart once
(the PostgreSQL schema self-reconciles `ALTER TABLE ... ADD COLUMN IF NOT
EXISTS` on boot), then replay again.