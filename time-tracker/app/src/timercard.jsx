/* Timer card — the hero of the home screen.
   A single, committed design: the RING. Circular minute sweep, clock in the
   center, calm pulse when running, with the description field + tag chips below. */
import { Icon } from "./icons.jsx";
import { fmtClock } from "./components.jsx";

export function ClockDisplay({ sec, running, size = 56, color }) {
  const { h, m, s } = fmtClock(sec);
  const c = color || (running ? "var(--text)" : "var(--text-3)");
  return (
    <div className="num" style={{ display: "flex", alignItems: "baseline", color: c, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1 }}>
      <span style={{ fontSize: size }}>{h}</span>
      <span style={{ fontSize: size, opacity: running ? 1 : 0.9 }}>:{m}</span>
      <span style={{ fontSize: size * 0.6, marginLeft: 2, color: running ? "var(--primary)" : "var(--text-3)" }}>:{s}</span>
    </div>
  );
}

function TimerMeta({ description, setDescription, tags, toggleTag, allTags }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <input
        className="input"
        placeholder="What are you working on?"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        style={{ fontWeight: 600 }}
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
        {allTags.slice(0, 6).map((t) => (
          <button key={t} className={"tagsel" + (tags.includes(t) ? " on" : "")} onClick={() => toggleTag(t)}>{t}</button>
        ))}
      </div>
    </div>
  );
}

/* ── The ring ────────────────────────────────────────────── */
export function TimerCard({ sec, running, onToggle, metaProps }) {
  const R = 104, SW = 12, C = 2 * Math.PI * R;
  const prog = running ? (sec % 60) / 60 : 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
      <div style={{ position: "relative", width: 248, height: 248 }}>
        <svg width="248" height="248" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="124" cy="124" r={R} fill="none" stroke="var(--surface-3)" strokeWidth={SW} />
          <circle cx="124" cy="124" r={R} fill="none"
            stroke="var(--primary)" strokeWidth={SW} strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - prog)}
            style={{ transition: "stroke-dashoffset .95s linear", opacity: running ? 1 : 0 }} />
        </svg>
        <div className={running ? "pulse-on" : ""} style={{
          position: "absolute", inset: SW + 6, borderRadius: 999,
          background: running ? "var(--primary-soft)" : "var(--surface-2)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
          transition: "background .3s ease",
        }}>
          <ClockDisplay sec={sec} running={running} size={44} />
          <span style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase",
            color: running ? "var(--primary-700)" : "var(--text-3)" }}>
            {running ? "Tracking" : "Ready"}
          </span>
        </div>
      </div>
      <button className={"btn " + (running ? "" : "btn-primary") + " btn-lg" + (running ? " pulse-on" : "")}
        onClick={onToggle}
        style={{ width: 200, ...(running ? { background: "var(--primary-soft)", color: "var(--primary-700)" } : {}) }}>
        <Icon name={running ? "stop" : "play"} size={running ? 18 : 20} />
        {running ? "Stop" : "Start"}
      </button>
      <div style={{ width: "100%" }}><TimerMeta {...metaProps} /></div>
    </div>
  );
}
