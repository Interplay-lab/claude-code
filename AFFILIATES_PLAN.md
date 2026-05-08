# Affiliates & Affiliate Tracking — Setup Plan

Last updated: 2026-05-08

## Goal

Track affiliates who refer people to the **free/cheap intro events**, then pay them
a commission only if those referred people later sign up for **paid training programs**.

- Affiliates: external people (community members, podcasters, friends-of-RI) who promote our intro events.
- Intro events (where tracking happens): the 3 published TT event series.
- Training events (where commissions trigger): Relational Dojo, Accelerated Evolution, Coach Training, Facilitator Training.
- Roster: lives in Airtable.
- Signup: self-service via Airtable form view; auto-approved.

## Architecture in one paragraph

An affiliate fills out the signup form → Airtable creates an `Affiliates` row → a Make.com
scenario sanitizes their preferred code into a unique `Final Code`, creates a
**zero-discount tracking voucher** in Ticket Tailor scoped to the 3 intro event series,
and emails the affiliate their code + 3 personalized tracking links. When someone buys
an intro ticket using the affiliate's code (or click-through link), the resulting
`Attendance` row gets the `Affiliate` link set. Months later, when that same email
signs up for a paid training (`Series Rosters` row created), Make.com matches the
buyer's email back to the tagged intro and creates an `Affiliate Commissions` row at
the program-specific rate.

---

## 1. Ticket Tailor

### Stores & event series

| Series ID | Name | Type |
|---|---|---|
| `es_2172390` | Intro to Relational Interplay in Berkeley | Intro |
| `es_2172433` | All Levels Community Interplay Night in Oakland | Intro |
| `es_2188106` | INTERPLAY & CHILL: Relating & Co-Regulating in N Boulder | Intro |

Store: `st_79934` (Relational Interplay store).

### Voucher structure

One voucher per affiliate. Created automatically by Make.com on Affiliate creation.

- **Code**: the affiliate's `Final Code` (e.g. `JANE`, `JANE2` if `JANE` is taken).
- **Discount**: 0% (tracking only — no discount to buyer).
- **Applies to**: all 3 intro event series above. Does NOT apply to paid trainings — vouchers should be scoped to the intro series only. (If trainings later move to TT, do not extend these vouchers; create separate logic.)
- **Limit**: unlimited uses, no expiry (or set a far-future expiry).
- **Voucher ID**: written back to `Affiliates.TT Voucher ID` after creation.

### TT URL parameter for code pre-fill (verify)

The tracking links in Airtable currently use `?ref=CODE`. Ticket Tailor may also
support `?voucher=CODE` or `?vc=CODE` to **auto-apply the voucher at checkout** so
the buyer doesn't have to type it. Action item:

1. Manually test on a TT event: try `…/2172390?voucher=TESTCODE` and `…/2172390?vc=TESTCODE`.
2. Whichever pre-fills the discount box, update the formula in `Affiliates.Berkeley/Oakland/Boulder Intro Link` to use that param.
3. If neither works, leave `?ref=` as-is and rely on the buyer typing the code.

---

## 2. Airtable

### New tables

#### `Affiliates` (`tbljr0pHRwqN4G9sV`)

| Field | Type | Notes |
|---|---|---|
| Name | singleLineText (primary) | From form |
| Email | email | From form, also welcome-email destination |
| Status | singleSelect: Active / Pending / Paused / Revoked | Default Active for auto-approve |
| Preferred Code | singleLineText | What they typed in the form |
| Final Code | singleLineText | Sanitized + deduped by Make. THIS is the voucher code. |
| TT Voucher ID | singleLineText | `vo_…`, set by Make after voucher create |
| Phone | phoneNumber | Optional |
| Payout Method | singleSelect: PayPal / Venmo / Zelle / Check / Interplay Bucks / Other | |
| Payout Identifier | singleLineText | PayPal email, Venmo handle, etc. |
| Signed Up At | date | Form submission date |
| How They'll Promote | multilineText | Form question |
| Notes | multilineText | Internal only |
| Berkeley/Oakland/Boulder Intro Link | formula | `?ref=` + `Final Code`. Update if TT supports voucher pre-fill (see §1). |
| Attendance (reverse) | linked record | Auto-populated from Attendance.Affiliate |
| Series Rosters (reverse) | linked record | Auto-populated from Series Rosters.Affiliate |
| Affiliate Commissions (reverse) | linked record | Auto-populated from Affiliate Commissions.Affiliate |

