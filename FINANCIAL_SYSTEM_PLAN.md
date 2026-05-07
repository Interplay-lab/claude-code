# Relational Interplay — Financial System Implementation Plan

**Base:** Relational Interplay Events & Operations (`appONwRwGnRvhPgHc`)
**Status:** Design doc. No tables built yet. Existing event/attendance/payout infrastructure assumed in place.
**Scope:** Extend the current Airtable + Make.com stack to track expenses, compute KPIs, and surface a live financial dashboard.

---

## 1. Architecture overview

The current system handles the **revenue and operations** side: events created in TicketTailor flow into Events / Attendance / Series Rosters, and payouts to facilitators are tracked in Facilitator Payouts and Salary Log. What's missing is the **cost side, the rollups, and the analytics layer.**

This plan adds three layers on top of what exists:

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 3 — DASHBOARD (Airtable Interface)                   │
│  "Financial Command Center" — live view of MRR, runway,     │
│  KPIs, upcoming renewals, monthly P&L                       │
└─────────────────────────────────────────────────────────────┘
                          ▲
┌─────────────────────────────────────────────────────────────┐
│  LAYER 2 — ROLLUPS (new tables)                             │
│  • Monthly Financials   (one row per month: revenue,        │
│                          expenses, payouts, net, MRR)       │
│  • KPI Snapshots        (one row per month: return rate,    │
│                          retention, avg rev/participant)    │
│  Populated by a monthly Make.com rollup scenario.           │
└─────────────────────────────────────────────────────────────┘
                          ▲
┌─────────────────────────────────────────────────────────────┐
│  LAYER 1 — RAW DATA (new tables + existing)                 │
│  NEW:  • Expenses        (one row per transaction)          │
│        • Subscriptions   (master list of recurring tools)   │
│        • Surveys         (post-event NPS responses)         │
│        • Testimonials    (collected testimonials)           │
│  EXISTING: Events, Attendance, Facilitator Payouts,         │
│            Salary Log, Time Entries, Series Rosters         │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. New tables — schemas

### 2.1 `Subscriptions` — recurring tool/service master list

The "minimum monthly expenditure floor" comes from summing this table.

| Field | Type | Notes |
|---|---|---|
| Service Name | Single line text | e.g. "Airtable Team", "Make.com Core", "Zoom Pro" |
| Category | Single select | Software, Banking, Insurance, Marketing, Legal/Accounting, Communications, Misc |
| Frequency | Single select | Monthly, Quarterly, Annual |
| Amount | Currency | Charge per cycle |
| Monthly Cost | Formula | `IF({Frequency}="Annual",{Amount}/12,IF({Frequency}="Quarterly",{Amount}/3,{Amount}))` |
| Renewal Date | Date | Next renewal |
| Status | Single select | Active, Cancelled, Paused |
| Owner | Linked → People | Who manages this subscription |
| Auto-Pay From | Single select | Capital One, Stripe Card, ACH, Manual |
| Notes | Long text | |

**Seed data to load on day 1** (estimate from your current stack):
- Airtable, Make.com, TicketTailor, Zoom Pro, Google Workspace, Stripe (per-tx, not subscription), Toggl Track, plus any insurance/legal/SaaS not listed.

### 2.2 `Expenses` — transaction-level

| Field | Type | Notes |
|---|---|---|
| Date | Date | Transaction date |
| Vendor | Single line text | |
| Description | Single line text | Free text, often pulled from bank memo |
| Amount | Currency | |
| Category | Single select | Software, Venue, Marketing, Contractor, Travel, Insurance, Banking, Office, Misc |
| Frequency | Single select | One-time, Monthly, Quarterly, Annual |
| Subscription | Linked → Subscriptions | If this transaction is a subscription charge |
| Monthly Amortized | Formula | `IF({Frequency}="Annual",{Amount}/12,IF({Frequency}="Quarterly",{Amount}/3,{Amount}))` |
| Account | Single select | Capital One, Stripe, Cash, Other |
| Receipt | Attachment | |
| Linked Event | Linked → Events | For event-specific costs (venue, travel) |
| Source | Single select | QuickBooks, Stripe API, Manual, CSV Import, Lunch Money |
| External ID | Single line text | Dedup key — QB transaction ID or Stripe charge ID. Unique. |
| Stripe Payout ID | Single line text | Links Stripe fees to the QB bank-deposit row that paid them out |
| Notes | Long text | |

Why amortize at the row level: a single $1,200 annual Airtable charge in March would otherwise spike March's expense total by $1,200 instead of showing $100/mo across the year. Amortized totals give an honest run-rate; Amount totals give true cash flow. We'll surface both in the dashboard.

