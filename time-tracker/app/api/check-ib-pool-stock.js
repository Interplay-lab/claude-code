// GET /api/check-ib-pool-stock — emails admins if any denomination < 10.
// Auth: Bearer CRON_SECRET or ?secret=. Also invoked weekly by the daily
// sync cron (Mondays) since Vercel Hobby caps at 2 dedicated cron jobs.
import { runPoolStockCheck } from "../server/ib.js";

const CRON_SECRET = process.env.CRON_SECRET;

export default async function handler(req, res) {
  const authHeader = req.headers["authorization"] || "";
  const secretQuery = (req.query && req.query.secret) || "";
  const ok = CRON_SECRET && (authHeader === `Bearer ${CRON_SECRET}` || secretQuery === CRON_SECRET);
  if (!ok) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    res.status(200).json(await runPoolStockCheck());
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
