# Interplay Financial Dashboard — Full Handoff Brief

**Purpose:** Paste this entire document at the start of a new Claude Code session to continue building the financial layer of the Relational Interplay Airtable dashboard with full context.

**Working directory:** `/home/user/claude-code`
**Git branch:** `claude/setup-lunch-money-account-IZW1G`

---

## 1. Business context

Building the financial layer of an integrated business dashboard in Airtable for **Relational Interplay**, an in-person events business operating in Berkeley, Oakland, and Boulder. The Airtable base is the **operating** source of truth for the founders. QuickBooks is being retired — it will remain only for taxes, if at all.

The founders need to answer at a glance:
- Cash on hand
- Current-month net profit
- Baseline runway (months of survival at minimum-fixed-cost burn)
- Per-event P&L
- Who owes us / who we owe
- Clientele pulse (returning vs new attendees, retention rates)
- Contractor and affiliate payments
- Subscriptions and recurring costs

### Source-of-truth model going forward

| Source | Authoritative for | Pipeline |
|---|---|---|
| **Stripe** | All income (charges, fees, refunds) | Native API + Make.com for full fee detail |
| **Ticket Tailor** | Events + attendance | Existing integration |
| **Lunch Money** | All expenses (except Venmo historical) | Make.com → Airtable |
| **QuickBooks** | Venmo Business historical transactions only | One-time extract, then disconnect |
| **Partiful** | Future: guest lists for pre-Stripe events | Needs scraper (later phase) |

**Important:** Venmo Business has been **fully retired** for contractor payments. It exists only as a historical data extraction problem.

---

## 2. Airtable base reference

- **Base ID:** `appONwRwGnRvhPgHc`
- **Base name:** Relational Interplay Events & Operations
- **Permission level:** create
- **Interfaces:** none yet (must build)

### Tables

| Table | Table ID | Records | State |
|---|---|---|---|
| Events | `tbluhZWwFK0wVWm1Z` | 3 | Sparse; only Apr 28, Apr 29, May 5, 2026 |
| Attendance | `tblOnjg68hW3e7wS8` | ~111 | Healthy; has email |
| Facilitator Payouts | `tbl9BPw09Swf8YquL` | 1 (Test) | Not in production use |
| Series Rosters | `tblcdvTCAJHcvqFY3` | — | |
| Staff | `tblG0Wg94I837qbiT` | — | Well-modeled; has Interplay Bucks system |
| Profit Share Payouts | `tbl9AxX0udBbfFDBr` | 0 | |
| Salary Log | `tbl8jl8I6tGlhLSE7` | — | |
| Pay Periods | `tblielJsv6tfaxJ3c` | — | |
| Interplay Bucks Ledger | `tbl6sR2OhP6PpGDn0` | — | |
| Time Entries | `tbl5FWab23bnhepB4` | — | |
| Subscriptions | `tblxwdzaiPnGr5gYx` | 9 | Clean, properly categorized |
| Venues | `tblLIEMaMyPZg4bHp` | — | |
| Venue Pricing Rules | `tblPINl9V9Uj1t9N1` | — | |
| **Expenses** | `tblO7Ux8RvI4l2Eac` | **166** | All `Source=QuickBooks`; nearly none categorized |
| Venue Payouts | `tblO4g0phvcyHrIOH` | 0 | |
| Monthly Financials | `tblZZKzFXk6buss24` | **0** | Schema is good, nothing populated |
| KPI Snapshots | `tbl7RX1RcCQWlwCTf` | **0** | Same |
| Affiliates | `tbljr0pHRwqN4G9sV` | — | |
| Affiliate Commissions | `tblusG9EK47fqJ0hN` | — | |

### Critical field IDs

**Expenses table (`tblO7Ux8RvI4l2Eac`):**
- `Source` singleSelect: `fldSbEjKsPzf89Up8` — current choices: QuickBooks, Stripe API, PayPal API, Manual, CSV Import. **Missing: Lunch Money.**
- `Category` singleSelect: `fldZELsJr7lV8Ha39` — current choices (only 9): Software, Venue, Marketing, Contractor, Travel, Insurance, Banking, Office, Misc. Too coarse.
- `Account` singleSelect: `fldSjmHlPF9Tz4GC9` — current choices: Capital One, Stripe, PayPal, Cash, Other. Needs real bank/card breakdown.

