/* Timer card — the hero. Three variants: ring · stack · focus.
   Shared: description field + tag chips. Calm & steady motion.
   Default variant is "ring" (see App.jsx → TIMER_VARIANT). */
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

export function StartStopButton({ running, onToggle, full = true, size = "lg" }) {
  return (
    <button
      className={"btn " + (running ? "btn-ghost" : "btn-primary") + " btn-" + size + (running ? " pulse-on" : "")}
      onClick={onToggle}
      style={{
        width: full ? "100%" : "auto",
        ...(running ? { background: "var(--primary-soft)", color: "var(--primary-700)" } : {}),
      }}
    >
      <Icon name={running ? "stop" : "play"} size={running ? 18 : 20} />
      {running ? "Stop timer" : "Start timer"}
    </button>
  );
}

/* ── Variant: RING ───────────────────────────────────────── */
function TimerRing({ sec, running, onToggle, meta }) {
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
      <div style={{ width: "100%" }}>{meta}</div>
    </div>
  );
}

/* ── Variant: STACK ──────────────────────────────────────── */
function TimerStack({ sec, running, onToggle, meta }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
        padding: "26px 0 28px", borderRadius: "var(--r-lg)",
        background: running ? "var(--primary-soft)" : "var(--surface-2)",
        transition: "background .3s ease",
      }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
          color: running ? "var(--primary-700)" : "var(--text-3)", display: "flex", alignItems: "center", gap: 6 }}>
          {running && <span className="chip-dot breathe" style={{ background: "var(--primary)" }} />}
          {running ? "Tracking now" : "Timer ready"}
        </span>
        <ClockDisplay sec={sec} running={running} size={62} />
      </div>
      <StartStopButton running={running} onToggle={onToggle} />
      {meta}
    </div>
  );
}

/* ── Variant: FOCUS (the card is the button) ─────────────── */
function TimerFocus({ sec, running, onToggle, meta }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <button onClick={onToggle} className={running ? "pulse-on" : "hoverlift"} style={{
        border: "none", cursor: "pointer", textAlign: "left", width: "100%",
        borderRadius: "var(--r-xl)", padding: "30px 28px",
        background: running ? "linear-gradient(180deg,var(--primary) 0%,var(--primary-600) 100%)" : "var(--surface-2)",
        color: running ? "#fff" : "var(--text)",
        display: "flex", alignItems: "center", gap: 22,
        transition: "background .3s ease",
        boxShadow: running ? "var(--sh-2)" : "none",
      }}>
        <div style={{
          width: 76, height: 76, borderRadius: 999, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: running ? "rgba(255,255,255,0.18)" : "var(--primary)",
          color: "#fff",
        }}>
          <Icon name={running ? "stop" : "play"} size={32} />
        </div>
        <div style={{ flex: 1 }}>
          {running ? (
            <>
              <div className="num" style={{ fontSize: 46, fontWeight: 800, lineHeight: 1, letterSpacing: "-0.02em" }}>
                {(() => { const { h, m, s } = fmtClock(sec); return `${h}:${m}:${s}`; })()}
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 600, opacity: 0.85, marginTop: 6 }}>Tap to stop · tracking</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.01em" }}>Start timer</div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-3)", marginTop: 4 }}>One tap to begin tracking</div>
            </>
          )}
        </div>
      </button>
      {meta}
    </div>
  );
}

export function TimerCard({ variant, ...props }) {
  const meta = <TimerMeta {...props.metaProps} />;
  const shared = { sec: props.sec, running: props.running, onToggle: props.onToggle, meta };
  if (variant === "focus") return <TimerFocus {...shared} />;
  if (variant === "stack") return <TimerStack {...shared} />;
  return <TimerRing {...shared} />;
}
