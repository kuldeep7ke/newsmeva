# Guide: Teleprompter (web + MobileApp)

The studio teleprompter is a public, auto-scrolling, full-screen reading screen.
It works **with or without login** — the "studio screen" endpoints are public,
so an anchor can open it on any device on the LAN.

## Entry points

- **Web (full app):** sidebar → **Teleprompter** → list → open a task's script.
  - Menu entry is visible to admins, video editors and anchors.
  - Signed-out visitors land on the landing page and can still open the public
    list if they browse `/teleprompter` directly.
- **MobileApp (miniapp):** Broadcast / Tasks → **Teleprompter**.

## The lifecycle (task scripts)

Only task-linked scripts drive the workflow state. Custom scripts (New Script,
pasted text) are device-local and do not post anything.

| Stage | Who | Endpoint |
|-------|-----|----------|
| Script written + approved | workflow (reporter → anchor) | `PUT /api/tasks/:id` (settings/anchors) |
| Mark ready | anchor marks script ready | task becomes `teleprompter_ready` |
| Open the prompter | any device, public | `GET /api/tasks/teleprompter/script/:id` (public) |
| **Prompt Now** | anchor clicks start | `POST /api/tasks/teleprompter/start/:id` → status `prompting` |
| **Finished** | anchor clicks finished | `POST /api/tasks/teleprompter/finish/:id` → status `recording_done` and task moves to the editor |

Public read endpoints (no auth needed):

- `GET /api/tasks/teleprompter/ready` — list of ready scripts
- `GET /api/tasks/teleprompter/script/:id` — full script text
- Signed-in users can also see `GET /api/tasks/teleprompter/history`.

## Controls

One signed speed axis, like Imaginary Teleprompter:

| Control | Action |
|---------|--------|
| Wheel up / ↑ / W | Speed up forward (+0.5 ▶) |
| Wheel down / ↓ / S | Slow → zero → smooth reverse (◀ negative) |
| Space | Play / pause |
| Middle click | Reset speed |
| Shift + wheel | Move script freely (auto-scroll resumes after 1.5 s) |
| PgUp / PgDn | Jump by screen |
| ← / → | Font size |
| R | Jump to top |
| M | Mirror display (prompter glass) |
| Esc | Pause / close |

- Speed range **-10 … +10**; the bottom bar shows a signed value
  (`3.0 ▶`, `-2.5 ◀`).
- Bottom park: reaching the end sets **-3.0 ◀** so reversing is instant; after
  a dwell the **Script Ended** popup (Finished / Restart / Close) appears and is
  cancelled if you reverse away.
- Top park: reversing to the top sets **+3.0 ▶**.
- Sliders persist per machine in `localStorage`: **Speed, Font, Spacing,
  Alignment, Mirror** — restored on your next session.
- Pausing with Space/Esc keeps scroll resumable; adjusting speed while paused
  resumes scrolling immediately (no forced fullscreen).

## Prompter best practices

1. Prepare the script (task or New Script), let the anchor rehearse at
   `-3.0` reverse then flip forward.
2. Open fullscreen (address bar hides), use mirror mode if shot through glass.
3. On **Finished**, confirm — the task advances to `recording_done` and the
   editor picks it up. Don't prompt the same task twice without resetting it
   (`finishDoneRef` guards double-finish).
4. LAN users: from other machines use `http://<server-ip>:3003/teleprompter`.

## Troubleshooting

| Symptom | Likely cause / fix |
|---------|--------------------|
| List empty | No task is in `teleprompter_ready` — approve + mark script ready first |
| 404 on a script id | Task deleted/trashed or not a teleprompter-ready task |
| "Finished" does nothing | Already finished (guard on) — reopen from the list; state is `recording_done` |
| Speed ignores wheel | Page not focused or another app scrolls the page — click the script area first |