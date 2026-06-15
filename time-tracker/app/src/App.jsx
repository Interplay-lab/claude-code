/* App shell + state + nav.
   Replaces the prototype's device-toggle / tweaks panel with real
   responsive detection (useIsDesktop) and a real sign-in gate. */
import { useState, useRef, useEffect } from "react";
import { HG } from "./data.js";
import { Icon } from "./icons.jsx";
import { Avatar, useTicker, useIsDesktop, fmtClock } from "./components.jsx";
import { SignIn, Today, Entries } from "./screens.jsx";
import { Admin } from "./admin.jsx";
import { Balance } from "./balance.jsx";
import { Overlays } from "./overlays.jsx";
import { isLive, signInWithGoogle, signOut, getSession, onAuthChange } from "./lib/supabase.js";
import { getStaffByEmail, listMyEntries, getRunning, startTimer, stopTimer, addManual, updateEntry, deleteEntry as dbDelete } from "./lib/db.js";

const NAV = [
  { key: "today", label: "Timer", icon: "clock" },
  { key: "entries", label: "Entries", icon: "list" },
  { key: "balance", label: "Bucks", icon: "tag" },
  { key: "admin", label: "Admin", icon: "users" },
];
const TITLES = { today: null, entries: "My entries", balance: "Interplay Bucks", admin: "Team overview" };

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
            <Avatar initials={app.user.initials} size={34} />
          </div>
        </div>
        {title && <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", margin: "6px 0 0", padding: "0 18px", whiteSpace: "nowrap" }}>{title}</h2>}
      </div>

      {app.running && app.screen !== "today" && <RunBanner app={app} />}

      <main className="scroll-area" style={{ flex: 1, overflow: "auto", padding: "10px 16px 18px" }}>
        {app.screen === "today" && <Today app={app} />}
        {app.screen === "entries" && <Entries app={app} />}
        {app.screen === "balance" && <Balance app={app} />}
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

      <Overlays app={app} />
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
          <Avatar initials={app.user.initials} size={36} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: "nowrap" }}>{app.user.name}</div>
            <div style={{ fontSize: 11.5, color: "var(--text-3)", fontWeight: 600 }}>{app.user.role}</div>
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
            {app.screen === "admin" ? "Team overview" : app.screen === "entries" ? "My entries" : app.screen === "balance" ? "Interplay Bucks" : "Today"}
          </h1>
          <button className="btn btn-primary btn-md" onClick={app.openAdd}><Icon name="plus" size={18} /> Add entry</button>
        </div>
        {app.running && app.screen !== "today" && <RunBanner app={app} wide />}
        <main className="scroll-area" style={{ flex: 1, overflow: "auto" }}>
          <div style={{ maxWidth: app.screen === "admin" ? 1000 : 880, margin: "0 auto", padding: "28px 32px 52px" }}>
            {app.screen === "today" && <Today app={app} />}
            {app.screen === "entries" && <Entries app={app} />}
            {app.screen === "balance" && <Balance app={app} />}
            {app.screen === "admin" && <Admin app={app} />}
          </div>
        </main>
      </div>

      <Overlays app={app} />
    </div>
  );
}

