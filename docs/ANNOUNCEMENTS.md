# Mini — Banner & Broadcast Announcements

The Mini app can display **broadcast pills** (persistent toasts) and a **promo
banner overlay** on every web page and inside the Android APK — pushed from a
single **jsonbin.io** bin that any authorized user can edit. Changes appear
within minutes, with **no app update or deploy**.

## Architecture

```
jsonbin.io bin (the CMS you edit)
        │  fetch /latest
        ▼
Cloudflare Pages Function  functions/api/announcements.js
        │  edge-cached 180 min (`TTL_MINUTES` in the function), CORS *, served at
        ▼
https://newsmeva.pages.dev/api/announcements?type=broadcast|banner
        │  fetched by miniapp/js/broadcast.js (no-store)
        ├─ Cloudflare Pages  (newsmeva.pages.dev)
        ├─ GitHub Pages      (kuldeep7ke.github.io/newsmeva)
        └─ Android APK       (same canonical proxy URL, hard-coded)
```

- The proxy URL is a **single constant** in `broadcast.js` — **not** derived from
  `location.origin` — so one canonical feed serves all three channels.
- If the proxy is unreachable, the app falls back to a direct jsonbin fetch.
- A 60 s poll + `visibilitychange` refresh keeps pills current (banner shows
  once per load with a 7 s countdown, then a close button).

## Bin shape (one bin holds BOTH)

```jsonc
{
  "broadcasts": [
    {
      "id": "b-1",
      "title": "Optional bold title",
      "message": "The text shown in the pill",
      "type": "info",            // info | warning | success | error
      "pinned": false,           // pinned => cannot be dismissed
      "expires": "2026-12-31T23:59:59Z",
      "link": "https://example.com",
      "targetId": null           // device id => show only on that device; null = everyone
    }
  ],
  "banner": {
    "id": "bn-1",
    "title": "Optional title",
    "content": "Banner body text",
    "image": "https://example.com/image.jpg",
    "href": "https://example.com",
    "width": 480,                // optional max-width px
    "startDate": "2026-12-01T00:00:00Z",
    "expires": "2026-12-31T23:59:59Z",
    "targetId": null
  }
}
```

Device targeting: open **Settings** inside the Mini to see this device's ID,
then set `targetId` on a record to show it only there. Without `targetId`, the
record shows everywhere.

## Configuration

There are two ways to wire the bin:

1. **Environment variable (recommended)** — set `ANNOUNCEMENTS_BIN_ID` (or
   `BROADCAST_BIN_ID`) on the Cloudflare Pages project **newsmeva**
   (Settings → Environment variables). The function then serves it; no code
   change needed.
2. **Baked into the client** — set `BAKED_BIN_ID` in
   `miniapp/js/broadcast.js` (obfuscated before committing). This also enables
   the direct-jsonbin fallback path.

Runtime overrides (for testing, in your browser's localStorage):
`newsMeva_broadcastBin` (bin id), `newsMeva_announcementsApi` (proxy URL),
`newsMeva_jsonbinBase` (jsonbin base URL).

While unconfigured, the endpoint returns `404 {"error":"bin-not-configured"}`
with CORS `*` — the app simply shows nothing.

## Managing

Edit the bin JSON at `https://jsonbin.io/b/<bin-id>` (any authorized account).
Writes appear after the edge-cache TTL (3 hours) or on next app poll.

## Files

- `functions/api/announcements.js` — Cloudflare Pages Function (edge-cached proxy)
- `miniapp/js/broadcast.js` — client fetch + pills + banner overlay
- `miniapp/js/i18n.js` — `bc_not_configured`, `bc_offline`, `bc_updated`,
  `bc_listening`, `bc_close`, `bc_banner` (EN / MR / HI)
- `miniapp/css/style.css` — `broadcast-holder`, `.bc-pill*`, `.banner-overlay*`

Reference implementation: Money Meva
`docs/ANNOUNCEMENTS-EDGE-PROXY-GUIDE.md`
(https://github.com/kuldeep7ke/moneymeva).