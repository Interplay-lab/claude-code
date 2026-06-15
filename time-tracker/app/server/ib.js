// Shared server helpers for the Interplay Bucks routes (cashout / balance / redeem).
// Server-only: uses the Airtable key + Supabase service-less auth verification.
import { createClient } from "@supabase/supabase-js";

// Interplay Bucks Ledger field IDs
export const L = {
  entryLabel: "fldxaO8AA9qkC6z0o",
  person:     "fld99MAcLli9Rk79p",
  date:       "fldRI8tTf2wGZwrUI",
  amount:     "flduAw6fXmxJwQpuH",
  type:       "fldnV8nyF2isxydWu",
  sourcePP:   "fldQlRn8FX7zz997C",
  ttRef:      "fldal47AlRgVJicO2",
  notes:      "fldH9EzHorP0ZxsSC",
};
// Staff field IDs
export const S = { name: "fldo91ldI8ziKmb2l", email: "fldl6XZZ4GCPNOJSm" };

const BASE = process.env.AIRTABLE_BASE_ID;
const KEY = process.env.AIRTABLE_API_KEY;
const STAFF_TABLE = process.env.AIRTABLE_STAFF_TABLE;
const LEDGER_TABLE = process.env.AIRTABLE_IB_LEDGER_TABLE;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

export async function airtable(method, path, body) {
  const res = await fetch(`https://api.airtable.com/v0/${BASE}/${path}`, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Airtable ${res.status}: ${await res.text()}`);
  return res.json();
}

// Verify the Supabase access token from the Authorization header → user (or null).
export async function getSessionUser(req) {
  const auth = req.headers["authorization"] || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || !SUPABASE_URL || !SUPABASE_ANON) return null;
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false } });
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

export async function findStaffByEmail(email) {
  const p = new URLSearchParams({
    filterByFormula: `LOWER({Email})="${String(email).toLowerCase()}"`,
    pageSize: "1", returnFieldsByFieldId: "true",
  });
  [S.name, S.email].forEach((f) => p.append("fields[]", f));
  const r = await airtable("GET", `${encodeURIComponent(STAFF_TABLE)}?${p}`);
  return r.records?.[0] || null;
}

// All ledger rows for a staff member (filtered client-side: Airtable can't
// filter a linked-record field by record ID).
export async function fetchLedgerForStaff(staffId) {
  const rows = [];
  let offset;
  do {
    const p = new URLSearchParams({ pageSize: "100", returnFieldsByFieldId: "true" });
    [L.entryLabel, L.person, L.date, L.amount, L.type, L.ttRef].forEach((f) => p.append("fields[]", f));
    if (offset) p.set("offset", offset);
    const page = await airtable("GET", `${encodeURIComponent(LEDGER_TABLE)}?${p}`);
    rows.push(...(page.records || []));
    offset = page.offset;
  } while (offset);
  return rows.filter((r) => (r.fields?.[L.person] || []).includes(staffId));
}

// Balance = sum of signed Amount(IB): Earned (+), Redeemed (−), Adjustment (signed).
export function computeBalance(rows) {
  let bal = 0;
  for (const r of rows) bal += Number(r.fields?.[L.amount] || 0);
  return Math.round(bal * 100) / 100;
}

export function initialsOf(name) {
  return (name || "").trim().split(/\s+/).filter(Boolean).map((w) => w[0]).join("").toUpperCase();
}