### 2.3 `Monthly Financials` — one row per month

Populated by Make.com on the 1st of each month for the prior month.

| Field | Type | Source |
|---|---|---|
| Month | Date | Always the 1st of the month |
| Month Label | Formula | `DATETIME_FORMAT({Month},'YYYY-MM')` |
| Gross Revenue | Currency | SUM Events.Gross Revenue WHERE Event Date in month |
| Adjusted Gross | Currency | SUM Events.Adjusted Gross |
| Total Payouts | Currency | SUM Facilitator Payouts.Payout Amount + SUM Salary Log |
| Total Expenses (Cash) | Currency | SUM Expenses.Amount WHERE Date in month |
| Total Expenses (Amortized) | Currency | SUM Expenses.Monthly Amortized |
| Subscription Floor | Currency | SUM Subscriptions.Monthly Cost (Active only) |
| Net Profit | Formula | `{Adjusted Gross}-{Total Payouts}-{Total Expenses (Amortized)}` |
| MRR | Currency | Sum of active series enrollments × monthly value |
| Cash Reserve End | Currency | Manual or pulled from Plaid balance |
| Owner Withdrawal | Currency | Manual |
| Notes | Long text | |

### 2.4 `KPI Snapshots` — one row per month

| Field | Type | Source |
|---|---|---|
| Month | Date | |
| Return Rate % | Number | (Returning attendees this month) / (Total attendees this month) |
| Retention 30d | Number | Distinct emails with attendance in last 30 days |
| Retention 60d | Number | Distinct emails in last 60 days |
| Retention 90d | Number | Distinct emails in last 90 days |
| Avg Revenue / Participant | Currency | Adjusted Gross / Total Attended |
| Avg Cost / Participant | Currency | (Payouts + Amortized Expenses) / Total Attended |
| Total Unique Attendees | Number | DISTINCT emails in Attendance this month |
| New Attendees | Number | Emails attending for the first time this month |
| NPS | Number | (% Promoters − % Detractors) from Surveys |
| Testimonial Rate | Number | Testimonials submitted / total attendees |
| Notes | Long text | |

### 2.5 `Surveys` (Phase 2)

| Field | Type | Notes |
|---|---|---|
| Submitted At | Date | |
| Attendee Email | Email | |
| Attendee | Linked → Attendance | Lookup by email |
| Event | Linked → Events | |
| NPS Score | Number | 0–10 |
| NPS Bucket | Formula | `IF({NPS Score}>=9,"Promoter",IF({NPS Score}>=7,"Passive","Detractor"))` |
| Would Share Testimonial | Checkbox | |
| Testimonial Text | Long text | |
| Referral Source | Single line text | |
| Comments | Long text | |

### 2.6 `Testimonials` (Phase 2)

| Field | Type | Notes |
|---|---|---|
| Person | Linked → People (or Attendance) | |
| Source | Single select | Survey, Email, Social, Other |
| Quote | Long text | |
| Permission to Use | Checkbox | |
| Used In | Multiple select | Website, Social, Email, Print |
| Date Collected | Date | |

---

## 3. KPI formulas — Phase 1 focus on Return Rate

### Return Rate (the first KPI we'll automate)

**Definition:** % of attendees in the current month who have attended ≥1 prior event.

**Computation in Make.com (monthly rollup scenario):**
1. Pull all Attendance records where `Event Date` is in the target month and `Attended = true`.
2. Get the unique email list — call this `current_emails`.
3. For each email in `current_emails`, query Attendance for prior records where `Event Date < target_month_start` and `Attended = true`.
4. Count emails with ≥1 prior attendance → `returning_count`.
5. `Return Rate = returning_count / |current_emails|`.

**Alternative (cheaper, formula-based):** add a `First Event Date` rollup to a People-by-email view, then in Attendance compute `Is Return Visit = {Event Date} > {First Event Date}`. Sum and divide. We can do this purely with Airtable formulas if email is consistent.

**Edge cases:**
- Email casing/whitespace — normalize to lowercase trimmed before comparing.
- The "Guest of [Buyer]" placeholders for backfilled events have no real email; exclude them from the denominator.
- Series enrollments (Relational Dojo etc.) — decide whether each session counts as a separate "event" or only the first session counts. **Recommendation: only first session counts toward return-rate denominator**, otherwise series students inflate the metric. We'll add a `Counts For Return Rate` checkbox on Events.

### Other KPIs (formulas defined now, automated in Phase 2)

