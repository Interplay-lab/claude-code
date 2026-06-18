// GET /api/ib-balance — balance + history + pool feature flag for the logged-in staff.
// Auth: Authorization: Bearer <Supabase access token> (sent by the SPA).
// (Live code-pool stock lives at /api/ib-pool/stock and is polled by the picker.)
import { getSessionUser, findStaffByEmail, fetchLedgerForStaff, computeBalance, POOL_ENABLED, L, S } from "../server/ib.js";

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

    res.status(200).json({ found: true, name: staff.fields?.[S.name] || "", balance, history, pool_enabled: POOL_ENABLED });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
