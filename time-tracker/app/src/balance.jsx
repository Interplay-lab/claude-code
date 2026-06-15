/* Interplay Bucks balance screen + redeem modal (self-service).
   Talks to /api/ib-balance and /api/redeem-ib with the Supabase session token. */
import { useState, useEffect } from "react";
import { Icon } from "./icons.jsx";
import { supabase, isLive } from "./lib/supabase.js";

async function authedFetch(path, opts = {}) {
  let token = "";
  if (supabase) { const { data } = await supabase.auth.getSession(); token = data?.session?.access_token || ""; }
  return fetch(path, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts.headers || {}) } });
}

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

export function Balance({ app }) {
  const wide = app.device === "desktop";
  const [st, setSt] = useState({ loading: true });
  const [modal, setModal] = useState(false);

  const load = async () => {
    if (!isLive) { setSt({ loading: false, demo: true, found: true, balance: 0, history: [] }); return; }
    setSt((s) => ({ ...s, loading: true }));
    try {
      const r = await authedFetch("/api/ib-balance");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed to load balance");
      setSt({ loading: false, ...j });
    } catch (e) { setSt({ loading: false, error: String(e.message || e) }); }
  };
  useEffect(() => { load(); }, []);

  if (st.loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--text-3)" }}>Loading…</div>;
  if (st.error) return <div className="card" style={{ padding: 24, color: "var(--warn)", fontWeight: 600 }}>{st.error}</div>;
  if (st.found === false) return (
    <div className="card" style={{ padding: 32, textAlign: "center" }}>
      <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>No staff record found</div>
      <div style={{ color: "var(--text-2)", fontSize: 14 }}>Your account isn’t linked to a staff record yet — contact an admin.</div>
    </div>
  );

  const canRedeem = !st.demo && st.balance > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="card" style={{ padding: wide ? 28 : 22, textAlign: "center" }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Interplay Bucks balance</div>
        <div className="num" style={{ fontSize: 48, fontWeight: 800, letterSpacing: "-0.02em", margin: "8px 0 4px" }}>{money(st.balance)}</div>
        <div style={{ fontSize: 13.5, color: "var(--text-3)", marginBottom: 18 }}>available to redeem at any Interplay workshop</div>
        <button className="btn btn-primary btn-lg" disabled={!canRedeem} onClick={() => setModal(true)}
          style={{ opacity: canRedeem ? 1 : 0.5, cursor: canRedeem ? "pointer" : "default" }}>
          <Icon name="tag" size={18} /> Redeem at workshop
        </button>
        {st.demo && <div style={{ fontSize: 12.5, color: "var(--text-3)", marginTop: 10 }}>(Connect the live app to see your real balance.)</div>}
      </div>

      <div className="card" style={{ padding: "8px 18px 12px" }}>
        <h3 style={{ fontSize: 15, fontWeight: 800, margin: "12px 4px 8px" }}>History</h3>
        {(!st.history || st.history.length === 0) ? (
          <div style={{ padding: "20px 0 24px", textAlign: "center", color: "var(--text-3)", fontSize: 14 }}>No activity yet.</div>
        ) : st.history.map((h, i) => (
          <div key={h.id || i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 4px", borderBottom: i < st.history.length - 1 ? "1px solid var(--border)" : "none" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.label}</div>
              <div className="num" style={{ fontSize: 12.5, color: "var(--text-3)", fontWeight: 600, marginTop: 2 }}>
                {h.date}{h.ttRef ? ` · ${h.ttRef}` : ""}
              </div>
            </div>
            <span className="num" style={{ fontSize: 15, fontWeight: 800, color: h.amount < 0 ? "var(--primary-700)" : "var(--ok)", whiteSpace: "nowrap" }}>
              {h.amount < 0 ? "−" : "+"}{money(Math.abs(h.amount))}
            </span>
          </div>
        ))}
      </div>

      {modal && <RedeemModal app={app} balance={st.balance} onClose={() => setModal(false)} onDone={load} />}
    </div>
  );
}

function RedeemModal({ app, balance, onClose, onDone }) {
  const wide = app.device === "desktop";
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(null);

  const amt = Math.round(Number(amount) * 100) / 100;
  const valid = amt > 0 && amt <= balance && amt <= 1000;

  const submit = async () => {
    setErr(""); setBusy(true);
    try {
      const r = await authedFetch("/api/redeem-ib", { method: "POST", body: JSON.stringify({ amount: amt, workshop_note: note }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Redemption failed");
      setDone(j);
    } catch (e) { setErr(String(e.message || e)); }
    setBusy(false);
  };

  return (
    <div onClick={onClose} style={{
      position: "absolute", inset: 0, zIndex: 250, background: "rgba(43,37,33,0.34)", backdropFilter: "blur(2px)",
      display: "flex", alignItems: wide ? "center" : "flex-end", justifyContent: "center", animation: "fadein .16s ease",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "var(--surface)", width: wide ? 440 : "100%", maxHeight: "92%", overflow: "auto",
        borderRadius: wide ? "var(--r-xl)" : "26px 26px 0 0", boxShadow: "var(--sh-3)",
        padding: wide ? "26px 26px 24px" : "16px 22px 26px", animation: wide ? "fadein .2s ease" : "sheetup .26s cubic-bezier(.2,.8,.2,1)",
      }}>
        {done ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 52, height: 52, borderRadius: 999, margin: "4px auto 14px", background: "var(--ok-soft)", color: "var(--ok)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="check" size={26} stroke={3} />
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 6px" }}>Your code is ready</h3>
            <p style={{ fontSize: 14, color: "var(--text-2)", margin: "0 0 14px" }}>We emailed it to you too. Paste it at checkout for any Interplay workshop.</p>
            <div className="num" style={{ fontSize: 22, fontWeight: 800, padding: "12px", borderRadius: "var(--r-md)", background: "var(--surface-3)", letterSpacing: "0.04em" }}>{done.code}</div>
            <div style={{ fontSize: 13, color: "var(--text-3)", margin: "10px 0 18px" }}>{money(done.amount)} · expires {String(done.expires_at).slice(0, 10)}</div>
            <button className="btn btn-primary btn-lg" style={{ width: "100%" }} onClick={() => { onDone(); onClose(); }}>Done</button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Redeem Interplay Bucks</h3>
              <button className="btn btn-quiet btn-sm" style={{ padding: "0 8px", height: 34 }} onClick={onClose}><Icon name="x" size={18} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="field-label">Amount (max {money(Math.min(balance, 1000))})</label>
                <input className="input num" type="number" min="0" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div>
                <label className="field-label">Which workshop? (optional)</label>
                <input className="input" placeholder="e.g. June improv intensive" value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
              {err && <div style={{ fontSize: 13.5, color: "var(--warn)", fontWeight: 600 }}>{err}</div>}
              <button className="btn btn-primary btn-lg" disabled={!valid || busy} onClick={submit}
                style={{ opacity: valid && !busy ? 1 : 0.5, cursor: valid && !busy ? "pointer" : "default" }}>
                {busy ? "Generating…" : `Generate code for ${money(amt > 0 ? amt : 0)}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
