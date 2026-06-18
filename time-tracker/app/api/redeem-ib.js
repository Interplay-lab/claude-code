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
    const expiryYMD = expires.toISOString().slice(0, 10);

    // 1) voucher first — if this fails, no ledger row / email. (DEBUG: verbose logging)
    const payload = {
      code, type: "fixed_amount", value: String(Math.round(amount * 100)),
      expiry: expiryYMD, max_redemptions: "1",
    };
    console.log("TT request body:", payload);
    let ttRes;
    try {
      ttRes = await fetch("https://api.tickettailor.com/v1/vouchers", {
        method: "POST",
        headers: {
          Authorization: "Basic " + Buffer.from(TT_API_KEY + ":").toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(payload).toString(),
      });
    } catch (e) {
      console.log("TT fetch error:", String(e));
      res.status(400).json({ error: "Ticket Tailor rejected the voucher", tt_status: 0, tt_body: String(e?.message || e) });
      return;
    }
    if (!ttRes.ok) {
      const ttBody = await ttRes.text().catch(() => "");
      console.log("TT response:", ttRes.status, ttBody);
      res.status(400).json({ error: "Ticket Tailor rejected the voucher", tt_status: ttRes.status, tt_body: ttBody });
      return;
    }

    // 2) ledger row (negative)
    await airtable("POST", encodeURIComponent(LEDGER_TABLE), {
      typecast: true,
      records: [{ fields: {
        [L.entryLabel]: `IB Redemption — ${code}`,
        [L.person]: [staff.id], [L.date]: now.toISOString().slice(0, 10),
        [L.amount]: -amount, [L.type]: TYPE_REDEEMED, [L.ttRef]: code,
        [L.notes]: `Redeemed via Hourglass dashboard. Code expires ${expires.toISOString().slice(0, 10)}. Workshop note: ${note || "n/a"}`,
      } }],
    });

    // 3) email (best-effort)
    const exp = expires.toISOString().slice(0, 10);
    await sendEmail(
      user.email,
      `Your Interplay Bucks code — ${code} ($${amount.toFixed(2)})`,
      `<div style="font-family:sans-serif;line-height:1.5">
        <h2>Your Interplay Bucks gift code</h2>
        <p>Amount: <strong>$${amount.toFixed(2)}</strong><br/>Code: <strong>${code}</strong><br/>Expires: <strong>${exp}</strong></p>
        <p>Paste this code at checkout for any Interplay workshop to apply the discount.</p>
        <p style="color:#6E655C">Questions? Reply to this email or contact your admin.</p>
      </div>`
    ).catch(() => {});

    res.status(200).json({
      code, amount, expires_at: expires.toISOString(),
      new_balance: Math.round((balance - amount) * 100) / 100,
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
