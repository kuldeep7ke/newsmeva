# NEWS MEVA - Mini App Changes

## Overview
This document tracks changes to the News Meva Mini app — the offline-first newsroom task manager, teleprompter, and script editor that ships as an Android APK and as a static web app.

## Architecture (v2)
Replaced the old bundled-Node Android wrapper (NodeService + Kotlin control panel) with a **TodoMeva-style static offline-first web app + Capacitor 8 wrapper**:

- `miniapp/` — vanilla JS ES-module web app (no bundler). Served by Capacitor WebView, GitHub Pages, and Cloudflare Pages.
- `android/` — Capacitor wrapper (`com.newsmeva`, "News Meva Mini"), rebuilt from the Todomeva Capacitor 8 Android project.
- `scripts/build-web.cjs` — stages `miniapp/` → `www/` for Capacitor.
- AMIN deployment: `cap sync android` → `gradlew assembleDebug` → upload APK artifact.

## Web App Features
- **Landing page** — hero, feature cards (17-stage workflow, teleprompter, sync, import/export), News Meva on Computer showcase grid, 3-step how-it-works, tagline, footer.
- **Dashboard** — stat cards (open/due-today/overdue/completed), quick create, overdue/due-today/all-open sections.
- **Tasks** — filterable list (status, priority, search); 16-stage newsroom workflow (draft → … → published/completed), 33 task types, 6 footage types, category picker.
- **Teleprompter** — full-screen prompter: auto-scroll, speed −/+ (persisted), font size −/+ (persisted), mirror mode, text alignment (persisted), manual-scroll pause.
- **Scripts** — create/edit/delete scripts, word + char counts, "Prompt Now" launches teleprompter.
- **Recycle bin** — soft-deleted tasks, restore or purge forever (now reachable in sidebar).
- **Cloud sync (Tier 1)** — optional user-supplied Supabase project; `public.sync_docs` table with realtime push/pull (wire-up in `app.js`).
- **News Meva bridge (Tier 2)** — optional account login + pair-code, REST task sync, offline queue.
- **Backup** — full JSON export/import (all 5 tables).
- **Settings** — theme (light/dark), brand color (orange/blue/green), language (EN / MR / HI).
- **i18n** — full Marathi + Hindi translations.

## Deploys
- **GitHub Pages** — `pages.yml` static-copy build → `kuldeep7ke.github.io/newsmeva/`.
- **Cloudflare Pages** — `deploy-cloudflare.yml` (wrangler-action, project `newsmeva`), gated on `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` secrets.
- **Android APK** — `build-android-apk.yml` (npm ci → npm run build → cap sync android → gradlew assembleDebug → artifact).

## Visual Design
Adopted the TodoMeva design language: warm Flat-UI palette (`--bg #f7f3ee`, `--accent #f97316`, etc.), 22px radii, 3-column task cards (status circle · content · priority badge), sidebar with Views/Sync/More sections + pinned Settings/About, top-level pill buttons, soft cards.

## Recent Fixes
- `getByUuid()` added to `db.js` (supabase pull + realtime now work).
- Cloud Push / Pull / Disconnect buttons wired in `app.js`.
- Recycle Bin added to sidebar navigation.
- Teleprompter settings persist to localStorage.
- Task modal receives templates (template quick-fill no longer dead code).

## Build (manual)
```
npm install          # Capacitor deps at repo root
npm run build        # miniapp/ → www/
npx cap sync android # push www/ into android/app/src/main/assets/public
cd android && ./gradlew assembleDebug
```
APK output: `android/app/build/outputs/apk/debug/app-debug.apk`.