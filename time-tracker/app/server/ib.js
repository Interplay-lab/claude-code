// Shared server helpers for the Interplay Bucks routes (cashout / balance / redeem).
// Server-only: uses the Airtable key + Supabase service-less auth verification.
import { createClient } from "@supabase/supabase-js";
import { IB_DENOMINATIONS_CENTS } from "../src/lib/ib-denominations.js";

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
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM;

// Allowed redemption denominations (cents) — shared with the client picker.
export const DENOMS = IB_DENOMINATIONS_CENTS;

// Feature flag + admin email allowlist (per IB_POOL_REDEMPTION_SPEC.md).
export const POOL_ENABLED = process.env.IB_POOL_REDEMPTION_ENABLED === "true";
const POOL_ADMIN_EMAILS = (process.env.IB_POOL_ADMIN_EMAILS || "connect@letsinterplay.com")
  .toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
export function isPoolAdmin(email) {
  return !!email && POOL_ADMIN_EMAILS.includes(String(email).toLowerCase());
}

// Service-role Supabase client (server-only; bypasses RLS for the pool table).
export function supabaseAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

// The Supabase staff row for an email (id + role) — distinct from the Airtable Staff record.
export async function getSupabaseStaff(email) {
  const { data } = await supabaseAdmin().from("staff").select("id, role, full_name, email").ilike("email", email).maybeSingle();
  return data || null;
}

export async function sendResend(to, subject, html) {
  if (!RESEND_API_KEY || !RESEND_FROM || !to || (Array.isArray(to) && !to.length)) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: RESEND_FROM, to: Array.isArray(to) ? to : [to], subject, html }),
  });
}

// Low-stock check: emails admins if any denomination has < 10 codes available.
export async function runPoolStockCheck() {
  const admin = supabaseAdmin();
  const { data: rows } = await admin.rpc("ib_pool_stock");
  const stock = {};
  for (const d of DENOMS) stock[d] = 0;
  for (const r of rows || []) stock[r.denomination_cents] = Number(r.available);
  const low = DENOMS.filter((d) => stock[d] < 5).map((d) => ({ denomination_cents: d, available: stock[d] }));
  if (low.length) {
    const { data: admins } = await admin.from("staff").select("email").eq("role", "admin").eq("active", true);
    const to = (admins || []).map((a) => a.email).filter(Boolean);
    const all = DENOMS.map((d) => `$${d / 100}: ${stock[d]} available`).join("<br/>");
    await sendResend(to, "Interplay Bucks code pool is running low",
      `<div style="font-family:sans-serif;line-height:1.5"><h2>IB code pool — low stock</h2>
       <p>${low.map((l) => `<strong>$${l.denomination_cents / 100}</strong> has only ${l.available} left`).join("<br/>")}</p>
       <p>Current stock:<br/>${all}</p>
       <p>Refill: create new single-use codes in Ticket Tailor, then import them in Hourglass → <strong>Pool</strong>.</p></div>`);
  }
  return { stock, low };
}

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
