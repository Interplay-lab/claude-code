/* Shared UI components */
import { useState, useEffect } from "react";
import { Icon } from "./icons.jsx";
import { HG } from "./data.js";

/* live ticking elapsed seconds since a start timestamp */
export function useTicker(running, startTs) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!running) return;
    setNow(Date.now()); // snap to the current time the instant tracking starts
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);
  return running ? Math.max(0, Math.floor((now - startTs) / 1000)) : 0;
}

export function fmtClock(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return { h: pad(h), m: pad(m), s: pad(s) };
}

/* responsive: true at desktop widths */
export function useIsDesktop(breakpoint = 900) {
  const [wide, setWide] = useState(
    () => typeof window !== "undefined" && window.innerWidth >= breakpoint
  );
  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= breakpoint);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return wide;
}

/* ── status chip ─────────────────────────────────────────── */
export function StatusChip({ status, animated = true }) {
  if (status === "running") {
    return (
      <span className="chip chip-running">
        <span className={"chip-dot" + (animated ? " breathe" : "")} />
        Running
      </span>
    );
  }
  if (status === "needs-review") {
    return <span className="chip chip-review"><Icon name="alert" size={13} stroke={2.2} />Needs review</span>;
  }
  if (status === "locked") {
    return <span className="chip chip-locked"><Icon name="lock" size={12} stroke={2.2} />Locked</span>;
  }
  return <span className="chip chip-synced"><Icon name="check" size={12} stroke={2.6} />Synced</span>;
}

/* ── tags ────────────────────────────────────────────────── */
export function TagList({ tags, max }) {
  const shown = max ? tags.slice(0, max) : tags;
  const extra = max && tags.length > max ? tags.length - max : 0;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {shown.map((t) => <span key={t} className="chip chip-tag">{t}</span>)}
      {extra > 0 && <span className="chip chip-tag">+{extra}</span>}
    </div>
  );
}

/* ── avatar ──────────────────────────────────────────────── */
export function Avatar({ initials, size = 38, dim = false }) {
  // warm palette derived from initials
  const hues = [28, 42, 14, 60, 8, 48];
  const h = hues[(initials.charCodeAt(0) + initials.charCodeAt(1)) % hues.length];
  return (
    <div className="num" style={{
      width: size, height: size, borderRadius: 999, flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.36, fontWeight: 700, letterSpacing: 0,
      color: `oklch(0.42 0.09 ${h})`,
      background: `oklch(0.92 0.045 ${h})`,
      opacity: dim ? 0.55 : 1,
    }}>{initials}</div>
  );
}

/* ── entry row ───────────────────────────────────────────── */
export function EntryRow({ e, onEdit, onDelete, compact = false }) {
  const locked = e.status === "locked";
  const [hover, setHover] = useState(false);
  const canEdit = !locked && onEdit;
  const timeStr = e.status === "running" ? HG.fmt12(e.start) + " – now" : HG.fmtRange(e.start, e.end);
  const durStr = e.status === "running" ? "running" : HG.hmShort(e.dur);

  const actions = hover && canEdit ? (
    <div style={{ display: "flex", gap: 4 }}>
      <button className="btn btn-quiet btn-sm" style={{ padding: "0 9px", height: 32 }} onClick={() => onEdit(e)} aria-label="Edit"><Icon name="pencil" size={16} /></button>
      <button className="btn btn-quiet btn-sm" style={{ padding: "0 9px", height: 32, color: "var(--primary-600)" }} onClick={() => onDelete(e)} aria-label="Delete"><Icon name="trash" size={16} /></button>
    </div>
  ) : <StatusChip status={e.status} />;

  if (compact) {
    return (
      <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 2px", opacity: locked ? 0.72 : 1 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {e.description || <span style={{ color: "var(--text-3)" }}>No description</span>}
          </div>
          <div className="num" style={{ fontSize: 12.5, color: "var(--text-3)", marginTop: 2, fontWeight: 600, whiteSpace: "nowrap" }}>
            {timeStr} · {durStr}
          </div>
        </div>
        <div style={{ flexShrink: 0 }}>{actions}</div>
      </div>
    );
  }

  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 4px", opacity: locked ? 0.72 : 1 }}>
      <div style={{ minWidth: 150 }}>
        <div className="num" style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap" }}>{timeStr}</div>
        <div className="num" style={{ fontSize: 13, color: "var(--text-3)", marginTop: 1, fontWeight: 600 }}>{durStr}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {e.description || <span style={{ color: "var(--text-3)" }}>No description</span>}
        </div>
        <div style={{ marginTop: 6 }}><TagList tags={e.tags} max={3} /></div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {actions}
        {locked && <Icon name="lock" size={15} style={{ color: "var(--locked)" }} />}
      </div>
    </div>
  );
}

/* ── weekly bar chart ────────────────────────────────────── */
export function WeekBars({ bars, height = 96, accent = "var(--primary)" }) {
  const max = Math.max(480, ...bars.map((b) => b.min));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height }}>
      {bars.map((b) => {
        const h = b.min === 0 ? 3 : Math.max(8, (b.min / max) * (height - 22));
        return (
          <div key={b.iso} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
            <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
              <div style={{
                width: "100%", maxWidth: 30, height: h, borderRadius: 7,
                background: b.today ? accent : (b.min === 0 ? "var(--surface-3)" : "var(--primary-soft)"),
              }} title={HG.hmShort(b.min)} />
            </div>
            <div className="num" style={{ fontSize: 11.5, fontWeight: 700, color: b.today ? "var(--primary-700)" : "var(--text-3)" }}>{b.label}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ── weekly total summary bar ────────────────────────────── */
export function WeekTotal({ minutes, target = 2400, compact = false }) {
  const pct = Math.min(100, (minutes / target) * 100);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? 8 : 10 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)", whiteSpace: "nowrap" }}>This week</span>
        <span className="num" style={{ fontSize: compact ? 17 : 19, fontWeight: 800, color: "var(--text)", whiteSpace: "nowrap" }}>
          {HG.hm(minutes)}
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-3)" }}> / {target / 60}h</span>
        </span>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: "var(--surface-3)", overflow: "hidden" }}>
        <div style={{ width: pct + "%", height: "100%", borderRadius: 999, background: "var(--primary)", transition: "width .5s ease" }} />
      </div>
    </div>
  );
}
