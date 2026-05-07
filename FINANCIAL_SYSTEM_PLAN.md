# Relational Interplay — Financial System Implementation Plan

**Base:** Relational Interplay Events & Operations (`appONwRwGnRvhPgHc`)
**Status:** Design doc. No tables built yet. Existing event/attendance/payout infrastructure assumed in place.
**Scope:** Extend the current Airtable + Make.com stack to track expenses, compute KPIs, and surface a live financial dashboard.

**Financial tech stack (the systems this plan integrates with):**

| System | Role | Integration path |
|---|---|---|
| **Capital One** | Operating checking account | Read via QuickBooks bank feed (no direct Make connector) |
| **QuickBooks Online** | Accounting / categorized transactions | Native Make connector — primary expense source |
| **Stripe** | Card processing for ticket sales | Native Make connector — per-charge fees, payout reconciliation |
| **PayPal** | **Exclusive** payment method for venue payouts | Native Make connector — outbound expense tracking |
| **Venmo** | Occasional venue payouts and rare participant payments | **No public API for personal Venmo.** Monthly CSV export only — flagged as a tracking liability; goal is to eliminate or migrate to PayPal/Stripe |
| **TicketTailor** | Ticket sales / event creation (existing) | Webhooks → Airtable (existing) |
| **Airtable** | System of record for everything in this plan | — |
| **Make.com** | All automation | — |

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
│        • Venues          (pricing rules for auto-payout)    │
│        • Venue Payouts   (calculated + actual)              │
│        • Surveys         (post-event NPS responses)         │
│  EXISTING: Events, Attendance, Facilitator Payouts,         │
│            Salary Log, Time Entries, Series Rosters         │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. New tables — schemas

### 2.1 `Subscriptions` — recurring tool/service master list

The "minimum monthly expenditure floor" comes from summing this table. **This table is the source of truth for which charges are annual vs monthly vs quarterly** — when an Expense row is imported from QB, we look up the vendor here, copy the `Frequency`, and amortize accordingly. Without this table, an annual $1,200 Airtable charge looks like a $1,200 spike in March instead of $100/mo.

| Field | Type | Notes |
|---|---|---|
| Service Name | Single line text | e.g. "Airtable Team", "Make.com Core", "Zoom Pro" |
| Vendor Aliases | Multiple select / text | Free-text alt names that may appear on bank/QB feeds (e.g. "AIRTABLE.COM", "Airtable Inc", "FORMAGRID INC") — used for fuzzy matching during expense import |
| Category | Single select | Software, Banking, Insurance, Marketing, Legal/Accounting, Communications, Misc |
| Frequency | Single select | Monthly, Quarterly, Annual |
| Amount | Currency | Charge per cycle |
| Monthly Cost | Formula | `IF({Frequency}="Annual",{Amount}/12,IF({Frequency}="Quarterly",{Amount}/3,{Amount}))` |
| Renewal Date | Date | Next renewal |
| Status | Single select | Active, Cancelled, Paused |
| Owner | Linked → People | Who manages this subscription |
| Auto-Pay From | Single select | Capital One, Stripe Card, PayPal, ACH, Manual |
| Notes | Long text | |

**The annual-amortization mechanic, end-to-end:**
1. You list every recurring tool here with its true `Frequency` and `Amount`.
2. When QuickBooks Scenario 5 (§4) imports a transaction, it fuzzy-matches the vendor against `Service Name` + `Vendor Aliases`.
3. On match → the Expense row's `Frequency` is set from the Subscription, and `Subscription` link is populated. `Monthly Amortized` then computes correctly.
4. On no match → Expense defaults to `Frequency = One-time` and gets flagged for human review (a "Needs Categorization" view in Airtable). If the user confirms it's a recurring tool, they create a Subscription and re-link.

**Seed data to load on day 1:**
Airtable, Make.com, TicketTailor, Zoom Pro, Google Workspace, Toggl Track, any annual insurance, legal retainers, domain renewals, accounting subscriptions. Stripe is *not* a subscription (per-tx fees only).

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
| Account | Single select | Capital One, Stripe, PayPal, Venmo, Cash, Other |
| Receipt | Attachment | |
| Linked Event | Linked → Events | For event-specific costs (venue, travel) |
| Linked Venue Payout | Linked → Venue Payouts | When this expense represents the actual venue payment leaving PayPal/Venmo |
| Source | Single select | QuickBooks, Stripe API, PayPal API, Venmo CSV, Manual, CSV Import |
| External ID | Single line text | Dedup key — QB transaction ID, Stripe charge ID, or PayPal txn ID. Unique. |
| Stripe Payout ID | Single line text | Links Stripe fees to the QB bank-deposit row that paid them out |
| Needs Categorization | Checkbox | Auto-checked when the import couldn't match a Subscription/Vendor — drives a review queue |
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
| Notes | Long text | |

