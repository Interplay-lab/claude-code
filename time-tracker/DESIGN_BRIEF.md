# Design Brief — Interplay Time Tracker (one-pager for Claude Design)

## What it is
A **mobile-first time-tracking app (installable PWA)** for a small team at *Relational
Interplay*. Staff log work hours with a one-tap timer or a quick manual entry; an admin
reviews everyone's hours. It replaces Toggl. Hours flow to payroll automatically, so the
app itself should feel **fast, calm, and trustworthy** — not a heavy enterprise tool.

## Who uses it
- **Employees / contractors** (≈5–10): mostly on phones, logging time in seconds
  between tasks. Low effort, glanceable, forgiving.
- **One admin**: reviews weekly hours across the team, spots anomalies.

## Platforms
One responsive design that works as a **phone home-screen app first**, and equally as a
**desktop web app**. Design mobile-first; scale up gracefully to a centered desktop
layout.

## Core screens (design these)
1. **Sign in** — single "Continue with Google" button; warm, minimal, branded.
2. **Today / Timer** *(home)* — a large, unmissable **Start/Stop** control; an optional
   description field and tag chips; live elapsed time when running. The running state
   should be impossible to miss (color, motion, a persistent banner).
3. **Add manual entry** — date + start/end (or duration), description, tags. Quick.
4. **My entries** — list grouped by day, each row showing time range, duration,
   description, tags, and a **status chip**; a **weekly total** header. Inline
   edit/delete for the last 14 days.
5. **Admin · Team overview** — compact table/cards of staff with daily/weekly totals
   and flags; clean data density without feeling like a spreadsheet.

## Key UI components
- **Timer card** with prominent start/stop and live clock.
- **Entry row** — time range • duration • description • tags.
- **Status chips**: `Running` (active/animated), `Synced` (calm/neutral),
  `Locked` (muted, lock icon — paid/finalized, read-only), `Needs review` (warning,
  for entries ≥ 8h).
- **Weekly total bar/summary**.
- **Bottom nav** on mobile (Timer · Entries · [Admin]); side nav on desktop.

## Experience principles
- **One-tap to start tracking.** The home screen's job is the timer.
- **Glanceable.** Totals and states readable at arm's length, outdoors, on a phone.
- **Gentle guardrails.** Locked entries look clearly read-only; ≥8h entries get a soft
  warning, not an alarm.
- **Quiet confidence.** This touches people's pay — it should feel accurate and steady,
  never noisy or playful-to-a-fault.

## Visual direction
- **Tone:** warm, human, relational, professional-but-friendly — reflecting the
  "Relational Interplay" brand. Approachable, not corporate-cold; focused, not gamified.
- **Palette:** clean light base with one warm primary accent for the timer/active state
  and a small functional set (neutral = synced, amber = needs-review, muted gray =
  locked, green = success). *Swap in the official Interplay brand colors if available.*
- **Type:** friendly, highly legible sans; large tabular numerals for the timer and
  durations (numbers are the hero).
- **Shape & feel:** rounded cards, generous spacing, soft shadows, large tap targets,
  subtle motion on the running timer. Light and dark mode welcome.
- **Iconography:** simple, rounded, minimal.

## Explicitly out of scope (keep the UI lean)
No projects/clients, no invoicing, no approval workflow inside the app (payroll lives in
Airtable), no offline mode. Keep screens few and focused.
