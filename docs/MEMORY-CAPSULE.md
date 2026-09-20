# NewsMeva — Memory Capsule

> The complete developer memory for the **NewsMeva** TV-newsroom suite: how to
> build and run the whole stack, the architecture map, database model, auth
> flow, roles, key APIs, verified state, and a troubleshooting playbook.
>
> Treat this as the single source of truth for replicating, debugging, or
> continuing the project — even without the original developer.
>
> **No secrets live in this file.** Credentials stay in `backend/.env`
> (git-ignored). All verified-state claims below were re-checked against the
> current code on this machine.

- **Version note:** this edition replaces the older "WorkStation Online"
  capsule. The stack was re-verified on 2026-09-18 against a clean
  PostgreSQL-less (local SQLite) database with the API feature suite:
  **262 PASS / 0 FAIL** (see [§7 Verification](#7-verification)).

---

## Table of Contents

1. [What This Is](#1-what-this-is)
2. [Command Chain — Run the Whole Stack](#2-command-chain--run-the-whole-stack)
3. [Architecture Map](#3-architecture-map)
4. [Database Model](#4-database-model)
5. [Auth Flow](#5-auth-flow)
6. [Roles & Access Levels](#6-roles--access-levels)
7. [Key APIs](#7-key-apis)
8. [Teleprompter Flow](#8-teleprompter-flow)
9. [Verification (proven 262/0)](#9-verification-proven-2620)
10. [Troubleshooting Playbook](#10-troubleshooting-playbook)
11. [Changelog / Version History](#11-changelog--version-history)

---

## 1. What This Is

**NewsMeva** (internally still `workstation-meva-*` in npm names) is a complete
Marathi TV-newsroom management suite. It ships as a web app over LAN (or cloud)
with an offline-first sync engine.

| Layer | Technology |
|-------|-----------|
| Backend | Node 18+ / Express 4 / TypeScript, Socket.IO, JWT (jsonwebtoken), bcryptjs, `pg` |
| Frontend | React SPA (Vite), Socket.IO client, utility-class CSS (Tailwind-style), recharts |
| Database | Dual-mode: **SQLite via sql.js** (`backend/workstation.db`) by default, **PostgreSQL** (Supabase pooler, port 6543) when `DATABASE_URL` is set |
| Sync | Mirror-to-PostgreSQL outbox engine (`backend/src/database/sync.ts`) |
| Miniapp | Plain static JS+HTML under `miniapp/` (no build step; also servable by the backend) — News Meva MobileApp pages |
| Repo | `https://github.com/kuldeep7ke/newsmeva.git` (branch `main`) |

### Verified running state (this workstation)

| Item | Value |
|------|-------|
| Server port | **3003** (read from `backend/.env` → `PORT=3003`) |
| Start command | `cd backend && npm run build && node dist/index.js` |
| Health probe | `GET /api/health` → `{"status":"ok",...}` |
| Frontend build | `cd frontend && npx tsc -b && npx vite build` → `frontend/dist` |
| Feature suite | `node C:\Users\Admin\AppData\Local\Temp\opencode\newsmeva-feature-test.js` → **262 PASS / 0 FAIL** |
| Git state | origin `main`, clean tree, 0/0 ahead/behind |

---

## 2. Command Chain — Run the Whole Stack

All of this was verified working on this machine. Dev flow is **two modules +
one server**, no Docker.

### 2.1 One-time / after code changes — build

```powershell
cd backend
npx tsc                                   # TypeScript -> backend/dist
cd ..\frontend
npx tsc -b                                # typecheck  (frontend build step 1)
npx vite build                            # -> frontend/dist (SPA assets)
```

Equivalently, the npm scripts:

```powershell
cd backend;  npm run build      # = tsc
cd frontend; npm run build      # = tsc -b && vite build
```

### 2.2 Start the server (productive build, port 3003)

```powershell
cd backend
node dist/index.js
```

or a single line from anywhere:

```powershell
pushd backend; npm run build; if ($?) { node dist/index.js }; popd
```

The port comes from `backend/.env` (`PORT=3003` on this machine). Every
installer/launcher writes `PORT=3003` into `.env`, so the effective dev/prod
port here is **3003**. (The in-code fallback behind it is
`process.env.PORT || '3002'` — real installs never hit it because `.env`
always pins 3003.)

### 2.3 Verify it is healthy

```powershell
curl http://localhost:3003/api/health    # {"status":"ok","timestamp":"..."}
curl http://127.0.0.1:3003/api/health    # same
```

### 2.4 Run the feature suite (262 checks, exit 0)

```powershell
node "C:\Users\Admin\AppData\Local\Temp\opencode\newsmeva-feature-test.js"
```

It targets `http://127.0.0.1:3003`, bootstraps its own admin/manager/reporter
accounts on whatever database the server is using, and prints one
`PASS | ...`/`FAIL | ...` line per check, ending with the total. A **fresh
database is expected** — it creates `feat_admin`, `Feature Manager` and
`Feature Reporter` accounts. See [§9](#9-verification-proven-2620).

### 2.5 One-click OS launchers (alternative to manual)

| OS | Start | Stop | Autostart |
|----|-------|------|-----------|
| Windows | `windows\Start Server.bat` | `windows\Stop Server.bat` | `windows\Install Autostart.bat` / `Remove Autostart.bat` |
| macOS | `mac/Start Server.command` | `mac/Stop Server.command` | `mac/Install AutoStart.command` / `Remove AutoStart.command` |
| Ubuntu/Debian | `bash ubuntu/start.sh` (manual) or `sudo bash ubuntu/install.sh` (systemd) | `ubuntu/stop.sh` / `systemctl stop newsmeva` | systemd via `install.sh` |
| RHEL family | `bash redhat/start.sh` (manual) or `sudo bash redhat/install.sh` (systemd) | `redhat/stop.sh` / `systemctl stop newsmeva` | systemd via `install.sh` |

The launchers are **idempotent**: re-running them while the server is up just
re-opens the browser. They also heal the firewall rule, auto-start Caddy (when
the binary/config exist), create `.env` on first run, and (Windows) self-repair
the launcher files.

---

## 3. Architecture Map

```
Browser (PC / phone / Android wrapper)
    │  HTTP :3003 (API + built SPA)   +   WebSocket (Socket.IO realtime)
    ▼
Express + Socket.IO server  backend/ (TS -> dist/, node dist/index.js)
    │
    ├─── SQLite mirror (sql.js, workstation.db)   ← local, always used
    │         └ sync_outbox + sync_log + 5s PG-health monitor
    └─── PostgreSQL (Supabase pooler :6543)        ← online source of truth
               activates only when DATABASE_URL is set
```

### 3.1 Backend (`backend/src`)

```
index.ts                app boot: health, static SPA, route mounts, error mapping
socket.ts               Socket.IO realtime init + event emit helper
config/
  roles.ts              RoleDefinition + SEAT_LIMITS (roles.json-ish, in TS)
  devCredentials.ts     built-in developer login (dev-admin, file-based, bcrypt)
database/
  schema.ts             DDL for BOTH engines: PG_TABLES + SQLite createTables(),
                        runMigrations(), initDatabase(), dual-path prepare()
  postgres.ts           PG pool adapter + convertSyntax() SQL translation
  sync.ts               mirror-to-PostgreSQL sync engine (outbox, replay, bootstrap)
  seed.ts               seedDefaultBulletinTemplates()/seedPostgresDefaults()
middleware/
  auth.ts               authenticate, authorize(...levels), authorizeDev,
                        authorizeAdminOrDev, generateToken, getJwtSecret
  rateLimit.ts          in-memory rate limiter (login/signup/pinlog/tokenlogin)
monitor/                initMonitor (health/telemetry monitoring hook)
routes/
  auth.ts notifications.ts   pendingRequests.ts   telemetry.ts
  users.ts roles.ts          profiles.ts          pins (in profiles.ts)
  tasks.ts stories.ts        bulletins.ts         bulletinTemplates.ts
  ads.ts programs.ts         archives.ts          locations.ts
  reporters.ts leaves.ts     news.ts              analytics.ts
  activity.ts backups.ts     settings.ts          sync.ts
  channelMetadata.ts         developer.ts
utils/                  helpers (dbAdmin, asyncErrors, dates..., etc.)
scripts/                ad-hoc dev tools (reset-db, drop-tables, ...) - dev-only
```

Route mounts in `index.ts` (all `/api/*`):

```
/api/auth /api/users /api/tasks /api/bulletins /api/ads /api/programs
/api/analytics /api/roles /api/bulletin-templates /api/notifications
/api/developer /api/stories /api/reporters /api/archives /api/locations
/api/channel-metadata /api/profiles /api/activity /api/leaves
/api/pending-requests /api/settings /api/backups /api/news /api/sync /api/telemetry
```

### 3.2 Frontend (`frontend/src`)

```
App.tsx, main.tsx, index.css, mobile.css
components/   Layout, OfflineBanner, SplashLoader, Skeleton+, PageSkeletons,
              DatabasePanels (SyncStatusPanel/DatabaseConnection/DatabaseStatePanel),
              NotificationBell, ToastContext, dialogs...
context/      auth, dialog, toast contexts
lib/          api client + telemetry hooks
utils/        api-conventions, dates (timezone-safe parse), teleprompter helpers
pages/        Dashboard, Tasks, TaskDetail, Stories, Bulletins, Programs, Ads,
              Archive, RecycleBin, Published, Analytics, Activity, Notifications,
              Backups, Teleprompter, TeleprompterList, ScriptEditor, Reporples→Reporters,
              Locations, Leaves, Users, PinManagement, Profile, Settings, Developer,
              NewsArticles, Login, SignUp, Onboarding, Landing, About, FAQ, Contact,
              Privacy, Terms, NotFound, MobileApp
```

Pages visible in the nav today: Dashboard, Tasks, Stories, Program Reporter,
Ads, Archives, Analytics, Notifications, Activity, Settings, Users/profiles,
Backups, Teleprompter, Pending Requests, Leaves, Locations, Reporters,
Developer utilities, auth screens.

### 3.3 Miniapp — News Meva MobileApp (`miniapp/`)

Plain static `index.html` + `js/*.js` + `css/` — **no build step**; the backend
can serve the folder, and it also ships to Cloudflare/GitHub Pages + Android
APK. MobileApp pages: Broadcast, Tasks, Microphone Timer, Teleprompter,
Crossfire/Programs, Archives, Stories (list + teleprompter), News Articles,
Ads, Reporters, Leaves, Notifications, Locations, Workload, Analytics.

**Single-source announcements client.** `miniapp/js/broadcast.js` is the one
file that serves **all three deploy targets**: GitHub Pages (build copies
`miniapp/` → `public/`), Cloudflare Pages (deploys `miniapp/` directly), and
the Android APK (Capacitor `www/` is built from `miniapp/`). No per-target code
copies — a fix in that file propagates everywhere. See `docs/ANNOUNCEMENTS.md`.

**Gated banner overlay.** The banner overlay/skeleton is mounted **only after a
request confirms a valid, in-period, device-matching broadcast exists**
(`maybeShowBanner()` → `isWithinPeriod` + `matchesDevice`). An expired/hidden
bin therefore paints **no loading flash and no overlay** on hard reload (the
broadcast pill still works). A valid in-period banner appears **directly** with
a skeleton placeholder in the content slot that swaps for the real content
once ready.

### 3.4 Auxiliary folders

```
proxy/      Caddyfile (:80 -> 127.0.0.1:3003) + Start/Stop Caddy.bat + caddy.exe (bundled Windows)
lan/        Open App / Add NewsMeva Hosts helpers (http://newsmeva:3003) + README
ubuntu/     install.sh (systemd) + start.sh + stop.sh + start-server-core.sh + newsmeva.service
redhat/     same for RHEL family (firewalld instead of ufw)
mac/        .command launchers + auto-start (LaunchAgent) + start-server-core.sh
windows/    Start/Stop Server.bat, Control Panel (.bat/.ps1), start-server.ps1 +
            start-server-core.ps1 (self-healing launcher pair), firewall-heal.bat,
            Create .env.bat, Clean Junk.bat, Install/Remove Autostart.bat, Repair Launcher.bat
functions/  Cloudflare Pages Function  api/announcements.js (edge-cached jsonbin feed)
android/    Capacitor wrapper (com.newsmeva) for the Mini APK
tools/node/ Bundled Node.js v24.19.0 installers (offline installs)
installer/  NSIS source (newsmeva.nsi) + .deb build tooling
docs/       This capsule + README-index + all guides (see docs/index.md)
```

---

## 4. Database Model

### 4.1 Dual-mode

- **Mirror is always initialized**, even in PG mode (`workstation.db`, sql.js).
- With `DATABASE_URL` set → PG mode: `initDatabase()` connects, reconciles the
  schema, seeds, then boots; every write is dual: mirror first → outbox row →
  PG (fire-and-forget). Reads go to PG with mirror fallback.
- Without `DATABASE_URL` (this machine's default `.env` has it empty) → SQLite
  mode: the mirror **is** the database; the outbox queue simply stays empty
  (`applied_pg` never matters).
- If PG init fails at boot the server still starts **offline on the mirror** —
  the app never refuses to serve because PostgreSQL is unreachable.

### 4.2 Tables (30 public, auto-created)

`users, profiles, tasks, task_news_items, task_extensions, task_collaborators,
task_audit_log, anchor_tasks, video_editor_tasks, stories, story_activities,
bulletins, bulletin_templates, user_bulletin_defaults, system_bulletin_defaults,
ads, archives, locations, reporters, leaves, notifications, activity_logs,
system_activity, login_attempts, channel_metadata, backup_config, backups,
telemetry_errors, user_activity, special_programs`

Plus engine tables: `sync_outbox`, `sync_log`, `sqlite_sequence`.

### 4.3 Schema highlights

- **`tasks.trashed_from_status`** — stores the status a task was in before it
  was trashed, so un-trashing restores the previous workflow position
  (migration in `runMigrations()` + `ALTER TABLE ... ADD COLUMN` fallback).
- **17-status constraint** (`tasks_status_check`) must contain `prompting`:
  `draft, script_writing, footage_collection, waiting_confirmation,
  correction_required, approved, editor_assigned, teleprompter_ready, prompting,
  recording_done, editing, uploading, published, under_review, completed,
  cancelled, trashed`.
- **Dynamic INSERT ordering** for `anchor_tasks` / `video_editor_tasks` /
  `locations`: the per-table insert columns are built from the actual schema at
  runtime (see `schema.ts` `insertForTable`-style helpers), not hardcoded — any
  new column automatically participates in outbox replay without SQL drift.
- **Seeds** (only on an empty table): 10 hourly `bulletin_templates`
  (Good Morning 07:00 → Top 24 Headlines 16:00), 1 `channel_metadata`,
  1 `backup_config`.
- **PG schema reconciliation** — `initDatabase()` runs idempotent
  `ALTER TABLE ... ADD COLUMN IF NOT EXISTS "<col>" <type>` for every canonical
  table on startup, so live Supabase tables created by older releases pick up
  new columns automatically (fix for the `ads.brand_type` class of bugs).

### 4.4 Mirror → PostgreSQL sync engine (`database/sync.ts`)

- **Write path:** `prepare(SQL)` returns a `SyncStatement`. `.run()`:
  1. outbox INSERT (`sync_outbox`, `applied_mirror=0, applied_pg=0`),
  2. run on mirror → mark `applied_mirror=1`,
  3. fire-and-forget run on PG → mark `applied_pg=1` (+ `synced_at`), failures
     store `pg_error` and stay `applied_pg=0` for retry.
- **Replay:** `replayPending(force)` selects `applied_pg = 0` ordered by id.
  Non-forced retries respect a **60 s backoff per outbox row**
  (`lastAttemptAt` + `RETRY_BACKOFF_MS`). `POST /api/sync/replay` forces a run.
- **Bootstrap:** `bootstrapMirror()` copies every PG table into the mirror with
  `INSERT OR REPLACE` (idempotent vs seeded defaults) and re-aligns sequences,
  guarded by a `bootstrapped` flag + empty-key-tables check.
- **Health monitor:** pings PG every 5 s; offline→online runs replay + bootstrap;
  steady-online also re-replays (self-heals the mirror after a DB reset).
  Emits Socket.IO `db:online / db:offline / db:status / db:synced` — `synced`
  only when `synced > 0` and at most once per 60 s per failing outbox entry
  (prevents the offline-banner reload loop).
- **Persist discipline:** bulk ops disable sql.js persist
  (`setPersist(false)`) and **must** call `flush()` after re-enabling — a stale
  disk file "resurrects" deleted data on restart.
- **Engine-internal statements never replicate** — bootstrap/replay/outbox SQL
  bypasses the dual path (only user-route writes create outbox rows).
- **API:** `GET /api/sync/status` (any authenticated) → `{mode, engine, online,
  queuePending, syncedWrites, failedWrites, lastSyncAt, lastError, ...}`;
  `POST /api/sync/replay` (admin).

> Not in git: `backend/workstation.db`, `backend/.env`,
> `backend/saved-connections.json`, `backend/.dev-credentials`, `server.log`,
> `telemetry/`, `backups/`, `*.pem`, `data-snapshots/`.

---

## 5. Auth Flow

### 5.1 Token-only quick-login (no plaintext passwords anywhere)

- Passwords are **only ever stored as bcrypt hashes** (in `users.password_hash`
  with a salt; dev credentials in `backend/.dev-credentials`). No plaintext is
  written to disk or sent besides the single login request over HTTP.
- Login returns a **JWT** generated from `JWT_SECRET` (see below). The token
  carries `{ id, username, profile_id, full_name, access_level, role }` and the
  `Authorization: Bearer <token>` header is required on every API call.
- **Quick-login endpoint:** `POST /api/auth/login-with-token` (rate-limited,
  10/5 min) — lets a user in with a one-time/generated token (used by the
  MobileApp and quick switch flows). `POST /api/auth/login-with-pin` is the
  PIN flow. `POST /api/auth/onboard` completes first-time setup after auth.

### 5.2 JWT secret rotation

- The secret lives in `backend/.env` (`JWT_SECRET=...`, random 64-hex);
  `getJwtSecret()` (middleware/auth.ts) refuses weak values and prioritizes the
  env var. All installers + `Create .env.bat`/`create-env.sh` auto-generate it
  on first run.
- **Rotation:** set a new `JWT_SECRET`, restart the server; all old tokens
  become invalid immediately (sign out everywhere). If a secret ever leaks
  (committed to git history, shared, etc.), **rotate it and reset Supabase
  passwords** — history keeps old values forever.

### 5.3 First signup → admin; later signups → pending

- First account created through `POST /api/auth/signup` becomes
  `access_level 1` (admin) automatically.
- Any later signup stays **pending** until an admin approves it
  (`PUT /api/auth/approve-signup/:profileId`). Dashboard → Pending Signups.
- Seat limits per role (`SEAT_LIMITS` in config/roles.ts) cap active seats;
  deactivating a user frees a seat.

### 5.4 Built-in developer login (deliberately NOT admin)

- `dev-admin` / `Dev@Meva2026` (default; change it from Developer page → Dev
  Account). File-based (`backend/.dev-credentials`, bcrypt) so it works even
  when the database is missing/corrupt.
- Its token carries `access_level: 3` + `is_dev: true` → it can open the
  Developer page, Backups tab, `clean-all-data`, `fix-db`, but CANNOT manage
  users, change Settings, or touch the Backups → Database tab
  (`authorizeAdminOrDev` still lets it use backups routes). Do not raise its
  level.

### 5.5 Onboard / PIN

- `POST /api/auth/onboard` — completes the profile the first time a user signs
  in (name, role hints).
- PIN flow per profile: set/verify/request/delete; works with or without a full
  password. UI path: Profile → PIN management (`pages/PinManagement.tsx`) and
  `POST /api/auth/login-with-pin`.

---

## 6. Roles & Access Levels

`access_level` is the authorization key on the backend (`authorize(...levels)`):

| Level | Meaning | Built-in roles at this level |
|-------|---------|------------------------------|
| 1 | **admin** | `admin` |
| 2 | **manager / executive editor** | `executive_editor`, `manager` |
| 3 | **staff / reporter / editor / anchor** | `anchor`, `video_editor`, `reporter`, `social_media`, `input_desk`, `output_desk`, `advertise`, `editorial`, `vo_artist`, `marketing`, `general`, `accounting`, `hr` |

Rule of thumb used by guards:

- `access_level <= 1` → admin-only screens (Backups → Database tab, Settings
  admin cards, Users management, clean-all-data).
- `access_level <= 2` → manager+ (task auto-manage, archive stock/scan/import,
  sync replay, reassign).
- Everybody else (`3`) → normal staff work: create/edit their own task fields,
  teleprompter, news items, stories pipeline, leaves, etc.
- `authorizeDev` / `authorizeAdminOrDev` → backups + developer routes.
- `is_dev` tokens count as staff (level 3) for everything except the
  dev/backups facets above.

---

## 7. Key APIs

Common conventions:

- **Auth:** `Authorization: Bearer <jwt>` (except `/api/health`).
- **Create endpoints** for program/story/task/location/reporter/archive return
  **201**; mutations return JSON; errors map from PG codes (`22P02`→400,
  `23505`→409, `23503`/`23514`→409, `28P01`→401, `42501`→403, `57014`→503).
- Archives/stock use `name` (not `title`); task news items use `news_script`.

The routes below are the ones most referenced by the guides; a grep of
`backend/src/routes/*.ts` is the authoritative list.

### Auth & users

| Endpoint | Notes |
|----------|-------|
| `POST /api/auth/login` | rate-limited 10/5 min |
| `POST /api/auth/signup` | rate-limited 5/15 min; first → admin |
| `POST /api/auth/login-with-pin` / `login-with-token` | quick logins |
| `POST /api/auth/onboard` | post-login profile completion |
| `PUT /api/auth/me/profile` · `POST /api/auth/change-password` | profile mgmt |
| `GET /api/auth/me` | current user |
| `GET /api/users` · `POST /api/users` · `PUT /api/users/:id` | user admin |
| `GET /api/users/:staffId/workload` | workload endpoint |
| `GET /api/roles` | `ROLES` definitions + seat limits |

### Tasks & workflow

| Endpoint | Notes |
|----------|-------|
| `GET /api/tasks` · `POST /api/tasks` · `PUT /api/tasks/:id` | full CRUD |
| `GET /api/tasks/trashed` · `DELETE /api/tasks/:id/permanent` · `POST /api/tasks/empty-trash` | recycle bin (empty-trash returns 404 when already empty) |
| `PUT /api/tasks/:id/auto-approve` | **PUT**, requires `priority:'urgent'` else 400 |
| `POST /api/tasks/:id/reassign` | admin only |
| `PUT /api/tasks/:id/assign-editor` | auto-picks best video editor (awaited!) |
| `POST /api/tasks/:id/extend-deadline` · `GET /api/tasks/:id/extensions` | deadline flow |
| News items: `GET/POST /api/tasks/:id/news-items`, `PUT/DELETE /api/tasks/:id/news-items/:itemId` | anchor/reporter/footage per item |
| `PUT /api/tasks/:id/anchor` · `PUT /api/tasks/:id/editor` | assignment |
| `GET /api/tasks/:id/activity` · `GET /api/tasks/:id/detect-reuse` | audit + reuse |

### Stories

`GET/POST /api/stories` · `GET/PUT/DELETE /api/stories/:id` —
chain `data_gathering → script_writing → plotting → add_ons → confirmation`,
then `POST /api/stories/:id/confirm { approved: true }`; confirmed → one-click
send-to-tasks returns a task id.

### Teleprompter

| Endpoint | Notes |
|----------|-------|
| `GET /api/tasks/teleprompter/ready` | public (no auth) list |
| `GET /api/tasks/teleprompter/script/:id` | public script read |
| `GET /api/tasks/teleprompter/history` | history (signed users) |
| `POST /api/tasks/teleprompter/start/:id` | marks prompting started |
| `POST /api/tasks/teleprompter/finish/:id` | advances to `recording_done` (editor pick) |
| `GET /api/tasks/:id/teleprompter` | signed task prompter read |

### Backups, database & sync (admin)

| Endpoint | Notes |
|----------|-------|
| `GET /api/backups` · `POST /api/backups` · `PUT /api/backups/config` | snapshots + config (`mode: sqlite\|postgres`) |
| `PUT /api/backups/:id` · `DELETE /api/backups/:id` · `POST /api/backups/:id/restore` | restore/archive/edit notes |
| `POST /api/backups/fix-db` | dev-only repair |
| `GET /api/settings/database` · `POST /api/settings/database` | read/test connections |
| `POST /api/settings/database/saved` · `DELETE /api/settings/database/saved/:id` | saved connections (`saved-connections.json`) |
| `POST /api/settings/database/use` | switch to saved connection |
| `GET /api/settings/database/state` | live row counts + sync info |
| `POST /api/settings/database/reset` | wipe + reseed (admin, online only → else 503) |
| `GET /api/sync/status` | mode/engine/online/queue |
| `POST /api/sync/replay` | force sync (admin) |

### Archive (creator can edit; stock/scan/import are admin/manager-only)

| Endpoint | Notes |
|----------|-------|
| `GET /api/archives` · `POST /api/archives` | list + create (201) |
| `PUT /api/archives/:id` | **creator or any higher level** can edit entry fields (fixed) |
| `PUT /api/archives/:id/stock` | admin/manager only (`>2` → 403) |
| `POST /api/archives/scan-folder` · `POST /api/archives/import-selected` | admin/manager only |
| `DELETE /api/archives/:id` · `GET /api/archives/:id` | trash/read |

### Others

`/api/ads`, `/api/programs` (+ `/special` programs), `/api/bulletins`,
`/api/bulletin-templates`, `/api/news`, `/api/locations`, `/api/reporters`,
`/api/leaves`, `/api/notifications`, `/api/pending-requests`,
`/api/channel-metadata`, `/api/analytics`, `/api/activity`, `/api/telemetry`.

---

## 8. Teleprompter Flow

Two entry points: the web **Teleprompter** pages and the **MobileApp**
teleprompter. Both drive the same backend endpoints.

1. **Read-only public screens:** `GET /api/tasks/teleprompter/ready` +
   `GET /api/tasks/teleprompter/script/:id` need **no login** — these are the
   "studio screen" endpoints (menu entry shows only for admin/video-editor/
   anchor; signed-out visitors stay on the landing page).
2. **Start prompting:** the anchor opens the task, clicks “Prompt Now” →
   `POST /api/tasks/teleprompter/start/:id` (marks `teleprompter_ready` →
   `prompting`).
3. **Prompt:** velocity-controlled reading screen. Controls: wheel/↑/W speed up
   (+0.5), wheel/↓/S slow → zero → smooth reverse (negative values), space
   play/pause, middle-click reset, Shift+wheel free-move (auto-scroll resumes
   after 1.5s), PgUp/PgDn jump, ←/→ font size, R top, M mirror, Esc pause/close.
   Speed range **-10…+10**; bottom parks at **-3.0 ◀** (instant reverse; “Script
   Ended” popup appears after a dwell unless you reverse away), top parks at
   **+3.0 ▶**.
4. **Finish:** `POST /api/tasks/teleprompter/finish/:id` advances the task to
   `recording_done` and hands it to the editor.
5. Custom scripts (list page → New Script) are stored device-local in
   `localStorage` (`tp_custom_scripts`, `is_task:false`) — no API call, no
   start/finish posts.

Web UI: **Teleprompter** in the sidebar → list → open. MobileApp: Broadcast /
Tasks → Teleprompter.

---

## 9. Verification (proven 262/0)

On a **fresh database** (this machine: local SQLite mode, or a reset Supabase
DB — the suite re-provisions its own users):

```powershell
node "C:\Users\Admin\AppData\Local\Temp\opencode\newsmeva-feature-test.js"
```

- **Result: 262 PASS / 0 FAIL, exit code 0** (re-verified on this machine
  against the running server at `http://127.0.0.1:3003`).
- Covers: health, signup→auto-admin, manager/reporter provisioning, login
  (username + PIN + token), roles, bulletin templates, locations, archives
  (incl. the level-3 creator-edit + stock/scan/import 403 matrix), reporters,
  programs, ads, bulletins, tasks (full lifecycle + teleprompter + news items +
  trash), stories state machine, leaves, news correction, channel metadata,
  notifications, pending requests, analytics, activity, settings, backups,
  sync, telemetry, and the permission/access matrix.
- The suite treats a **non-fresh DB** as environment error (it asserts fresh
  signups). Run it against a clean/reset database; afterwards reset again with
  `POST /api/settings/database/reset` if you started from real data.

### Why 262 and not “all green forever”

26 previously-failing items were fixed/classified before this run reached
262/0 — a server-side **archives** fix (creator may edit entry fields;
stock/scan/import admin/manager-only) plus feature-test flow corrections
(token provisioning, ordering, expected status codes).

---

## 10. Troubleshooting Playbook

| Symptom | Cause | Fix |
|---------|-------|-----|
| **HTTP 429 on login/signup/PIN** | In-memory rate limiter tripped (`max: 10` login in 5 min, `5` signups in 15 min, `10` PIN/token logins in 5 min) | Wait out the window (or restart the server — the limiter is in-memory). Scripts: pace login attempts ≥ 30s apart |
| **404 when serving trash, empty-trash, permanent-bulk** | The trash is already empty — 404 is the *expected* answer from these endpoints after the last item is gone | Treat `404` as success; do not paginate into a phantom page |
| **401 / 403 for a valid-looking user** | Wrong/expired `JWT_SECRET` (tokens invalid after rotation/restart) or a `TokenExpiredError`; dev token hitting admin gates; level-3 user on an admin endpoint | Re-login with a fresh token; check `backend/.env` secret stability; check `access_level` vs `authorize(...)` targets |
| **Server not on 3003** | `.env` `PORT` differs, or the server was started without `.env` (falls back to 3002) | `Get-Content backend\.env` → `PORT=3003`; restart; health = `http://localhost:3003/api/health` |
| **SQLite vs PostgreSQL confusion** | `DATABASE_URL` present = PG mode; empty = local SQLite; PG failures fall back to offline mirror | `GET /api/sync/status` → read `mode`/`engine`; wipe `DATABASE_URL` for pure-local testing |
| **`42601 syntax error`** | `convertSyntax()` missed a SQLite construct or a stray `;` sat before `RETURNING id` | Fix SQL, no trailing `;`; add the pattern to `postgres.ts` |
| **`22P02` / `{}` value** | Object/Promise passed where a scalar belongs (missing `await` on `findBestVideoEditor()` etc.) | `await` the call, pass a number |
| **Mirror “resurrects” deleted rows** | Bulk op skipped `flush()` after `setPersist(true)` | Re-enable persist + `flush()` before finishing any bulk migration |
| **Queue never drains (`queuePending > 0`)** | PG column missing on the live table; row stuck with `pg_error` | Check `sync_log`/`pg_error`; PG schema now self-reconciles on boot — restart once, then `POST /api/sync/replay` |
| **`Port 3003 already in use`** | Another server instance / stale listener | `Stop Server.bat` (kill wrapper → node → caddy), or `Get-NetTCPConnection -LocalPort 3003` and kill the owner |
| **Browser shows “Cannot GET /” or 503 build page** | `frontend/dist` missing/stale | `cd frontend && npx tsc -b && npx vite build`; restart |
| **Failed frontend build** | `tsc -b` type errors | Fix types; `tsc -b` compiles whole-project references in order |
| **Feature suite exits nonzero** | Non-fresh DB, or a real regression | Reset DB (admin → Backups → Database → Clean for Fresh Start), re-run; if still failing, compare the failing check's expected status to the route |
| **LAN users can't connect** | Firewall, or Caddy proxying to the wrong port | Windows: `firewall-heal.bat` (rule `NEWS MEVA 3003`); Linux: ufw/firewalld for 3003; Caddyfile must target `127.0.0.1:3003` |

### Debugging quick tips

- Health check first: `curl http://localhost:3003/api/health`.
- Server log: `server.log` in the repo root (launcher writes `[launcher]`/`[core]`/`[caddy-watchdog]` lines).
- Boot diagnostics: `[db] Initializing in postgres mode` vs offline message.
- Unawaited `prepare()` ⇒ route returns `{}` ⇒ frontend white screen — search the newest route file.

---

## 11. Changelog / Version History

| Version | Note |
|---------|------|
| v3.2.0 | Current release. News Meva Mini + announcements feed + rebuilt installers + this docs restructure. App-internal `APP_VERSION` = `3.2.0` |
| v3.1.2 → v3.1.1 → v3.1.0 | Packaging-only bumps (immutable GitHub release lockout); mojibake + brand-name fixes |
| v3.0.0 | Rebrand to NEWS MEVA (`newsmeva` hostname/URLs), public-domain (Unlicense) beta |

**This restructure (2026-09-18):** rewrote the memory capsule, README, object
READMEs (`windows/ ubuntu/ redhat/ lan/ proxy/`), added docs index + three new
guides (Teleprompter / Admin Settings / Backups), modernized all OS
launchers/installers for port **3003**, and re-verified the whole stack with the
**262 PASS / 0 FAIL** feature suite against the live server.