# Airtable Automation Setup

Three automations to configure inside the **Relational Interplay Events & Operations** base. All three use Airtable's native automation builder (Automations tab, top-right). No Make.com needed.

## Time zone

Set Airtable's automation time zone to **America/Denver** (Mountain Time) before configuring schedules. Profile picture (top-right) → Account → Time zone.

---

## Automation 1: Cache Event Date on Facilitator Payouts

Keeps the `Event Date (cached)` field in sync with the linked event's date. Drives the `Eligible Date` formula.

1. **Trigger** → "When record matches conditions"
   - Table: `Facilitator Payouts`
   - Conditions (all must match):
     - `Event` is not empty
     - `Event Date (cached)` is empty
2. **Action** → "Run script"
   - Input variable:
     - Name: `recordId`
     - Value: Trigger record → Airtable record ID
   - Script: paste contents of `01-cache-event-date.js`
3. Test on an existing or new Facilitator Payouts row, then **Turn on**.

---

## Automation 2: Monthly Payout Setup (1st of month, 9:00 AM MT)

Creates Pay Periods, Salary Log entries, Profit Share rows, and promotes ripe Facilitator Payouts. Then sends Violet the approval email.

1. **Trigger** → "At a scheduled time"
   - Frequency: Monthly
   - Day of month: 1
   - Time: 9:00 AM
   - (Confirm the time zone reads as Mountain Time.)
2. **Action 1** → "Run script"
   - No input variables.
   - Script: paste contents of `02-monthly-payout-setup.js`
3. **Action 2** → "Send email"
   - To: `violetstarkeyhere@gmail.com`
   - Subject: `Pay rows ready to review — {{Step 2: monthName}}`
   - Body (rich text):

     ```
     Hi Violet,

     The monthly payout setup just ran for {{Step 2: monthName}}.

     Created:
     • {{Step 2: summary.payPeriods}} Pay Period rows (hourly contractors)
     • {{Step 2: summary.salaries}} Salary Log entries (Capital One auto-paid; informational)
     • {{Step 2: summary.profitShares}} Profit Share rows (your 15% of $${{Step 2: adjustedGross}} adjusted gross)
     • {{Step 2: summary.promoted}} Facilitator Payouts past their 7-day refund window are now Ready for Review

     Please:
     1. Open the base, fill in Total Hours on each Pay Period from the Toggl monthly report.
     2. Review every row.
     3. Flip Status to "Approved" for everything that should pay out.
     4. For Johanna's row, also check the "Approved by Violet (for Johanna)" box.

     The bookkeeper email auto-sends on the 5th. Anything not Approved by then waits until next month.
     ```
4. Test the trigger (Airtable lets you simulate a scheduled run), confirm rows are created and email arrives, then **Turn on**.

---

## Automation 3: Monthly Bookkeeper Email (5th of month, 9:00 AM MT)

Collects everything Approved + Eligible and sends one email to Johanna.

1. **Trigger** → "At a scheduled time"
   - Frequency: Monthly
   - Day of month: 5
   - Time: 9:00 AM Mountain Time
2. **Action 1** → "Run script"
   - No input variables.
   - Script: paste contents of `03-monthly-bookkeeper-email.js`
3. **Action 2** → "Send email"
   - **Conditional**: only run if `{{Step 2: hasRows}}` is true. (Wrap the Send Email step in a Conditional logic block, condition = "Step 2 hasRows is exactly true". Skips sending an empty email when nothing is approved.)
   - To: `finance.interplay@gmail.com`
   - CC: `violetstarkeyhere@gmail.com`  *(optional — gives Violet a copy)*
   - Subject: `{{Step 2: subject}}`
   - Body type: Rich text / HTML
   - Body: `{{Step 2: bodyHtml}}`
4. Test, then **Turn on**.

---

## Operational notes

### Monthly cycle (steady state)

| When | What |
|---|---|
| 1st, 9am MT | Automation 2 fires. Violet gets approval email. |
| 1st–4th | Violet enters Total Hours on each Pay Period (from Toggl monthly report) and flips Status to Approved on rows that should pay. Checks "Approved by Violet (for Johanna)" on Johanna's row. |
| 5th, 9am MT | Automation 3 fires. Bookkeeper email sent to finance.interplay@gmail.com. Rows flip to "Sent to Bookkeeper". |
| 5th onward | Johanna pays via Gusto, then marks each row "Paid" + Date Paid in Airtable. |

### Status workflow per row

```
Draft  →  Ready for Review  →  Approved  →  Sent to Bookkeeper  →  Paid
```

- **Draft**: just created, not actionable yet
- **Ready for Review**: facilitator payouts past their 7-day refund window; all monthly rows after they're created
- **Approved**: Violet has reviewed and signed off
- **Sent to Bookkeeper**: included in the latest bookkeeper email; awaiting payment
- **Paid**: Johanna confirmed payment in Gusto

### Phase 3 will add (later)

- Toggl → Time Entries sync via Make.com
- Auto-rollup of Total Hours from Time Entries (replaces manual entry)
- Auto-creation of IB Ledger credit rows from each Pay Period's IB Earned

For now, Total Hours is entered by hand from Toggl's monthly summary report — quick because there's only ~6 hourly contractors.
