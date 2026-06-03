// ╔══════════════════════════════════════════════════════════════════╗
// ║ daily-airtable-sync — the app-native nightly push (see DESIGN.md §7)║
// ║                                                                    ║
// ║ App DB is the source of truth. Once a day this:                    ║
// ║  0. auto-stops forgotten timers at 8h                              ║
// ║  1. upserts changed entries into Airtable on Source Entry ID       ║
// ║  2. propagates soft-deletes to Airtable                            ║
// ║  3. mirrors Airtable's Locked flag back so the app freezes entries ║
// ║                                                                    ║
// ║ Deterministic + idempotent; safe to re-run. Reproduces the field   ║
// ║ contract of the retired Make scenario (4985926).                   ║
// ╚══════════════════════════════════════════════════════════════════╝
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Airtable Time Entries field IDs (from DESIGN.md §3).
const F = {
  sourceEntryId: "fldgzJQLRBpErTfbw", // merge key (was "Toggl Entry ID")
  person:        "fldzRyHOyY3ocVKuB", // link → Staff
  description:   "fldaiBgFLfLbRxBtR",
  tags:          "fldBT8i9CsChbKApw",
  start:         "fldhdPbYSruwgNx1v",
  stop:          "fldUA164kU5I4Vcoq",
  durationHours: "fldD1GcgopcDoTkKN",
  billable:      "fldGSlx6MFSxkEigo",
  lastSynced:    "fldH4TX6zOoRQ2X8w",
  ibRate:        "fldyjLbnUS64ncWZu",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const AT_PAT       = Deno.env.get("AIRTABLE_PAT")!;
const AT_BASE      = Deno.env.get("AIRTABLE_BASE_ID")!;
const AT_TABLE     = Deno.env.get("AIRTABLE_TABLE") ?? "Time Entries";
const LOCKED_FIELD = Deno.env.get("AIRTABLE_LOCKED_FIELD") ?? "Locked";

const atUrl = `https://api.airtable.com/v0/${AT_BASE}/${encodeURIComponent(AT_TABLE)}`;
const atHeaders = { Authorization: `Bearer ${AT_PAT}`, "Content-Type": "application/json" };
const chunk = <T>(a: T[], n: number): T[][] => {
  const out: T[][] = []; for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n)); return out;
};

Deno.serve(async () => {
  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  const log: Record<string, unknown> = {};

  // 0 ── auto-stop forgotten timers at 8h ────────────────────────────
  const cutoff = new Date(Date.now() - 8 * 3600 * 1000).toISOString();
  const { data: stale } = await db
    .from("time_entries")
    .select("id,start_at")
    .is("stop_at", null).is("deleted_at", null)
    .lt("start_at", cutoff);
  for (const e of stale ?? []) {
    const stop = new Date(new Date(e.start_at).getTime() + 8 * 3600 * 1000).toISOString();
    await db.from("time_entries").update({ stop_at: stop, auto_stopped: true }).eq("id", e.id);
  }
  log.auto_stopped = (stale ?? []).length;

  // 1 ── push changed entries → Airtable (upsert on Source Entry ID) ──
  const { data: changed, error: changedErr } = await db
    .from("time_entries")
    .select("id,description,tags,billable,start_at,stop_at,last_synced_at,updated_at,staff:staff_id(airtable_staff_id,interplay_bucks_rate)")
    .is("deleted_at", null)
    .eq("locked", false)
    .not("stop_at", "is", null);
  if (changedErr) return json({ error: changedErr.message }, 500);

  const toPush = (changed ?? []).filter(
    (e: any) => !e.last_synced_at || new Date(e.updated_at) > new Date(e.last_synced_at),
  );

  let pushed = 0;
  for (const batch of chunk(toPush, 10)) {
    const records = batch.map((e: any) => {
      const durHours = (new Date(e.stop_at).getTime() - new Date(e.start_at).getTime()) / 3600000;
      const fields: Record<string, unknown> = {
        [F.sourceEntryId]: e.id,
        [F.description]:   e.description ?? "",
        [F.tags]:          (e.tags ?? []).join(", "),
        [F.start]:         e.start_at,
        [F.stop]:          e.stop_at,
        [F.durationHours]: Math.round(durHours * 100) / 100,
        [F.billable]:      e.billable,
        [F.lastSynced]:    new Date().toISOString(),
      };
      if (e.staff?.airtable_staff_id) fields[F.person] = [e.staff.airtable_staff_id];
      if (e.staff?.interplay_bucks_rate != null) fields[F.ibRate] = e.staff.interplay_bucks_rate;
      return { fields };
    });

    const res = await fetch(atUrl, {
      method: "PATCH",
      headers: atHeaders,
      body: JSON.stringify({
        performUpsert: { fieldsToMergeOn: [F.sourceEntryId] },
        records, typecast: true, returnFieldsByFieldId: true,
      }),
    });
    if (!res.ok) return json({ step: "upsert", status: res.status, body: await res.text() }, 502);

    const out = await res.json();
    const now = new Date().toISOString();
    for (const rec of out.records ?? []) {
      const srcId = rec.fields?.[F.sourceEntryId];
      if (srcId) await db.from("time_entries")
        .update({ airtable_record_id: rec.id, last_synced_at: now }).eq("id", srcId);
    }
    pushed += records.length;
  }
  log.pushed = pushed;

  // 2 ── propagate soft-deletes → delete in Airtable, then purge ──────
  const { data: deleted } = await db
    .from("time_entries").select("id,airtable_record_id")
    .not("deleted_at", "is", null);
  let removed = 0;
  for (const batch of chunk((deleted ?? []).filter((e: any) => e.airtable_record_id), 10)) {
    const qs = batch.map((e: any) => `records[]=${e.airtable_record_id}`).join("&");
    const res = await fetch(`${atUrl}?${qs}`, { method: "DELETE", headers: atHeaders });
    if (res.ok) removed += batch.length;
  }
  // purge all soft-deleted rows (those without an Airtable row never reached it)
  await db.from("time_entries").delete().not("deleted_at", "is", null);
  log.deleted = removed;

  // 3 ── mirror Airtable Locked → app (freeze paid/approved entries) ──
  let locked = 0, offset: string | undefined;
  do {
    const params = new URLSearchParams({
      filterByFormula: `{${LOCKED_FIELD}}`,
      "fields[]": F.sourceEntryId,
      returnFieldsByFieldId: "true",
      pageSize: "100",
    });
    if (offset) params.set("offset", offset);
    const res = await fetch(`${atUrl}?${params}`, { headers: atHeaders });
    if (!res.ok) break;
    const page = await res.json();
    const ids = (page.records ?? []).map((r: any) => r.fields?.[F.sourceEntryId]).filter(Boolean);
    if (ids.length) {
      await db.from("time_entries").update({ locked: true }).in("id", ids);
      locked += ids.length;
    }
    offset = page.offset;
  } while (offset);
  log.locked_mirrored = locked;

  return json({ ok: true, ...log });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
