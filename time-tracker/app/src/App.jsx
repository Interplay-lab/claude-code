/* App shell + state + nav.
   Replaces the prototype's device-toggle / tweaks panel with real
   responsive detection (useIsDesktop) and a real sign-in gate. */
import { useState } from "react";
import { HG } from "./data.js";
import { Icon } from "./icons.jsx";
import { Avatar, useTicker, useIsDesktop, fmtClock } from "./components.jsx";
import { SignIn, Today, Entries } from "./screens.jsx";
import { Admin, EntrySheet } from "./admin.jsx";

/* Chosen default timer style. The design ships three (ring · stack · focus);
   "ring" is the default, "focus" is the most one-tap-friendly. */
const TIMER_VARIANT = "ring";

const NAV = [
  { key: "today", label: "Timer", icon: "clock" },
  { key: "entries", label: "Entries", icon: "list" },
  { key: "admin", label: "Admin", icon: "users" },
];
const TITLES = { today: null, entries: "My entries", admin: "Team overview" };

/* ── Running banner (persistent app-wide) ────────────────── */
function RunBanner({ app, wide }) {
  const { h, m, s } = fmtClock(app.elapsed);
  return (
    <div className="run-banner" style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: wide ? "12px 20px" : "11px 16px",
      cursor: "pointer", flexShrink: 0,
    }} onClick={() => app.setScreen("today")}>
      <span className="chip-dot breathe" style={{ background: "#fff", width: 9, height: 9 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {app.description || "Untitled task"}
        </div>
      </div>
      <span className="num" style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.01em" }}>{h}:{m}:{s}</span>
      <button onClick={(e) => { e.stopPropagation(); app.toggleTimer(); }} className="btn btn-sm" style={{
        background: "rgba(255,255,255,0.2)", color: "#fff", height: 34, paddingLeft: 12, paddingRight: 14,
      }}><Icon name="stop" size={15} /> Stop</button>
    </div>
  );
}

