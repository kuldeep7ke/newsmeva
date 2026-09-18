# proxy/ — News Meva optional reverse proxy (Caddy)

A thin, optional HTTP reverse proxy in front of the News Meva server.

- Serves the app on **port 80** → `http://<server-ip>` (no port in the browser)
- Proxies through to the News Meva server on **port 3003**
- Gzip + Zstandard compression

**Config:** `caddy/Caddyfile`

```caddy
:80 {
    encode gzip zstd
    reverse_proxy 127.0.0.1:3003
}
```

## Windows (uses the bundled Caddy binary)

```bat
:: start (idempotent — leaves it running if already up)
proxy\Start Caddy.bat
:: stop (also runs automatically after Stop Server.bat)
proxy\Stop Caddy.bat
```

`Stop Caddy.bat` is invoked automatically by `windows\Stop Server.bat` and the
Windows launchers start Caddy automatically when `proxy\caddy\caddy.exe` +
`proxy\caddy\Caddyfile` exist.

## macOS / Linux

Install Caddy (`brew install caddy` / snap / dnf), then
`caddy run --config proxy/caddy/Caddyfile` — the macOS and cross-platform
launchers auto-start it on boot when `Caddyfile` is present.

## Verify

```powershell
curl http://localhost/           # served by Caddy
curl http://localhost:3003/api/health   # proxied to the backend
```

> Everything is plain HTTP by default. For production on the public internet,
> put a TLS-terminating Caddy (real cert) in front instead — see the root
> README "Security Notes".