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
| **Venmo** | Historical only — **as of now, all venue payouts go through PayPal.** No new Venmo outflows. | No active integration. Past Venmo activity is captured by the Capital One side of the bank ledger via QuickBooks. |
| **TicketTailor** | Ticket sales / event creation (existing) | Webhooks → Airtable (existing) |
| **ActiveCampaign** | Email + post-event communication | Native Make connector; hosts post-event survey email |
| **Tally** | Post-event NPS form | Webhook → Make → Surveys table |
| **Listify** | Internal task management + team messaging | MCP integration; venue-payout tasks assigned to Johanna |
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
│  NEW:  • Expenses             (one row per transaction)     │
│        • Subscriptions        (master list of recurring)    │
│        • Venues               (venue contacts + metadata)   │
│        • Venue Pricing Rules  (one row per pricing scheme)  │
│        • Venue Payouts        (calculated + actual)         │
│        • Surveys              (post-event NPS responses)    │
│  EXISTING: Events, Attendance, Facilitator Payouts,         │
│            Salary Log, Time Entries, Series Rosters         │
│  TO ADD TO Events: Status field (Scheduled/Held/Cancelled)  │
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
| Recurring MRR | Currency | Σ (active series enrollments × monthly value). Conservative — what we can count on. |
| Run Rate (3-mo avg) | Currency | Trailing 3-month total revenue ÷ 3. Reflects the whole business. |
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

### 2.5 `Venues` — venue contacts + metadata

Pure metadata about each venue. Pricing lives in §2.6 because **a single venue can have multiple pricing rules** (Alchemy House: 30% of gross for normal events, $500 flat for day-long events).

| Field | Type | Notes |
|---|---|---|
| Venue Name | Single line text | e.g. "Alchemy House" |
| Region | Single select | Bay Area, Boulder, NYC, Other |
| Address | Long text | |
| Payment Method | Single select | **PayPal** (default and effectively the only option going forward), Check, ACH |
| PayPal Email | Email | Required for PayPal payouts |
| Contact Name | Single line text | |
| Contact Email | Email | |
| Contact Phone | Phone | |
| Status | Single select | Active, Inactive, Past Only |
| Default Setup/Teardown Hours | Number | Default 0.5 each side; per-venue overridable |
| Notes | Long text | Off-menu deals, history, contract clauses |

**Add a `Venue` link field to the existing `Events` table.** Every event picks a venue.

### 2.6 `Venue Pricing Rules` — one row per pricing scheme

This is what makes the Alchemy House case work. Each venue can have multiple rules; the rule that matches the specific event wins. Match criteria: event format and event duration.

| Field | Type | Notes |
|---|---|---|
| Rule Name | Single line text | Free label, e.g. "Alchemy House — Default %", "Alchemy House — Day-Long Flat" |
| Venue | Linked → Venues | |
| Match Format | Multiple select | Optional. If set, rule only applies to these formats (Intro, Deepen, Relational Dojo, AE). Blank = any format. |
| Match Min Hours | Number | Optional duration floor (inclusive). Blank = 0. |
| Match Max Hours | Number | Optional duration ceiling (exclusive). Blank = ∞. |
| Charge Type | Single select | Per-Hour, Percentage of Gross, Flat Rate, Hybrid (greater of), Hybrid (lesser of), Free / Donation |
| Hourly Rate | Currency | |
| Percentage Rate | Number (%) | e.g. 30 = 30% |
| Flat Fee | Currency | |
| Minimum | Currency | Optional floor for hybrid |
| Effective From | Date | When this rule starts being valid |
| Effective To | Date | Optional. Blank = still in effect. |
| Priority | Number | Higher number wins ties. Default 0. |
| Notes | Long text | |

**Alchemy House example:**

| Rule Name | Match Min Hours | Match Max Hours | Charge Type | Percentage Rate | Flat Fee |
|---|---|---|---|---|---|
| Alchemy House — Default % | (blank) | 8 | Percentage of Gross | 30 | — |
| Alchemy House — Day-Long Flat | 8 | (blank) | Flat Rate | — | $500 |

**Rule selection logic** (used by the formula on Venue Payouts):
1. Filter to rules where `Venue` matches.
2. Filter where `Effective From ≤ Event Date AND (Effective To is empty OR Effective To ≥ Event Date)`.
3. Filter where `Match Format` is empty OR contains the event's format.
4. Filter where `Match Min Hours ≤ event duration < Match Max Hours` (treating blanks as 0 and ∞).
5. If multiple match, pick the one with highest `Priority`, then narrowest duration range.
6. If none match, log to a "Missing Pricing Rule" view and fall back to $0 with a warning.

### 2.7 `Venue Payouts` — calculated + actual

One row per venue payment per event. **Created automatically 3 days after Event Date** (refund-window buffer), provided `Events.Status ≠ Cancelled`.

