/* Screens: SignIn · Today · Entries */
import { HG } from "./data.js";
import { Icon } from "./icons.jsx";
import { EntryRow, WeekBars, WeekTotal } from "./components.jsx";
import { TimerCard } from "./timercard.jsx";

/* ── SIGN IN ─────────────────────────────────────────────── */
export function SignIn({ onContinue, device }) {
  return (
    <div style={{
      height: "100%", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: device === "phone" ? "0 28px" : "0 40px",
      background: "radial-gradient(120% 90% at 50% 0%, var(--primary-soft) 0%, var(--bg) 46%)",
      textAlign: "center",
    }}>
      <div style={{ flex: 1 }} />
      {/* mark */}
      <div style={{
        width: 72, height: 72, borderRadius: 22, background: "var(--primary)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "var(--sh-2)", marginBottom: 26, color: "#fff", position: "relative",
      }}>
        <Icon name="timer" size={36} stroke={2.2} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--primary-700)" }}>
        Relational Interplay
      </div>
      <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em", margin: "10px 0 8px", maxWidth: 320 }}>
        Track your hours, calmly.
      </h1>
      <p style={{ fontSize: 15.5, color: "var(--text-2)", maxWidth: 300, lineHeight: 1.5, margin: 0 }}>
        One tap to start. Your time flows straight to payroll — accurate, steady, done.
      </p>
      <button className="btn btn-lg hoverlift" onClick={onContinue} style={{
        marginTop: 34, width: device === "phone" ? "100%" : 340,
        background: "var(--surface)", color: "var(--text)",
        border: "1.5px solid var(--border-2)", boxShadow: "var(--sh-1)",
      }}>
        <Icon name="google" size={22} stroke={0} />
        Continue with Google
      </button>
      <div style={{ flex: 1 }} />
      <p style={{ fontSize: 12.5, color: "var(--text-3)", marginBottom: device === "phone" ? 40 : 24, maxWidth: 280, lineHeight: 1.5 }}>
        Sign in with the Google account you were invited with. We never post or read your email.
      </p>
    </div>
  );
}

/* ── TODAY / TIMER ───────────────────────────────────────── */
export function Today({ app }) {
  const wide = app.device === "desktop";
  const todays = app.entries.filter((e) => e.date === "2026-06-03");
  const todayTotal = todays.reduce((s, e) => s + e.dur, 0) + (app.running ? Math.floor(app.elapsed / 60) : 0);

  return (
    <div style={{ display: wide ? "grid" : "block", gridTemplateColumns: wide ? "minmax(0,1.15fr) minmax(0,0.85fr)" : "1fr", gap: 24, alignItems: "start" }}>
      {/* left / main column */}
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-2)" }}>
            {new Date("2026-06-03T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </div>
          <h2 style={{ fontSize: wide ? 28 : 24, fontWeight: 800, letterSpacing: "-0.02em", margin: "3px 0 0" }}>
            Good morning, Maya
          </h2>
        </div>

        <div className="card" style={{ padding: wide ? 28 : 22 }}>
          <TimerCard
            sec={app.elapsed}
            running={app.running}
            onToggle={app.toggleTimer}
            metaProps={{
              description: app.description, setDescription: app.setDescription,
              tags: app.tags, toggleTag: app.toggleTag, allTags: HG.TAGS,
            }}
          />
        </div>
      </div>

      {/* right / aside column */}
      <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: wide ? 0 : 18 }}>
        <div className="card" style={{ padding: 20 }}>
          <WeekTotal minutes={app.weekMinutes} />
        </div>

        <div className="card" style={{ padding: "18px 20px 8px" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Today</h3>
            <span className="num" style={{ fontSize: 14, fontWeight: 700, color: "var(--text-2)" }}>{HG.hm(todayTotal)}</span>
          </div>
          <div>
            {app.running && (
              <div style={{ borderBottom: "1px solid var(--border)" }}>
                <EntryRow compact e={{
                  start: new Date(app.startTs).toTimeString().slice(0, 5),
                  status: "running", description: app.description || "Untitled", tags: app.tags, dur: 0,
                }} />
              </div>
            )}
            {todays.length === 0 && !app.running ? (
              <div style={{ padding: "20px 0 24px", textAlign: "center", color: "var(--text-3)", fontSize: 14 }}>
                Nothing logged yet. Hit start. ☕
              </div>
            ) : todays.map((e, i) => (
              <div key={e.id} style={{ borderBottom: i < todays.length - 1 ? "1px solid var(--border)" : "none" }}>
                <EntryRow compact e={e} onEdit={app.openEdit} onDelete={app.deleteEntry} />
              </div>
            ))}
          </div>
          <button className="btn btn-quiet btn-md" onClick={app.openAdd}
            style={{ width: "100%", marginTop: 8, marginBottom: 10, color: "var(--primary-700)" }}>
            <Icon name="plus" size={18} /> Add manual entry
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── MY ENTRIES ──────────────────────────────────────────── */
export function Entries({ app }) {
  const wide = app.device === "desktop";
  const groups = HG.grouped(app.entries);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* weekly header */}
      <div className="card" style={{ padding: wide ? "22px 24px" : 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button className="btn btn-quiet btn-sm" style={{ padding: "0 7px", height: 32 }}><Icon name="chevL" size={18} /></button>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Jun 1 – 7, 2026</div>
            <button className="btn btn-quiet btn-sm" style={{ padding: "0 7px", height: 32 }}><Icon name="chevR" size={18} /></button>
          </div>
          <span className="chip chip-tag" style={{ height: 28 }}>This week</span>
        </div>
        <div style={{ display: wide ? "grid" : "block", gridTemplateColumns: "1fr 1.3fr", gap: 28, alignItems: "center" }}>
          <WeekTotal minutes={app.weekMinutes} />
          <div style={{ marginTop: wide ? 0 : 18 }}><WeekBars bars={app.weekBars} /></div>
        </div>
      </div>

      {/* grouped days */}
      {groups.map((g) => (
        <div key={g.date} className="card" style={{ padding: "6px 20px 8px" }}>
          <div style={{
            display: "flex", alignItems: "baseline", justifyContent: "space-between",
            padding: "13px 0 9px", borderBottom: "1px solid var(--border)",
          }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
              <span style={{ fontSize: 15.5, fontWeight: 800, whiteSpace: "nowrap" }}>{HG.relDay(g.date)}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-3)", whiteSpace: "nowrap" }}>{HG.dayLabel(g.date)}</span>
            </div>
            <span className="num" style={{ fontSize: 14, fontWeight: 800, color: "var(--text-2)" }}>{HG.hm(g.total)}</span>
          </div>
          {g.entries.map((e, i) => (
            <div key={e.id} style={{ borderBottom: i < g.entries.length - 1 ? "1px solid var(--border)" : "none" }}>
              <EntryRow e={e} onEdit={app.openEdit} onDelete={app.deleteEntry} />
            </div>
          ))}
        </div>
      ))}
      <div style={{ textAlign: "center", fontSize: 12.5, color: "var(--text-3)", padding: "4px 0 8px" }}>
        Entries older than 14 days are locked for payroll.
      </div>
    </div>
  );
}
