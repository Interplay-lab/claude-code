# Relational Interplay — Financial Dashboard Build Guide

**Goal:** A 4-page Airtable Interface that gives Peter and Violet a clean view of monthly financials, event profitability, and the bookkeeper review queue.

**Status of underlying data as of 2026-05-17:**

- ✅ Expenses table populated (~395 Venmo expense rows + 3 transfers, Source-tagged)
- ✅ Income table created and populated (~398 Venmo income rows)
- ✅ Events table populated (39 events with Partiful metadata)
- ✅ `Month` formula field added to Expenses, Income, and Events
- ✅ All Venmo-imported rows flagged `Needs Violet Review = true`
- 🟡 Two rollups + one formula on Events still need to be added (Phase A below — can't be done via API)
- 🟡 Seven views still need to be created (Phase B — can't be done via API)
- 🟡 The Interface itself needs to be assembled (Phase C — designer is UI-only)

This document walks Phases A → B → C. Plan ~30-45 min to complete.

---

## Phase A — Add Two Rollups and One Formula on Events

These three fields are what makes per-event profitability work. They require Airtable's UI.

### A.1 Create rollup: **Venmo Channel Revenue**

1. Open the **Events** table.
2. Right-click any column header → **Insert field right**.
3. Field name: `Venmo Channel Revenue`
4. Field type: **Rollup**
5. Configuration:
   - **Linked records:** the link to `Income` (Airtable auto-created this when we added the Income table; it's probably called "Income" — look for the `multipleRecordLinks` field that points at Income)
   - **Field to roll up:** `Amount`
   - **Aggregation formula:** `SUM(values)`
   - **Filter:** optional — only sum where `{Source} = "Venmo"` (we currently only have Venmo income, but this future-proofs against Cash App rows later). To do this, set the formula to: `SUM(IF(ARRAYJOIN({Source}, ',') = "Venmo", values, 0))` — actually simpler: just use `SUM(values)` and trust that this rollup is only meant for Venmo. We can refine later.
   - **Format:** Currency, $, 2 decimals
6. **Save**.

You should see non-zero values for events that have linked Income rows (about 28% of events — the rest only had ticket-tailor revenue, which is already in `Gross Revenue`).

### A.2 Create rollup: **Total Cost from Expenses**

1. Same drill — **Insert field right** on Events.
2. Field name: `Total Cost from Expenses`
3. Field type: **Rollup**
4. Configuration:
   - **Linked records:** the link to `Expenses` (named `Expenses` — should already exist as an inverse of `Expenses.Linked Event`)
   - **Field to roll up:** `Amount`
   - **Aggregation formula:** `SUM(values)`
   - **Filter:** `NOT({Exclude from Financials})` — exclude bank-transfer rows
   - **Format:** Currency, $, 2 decimals
5. **Save**.

Note: today this will be $0 for most events because the Venmo backfill didn't link expenses to events (Linked Event is empty on Expenses). That's fine — it's the field we'll use going forward as you tag expenses to events.

### A.3 Create formula: **Total Revenue (all channels)**

1. Insert field right.
2. Field name: `Total Revenue`
3. Field type: **Formula**
4. Formula:
   ```
   {Gross Revenue} + IF({Venmo Channel Revenue}, {Venmo Channel Revenue}, 0)
   ```
5. Format: Currency, $, 2 decimals.

### A.4 Optional: update `Net Revenue` to use Total Revenue

The existing `Net Revenue` formula is `Gross - Refunds - Venue Cost - Stripe Fees`. To include Venmo income, change it to:

```
{Total Revenue} - {Refunds} - {Venue Cost} - {Stripe Fees}
```

(Right-click `Net Revenue` → **Edit field** → update formula → Save.)

---

## Phase B — Create the Seven Views

Each Interface page below pulls from a named view. Pre-creating these makes the Interface build mechanical.

For each: open the table, click **+ Create view** (left panel), pick the view type, name it exactly as shown, then set the filters.

### B.1 Expenses table

| View name | Type | Filter | Sort |
|---|---|---|---|
| `Dashboard — Active` | Grid | `Exclude from Financials` is unchecked | `Date` desc |
| `Dashboard — Review Queue` | Grid | `Needs Violet Review` is checked | `Date` desc |
| `Dashboard — By Month` | Grid (grouped) | `Exclude from Financials` is unchecked | Group by `Month` desc, then `Amount` desc |

### B.2 Income table

| View name | Type | Filter | Sort |
|---|---|---|---|
| `Dashboard — Active` | Grid | (no filter) | `Date` desc |
| `Dashboard — Unmatched` | Grid | `Match Confidence` is `Unmatched` | `Date` desc |

### B.3 Events table

| View name | Type | Filter | Sort |
|---|---|---|---|
| `Dashboard — Past Events` | Grid | `Status` is `Held` | `Date` desc |
| `Dashboard — Upcoming Events` | Grid | `Status` is `Scheduled` | `Date` asc |

### B.4 Subscriptions table

| View name | Type | Filter | Sort |
|---|---|---|---|
| `Dashboard — Active Floor` | Grid | `Status` is `Active` | `Monthly Cost` desc |

---

## Phase C — Build the Interface

1. In Airtable, click **Interfaces** (top nav) → **+ Create interface** → choose **Blank**.
2. Name it: **Financial Dashboard**.
3. Add 4 pages in this order. Detailed page configs below.

### Page 1: Overview

**Layout:** Dashboard layout

**Add elements (top to bottom, left to right):**

1. **Number element** — "Gross Revenue This Month"
   - Source: Events table, `Dashboard — Past Events` view
   - Calculation: SUM of `Total Revenue` where `Month` = `THIS_MONTH` (use Airtable's filter pane to filter by current month)
2. **Number element** — "Total Expenses This Month"
   - Source: Expenses table, `Dashboard — Active` view
   - Calculation: SUM of `Amount` where `Month` = `THIS_MONTH`
3. **Number element** — "Net Profit This Month"
   - Source: Events (same view)
   - Calculation: SUM of `Net Revenue` — sum of `Expenses.Amount` for this month. Note: Airtable Interfaces can't subtract across tables in one number element — workaround is to add both numbers side-by-side and let the viewer compute. Or use a formula field on a synthetic Monthly Financials table (deferred — see "Stretch" below).
4. **Number element** — "Subscription Floor"
   - Source: Subscriptions table, `Dashboard — Active Floor` view
   - Calculation: SUM of `Monthly Cost`
5. **Chart element** — "Revenue trend (12 months)"
   - Source: Events table, `Dashboard — Past Events` view
   - Type: Line chart
   - X-axis: `Month` (group)
   - Y-axis: SUM of `Total Revenue`
6. **Chart element** — "Expenses by category (this month)"
   - Source: Expenses table, `Dashboard — Active` view
   - Type: Donut
   - Slice by: `Category`
   - Filter: `Month` = `THIS_MONTH`
   - Aggregate: SUM of `Amount`
7. **Number element** — "Review queue size"
   - Source: Expenses table, `Dashboard — Review Queue` view
   - Calculation: COUNT
   - Click action: navigate to Page 4

### Page 2: Events

**Layout:** Record list layout

**Configuration:**

- Source: Events table, `Dashboard — Past Events` view
- Columns to show (in order): `Date`, `Event Name`, `Location`, `Format`, `Total Registrations`, `Total Attended`, `Total Revenue`, `Venue Cost`, `Stripe Fees`, `Total Cost from Expenses`, `Net Revenue`
- Sort: by `Date` desc
- Filters in toolbar: `Location` (multi), `Format` (multi), `Status` (multi)
- Row action: open Detail view showing all fields + linked records

Add a second tab on this page: **Upcoming**
- Source: `Dashboard — Upcoming Events` view
- Same columns

### Page 3: Money in/out

**Layout:** Tabs

**Tab 3a: Income**
- Source: Income table, `Dashboard — Active` view
- Columns: `Date`, `Payer`, `Amount`, `Source`, `Linked Event`, `Match Confidence`, `Memo`
- Filters: `Month`, `Source`, `Inferred Market`
- Sort: `Date` desc
- Optional: add a Number element above the table showing SUM of `Amount` for current filter

**Tab 3b: Expenses**
- Source: Expenses table, `Dashboard — Active` view
- Columns: `Date`, `Vendor`, `Description`, `Amount`, `Category`, `Source`, `Linked Event`, `Frequency`
- Filters: `Month`, `Category`, `Source`, `Frequency`, `Needs Categorization`
- Sort: `Date` desc

**Tab 3c: Subscriptions**
- Source: Subscriptions table, `Dashboard — Active Floor` view
- Columns: `Service Name`, `Vendor Aliases`, `Category`, `Frequency`, `Amount`, `Monthly Cost`, `Renewal Date`, `Owner`, `Auto-Pay From`, `Notes`
- Number element above: SUM of `Monthly Cost` — this is the headline number

### Page 4: Review queue

**Layout:** Tabs

**Tab 4a: Expenses to review**
- Source: Expenses table, `Dashboard — Review Queue` view
- Columns: `Date`, `Vendor`, `Amount`, `Category`, `Source`, `Notes`, `Needs Violet Review` (checkbox — clickable to mark reviewed)
- Sort: `Date` desc (oldest first by re-sort if Violet prefers FIFO)
- Inline editing enabled on `Category`, `Linked Event`, `Needs Violet Review`

**Tab 4b: Income to match**
- Source: Income table, `Dashboard — Unmatched` view
- Columns: `Date`, `Payer`, `Amount`, `Memo`, `Inferred Market`, `Linked Event` (clickable to link)
- Inline editing enabled on `Linked Event`, `Match Confidence`, `Notes`

**Tab 4c: Counts at top of page** (number elements above the tabs)
- "Expenses to review" — COUNT of Expenses Review Queue view
- "Income to match" — COUNT of Income Unmatched view

---

## Phase D — Share with Violet

1. Once the Interface looks right in your view, click **Share** (top right of the Interface designer).
2. Set **Share with specific people** → add Violet's email → role: **Editor** (so she can click checkboxes / link records) or **Commenter** (read-only).
3. Do NOT make it public-link-shareable. Each viewer must be signed in to their Airtable account.

This gives you Airtable-native auth (email-based, 2FA-able through Google/etc.), no separate password management, no API keys in the picture.

---

## Stretch — Build Monthly Financials Properly Later

The existing `Monthly Financials` table is empty. If you want a clean monthly P&L row that the dashboard can display directly (instead of doing the math in Interface number elements), you'd:

1. Build Scenario 6 in Make.com (already listed as planned).
2. On the 1st of each month, it rolls up the prior month: sum Events.Total Revenue, sum Expenses.Amount where Exclude=false, sum Facilitator Payouts, etc. → writes one Monthly Financials row.
3. The Overview page would then show 12 rows in a line chart with one query — much cleaner than per-element filters.

Defer this until you've used the dashboard for a month and know it's worth the investment.

---

## Troubleshooting

- **The Month formula shows blank.** Check that the row has a `Date` value. Transfer rows and a few historical rows may legitimately have no date.
- **Venmo Channel Revenue is $0 for all events.** Check that the matching pass linked Income to Events. If most income rows are `Unmatched`, the rollup is mostly zero by design. Re-run matching (with smarter rules) or manually link in Tab 4b.
- **Total Cost from Expenses is $0.** Today this is expected — the Venmo backfill didn't auto-link expenses to events. Linking happens manually as you tag rows in Tab 4a.
- **The number elements feel like they're showing the wrong period.** Airtable Interfaces apply "current month" based on the viewer's timezone; double-check it matches yours.

---

## What to do if you get stuck

Send me a screenshot + a one-line description of where you're stuck. I can usually unstick most things from there since the underlying data + views are stable.
