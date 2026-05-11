# Relational Interplay — Airtable System Guide

**Base:** Relational Interplay Events & Operations (`appONwRwGnRvhPgHc`)  
**Last updated:** 2026-05-11 (revised — post-automation-sprint)

This document describes every table in the Airtable base, what it tracks, and the explicit path by which each field is populated — whether that is an automated pipeline, an Airtable formula, a manual data entry step, or a planned but not-yet-built automation.

---

## System Architecture Overview

Data flows through four main layers:

1. **Ticket Tailor** — source of truth for events, ticket sales, and registrations
2. **Airtable** — operational hub for events, attendance, people, finances, and reporting
3. **Make.com** — automation middleware connecting all systems
4. **ActiveCampaign** — CRM and email marketing; receives contact and tag data from Airtable

Supporting systems: Zoom (online events), Google Calendar (scheduling), Toggl (time tracking), QuickBooks (accounting), Stripe (payments), PayPal (vendor/affiliate payouts), Gusto (contractor payroll).

---

## Make.com Automation Inventory

| Scenario | ID | Status | Trigger | What it does |
|---|---|---|---|---|
| TT New Event → Airtable | 4984070 | ✅ Active | TT EVENT.CREATED webhook | Creates Airtable Events record, Google Calendar event, stores Zoom ID in data store |
| TT Event Updated → Airtable | 4984169 | ✅ Active | TT EVENT.UPDATED webhook | Updates matching Airtable Events record when TT event changes |
| Toggl → Airtable Time Entries | 4985926 | ✅ Active | Polling every 30 min | Syncs Toggl entries to Time Entries table, links to People and Pay Periods |
| Zoom → AC Attendance | 4983210 | ✅ Active | Zoom meeting.ended webhook | Tags AC contacts as Attended after Zoom meeting ends |
| Airtable Attendance → ActiveCampaign | 4996835 | ⚠️ Needs re-save | Airtable Attendance trigger | Upserts AC contact, subscribes to list, applies all tags |
| Attendance No-Show → ActiveCampaign | 5030965 | ✅ Active | Daily schedule | Finds past-event non-attendees, tags with No-Show + format/hub/training tags in AC |
| TT New Order → Zoom Registration | 5032912 | ✅ Active | Polling every 15 min | Polls TT completed orders, registers each ticket holder in the linked Zoom meeting via datastore lookup |
| F1: Event Financials → Airtable | 5032559 | ✅ Active | Daily schedule | Pulls TT order totals per event; writes Gross Revenue, Refunds, and calculated Stripe Fees (2.9% of gross) to Events |
| F2: Zoom Attendance Count → Airtable | 5026038 | ✅ Active | Daily schedule | Pulls Zoom participant reports for online events held yesterday; writes Total Attended count to Events |
| F3: Venue Cost → Airtable Events | 5033099 | ✅ Active | Daily schedule | For Held in-person events with blank Venue Cost, looks up highest-priority matching Venue Pricing Rule and writes computed cost to Events |
| F4: TT Check-ins → Airtable Attended | 5030860 | ✅ Active | Daily schedule | For in-person events held the prior day, pulls TT check-in data and marks Attendance.Attended checkbox true/false per email match |
| Ticket Tailor → Airtable | 4983848 | ❌ Broken/inactive | TT new orders | Creates Attendance records (needs rebuild) |
| Ticket Tailor → ActiveCampaign | 4798719 | ❌ Broken/inactive | TT new orders | Old combined scenario; superseded; Google Sheets connection deleted |
| Affiliate Signup → TT Discount Code | 5008276 | 🚧 Draft | Airtable Affiliates trigger | Creates TT voucher, sends welcome email (partially built) |
| QuickBooks → Expenses | 4998282 | 🚧 Partial | Daily schedule | Imports QB transactions to Expenses table (running but has errors) |
| Zoom → Google Drive Archive | 4956915 | ❌ Inactive | Zoom recording webhook | Archives Zoom recordings to Google Drive (0 executions) |

**Make.com connections in use:**
- Airtable connection 8741307 — API key, no expiration
- ActiveCampaign connection 7276134 — API key, no expiration
- Zoom connection 8699938 — OAuth, connect@letsinterplay.com (reauthorized 2026-05-11); `report:read:admin` scope required for F2
- Stripe OAuth connection 7832881 — OAuth, expires 2027-03-30; NOT used with http:ActionSendData (incompatible)
- Datastore 97722 — TT event ID → Zoom meeting ID mapping (used by 5032912)

**Scenarios not yet built (planned):**
- Scenario 5b: Stripe fees → Expenses (note: F1 already writes calculated fees to Events; 5b would be a separate per-transaction log to Expenses)
- Scenario 5c: PayPal outflows → Expenses + reconcile Venue Payouts
- Scenario 5d: Auto-create Venue Payout 3 days after event
- Scenario 6: Monthly Financials + KPI Snapshots rollup (runs 1st of month)
- Monthly Payout Setup: Creates Pay Periods + Profit Share Payouts + Salary Log rows on 1st of month

---

## ActiveCampaign Tag Taxonomy

Tags are applied by Make.com scenarios — primarily by "Airtable Attendance → ActiveCampaign" (4996835) when a new Attendance record is created.