**Events table (`tbluhZWwFK0wVWm1Z`):**
- `Lead Facilitator (Person)` link to Staff: `fldBKVM4ptS1NKZdS`
- `Co-Facilitator (Person)` link to Staff: `fldmrH5LIbvNWRgl0`
- Has free-text fields `Lead Facilitator`, `Co-Facilitator`, `Venue` that are superseded by linked versions.

**Staff table (`tblG0Wg94I837qbiT`):**
- `Events` (auto-reverse of `Events.Lead Facilitator (Person)`): `fldvMssaNxavK3VNR`
- `Events 2` (auto-reverse of `Events.Co-Facilitator (Person)`): `fld3vN1iUAU6k5Lfx`
- `Total IB Earned (legacy)`: `fldemm4noaR783fae` — deprecated 2026-05-12, replaced by `Total IB Earned` formula
- `IB Earned This Month (legacy)`: `fld5URiF2UKgWh8LV` — deprecated 2026-05-12, replaced by `IB Earned Rollup (from Pay Periods)` rollup
- Active IB rollups: `IB from Time Entries`, `IB from Ledger Credits`, `IB Redeemed`, `IB Earned Rollup (from Pay Periods)` → combined into formulas `Total IB Earned` and `Current IB Balance`.

---

## 3. Findings from discovery (do not re-discover)

### The Expenses table is the biggest mess
All 166 rows were auto-imported from QuickBooks. They contain:

| Row pattern | Example | Correct treatment |
|---|---|---|
| Contractor payment | Violet Starkey $4,134 (Apr 7), $1,250 (Feb 26) | Keep as expense, Category=Contractor, link to Staff record. **Violet is a contractor, not an owner.** |
| Refund disguised as expense | Phil Enock $50 (Apr 23) | Exclude from financials, Reason=Refund Netted Against Revenue |
| Stripe processing fee double-count | Stripe $20 (Feb 20), $47.42 (Apr 9) | Exclude, Reason=Duplicate of Payout (already in Events.Stripe Fees) |
| Venmo transfer noise | Venmo $0.95, $1.43 | Exclude, Reason=Internal Transfer |
| Lost memo | "Unknown vendor" rows | Triage queue; may recover via full QB export (Phase 0) |

### Income side is not wired
- `Events.Gross Revenue`, `Stripe Fees`, `Refunds` are all manually entered currency fields.
- `Attendance.Amount Paid` exists but does not roll up to Events.
- **No `Stripe Charges` table exists.** No per-charge ledger.
- No `Stripe Payment Intent ID` field anywhere to match Stripe data.

### Reporting tables are well-designed but empty
`Monthly Financials` has the right fields: Gross Revenue, Adjusted Gross, Total Payouts, Total Expenses (Cash), Total Expenses (Amortized), Subscription Floor, Recurring MRR, Run Rate (3-mo avg), Cash Reserve End, Owner Withdrawal, Notes, Net Profit (formula), Above Floor (formula). **Zero rows.**

`KPI Snapshots` has: Return Rate, Retention 30/60/90d, Total Unique Attendees, New Attendees, Avg Revenue Per Participant, Avg Cost Per Participant, NPS. **Zero rows.**

**Missing field:** `Baseline Runway` formula. Should be `{Cash Reserve End} / {Subscription Floor}`. Also `Runway at Current Burn` = `{Cash Reserve End} / {Run Rate (3-mo avg)}`.

### Schema clarifications (confirmed, do not re-investigate)

1. **`Staff.Events` and `Staff.Events 2` are NOT duplicates.** They are auto-generated reverse links — one for Lead Facilitator, one for Co-Facilitator. **Action: rename**, do not delete.
   - `Staff.Events` (`fldvMssaNxavK3VNR`) → rename to `Events as Lead Facilitator`
   - `Staff.Events 2` (`fld3vN1iUAU6k5Lfx`) → rename to `Events as Co-Facilitator`

