// GET /api/ib-balance — balance + history + code-pool stock for the logged-in staff.
// Auth: Authorization: Bearer <Supabase access token> (sent by the SPA).
import { getSessionUser, findStaffByEmail, fetchLedgerForStaff, computeBalance, supabaseAdmin, DENOMS, L, S } from "../server/ib.js";

export default async function handler(req, res) {
  try {
    const user = await getSessionUser(req);
    if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const staff = await findStaffByEmail(user.email);
    if (!staff) { res.status(200).json({ found: false }); return; }

    const rows = await fetchLedgerForStaff(staff.id);
    const balance = computeBalance(rows);
    const history = rows
      .map((r) => ({
        id: r.id,
        date: r.fields?.[L.date] || null,
        label: r.fields?.[L.entryLabel] || "",
        type: r.fields?.[L.type] || "",
        amount: Number(r.fields?.[L.amount] || 0),
        ttRef: r.fields?.[L.ttRef] || null,
      }))
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

    // available code-pool stock per denomination (for the redeem picker)
    const stock = {};
    for (const d of DENOMS) stock[d] = 0;
    try {
      const { data: rows } = await supabaseAdmin().rpc("ib_pool_stock");
      for (const r of rows || []) stock[r.denomination_cents] = Number(r.available);
    } catch { /* stock optional */ }

    res.status(200).json({ found: true, name: staff.fields?.[S.name] || "", balance, stock, denoms: DENOMS, history });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
