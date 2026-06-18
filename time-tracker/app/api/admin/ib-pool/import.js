// POST /api/admin/ib-pool/import — bulk-import codes (admin email allowlist).
// Body: { codes: [{ code, denomination_cents, expires_at? }] } OR { csv: "..." }.
import { getSessionUser, isPoolAdmin, supabaseAdmin, DENOMS } from "../../../server/ib.js";

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
  try {
    const user = await getSessionUser(req);
    if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
    if (!isPoolAdmin(user.email)) { res.status(403).json({ error: "Admins only." }); return; }

    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = { csv: body }; } }
    body = body || {};

    const rows = [];
    const invalid = [];
    const push = (code, denomP, expP) => {
      const c = (code || "").toString().trim();
      const denom = Number(denomP);
      if (!c || !DENOMS.includes(denom)) { invalid.push(code); return; }
      const rec = { code: c, denomination_cents: denom };
      if (expP) rec.expires_at = String(expP).trim();
      rows.push(rec);
    };

    if (Array.isArray(body.codes)) {
      for (const c of body.codes) push(c.code, c.denomination_cents, c.expires_at);
    } else if (typeof body.csv === "string") {
      for (const raw of body.csv.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || /^code\s*,/i.test(line)) continue;
        const [c, d, e] = line.split(",").map((s) => (s || "").trim());
        push(c, d, e);
      }
    }

    if (!rows.length) { res.status(400).json({ error: "No valid rows found.", invalid_lines: invalid.slice(0, 20) }); return; }

    // ON CONFLICT (code) DO NOTHING; .select() returns only newly inserted rows.
    const { data: inserted, error } = await supabaseAdmin()
      .from("ib_code_pool")
      .upsert(rows, { onConflict: "code", ignoreDuplicates: true })
      .select("code, denomination_cents");
    if (error) { res.status(500).json({ error: error.message }); return; }

    const byDenom = {};
    for (const d of DENOMS) byDenom[d] = 0;
    for (const r of inserted || []) byDenom[r.denomination_cents] = (byDenom[r.denomination_cents] || 0) + 1;

    res.status(200).json({
      inserted: (inserted || []).length,
      skipped_duplicates: rows.length - (inserted || []).length,
      by_denomination: byDenom,
      invalid_lines: invalid.slice(0, 20),
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