2. **Legacy IB fields are safe to delete after spot-check.** Field descriptions explicitly state they were deprecated 2026-05-12 and replaced by the rollup chain. The new pipeline IS tracking IB; just via rollups rather than stored numbers.
   - Confirm new rollup totals match legacy totals for current Staff records
   - Then delete `Total IB Earned (legacy)` and `IB Earned This Month (legacy)`
   - Note: legacy description references "IB Earned This Period rollup" but actual field is `IB Earned Rollup (from Pay Periods)` — likely just stale wording

3. **Free-text fields on Events** (`Lead Facilitator`, `Co-Facilitator`, `Venue`) are superseded by linked-record versions. Drop them after confirming linked versions are backfilled.

### Stripe data shape (confirmed)
- Stripe `description` field carries Ticket Tailor event name verbatim, e.g.
  `"Order for INTERPLAY & CHILL: Relating & Co-Regulating in N Boulder"` matches event `rec48TRjKOwG8adei` ("INTERPLAY & CHILL: Relating & Co-Regulating in N Boulder").
- Stripe customer ID (`cus_...`) → customer email → matches `Attendance.Email`.
- At least 70+ payment intents in recent history; full history likely several hundred.
- **Stripe MCP limitations:** `fetch_stripe_resources` and `list_payment_intents` return only id, amount, currency, status, customer (and via fetch, description + created timestamp). **Fees, refund details, balance transactions, and metadata are NOT accessible via the MCP.** Those must come through the Make.com Stripe pipeline.

---

## 4. Decisions already made (do not re-litigate)

1. **No more QuickBooks** going forward. Pull historic Venmo from QB once, archive, disconnect.
2. **Lunch Money pipeline** runs via Make.com. There is no LM MCP. User previously tried providing an API token directly; the LLM couldn't use it. Use Make.com.
3. **Stripe is the income source of truth.** The Stripe `description` field is the join key to `Events.Event Name`.
4. **Violet Starkey is a contractor**, not an owner. Her payments stay as Expenses (Category=Contractor), linked to her Staff record.
5. **Phil Enock $50 is a refund**, not an expense. Mark `Exclude from Financials`, Reason=`Refund (Netted Against Revenue)`.
6. **Partiful strategy:** build a web scraper in a later phase. User will log in; Claude can then identify Interplay events from their Partiful history and link revenue/expenses (e.g., snacks, ground transportation, flights).
7. **Founders' dashboard** is an Airtable Interface page — see mockup in §7.
8. **Dillon's contractor payments:** user will manually provide dates. Cross-check against QB export.

---

## 5. Plan, in order

### Phase 0 — QuickBooks extraction (BLOCKER — do first)
- **Verify QB MCP availability first**: run `ToolSearch` with `query: "quickbooks"`. If no tools returned, ask user to confirm MCP installation status.
- Pull full QB transaction history, with special attention to **Venmo Business transactions** which exist only there.
- Archive as a new Airtable table `QB Historical` OR as CSV files in Google Drive — **ask user which they prefer**.
- Cross-check Dillon's contractor payments against the dates user will provide manually.

### Phase 1 — Expenses schema fixes
On `tblO7Ux8RvI4l2Eac`:
- **Add to `Source` enum** (`fldSbEjKsPzf89Up8`): `Lunch Money`, `Venmo (Historical via QB)`.
- **New field**: `Lunch Money Transaction ID` (singleLineText) — idempotency key for re-syncs.
- **New field**: `Exclude from Financials` (checkbox).
- **New field**: `Exclusion Reason` (singleSelect): `Owner Withdrawal`, `Internal Transfer`, `Duplicate of Payout`, `Refund (Netted Against Revenue)`, `Personal`, `Other`.
- **New field**: `Linked Contractor` (multipleRecordLinks → Staff `tblG0Wg94I837qbiT`).
- **Convert `Category` to a linked `Categories` table** (recommended) — mirrors Lunch Money's category set without future schema migrations. Alternative: just expand the enum (less maintainable).
- **Expand `Account` enum** (`fldSjmHlPF9Tz4GC9`) — **ASK USER for the real list** (Mercury? Capital One Spark? Venmo Business historical? etc.).

