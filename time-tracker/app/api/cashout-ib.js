// ────────────────────────────────────────────────────────────────────
// Monthly Interplay Bucks EARNINGS cron (records only — no gift card).
// Runs the 1st of each month (see ../vercel.json). For each eligible Pay
// Period in the target month, writes one "Earned (Hourly)" Ledger row so
// the balance accrues. Redemption is separate & self-service (/api/redeem-ib).
//
// Auth: Bearer CRON_SECRET or ?secret=. ?dry_run=1 skips writes.
// ?target_month=YYYY-MM overrides the default (previous calendar month).
// Idempotent: skips a pay period that already has an Earned row linked to it.
// ────────────────────────────────────────────────────────────────────
import { airtable, S, initialsOf, L } from "../server/ib.js";

const CRON_SECRET = process.env.CRON_SECRET;
const PAY_PERIODS_TABLE = process.env.AIRTABLE_PAY_PERIODS_TABLE;
const LEDGER_TABLE = process.env.AIRTABLE_IB_LEDGER_TABLE;
const STAFF_TABLE = process.env.AIRTABLE_STAFF_TABLE;
const PP = { person: "fldrqvgbLMSMTMbVC", ibEarned: "fldi5HWhaSX2AY6ee", label: "fldxEy2KmZCzZPPP9" };
const TYPE_EARNED = "Earned (Hourly)";
const pad2 = (n) => String(n).padStart(2, "0");

async function run({ dryRun, targetMonth }) {
  if (!targetMonth) {
    const d = new Date();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - 1);
    targetMonth = `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
  }
  const summary = { dry_run: dryRun, target_month: targetMonth, recorded: 0, skipped: 0, errors: [], details: [] };
  const today = new Date().toISOString().slice(0, 10);
  const stamp = new Date().toISOString();

  // Pay periods already turned into Earned rows (idempotency by Source Pay Period link)
  const earnedPPIds = new Set();
  {
    const p = new URLSearchParams({ filterByFormula: `{Type}='${TYPE_EARNED}'`, returnFieldsByFieldId: "true", pageSize: "100" });
    p.append("fields[]", L.sourcePP);
    let offset;
    do {
      if (offset) p.set("offset", offset);
      const page = await airtable("GET", `${encodeURIComponent(LEDGER_TABLE)}?${p}`);
      for (const r of page.records || []) (r.fields?.[L.sourcePP] || []).forEach((id) => earnedPPIds.add(id));
      offset = page.offset;
    } while (offset);
  }

  // Eligible pay periods for the target month
  const formula =
    `AND(OR({Status}='Paid',{Status}='Sent to Bookkeeper'),` +
    `DATETIME_FORMAT({Period End},'YYYY-MM')='${targetMonth}',{IB Earned}>0)`;
  const pps = [];
  {
    const p = new URLSearchParams({ filterByFormula: formula, returnFieldsByFieldId: "true", pageSize: "100" });
    [PP.person, PP.ibEarned, PP.label].forEach((f) => p.append("fields[]", f));
    let offset;
    do {
      if (offset) p.set("offset", offset);
      const page = await airtable("GET", `${encodeURIComponent(PAY_PERIODS_TABLE)}?${p}`);
      pps.push(...(page.records || []));
      offset = page.offset;
    } while (offset);
  }

  for (const pp of pps) {
    try {
      if (earnedPPIds.has(pp.id)) { summary.skipped++; continue; }
      const staffId = pp.fields?.[PP.person]?.[0];
      const ibDollars = Number(pp.fields?.[PP.ibEarned] || 0);
      const ppLabel = pp.fields?.[PP.label] || "";
      if (!staffId || !(ibDollars > 0)) { summary.skipped++; continue; }

      const staff = await airtable("GET", `${encodeURIComponent(STAFF_TABLE)}/${staffId}?returnFieldsByFieldId=true`);
      const name = staff.fields?.[S.name] || "Unknown";

      if (dryRun) {
        summary.recorded++;
        summary.details.push({ name, amount: ibDollars, status: "would_record" });
        continue;
      }

      await airtable("POST", encodeURIComponent(LEDGER_TABLE), {
        typecast: true,
        records: [{ fields: {
          [L.entryLabel]: `IB Earned — ${name} ${targetMonth}`,
          [L.person]: [staffId], [L.date]: today,
          [L.amount]: ibDollars, [L.type]: TYPE_EARNED, [L.sourcePP]: [pp.id],
          [L.notes]: `Auto-recorded by monthly cashout cron on ${stamp}. From ${ppLabel}. Balance available to redeem at any Interplay workshop.`,
        } }],
      });
      summary.recorded++;
      summary.details.push({ name, amount: ibDollars, status: "recorded" });
    } catch (e) {
      summary.errors.push({ payPeriod: pp.id, error: String(e.message || e) });
    }
  }
  return summary;
}

export default async function handler(req, res) {
  const authHeader = req.headers["authorization"] || "";
  const secretQuery = (req.query && req.query.secret) || "";
  const ok = CRON_SECRET && (authHeader === `Bearer ${CRON_SECRET}` || secretQuery === CRON_SECRET);
  if (!ok) { res.status(401).json({ error: "Unauthorized" }); return; }

  const missing = [];
  ["AIRTABLE_API_KEY", "AIRTABLE_BASE_ID", "AIRTABLE_PAY_PERIODS_TABLE", "AIRTABLE_IB_LEDGER_TABLE", "AIRTABLE_STAFF_TABLE"]
    .forEach((k) => { if (!process.env[k]) missing.push(k); });
  if (missing.length) { res.status(500).json({ error: "Missing env vars", missing }); return; }

  const dryRun = (req.query && (req.query.dry_run === "1" || req.query.dry_run === "true")) || false;
  const q = req.query || {};
  const targetMonth = /^\d{4}-\d{2}$/.test(q.target_month || q.month || "") ? (q.target_month || q.month) : null;

  try {
    res.status(200).json(await run({ dryRun, targetMonth }));
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
