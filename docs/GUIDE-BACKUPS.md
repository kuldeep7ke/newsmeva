# Guide: Backups & Restore

The **Backups** page (sidebar) is the admin's data console. It has two tabs —
**Backups** (snapshots & restore) and **Database** (sync status, connections,
data actions) — plus **Research Data**.

> All endpoints need `Authorization: Bearer <JWT>` and run under
> `authorizeAdminOrDev` (admin + developer login).

## Backups tab (snapshots)

### Automatic snapshots

- On every meaningful work change the backend records a content-change event
  into an automatic backup snapshot (`saveManagedBackup('content_change', ...)`
  is called across task/archive flow).
- Snapshot type `'automatic'` captures the current state right after the
  change; `'manual'` snapshots are created on demand.

### API surface

| Endpoint | Purpose |
|----------|---------|
| `GET /api/backups` | List snapshots (with storage stats) |
| `POST /api/backups` | Create a manual snapshot now |
| `PUT /api/backups/config` | Auto-backup settings (on/off, type, age) |
| `GET /api/backups/config` | Current auto-backup config |
| `PUT /api/backups/:id` | Rename / edit notes / archive-keep-forever |
| `POST /api/backups/:id/restore` | Restore the app to this snapshot's state |
| `DELETE /api/backups/:id` | Delete one snapshot |
| `DELETE /api/backups` | Delete all snapshots |

### Restore workflow

1. Open **Backups → Backups tab**, pick a snapshot.
2. **Restore** applies it (online mode pulls/writes to Supabase; local mode
   regenerates the mirror).
3. Verify `GET /api/settings/database/state` row counts and the UI dashboard.

## Database tab (the data console)

- **Sync Status** — online/offline, engine, `queuePending`, last sync, **Sync
  Now** (`POST /api/sync/replay`).
- **Connection** — test / save / switch Supabase connection URLs
  (see [GUIDE-ADMIN-SETTINGS.md](GUIDE-ADMIN-SETTINGS.md)).
- **Database Data** — live row counts per table; **Clean for Fresh Start**
  (`POST /api/settings/clean-all-data`) to wipe and reseed.

> Wiping is always a manual, admin-only action. The app never auto-deletes a
> mirror you configured — restart with a *changed* `DATABASE_URL` keeps your
> old mirror file safe on disk.

## Research Data

- Automatically captures usage / workflow / glitch data (rolling ~90 days).
- One-click JSON report + CSV exports for analysing workloads, stages, anchors.

## Best practices

- Keep auto-backup **on**; announce in Release Notes when you change snapshot
  handling.
- Before a big reset (fresh-start handoff), create a **manual snapshot** so you
  can roll back.
- Test restore on a scratch copy before relying on it in production.
- Local (SQLite) mode: the mirror file is `backend/workstation.db` — back it up
  with the snapshots (the DB tab snapshots cover tables, not the file).