### Phase 2 — Build `Stripe Charges` table
New table linked to Attendance and Events. Fields:

| Field | Type | Notes |
|---|---|---|
| Payment Intent ID | singleLineText (primary) | e.g. `pi_3TY99pF2Yd2BaKU40rSnG2hi` |
| Description | singleLineText | Carries event name |
| Created | date or dateTime | |
| Amount Gross | currency (USD) | |
| Stripe Fee | currency | **NOT available via Stripe MCP**; must come from Make.com |
| Refunded Amount | currency | |
| Net | formula | `{Amount Gross} - {Stripe Fee} - {Refunded Amount}` |
| Status | singleSelect | succeeded, canceled, refunded, partial_refund, failed |
| Customer ID | singleLineText | `cus_...` |
| Customer Email | email | Fetch via Stripe MCP `list_customers` |
| Linked Attendance | multipleRecordLinks → Attendance | |
| Linked Event | multipleRecordLinks → Events | |
| Match Confidence | singleSelect | exact, fuzzy, unmatched |

**Population strategy:**
- Stripe MCP for basics (id, amount, description, customer, status)
- Make.com Stripe scenario for fees and refund detail
- Matching logic: Stripe description → Events.Event Name (fuzzy); Stripe customer email → Attendance.Email (exact)

### Phase 3 — Convert Events.Gross Revenue / Stripe Fees / Refunds to rollups
After `Stripe Charges` is populated:
- `Events.Gross Revenue` → rollup of `Stripe Charges.Amount Gross` (status=succeeded) for linked charges
- `Events.Stripe Fees` → rollup of `Stripe Charges.Stripe Fee`
- `Events.Refunds` → rollup of `Stripe Charges.Refunded Amount`
- `Adjusted Gross` formula stays.

### Phase 4 — Reclassify the 166 existing QB-imported expenses
With Phase 1 fields in place:
- Violet Starkey $4,134 + $1,250 → Category=Contractor, Linked Contractor=Violet's Staff record, **keep in financials**.
- Phil Enock $50 → `Exclude from Financials`, Reason=`Refund (Netted Against Revenue)`.
- All Stripe-named lines → `Exclude`, Reason=`Duplicate of Payout`.
- All Venmo micro lines → `Exclude`, Reason=`Internal Transfer`.
- "Unknown vendor" rows → triage. After Phase 0 QB export with richer memos, most can be re-categorized.

### Phase 5 — Lunch Money ingest pipeline (Make.com)
- Build Make scenario: Lunch Money transactions → Airtable Expenses, keyed on `Lunch Money Transaction ID`.
- Map LM category → Airtable Category (linked table from Phase 1).
- Map LM account → Airtable Account.
- Set `Source=Lunch Money`.
- Run nightly or on LM webhook if available.

### Phase 6 — Populate reporting tables
- Backfill `Monthly Financials` for last 12 months (manual initial; automate going forward).
- **Add formula**: `Baseline Runway` = `{Cash Reserve End} / {Subscription Floor}`.
- **Add formula**: `Runway at Current Burn` = `{Cash Reserve End} / {Run Rate (3-mo avg)}`.
- Backfill `KPI Snapshots` from Attendance data.

### Phase 7 — Build the Founders Dashboard interface
Build as an Airtable Interface page on top of Monthly Financials + Events + Expenses + Subscriptions. Mockup in §7.

### Phase 8 — Schema cleanup
- Rename `Staff.Events` → `Events as Lead Facilitator`.
- Rename `Staff.Events 2` → `Events as Co-Facilitator`.
- Spot-check legacy IB totals against new rollups, then delete the two legacy fields.
- Delete free-text `Lead Facilitator`, `Co-Facilitator`, `Venue` fields on Events.

### Phase 9 (later) — Partiful scraper
For event/expense linkage of pre-Stripe history. User will log in to Partiful; scraper identifies Interplay events, associates revenue (approximately) and expenses (snacks, ground transportation, flights).

---

## 6. MCP tools needed

### Must verify connected at session start

