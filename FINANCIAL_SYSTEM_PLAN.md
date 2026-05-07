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
| Source | Single select | Plaid, Manual, Stripe API, CSV Import |
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

### Scenario 5 — Plaid → Expenses (NEW)

> **Caveat on Plaid:** Make.com has **no native Plaid connector** as of this writing. The realistic paths are:
>
> 1. **HTTP module + Plaid API** — fully custom; requires creating a Plaid app, completing their dev onboarding (2–5 day approval), exchanging public tokens for access tokens, and storing tokens in a Make Data Store. Highest control, most setup effort.
> 2. **QuickBooks Online or Xero connector** (native in Make) — if you already use either, both auto-categorize from bank feeds and Make can pull categorized transactions cleanly. Strongly recommended if you have an accountant or are open to setting one up; this is the lowest-friction path.
> 3. **Bridge service like Method Financial or Finicity** — adds cost but simpler than raw Plaid.
>
> **Recommendation:** start with QuickBooks (Path 2) if you have or are willing to add it. Otherwise fall back to monthly CSV import from Capital One — manual but reliable, and we can revisit Plaid in Phase 3 once the schema is proven.

Assuming **QuickBooks** as the source:

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
7. Build Make Scenario 5 (QuickBooks → Expenses) **OR** establish monthly CSV import workflow.
8. Build Make Scenario 6 (Monthly KPI Rollup) — Return Rate first, others added incrementally.
9. Run the rollup retroactively for the last 6 months by manually triggering with overridden date variables.
10. **Deliverable:** every 1st of the month, Monthly Financials and KPI Snapshots auto-populate.

### Phase 3 — Visibility (Week 4)
11. Build the Airtable Interface "Financial Command Center" with 5 pages above.
12. Set up a weekly digest email (Make scenario or Airtable automation): MRR, cash, recent KPIs.
13. **Deliverable:** Peter + Violet have a single URL to check the business's financial health.

### Phase 4 — Surveys & qualitative KPIs (Weeks 5–6, optional)
14. Set up Tally form for post-event survey.
15. Build Make Scenario 7.
16. Add NPS + Testimonial Rate to KPI Snapshots and dashboard.

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

1. **Expense source confirmation.** You picked Plaid; the practical implementation is QuickBooks/Xero. Do you currently use either? If not, are you open to onboarding QuickBooks, or should we default to monthly Capital One CSV imports for Phase 1 and revisit Plaid later?
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

Given your selections (full plan first, Plaid/accounting sync, Return Rate KPI first), the immediate next action is to confirm the **expense source path** in §8 question 1. Once that's locked, we can:

1. Create the four Phase 1 tables in Airtable.
2. Seed Subscriptions.
3. Decide on QuickBooks vs CSV.
4. Begin Phase 2 automation.

Reply with answers to §8 and I'll start building.