/* ── Phone shell ─────────────────────────────────────────── */
function PhoneShell({ app }) {
  const title = TITLES[app.screen];
  return (
    <div className="app" style={{ height: "100%", display: "flex", flexDirection: "column", position: "relative", background: "var(--bg)" }}>
      {/* header */}
      <div style={{ flexShrink: 0, paddingTop: "max(20px, env(safe-area-inset-top))", paddingBottom: 8, background: "var(--bg)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 18px 6px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
              <Icon name="timer" size={18} stroke={2.2} />
            </div>
            <span style={{ fontSize: 14.5, fontWeight: 800, letterSpacing: "-0.01em" }}>Interplay</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="btn btn-ghost btn-sm" style={{ padding: "0 9px", height: 36 }} onClick={app.openAdd}><Icon name="plus" size={18} /></button>
            <Avatar initials="MO" size={34} />
          </div>
        </div>
        {title && <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", margin: "6px 0 0", padding: "0 18px", whiteSpace: "nowrap" }}>{title}</h2>}
      </div>

      {app.running && app.screen !== "today" && <RunBanner app={app} />}

      <main className="scroll-area" style={{ flex: 1, overflow: "auto", padding: "10px 16px 18px" }}>
        {app.screen === "today" && <Today app={app} />}
        {app.screen === "entries" && <Entries app={app} />}
        {app.screen === "admin" && <Admin app={app} />}
      </main>

      {/* bottom nav */}
      <div style={{
        flexShrink: 0, display: "flex", background: "var(--surface)",
        borderTop: "1px solid var(--border)", padding: "8px 12px max(18px, env(safe-area-inset-bottom))",
      }}>
        {NAV.map((n) => {
          const on = app.screen === n.key;
          return (
            <button key={n.key} onClick={() => app.setScreen(n.key)} style={{
              flex: 1, border: "none", background: "transparent", cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              color: on ? "var(--primary)" : "var(--text-3)", padding: "4px 0",
            }}>
              <Icon name={n.icon} size={23} stroke={on ? 2.3 : 2} />
              <span style={{ fontSize: 11, fontWeight: on ? 800 : 600 }}>{n.label}</span>
            </button>
          );
        })}
      </div>

      {app.sheetOpen && <EntrySheet app={app} />}
    </div>
  );
}

/* ── Desktop shell ───────────────────────────────────────── */
function DesktopShell({ app }) {
  return (
    <div className="app" style={{ height: "100%", display: "flex", position: "relative", background: "var(--bg)" }}>
      {/* side nav */}
      <div style={{
        width: 236, flexShrink: 0, background: "var(--surface)", borderRight: "1px solid var(--border)",
        display: "flex", flexDirection: "column", padding: "22px 16px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px 22px" }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
            <Icon name="timer" size={20} stroke={2.2} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.01em", lineHeight: 1.1 }}>Interplay</div>
            <div style={{ fontSize: 11.5, color: "var(--text-3)", fontWeight: 600 }}>Time tracker</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {NAV.map((n) => {
            const on = app.screen === n.key;
            return (
              <button key={n.key} onClick={() => app.setScreen(n.key)} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "11px 12px",
                border: "none", borderRadius: 12, cursor: "pointer", textAlign: "left",
                background: on ? "var(--primary-soft)" : "transparent",
                color: on ? "var(--primary-700)" : "var(--text-2)",
                fontSize: 14.5, fontWeight: on ? 700 : 600, fontFamily: "var(--font)",
              }}>
                <Icon name={n.icon} size={20} stroke={on ? 2.3 : 2} />
                {n.label === "Timer" ? "Today" : n.label}
              </button>
            );
          })}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 8px", borderTop: "1px solid var(--border)" }}>
          <Avatar initials="MO" size={36} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: "nowrap" }}>Maya Okafor</div>
            <div style={{ fontSize: 11.5, color: "var(--text-3)", fontWeight: 600 }}>Designer</div>
          </div>
        </div>
      </div>

      {/* main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 32px", borderBottom: "1px solid var(--border)", background: "var(--surface)", flexShrink: 0,
        }}>
          <h1 style={{ fontSize: 19, fontWeight: 800, letterSpacing: "-0.01em", margin: 0, whiteSpace: "nowrap" }}>
            {app.screen === "admin" ? "Team overview" : app.screen === "entries" ? "My entries" : "Today"}
          </h1>
          <button className="btn btn-primary btn-md" onClick={app.openAdd}><Icon name="plus" size={18} /> Add entry</button>
        </div>
        {app.running && app.screen !== "today" && <RunBanner app={app} wide />}
        <main className="scroll-area" style={{ flex: 1, overflow: "auto" }}>
          <div style={{ maxWidth: app.screen === "admin" ? 1000 : 880, margin: "0 auto", padding: "28px 32px 52px" }}>
            {app.screen === "today" && <Today app={app} />}
            {app.screen === "entries" && <Entries app={app} />}
            {app.screen === "admin" && <Admin app={app} />}
          </div>
        </main>
      </div>

      {app.sheetOpen && <EntrySheet app={app} />}
    </div>
  );
}

/* ── App: state + handlers ───────────────────────────────── */
function useApp(device) {
  const [screen, setScreen] = useState("today");
  const [entries, setEntries] = useState(HG.entries);
  const [running, setRunning] = useState(false);
  const [startTs, setStartTs] = useState(Date.now());
  const [description, setDescription] = useState("Component library cleanup");
  const [tags, setTags] = useState(["Internal", "Design"]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const elapsed = useTicker(running, startTs);

  const nowHM = () => new Date().toTimeString().slice(0, 5);

  const toggleTimer = () => {
    if (running) {
      // stop → save entry
      const startHM = new Date(startTs).toTimeString().slice(0, 5);
      const dur = Math.max(1, Math.round(elapsed / 60));
      const ne = {
        id: Date.now(), date: "2026-06-03", start: startHM, end: nowHM(),
        description: description || "Untitled", tags: [...tags], dur,
        status: dur >= 480 ? "needs-review" : "synced",
      };
      setEntries((p) => [ne, ...p]);
      setRunning(false);
    } else {
      setStartTs(Date.now());
      setRunning(true);
    }
  };

  const toggleTag = (t) => setTags((p) => p.includes(t) ? p.filter((x) => x !== t) : [...p, t]);

  const openAdd = () => { setEditingEntry(null); setSheetOpen(true); };
  const openEdit = (e) => { setEditingEntry(e); setSheetOpen(true); };
  const closeSheet = () => setSheetOpen(false);
  const deleteEntry = (e) => setEntries((p) => p.filter((x) => x.id !== e.id));
  const saveEntry = ({ id, date, start, end, durMin, description, tags, long }) => {
    const status = long ? "needs-review" : "synced";
    const rec = { date, start, end: end || start, description, tags, dur: durMin, status };
    if (id) setEntries((p) => p.map((x) => x.id === id ? { ...x, ...rec } : x));
    else setEntries((p) => [{ id: Date.now(), ...rec }, ...p]);
    setSheetOpen(false);
  };

  const weekMinutes = entries.filter((e) => HG.WEEK.includes(e.date)).reduce((s, e) => s + e.dur, 0);
  const weekBars = HG.WEEK.map((iso, i) => ({
    iso, label: HG.WEEKDAYS[i], today: iso === "2026-06-03",
    min: entries.filter((e) => e.date === iso).reduce((s, e) => s + e.dur, 0),
  }));

  return {
    device, screen, setScreen, entries, running, startTs, elapsed,
    description, setDescription, tags, toggleTag, toggleTimer,
    sheetOpen, editingEntry, openAdd, openEdit, closeSheet, deleteEntry, saveEntry,
    weekMinutes, weekBars, timerVariant: TIMER_VARIANT,
  };
}

export default function App() {
  const isDesktop = useIsDesktop();
  const device = isDesktop ? "desktop" : "phone";
  const [signedIn, setSignedIn] = useState(false);
  const app = useApp(device);

  if (!signedIn) {
    return <SignIn device={device} onContinue={() => setSignedIn(true)} />;
  }
  return device === "phone" ? <PhoneShell app={app} /> : <DesktopShell app={app} />;
}
