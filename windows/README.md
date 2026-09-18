# windows/ — News Meva Windows launchers

Self-healing, one-click launchers for a fully offline Windows setup. The server
runs on **port 3003** (`http://localhost:3003`, `api/health` for a health
check).

## Files

| File | Purpose |
|------|---------|
| `Start Server.bat` | Entry point — double-click to start (see below). Hidden or visible window per `start-server.ps1 -Mode` |
| `Start Server Hidden.vbs` | Starts `Start Server.bat` with the console hidden (used by autostart) |
| `start-server.ps1` | **Self-healing launcher core.** Repairs the launcher files, creates `.env`, builds the bundles if needed, runs the firewall heal, starts the server + Caddy, verifies `api/health`, opens the browser |
| `start-server-core.ps1` | Auto-restart wrapper — keeps the Node server alive across crashes, watches the child, embeds the Caddy watchdog |
| `Stop Server.bat` | Stops the wrapper + server + Caddy |
| `Control Panel.bat` / `Control Panel.ps1` | Native launcher GUI — Start/Stop, health, autostart, Caddy status, database test URL, LAN addresses, tools, logs |
| `Install Autostart.bat` | Adds a Startup-folder shortcut so News Meva starts silently at login |
| `Remove Autostart.bat` | Removes the autostart shortcut |
| `Repair Launcher.bat` | Forces a launcher repair (equivalent to what every start does) |
| `firewall-heal.bat` | Idempotent firewall rule `NEWS MEVA 3003` on all profiles (LAN access) |
| `Create .env.bat` | Idempotent `backend/.env` generator (random JWT secret, PORT=3003) |
| `Clean Junk.bat` | Clears runtime junk/old temp files (safe, no user data) |
| `db-probe.js` | PostgreSQL connectivity probe used by the Control Panel/launcher diagnostics |
| `stop-app.ps1` | Kills only this app's processes (node/caddy) on port 3003 |

## How to run

```bat
:: 1. install Node.js LTS first (bundled offline: tools\node\node-v24.19.0-x64.msi)
:: 2. start
windows\Start Server.bat
::    - first run: installs deps (npm ci), builds, creates .env, opens browser
::    - later runs while running: just opens the browser
:: 3. stop
windows\Stop Server.bat
```

Everything else is optional tooling. First-time guidance: run
`windows\Control Panel.bat` for the guided panel (database URL, autostart,
LAN IP copy buttons).

## What each start does (idempotent)

1. Determines the repo root next to the scripts (no need to CD anywhere).
2. Self-repair: if a launcher file is missing/corrupt it restores the exact
   canonical payload embedded in `start-server.ps1`.
3. Creates `backend/.env` if missing (random `JWT_SECRET`, `PORT=3003`;
   `DATABASE_URL` only if you set it yourself).
4. `npm ci` + builds `backend` (tsc) and `frontend` (tsc -b && vite build)
   only when needed.
5. `firewall-heal.bat` — ensures `NEWS MEVA 3003` inbound rule on all profiles.
6. Starts `start-server-core.ps1` → node `backend/dist/index.js` (auto-restart
   on crash), plus the Caddy proxy (`proxy\caddy\caddy.exe`) when the config
   exists.
7. Polls `http://127.0.0.1:3003/api/health` until 200 (timeout 300 s), then
   opens the app in the default browser.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `3003` wrong / server fallback to 3002 | `backend/.env` has no `PORT=3003` — re-run `Create .env.bat` or add `PORT=3003` |
| Port already in use | `Stop Server.bat`, delete stale listeners: `Get-NetTCPConnection -LocalPort 3003` → kill PID |
| LAN users can't connect | Run `firewall-heal.bat` (needs admin / trusted-IP rule) — auto-run on every start |
| "Cannot GET /" | Frontend build missing — `cd frontend && npm run build` |

See root [README.md](../README.md) and [docs/SETUP-GUIDE-WINDOWS.md](../docs/SETUP-GUIDE-WINDOWS.md)
for the full install walkthrough.