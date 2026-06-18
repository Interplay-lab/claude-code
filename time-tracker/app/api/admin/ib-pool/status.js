// GET /api/admin/ib-pool/status — full pool dashboard (admin email allowlist).
import { getSessionUser, isPoolAdmin, supabaseAdmin, DENOMS } from "../../../server/ib.js";

export default async function handler(req, res) {
  try {
    const user = await getSessionUser(req);
    if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
    if (!isPoolAdmin(user.email)) { res.status(403).json({ error: "Admins only." }); return; }

    const admin = supabaseAdmin();
    const [{ data: counts }, { data: imports }, { data: assignments }] = await Promise.all([
      admin.rpc("ib_pool_counts"),
      admin.rpc("ib_pool_recent_imports"),
      admin.from("ib_code_pool")
        .select("code, denomination_cents, assigned_at, staff:assigned_to_staff_id(full_name)")
        .not("assigned_at", "is", null)
        .order("assigned_at", { ascending: false }).limit(50),
    ]);

    const byDenom = {};
    const blank = () => ({ available: 0, assigned: 0, used: 0, expired: 0, total: 0 });
    for (const d of DENOMS) byDenom[d] = blank();
    for (const r of counts || []) {
      const b = byDenom[r.denomination_cents] || (byDenom[r.denomination_cents] = blank());
      b[r.status] = Number(r.n);
      b.total += Number(r.n);
    }

    res.status(200).json({
      denoms: DENOMS,
      counts: byDenom,
      recent_imports: (imports || []).map((r) => ({ imported_at: r.imported_at, count: Number(r.n) })),
      recent_assignments: (assignments || []).map((a) => ({
        code: a.code, denomination_cents: a.denomination_cents,
        assigned_at: a.assigned_at, staff_name: a.staff?.full_name || "",
      })),
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
