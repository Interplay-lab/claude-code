# Interplay Time Tracker — app

A warm, mobile-first time-tracking **PWA** (the "Hourglass" design), implemented
from the Claude Design handoff. Replaces Toggl as the capture tool; see
[`../DESIGN.md`](../DESIGN.md) for the full architecture and the Airtable sync contract.

## Stack

- **React 18 + Vite** (plain JSX modules)
- Design tokens in plain CSS (`src/styles.css`) — terracotta/clay primary,
  Hanken Grotesk, light mode, soft warm shadows
- Installable **PWA** (`public/manifest.webmanifest` + `public/sw.js`)

## Run

```bash
npm install
npm run dev      # local dev server
npm run build    # production build → dist/
npm run preview  # serve the production build (service worker active)
```

## What's implemented (from the design)

- **Sign in** — warm "Continue with Google" gate (domain note shown).
- **Today / Timer** — the hero. Live ticking clock, calm pulse when running,
  description + tag chips, today's entries, weekly total. Three timer-card
  styles exist (`ring · stack · focus`); `ring` is the default — change
  `TIMER_VARIANT` in `src/App.jsx`.
- **My entries** — weekly total + bar chart, days grouped with time range •
  duration • tags • status chips; hover to edit/delete; locked rows read-only.
- **Add / edit entry** — bottom sheet (phone) / centered modal (desktop) with a
  Start-End ↔ Duration toggle and a soft ≥8h "needs review" flag.
- **Admin · Team overview** — dense day-by-day table (desktop) / stacked cards
  (phone) with on-track / long-day / under-hours flags.
- Persistent **running banner** app-wide; bottom nav (phone) / side nav (desktop).
- Responsive: switches between phone and desktop shells at 900px.

## Not yet wired (next milestone)

This is the **front end with seed data** (`src/data.js`). Still to build per
`../DESIGN.md`: real Google auth, the app database, and the app-native daily
push into Airtable. The timer/entries state currently lives in memory only.

## Provenance

Recreated from the Claude Design bundle (project "Hourglass"). The prototype's
design-tool scaffolding (device toggle, tweaks panel, iOS/browser frames) was
intentionally dropped in favor of real responsive detection and a real sign-in gate.