/* date helpers — live mode uses the real clock; demo uses the fixed sample week */
const _pad2 = (n) => String(n).padStart(2, "0");
const isoOf = (d) => `${d.getFullYear()}-${_pad2(d.getMonth() + 1)}-${_pad2(d.getDate())}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
function mondayOf(d) { const x = new Date(d); x.setHours(12, 0, 0, 0); return addDays(x, -((x.getDay() + 6) % 7)); }
function weekFrom(monday) { return Array.from({ length: 7 }, (_, i) => isoOf(addDays(monday, i))); }
function weekLabelOf(week) {
  const a = new Date(week[0] + "T12:00:00"), b = new Date(week[6] + "T12:00:00");
  const mo = (d) => d.toLocaleDateString("en-US", { month: "short" });
  return a.getMonth() === b.getMonth()
    ? `${mo(a)} ${a.getDate()} – ${b.getDate()}, ${b.getFullYear()}`
    : `${mo(a)} ${a.getDate()} – ${mo(b)} ${b.getDate()}, ${b.getFullYear()}`;
}

/* ── App: state + handlers ───────────────────────────────── */
function useApp(device, user, ctx) {
  const live = ctx.live;
  const staffId = ctx.staffId;

  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week, -1 = last week, …
  const anchor = live ? new Date() : new Date("2026-06-03T12:00:00");
  const todayISO = isoOf(anchor);
  const yISO     = isoOf(addDays(anchor, -1));
  const week     = weekFrom(addDays(mondayOf(anchor), weekOffset * 7));
  const prevWeek = () => setWeekOffset((o) => o - 1);
  const nextWeek = () => setWeekOffset((o) => Math.min(0, o + 1)); // don't page into the future

  const [screen, setScreen] = useState("today");
  const [entries, setEntries] = useState(isLive ? [] : HG.entries);
  const [running, setRunning] = useState(false);
  const [startTs, setStartTs] = useState(Date.now());
  const [description, setDescription] = useState(isLive ? "" : "Component library cleanup");
  const [tags, setTags] = useState(isLive ? [] : ["Internal", "Design"]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [confirm, setConfirm] = useState(null); // entry pending delete
  const [toast, setToast] = useState(null);      // transient success message
  const elapsed = useTicker(running, startTs);

  const nowHM = () => new Date().toTimeString().slice(0, 5);

  const runningId = useRef(null);
  const toastTimer = useRef(null);
  const showToast = (msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  // Live mode: load this person's real entries (and resume a running timer).
  useEffect(() => {
    if (!live || !staffId) return;
    let active = true;
    setEntries([]); setDescription(""); setTags([]);
    (async () => {
      try {
        const [list, run] = await Promise.all([listMyEntries(staffId), getRunning(staffId)]);
        if (!active) return;
        setEntries(list.filter((e) => e.status !== "running"));
        if (run) {
          runningId.current = run.id;
          setStartTs(run.startTs);
          setDescription(run.description);
          setTags(run.tags);
          setRunning(true);
        }
      } catch { /* leave empty on error */ }
    })();
    return () => { active = false; };
  }, [live, staffId]);

  const toggleTimer = async () => {
    if (running) {
      if (live) {
        try {
          const saved = await stopTimer(runningId.current);
          runningId.current = null;
          setEntries((p) => [saved, ...p]);
        } catch { /* ignore */ }
      } else {
        const startHM = new Date(startTs).toTimeString().slice(0, 5);
        const dur = Math.max(1, Math.round(elapsed / 60));
        setEntries((p) => [{
          id: Date.now(), date: todayISO, start: startHM, end: nowHM(),
          description: description || "Untitled", tags: [...tags], dur,
          status: dur >= 480 ? "needs-review" : "synced",
        }, ...p]);
      }
      setRunning(false);
      showToast("Timer stopped · entry added");
    } else {
      if (live) {
        try {
          const r = await startTimer(staffId, { description, tags });
          runningId.current = r.id;
          setStartTs(r.startTs);
        } catch { /* ignore */ }
      } else {
        setStartTs(Date.now());
      }
      setRunning(true);
    }
  };

  const toggleTag = (t) => setTags((p) => p.includes(t) ? p.filter((x) => x !== t) : [...p, t]);

  const openAdd = () => { setEditingEntry(null); setSheetOpen(true); };
  const openEdit = (e) => { setEditingEntry(e); setSheetOpen(true); };
  const closeSheet = () => setSheetOpen(false);

  // delete asks for confirmation first
  const deleteEntry = (e) => setConfirm(e);
  const cancelDelete = () => setConfirm(null);
  const confirmDelete = async () => {
    const e = confirm;
    setConfirm(null);
    if (e) {
      if (live) { try { await dbDelete(e.id); } catch { /* ignore */ } }
      setEntries((p) => p.filter((x) => x.id !== e.id));
    }
    showToast("Entry deleted");
  };

  const saveEntry = async ({ id, date, start, end, durMin, description, tags, long }) => {
    setSheetOpen(false);
    if (live) {
      try {
        if (id) {
          const u = await updateEntry(id, { date, start, end, durMin, description, tags });
          setEntries((p) => p.map((x) => x.id === id ? u : x));
        } else {
          const c = await addManual(staffId, { date, start, end, durMin, description, tags });
          setEntries((p) => [c, ...p]);
        }
      } catch { /* ignore */ }
    } else {
      const status = long ? "needs-review" : "synced";
      const rec = { date, start, end: end || start, description, tags, dur: durMin, status };
      if (id) setEntries((p) => p.map((x) => x.id === id ? { ...x, ...rec } : x));
      else setEntries((p) => [{ id: Date.now(), ...rec }, ...p]);
    }
    showToast(id ? "Changes saved" : "Entry added");
  };

  const relDay = (iso) => iso === todayISO ? "Today" : iso === yISO ? "Yesterday" : HG.dayName(iso);

  const weekMinutes = entries.filter((e) => week.includes(e.date)).reduce((s, e) => s + e.dur, 0);
  const weekBars = week.map((iso, i) => ({
    iso, label: HG.WEEKDAYS[i], today: iso === todayISO,
    min: entries.filter((e) => e.date === iso).reduce((s, e) => s + e.dur, 0),
  }));

  return {
    device, user, live, screen, setScreen, entries, running, startTs, elapsed,
    description, setDescription, tags, toggleTag, toggleTimer,
    sheetOpen, editingEntry, openAdd, openEdit, closeSheet, saveEntry,
    deleteEntry, confirm, cancelDelete, confirmDelete, toast,
    weekMinutes, weekBars, todayISO, week, weekLabel: weekLabelOf(week), relDay,
    weekOffset, prevWeek, nextWeek,
    team: live ? [] : HG.team, teamWeek: live ? 0 : HG.teamWeek,
  };
}

/* Initials from a full name: "Briana Van Dorpe" → "BV". */
function initialsOf(name) {
  const w = (name || "").trim().split(/\s+/).filter(Boolean);
  if (w.length >= 2) return (w[0][0] + w[1][0]).toUpperCase();
  return (name || "?").slice(0, 2).toUpperCase();
}

/* Full-screen centered message (loading / blocked states). */
function Centered({ children }) {
  return (
    <div className="app" style={{
      height: "100%", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 16, padding: "0 28px",
      textAlign: "center", background: "var(--bg)",
    }}>{children}</div>
  );
}

/* Shown when a signed-in Google account isn't on the approved-email list. */
function NotApproved({ email, onSignOut }) {
  return (
    <Centered>
      <div style={{
        width: 56, height: 56, borderRadius: 16, background: "var(--locked-soft)",
        color: "var(--locked)", display: "flex", alignItems: "center", justifyContent: "center",
      }}><Icon name="lock" size={28} stroke={2} /></div>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>You're not on the list yet</h1>
      <p style={{ fontSize: 15, color: "var(--text-2)", maxWidth: 320, lineHeight: 1.5, margin: 0 }}>
        <span className="num" style={{ fontWeight: 700, color: "var(--text)" }}>{email}</span> isn't an
        approved account. Ask an admin to add it, then sign in again.
      </p>
      <button className="btn btn-ghost btn-md" onClick={onSignOut} style={{ marginTop: 4 }}>Sign out</button>
    </Centered>
  );
}

export default function App() {
  const isDesktop = useIsDesktop();
  const device = isDesktop ? "desktop" : "phone";
  // Demo mode (no Supabase configured): the original click-through gate.
  const [demoSignedIn, setDemoSignedIn] = useState(false);

  // Live mode: real Google session + approved-email gate.
  const [session, setSession] = useState(null);
  const [staff, setStaff] = useState(null);
  const [phase, setPhase] = useState(isLive ? "loading" : "ready"); // loading | ready | blocked

  // Who's signed in — from the staff row in live mode; demo persona otherwise.
  const fullName = staff?.full_name || "Maya Okafor";
  const user = {
    name: fullName,
    firstName: fullName.split(/\s+/)[0],
    initials: initialsOf(fullName),
    role: staff ? (staff.role === "admin" ? "Admin" : "Team member") : "Designer",
  };

  const live = isLive && !!staff;
  const app = useApp(device, user, { live, staffId: staff?.id });

  useEffect(() => {
    if (!isLive) return;
    let active = true;
    const resolve = async (s) => {
      if (!active) return;
      setSession(s);
      if (!s?.user?.email) { setStaff(null); setPhase("ready"); return; }
      const st = await getStaffByEmail(s.user.email).catch(() => null);
      if (!active) return;
      setStaff(st);
      setPhase(st ? "ready" : "blocked");
    };
    getSession().then(resolve);
    const unsub = onAuthChange(resolve);
    return () => { active = false; unsub(); };
  }, []);

  if (isLive) {
    if (phase === "loading") return <Centered><span style={{ color: "var(--text-3)", fontWeight: 600 }}>Loading…</span></Centered>;
    if (!session) return <SignIn device={device} onContinue={signInWithGoogle} />;
    if (phase === "blocked") return <NotApproved email={session.user.email} onSignOut={signOut} />;
    void staff; // (entries cutover wires staff into useApp next)
    return device === "phone" ? <PhoneShell app={app} /> : <DesktopShell app={app} />;
  }

  // Demo fallback
  if (!demoSignedIn) return <SignIn device={device} onContinue={() => setDemoSignedIn(true)} />;
  return device === "phone" ? <PhoneShell app={app} /> : <DesktopShell app={app} />;
}