- **Avg Revenue / Participant** = `SUM(Events.Adjusted Gross [month]) / SUM(Events.Total Attended [month])`
- **Avg Cost / Participant** = `(SUM(Facilitator Payouts) + SUM(Salary Log) + SUM(Expenses.Monthly Amortized)) / SUM(Events.Total Attended)` for the month
- **Community Retention 30d** = `COUNT(DISTINCT Attendance.Email WHERE Event Date >= TODAY() − 30)`
- **Net Profit Growth (quarterly)** = `(Q_current − Q_prior) / Q_prior` from Monthly Financials grouped by quarter
- **Depth Progression %** = of attendees whose first event was Format=Intro in the last 6 months, % who have since attended Format ∈ {Deepen, Relational Dojo, AE}

---

## 4. Make.com scenarios

### Scenario 5 — QuickBooks → Expenses (NEW, primary expense source)

**Why QuickBooks (decided):** Make.com has no native Plaid connector. QuickBooks Online has a native Make connector and pulls categorized transactions from your bank feeds. If QuickBooks proves clunky in practice, the fallback is **Lunch Money** (lower-cost, has a clean API, requires HTTP module integration in Make — slightly more setup but very stable).

**Bank-feed limitation we're working around:** bank deposits from Stripe arrive net of fees, refunds, and chargebacks. The bank line "Stripe payout: $4,732.18" tells you nothing about gross revenue, fee breakdown, or which event the money came from. That's why Scenario 5b below pulls directly from Stripe.

**Trigger:** Schedule, daily at 02:00 PT
**Modules:**
1. `quickbooks:searchTransactions` — pull transactions where `LastUpdated > scenario_last_run`
2. `iterator` — loop over transactions
3. `airtable:searchRecords` (Expenses) — check if `External ID` already exists (idempotency)
4. `router` →
   - **Route A (new):** `airtable:createRecord` (Expenses) with mapped fields:
     - `Date` ← txn.TxnDate
     - `Vendor` ← txn.PrivateNote or txn.EntityRef.name
     - `Amount` ← txn.TotalAmt
     - `Category` ← mapped from QB account/class via lookup table (see §4.4)
     - `Source` ← "QuickBooks"
     - `External ID` ← txn.Id (for dedup)
   - **Route B (exists):** `airtable:updateRecord` if amount/category changed
5. `airtable:searchRecords` (Subscriptions) — fuzzy match Vendor name → if hit, link record

### Scenario 5b — Stripe → Expenses + Event reconciliation (NEW, critical)