| Prefix | Tags | Applied when |
|---|---|---|
| **ACTION** | ACTION: Registered | Any new Attendance record created |
| **STATUS** | STATUS: Attended | Attended checkbox = true on Attendance record |
| **STATUS** | STATUS: No-Show | Daily batch: past event, not attended (scenario 5008218) |
| **MEMBER** | Community Member | Every Attendance record (universal tag) |
| **EVENT TYPE** | EVENT TYPE: Intro, EVENT TYPE: Deepen, EVENT TYPE: Training | From Attendance.Event Format formula field |
| **HUB** | HUB: East Bay, HUB: San Francisco, HUB: Boulder, HUB: Denver, HUB: Online, HUB: Colorado, HUB: Bay Area | From Attendance.Home Market / event Location |
| **TEAM** | TEAM: Facilitator | Applied manually to facilitator contacts |
| **MEMBER** | MEMBER: Paid Community | Applied manually or via series enrollment |
| **INTENT** | INTENT: High, INTENT: Low | Manual or future automation |
| **HIST** | HIST: [Program Name] | Historical import tags (legacy events pre-Airtable) |
| **IMPORT** | IMPORT: Master-Email-List-2026 | One-time bulk import flag |

> **Note on EVENT TYPE: Training:** Applied when the linked event name contains "Relational Dojo", "Accelerated Evolution", "Coach Training", or "Facilitator Training". Computed via the Event Format formula field in Attendance, not from a direct TT field.

---

## Table Reference

---

### 1. Events (`tbluhZWwFK0wVWm1Z`)

**Purpose:** Central record for every RI event occurrence. One row per event date. Source of truth for revenue, attendance rates, and facilitator payout calculations.