### 2.5 `Venues` — pricing rules for auto-calculated payouts

The single biggest reason this table exists: **right now venue payouts are calculated by hand**, and venues use different schemes (per-hour, % of gross, flat rate, hybrid). Encoding the rules here lets us auto-generate the payout amount the moment an event closes, which removes a recurring source of math errors and cash-flow surprises.

| Field | Type | Notes |
|---|---|---|
| Venue Name | Single line text | e.g. "Boulder Studio Collective" |
| Region | Single select | Bay Area, Boulder, NYC, Other |
| Address | Long text | |
| Charge Type | Single select | **Per-Hour**, **Percentage of Gross**, **Flat Rate**, **Hybrid (greater of)**, **Hybrid (lesser of)**, **Free / Donation** |
| Hourly Rate | Currency | Used by Per-Hour and Hybrid |
| Percentage Rate | Number (%) | Used by Percentage and Hybrid (e.g. 20 = 20%) |
| Flat Fee | Currency | Used by Flat Rate |
| Minimum | Currency | Optional floor — e.g. "20% of gross or $200, whichever is greater" |
| Includes Setup/Teardown | Checkbox | If true, billable hours = (event end − event start) + setup/teardown buffer |
| Setup/Teardown Hours | Number | Default 0.5 each side |
| Payment Method | Single select | PayPal, Venmo, Check, ACH |
| PayPal Email | Email | For PayPal payouts |
| Venmo Handle | Single line text | For the rare Venmo payout |
| Contact Name | Single line text | |
| Contact Email | Email | |
| Contact Phone | Phone | |
| Status | Single select | Active, Inactive, Past Only |
| Notes | Long text | Edge cases, history, off-menu deals |

**Add a `Venue` link field to the existing `Events` table.** Every event picks a venue. This unlocks the formula in §2.6.

### 2.6 `Venue Payouts` — calculated + actual

One row per venue payment per event. Created automatically when an event is marked `Status = Complete`.

| Field | Type | Notes |
|---|---|---|
| Event | Linked → Events | |
| Venue | Linked → Venues | Lookup from Event |
| Event Date | Lookup | From Event |
| Billable Hours | Formula | `({Event End} − {Event Start}) + IF({Venue.Includes Setup/Teardown}, 2 × {Venue.Setup/Teardown Hours}, 0)` |
| Adjusted Gross | Lookup | From Event |
| Calculated Amount | Formula | See "auto-calc formula" below |
| Override Amount | Currency | Manual override when a deal differs from the rule |
| Final Amount | Formula | `IF({Override Amount}, {Override Amount}, {Calculated Amount})` |
| Status | Single select | Pending, Paid, Disputed, Waived |
| Paid Date | Date | |
| Payment Method | Single select | PayPal, Venmo, Check, ACH |
| Payment Reference | Single line text | PayPal txn ID, Venmo memo, check number |
| Linked Expense | Linked → Expenses | Created when the actual outflow lands in PayPal/Venmo and matches |
| Reconciled | Checkbox | Auto-checked when Linked Expense.Amount = Final Amount ± $0.01 |
| Notes | Long text | |

**Auto-calc formula (`Calculated Amount`):**
```
SWITCH({Venue.Charge Type},
  "Per-Hour",            {Venue.Hourly Rate} × {Billable Hours},
  "Percentage of Gross", ({Venue.Percentage Rate} / 100) × {Adjusted Gross},
  "Flat Rate",           {Venue.Flat Fee},
  "Hybrid (greater of)", MAX({Venue.Hourly Rate} × {Billable Hours},
                             ({Venue.Percentage Rate} / 100) × {Adjusted Gross},
                             {Venue.Minimum}),
  "Hybrid (lesser of)",  MIN({Venue.Hourly Rate} × {Billable Hours},
                             ({Venue.Percentage Rate} / 100) × {Adjusted Gross}),
  "Free / Donation",     0,
  0
)
```

