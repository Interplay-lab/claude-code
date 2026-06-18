# Interplay Bucks Redemption — Plan B Implementation Spec

**Target codebase:** Hourglass (claude-code-nu.vercel.app)
**Replaces:** the current `/api/redeem-ib` flow that attempts to mint Ticket Tailor discount codes / vouchers via API at redeem time.
**Why:** Ticket Tailor's public API has no endpoint to create discount codes, and the voucher endpoint requires per-event configuration that doesn't fit the staff-perk use case. Pre-staging a pool of single-use codes eliminates the runtime TT API dependency entirely.

---

## Architecture overview

1. **Briana manually creates a batch of TT discount codes once per quarter** (~15 min, see admin process below).
2. She **imports the codes into a Supabase pool** via a new admin page in Hourglass.
3. When staff redeem, Hourglass **draws a code from the pool** matching the requested denomination, marks it assigned, writes a Ledger row, and emails the code to the staff member.
4. A weekly cron alerts Briana when any denomination drops below 5 codes.

No TT API calls at runtime. TT only sees the code when the staff member uses it at customer-facing checkout.

---

## Database changes (Supabase)

### New table: `ib_code_pool`

```sql
CREATE TABLE ib_code_pool (
  code text PRIMARY KEY,
  denomination_cents integer NOT NULL,
  status text NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'assigned', 'used', 'expired')),
  assigned_to_staff_id uuid REFERENCES staff(id),
  assigned_at timestamptz,
  used_at timestamptz,
  expires_at timestamptz,
  imported_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

CREATE INDEX idx_ib_code_pool_available
  ON ib_code_pool (denomination_cents, status)
  WHERE status = 'available';

CREATE INDEX idx_ib_code_pool_staff
  ON ib_code_pool (assigned_to_staff_id)
  WHERE assigned_to_staff_id IS NOT NULL;
```

### Allowed denominations

Hard-code in a shared constant (e.g. `src/lib/ib/denominations.ts`):

```ts
export const IB_DENOMINATIONS_CENTS = [
  2500,    // $25
  5000,    // $50
  10000,   // $100
  25000,   // $250
  50000,   // $500
  62500,   // $625  — Boulder Dojo Super Limited EB
  65000,   // $650  — Online Dojo GA
  67500,   // $675  — Boulder Dojo EB
  75000,   // $750  — Boulder Dojo GA
] as const;
```

Validate `denomination_cents` against this list on import and redemption.

---

## API changes

### Rewrite: `POST /api/redeem-ib`

**Remove** all Ticket Tailor API calls.

**Request body:**
```json
{ "denomination_cents": 5000 }
```

**Flow:**
1. Auth: get current staff user from session.
2. Validate `denomination_cents` is in `IB_DENOMINATIONS_CENTS`.
3. Check staff balance ≥ `denomination_cents` (read from existing Airtable ledger logic or balance cache).
4. Atomically claim one available code:
   ```sql
   UPDATE ib_code_pool
   SET status = 'assigned',
       assigned_to_staff_id = $1,
       assigned_at = now()
   WHERE code = (
     SELECT code FROM ib_code_pool
     WHERE denomination_cents = $2 AND status = 'available'
     ORDER BY imported_at ASC
     LIMIT 1
     FOR UPDATE SKIP LOCKED
   )
   RETURNING *;
   ```
5. If no row returned → return 409:
   ```json
   { "error": "out_of_stock", "denomination_cents": 5000,
     "message": "No $50 codes currently in stock. Please choose a different denomination or contact admin@interplay.org." }
   ```
6. Write Airtable Ledger row (existing logic): staff_id, code, denomination_cents, timestamp, type=`redemption`.
7. Send email to staff (template below).
8. Return:
   ```json
   { "code": "IB-Q3-051", "denomination_cents": 5000,
     "expires_at": "2027-06-18T00:00:00Z",
     "ledger_row_id": "recXXX" }
   ```

### New: `GET /api/ib-pool/stock`

Returns live counts per denomination for the dashboard UI:

```json
{
  "stock": [
    { "denomination_cents": 2500, "available": 18 },
    { "denomination_cents": 5000, "available": 27 },
    ...
  ]
}
```

Public to authenticated staff users (no admin gate).

### New: `POST /api/admin/ib-pool/import` (admin-only)

**Auth:** gate by email allowlist. Initial allowlist: `connect@letsinterplay.com`.

**Request body:**
```json
{
  "codes": [
    { "code": "IB-Q3-001", "denomination_cents": 2500, "expires_at": "2027-06-18" },
    { "code": "IB-Q3-002", "denomination_cents": 2500, "expires_at": "2027-06-18" },
    ...
  ]
}
```

**Flow:**
1. Validate every `denomination_cents` is in `IB_DENOMINATIONS_CENTS`.
2. Bulk insert with `ON CONFLICT (code) DO NOTHING`.
3. Return `{ inserted: N, skipped_duplicates: N, by_denomination: {...} }`.

### New: `GET /api/admin/ib-pool/status` (admin-only)

Returns full pool dashboard data: counts by denomination × status, recent imports, recent assignments.

### New cron: `GET /api/check-ib-pool-stock`

Add to `vercel.json`:
```json
{ "crons": [{ "path": "/api/check-ib-pool-stock", "schedule": "0 13 * * 1" }] }
```

Mondays at 6am PT (13:00 UTC). For each denomination, if `available < 5`, send Briana an email:

> Subject: Interplay Bucks pool low — refill needed
>
> Hi Briana,
>
> Pool status as of {date}:
> - $25 codes: 18 available ✓
> - $50 codes: **3 available ⚠️**
> - $100 codes: 11 available ✓
> ...
>
> Time to refill the low denominations. See https://hourglass-url/admin/ib-pool for instructions.

