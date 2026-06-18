/* Interplay Bucks balance screen + denomination redeem picker (code pool).
   Talks to /api/ib-balance and /api/redeem-ib with the Supabase session token. */
import { useState, useEffect } from "react";
import { Icon } from "./icons.jsx";
import { supabase, isLive } from "./lib/supabase.js";

async function authedFetch(path, opts = {}) {
  let token = "";
  if (supabase) { const { data } = await supabase.auth.getSession(); token = data?.session?.access_token || ""; }
  return fetch(path, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts.headers || {}) } });
}

const DENOMS = [500, 1000, 2500, 5000, 10000];
const money = (n) => `$${Number(n || 0).toFixed(2)}`;
const dollars = (cents) => `$${cents / 100}`;

export function Balance({ app }) {
  const wide = app.device === "desktop";
  const [st, setSt] = useState({ loading: true });
  const [modal, setModal] = useState(false);

  const load = async () => {
    if (!isLive) { setSt({ loading: false, demo: true, found: true, balance: 0, stock: {}, history: [] }); return; }
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

      {modal && <RedeemModal app={app} balance={st.balance} stock={st.stock || {}} denoms={st.denoms || DENOMS} onClose={() => setModal(false)} onDone={load} />}
    </div>
  );
}

function RedeemModal({ app, balance, stock, denoms, onClose, onDone }) {
  const wide = app.device === "desktop";
  const [busy, setBusy] = useState(0);   // the denomination currently submitting
  const [err, setErr] = useState("");
  const [done, setDone] = useState(null);

  const redeem = async (denom) => {
    setErr(""); setBusy(denom);
    try {
      const r = await authedFetch("/api/redeem-ib", { method: "POST", body: JSON.stringify({ denomination_cents: denom }) });
      const j = await r.json();
      if (!r.ok) { setErr(j.error || "Redemption failed"); }
      else setDone(j);
    } catch (e) { setErr(String(e.message || e)); }
    setBusy(0);
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
            <p style={{ fontSize: 14, color: "var(--text-2)", margin: "0 0 14px" }}>We emailed it to you too. Paste it at any Interplay event checkout — single-use.</p>
            <div className="num" style={{ fontSize: 22, fontWeight: 800, padding: "12px", borderRadius: "var(--r-md)", background: "var(--surface-3)", letterSpacing: "0.04em" }}>{done.code}</div>
            <div style={{ fontSize: 13, color: "var(--text-3)", margin: "10px 0 18px" }}>{money(done.amount)}{done.expires_at ? ` · expires ${String(done.expires_at).slice(0, 10)}` : ""}</div>
            <button className="btn btn-primary btn-lg" style={{ width: "100%" }} onClick={() => { onDone(); onClose(); }}>Done</button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <h3 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Redeem Interplay Bucks</h3>
              <button className="btn btn-quiet btn-sm" style={{ padding: "0 8px", height: 34 }} onClick={onClose}><Icon name="x" size={18} /></button>
            </div>
            <p style={{ fontSize: 13.5, color: "var(--text-2)", margin: "0 0 14px" }}>Choose a code value. Balance: <strong>{money(balance)}</strong>.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {denoms.map((d) => {
                const avail = Number(stock?.[d] || 0);
                const affordable = balance >= d / 100;
                const disabled = avail === 0 || !affordable || busy;
                return (
                  <button key={d} className="card" disabled={disabled} onClick={() => redeem(d)}
                    style={{
                      padding: "16px 12px", textAlign: "center", cursor: disabled ? "default" : "pointer",
                      opacity: disabled ? 0.45 : 1, border: "1.5px solid var(--border-2)", background: "var(--surface-2)",
                    }}>
                    <div className="num" style={{ fontSize: 22, fontWeight: 800 }}>{dollars(d)}</div>
                    <div style={{ fontSize: 12, color: avail === 0 ? "var(--warn)" : "var(--text-3)", fontWeight: 600, marginTop: 2 }}>
                      {busy === d ? "issuing…" : avail === 0 ? "out of stock" : !affordable ? "over balance" : `${avail} available`}
                    </div>
                  </button>
                );
              })}
            </div>
            {err && <div style={{ fontSize: 13.5, color: "var(--warn)", fontWeight: 600, marginTop: 14 }}>{err}</div>}
          </>
        )}
      </div>
    </div>
  );
}
