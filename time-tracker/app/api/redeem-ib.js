// POST /api/redeem-ib — staff redeems IB by drawing a pre-staged TT discount
// code from the pool (Plan B). No Ticket Tailor API call at redeem time.
// Gated by IB_POOL_REDEMPTION_ENABLED. Auth: Bearer Supabase access token.
// Body: { denomination_cents }.
import {
  getSessionUser, findStaffByEmail, fetchLedgerForStaff, computeBalance,
  airtable, supabaseAdmin, getSupabaseStaff, sendResend, DENOMS, POOL_ENABLED, L, S,
} from "../server/ib.js";

const LEDGER_TABLE = process.env.AIRTABLE_IB_LEDGER_TABLE;
const TYPE_REDEEMED = "Redeemed - Gift Card (TicketTailor)";
const usd = (cents) => (cents / 100).toLocaleString("en-US");

function emailHtml(firstName, code, denomCents, expiresAt, newBalance) {
  const v = usd(denomCents);
  return `<div style="font-family:sans-serif;line-height:1.6">
    <p>Hi ${firstName},</p>
    <p>You just redeemed $${v} of Interplay Bucks. Here's your single-use code:</p>
    <p style="font-size:16px"><strong>CODE: ${code}</strong><br/>VALUE: $${v} off<br/>${expiresAt ? `EXPIRES: ${String(expiresAt).slice(0, 10)}` : ""}</p>
    <p><strong>How to use:</strong></p>
    <ol>
      <li>Add any Interplay event ticket to your cart at tickettailor.com</li>
      <li>Apply this code at checkout</li>
      <li>The $${v} discount will be applied to your order</li>
    </ol>
    <p style="color:#6E655C">Single use only — once redeemed, it's spent. One discount code per checkout.<br/>
    Your remaining IB balance: $${Number(newBalance).toLocaleString("en-US")}</p>
    <p>Questions? Reply to this email.</p>
    <p>— Interplay</p>
  </div>`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
  try {
    if (!POOL_ENABLED) {
      res.status(410).json({ error: "redemption_disabled", message: "Redemption flow updated — please refresh and pick a denomination." });
      return;
    }

    const user = await getSessionUser(req);
    if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const staff = await findStaffByEmail(user.email);            // Airtable record (ledger)
    if (!staff) { res.status(400).json({ error: "No staff record found, contact admin." }); return; }
    const supaStaff = await getSupabaseStaff(user.email);        // Supabase staff (pool FK)

    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
    body = body || {};

    // Old freeform body → 410 Gone (cutover).
    if (body.amount != null && body.denomination_cents == null) {
      res.status(410).json({ error: "redemption_updated", message: "Redemption flow updated — please refresh and pick a denomination." });
      return;
    }

    const denom = Number(body.denomination_cents);
    if (!DENOMS.includes(denom)) { res.status(400).json({ error: "Invalid denomination." }); return; }
    const dollars = denom / 100;

    const balance = computeBalance(await fetchLedgerForStaff(staff.id));
    if (balance < dollars) { res.status(400).json({ error: `That's more than your balance of $${balance.toLocaleString("en-US")}.` }); return; }

    // Atomically claim one available code of this denomination.
    const admin = supabaseAdmin();
    const { data: claimed, error: claimErr } = await admin.rpc("claim_ib_code", { p_denomination: denom, p_staff: supaStaff?.id || null });
    if (claimErr) { console.log("claim_ib_code error:", claimErr.message); res.status(500).json({ error: "Could not claim a code." }); return; }
    const row = Array.isArray(claimed) ? claimed[0] : claimed;
    if (!row || !row.code) {
      res.status(409).json({ error: "out_of_stock", denomination_cents: denom, message: `No $${usd(denom)} codes currently in stock. Please choose a different denomination or contact admin@interplay.org.` });
      return;
    }
    const code = row.code;
    const expiresAt = row.expires_at || null;

    // Record in the Airtable ledger (negative). On failure, release the code.
    let created;
    try {
      created = await airtable("POST", encodeURIComponent(LEDGER_TABLE), {
        typecast: true,
        records: [{ fields: {
          [L.entryLabel]: `IB Redemption — ${code}`,
          [L.person]: [staff.id], [L.date]: new Date().toISOString().slice(0, 10),
          [L.amount]: -dollars, [L.type]: TYPE_REDEEMED, [L.ttRef]: code,
          [L.notes]: `Redeemed via Hourglass (code pool). $${usd(denom)} single-use.${expiresAt ? ` Expires ${String(expiresAt).slice(0, 10)}.` : ""}`,
        } }],
      });
    } catch (e) {
      await admin.from("ib_code_pool").update({ status: "available", assigned_to_staff_id: null, assigned_at: null }).eq("code", code);
      console.log("ledger write failed, released code:", code, String(e));
      res.status(502).json({ error: "Could not record the redemption — no code was issued. Please try again." });
      return;
    }
    const ledgerRowId = created?.records?.[0]?.id || null;
    const newBalance = Math.round((balance - dollars) * 100) / 100;
    const firstName = (staff.fields?.[S.name] || "").split(/\s+/)[0] || "there";

    await sendResend(user.email, `Your Interplay Bucks discount code — $${usd(denom)}`, emailHtml(firstName, code, denom, expiresAt, newBalance)).catch(() => {});

    res.status(200).json({ code, denomination_cents: denom, expires_at: expiresAt, ledger_row_id: ledgerRowId, new_balance: newBalance });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
