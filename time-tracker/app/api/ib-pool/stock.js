// GET /api/ib-pool/stock — available code counts per denomination.
// Auth: any signed-in staff (Bearer Supabase access token).
import { getSessionUser, supabaseAdmin, DENOMS } from "../../server/ib.js";

export default async function handler(req, res) {
  try {
    const user = await getSessionUser(req);
    if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
    const { data } = await supabaseAdmin().rpc("ib_pool_stock");
    const map = {};
    for (const r of data || []) map[r.denomination_cents] = Number(r.available);
    res.status(200).json({ stock: DENOMS.map((d) => ({ denomination_cents: d, available: map[d] || 0 })) });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