| Field | Type | Notes |
|---|---|---|
| Event | Linked → Events | |
| Venue | Linked → Venues | Lookup from Event |
| Event Date | Lookup | From Event |
| Event Duration Hours | Lookup | From Event (or computed `Event End − Event Start`) |
| Event Format | Lookup | From Event |
| Billable Hours | Formula | `{Event Duration Hours} + IF({Venue.Default Setup/Teardown Hours}, 2 × {Venue.Default Setup/Teardown Hours}, 1)` |
| Adjusted Gross | Lookup | From Event |
| Matched Pricing Rule | Linked → Venue Pricing Rules | Set by the trigger scenario when the row is created |
| Calculated Amount | Formula | Computed from `Matched Pricing Rule` (see formula below) |
| Override Amount | Currency | Manual override when a deal differs from the rule |
| Final Amount | Formula | `IF({Override Amount}, {Override Amount}, {Calculated Amount})` |
| Status | Single select | **Awaiting Send** (default), **Sent to Johanna**, **Paid**, **Disputed**, **Waived** |
| Notification Sent At | Date/time | When Johanna got the email + Listify task |
| Listify Task ID | Single line text | Cross-reference to the task created in Listify so we can close it on payment |
| Paid Date | Date | When the PayPal txn lands |
| Payment Reference | Single line text | PayPal txn ID |
| Linked Expense | Linked → Expenses | Auto-linked when Scenario 5c sees the matching PayPal outflow |
| Reconciled | Formula | `{Linked Expense} != BLANK() AND ABS({Linked Expense.Amount} − {Final Amount}) < 0.01` |
| Notes | Long text | |

**`Calculated Amount` formula (reads from the matched rule):**

```
SWITCH({Matched Pricing Rule.Charge Type},
  "Per-Hour",            {Matched Pricing Rule.Hourly Rate} × {Billable Hours},
  "Percentage of Gross", ({Matched Pricing Rule.Percentage Rate} / 100) × {Adjusted Gross},
  "Flat Rate",           {Matched Pricing Rule.Flat Fee},
  "Hybrid (greater of)", MAX({Matched Pricing Rule.Hourly Rate} × {Billable Hours},
                             ({Matched Pricing Rule.Percentage Rate} / 100) × {Adjusted Gross},
                             {Matched Pricing Rule.Minimum}),
  "Hybrid (lesser of)",  MIN({Matched Pricing Rule.Hourly Rate} × {Billable Hours},
                             ({Matched Pricing Rule.Percentage Rate} / 100) × {Adjusted Gross}),
  "Free / Donation",     0,
  0
)
```

### 2.8 `Surveys` (Phase 2)

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
   - **Match found:** create Expense (Vendor=Venue Name, Category=Venue, Linked Venue Payout=matched, Account=PayPal). Update the Venue Payout: `Status=Paid`, `Paid Date`, `Payment Reference`, `Linked Expense`, `Reconciled` (auto via formula). Also mark the corresponding Listify task complete via `update_task` using the stored `Listify Task ID`.
   - **No match:** create Expense with `Needs Categorization=true`, route to review queue.

### Scenario 5d — Venue Payout Trigger + Johanna notification (NEW, the auto-payout heart of the system)

**Why this exists:** the user's flow is "event happens → wait 3 days for refunds to settle → calculate venue payout → tell Johanna to send the PayPal payment." This scenario implements steps 2–4. Johanna sends the PayPal payment manually (we deliberately do not auto-send funds); Scenario 5c then closes the loop when the outflow appears in PayPal.

**Trigger:** Schedule, daily at 09:00 PT
**Logic per run:**
1. `airtable:searchRecords` (Events) — find events where:
   - `Event Date ≤ TODAY() − 3 days`
   - `Status ≠ Cancelled` (and ideally = Held)
   - No existing linked Venue Payout row
   - `Venue` is set
2. For each matching event, iterator:
   a. `airtable:searchRecords` (Venue Pricing Rules) with the rule-selection filter from §2.6 step 5
   b. If exactly one rule matches → proceed. If zero → log to "Missing Pricing Rule" view, skip notification, alert Peter. If multiple → use the priority/narrowness tiebreaker.
   c. `airtable:createRecord` (Venue Payouts) — Event link, Matched Pricing Rule, Status = Awaiting Send. The `Calculated Amount` formula resolves on creation.
   d. Read back the just-created row to get the resolved `Final Amount`.
