# NEWS MEVA - Mini App Changes

## Overview
Tracks changes to the News Meva Mini app — the offline-first news task manager, teleprompter, and script editor that ships as an Android APK and as a static web app (GitHub Pages + Cloudflare Pages).

## Architecture (v2)
Replaced the old bundled-Node Android wrapper (NodeService + Kotlin control panel) with a **TodoMeva-style static offline-first web app + Capacitor 8 wrapper**:

- `miniapp/` — vanilla JS ES-module web app (no bundler). Served by Capacitor WebView, GitHub Pages, and Cloudflare Pages.
- `android/` — Capacitor wrapper (`com.newsmeva`, "News Meva Mini"), rebuilt from the Todomeva Capacitor 8 Android project.
- `scripts/build-web.cjs` — stages `miniapp/` → `www/` for Capacitor.
- Ship path: `cap sync android` → `gradlew assembleDebug` → upload APK artifact.

## Web App Features
- **Landing page** — hero, feature cards, 3-step how-it-works, tagline, footer.
- **Dashboard** — stat cards (open/due-today/overdue/completed) with roomier spacing, quick create (title / task type / priority), overdue / due-today / all-open sections.
- **Tasks** — filterable list (priority, search); next-stage flow (`STATUS_STEPS`) on the card arrow. No status filter — the Mini doesn't follow the full 17-stage workflow.
- **Task form (simplified)** — **title, description, task type, priority** only. No multi-user fields (status, footage type, assigned to, category) — the Mini is a single-user app.
- **8 news task types** — News, Breaking, Special Report, Story, Press, Ground Report, Live, Event. Priorities: urgent / high / medium / low.
- **Teleprompter** — full-screen prompter: auto-scroll, speed −/+ (persisted), font size −/+ (persisted), mirror mode, text alignment (persisted), "Prompt Now" from scripts; **+ New Script** button on the list. Listed below Scripts in the sidebar.
- **Scripts** — create/edit/delete from the Teleprompter or Scripts view, word + char counts.
- **Recycle bin** — soft-deleted tasks, restore or purge forever.
- **Cloud sync** — optional user-supplied Supabase project; `public.sync_docs` table with realtime push/pull. One **Sync** button (push + pull). The last successful Sync link is saved and the app **auto-reconnects** on the next launch; the connected link is shown in the Sync view. Sync happens only between your own web pages, APK, devices, and machines — **no account / bridge to the main app** (bridge removed).
- **Banner & broadcast announcements** — jsonbin-backed feed served edge-cached by a Cloudflare Pages Function (`functions/api/announcements.js`) at `/api/announcements?type=broadcast|banner`; client renders pills + banner overlay (see `docs/ANNOUNCEMENTS.md`).
- **Backup** — full JSON export/import (all 5 tables).
- **Settings** — theme (light/dark), brand color (orange/blue/green), language (EN / MR / HI), plus quick **Cloud & Sync** and **Export / Import** shortcuts.
- **i18n** — full Marathi + Hindi translations (announcement strings included).

## Bug Fixes (this round)
- **Dark-mode toggle in Settings not working** — the settings theme button and brand swatches are `<button>` elements, which never fire a `change` event, so the old `#view-content` `change`-handler never ran. Moved both to the click handler (buttons now toggle theme / set brand correctly and the settings icon + label update in place).
- **Add / Cancel buttons not working in the task modal** — the modal (`#task-modal`) and onboarding overlay live outside `#view-content`, so the delegated `submit`/`click` listeners never fired. Added dedicated delegated listeners on `#task-modal` (submit + `[data-close-modal]`) and `#onboarding-overlay` (`[data-onboard-next]` / `[data-onboard-prev]`).
- **Onboarding Next/Back/Launch buttons not working** — same root cause; now handled on the overlay.
- **Editing a task created a duplicate instead of saving** — the task form never set `data-edit-id`; added it (`components.js` `renderTaskModal`).
- **"Start working" / "Launch App" buttons not working** — listeners were wired only after `enterApp()`; now wired in the splash sequence at module load.
- **Task cards missing options, script rows misaligned** — the task card now has a proper 2-column layout (status toggle + content) with title/priority header, clamped description, status/type/category/due meta, a primary Done/Reopen action, and icon actions for Prompt (teleprompter), View, and Delete-to-recycle-bin; the task modal also has a Delete button when editing. Both the Scripts and Teleprompter lists share one `script-row` layout (title, words/chars/updated meta, Prompt + Edit + Delete) — the Scripts view gains the missing Prompt button. Recycle bin rows use the same row styling. The Tasks view toolbar adds a New Task button.
- **Teleprompter upgraded to the main-app control setup** — rewritten `openPrompter` ports the main app's operating model: fullscreen Start, auto-hiding options bar with floating Pause/Options pills, signed Speed slider (-10…+10, negatives reverse), Font and Spacing sliders, alignment + mirror, keyboard shortcuts (Space, arrows/W/S, PageUp/PageDown, font arrows, R, M, Escape), accumulated wheel speed control, Shift+wheel manual move, middle-click reset, eased velocity with float position accumulator, bottom-parks-at-−3.0 end popup (Finished/Restart/Close), top-parks-at-3.0, operating-guide overlay, Today/Archived scripts drawer, and `tp_*` localStorage persistence.
- **Tasks can send their data to the teleprompter** — each task card has a Prompt action that opens the prompter with the task title, type/category/priority/due meta line, and description as script body; pressing Finished marks the task done.

## Deploys
- **GitHub Pages** — `pages.yml` static-copy build → `kuldeep7ke.github.io/newsmeva/`.
- **Cloudflare Pages** — git-integrated project `newsmeva`, static build `npm run build` → `/www`, with Functions (`functions/`) → `newsmeva.pages.dev`.
- **Android APK** — `build-android-apk.yml` (npm ci → npm run build → cap sync android → gradlew assembleDebug → artifact `newsmeva-mini-apk`).

## Visual Design
TodoMeva design language: warm Flat-UI palette (`--bg #f7f3ee`, `--accent #f97316`, etc.), generous radius, priority badges, soft cards. Dashboard stat cards and quick-create got extra padding and inter-card spacing.

## Build (manual)
```
npm install          # Capacitor deps at repo root
npm run build        # miniapp/ → www/
npx cap sync android # push www/ into android/app/src/main/assets/public
cd android && ./gradlew assembleDebug
```
APK output: `android/app/build/outputs/apk/debug/app-debug.apk`.