| Field | Type | How it arrives |
|---|---|---|
| Event Name | Text | **Auto** — Make.com 4984070 from TT event name on creation |
| Event Type | Single select (Online / In-Person / Practice Session) | **Auto** — 4984070 computes from `online_event` flag in TT |
| Format | Single select (Intro / Deepen / Relational Dojo / Accelerated Evolution / Practice Night / Retreats) | **Auto** — 4984070 computes from keywords in event name |
| Date | Date | **Auto** — 4984070 from TT `start.date` |
| Location | Single select (Boulder / Denver / East Bay / Online / San Francisco) | **Auto** — 4984070 infers from TT venue name or online flag |
| Venue | Text | **Auto** — 4984070 from TT `venue.name` |
| Ticket Tailor URL | URL | **Auto** — 4984070 from TT `checkout_url` |
| Zoom Link | URL | **Auto** — 4984070 from TT `online_link` (manually set in TT before creating event) |
| TT Event ID | Text | **Auto** — 4984070 from TT `ev_XXXXX` event ID |
| Lead Facilitator | Text | **Auto** — 4984070 reads TT facilitator tags (`mike-lead`, `sena-lead`, etc.) |
| Co-Facilitator | Text | **Auto** — 4984070 reads TT co-facilitator tags |
| Facilitator Role | Single select (Solo / Co-Hosted) | **Auto** — 4984070 infers from presence of co-facilitator tag |
| Lead Facilitator (Person) | Linked → People | **Auto** — 4984070 maps TT tag to People record ID |
| Co-Facilitator (Person) | Linked → People | **Auto** — 4984070 maps TT tag to People record ID |
| Status | Single select (Scheduled / Held / Cancelled) | **Manual** — default Scheduled; flip to Held after event occurs |
| Gross Revenue | Currency | **Auto** — Make.com F1 (5032559) sums TT order totals for Held events; runs daily |
| Refunds | Currency | **Auto** — Make.com F1 (5032559) sums TT refund amounts for Held events; runs daily |
| Venue Cost | Currency | **Auto** — Make.com F3 (5033099) looks up highest-priority matching Venue Pricing Rule and writes computed cost; runs daily for Held in-person events with blank Venue Cost. Override manually if actual cost differs. |
| Stripe Fees | Currency | **Auto** — Make.com F1 (5032559) calculates as 2.9% of Gross Revenue; runs daily. Note: this is an estimate; actual per-transaction fees vary by ~$0.30/txn. |
| Net Revenue | Formula | **Auto** — Gross − Refunds − Venue Cost − Stripe Fees |
| Adjusted Gross | Formula | **Auto** — Gross − Refunds (basis for Violet's profit share) |
| Total Registrations | Number | **Manual** — enter from TT sales report (automation planned) |
| Total Attended | Number | **Auto (online)** — Make.com F2 (5026038) pulls Zoom participant report the day after the event and writes the count. **Auto (in-person)** — Make.com F4 (5030860) counts TT check-ins the day after the event. Manual fallback if neither runs. |
| Attendance Rate (%) | Formula | **Auto** — Total Attended ÷ Total Registrations |
| Duration Hours | Number | **Manual** — required for venue payout rule matching |
| Venue (Linked) | Linked → Venues | **Manual** — link to Venues table for in-person events |
| Counts For Return Rate | Checkbox | **Manual** — default checked; uncheck for sessions 2–N of multi-session series |
| Notes | Text | **Manual** |
| Attendance | Linked → Attendance | **Auto** — inverse of Attendance.Event link |
| Facilitator Payouts | Linked → Facilitator Payouts | **Auto** — inverse of Facilitator Payouts.Event link |
| Expenses | Linked → Expenses | **Auto** — inverse link |
| Venue Payouts | Linked → Venue Payouts | **Auto** — inverse link |
| Series Rosters | Linked → Series Rosters | **Auto** — inverse link |

> **Automation status:** Gross Revenue, Refunds, Stripe Fees, Venue Cost, and Total Attended are now populated automatically by F1–F4. Total Registrations is the last major financial field still requiring manual entry.

---

### 2. Attendance (`tblOnjg68hW3e7wS8`)

**Purpose:** One row per attendee per event. The join table between people and events. Drives all retention metrics, return rate calculations, and ActiveCampaign tagging.

| Field | Type | How it arrives |
|---|---|---|
| Contact Name | Text | **Auto** — Make.com 4983848 from TT `buyer_details.name` (scenario needs fixing) |
| Email | Email | **Auto** — 4983848 from TT `buyer_details.email` |
| Phone | Phone | **Auto** — 4983848 from TT `buyer_details.phone` |
| Event | Linked → Events | **Auto** — 4983848 links to Events by TT event ID |
| Ticket Type | Single select | **Auto** — 4983848 from TT ticket type name |
| Amount Paid | Currency | **Auto** — 4983848 from TT `listed_price` |
| Registration Date | Date | **Auto** — 4983848 from TT order `created_at` |
| Attended | Checkbox | **Auto (in-person)** — Make.com F4 (5030860) matches by email against TT check-in data the day after the event and sets true/false. **Manual (online)** — online event attended status is still set manually; Zoom → AC tagging runs via 4983210 but does not write back to Airtable Attendance rows. |
| First Event Ever | Checkbox | **Manual** — check only if this is the person's first ever RI event. Critical for return rate. |
| Return Visit | Checkbox | **Manual** — check if they've attended before |
| Home Market | Single select | **Manual/Convention** — set from event location for in-person; for online, set based on where they live |
| Referral Source | Single select | **Manual** — from TT checkout custom question (automation planned) |
| Referred By | Text | **Manual** — from TT custom question |
| City | Text | **Manual** — online events only; from TT checkout |
| State / Province | Text | **Manual** — online events only |
| Country | Text | **Manual** — online events only; leave blank if US |
| Affiliate | Linked → Affiliates | **Auto** — Make.com matches TT order voucher code to Affiliates.Final Code |
| Attendee Notes | Text | **Manual** |
| Event Format | Formula | **Auto** — computed from linked Event name using FIND() chains. Returns: Intro / Deepen / Relational Dojo / Accelerated Evolution / Practice Night. Used by AC tagging scenario. |
| Created At | Formula | **Auto** — `CREATED_TIME()`. Used as trigger field for Make.com scenario 4996835. |
| Affiliate Commissions | Linked → Affiliate Commissions | **Auto** — inverse link |

> **Trigger for AC pipeline:** When a new row appears in Attendance, Make.com scenario 4996835 fires within 15 minutes and upserts the contact in ActiveCampaign, subscribes to List 3, and applies all relevant tags.

> **Attended checkbox — in-person now automated:** F4 (5030860) handles in-person events automatically. Online event attended checkboxes remain manual; the Zoom webhook (4983210) tags contacts in AC but does not write back to Airtable individual Attendance rows.

---

### 3. Series Rosters (`tblcdvTCAJHcvqFY3`)

**Purpose:** One row per registrant in a multi-session program (Relational Dojo, Accelerated Evolution, Coach Training, Facilitator Training, Retreat). Separate from Attendance because series registrants pay upfront for a cohort, not per-event.

| Field | Type | How it arrives |
|---|---|---|
| Contact Name | Text | **Auto** — Make.com from TT order `buyer_details.name` |
| Email | Email | **Auto** — Make.com from TT order |
| Phone | Phone | **Auto** — Make.com from TT order |
| Amount Paid | Currency | **Auto** — Make.com from TT `listed_price` |
| Series Name | Single select | **Auto** — Make.com infers from TT event/ticket type name |
| Registration Date | Date | **Auto** — Make.com from TT order `created_at` |
| Ticket Type | Single select | **Auto** — Make.com from TT ticket type |
| Event | Linked → Events | **Manual** — link to first session of the series |
| Confirmation Sent | Checkbox | **Manual** — check once welcome email is sent via AC |
| Affiliate | Linked → Affiliates | **Auto** — Make.com email-match: if this email appears in Attendance tagged to an affiliate |
| Notes | Text | **Manual** |
| Affiliate Commissions | Linked → Affiliate Commissions | **Auto** — inverse link |

> **Series Rosters is the trigger for affiliate commission creation.** When a new row is created, Make.com checks whether the email exists in Attendance rows associated with an affiliate, and if so, creates an Affiliate Commissions record.

---

### 4. People (`tblG0Wg94I837qbiT`)

**Purpose:** Canonical HR record for all RI team members — employees (W2) and contractors. Controls payout eligibility, IB accrual, pay cadence, and Toggl attribution.

| Field | Type | How it arrives |
|---|---|---|
| Name | Text | **Manual** — created by admin when onboarding |
| Email, Phone | Contact | **Manual** |
| Type | Single select (Employee / Contractor) | **Manual** |
| Role | Text | **Manual** |
| Status | Single select (Active / Onboarding / Inactive) | **Manual** |
| Hourly Rate | Currency | **Manual** — leave blank for event-% teachers |
| Monthly Salary | Currency | **Manual** — Peter and Violet only ($2,700/mo each) |
| Interplay Bucks Rate | Number | **Manual** — IB per hour (e.g., 5 = 5 IB/hour) |
| Eligible for Event Payouts | Checkbox | **Manual** — checked for facilitators; unchecked for Peter/Violet |
| Eligible for Profit Share | Checkbox | **Manual** — currently only Violet |
| Profit Share % | Percent | **Manual** — Violet = 15% |
| Pay Cadence | Single select | **Manual** — Monthly (hourly contractors) / Event-based (facilitators) / Salary (logged only) |
| Payout Method | Single select | **Manual** — Gusto / PayPal / etc. |
| Toggl User ID | Text | **Manual** — numeric ID from Toggl admin; required for time entry attribution |
| All linked tables | Links | **Auto** — inverse links from Payouts, Events, Time Entries, etc. |

> **Current People records:** Peter Benjamin, Violet Starkey, Mike Anthony, Sena Koleva, Leah Diamond, Tori King, Carley Corrado, Johanna (bookkeeper), plus satellite coordinators.

---

### 5. Facilitator Payouts (`tbl9BPw09Swf8YquL`)

**Purpose:** One row per facilitator per event. Tracks what each facilitator is owed and whether it's been paid. Reconciles with QuickBooks quarterly.

**Payout rates:**
| Role + Event Type | Rate |
|---|---|
| Online Solo | 30% of Gross Revenue |
| Online Co-Hosted | 20% of Gross Revenue |
| In-Person Solo | 20% of Gross Revenue |
| In-Person Co-Hosted | 12% of Gross Revenue |
| Practice Session Facilitator | 80% of Gross Revenue |

| Field | Type | How it arrives |
|---|---|---|
| Facilitator Name | Text | **Manual** (or auto from linked Person) |
| Event | Linked → Events | **Manual** — link to the event |
| Person | Linked → People | **Manual** — link to People record |
| Role | Single select (Solo / Co-Hosted) | **Manual** |
| Event Type | Single select | **Manual** — must match Events.Event Type |
| Gross Revenue | Currency | **Manual** — copy from Events.Gross Revenue |
| Payout Percentage | Number | **Manual** — enter correct % from rate table above |
| Payout Amount | Formula | **Auto** — Gross Revenue × Payout Percentage ÷ 100 |
| Status | Single select (Draft / Ready for Review / Approved / Sent to Bookkeeper / Paid) | **Manual/Automation** — status workflow; automation warns when Eligible Date passes |
| Eligible Date | Formula | **Auto** — Event Date + 7 days (refund buffer) |
| Event Date (cached) | Date | **Auto** — set by Airtable automation when Event link is filled |
| Approved By | Collaborator | **Auto** — set when status flips to Approved |
| Memo | Text | **Manual** — format: "[Event Name] — [Role] [%]" for Gusto |
| Paid | Checkbox | **Manual** — check when payment confirmed |
| Date Paid | Date | **Manual** |
| Date Sent | Date | **Manual** — date bookkeeper email included this row |

> **Not yet automated:** Row creation is currently manual. The plan is to auto-create Facilitator Payout rows when a new Events record is created (or Status flips to Held), pre-filling Role, Event Type, and linking to People from the Lead/Co-Facilitator linked fields.

---

### 6. Profit Share Payouts (`tbl9AxX0udBbfFDBr`)

**Purpose:** Monthly profit share payments. Currently only Violet (15% of monthly Adjusted Gross).

| Field | Type | How it arrives |
|---|---|---|
| Period Label | Text | **Auto** — monthly script: "Violet Starkey — 2026-04" |
| Person | Linked → People | **Auto** — monthly script, filtered to Eligible for Profit Share = true |
| Period Start / End | Date | **Auto** — monthly script |
| Adjusted Gross Total | Currency | **Auto** — monthly script sums Events.Adjusted Gross for prior month |
| Profit Share % | Percent | **Auto** — copied from Person.Profit Share % at creation (preserves history) |
| Payout Amount | Formula | **Auto** — Adjusted Gross Total × Profit Share % |
| Status | Single select | **Manual workflow** — Draft → Approved → Sent → Paid |
| Date Sent / Paid | Date | **Manual** |
| Memo | Text | **Auto** — "[Month Year] profit share — [%] of $[Adj Gross]" |

> **Monthly script status:** The Airtable automation that creates these rows on the 1st of each month is planned/partially set up. Confirm whether it is currently running.

---

### 7. Salary Log (`tbl8jl8I6tGlhLSE7`)

**Purpose:** Read-only visibility log for Peter and Violet's monthly salaries ($2,700/mo each), which are paid automatically via Capital One and do NOT appear in the bookkeeper email.

| Field | Type | How it arrives |
|---|---|---|
| Period Label | Text | **Auto** — monthly script |
| Person | Linked → People | **Auto** — monthly script, filtered to Pay Cadence = Salary (Logged Only) |
| Period Start / End | Date | **Auto** — monthly script |
| Amount | Currency | **Auto** — copied from Person.Monthly Salary |
| Paid via | Single select | Always "Capital One auto-transfer" |

> **No action required.** Capital One handles payment; this table is for visibility only.

---

### 8. Pay Periods (`tblielJsv6tfaxJ3c`)

**Purpose:** One row per monthly hourly contractor per month. The basis for Gusto contractor payments.

| Field | Type | How it arrives |
|---|---|---|
| Period Label | Text | **Auto** — monthly script: "Kayla Rodriguez — 2026-04" |
| Person | Linked → People | **Auto** — monthly script, filtered to Pay Cadence = Monthly, Status = Active |
| Period Start / End | Date | **Auto** — monthly script (covers prior month) |
| Hourly Rate | Currency | **Auto** — copied from Person.Hourly Rate at creation |
| IB Rate | Number | **Auto** — copied from Person.Interplay Bucks Rate at creation |
| Total Hours | Number | **Manual (Phase 2)** — enter from Toggl report; **Auto (Phase 3)** — Toggl sync rollup |
| Total $ | Formula | **Auto** — Total Hours × Hourly Rate |
| IB Earned | Formula | **Auto** — Total Hours × IB Rate |
| Status | Single select | **Manual workflow** — Draft → Approved → Sent → Paid |
| Approved by Violet (for Johanna) | Checkbox | **Manual** — required for Johanna's own rows only (self-approval prevention) |
| Date Sent / Paid | Date | **Manual** |
| Memo | Text | **Manual** — format: "[Month Year] — [hours] hrs @ $[rate]" |

---

### 9. Interplay Bucks Ledger (`tbl6sR2OhP6PpGDn0`)

**Purpose:** Running credit/debit ledger of Interplay Bucks for each team member. Each person's current IB balance = sum of all their rows.

| Field | Type | How it arrives |
|---|---|---|
| Entry Label | Text | **Auto** — monthly script for earnings; **Manual** for redemptions |
| Person | Linked → People | **Auto/Manual** |
| Date | Date | **Auto/Manual** |
| Amount (IB) | Number | **Auto** (positive, from Pay Period IB Earned) / **Manual** (negative, redemptions) |
| Type | Single select (Earned Hourly / Redeemed TT Gift Card / etc.) | **Auto/Manual** |
| Source Pay Period | Linked → Pay Periods | **Auto** — linked by monthly script for earnings |
| TicketTailor Reference | Text | **Manual** — gift card code or order ID for redemptions |

---

### 10. Time Entries (`tbl5FWab23bnhepB4`)

**Purpose:** Mirror of Toggl Track entries. Do not edit directly — make corrections in Toggl.

| Field | Type | How it arrives |
|---|---|---|
| Toggl Entry ID | Text | **Auto** — Make.com 4985926 (upsert key) |
| Person | Linked → People | **Auto** — matched on Toggl User ID in People table |
| Description | Text | **Auto** — from Toggl entry description |
| Project | Text | **Auto** — from Toggl project name |
| Tags | Text | **Auto** — from Toggl tags |
| Start / Stop | DateTime | **Auto** — from Toggl |
| Duration (hours) | Number | **Auto** — Toggl seconds ÷ 3600 |
| Pay Period | Linked → Pay Periods | **Auto** — matched by Person + month of Start date |
| Locked | Checkbox | **Auto** — set true when linked Pay Period is Approved |
| Billable | Checkbox | **Auto** — from Toggl billable flag |
| Last Synced | DateTime | **Auto** — timestamp of last Make.com sync |
| Review Needed | Formula | **Auto** — flags if duration ≥ 8 hours (likely forgotten timer) |

> **Sync frequency:** Every 30 minutes via Make.com scenario 4985926. Corrections made in Toggl will be picked up on the next sync cycle.

---

### 11. Subscriptions (`tblxwdzaiPnGr5gYx`)

**Purpose:** Master list of recurring tools and services. Source of truth for amortization and the monthly subscription floor.

| Field | Type | How it arrives |
|---|---|---|
| Service Name | Text | **Manual** |
| Vendor Aliases | Text | **Manual** — alternative names as they appear on bank/QB feeds |
| Category | Single select | **Manual** |
| Frequency | Single select (Monthly / Annual / Quarterly) | **Manual** |
| Amount | Currency | **Manual** — per-cycle charge |
| Renewal Date | Date | **Manual** |
| Status | Single select (Active / Cancelled) | **Manual** |
| Owner | Linked → People | **Manual** |
| Auto-Pay From | Single select | **Manual** |
| Monthly Cost | Formula | **Auto** — amortizes to monthly (annual ÷ 12, etc.) |

> **Used by Expenses:** When QuickBooks imports a transaction, Make.com fuzzy-matches the vendor against Vendor Aliases and links to this table, setting the Frequency on the Expense row.

---

### 12. Expenses (`tblO7Ux8RvI4l2Eac`)

**Purpose:** Transaction-level outflow ledger. One row per expense. Combines data from QuickBooks, Stripe, and PayPal.

| Field | Type | How it arrives |
|---|---|---|
| Description | Text | **Auto** — Make.com formats as "YYYY-MM-DD — Vendor — Amount" |
| Date | Date | **Auto** — from source system |
| Vendor | Text | **Auto** — from source system |
| Amount | Currency | **Auto** — from source system |
| Category | Single select | **Auto** — from QB category or matched Subscription; flags "Needs Categorization" if no match |
| Frequency | Single select | **Auto** — from matched Subscription.Frequency |
| Subscription | Linked → Subscriptions | **Auto** — Make.com vendor fuzzy-match |
| Account | Single select | **Auto** — which account the outflow came from |
| Source | Single select (QuickBooks / Stripe / PayPal / Manual) | **Auto** — set by the import scenario |
| External ID | Text | **Auto** — QB transaction ID / Stripe charge ID / PayPal txn ID (dedup key) |
| Monthly Amortized | Formula | **Auto** — spreads annual/quarterly charges evenly |
| Needs Categorization | Checkbox | **Auto** — checked when Make.com can't match vendor |
| Linked Event | Linked → Events | **Manual** — for event-specific costs |
| Receipt | Attachment | **Manual** |
| Linked Venue Payout | Linked → Venue Payouts | **Auto** — set by Scenario 5c when PayPal outflow matches a Venue Payout |

**Import sources:**
- **QuickBooks** — Scenario 4998282 runs daily; currently active with some errors
- **Stripe fees** — Scenario 5b (not yet built)
- **PayPal venue payouts** — Scenario 5c (not yet built)
- **Manual** — cash purchases, unusual items

---

### 13. Venues (`tblLIEMaMyPZg4bHp`)

**Purpose:** Venue contacts and metadata. All venues paid via PayPal.

| Field | Type | How it arrives |
|---|---|---|
| Venue Name | Text | **Manual** |
| Region | Single select | **Manual** |
| Address | Text | **Manual** |
| PayPal Email | Email | **Manual** — required for payout processing |
| Contact Name / Email / Phone | Contact fields | **Manual** |
| Status | Single select | **Manual** |
| Default Setup/Teardown Hours | Number | **Manual** — default 0.5 (adds 1 hr total to billable duration) |
| Notes | Text | **Manual** |

---

### 14. Venue Pricing Rules (`tblPINl9V9Uj1t9N1`)

**Purpose:** One row per pricing scheme per venue. Multiple rules can exist for one venue (e.g., Alchemy House: 30% of gross by default, flat fee for day-long events). The highest-priority matching rule wins.

| Field | Type | How it arrives |
|---|---|---|
| Rule Name | Text | **Manual** |
| Venue | Linked → Venues | **Manual** |
| Match Format | Multi-select | **Manual** — blank = matches any format |
| Match Min/Max Hours | Number | **Manual** — duration range this rule applies to |
| Charge Type | Single select (Percentage of Gross / Per Hour / Flat Rate / Hybrid) | **Manual** |
| Hourly Rate / Percentage Rate / Flat Fee / Minimum | Currency/Number | **Manual** |
| Effective From / To | Date | **Manual** |
| Priority | Number | **Manual** — higher number wins ties |

---

### 15. Venue Payouts (`tblO4g0phvcyHrIOH`)

**Purpose:** One row per venue payment per event. Triggered automatically 3 days after the event (refund buffer).

| Field | Type | How it arrives |
|---|---|---|
| Period Label | Text | **Auto** — Make.com Scenario 5d: "{Venue} — {Event} ({Date})" |
| Event | Linked → Events | **Auto** — Scenario 5d |
| Venue | Linked → Venues | **Auto** — from Events.Venue (Linked) |
| Matched Pricing Rule | Linked → Venue Pricing Rules | **Auto** — Scenario 5d looks up matching rule |
| Event Date / Adjusted Gross Snapshot / Duration Hours Snapshot | Fields | **Auto** — Scenario 5d snapshots at creation time for audit trail |
| Calculated Amount | Currency | **Auto** — Scenario 5d computes from matched rule + snapshots |
| Override Amount | Currency | **Manual** — if deal differs from rule; takes precedence over Calculated Amount |
| Final Amount | Formula | **Auto** — Override Amount if set, else Calculated Amount |
| Status | Single select | **Auto/Manual** — Awaiting Send → Sent to Johanna → Paid → Reconciled |
| Notification Sent At | DateTime | **Auto** — Scenario 5d timestamps when email + Listify task fired |
| Paid Date / Payment Reference | Date / Text | **Auto** — Scenario 5c sets when PayPal txn reconciles |
| Reconciled | Checkbox | **Auto** — Scenario 5c sets when Linked Expense.Amount matches Final Amount within $0.01 |
| Audit Snapshot | Text | **Auto** — Scenario 5d records rule name, inputs, and result |

> **Scenario 5d is not yet built.** Currently venue payouts require manual row creation.

---

### 16. Monthly Financials (`tblZZKzFXk6buss24`)

**Purpose:** One row per month. The top-level P&L summary. Populated by Make Scenario 6 on the 1st of each month for the prior month.

| Field | Type | How it arrives |
|---|---|---|
| Month Label | Text | **Auto** — Scenario 6 (planned): "2026-04" |
| Month | Date | **Auto** — 1st of the month |
| Gross Revenue | Currency | **Auto** — sum Events.Gross Revenue where Date in month |
| Adjusted Gross | Currency | **Auto** — sum Events.Adjusted Gross where Date in month |
| Total Payouts | Currency | **Auto** — sum Facilitator Payouts + Salary Log + Profit Share Payouts |
| Total Expenses (Cash) | Currency | **Auto** — sum Expenses.Amount where Date in month |
| Total Expenses (Amortized) | Currency | **Auto** — sum Expenses.Monthly Amortized where Date in month |
| Subscription Floor | Currency | **Auto** — sum active Subscriptions.Monthly Cost (captured at rollup time) |
| Recurring MRR | Currency | **Auto** — active series enrollments × monthly value |
| Run Rate (3-mo avg) | Currency | **Auto** — trailing 3-month Adjusted Gross ÷ 3 |
| Cash Reserve End | Currency | **Manual** — Capital One ending balance for the month |
| Owner Withdrawal | Currency | **Manual** |
| Net Profit | Formula | **Auto** — Adjusted Gross − all payouts − amortized expenses |
| Above Floor | Formula | **Auto** — safety check: is revenue covering floor + payouts? |

> **Scenario 6 is not yet built.** Monthly Financials are not currently being auto-populated.

---

### 17. KPI Snapshots (`tbl7RX1RcCQWlwCTf`)

**Purpose:** One row per month. Attendance and retention metrics to track community health.

| Field | Type | How it arrives |
|---|---|---|
| Month Label / Month | Text/Date | **Auto** — Scenario 6 alongside Monthly Financials |
| Return Rate | Percent | **Auto** — (returning attendees) ÷ (total attendees); excludes series sessions 2–N |
| Retention 30d / 60d / 90d | Number | **Auto** — distinct emails with attendance in rolling windows |
| Total Unique Attendees | Number | **Auto** — distinct emails in Attendance for events held this month |
| New Attendees | Number | **Auto** — emails attending RI for first time this month |
| Avg Revenue Per Participant | Currency | **Auto** — Adjusted Gross ÷ Total Attended |
| Avg Cost Per Participant | Currency | **Auto** — (Payouts + Amortized Expenses) ÷ Total Attended |
| NPS | Number | **Manual (Phase 2)** — from surveys |

> **Not yet operational.** All fields require Scenario 6 to be built.

---

### 18. Affiliates (`tbljr0pHRwqN4G9sV`)

**Purpose:** One row per affiliate. Self-service signup. Tracks codes, links, vouchers, and commissions.

| Field | Type | How it arrives |
|---|---|---|
| Name / Email | Text/Email | **Auto** — Airtable form submission |
| Preferred Code | Text | **Auto** — form submission |
| Final Code | Text | **Auto** — Make.com Scenario A sanitizes (uppercase, alphanumeric, deduped) |
| TT Voucher ID | Text | **Auto** — Scenario A creates 0% tracking voucher in TT and writes ID back |
| Status | Single select | **Manual** — default Active on creation |
| Payout Method / Identifier | Fields | **Manual** — affiliate fills in or admin updates |
| Signed Up At | Date | **Auto** — form submission date |
| How They'll Promote | Text | **Auto** — form field |
| Berkeley Intro Link | Formula | **Auto** — `https://events.letsinterplay.com/...?ref=[FinalCode]` for es_2172390 |
| Oakland Intro Link | Formula | **Auto** — for es_2172433 |
| Boulder Intro Link | Formula | **Auto** — for es_2188106 |
| Tracking URL | URL | **Auto** — TT-generated URL with referral tag |
| Skip Auto-Setup | Checkbox | **Manual** — check BEFORE creating row to bypass automation (for manual/VIP setups) |
| Tag Created | Checkbox | **Manual** — check after creating TT Referral Tag in admin |
| Welcome Email Sent | Date | **Auto** — Scenario A2 timestamps when welcome email sent |
| Created Time | Formula | **Auto** — `CREATED_TIME()`. Used as Make.com trigger field for Scenario A. |
| Custom Commission Rate | Percent | **Manual** — overrides all program defaults for VIP partners |

**Commission rates by program (as of 2026-05-08):**
| Program | Default Rate |
|---|---|
| Relational Dojo | 16% |
| Accelerated Evolution | 12% |
| Coach Training | 6% |
| Facilitator Training | 15% |

> **Scenario A is partially built** (scenario 5008276 — draft status, has errors). Full flow: form submit → code sanitization → TT voucher creation → welcome email with code + 3 tracking links.

---

### 19. Affiliate Commissions (`tblusG9EK47fqJ0hN`)

**Purpose:** One row per training signup referred by an affiliate. Auto-created when attribution is confirmed.

**Attribution logic:** When a new Series Rosters row is created, Make.com checks if that email appears in any Attendance row tagged to an Affiliate. If yes, an Affiliate Commissions row is created.

| Field | Type | How it arrives |
|---|---|---|
| Commission Label | Text | **Auto** — "{Affiliate} — {Buyer Email} — {Program} — {Date}" |
| Buyer Email | Email | **Auto** — snapshot from Series Rosters |
| Program | Single select | **Auto** — from Series Rosters.Series Name |
| Tuition Amount | Currency | **Auto** — snapshot from Series Rosters.Amount Paid |
| Commission Rate | Percent | **Auto** — from Program rate table at creation (snapshot preserves history) |
| Commission Amount | Formula | **Auto** — Tuition Amount × Commission Rate |
| Eligible Date | Date | **Auto** — Registration Date + 7 days (refund window) |
| Status | Single select | **Manual workflow** — Pending → Approved → Sent to Bookkeeper → Paid |
| Affiliate | Linked → Affiliates | **Auto** |
| Originating Attendance | Linked → Attendance | **Auto** — the intro attendance row that established attribution |
| Series Roster | Linked → Series Rosters | **Auto** — the training enrollment that triggered the commission |
| Approved Date / Date Sent / Paid Date / Payment Reference | Date/Text | **Manual** |

---

## Data Flow Summary Diagram

```
Ticket Tailor (event created)
    └─→ Make 4984070 ─→ Airtable Events (create)
                     ─→ Google Calendar (create)
                     ─→ Make Datastore 97722 (TT event ID → Zoom meeting ID)

Ticket Tailor (new order, polled every 15 min)
    └─→ Make 5032912 ─→ Zoom (register each ticket holder)
    └─→ Make 4983848 ─→ Airtable Attendance (create row)  [needs fix]

Airtable Attendance (new row)
    └─→ Make 4996835 ─→ ActiveCampaign (upsert contact + tags)  [needs re-save]

Zoom (meeting ended)
    └─→ Make 4983210 ─→ ActiveCampaign (STATUS: Attended tag)

Daily batch — event financials
    └─→ Make 5032559 (F1) ─→ Airtable Events (Gross Revenue, Refunds, Stripe Fees)

Daily batch — Zoom attendance count
    └─→ Make 5026038 (F2) ─→ Airtable Events (Total Attended, online events)

Daily batch — in-person attendance
    └─→ Make 5030860 (F4) ─→ Airtable Attendance (Attended checkbox, in-person events)

Daily batch — venue cost
    └─→ Make 5033099 (F3) ─→ Airtable Events (Venue Cost, in-person, via Pricing Rules)

Daily batch — no-shows
    └─→ Make 5030965 ─→ ActiveCampaign (STATUS: No-Show + format/hub/training tags)

Toggl (time entries)
    └─→ Make 4985926 ─→ Airtable Time Entries (upsert every 30 min)

QuickBooks (transactions)
    └─→ Make 4998282 ─→ Airtable Expenses (daily import)  [partial]

Airtable Affiliates (new row)
    └─→ Make 5008276 ─→ TT voucher + welcome email  [draft]

Airtable Series Rosters (new row)
    └─→ Make [planned] ─→ Airtable Affiliate Commissions (attribution check)

Monthly (1st of month) [NOT YET BUILT]
    └─→ Make Scenario 6 ─→ Monthly Financials + KPI Snapshots
    └─→ Airtable Automation ─→ Pay Periods + Profit Share Payouts + Salary Log
```

---

## Known Gaps & Planned Work

| Gap | Status | Notes |
|---|---|---|
| Scenario 4983848 (TT → Airtable Attendance) | ❌ Broken | Needs rebuild to reliably create Attendance rows from TT orders |
| Scenario 4996835 (Airtable Attendance → AC) | ⚠️ Needs re-save | Trigger schema needs re-validation in Make UI |
| Attended checkbox — online events | ⚠️ Partial | F4 handles in-person automatically; online event Attendance.Attended still requires manual entry. Zoom webhook (4983210) tags AC but does not write back to Airtable rows. |
| Facilitator Payout row auto-creation | 🚧 Planned | Auto-create when event Status → Held |
| Total Registrations auto-fill | 🚧 Planned | Last major Events field still manual; pull from TT order count |
| Stripe Fees precision | ⚠️ Known limitation | F1 uses flat 2.9% estimate; actual fees include per-transaction $0.30 surcharge. Acceptable for now. |
| Scenario 5b (Stripe fees → Expenses) | 🚧 Planned | F1 writes fees to Events; 5b would log individual transactions to Expenses table |
| Scenario 5c (PayPal reconciliation) | 🚧 Planned | Not built |
| Scenario 5d (Venue Payout auto-creation) | 🚧 Planned | Not built; F3 now computes the amount but doesn't create the Venue Payout row |
| Scenario 6 (Monthly Financials + KPIs) | 🚧 Planned | Not built |
| Monthly Payout Setup automation | 🚧 Planned | Airtable automation to create Pay Periods etc. on 1st of month |
| Affiliate Scenario A (full flow) | 🚧 Draft | Partially built (5008276), has errors |
| NPS tracking | 🚧 Phase 2 | Survey integration not yet defined |
| Facilitator tags in TT | ⚠️ Pending | 10 tags (mike-lead, mike-co, sena-lead, sena-co, leah-lead, leah-co, tori-lead, tori-co, carley-lead, carley-co) must be created in TT for 4984070 to auto-assign facilitators |
| Zoom registration required | ⚠️ Pending | Must be enabled on each Zoom meeting for 5032912 to issue personalized join links |
| F2 Zoom scope (report:read:admin) | ⚠️ Monitor | Zoom connection 8699938 was reauthorized 2026-05-11; if F2 returns 403 on first online-event run, the OAuth scope wasn't granted and connection needs reauth with that scope explicitly |
