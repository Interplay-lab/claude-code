/* Admin-only: Interplay Bucks code-pool management (counts + CSV import). */
import { useState, useEffect } from "react";
import { Icon } from "./icons.jsx";
import { supabase } from "./lib/supabase.js";

async function authedFetch(path, opts = {}) {
  let token = "";
  if (supabase) { const { data } = await supabase.auth.getSession(); token = data?.session?.access_token || ""; }
  return fetch(path, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts.headers || {}) } });
}

const dollars = (cents) => `$${cents / 100}`;

export function PoolAdmin({ app }) {
  const [st, setSt] = useState({ loading: true });
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");

  const load = async () => {
    setSt((s) => ({ ...s, loading: true }));
    try {
      const r = await authedFetch("/api/admin/ib-pool");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed to load");
      setSt({ loading: false, ...j });
    } catch (e) { setSt({ loading: false, error: String(e.message || e) }); }
  };
  useEffect(() => { load(); }, []);

  const doImport = async () => {
    setErr(""); setResult(null); setBusy(true);
    try {
      const r = await authedFetch("/api/admin/ib-pool/import", { method: "POST", body: JSON.stringify({ csv }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Import failed");
      setResult(j); setCsv(""); load();
    } catch (e) { setErr(String(e.message || e)); }
    setBusy(false);
  };

  if (st.loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--text-3)" }}>Loading…</div>;
  if (st.error) return <div className="card" style={{ padding: 24, color: "var(--warn)", fontWeight: 600 }}>{st.error}</div>;

  const denoms = st.denoms || [500, 1000, 2500, 5000, 10000];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* stock per denomination */}
      <div className="card" style={{ padding: "8px 8px 12px" }}>
        <h3 style={{ fontSize: 15, fontWeight: 800, margin: "12px 12px 10px" }}>Code stock</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, padding: "0 8px" }}>
          {denoms.map((d) => {
            const c = st.counts?.[d] || { available: 0, assigned: 0, used: 0 };
            const low = c.available < 10;
            return (
              <div key={d} style={{ padding: "14px 12px", borderRadius: "var(--r-md)", background: "var(--surface-2)", border: "1.5px solid var(--border-2)" }}>
                <div className="num" style={{ fontSize: 18, fontWeight: 800 }}>{dollars(d)}</div>
                <div className="num" style={{ fontSize: 22, fontWeight: 800, color: low ? "var(--warn)" : "var(--ok)" }}>{c.available}</div>
                <div style={{ fontSize: 11.5, color: "var(--text-3)", fontWeight: 600 }}>available{low ? " · low!" : ""}</div>
                <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 4 }}>{c.assigned} assigned · {c.used} used</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* import */}
      <div className="card" style={{ padding: 18 }}>
        <h3 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 6px" }}>Import codes</h3>
        <p style={{ fontSize: 13, color: "var(--text-2)", margin: "0 0 10px" }}>
          Paste one per line: <code>code,denomination_cents</code> (optional 3rd column <code>expires_at</code> as YYYY-MM-DD). Duplicates are skipped.
        </p>
        <textarea className="input" value={csv} onChange={(e) => setCsv(e.target.value)} rows={8}
          placeholder={"IB-Q3-001,500\nIB-Q3-002,1000\nIB-Q3-003,2500,2026-12-31"}
          style={{ fontFamily: "ui-monospace, monospace", fontSize: 13, resize: "vertical" }} />
        {err && <div style={{ fontSize: 13.5, color: "var(--warn)", fontWeight: 600, marginTop: 10 }}>{err}</div>}
        {result && (
          <div style={{ fontSize: 13.5, color: "var(--ok)", fontWeight: 600, marginTop: 10 }}>
            Imported {result.imported} code{result.imported === 1 ? "" : "s"}
            {result.skipped_duplicates ? ` · ${result.skipped_duplicates} duplicate(s) skipped` : ""}
            {result.invalid_lines?.length ? ` · ${result.invalid_lines.length} invalid line(s) ignored` : ""}.
          </div>
        )}
        <button className="btn btn-primary btn-md" disabled={busy || !csv.trim()} onClick={doImport}
          style={{ marginTop: 12, opacity: busy || !csv.trim() ? 0.5 : 1 }}>
          <Icon name="plus" size={18} /> {busy ? "Importing…" : "Import codes"}
        </button>
      </div>

      {/* recent imports */}
      <div className="card" style={{ padding: "8px 18px 12px" }}>
        <h3 style={{ fontSize: 15, fontWeight: 800, margin: "12px 4px 8px" }}>Recent imports</h3>
        {(!st.recent_imports || st.recent_imports.length === 0) ? (
          <div style={{ padding: "16px 0", textAlign: "center", color: "var(--text-3)", fontSize: 14 }}>No imports yet.</div>
        ) : st.recent_imports.map((r, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 4px", borderBottom: i < st.recent_imports.length - 1 ? "1px solid var(--border)" : "none" }}>
            <span className="num" style={{ fontSize: 13, color: "var(--text-2)", fontWeight: 600 }}>{new Date(r.imported_at).toLocaleString()}</span>
            <span className="num" style={{ fontSize: 13, fontWeight: 800 }}>{r.count} codes</span>
          </div>
        ))}
      </div>
    </div>
  );
}
