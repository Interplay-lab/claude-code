# Interplay Time Tracker — Design Document

> A lightweight, mobile-first time-tracking app for Relational Interplay staff that
> replaces Toggl Track as the capture tool, while feeding the **existing** Airtable
> payroll model exactly as Toggl does today.

---

## 1. Goal & guiding principle

Replace Toggl (too expensive) with our own app that lets hourly and contractor staff
log their hours from a phone or computer. The app becomes a **drop-in replacement for
the Toggl half** of the current pipeline — everything downstream in Airtable
(Pay Periods, payouts, Interplay Bucks, dashboards) keeps working untouched because we
feed the same `Time Entries` table in the same shape.

**Principle: change as little of the proven Airtable system as possible.** Airtable
stays the payroll system of record. The app only owns *time capture* and the *daily
push* that Toggl used to do.

---

## 2. Scope (decided)

| Decision | Choice |
|---|---|
| Users | **Hourly staff + contractors only** (salaried staff don't track here) |
| Roles | **Employee** (own time) + **Admin** (sees everyone) |
| Auth | **Google login**, restricted to the company domain |
| Platforms | **One PWA** — installable on iPhone/Android, runs in desktop browsers |
| Tracking modes | **Live timer** + **manual entry** (both required) |
| Projects | None — single company project, not modeled |
| Tags | Optional, freeform (carried through to Airtable) |
| Edit window | Past entries editable for **14 days**, unless locked |
| Forgotten timers | **Auto-stop at 8h**, flagged for review |
| Airtable sync | **One-way, app → Airtable, once per day** |
| Source of truth | The **app's own database** (Airtable is a downstream mirror) |
| Payroll workflow | Stays in **Airtable** (Pay Periods Draft→Approved→Paid); app does not rebuild it |

---

## 3. How the current system works (reverse-engineered)

The live Make.com scenario **"Toggl → Airtable Time Entries"** (id 4985926) runs every
24h and does three things:

1. **Pull** recent entries from Toggl (`id, user_id, description, tags[], start, stop,
   duration, billable`).
2. **Resolve person**: search `Staff` for `{Toggl User ID} = user_id` (1 match).
3. **Upsert** into `Time Entries`, merging on **Toggl Entry ID** (idempotent), stamping
   `IB Rate` from `Staff.Interplay Bucks Rate` and `Last Synced = now()`.

It deliberately does **not** set `Project`, `Pay Period`, `Locked`, or any formula
field. Pay-period assignment, the ≥8h review flag, and locking all live in Airtable.

### The `Time Entries` write-contract (what the app must reproduce)

| Time Entry field | Field ID | Source / rule |
|---|---|---|
| `Source Entry ID` *(merge key; rename of "Toggl Entry ID")* | `fldgzJQLRBpErTfbw` | App entry UUID |
| `Person` (link → Staff) | `fldzRyHOyY3ocVKuB` | Staff record for the logged-in user |
| `Description` | `fldaiBgFLfLbRxBtR` | Entry description |
| `Tags` | `fldBT8i9CsChbKApw` | Tags joined with `, ` |
| `Start` | `fldhdPbYSruwgNx1v` | UTC start |
| `Stop` | `fldUA164kU5I4Vcoq` | UTC stop |
| `Duration (hours)` | `fldD1GcgopcDoTkKN` | seconds ÷ 3600 |
| `Billable` | `fldGSlx6MFSxkEigo` | boolean |
| `Last Synced` | `fldH4TX6zOoRQ2X8w` | `now()` at push time |
| `IB Rate` | `fldyjLbnUS64ncWZu` | from `Staff.Interplay Bucks Rate` |

Upsert keyed on `Source Entry ID` → never duplicates; re-pushing an edited entry
updates the same Airtable row. Identical semantics to the Make `bulkUpsertRecords` step.

**Cutover:** once the app is live, deactivate the Make scenario (4985926) and the
one-off backfill (5035416).

---

## 4. Architecture

```
┌──────────────┐    Google login     ┌─────────────────────┐
│  PWA client  │  ───────────────▶   │  App backend + DB   │  ◀── source of truth
│ (phone/web)  │   timer & entries   │  (Postgres)         │
└──────────────┘                     └─────────┬───────────┘
                                               │ daily job (cron)
                                               │  upsert + delete
                                               ▼
                                     ┌─────────────────────┐
                                     │  Airtable           │  ◀── downstream mirror
                                     │  Time Entries table │       (payroll brain)
                                     └─────────────────────┘
```

- **App DB owns the data.** Airtable is fed once a day.
- **Airtable still owns payroll**: Pay Periods, approval workflow, Locked, Interplay
  Bucks, dashboards — all unchanged.
- The daily job mirrors the proven contract: upsert changed entries on `Source Entry
  ID`, propagate deletes, and **read back** `Locked` / pay-period status so the app
  knows which entries to freeze (see §6).

### Recommended build path

A **React PWA + Supabase** stack (Postgres + Google Auth + a scheduled Edge Function
for the daily Airtable push). This matches the available Lovable tooling, gives real
Google SSO with domain restriction, and keeps the whole thing in one place. ~5–10
users and a daily batch are trivially within free/cheap tiers.

---

## 5. App data model (the app's own DB)

**`users`**
- `id`, `email` (= Google identity), `name`
- `staff_airtable_id` — link to the Airtable `Staff` record (the identity bridge)
- `interplay_bucks_rate` — cached from Staff, stamped onto entries at push time
- `role` — `employee` | `admin`
- `active`

**`time_entries`**
- `id` (UUID) → written to Airtable `Source Entry ID`
- `user_id`
- `description`, `tags[]`, `billable`
- `start_at` (UTC), `stop_at` (UTC, null while running)
- `duration_seconds` (derived from start/stop)
- `auto_stopped` (bool) — set when the 8h guard fired
- `airtable_record_id`, `last_synced_at`
- `locked` (bool) — mirrored from Airtable
- `created_at`, `updated_at`

Store **start/stop in UTC**, render in the user's local timezone. Duration is always
derived, never hand-entered — survives edits and audits.

---

## 6. Business rules

**Identity mapping.** Logged-in `email` → `Staff.Email`. Confirm every active hourly/
contractor staff member has their login email in `Staff`. (The old `Toggl User ID`
field is retired as the key.)

**Live timer.**
- One running timer per user; starting a new one auto-stops the previous.
- Server timestamps for start/stop (don't trust device clocks).
- **Auto-stop at 8h** → mark `auto_stopped`; the Airtable `Review Needed` formula
  (`Duration ≥ 8`) already flags it for the admin.

**Manual entry.** Pick date + start/stop (or a duration); same validation as timers.

**Editing & locking.** An entry is editable only if **all** hold:
1. not `locked`, **and**
2. `start_at` within the last **14 days**, **and**
3. its pay period is still open (not Approved/Sent/Paid in Airtable).

Once an admin advances a Pay Period to Approved/Paid in Airtable and sets `Locked`,
the next daily sync mirrors `locked = true` back into the app and the entry becomes
read-only everywhere. **This keeps the entire payroll/approval workflow in Airtable —
the app builds no approval UI.**

**Overlap.** Entries for one person shouldn't overlap; warn/prevent on manual entry.

---

## 7. Daily sync job

Runs once per day (matching today's cadence). Steps:

1. **Push up**: find app entries changed since `last_synced_at` and not `locked`;
   `bulkUpsert` to Airtable on `Source Entry ID` (≤10 records/request, well under
   Airtable's ~5 req/s limit). Stamp `IB Rate` from the user's cached rate and
   `Last Synced = now()`.
2. **Deletes**: entries deleted in-app (within the window) → delete the matching
   Airtable row by `airtable_record_id`.
3. **Mirror back**: read `Locked` (and pay-period status) for recent entries and
   update the app's `locked` flags so editing rules stay correct.

Idempotent and safe to re-run. Keep a small sync log for troubleshooting. Secrets
(Airtable PAT) live server-side only — never in the client.

---

## 8. Screens (functional)

**Employee**
- **Sign in** — Google, domain-restricted.
- **Today / Timer** — big start/stop; running state obvious; description + optional
  tags; live elapsed time.
- **Add manual entry** — date, start/stop or duration, description, tags.
- **My entries** — grouped by day with a week total; edit/delete within 14 days;
  clear *Running / Synced / Locked / Needs-review (≥8h)* states.

**Admin** (everything above, plus)
- **Team overview** — all staff, hours by day/week, who's under/over, review flags.
- Read-only links out to Airtable for the actual payroll run.

---

## 9. Edge cases & non-functionals

- **Timezones**: UTC storage, local render; define which tz bounds "today" for totals.
- **Connectivity**: no offline mode required (users can back-fill within 14 days), but
  the timer should tolerate a brief reconnect.
- **Security**: Google SSO + domain allow-list; admin pre-invites users; HTTPS;
  Airtable key server-side; per-user data isolation (employees see only their own).
- **Auditability**: never destroy start/stop history on edit; keep `updated_at`.

---

## 10. Phased rollout

1. **MVP**: Google login, timer + manual entry, my-entries with 14-day edit, daily
   one-way push reproducing the contract, 8h auto-stop. Run *in parallel* with Toggl.
2. **Cutover**: verify a full pay period matches Toggl output, then disable the Make
   scenario.
3. **Admin & polish**: team overview, lock mirror-back, gentle "timer still running"
   nudges, PWA install polish.

---

## 11. Open item to confirm

What currently assigns a `Time Entry` to its `Pay Period` and sets `Locked` — an
Airtable automation or a manual admin step? It isn't the Make sync. Confirming this
pins down exactly where the lock originates (it's the source we mirror in §6).
