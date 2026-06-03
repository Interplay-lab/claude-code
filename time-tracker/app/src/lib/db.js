/* Data-access layer — the API the UI calls in live (Supabase) mode.
   Maps DB rows ⇄ the shape the existing screens already use:
   { id, date:"YYYY-MM-DD", start:"HH:MM", end:"HH:MM"|null, description,
     tags:[], status, dur:minutes, locked }.

   Reads/writes are scoped by Row Level Security (see migrations/0001_init.sql),
   so each person only ever touches their own entries. */
import { supabase } from "./supabase.js";

const pad = (n) => String(n).padStart(2, "0");
const localDate = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const localHM = (iso) => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

function statusOf(row) {
  if (!row.stop_at) return "running";
  if (row.locked) return "locked";
  const min = Math.round((row.duration_seconds ?? 0) / 60);
  return min >= 480 ? "needs-review" : "synced";
}

/* DB row → UI entry */
export function toUi(row) {
  return {
    id: row.id,
    date: localDate(row.start_at),
    start: localHM(row.start_at),
    end: row.stop_at ? localHM(row.stop_at) : null,
    description: row.description || "",
    tags: row.tags || [],
    status: statusOf(row),
    dur: Math.round((row.duration_seconds ?? 0) / 60),
    locked: row.locked,
    startTs: new Date(row.start_at).getTime(),
  };
}

/* combine a local YYYY-MM-DD + HH:MM into an ISO timestamp (local tz → UTC) */
function toISO(date, hm) {
  const [h, m] = hm.split(":").map(Number);
  const d = new Date(`${date}T00:00:00`);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

/* ── allow-list gate: resolve the signed-in email to a staff row ─── */
export async function getStaffByEmail(email) {
  const { data, error } = await supabase
    .from("staff").select("*").ilike("email", email).maybeSingle();
  if (error) throw error;
  return data; // null → not on the allow-list
}

/* ── entries ─────────────────────────────────────────────────────── */
export async function listMyEntries(staffId) {
  const { data, error } = await supabase
    .from("time_entries").select("*")
    .eq("staff_id", staffId)
    .order("start_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(toUi);
}

export async function getRunning(staffId) {
  const { data } = await supabase
    .from("time_entries").select("*")
    .eq("staff_id", staffId).is("stop_at", null).maybeSingle();
  return data ? toUi(data) : null;
}

export async function startTimer(staffId, { description, tags }) {
  const { data, error } = await supabase
    .from("time_entries")
    .insert({ staff_id: staffId, description, tags, start_at: new Date().toISOString() })
    .select().single();
  if (error) throw error;
  return toUi(data);
}

export async function stopTimer(id) {
  const { data, error } = await supabase
    .from("time_entries").update({ stop_at: new Date().toISOString() })
    .eq("id", id).select().single();
  if (error) throw error;
  return toUi(data);
}

export async function addManual(staffId, { date, start, end, durMin, description, tags }) {
  const start_at = toISO(date, start);
  const stop_at = end
    ? toISO(date, end)
    : new Date(new Date(start_at).getTime() + durMin * 60000).toISOString();
  const { data, error } = await supabase
    .from("time_entries")
    .insert({ staff_id: staffId, description, tags, start_at, stop_at })
    .select().single();
  if (error) throw error;
  return toUi(data);
}

export async function updateEntry(id, { date, start, end, durMin, description, tags }) {
  const start_at = toISO(date, start);
  const stop_at = end
    ? toISO(date, end)
    : new Date(new Date(start_at).getTime() + durMin * 60000).toISOString();
  const { data, error } = await supabase
    .from("time_entries").update({ start_at, stop_at, description, tags })
    .eq("id", id).select().single();
  if (error) throw error;
  return toUi(data);
}

/* soft delete — the nightly sync removes the matching Airtable row, then purges */
export async function deleteEntry(id) {
  const { error } = await supabase
    .from("time_entries").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}