3. **Notify Johanna via two channels (email digest + per-payout Listify task):**

   **a. Email digest** (one email per run, not per event):
   - To: `finance.interplay@gmail.com`
   - Subject: `Venue payouts due today (N events)`
   - Body: a table with Event Name, Venue, PayPal Email, Amount, link to the Airtable record

   **b. Listify task** (one task per payout, so each can be checked off independently):
   - Assignee: Johanna
   - Title: `Pay {Venue Name} — ${Final Amount} for {Event Name} ({Event Date})`
   - Description includes: venue's PayPal email, payout amount, event link, "mark complete after PayPal txn confirmation"
   - Due date: same day (today)
   - Project: a dedicated `Venue Payouts` project in Listify (set up in Phase 2 step 13)

4. Update each Venue Payout row → Status = `Sent to Johanna`, Notification Sent At = now, store the Listify task ID for cross-reference.

**The loop closes:** Johanna sends each PayPal payment. Scenario 5c (PayPal → Expenses + Venue Payout reconciliation) detects the outgoing transaction, links it to the Venue Payout row, flips Status = `Paid`, and the `Reconciled` formula evaluates true.

**Edge cases:**
- Late refund (after T+3): refund window closed, payout already calculated, then a chargeback hits. The Adjusted Gross will update via Scenario 5b but the Venue Payout's `Calculated Amount` won't recompute (it locked at creation). A "Refund After Payout" view flags these for manual reconciliation.
- Cancelled event: skipped — but if the event is cancelled *after* the payout was created, the row needs to be manually marked `Waived` (we won't auto-reverse).
- Pricing rule changed retroactively: the rule that was matched at creation is what gets used. Editing the rule after the fact won't retroactively change historical payouts.

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

### Scenario 7 — Post-Event Survey via ActiveCampaign + Tally (Phase 2)

**Decided architecture:** AC sends the email (consolidates with the existing post-event communication automation); Tally hosts the form (better suited for NPS + comments than AC's native form builder).

**Flow:**
1. **Airtable automation** on Events: when `Event Date = TODAY() − 1`, push the event's attendees into an ActiveCampaign list `Post-Event Survey — {Event Name}` via Make.
2. **ActiveCampaign automation** (already exists for post-event emails) sends the survey email. The CTA links to a Tally form with merge tags: `https://tally.so/r/XYZ?event_id=%EVENT_ID%&email=%EMAIL%`
3. **Tally webhook → Make → Airtable.** When a response comes in, Make creates a Surveys row keyed by `event_id` + `email`. NPS bucket auto-computed.
4. **AC tag fallback (v0):** if Tally setup is delayed, ship a click-tracked email — 11 rating links (0–10), AC tags the contact with their score, Make pulls the tag into Surveys. Crude but lets us collect scores immediately.

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
1. Create `Subscriptions` table, seed with all current tools and their true frequencies.
2. Add `Status` single-select field to existing `Events` table with values `Scheduled` (default), `Held`, `Cancelled`, `Refunded`. Backfill historical events.
3. Add `Counts For Return Rate` checkbox to Events. Default checked. Set to unchecked for sessions 2–N of any series.
4. Create `Venues` table (metadata only).
5. Create `Venue Pricing Rules` table; seed with at least one rule per venue. For Alchemy House and any other tiered venues, encode each rule. **Most error-prone step — second pair of eyes recommended.**
6. Add `Venue` link field to Events; backfill for past events.
7. Create `Venue Payouts`, `Expenses`, `Monthly Financials`, `KPI Snapshots` tables.
8. Manually import expenses for the last 3 months from Capital One CSV via QuickBooks to seed history.
9. **Deliverable:** "What's our minimum monthly expenditure?" answerable from Subscriptions; "What does Alchemy House charge for a day-long event?" answerable from Venue Pricing Rules.

### Phase 2 — Automation (Weeks 2–3)
10. Build Make Scenario 5 (QuickBooks → Expenses), with Subscription matching driving Frequency/amortization.
11. Build Make Scenario 5b (Stripe → Expenses + Event reconciliation) — runs after #10 daily.
12. Build Make Scenario 5c (PayPal → Expenses + Venue Payout reconciliation).
13. Set up a `Venue Payouts` project in Listify, add Johanna as a member, capture the project ID for Make.
14. Build Make Scenario 5d (Venue Payout Trigger + Johanna notification: email + Listify task) — the heart of the auto-payout flow. Test with a fake event T+3 days in the past.
15. Verify Stripe metadata flow from TicketTailor; add metadata-write step if missing.
16. Build Make Scenario 6 (Monthly KPI Rollup) — Return Rate first.
17. Run rollup retroactively for last 6 months with overridden date variables.
18. **Deliverable:** every event closes itself out automatically — 3 days after the event, Johanna gets an email + Listify task saying "pay X to Y", she sends via PayPal, the expense lands and reconciles itself, the task auto-closes. Monthly KPIs auto-populate.

### Phase 3 — Visibility (Week 4)
19. Build the Airtable Interface "Financial Command Center" with 5 pages above.
20. Add a "Venue Payouts — Awaiting Send" view to Page 1 (Johanna's queue, also useful for Peter/Violet to monitor).
21. Add a "Missing Pricing Rule" view (events where Scenario 5d couldn't find a matching rule).
22. Weekly digest email: MRR, cash, recent KPIs, pending venue payouts.
23. **Deliverable:** Peter + Violet have a single URL for business health.

### Phase 4 — Surveys & qualitative KPIs (Weeks 5–6, optional)
24. Set up Tally form for post-event NPS.
25. Add Tally link to AC's existing post-event email automation.
26. Build Make Scenario 7 (Tally webhook → Surveys table).
27. Add NPS to KPI Snapshots and dashboard.

---

## 7. Accountability & decision rights

The system is only useful if someone owns each piece. Suggested RACI (you should adjust):

| Area | Responsible | Accountable | Consulted |
|---|---|---|---|
| Expense entry / categorization | Bookkeeper | Violet | Peter |
| "Needs Categorization" review queue | Violet | Peter | — |
| Subscription audit (quarterly) | Violet | Peter | — |
| Venue rule maintenance | Peter | Peter | Violet |
| Venue payout sending (PayPal, manual) | **Johanna** | Violet | Peter |
| Missing-Pricing-Rule queue triage | Peter | Peter | Violet |
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
2. ~~MRR definition.~~ **DECIDED:** Hybrid — track *both* Recurring MRR (active series enrollments amortized) and Run Rate (trailing 3-mo avg). Recurring MRR drives the safety indicator; Run Rate drives growth charts.
3. ~~Cash reserve target.~~ **DECIDED:** 3× monthly Subscription Floor + Salaries.
4. ~~Survey tool.~~ **DECIDED:** ActiveCampaign sends the email (uses existing post-event automation); Tally hosts the form. Confirmed TicketTailor has no built-in survey tool. v0 fallback: AC click-tracking only if Tally setup is delayed.
5. ~~Series-counting for Return Rate.~~ **DECIDED (Option A):** each event counts as one attendance regardless of session count. A series enrollment counts once (at the first session). One-off events always count. Implemented via `Counts For Return Rate` checkbox on Events — checked for one-offs and session 1 of any series, unchecked for sessions 2–N.
6. ~~Venue billable-hours convention.~~ **DECIDED:** 30 min setup + 30 min teardown included by default; per-venue overridable.
7. **Hybrid pricing tiebreaker.** When a venue uses "greater of X% or $Y minimum", we'll confirm the exact formula against each contract during Phase 1 step 5.
8. ~~Venmo migration goal.~~ **DECIDED:** all venue payouts migrate to PayPal as of now. No new Venmo outflows. Scenario 5d (Venmo CSV) removed from the plan.
9. ~~Events.Status field.~~ **DECIDED:** does not currently exist; will be added in Phase 1 step 2 with values `Scheduled` (default), `Held`, `Cancelled`, `Refunded`. The auto-payout trigger is **time-based** (Event Date + 3 days), gated by `Status ≠ Cancelled`.
10. ~~Johanna's notification channel.~~ **DECIDED:** dual notification — email digest to `finance.interplay@gmail.com` + per-payout task assigned to her in a Listify `Venue Payouts` project. Task auto-closes when the PayPal txn reconciles.
11. ~~Johanna's contact info.~~ **DECIDED:** `finance.interplay@gmail.com`. (Listify member ID will be captured during Phase 2 step 13.)

---

## 9. Pre-existing pending items (carried forward from prior work)

These are still open from the original setup and block parts of this plan:

- TicketTailor: create the 10 facilitator tags (mike-lead, mike-co, sena-lead, sena-co, leah-lead, leah-co, tori-lead, tori-co, carley-lead, carley-co)
- TicketTailor: enable "Collect attendee details" per ticket type — required for accurate Return Rate (multi-ticket orders need per-attendee email)
- Google Calendar: backfill the 3 historical events (Berkeley + Oakland → Bay Area; Boulder → Boulder)

---

## 10. Next concrete step

**All decisions locked.** Only data drops remain:

- **Venue master list:** for each venue, name, region, PayPal email, contact name/phone.
- **Venue pricing rules** (one or more rows per venue): charge type, rates, any duration brackets or format-specific overrides. Alchemy House example is encoded in §2.6 as a template.
- **Subscription master list:** every recurring tool/service with vendor, frequency, amount, renewal date.

Once those land, I'll create the eight new tables (Subscriptions, Expenses, Venues, Venue Pricing Rules, Venue Payouts, Monthly Financials, KPI Snapshots, Surveys), add the Status and Counts For Return Rate fields to Events, wire the time-based auto-payout trigger with dual email + Listify notification, and move to Phase 2.

The remaining §8 item 7 (hybrid pricing tiebreaker per contract) gets resolved during Phase 1 step 5 when we encode the rules — not a blocker.