**Why this is needed separately:** the bank feed shows net Stripe payouts, but doesn't give you per-charge fees, refunds, or which event a charge belongs to. We need the *gross + fee* breakdown for each charge to:
1. Calculate true gross revenue per event (already partially handled — TT pushes ticket price, but Stripe fees aren't itemized there).
2. Track Stripe processing fees as their own expense category for the P&L.
3. Reconcile bank payouts against Stripe charges (so we know "this $4,732.18 deposit on May 3 came from these 47 charges across these 5 events").

**Trigger:** Schedule, daily at 03:00 PT (after Scenario 5 has run, so QB rows already exist for the bank-side payouts)

**Modules:**
1. `stripe:listCharges` — charges where `created > scenario_last_run`, status=succeeded
2. `iterator` — loop over charges
3. `setVariables`:
   - `gross` = charge.amount / 100
   - `fee` = charge.balance_transaction.fee / 100
   - `net` = gross − fee
   - `tt_event_id` = charge.metadata.event_id (if TT passes it through; otherwise null)
4. `airtable:searchRecords` (Events) — find Event by `TT Event ID` if metadata present, else by recent date proximity
5. `airtable:searchRecords` (Expenses) — dedup by `External ID = charge.id`
6. `router` →
   - **Route A (new charge):** `airtable:createRecord` (Expenses) for the **Stripe fee only**:
     - `Date` ← charge.created
     - `Vendor` ← "Stripe"
     - `Amount` ← `fee`
     - `Category` ← "Banking" (sub-category: Stripe Fees)
     - `Frequency` ← "One-time"
     - `Linked Event` ← matched Event
     - `External ID` ← charge.id
     - `Source` ← "Stripe API"
     - `Notes` ← "Fee on $${gross} charge"
   - **Route B (refund or dispute):** create a separate Expenses row with negative impact, link to original event
7. `airtable:updateRecord` (Events) — increment `Stripe Fees` cached field on the matched event

**Stripe payout reconciliation (sub-flow):**
- Daily, also pull `stripe:listPayouts`. For each payout, store the payout ID + amount + arrival date in a Make Data Store keyed by `payout_id`.
- When QuickBooks Scenario 5 sees a deposit matching a Stripe payout amount + date, link the QB Expenses row to all the Stripe charges in that payout via a `Stripe Payout ID` field. This gives full traceability from bank deposit → individual ticket purchases.

**Required setup on Stripe side:**
- TicketTailor → Stripe checkout: confirm that TT passes `event_id` (or equivalent) into Stripe charge metadata. If it doesn't, add a Make scenario step that writes back metadata to the charge after TT webhook fires. Without this, event attribution falls back to date-proximity matching, which is fragile.

### Scenario 6 — Monthly KPI Rollup (NEW)

**Trigger:** Schedule, 1st of month at 06:00 PT, runs for *prior* month

**Variables computed:**
- `target_month_start` = first day of prior month
- `target_month_end` = last day of prior month

**Modules:**
1. `airtable:searchRecords` (Events) — events where Event Date in [target_month_start, target_month_end]
2. `airtable:searchRecords` (Attendance) — attendance rows for those events, Attended=true
3. `array:aggregate` — compute totals (Gross, Adjusted, Attendees)
4. `airtable:searchRecords` (Facilitator Payouts) — month total
5. `airtable:searchRecords` (Salary Log) — month total
6. `airtable:searchRecords` (Expenses) — month total (cash + amortized)
7. `airtable:searchRecords` (Subscriptions) — sum Monthly Cost where Status=Active
8. `setVariables` — compute Return Rate per §3 logic
9. `airtable:createRecord` (Monthly Financials) — write the row
10. `airtable:createRecord` (KPI Snapshots) — write the row
11. `email:send` — summary to Peter + Violet

**Idempotency:** before creating, search for existing row with same `Month`. Update if exists.

### Scenario 7 — Post-Event Survey Trigger (NEW, Phase 2)

**Trigger:** Schedule, daily at 09:00 PT
**Logic:** Find Events where `Event Date = TODAY() − 1` (yesterday). For each, pull Attendance rows with `Attended=true` and email. Send each attendee a Tally/Typeform survey link with `?event_id=...&email=...` prefilled. Form responses webhook into Surveys table.

### 4.4 Category mapping table (in Make Data Store)

Create a Data Store `expense_category_map` keyed by QB account ID or vendor regex → Airtable Category. Examples:

| Match | → Category |
|---|---|
| Vendor matches `airtable\|make\|zoom\|google\|tickettailor` | Software |
| QB Account "Travel - Meals" | Travel |
| QB Account "Contractor Payments" | Contractor |
| Vendor matches `(boulder studio\|venue\|hall)` | Venue |
| Default | Misc |

---

## 5. Dashboard — Airtable Interface "Financial Command Center"

Single Interface with these pages:

### Page 1 — This Month
- Hero numbers: MRR, Cash Reserve, Net Profit MTD, Subscription Floor
- "Are we above floor?" indicator (green if Adjusted Gross MTD > Subscription Floor + Salaries)
- Upcoming subscription renewals (next 30 days)
- Recent expenses (last 14 days)

### Page 2 — Trailing 12 Months
- Monthly Financials chart: Revenue / Expenses / Net stacked bars
- KPI Snapshots line chart: Return Rate, Retention 30d, Avg Rev/Participant
- Quarterly net profit growth %

### Page 3 — Per-Event Economics
- Events table grouped by Format, with Adjusted Gross, Payouts, Net per event, Attended, Rev/Participant

### Page 4 — Subscriptions & Floor
- Subscriptions list, sorted by Monthly Cost desc
- Total floor at top
- Renewal calendar

### Page 5 — KPI Trends
- Return Rate over time
- Depth progression funnel (Intro → Deepen → Series)
- NPS trend (Phase 2)

---

## 6. Build sequence

### Phase 1 — Foundation (Week 1)
1. Create `Subscriptions` table, seed with current tools.
2. Create `Expenses` table.
3. Create `Monthly Financials` and `KPI Snapshots` tables (empty).
4. Backfill Subscriptions with everything you currently pay for.
5. Manual-import expenses for the last 3 months (CSV from Capital One) to seed history.
6. **Deliverable:** you can answer "what's our minimum monthly expenditure?" by viewing Subscriptions.

### Phase 2 — Automation (Weeks 2–3)
7. Build Make Scenario 5 (QuickBooks → Expenses).
8. Build Make Scenario 5b (Stripe → Expenses + Event reconciliation) — must run *after* Scenario 5 daily so payouts are matchable.
9. Verify Stripe metadata flow: confirm TicketTailor passes event ID into Stripe charge metadata; if not, add a TT-webhook → Stripe metadata-update step.
10. Build Make Scenario 6 (Monthly KPI Rollup) — Return Rate first, others added incrementally.
11. Run the rollup retroactively for the last 6 months by manually triggering with overridden date variables.
12. **Deliverable:** every 1st of the month, Monthly Financials and KPI Snapshots auto-populate; daily, Expenses reconciles bank deposits to Stripe charges to events.

### Phase 3 — Visibility (Week 4)
13. Build the Airtable Interface "Financial Command Center" with 5 pages above.
14. Set up a weekly digest email (Make scenario or Airtable automation): MRR, cash, recent KPIs.
15. **Deliverable:** Peter + Violet have a single URL to check the business's financial health.

### Phase 4 — Surveys & qualitative KPIs (Weeks 5–6, optional)
16. Set up Tally form for post-event survey.
17. Build Make Scenario 7.
18. Add NPS + Testimonial Rate to KPI Snapshots and dashboard.

---

## 7. Accountability & decision rights

The system is only useful if someone owns each piece. Suggested RACI (you should adjust):

| Area | Responsible | Accountable | Consulted |
|---|---|---|---|
| Expense entry / categorization | Bookkeeper | Violet | Peter |
| Subscription audit (quarterly) | Violet | Peter | — |
| KPI review (monthly) | Peter | Peter | Violet |
| Dashboard maintenance | Violet | Peter | — |
| Survey follow-up & testimonials | Kayla / Briana | Violet | — |

**Decision-making cadence (proposed):**
- **Weekly (15 min):** Peter + Violet review prior week's revenue, expenses, anomalies. Anything red gets an action owner.
- **Monthly (60 min):** review Monthly Financials + KPI Snapshots. Decide on initiatives for next month based on trends. Cancel/renegotiate subscriptions if floor is creeping up.
- **Quarterly (2 hr):** strategic review. Net profit growth, depth progression, big bets for next quarter.

**Prioritization rubric (for "what to work on"):**
Score each candidate initiative 1–5 on:
- **Revenue impact** (will this move MRR or per-event revenue?)
- **Cost impact** (does it reduce floor or cost/participant?)
- **Effort** (inverted — lower effort = higher score)
- **Alignment** (fits the Relational Interplay mission?)

Sum and rank. Anything scoring ≥15 of 20 goes on the "do next" list. Below 10 gets parked.

---

## 8. Open decisions / pending items

Things that need a call before we build:

1. ~~**Expense source confirmation.**~~ **DECIDED:** QuickBooks Online primary, Stripe API for per-charge fees and event attribution. Lunch Money is the fallback if QuickBooks proves clunky.
2. **MRR definition.** Is MRR (a) just active series enrollments amortized monthly, (b) a trailing-3-month average of all event revenue, or (c) something else? The dashboard line item depends on this.
3. **Cash reserve target.** The dashboard "are we safe?" indicator needs a target. Common rule: 3× monthly Subscription Floor + Salaries. Acceptable?
4. **Survey tool.** Tally (free, simple) or Typeform (paid, prettier)? Phase 2 question, but flag now.
5. **Series-counting for Return Rate.** Confirm that only the first session of a multi-session series counts toward the return-rate denominator (recommended), so Dojo students don't inflate the metric.

---

## 9. Pre-existing pending items (carried forward from prior work)

These are still open from the original setup and block parts of this plan:

- TicketTailor: create the 10 facilitator tags (mike-lead, mike-co, sena-lead, sena-co, leah-lead, leah-co, tori-lead, tori-co, carley-lead, carley-co)
- TicketTailor: enable "Collect attendee details" per ticket type — required for accurate Return Rate (multi-ticket orders need per-attendee email)
- Google Calendar: backfill the 3 historical events (Berkeley + Oakland → Bay Area; Boulder → Boulder)

---

## 10. Next concrete step

Expense source is locked (QuickBooks + Stripe API, Lunch Money as fallback). To start Phase 1 I need answers to the four remaining questions in §8 (MRR definition, cash reserve target, survey tool, series-counting rule). Once those are settled I'll:

1. Create the six new tables in Airtable (Subscriptions, Expenses, Monthly Financials, KPI Snapshots, Surveys, Testimonials).
2. Seed Subscriptions with your current recurring tools.
3. Backfill the last 3 months of expenses from Capital One CSV so we have history to test rollups against.
4. Move to Phase 2 automation (QuickBooks + Stripe scenarios).

Reply with answers to §8 questions 2–5 and I'll start building.
