// POST /api/redeem-ib — staff redeems IB by drawing a pre-staged TT discount
// code from the pool (Plan B). No Ticket Tailor API call at redeem time.
// Auth: Authorization: Bearer <Supabase access token>. Body: { denomination_cents }.
import {
  getSessionUser, findStaffByEmail, fetchLedgerForStaff, computeBalance,
  airtable, supabaseAdmin, getSupabaseStaff, sendResend, DENOMS, L, S,
} from "../server/ib.js";

const LEDGER_TABLE = process.env.AIRTABLE_IB_LEDGER_TABLE;
const TYPE_REDEEMED = "Redeemed - Gift Card (TicketTailor)";
const money = (cents) => `$${(cents / 100).toFixed(2)}`;

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
  try {
    const user = await getSessionUser(req);
    if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const staff = await findStaffByEmail(user.email);          // Airtable record (for ledger)
    if (!staff) { res.status(400).json({ error: "No staff record found, contact admin." }); return; }
    const supaStaff = await getSupabaseStaff(user.email);      // Supabase staff (for pool FK)

    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
    body = body || {};
    const denom = Number(body.denomination_cents);
    if (!DENOMS.includes(denom)) { res.status(400).json({ error: "Invalid denomination." }); return; }
    const dollars = denom / 100;

    const balance = computeBalance(await fetchLedgerForStaff(staff.id));
    if (balance < dollars) { res.status(400).json({ error: `That's more than your balance of $${balance.toFixed(2)}.` }); return; }

    // Atomically claim one available code of this denomination.
    const admin = supabaseAdmin();
    const { data: claimed, error: claimErr } = await admin.rpc("claim_ib_code", {
      p_denomination: denom, p_staff: supaStaff?.id || null,
    });
    if (claimErr) { console.log("claim_ib_code error:", claimErr.message); res.status(500).json({ error: "Could not claim a code." }); return; }
    const row = Array.isArray(claimed) ? claimed[0] : claimed;
    if (!row || !row.code) {
      res.status(409).json({ error: `No ${money(denom)} codes currently in stock. Please choose a different denomination or contact admin.` });
      return;
    }
    const code = row.code;
    const expiresAt = row.expires_at || null;

    // Record the redemption in the Airtable ledger (negative). If this fails,
    // release the claimed code so it isn't lost.
    try {
      await airtable("POST", encodeURIComponent(LEDGER_TABLE), {
        typecast: true,
        records: [{ fields: {
          [L.entryLabel]: `IB Redemption — ${code}`,
          [L.person]: [staff.id], [L.date]: new Date().toISOString().slice(0, 10),
          [L.amount]: -dollars, [L.type]: TYPE_REDEEMED, [L.ttRef]: code,
          [L.notes]: `Redeemed via Hourglass (code pool). ${money(denom)} single-use.${expiresAt ? ` Expires ${expiresAt}.` : ""}`,
        } }],
      });
    } catch (e) {
      await admin.from("ib_code_pool").update({ status: "available", assigned_to_staff_id: null, assigned_at: null }).eq("code", code);
      console.log("ledger write failed, released code:", code, String(e));
      res.status(502).json({ error: "Could not record the redemption — no code was issued. Please try again." });
      return;
    }

    // Email the code (best-effort).
    await sendResend(
      user.email,
      `Your Interplay Bucks code: ${code} (${money(denom)})`,
      `<div style="font-family:sans-serif;line-height:1.6">
        <h2>Your Interplay Bucks code: ${code}</h2>
        <p><strong>Value: ${money(denom)}</strong></p>
        <p>Use this at any Interplay event checkout. Single-use only.</p>
        ${expiresAt ? `<p>Expires: <strong>${expiresAt}</strong></p>` : ""}
        <p style="color:#6E655C">Questions? Reply to this email or contact your admin.</p>
      </div>`
    ).catch(() => {});

    res.status(200).json({
      code, amount: dollars, denomination_cents: denom, expires_at: expiresAt,
      new_balance: Math.round((balance - dollars) * 100) / 100,
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