---

## UI changes

### Modify: `/dashboard/ib-balance` (staff-facing)

Replace any freeform amount input with a denomination picker.

**Layout:**
- Header: "Your Interplay Bucks balance: $X,XXX"
- Grid of buttons, one per denomination:
  ```
  [ $25 ]   [ $50 ]   [ $100 ]
  18 left   27 left   11 left

  [ $250 ]  [ $500 ]
  9 left    6 left

  [ $625 ]  [ $650 ]  [ $675 ]  [ $750 ]
  4 left    5 left    3 left    5 left
  ```
- Each button disabled when:
  - Stock count is 0 (show "Out of stock"), OR
  - Staff balance < denomination (show "Insufficient balance")
- Clicking → confirmation modal: "Redeem $X of IB? You'll get a single-use discount code by email."
- On confirm → call `POST /api/redeem-ib`, show success state with the code visible + "We also emailed it to you."

Stock counts come from `GET /api/ib-pool/stock` and should auto-refresh every 30 seconds while page is open.

### New page: `/admin/ib-pool` (admin-only)

Gate by email allowlist (same as the API). Layout:

**Section 1 — Pool dashboard**
Table:
| Denomination | Available | Assigned | Used | Total |
|---|---|---|---|---|
| $25 | 18 | 5 | 12 | 35 |
| $50 | 3 ⚠️ | 8 | 22 | 33 |
| ... | ... | ... | ... | ... |

Row highlighted yellow if available < 5.

**Section 2 — Import codes**
Textarea accepting CSV format:
```
code,denomination_cents,expires_at
IB-Q3-001,2500,2027-06-18
IB-Q3-002,2500,2027-06-18
IB-Q3-003,5000,2027-06-18
```
+ "Import" button that POSTs to `/api/admin/ib-pool/import`.
+ Show inline result: "Imported 115 codes (0 duplicates skipped)."

**Section 3 — Recent activity**
Last 50 assignments: staff name, code, denomination, assigned_at.

---

## Email template (staff redemption)

```
Subject: Your Interplay Bucks discount code — $XX

Hi {staff_first_name},

You just redeemed $XX of Interplay Bucks. Here's your single-use code:

  CODE: IB-Q3-051
  VALUE: $XX off
  EXPIRES: {expires_at formatted}

How to use:
1. Add any Interplay event ticket to your cart at tickettailor.com
2. Apply this code at checkout
3. The $XX discount will be applied to your order

Notes:
- Single use only — once redeemed, it's spent.
- You can only use one discount code per checkout.
- Your remaining IB balance: $X,XXX

Questions? Reply to this email.

— Interplay
```

---

## Admin process (for Briana, every quarter)

Document this in the `/admin/ib-pool` page as expandable instructions:

### Step 1 — Create codes in Ticket Tailor (~10 min)

1. TT admin → Promote → Discount codes → New discount code.
2. **Check if TT supports bulk CSV import** (look for "Import" button on the discount codes page). If yes, skip to step 1c.
3. If no bulk import: create codes one at a time. For each:
   - **Code:** `IB-Q3-001`, `IB-Q3-002`, etc. (use quarter prefix, sequential numbers)
   - **Type:** Fixed amount discount
   - **Value:** $25, $50, $100, $250, $500, $625, $650, $675, or $750
   - **Max redemptions:** 1
   - **Applies to:** All events
   - **Expires:** 12 months from creation
4. Recommended quarterly batch (115 codes):
   - 20 × $25, 30 × $50, 20 × $100, 15 × $250, 10 × $500
   - 5 × $625, 5 × $650, 5 × $675, 5 × $750

### Step 2 — Import into Hourglass (~2 min)

1. Build a CSV in this exact format (one row per code):
   ```
   code,denomination_cents,expires_at
   IB-Q3-001,2500,2027-06-18
   IB-Q3-002,2500,2027-06-18
   ...
   ```
2. Go to `https://claude-code-nu.vercel.app/admin/ib-pool`
3. Paste CSV into the import box, click Import.
4. Confirm the success message shows the right count.

---

## Migration / cutover

1. Deploy schema migration first (adds table, doesn't touch existing data).
2. Deploy code changes behind a feature flag (`IB_POOL_REDEMPTION_ENABLED`).
3. Briana creates the first quarterly batch in TT and imports it.
4. Flip the flag → staff see the new denomination picker.
5. The old `/api/redeem-ib` body (freeform amount) returns 410 Gone with a helpful message: "Redemption flow updated — please refresh and pick a denomination."

---

## Acceptance criteria

- [ ] Staff can pick a denomination button and receive a working TT discount code by email within 30 seconds.
- [ ] If pool is empty for chosen denomination, staff sees clear out-of-stock message and is not charged any IB.
- [ ] Concurrent redemptions never assign the same code twice (verify with race-condition test).
- [ ] Admin import accepts a 115-row CSV in under 5 seconds.
- [ ] Low-stock alert fires Monday 6am PT when any denomination < 5.
- [ ] Existing Airtable Ledger writes continue to work — every redemption logged with staff, code, amount, timestamp.
- [ ] Email allowlist correctly blocks non-admin emails from `/admin/ib-pool` and import endpoint.

---

## Out of scope (for this ticket)

- Multi-tenant pools (per-staff codes) — see "Option 2" in the design doc; revisit if team grows beyond 5 staff.
- Automatic code generation via TT API — not possible with current TT API.
- Partial refunds when staff doesn't use a redeemed code — handle manually via Airtable adjustment.
- Tracking code usage state from TT side (`used` status) — defer until we add TT webhook listener for `order.created`.
