# ubuntu/ — News Meva Ubuntu/Debian installer & launchers

**Ubuntu 20.04+ / Debian 11+** — automatic full install with systemd, or a
manual no-systemd launcher. Server runs on **port 3003**.

## Quick start (systemd — recommended)

```bash
git clone https://github.com/kuldeep7ke/newsmeva.git
cd newsmeva
sudo bash ubuntu/install.sh
```

This installs Node.js (offline bundled v24.19.0 if available, else NodeSource
20 LTS), installs npm deps, builds backend+frontend, creates
`backend/.env` (random JWT secret, `PORT=3003`), deploys to `/opt/newsmeva`,
installs the systemd service `newsmeva`, and opens **ufw port 3003**.

Then:

```bash
sudo systemctl status newsmeva          # must show active (running)
curl http://localhost:3003/api/health   # -> {"status":"ok",...}
```

Browser: `http://<server-ip>:3003` from any LAN machine.

## Using Supabase (optional)

Edit `/opt/newsmeva/backend/.env`:

```
DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
JWT_SECRET=<keep the generated one>
```

then `sudo systemctl restart newsmeva`.

## Manual (no systemd)

```bash
bash ubuntu/start.sh            # builds if needed, heals ufw 3003, starts hidden (auto-restart), waits for health, opens browser
bash ubuntu/stop.sh             # stops server + wrapper + Caddy
```

`--foreground` keeps the classic foreground log mode. `makeinfo`-style details
in [docs/SETUP-GUIDE-UBUNTU.md](../docs/SETUP-GUIDE-UBUNTU.md).

## Files

- `install.sh` — full installer (systemd + optional `.deb`-style offline node)
- `start.sh` / `stop.sh` — manual start/stop (daemon + auto-restart wrapper)
- `start-server-core.sh` — crash-restart wrapper used by both modes
- `newsmeva.service` — systemd unit (runs `start-server-core.sh`)
- `installer/` — offline packaging glue