| MCP | Status to verify | Notes |
|---|---|---|
| **Airtable** | required | Base ID above |
| **Stripe** | required | Read-only basics; fee data requires Make.com |
| **Make.com** | required | Powers Lunch Money pipeline |
| **QuickBooks** | **VERIFY FIRST** — installed mid-previous session, did not register | Run `ToolSearch` with query "quickbooks" before proceeding |
| **Google Drive** | required | CSV exports, receipts |
| **Ticket Tailor** | required | Event source-of-truth lookups |

### Not available, alternatives planned
- ❌ **Lunch Money MCP** — none exists; use Make.com pipeline.
- ❌ **Partiful MCP** — none exists; needs scraper (Phase 9).

### Loading tools efficiently
Many tools are deferred in this environment — load them via `ToolSearch` with `select:` queries. Example bundles:

**Airtable schema-write bundle:**
```
select:mcp__11b11aa6-a5a3-4649-8d08-add7e8a28119__create_table,mcp__11b11aa6-a5a3-4649-8d08-add7e8a28119__create_field,mcp__11b11aa6-a5a3-4649-8d08-add7e8a28119__update_field,mcp__11b11aa6-a5a3-4649-8d08-add7e8a28119__create_records_for_table,mcp__11b11aa6-a5a3-4649-8d08-add7e8a28119__update_records_for_table
```

**Airtable read bundle:**
```
select:mcp__11b11aa6-a5a3-4649-8d08-add7e8a28119__list_bases,mcp__11b11aa6-a5a3-4649-8d08-add7e8a28119__list_tables_for_base,mcp__11b11aa6-a5a3-4649-8d08-add7e8a28119__get_table_schema,mcp__11b11aa6-a5a3-4649-8d08-add7e8a28119__list_records_for_table,mcp__11b11aa6-a5a3-4649-8d08-add7e8a28119__list_pages_for_base
```

**Stripe bundle:**
```
select:mcp__3e7c4f96-8c15-4414-8994-22c40c4a2f41__fetch_stripe_resources,mcp__3e7c4f96-8c15-4414-8994-22c40c4a2f41__stripe_api_execute,mcp__3e7c4f96-8c15-4414-8994-22c40c4a2f41__stripe_api_search,mcp__3e7c4f96-8c15-4414-8994-22c40c4a2f41__search_stripe_resources,mcp__3e7c4f96-8c15-4414-8994-22c40c4a2f41__list_customers,mcp__3e7c4f96-8c15-4414-8994-22c40c4a2f41__list_payment_intents,mcp__3e7c4f96-8c15-4414-8994-22c40c4a2f41__list_refunds
```

**Important when reading `list_tables_for_base`:** the response is ~61KB and will exceed the per-tool-result token limit. It gets saved to a file at a path like `/root/.claude/projects/.../tool-results/mcp-11b11aa6-...-list_tables_for_base-*.txt`. Use `jq` via Bash to extract what you need rather than re-reading. Example:
```bash
jq '.tables | map({id, name, fieldCount: (.fields|length)})' <file>
```

---

## 7. Founders Dashboard mockup (target deliverable)