**Triggering creation:** an Airtable automation on Events watches for `Status` becoming `Complete` and creates a Venue Payout row. The Make-side reconciliation scenario (§4, Scenario 5d) later links the actual PayPal/Venmo outflow to this row.

### 2.7 `Surveys` (Phase 2)

| Field | Type | Notes |
|---|---|---|
| Submitted At | Date | |
| Attendee Email | Email | |
| Attendee | Linked → Attendance | Lookup by email |
| Event | Linked → Events | |
| NPS Score | Number | 0–10 |
| NPS Bucket | Formula | `IF({NPS Score}>=9,"Promoter",IF({NPS Score}>=7,"Passive","Detractor"))` |
| Referral Source | Single line text | |
| Comments | Long text | |

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

### Scenario 5c — PayPal → Expenses + Venue Payout reconciliation (NEW)

**Why:** PayPal is the *exclusive* outbound channel for venue payments. Every PayPal txn in our account should be a venue payout (or close to it). We pull each one, create an Expenses row, and link it to the corresponding Venue Payout record so we can flip `Reconciled = true`.

**Trigger:** Daily at 02:30 PT (between QB and Stripe scenarios)
**Modules:**
1. `paypal:listTransactions` — `start_date > scenario_last_run`, type = SEND_MONEY or PAYMENT_SENT
2. Iterator
3. Dedup by `External ID = paypal.transaction_id`
4. `airtable:searchRecords` (Venues) — match `PayPal Email = recipient_email`
5. `airtable:searchRecords` (Venue Payouts) — match by `Venue` + `Event Date` proximity (within 14 days), `Status != Paid`
6. Router →
   - **Match found:** create Expense (Vendor=Venue Name, Category=Venue, Linked Venue Payout=matched, Account=PayPal). Update the Venue Payout: `Status=Paid`, `Paid Date`, `Payment Reference`, `Linked Expense`, `Reconciled` (auto via formula).
   - **No match:** create Expense with `Needs Categorization=true`, route to review queue.

### Scenario 5d — Venmo CSV ingest (NEW, manual)

**Why this is half-manual:** personal Venmo has no public API. Venmo Business does, but you're not on it.

**Path:** monthly download of the Venmo CSV statement, dropped into a watched Google Drive folder.
**Trigger:** Make watches the Drive folder for new files.
**Modules:**
1. `googleDrive:watchFiles` (folder: "Venmo Statements")
2. `csv:parse`
3. Iterator
4. Dedup by `External ID = venmo.transaction_id`
5. Same matching logic as Scenario 5c (Venues by handle, Venue Payouts by date proximity)
6. Create Expenses rows + reconcile.

**Recommendation called out separately in §8:** since Venmo is a tracking liability, the long-term action is to migrate any remaining Venmo-paid venues to PayPal. The CSV path exists only to keep the books accurate while that migration happens.

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
1. Create `Subscriptions` table, seed with all current tools and their true frequencies (this is what powers correct annual amortization).
2. Create `Venues` table; seed with every venue you've used. For each, encode the charge rule (per-hour, %, flat, hybrid). This is the most error-prone step — get a second pair of eyes on it.
3. Add `Venue` link field to existing `Events` table; backfill it for past events.
4. Create `Venue Payouts`, `Expenses`, `Monthly Financials`, `KPI Snapshots` tables.
5. Add Airtable automation: when `Events.Status = Complete`, auto-create a Venue Payout row.
6. Manually import expenses for the last 3 months (CSV from Capital One) to seed history.
7. **Deliverable:** you can answer "what's our minimum monthly expenditure?" from Subscriptions and "what does this venue charge us?" from Venues.

### Phase 2 — Automation (Weeks 2–3)
8. Build Make Scenario 5 (QuickBooks → Expenses), with Subscription matching driving Frequency/amortization.
9. Build Make Scenario 5b (Stripe → Expenses + Event reconciliation) — runs after #8 daily.
10. Build Make Scenario 5c (PayPal → Expenses + Venue Payout reconciliation).
11. Build Make Scenario 5d (Venmo CSV ingest) — wire up the Drive folder.
12. Verify Stripe metadata flow from TicketTailor; add metadata-write step if missing.
13. Build Make Scenario 6 (Monthly KPI Rollup) — Return Rate first.
14. Run rollup retroactively for last 6 months with overridden date variables.
15. **Deliverable:** every event closes itself out automatically — venue payout calculated, PayPal txn matched, books balanced. Monthly KPIs auto-populate.

