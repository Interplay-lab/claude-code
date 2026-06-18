// GET /api/admin/ib-pool — pool counts + recent imports (admin only).
import { getSessionUser, getSupabaseStaff, supabaseAdmin, DENOMS } from "../../server/ib.js";

export default async function handler(req, res) {
  try {
    const user = await getSessionUser(req);
    if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
    const me = await getSupabaseStaff(user.email);
    if (!me || me.role !== "admin") { res.status(403).json({ error: "Admins only." }); return; }

    const admin = supabaseAdmin();
    const [{ data: counts }, { data: imports }] = await Promise.all([
      admin.rpc("ib_pool_counts"),
      admin.rpc("ib_pool_recent_imports"),
    ]);

    // shape: { [denom]: { available, assigned, used } }
    const byDenom = {};
    for (const d of DENOMS) byDenom[d] = { available: 0, assigned: 0, used: 0 };
    for (const r of counts || []) {
      if (!byDenom[r.denomination_cents]) byDenom[r.denomination_cents] = { available: 0, assigned: 0, used: 0 };
      byDenom[r.denomination_cents][r.status] = Number(r.n);
    }

    res.status(200).json({
      denoms: DENOMS,
      counts: byDenom,
      recent_imports: (imports || []).map((r) => ({ imported_at: r.imported_at, count: Number(r.n) })),
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
