# LAN setup: open the app from any office PC — one click

The server runs on one office PC (`windows\Start Server.bat`). Every other
machine on the LAN just needs a browser — nothing to install. `localhost`
always points to the machine you are on, so LAN machines must use the server's
**IP**, its **computer name**, or the friendly **`newsmeva`** name.

> Server IP used: `192.168.1.9` (server PC name: `newsmeva`) — change it in the
> scripts if the server's IP is different (it's the same IP everywhere below).

## On every LAN machine (recommended)

Copy one file to the PC and double-click:

- **Windows** — `Open App.bat` → opens the app in the browser (no admin, no setup)
- **Mac** — `Open App.command` → same (if macOS blocks it: right-click → Open)

The script opens `http://192.168.1.9:3002`. If the `newsmeva` hostname was
already added, it uses the friendlier `http://newsmeva` (no port needed —
the bundled Caddy proxy serves port 80).

## Zero-setup: use the server's computer name

Windows PCs on the same network usually resolve each other automatically.
Try typing this in any browser first — no script, no hosts edit:

```
http://newsmeva
```

(or `http://newsmeva:3002`). If that works you are done — skip everything else.

## Optional: friendly name `newsmeva` (once per machine)

- **Windows** — run `Add NewsMeva Hosts.bat` (click **Yes** on UAC) →
  afterwards `Open App.bat` and the browser URL use `http://newsmeva`
- **Mac** — run `Add NewsMeva Hosts.command` (enter your password)

> If you previously ran the script and it mapped the old `workstation` name,
> re-run it once — it cleans up the old entry and replaces it with `newsmeva`.

## No setup at all

Just open any browser and type:

```
http://192.168.1.9
```

That always works via the Caddy proxy (port 80) — no script needed. The direct
app port `http://192.168.1.9:3002` also always works.

## Note for admins

- The server PC must be on and `windows\Start Server.bat` must be running
  (it heals the firewall rule automatically).
- Port 80 needs the bundled Caddy (`proxy\caddy\caddy.exe`); without it use
  the `:3002` URLs.
- If the server's IP changes (DHCP), re-run the hosts script on each machine —
  or just use the new IP in the browser. Reserving `192.168.1.9` for the
  server in the router avoids this entirely.
- Phones/tablets cannot use the `newsmeva` name (no hosts file) — use the
  IP or the computer name.