### Phase 3 — Visibility (Week 4)
16. Build the Airtable Interface "Financial Command Center" with 5 pages above.
17. Add a "Venue Payouts — Pending" view to Page 1 (which payouts are calculated but not yet sent).
18. Weekly digest email: MRR, cash, recent KPIs, pending venue payouts.
19. **Deliverable:** Peter + Violet have a single URL for business health.

### Phase 4 — Surveys & qualitative KPIs (Weeks 5–6, optional)
20. Tally form for post-event survey.
21. Build Make Scenario 7.
22. Add NPS to KPI Snapshots and dashboard.

---

## 7. Accountability & decision rights

The system is only useful if someone owns each piece. Suggested RACI (you should adjust):

| Area | Responsible | Accountable | Consulted |
|---|---|---|---|
| Expense entry / categorization | Bookkeeper | Violet | Peter |
| "Needs Categorization" review queue | Violet | Peter | — |
| Subscription audit (quarterly) | Violet | Peter | — |
| Venue rule maintenance | Peter | Peter | Violet |
| Venue payout sending (PayPal) | Violet | Peter | — |
| Venmo CSV upload (monthly) | Violet | Peter | — |
| KPI review (monthly) | Peter | Peter | Violet |
| Dashboard maintenance | Violet | Peter | — |
| Survey follow-up | Kayla / Briana | Violet | — |

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

1. ~~Expense source.~~ **DECIDED:** QuickBooks + Stripe API + PayPal API + Venmo CSV. Lunch Money fallback if QB clunks.
2. **MRR definition.** (a) active series enrollments amortized monthly, (b) trailing-3-month average of all event revenue, (c) something else?
3. **Cash reserve target.** Default proposal: 3× monthly Subscription Floor + Salaries. Acceptable?
4. **Survey tool.** Tally (free) or Typeform (paid)?
5. **Series-counting for Return Rate.** Confirm only the first session of a multi-session series counts toward the denominator.
6. **Venue billable-hours convention.** Does "billable hours" include setup/teardown by default? Default proposal: yes, 30 min each side, but per-venue overridable via the `Includes Setup/Teardown` checkbox.
7. **Hybrid pricing tiebreaker.** When a venue uses "greater of X% or $Y minimum", confirm the formula matches your contracts. Several venues we've seen do "greater of [hourly × hours] OR [% of gross]" — different from a flat minimum. We'll review each venue's contract during Phase 1 step 2.
8. **Venmo migration goal.** Set a target date by which all venues currently paid via Venmo migrate to PayPal? This is the only way the books stay clean long-term.
9. **Event status field.** Confirm the existing Events table has a `Status` field with a `Complete` value (or what we should use as the trigger for venue payout creation). If not, we'll add one.

---

## 9. Pre-existing pending items (carried forward from prior work)

These are still open from the original setup and block parts of this plan:

- TicketTailor: create the 10 facilitator tags (mike-lead, mike-co, sena-lead, sena-co, leah-lead, leah-co, tori-lead, tori-co, carley-lead, carley-co)
- TicketTailor: enable "Collect attendee details" per ticket type — required for accurate Return Rate (multi-ticket orders need per-attendee email)
- Google Calendar: backfill the 3 historical events (Berkeley + Oakland → Bay Area; Boulder → Boulder)

---

## 10. Next concrete step

Tech stack is locked: QuickBooks + Stripe + PayPal + Venmo (CSV) + Capital One. To start Phase 1 I need:

**Required answers** (§8 questions 2, 3, 5, 6, 8, 9 — the questions that block table design or formulas):
- MRR definition
- Cash reserve target (or accept 3× floor+salaries)
- Series-counting rule for Return Rate (or accept "first session only")
- Setup/teardown convention for venue billable hours (or accept 30 min each side)
- Venmo migration target date (or "no target — handle CSV ingest indefinitely")
- Confirm Events.Status field exists with a Complete value, or grant permission to add one

**Required data** (so Phase 1 step 2 isn't a guessing game):
- For each venue we use: name, region, charge type (per-hour / % / flat / hybrid), exact rates, payment method (PayPal/Venmo), and contact email/handle. A short Google Doc or CSV is fine.

Once those are in, I'll create the seven new tables (Subscriptions, Expenses, Venues, Venue Payouts, Monthly Financials, KPI Snapshots, Surveys), wire the auto-payout automation, seed Subscriptions and Venues, and move to Phase 2.