#### `Affiliate Commissions` (`tblusG9EK47fqJ0hN`)

| Field | Type | Notes |
|---|---|---|
| Commission Label | singleLineText (primary) | Auto-set by Make |
| Affiliate | link → Affiliates | |
| Series Roster | link → Series Rosters | The training enrollment that triggered this |
| Originating Attendance | link → Attendance | The intro signup that established attribution |
| Buyer Email | email | Snapshot |
| Program | singleSelect: Relational Dojo / Accelerated Evolution / Coach Training / Facilitator Training | |
| Tuition Amount | currency | Snapshot from Series Rosters.Amount Paid |
| Commission Rate | percent | Snapshot from program rate at creation time |
| Commission Amount | formula: Tuition × Rate | |
| Status | singleSelect: Pending / Approved / Sent to Bookkeeper / Paid / Reversed | |
| Eligible Date | date | Registration Date + 7 days (refund window) |
| Approved Date | date | When status flipped to Approved |
| Date Sent | date | When included in bookkeeper email |
| Paid Date | date | When bookkeeper confirmed payment |
| Payment Reference | singleLineText | PayPal txn ID, etc. |
| Notes | multilineText | |

#### Commission rates (as of 2026-05-08)

| Program | Rate |
|---|---|
| Relational Dojo | 16% |
| Accelerated Evolution | 12% |
| Coach Training | 6% |
| Facilitator Training | 15% |

Rates are stored on each commission row at creation time, so future rate changes do not rewrite history.

### Existing tables — new fields added

- `Attendance.Affiliate` (link → Affiliates) — set by Make when an intro order's voucher code or `?ref=` matches.
- `Series Rosters.Affiliate` (link → Affiliates) — set by Make via email-match.

No other existing fields touched.

### Form view (manual setup — Airtable doesn't expose form-view config via API)

On the `Affiliates` table, create a new **form view** named `Affiliate Signup`:

1. **Visible fields (in this order):**
   - Name (required)
   - Email (required)
   - Phone (optional)
   - Preferred Code (required) — help text: *"Pick a short word, ideally your first name (e.g. JANE). 3–20 letters/numbers, no spaces. We'll add a number if it's taken."*
   - How They'll Promote (optional) — help text: *"Where will you mostly share? (Instagram, podcast, in-person workshops, etc.)"*
   - Payout Method (required)
   - Payout Identifier (required) — help text: *"PayPal email, Venmo handle, Zelle phone, or address for check."*

2. **Hidden fields (set by automation, not the affiliate):**
   - Status — default: `Active`
   - Final Code, TT Voucher ID — set by Make
   - Signed Up At — set by automation on submit (or use Created Time)
   - Notes — internal

3. **Form settings:**
   - After submit: redirect to a thank-you page or show "Thanks! Check your email in a few minutes for your code and links."
   - Email confirmation: optional — Make.com sends the welcome email anyway.

4. **Share the form** publicly and embed on letsinterplay.com or send the link directly.

---

## 3. Make.com scenarios

Build these in the existing Make.com workspace. Each is laid out as: **trigger → modules → output**.

### Scenario A — Affiliate Onboarding

**Trigger:** Airtable — Watch Records on `Affiliates` table.
- Watch on: created.
- Trigger condition: `Status = Active` AND `TT Voucher ID is empty`.

**Modules:**

1. **Sanitize the code.** Iterator → text helper:
   - Take `Preferred Code`, uppercase, strip non-alphanumeric.
   - If empty after stripping, fall back to a sanitized version of `Name` (e.g. "Jane Smith" → "JANESMITH").
   - Truncate to 20 chars.

