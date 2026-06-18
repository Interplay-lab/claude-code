// POST /api/admin/ib-pool/import — bulk-import codes (admin only).
// Body: { csv: "code,denomination_cents[,expires_at]\n..." } or raw CSV text.
import { getSessionUser, getSupabaseStaff, supabaseAdmin, DENOMS } from "../../../server/ib.js";

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
  try {
    const user = await getSessionUser(req);
    if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
    const me = await getSupabaseStaff(user.email);
    if (!me || me.role !== "admin") { res.status(403).json({ error: "Admins only." }); return; }

    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = { csv: body }; } }
    const csv = (body && (body.csv ?? body)) || "";
    const text = typeof csv === "string" ? csv : "";

    const rows = [];
    const errors = [];
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      if (/^code\s*,/i.test(line)) continue; // header
      const [codeP, denomP, expP] = line.split(",").map((s) => (s || "").trim());
      const code = codeP;
      const denomination_cents = Number(denomP);
      if (!code || !DENOMS.includes(denomination_cents)) { errors.push(line); continue; }
      const rec = { code, denomination_cents };
      if (expP && /^\d{4}-\d{2}-\d{2}$/.test(expP)) rec.expires_at = expP;
      rows.push(rec);
    }

    if (!rows.length) { res.status(400).json({ error: "No valid rows found.", invalid_lines: errors.slice(0, 20) }); return; }

    // Insert, skipping duplicate codes; .select() returns only the inserted rows.
    const { data: inserted, error } = await supabaseAdmin()
      .from("ib_code_pool")
      .upsert(rows, { onConflict: "code", ignoreDuplicates: true })
      .select("code, denomination_cents");
    if (error) { res.status(500).json({ error: error.message }); return; }

    const importedByDenom = {};
    for (const d of DENOMS) importedByDenom[d] = 0;
    for (const r of inserted || []) importedByDenom[r.denomination_cents] = (importedByDenom[r.denomination_cents] || 0) + 1;

    res.status(200).json({
      imported: (inserted || []).length,
      imported_by_denom: importedByDenom,
      skipped_duplicates: rows.length - (inserted || []).length,
      invalid_lines: errors.slice(0, 20),
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
