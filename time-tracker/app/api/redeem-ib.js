// POST /api/redeem-ib — staff redeems IB → single-use Ticket Tailor voucher.
// Auth: Authorization: Bearer <Supabase access token>. Body: { amount, workshop_note? }.
// Balance is recomputed server-side; amount is validated (>0, ≤ balance, ≤ $1000).
import { getSessionUser, findStaffByEmail, fetchLedgerForStaff, computeBalance, airtable, initialsOf, L, S } from "../server/ib.js";

const LEDGER_TABLE = process.env.AIRTABLE_IB_LEDGER_TABLE;
const TT_API_KEY = process.env.TT_API_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM;
const TYPE_REDEEMED = "Redeemed - Gift Card (TicketTailor)";
const MAX_REDEEM = 1000;

function rand6() {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  let s = "";
  for (let i = 0; i < 6; i++) s += c[Math.floor(Math.random() * c.length)];
  return s;
}

// (voucher creation is inlined in the handler below, with debug logging)

async function sendEmail(to, subject, html) {
  if (!RESEND_API_KEY || !RESEND_FROM) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: RESEND_FROM, to: [to], subject, html }),
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
  try {
    const user = await getSessionUser(req);
    if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const staff = await findStaffByEmail(user.email);
    if (!staff) { res.status(400).json({ error: "No staff record found, contact admin." }); return; }

    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
    body = body || {};
    const amount = Math.round(Number(body.amount) * 100) / 100;
    const note = String(body.workshop_note || "").slice(0, 200);

    if (!(amount > 0)) { res.status(400).json({ error: "Amount must be greater than 0." }); return; }
    if (amount > MAX_REDEEM) { res.status(400).json({ error: `Amount exceeds the $${MAX_REDEEM} limit.` }); return; }

    const balance = computeBalance(await fetchLedgerForStaff(staff.id));
    if (amount > balance) { res.status(400).json({ error: `Amount exceeds your balance of $${balance.toFixed(2)}.` }); return; }

    const name = staff.fields?.[S.name] || "";
    const code = `IB-${initialsOf(name)}-${rand6()}`;
    const now = new Date();
    const expires = new Date(now); expires.setMonth(expires.getMonth() + 12);
    const expiryUnix = Math.floor((Date.now() + 365 * 24 * 60 * 60 * 1000) / 1000); // TT wants seconds since epoch

    // 1) Create the voucher batch (usable on any event). DEBUG: verbose logging.
    const ttAuth = "Basic " + Buffer.from(TT_API_KEY + ":").toString("base64");
    const batchPayload = {
      name: `Interplay Bucks Redemption — ${name} — $${amount}`,
      type: "fixed_amount", value: String(Math.round(amount * 100)),
      expiry: String(expiryUnix), max_redemptions: "1", usable_on_any_event: "true",
    };
    console.log("TT batch request body:", batchPayload);
    let batchRes;
    try {
      batchRes = await fetch("https://api.tickettailor.com/v1/vouchers", {
        method: "POST",
        headers: { Authorization: ttAuth, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(batchPayload).toString(),
      });
    } catch (e) {
      console.log("TT batch fetch error:", String(e));
      res.status(400).json({ error: "Ticket Tailor rejected the voucher batch", tt_status: 0, tt_body: String(e?.message || e) });
      return;
    }
    const batchText = await batchRes.text().catch(() => "");
    console.log("TT batch response:", batchRes.status, batchText);
    if (!batchRes.ok) {
      res.status(400).json({ error: "Ticket Tailor rejected the voucher batch", tt_status: batchRes.status, tt_body: batchText });
      return;
    }
    let batchId;
    try { const b = JSON.parse(batchText); batchId = b.id || b.data?.id; } catch { /* ignore */ }
    if (!batchId) {
      res.status(400).json({ error: "Ticket Tailor returned no batch id", tt_status: batchRes.status, tt_body: batchText });
      return;
    }

    const rollback = async () => {
      try { await fetch(`https://api.tickettailor.com/v1/vouchers/${batchId}`, { method: "DELETE", headers: { Authorization: ttAuth } }); }
      catch (e) { console.log("TT batch rollback failed:", String(e)); }
    };

    // 2) Issue an actual redeemable code within the batch.
    const issuePayload = { voucher_id: batchId, code };
    console.log("TT issue request body:", issuePayload);
    let issueRes;
    try {
      issueRes = await fetch("https://api.tickettailor.com/v1/issued_vouchers", {
        method: "POST",
        headers: { Authorization: ttAuth, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(issuePayload).toString(),
      });
    } catch (e) {
      console.log("TT issue fetch error:", String(e));
      await rollback();
      res.status(400).json({ error: "Ticket Tailor could not issue the code", tt_status: 0, tt_body: String(e?.message || e) });
      return;
    }
    const issueText = await issueRes.text().catch(() => "");
    console.log("TT issue response:", issueRes.status, issueText);
    if (!issueRes.ok) {
      await rollback();
      res.status(400).json({ error: "Ticket Tailor could not issue the code", tt_status: issueRes.status, tt_body: issueText });
      return;
    }
    let finalCode = code;
    try { const iv = JSON.parse(issueText); finalCode = iv.code || iv.data?.code || code; } catch { /* keep code */ }

    // 2) ledger row (negative)
    await airtable("POST", encodeURIComponent(LEDGER_TABLE), {
      typecast: true,
      records: [{ fields: {
        [L.entryLabel]: `IB Redemption — ${finalCode}`,
        [L.person]: [staff.id], [L.date]: now.toISOString().slice(0, 10),
        [L.amount]: -amount, [L.type]: TYPE_REDEEMED, [L.ttRef]: finalCode,
        [L.notes]: `Redeemed via Hourglass dashboard. Code expires ${expires.toISOString().slice(0, 10)}. Workshop note: ${note || "n/a"}`,
      } }],
    });

    // 3) email (best-effort)
    const exp = expires.toISOString().slice(0, 10);
    await sendEmail(
      user.email,
      `Your Interplay Bucks code — ${finalCode} ($${amount.toFixed(2)})`,
      `<div style="font-family:sans-serif;line-height:1.5">
        <h2>Your Interplay Bucks gift code</h2>
        <p>Amount: <strong>$${amount.toFixed(2)}</strong><br/>Code: <strong>${finalCode}</strong><br/>Expires: <strong>${exp}</strong></p>
        <p>Paste this code at checkout for any Interplay workshop to apply the discount.</p>
        <p style="color:#6E655C">Questions? Reply to this email or contact your admin.</p>
      </div>`
    ).catch(() => {});

    res.status(200).json({
      code: finalCode, amount, expires_at: expires.toISOString(),
      new_balance: Math.round((balance - amount) * 100) / 100,
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
