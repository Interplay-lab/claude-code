# Make.com Credit Ask — Brief for Peter

**From:** Briana
**Date:** June 22, 2026
**Ask:** ~$10-15 for a one-time 10,000-operation top-up

---

## Where we are

Our Make.com account hit its annual operations limit and **automatically paused** — meaning all our automated integrations (Ticket Tailor → Airtable sync, Toggl → Time Entries, Joanna's payout email, etc.) stopped running. We're locked out until we top up or wait until **January 26, 2027** for the annual reset.

We're on the **Pro annual plan**: 120,000 operations/year. We used **130,030 operations in 5 months** (already including one prior 10k top-up).

## What caused the overage

Three specific bugs burned ~80% of the year's quota in May:

| # | Bug | Cost |
|---|---|---|
| 1 | "Airtable Attendance → ActiveCampaign" looped through all 1,599 rows on every webhook call (should have been ~2 ops/call) | ~53,000 ops in 24 hrs (May 28-29) |
| 2 | "Lunch Money → Expenses" was scheduled hourly instead of daily | ~25,000 ops/month while live |
| 3 | "Create Venue Payouts" same misconfiguration — hourly instead of daily | ~10,000 ops/month while live |

**All three were already fixed June 1.** I just didn't realize the May damage was sunk cost — the account kept counting against the annual quota until it hit zero.

## What I just cleaned up today (in addition to the June 1 fixes)

- Deactivated **ONE-OFF: Toggl Backfill** — a one-time scenario that never got turned off and was running daily
- Deactivated **No-Show → ActiveCampaign** — broken Airtable formula was throwing errors and burning ops
- Reduced **TT Events Polling v3** from hourly → every 4 hours (saves ~16,500 ops/month with no functional impact)

## Projected usage going forward

| Scenario | Ops/month |
|---|---|
| TT Events Polling (every 4 hrs) | 5,500 |
| Lunch Money sync (daily) | 5,000 |
| All other active scenarios combined | ~1,500 |
| **Total monthly** | **~12,000** |

Our monthly allowance under the annual plan is **~10,000 ops/month** — we'll be just slightly over, which is fine month-to-month given normal variation.

## The ask

**Approve a $10-15 one-time 10,000-operation top-up.** This:
- Unpauses the org so automations resume immediately
- Gets us through the remaining 7 months of the annual cycle
- Buys time to evaluate if we need to upgrade at the next renewal (Jan 26, 2027)

**Why not upgrade now:** Upgrading to a higher monthly tier would cost ~$430+/year. A small top-up is ~$15. We can revisit at renewal once we have 6 months of clean usage data.

## What's blocked until this is approved

- TT registrations not flowing into Series Rosters (~14 Dojo signups currently missing, ~$8,200 in revenue not tracked)
- New Joanna payout email automation can't run
- Time entries not syncing from Toggl
- Stripe income not auto-logging to Airtable

---

Quick decision needed — happy to talk through any of it.
