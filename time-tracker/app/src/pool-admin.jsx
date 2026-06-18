/* Admin-only: Interplay Bucks code-pool management (dashboard + CSV import). */
import { useState, useEffect } from "react";
import { Icon } from "./icons.jsx";
import { supabase } from "./lib/supabase.js";
import { IB_DENOMINATIONS_CENTS, IB_DENOM_LABELS } from "./lib/ib-denominations.js";

async function authedFetch(path, opts = {}) {
  let token = "";
  if (supabase) { const { data } = await supabase.auth.getSession(); token = data?.session?.access_token || ""; }
  return fetch(path, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts.headers || {}) } });
}

const dollars = (cents) => `$${(cents / 100).toLocaleString("en-US")}`;

// parse CSV "code,denomination_cents,expires_at" → [{code, denomination_cents, expires_at?}]
function parseCsv(text) {
  const codes = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || /^code\s*,/i.test(line)) continue;
    const [code, denom, exp] = line.split(",").map((s) => (s || "").trim());
    if (!code) continue;
    const rec = { code, denomination_cents: Number(denom) };
    if (exp) rec.expires_at = exp;
    codes.push(rec);
  }
  return codes;
}

export function PoolAdmin({ app }) {
  const [st, setSt] = useState({ loading: true });
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");

  const load = async () => {
    setSt((s) => ({ ...s, loading: true }));
    try {
      const r = await authedFetch("/api/admin/ib-pool/status");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed to load");
      setSt({ loading: false, ...j });
    } catch (e) { setSt({ loading: false, error: String(e.message || e) }); }
  };
  useEffect(() => { load(); }, []);

  const doImport = async () => {
    setErr(""); setResult(null); setBusy(true);
    try {
      const codes = parseCsv(csv);
      if (!codes.length) throw new Error("No rows found. Use: code,denomination_cents,expires_at");
      const r = await authedFetch("/api/admin/ib-pool/import", { method: "POST", body: JSON.stringify({ codes }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Import failed");
      setResult(j); setCsv(""); load();
    } catch (e) { setErr(String(e.message || e)); }
    setBusy(false);
  };

  if (st.loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--text-3)" }}>Loading…</div>;
  if (st.error) return <div className="card" style={{ padding: 24, color: "var(--warn)", fontWeight: 600 }}>{st.error}</div>;

  const denoms = st.denoms || IB_DENOMINATIONS_CENTS;
  const th = { fontSize: 11.5, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em", textAlign: "right", padding: "8px 10px" };
  const td = { fontSize: 14, fontWeight: 700, textAlign: "right", padding: "9px 10px" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* dashboard */}
      <div className="card" style={{ padding: "8px 8px 12px", overflowX: "auto" }}>
        <h3 style={{ fontSize: 15, fontWeight: 800, margin: "12px 10px 8px" }}>Code pool</h3>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 420 }}>
          <thead><tr style={{ borderBottom: "1px solid var(--border)" }}>
            <th style={{ ...th, textAlign: "left" }}>Denomination</th>
            <th style={th}>Available</th><th style={th}>Assigned</th><th style={th}>Used</th><th style={th}>Total</th>
          </tr></thead>
          <tbody>
            {denoms.map((d) => {
              const c = st.counts?.[d] || { available: 0, assigned: 0, used: 0, total: 0 };
              const low = c.available < 5;
              return (
                <tr key={d} style={{ borderBottom: "1px solid var(--border)", background: low ? "var(--warn-soft)" : "transparent" }}>
                  <td style={{ ...td, textAlign: "left" }}>
                    {dollars(d)} {IB_DENOM_LABELS[d] && <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600 }}>· {IB_DENOM_LABELS[d]}</span>}
                  </td>
                  <td className="num" style={{ ...td, color: low ? "var(--warn)" : "var(--ok)" }}>{c.available}{low ? " ⚠️" : ""}</td>
                  <td className="num" style={{ ...td, color: "var(--text-2)" }}>{c.assigned}</td>
                  <td className="num" style={{ ...td, color: "var(--text-2)" }}>{c.used}</td>
                  <td className="num" style={td}>{c.total}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* import */}
      <div className="card" style={{ padding: 18 }}>
        <h3 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 6px" }}>Import codes</h3>
        <p style={{ fontSize: 13, color: "var(--text-2)", margin: "0 0 10px" }}>
          Paste CSV: <code>code,denomination_cents,expires_at</code> (one per line). Duplicates are skipped.
        </p>
        <textarea className="input" value={csv} onChange={(e) => setCsv(e.target.value)} rows={8}
          placeholder={"code,denomination_cents,expires_at\nIB-Q3-001,2500,2027-06-18\nIB-Q3-002,5000,2027-06-18"}
          style={{ fontFamily: "ui-monospace, monospace", fontSize: 13, resize: "vertical" }} />
        {err && <div style={{ fontSize: 13.5, color: "var(--warn)", fontWeight: 600, marginTop: 10 }}>{err}</div>}
        {result && (
          <div style={{ fontSize: 13.5, color: "var(--ok)", fontWeight: 600, marginTop: 10 }}>
            Imported {result.inserted} code{result.inserted === 1 ? "" : "s"}
            {result.skipped_duplicates ? ` (${result.skipped_duplicates} duplicate${result.skipped_duplicates === 1 ? "" : "s"} skipped)` : ""}
            {result.invalid_lines?.length ? ` · ${result.invalid_lines.length} invalid ignored` : ""}.
          </div>
        )}
        <button className="btn btn-primary btn-md" disabled={busy || !csv.trim()} onClick={doImport}
          style={{ marginTop: 12, opacity: busy || !csv.trim() ? 0.5 : 1 }}>
          <Icon name="plus" size={18} /> {busy ? "Importing…" : "Import"}
        </button>
      </div>

      {/* recent activity */}
      <div className="card" style={{ padding: "8px 18px 12px" }}>
        <h3 style={{ fontSize: 15, fontWeight: 800, margin: "12px 4px 8px" }}>Recent redemptions</h3>
        {(!st.recent_assignments || st.recent_assignments.length === 0) ? (
          <div style={{ padding: "16px 0", textAlign: "center", color: "var(--text-3)", fontSize: 14 }}>No redemptions yet.</div>
        ) : st.recent_assignments.map((a, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 4px", borderBottom: i < st.recent_assignments.length - 1 ? "1px solid var(--border)" : "none" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.staff_name || "—"}</div>
              <div className="num" style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>{a.code} · {a.assigned_at ? new Date(a.assigned_at).toLocaleDateString() : ""}</div>
            </div>
            <span className="num" style={{ fontSize: 14, fontWeight: 800 }}>{dollars(a.denomination_cents)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