```
╔══════════════════════════════════════════════════════════════════════════╗
║   INTERPLAY  —  Founders Financial Dashboard           May 2026          ║
╠══════════════════════════════════════════════════════════════════════════╣
║   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  ║
║   │ CASH ON HAND    │  │ NET PROFIT MTD  │  │ BASELINE RUNWAY         │  ║
║   │   $24,318       │  │   + $1,420      │  │   4.8 months            │  ║
║   │   ▲ $2,100 Apr  │  │   ▼ vs $3,890   │  │   at $5,070/mo floor    │  ║
║   └─────────────────┘  └─────────────────┘  └─────────────────────────┘  ║
║                                                                          ║
║   ── CURRENT MONTH P&L ────────────────────────────────────────────────  ║
║      Gross Revenue (Stripe)                       $ 9,840                ║
║        − Refunds                                    (120)                ║
║        − Stripe Fees                                (310)                ║
║      Adjusted Gross                               $ 9,410                ║
║        − Facilitator Payouts                     (2,820)                 ║
║        − Venue Payouts                           (1,650)                 ║
║        − Contractors (LM)                        (1,200)                 ║
║        − Subscriptions                             (319)                 ║
║        − Marketing                                  (90)                 ║
║        − Other Expenses (LM)                       (91)                  ║
║      Net Profit                                  + $1,420                ║
║                                                                          ║
║   ── 12-MONTH TREND ─────────────────────────────────────────────────    ║
║      [ line chart: Gross • Adjusted Gross • Net Profit • Run Rate ]      ║
║                                                                          ║
║   ── UPCOMING OBLIGATIONS (next 30 days) ────────────────────────────    ║
║      • Venue payouts owed:        $1,420   (3 events, oldest 12d ago)    ║
║      • Facilitator payouts owed:    $880   (2 events)                    ║
║      • Subscription renewals:       $319                                 ║
║                                                                          ║
║   ── CLIENTELE PULSE ────────────────────────────────────────────────    ║
║      Unique attendees MTD:    47  (28 new · 19 returning)                ║
║      30-day retention:        31%                                        ║
║      Avg revenue / attendee:  $42                                        ║
║                                                                          ║
║   ── NEEDS ATTENTION ────────────────────────────────────────────────    ║
║      ⚠  14 expenses pending categorization in Lunch Money                ║
║      ⚠   2 expenses flagged as possible duplicate of a payout            ║
║      ⚠   Phil Enock $50 refund not linked to source charge               ║
╚══════════════════════════════════════════════════════════════════════════╝
```

A second page, **Per-Event P&L:**

```
EVENT: Intro to Relational Interplay — Berkeley · Apr 28, 2026
──────────────────────────────────────────────────────────────
Gross Revenue (Stripe)              $ 245
  Refunds                              (0)
  Stripe Fees                         (10)
Adjusted Gross                      $ 235
  Venue Payout (West Berkeley)         (60)
  Lead Facilitator (30%)               (71)
  Co-Facilitator (10%)                 (24)
  Direct event expenses                  (0)
─────────────────────────────────────────────
Event Profit                        $  80   (34% margin)

Attendance: 7 registered · 6 attended · 86% rate
1 first-timer · 5 returning · 2 via affiliate (Sasha)
```

---

## 8. Open questions to ask the user at session start

1. **What real bank/card accounts** should populate the expanded `Account` enum on Expenses? (Mercury checking? Capital One Spark? Venmo Business historical? others?)
2. **Convert `Category` to a linked Categories table, or just expand the enum?** Recommendation: linked table for maintainability.
3. **Where to archive QB history** — new Airtable table `QB Historical`, or CSV files in Google Drive?
4. **What's the actual `Subscription Floor` number** (recurring fixed monthly costs that must be paid no matter what)? Needed for runway math.
5. **Dillon's contractor payment dates** — user said they would provide manually for Venmo cross-check.
6. **Categories list from Lunch Money** — export the LM category list to pre-populate the new Categories table.

---

## 9. Recommended runbook for the first 30 minutes of the new session

1. **Verify MCP connections** — run two `ToolSearch` calls in parallel:
   - `query: "quickbooks"` (expect: tools listed; if "no matching deferred tools" then QB MCP still isn't registered — escalate to user)
   - The Airtable read bundle above
2. **Read this brief** carefully — do not re-do discovery.
3. **Ask the 6 open questions above** in a single `AskUserQuestion` call (or batch as appropriate).
4. **Start Phase 0**: pull QB transactions, isolate Venmo, archive.
5. **Then Phase 1**: schema changes to Expenses (additive only — no destructive changes yet).
6. **Hold off on Phase 4 (data reclassification) until Phase 1 fields exist AND user has approved the new Categories list AND user has confirmed the Account list.**

---

## 10. Status at handoff

- Discovery complete: schema mapped, data sampled, gaps identified, decisions confirmed with user.
- **No production writes have been made.** Safe starting point for the new session.
- Stripe MCP verified working (basic fields only).
- **QuickBooks MCP not present in previous session** — was installed mid-session and didn't register. New session should pick it up.
- First concrete task in the new session: verify QB MCP is now available, then proceed to Phase 0.
