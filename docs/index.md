# News Meva — Documentation Index

Everything you need to install, run, administer, and develop **News Meva** —
the Marathi newsroom suite. The single most important file is the
**Memory Capsule** (developer memory / replication guide).

## Start here

| Doc | Read this when... |
|-----|-------------------|
| [MEMORY-CAPSULE.md](MEMORY-CAPSULE.md) | You need the *whole picture*: build & run chain, architecture, DB model, auth, roles, key APIs, verification (262/0), troubleshooting playbook |
| [../README.md](../README.md) | You want a fast end-user start (per-OS quick start, features, LAN access) |

## Setup & install

| Doc | Read this when... |
|-----|-------------------|
| [SETUP-SUPABASE.md](SETUP-SUPABASE.md) | Creating your free Supabase project + connection string (~5 min) |
| [SETUP-GUIDE-WINDOWS.md](SETUP-GUIDE-WINDOWS.md) | Full Windows 10/11 install (incl. NSIS `.exe` build, §12) |
| [SETUP-GUIDE-UBUNTU.md](SETUP-GUIDE-UBUNTU.md) | Full Ubuntu/Debian install (systemd) |
| [SETUP-GUIDE-RHEL.md](SETUP-GUIDE-RHEL.md) | Full RHEL/CentOS/Rocky/AlmaLinux/Fedora install (systemd) |

## Feature guides

| Doc | Read this when... |
|-----|-------------------|
| [GUIDE-TELEPROMPTER.md](GUIDE-TELEPROMPTER.md) | Using / understanding the studio teleprompter (web + MobileApp) |
| [GUIDE-ADMIN-SETTINGS.md](GUIDE-ADMIN-SETTINGS.md) | Admin settings, database connections, fresh-start reset, settings as the source of truth for URLs |
| [GUIDE-BACKUPS.md](GUIDE-BACKUPS.md) | Backups, snapshots, restore, research data, storage stats |

## Deep reference & history

| Doc | Read this when... |
|-----|-------------------|
| [from-scratch.md](from-scratch.md) | You want the full end-to-end blueprint of how the app is built |
| [ANNOUNCEMENTS.md](ANNOUNCEMENTS.md) | You want to publish Mini banner / broadcast announcements (jsonbin feed) |
| [RESEARCH-REPORT-2026-08-11.md](RESEARCH-REPORT-2026-08-11.md) | You want the baseline security & workflow research snapshot |

## Port & health cheatsheet

- Server: **port 3003** — health `GET http://localhost:3003/api/health`
- LAN: `http://<server-ip>:3003` · friendly `http://newsmeva` (Caddy port 80)
- Dev frontend: Vite on `:5173` proxies `/api` → `:3003`
- Feature suite: 262 PASS / 0 FAIL (see MEMORY-CAPSULE §9)

## Contributing style

Docs are written to stay **accurate to the current repo state**. When you
change ports, table names, endpoints, or installers, update the matching docs
in the same commit (the recipe commands in guides/capsule must be copy-paste
truish; any drift between docs and code is treated as a bug).