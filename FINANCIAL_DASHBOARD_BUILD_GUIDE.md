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

All three new fields go on the **Events** table. Stay on that table for the whole phase.

**How to start each subsection (A.1, A.2, A.3) — same starting point every time:**

1. Open the base, click the **Events** table tab at the top.
2. Scroll right until you see the last column. The very last column header is `+` (plus icon). Click it.
3. A "Create field" panel opens on the right side of the screen with a name input and a type dropdown.

That's your starting point for each of A.1, A.2, and A.3 below.

---

### A.1 Create rollup: `Venmo Channel Revenue`

Starting from a fresh "Create field" panel on Events:

1. **Name:** type `Venmo Channel Revenue`
2. **Type:** click the type dropdown → choose **Rollup** (search "rollup" if you don't see it).
3. **Select rollup source** (linked records to summarize): pick the link field that points to **Income**. It's likely just named `Income` — it's the inverse field Airtable auto-created when we built the Income table.
4. **Field you want to roll up:** pick `Amount`.
5. Toggle on **"Only include linked records from the Income table that meet certain conditions"**.
6. In the condition row that appears: **Where** → `Source` → **is** → `Venmo`.
   - If `Source` isn't in the dropdown, leave the toggle off entirely — you can come back and add it later. Today every Income row is `Source=Venmo` anyway.
7. Confirm **Aggregation formula** is `SUM(values)` (it's the default).
8. Click the **Formatting** tab at the top of the panel. Set **Format** → **Currency**, **Symbol** → `$`, **Precision** → 2.
9. Click **Create** at the bottom right of the panel.

Verify: a new column `Venmo Channel Revenue` appears on the right. Most events will show $0; events that had matched Venmo income will show dollar values (about 28% of events).

---

### A.2 Create rollup: `Total Cost from Expenses`

Back on Events. Click the `+` at the end of the columns again to open a fresh "Create field" panel.

1. **Name:** `Total Cost from Expenses`
2. **Type:** **Rollup**
3. **Select rollup source:** the link field that points to **Expenses** (likely named `Expenses`).
4. **Field you want to roll up:** `Amount`
5. Toggle on **"Only include linked records from the Expenses table that meet certain conditions"**.
6. In the condition row: **Where** → `Exclude from Financials` → **is unchecked**.
   - When you pick a checkbox field, the operator dropdown changes to checkbox-specific options. No value field is needed.
7. **Aggregation formula:** `SUM(values)` (default).
8. **Formatting** tab → Currency, $, 2 decimals.
9. Click **Create**.

Note: today most events will show $0 here because almost no Expenses rows have `Linked Event` set yet. That's correct — this field becomes useful as you and Violet tag expenses to events over time.

---

### A.3 Create formula: `Total Revenue`

Back on Events. Click the `+` at the end of the columns one more time to open a fresh "Create field" panel.

1. **Name:** `Total Revenue`
2. **Type:** **Formula**
3. A formula editor appears in the panel. Paste exactly:
   ```
   {Gross Revenue} + IF({Venmo Channel Revenue}, {Venmo Channel Revenue}, 0)
   ```
   - The editor should show no red error. If it does, double-check the field names match exactly what you used in A.1 (case-sensitive: `Venmo Channel Revenue` not `venmo channel revenue`).
4. Click the **Formatting** tab → **Format as currency** → $, 2 decimals.
5. Click **Create**.

Verify: every event row now shows a dollar amount. For events with matched Venmo income, this should be larger than `Gross Revenue` alone.

---

### A.4 (Optional) Update `Net Revenue` to include Venmo income

`Net Revenue` already exists as a formula on Events. Its current formula uses defensive `IF({field}, {field}, 0)` wrappers around each term to handle blanks safely — keep that style; just swap the first reference from `{Gross Revenue}` to `{Total Revenue}`.

1. On Events, find the `Net Revenue` column. Right-click the column header.
2. Click **Edit field**.
3. In the formula editor, the existing formula reads roughly:
   ```
   {Gross Revenue} - IF({Refunds}, {Refunds}, 0) - IF({Venue Cost}, {Venue Cost}, 0) - IF({Stripe Fees}, {Stripe Fees}, 0)
   ```
   Change only the first reference. Final formula:
   ```
   {Total Revenue} - IF({Refunds}, {Refunds}, 0) - IF({Venue Cost}, {Venue Cost}, 0) - IF({Stripe Fees}, {Stripe Fees}, 0)
   ```
4. Click **Save**.

Skip this if you'd rather keep `Net Revenue` as a pure Stripe-only figure and use `Total Revenue` separately. Either is defensible — just be consistent.

---

## Phase B — Create 8 Named Views

You'll create 8 views total: 3 on Expenses, 2 on Income, 2 on Events, 1 on Subscriptions. Each Interface page in Phase C reads from one of these views — pre-naming them makes the Interface build mechanical.

**How to create a view (same pattern every time):**

1. Open the base.
2. Click the table tab at the top (e.g. `Expenses`).
3. Look at the **left sidebar**. You'll see existing views (like `Grid view`). At the top of that sidebar, click **+ Create new...**
4. A picker appears with view types — Grid, Calendar, Gallery, Kanban, etc. For everything in this phase, pick **Grid**.
5. Name the view exactly as listed below (the name matters — Phase C references these by name).
6. The new view opens. Now apply filters and sort:
   - **Filter:** click the funnel icon ⨄ in the toolbar above the records → **+ Add condition** → pick the field + operator + value as listed.
   - **Sort:** click the sort icon (the two arrows) in the toolbar → **+ Add sort** → pick the field + direction.
   - **Group** (only B.1's "By Month" view): click the group icon → **+ Add group** → pick `Month` → direction `Z → A` (descending).
7. The view auto-saves; nothing to click to confirm. Click the table tab to leave; the view stays in the sidebar.

That's the entire mechanic. Repeat 8 times below.

---

### B.1 Expenses table — 3 views

Switch to the **Expenses** table tab.

**View 1: `Dashboard — Active`**
- Filter: `Exclude from Financials` → **is unchecked**
- Sort: `Date` → descending

**View 2: `Dashboard — Review Queue`**
- Filter: `Needs Violet Review` → **is checked**
- Sort: `Date` → descending

**View 3: `Dashboard — By Month`**
- Filter: `Exclude from Financials` → **is unchecked**
- Group: `Month` → descending (this collapses the table into month sections)
- Sort within group: `Amount` → descending

---

### B.2 Income table — 2 views

Switch to the **Income** table tab.

**View 1: `Dashboard — Active`**
- Filter: none
- Sort: `Date` → descending

**View 2: `Dashboard — Unmatched`**
- Filter: `Match Confidence` → **is** → `Unmatched`
- Sort: `Date` → descending

---

### B.3 Events table — 2 views

Switch to the **Events** table tab.

**View 1: `Dashboard — Past Events`**
- Filter: `Status` → **is** → `Held`
- Sort: `Date` → descending

**View 2: `Dashboard — Upcoming Events`**
- Filter: `Status` → **is** → `Scheduled`
- Sort: `Date` → ascending

---

### B.4 Subscriptions table — 1 view

Switch to the **Subscriptions** table tab.

**View 1: `Dashboard — Active Floor`**
- Filter: `Status` → **is** → `Active`
- Sort: `Monthly Cost` → descending

---

**Verify Phase B is done:** open each table's sidebar in turn — you should see the views above by name, each with a small filter icon next to it (indicating filters are applied). Total views created across all tables: 8.

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