2. **Dedup against existing TT vouchers.** Ticket Tailor — Search Vouchers by code. If found, append `2`, then `3`, etc. until unique. (Keep an iterator with a max of 10 attempts; if all taken, fall back to `CODE-{random 4 digits}`.)

3. **Create voucher in TT.** Ticket Tailor — Create Voucher.
   - Code: the deduped code.
   - Discount type: percentage, value 0.
   - Applies to event series: `es_2172390`, `es_2172433`, `es_2188106`.
   - Max uses: unlimited (or 9999).
   - Expiry: leave blank or set to e.g. 2030-01-01.

4. **Update Affiliate row.** Airtable — Update Record.
   - `Final Code` = the deduped code.
   - `TT Voucher ID` = voucher ID returned by TT.

5. **Send welcome email.** Use existing email tool (ActiveCampaign, Gmail, or whatever you use for transactional). Template includes:
   - Their `Final Code`.
   - All 3 tracking links (read from the formula fields or rebuild in the email).
   - One-paragraph "how to share" guide.
   - Commission rate table.
   - A note that they'll get monthly performance stats by email (no portal — see Scenario G).

6. **(Optional) Create ActiveCampaign contact + tag.** Tag them `affiliate` so they get any ongoing affiliate-only newsletters.

**Error handling:** if TT voucher creation fails, set `Status = Pending` and `Notes` = error message; alert Violet by email.

### Scenario B — Tag Intro Signup with Affiliate

**Trigger:** Airtable — Watch Records on `Attendance` table.
- Watch on: created.
- Trigger condition: `Affiliate is empty` AND linked Event has `Format = Intro` (or any of the 3 intro series via the linked `TT Event ID`).

**Modules:**

