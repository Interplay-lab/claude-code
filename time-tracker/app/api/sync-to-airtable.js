// ────────────────────────────────────────────────────────────────────
// Nightly sync: Supabase time_entries → Airtable Time Entries.
// Runs as a Vercel Cron (see ../vercel.json) and can be triggered
// manually in a browser via ?secret=<CRON_SECRET> for testing.
//
// App DB (Supabase) is the source of truth; Airtable is the downstream
// payroll mirror. Upserts on the "Hourglass Entry ID" field so re-runs
// never duplicate. Reproduces the field contract documented in DESIGN.md.
// ────────────────────────────────────────────────────────────────────
import { createClient } from "@supabase/supabase-js";
import { runPoolStockCheck } from "../server/ib.js";

// Airtable Time Entries field IDs
const F = {
  hourglassId: "fldSQhZv3NtqSILop", // merge key
  person:      "fldzRyHOyY3ocVKuB", // link → Staff
  description: "fldaiBgFLfLbRxBtR",
  tags:        "fldBT8i9CsChbKApw",
  billable:    "fldGSlx6MFSxkEigo",
  start:       "fldhdPbYSruwgNx1v",
  stop:        "fldUA164kU5I4Vcoq",
  durationHrs: "fldD1GcgopcDoTkKN",
  locked:      "fldZSmlh3lK5DANpz",
  lastSynced:  "fldH4TX6zOoRQ2X8w",
};
const STAFF_EMAIL_FIELD = "fldl6XZZ4GCPNOJSm";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const TIME_TABLE = process.env.AIRTABLE_TIME_ENTRIES_TABLE;
const STAFF_TABLE = process.env.AIRTABLE_STAFF_TABLE;
const CRON_SECRET = process.env.CRON_SECRET;

const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };

async function airtable(path, opts = {}) {
  const res = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}`, "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  if (!res.ok) throw new Error(`Airtable ${res.status}: ${await res.text()}`);
  return res.json();
}

// supabase staff_id → airtable Staff record id (joined on email)
async function buildStaffMap(db) {
  const { data: staff, error } = await db.from("staff").select("id,email");
  if (error) throw error;
  const idToEmail = {};
  for (const s of staff) idToEmail[s.id] = (s.email || "").toLowerCase();

  const emailToRec = {};
  let offset;
  do {
    const params = new URLSearchParams({ pageSize: "100", returnFieldsByFieldId: "true" });
    params.append("fields[]", STAFF_EMAIL_FIELD);
    if (offset) params.set("offset", offset);
    const page = await airtable(`${encodeURIComponent(STAFF_TABLE)}?${params}`);
    for (const r of page.records || []) {
      const email = (r.fields?.[STAFF_EMAIL_FIELD] || "").toLowerCase();
      if (email) emailToRec[email] = r.id;
    }
    offset = page.offset;
  } while (offset);

  const map = {};
  for (const [sid, email] of Object.entries(idToEmail)) {
    if (emailToRec[email]) map[sid] = emailToRec[email];
  }
  return map;
}

function toFields(row, personRecId) {
  const f = {
    [F.hourglassId]: row.id,
    [F.description]: row.description || "",
    [F.tags]: (row.tags || []).join(", "),
    [F.billable]: !!row.billable,
    [F.start]: row.start_at,
    [F.stop]: row.stop_at,
    [F.durationHrs]: (row.duration_seconds || 0) / 3600,
    [F.locked]: !!row.locked,
    [F.lastSynced]: row.updated_at,
  };
  if (personRecId) f[F.person] = [personRecId];
  return f;
}

async function runSync() {
  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const summary = { pulled: 0, upserted: 0, skipped_no_staff: 0, skipped_deleted: 0, errors: [] };
  const syncedAt = new Date().toISOString();

  const staffMap = await buildStaffMap(db);

  // watermark = max(last_synced_at), or epoch on first run
  const { data: wm } = await db
    .from("time_entries").select("last_synced_at")
    .not("last_synced_at", "is", null)
    .order("last_synced_at", { ascending: false }).limit(1);
  const watermark = wm && wm.length ? wm[0].last_synced_at : "1970-01-01T00:00:00Z";

  // pull changed rows (include deleted so we can decide what to do with them)
  const { data: rows, error } = await db
    .from("time_entries").select("*")
    .gt("updated_at", watermark)
    .order("updated_at", { ascending: true }).limit(500);
  if (error) throw error;
  summary.pulled = rows.length;

  for (const batch of chunk(rows, 10)) {
    const upsertRecords = [];
    const markSyncedIds = []; // deleted rows we skip but still flag so they don't reprocess

    for (const row of batch) {
      if (row.deleted_at) { summary.skipped_deleted++; markSyncedIds.push(row.id); continue; }
      const personRec = staffMap[row.staff_id];
      if (!personRec) { summary.skipped_no_staff++; continue; } // leave unsynced → retries next run
      upsertRecords.push({ fields: toFields(row, personRec) });
    }

    let resp = null;
    if (upsertRecords.length) {
      try {
        resp = await airtable(encodeURIComponent(TIME_TABLE), {
          method: "PATCH",
          body: JSON.stringify({
            performUpsert: { fieldsToMergeOn: [F.hourglassId] },
            records: upsertRecords, typecast: true, returnFieldsByFieldId: true,
          }),
        });
      } catch (e) {
        summary.errors.push(String(e.message || e));
        continue;
      }
    }

    // write back airtable_record_id + last_synced_at (parallel per batch)
    const writebacks = [];
    for (const rec of resp?.records || []) {
      const sid = rec.fields?.[F.hourglassId];
      if (!sid) continue;
      writebacks.push(db.from("time_entries").update({ airtable_record_id: rec.id, last_synced_at: syncedAt }).eq("id", sid));
      summary.upserted++;
    }
    for (const id of markSyncedIds) {
      writebacks.push(db.from("time_entries").update({ last_synced_at: syncedAt }).eq("id", id));
    }
    const results = await Promise.allSettled(writebacks);
    for (const r of results) if (r.status === "rejected") summary.errors.push(String(r.reason));
  }

  return summary;
}

export default async function handler(req, res) {
  // Auth: Vercel Cron sends "Authorization: Bearer <CRON_SECRET>".
  // Manual browser testing: ?secret=<CRON_SECRET>.
  const authHeader = req.headers["authorization"] || "";
  const secretQuery = (req.query && req.query.secret) || "";
  const ok = CRON_SECRET && (authHeader === `Bearer ${CRON_SECRET}` || secretQuery === CRON_SECRET);
  if (!ok) { res.status(401).json({ error: "Unauthorized" }); return; }

  const missing = [];
  if (!SUPABASE_URL) missing.push("SUPABASE_URL (or VITE_SUPABASE_URL)");
  if (!SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!AIRTABLE_API_KEY) missing.push("AIRTABLE_API_KEY");
  if (!AIRTABLE_BASE_ID) missing.push("AIRTABLE_BASE_ID");
  if (!TIME_TABLE) missing.push("AIRTABLE_TIME_ENTRIES_TABLE");
  if (!STAFF_TABLE) missing.push("AIRTABLE_STAFF_TABLE");
  if (missing.length) { res.status(500).json({ error: "Missing env vars", missing }); return; }

  try {
    const summary = await runSync();
    // Mondays: also run the IB code-pool low-stock check (folded in here because
    // Vercel Hobby caps at 2 dedicated cron jobs). Best-effort.
    if (new Date().getUTCDay() === 1) {
      try { summary.pool_stock = await runPoolStockCheck(); } catch (e) { summary.pool_stock_error = String(e.message || e); }
    }
    res.status(200).json(summary);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