1. **Look up the source TT order.** You presumably already have a Make scenario that creates Attendance rows from TT orders. Extend it to also fetch:
   - Voucher code used (TT order has a `voucher` field).
   - Source / referer (TT order may include UTM source if you've turned that on).

2. **Match voucher code → Affiliate.** Airtable — Search Records on `Affiliates` where `Final Code = {{order.voucher.code}}`.

3. **(Fallback) Match `?ref=` → Affiliate.** If no voucher match, parse `ref=` from the order's source/referrer URL and search `Affiliates.Final Code` again.

4. **Update Attendance row.** If a match is found: set `Affiliate` link to that affiliate. Otherwise: leave blank (no attribution).

### Scenario C — Email-Match Attribution + Commission Creation

**Trigger:** Airtable — Watch Records on `Series Rosters` table.
- Watch on: created.
- Trigger condition: `Affiliate is empty` AND `Series Name` is one of the 4 commission-eligible programs.

**Modules:**

1. **Look up prior tagged Attendance for this email.** Airtable — Search Records on `Attendance` where `Email = {{this.Email}}` AND `Affiliate is not empty`. Sort by `Registration Date` ascending. Take the **first** result (FIRST-TOUCH attribution).

2. **No match → exit.** Set `Notes` field on the Series Rosters row to "No prior tagged intro" (optional, helpful for debugging).

3. **Match → set Affiliate on Series Rosters.** Airtable — Update Record. `Affiliate` = matched affiliate.

4. **Compute commission rate.** Switch module on `{{this.Series Name}}`:
   - Relational Dojo → 0.16
   - Accelerated Evolution → 0.12
   - Coach Training → 0.06
   - Facilitator Training → 0.15

5. **Create Affiliate Commissions row.** Airtable — Create Record.
   - `Commission Label` = `{Affiliate Name} — {Buyer Email} — {Program} — {today}`.
   - `Affiliate`, `Series Roster`, `Originating Attendance` (the matched attendance row), `Buyer Email`, `Program`, `Tuition Amount`, `Commission Rate`, `Status` = `Pending`.
   - `Eligible Date` = `Series Rosters.Registration Date + 7 days`.

### Scenario D — Auto-Approve Past Refund Window

**Trigger:** Airtable — schedule, daily.

**Modules:**

1. Search `Affiliate Commissions` where `Status = Pending` AND `Eligible Date <= today`.
2. For each: set `Status = Approved`, `Approved Date = today`.

### Scenario E — Refund Reversal (optional, recommended)

**Trigger:** Stripe — refund created (or however you currently detect refunds), OR a manual Airtable "Refunded" checkbox on Series Rosters.

**Modules:**

1. Find the matching `Affiliate Commissions` row by `Series Roster` link.
2. If `Status = Paid`: set `Status = Reversed` and create a clawback note. Manual decision on whether to claw back.
3. If `Status` is anything else: set `Status = Reversed`.

### Scenario G — Monthly Affiliate Stats Email

**Why this exists:** affiliates need visibility into their performance, but the Airtable
base contains highly sensitive financial data (facilitator payouts, salaries, profit
shares, vendor info). Affiliates must NEVER be given access to the base. This scenario
gives each affiliate a personal monthly digest by email so they never need a portal.

**Trigger:** Make.com schedule — 1st of each month, ~9am.

**Modules:**

1. **List active affiliates.** Airtable — Search Records on `Affiliates` where `Status = Active`.

2. **For each affiliate, in an Iterator:**

   a. **Count last-month intros tagged to them.** Airtable — Search Records on `Attendance`
      where `Affiliate` link contains this affiliate AND `Registration Date` is within last calendar month. Count rows.

   b. **Count last-month training signups tagged to them.** Airtable — Search Records on
      `Series Rosters` where `Affiliate` link contains this affiliate AND `Registration Date` is within last calendar month. Count rows + sum `Amount Paid`.

   c. **Sum last-month commissions earned.** Airtable — Search Records on `Affiliate Commissions`
      where `Affiliate` link contains this affiliate AND created within last calendar month
      AND `Status != Reversed`. Sum `Commission Amount`.

   d. **Sum lifetime totals** (same searches without the date filter): lifetime intros,
      lifetime training signups, lifetime commission earned, lifetime commission paid
      (filter `Status = Paid`), outstanding (lifetime earned − lifetime paid).

   e. **Send personalized email** to `{{affiliate.Email}}`. Template:
      - Subject: "Your Interplay affiliate stats — {{Month Year}}"
      - Body sections:
        - Last month: X intros referred, Y training signups, $Z commission earned.
        - Lifetime: A intros, B trainings, $C earned, $D paid, $E outstanding.
        - Their code + 3 tracking links (re-included so they always have them handy).
        - Reminder of commission rates.
        - "Reply to this email if anything looks wrong."

3. **Error handling:** if any single affiliate's email fails, log the error to a separate
   `Affiliate Email Errors` table or send an alert to Violet — do NOT stop the loop.

**Privacy guarantee:** this email contains ONLY the affiliate's own data. The Airtable
queries in steps 2a–2d are scoped by the `Affiliate` link, so cross-contamination is
impossible. The affiliate cannot see other affiliates' performance, your facilitator
payouts, salaries, or any other base content.

### Scenario F — Bookkeeper Email (extend your existing one)

Your existing monthly bookkeeper email script ([`Facilitator Payouts`, `Pay Periods`, `Profit Share Payouts`]) should be extended to include:

- Query `Affiliate Commissions` where `Status = Approved` AND `Eligible Date <= today`.
- Add a section to the email titled "Affiliate Commissions" with: Affiliate name, Payout Method, Payout Identifier, Commission Amount, Memo (`{Program} referral — {Buyer Email}`).
- After send: update those rows to `Status = Sent to Bookkeeper`, `Date Sent = today`.

---

## 4. Operational runbooks

### Adding a new training program later

1. Add the program name as a new option to `Affiliate Commissions.Program`.
2. Add the program name to `Series Rosters.Series Name` (already supports new options).
3. Update the Switch module in **Scenario C** to include the new program → rate.
4. Update this doc.

### Changing commission rates

- New rate applies to commissions **created after the change**. Existing Pending/Approved rows keep their original rate (snapshot in `Commission Rate`).
- Update the Switch in Scenario C and the rate table in this doc.

### Pausing or revoking an affiliate

- **Paused**: Set `Status = Paused`. Past commissions still pay out. Future intro signups using their code still get tagged (voucher still works) — if you want to fully stop tagging, also disable the voucher in TT manually or via a small Make scenario.
- **Revoked**: Set `Status = Revoked`. Add a Make scenario to delete (or set max_uses=0 on) their TT voucher. Any pending commissions stay pending until you decide.

### Disputes / multiple-affiliate edge cases

The system uses **first-touch attribution** by `Registration Date`. If a buyer is referred to two intro events by two different affiliates over time, the **earliest** intro's affiliate wins. Document this on the affiliate signup page so people know.

---

## 5. Reporting

### Internal (RI team only — full Airtable access)

- **Affiliate Leaderboard** (Affiliates table): grid sorted by total Commission Amount (rollup from linked Affiliate Commissions, status not Reversed). Columns: Name, # intros, # trainings, lifetime $.
- **Pending Commissions** (Affiliate Commissions): filtered to `Status = Pending`. Used by Violet to spot-check before they auto-approve.
- **Monthly affiliate spend** (KPI Snapshots): consider adding a column `Affiliate Commissions Paid` to the existing monthly rollup so it shows up on the financial dashboard.

### Affiliate-facing (no base access)

- **Welcome email** (Scenario A): code + tracking links + commission rates.
- **Monthly stats email** (Scenario G): personal performance digest, sent automatically.
- **Ad-hoc lookup**: if an affiliate emails asking "what are my numbers?", run the same Search-Records queries from Scenario G manually for just that one affiliate, or trigger Scenario G on-demand for them.

If you ever decide to give affiliates a real-time portal, build it as a **separate
front-end** (Softr, Glide, custom page) that hits Airtable's API with a row-scoped key.
Do NOT share the base or an Interface page — the base contains payouts, salaries, and
vendor info that must stay internal.

## 5b. Privacy & access boundaries

This is a hard rule: **affiliates never get Airtable access**. The base contains:
- Facilitator payouts and rates
- Salaries (Peter, Violet)
- Profit share percentages
- Vendor and venue contact info / banking details
- Other affiliates' performance and earnings
- Internal expense and subscription data

How affiliates interact with the system without seeing any of it:

| Touchpoint | Mechanism | What they can see |
|---|---|---|
| Sign up | Public Airtable form view URL | Only the form fields they're filling in |
| Receive code + links | Welcome email (Scenario A) | Their own code, 3 links, commission rates |
| Track performance | Monthly stats email (Scenario G) | Their own stats only — scoped by `Affiliate` link |
| Get paid | Out-of-band (PayPal, Venmo, etc.) | Nothing internal — just payment confirmation |

Forms in Airtable are submit-only; the submitter cannot see the table, other rows, or
any field that isn't on the form. This is the safe primitive that powers self-service
signup without any access leak.

---

## 6. What's NOT yet built (open TODOs)

1. Verify TT URL parameter for voucher pre-fill (see §1) and update the formula fields if needed.
2. Build Scenarios A–G in Make.com.
3. Create the form view on Affiliates (manual UI step).
4. Extend the existing bookkeeper email script to include affiliate commissions.
5. (Deferred) If/when you want a real-time affiliate portal, build it as a separate front-end app — never share the Airtable base or an Interface page (contains sensitive financial data).
6. Decide refund clawback policy (claw back paid commissions on refunds, or eat the cost).
7. Decide if intro events not yet listed (future events) should also count — currently the formulas hard-code 3 series IDs. When new intro series launch, update the formulas to add new link fields, OR refactor to a generic `?ref=CODE` link that points to a landing page that routes to the right event.

---

## Appendix — IDs

| Thing | ID |
|---|---|
| Airtable base | `appONwRwGnRvhPgHc` |
| Affiliates table | `tbljr0pHRwqN4G9sV` |
| Affiliate Commissions table | `tblusG9EK47fqJ0hN` |
| Attendance table | `tblOnjg68hW3e7wS8` |
| Series Rosters table | `tblcdvTCAJHcvqFY3` |
| TT store | `st_79934` |
| Berkeley intro series | `es_2172390` |
| Oakland community series | `es_2172433` |
| Boulder Interplay & Chill series | `es_2188106` |
