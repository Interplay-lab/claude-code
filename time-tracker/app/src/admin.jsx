/* Screens: Admin team overview · Add/Edit entry sheet */
import { useState } from "react";
import { HG } from "./data.js";
import { Icon } from "./icons.jsx";
import { Avatar } from "./components.jsx";

const hStyle = { fontSize: 11.5, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" };

function DayCell({ min, long }) {
  if (min === 0) return <div style={{ textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>·</div>;
  return (
    <div className="num" style={{
      textAlign: "center", fontSize: 13, fontWeight: 700,
      color: long ? "var(--warn)" : "var(--text-2)",
    }}>{(min / 60).toFixed(min % 60 ? 1 : 0)}</div>
  );
}

/* ── ADMIN ───────────────────────────────────────────────── */
function EmptyTeam() {
  return (
    <div className="card" style={{ padding: "48px 24px", textAlign: "center" }}>
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>No team hours yet</div>
      <div style={{ fontSize: 14, color: "var(--text-2)", maxWidth: 320, margin: "0 auto", lineHeight: 1.5 }}>
        Your team's logged hours will show up here once people start tracking time.
      </div>
    </div>
  );
}

export function Admin({ app }) {
  const wide = app.device === "desktop";
  const team = app.team;
  const teamWeek = app.teamWeek;
  if (!team.length) return <EmptyTeam />;
  const flagged = team.filter((m) => m.flag).length;
  const onTrack = team.filter((m) => m.status === "on-track").length;

  const Stat = ({ label, value, tone }) => (
    <div className="card" style={{ padding: "16px 18px", flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-2)" }}>{label}</div>
      <div className="num" style={{ fontSize: 26, fontWeight: 800, marginTop: 3, color: tone || "var(--text)" }}>{value}</div>
    </div>
  );

  const flagChip = (m) => {
    if (m.flag === "long") return <span className="chip chip-review"><Icon name="alert" size={12} stroke={2.2} />Long days</span>;
    if (m.flag === "low") return <span className="chip chip-locked">Under hours</span>;
    return <span className="chip chip-ok"><Icon name="check" size={12} stroke={2.6} />On track</span>;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button className="btn btn-ghost btn-sm" style={{ padding: "0 7px", height: 34 }}><Icon name="chevL" size={18} /></button>
          <div style={{ fontSize: 15.5, fontWeight: 700 }}>Jun 1 – 7, 2026</div>
          <button className="btn btn-ghost btn-sm" style={{ padding: "0 7px", height: 34 }}><Icon name="chevR" size={18} /></button>
        </div>
      </div>

      {/* stats */}
      <div style={{ display: "flex", gap: 12 }}>
        <Stat label="Team hours" value={HG.hm(teamWeek)} />
        <Stat label="On track" value={`${onTrack}/${team.length}`} tone="var(--ok)" />
        <Stat label="Need review" value={flagged} tone={flagged ? "var(--warn)" : "var(--text)"} />
      </div>

      {wide ? (
        /* ── desktop: table ── */
        <div className="card" style={{ padding: "8px 8px 10px", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2.4fr repeat(7, 1fr) 0.9fr 1.2fr", alignItems: "center", padding: "12px 16px 11px", borderBottom: "1px solid var(--border)" }}>
            <div style={hStyle}>Member</div>
            {HG.WEEKDAYS.map((d) => <div key={d} style={{ ...hStyle, textAlign: "center" }}>{d}</div>)}
            <div style={{ ...hStyle, textAlign: "right" }}>Week</div>
            <div style={{ ...hStyle, textAlign: "right" }}>Status</div>
          </div>
          {team.map((m) => (
            <div key={m.name} className="hoverlift" style={{ display: "grid", gridTemplateColumns: "2.4fr repeat(7, 1fr) 0.9fr 1.2fr", alignItems: "center", padding: "11px 16px", borderRadius: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                <Avatar initials={m.initials} size={36} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-3)", fontWeight: 600 }}>{m.role}</div>
                </div>
              </div>
              {m.days.map((d, i) => <DayCell key={i} min={d} long={m.flag === "long" && d >= 480} />)}
              <div className="num" style={{ textAlign: "right", fontSize: 15, fontWeight: 800 }}>{HG.hmShort(m.week)}</div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>{flagChip(m)}</div>
            </div>
          ))}
        </div>
      ) : (
        /* ── phone: cards ── */
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {team.map((m) => (
            <div key={m.name} className="card" style={{ padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Avatar initials={m.initials} size={42} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15.5, fontWeight: 700 }}>{m.name}</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-3)", fontWeight: 600 }}>{m.role}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="num" style={{ fontSize: 18, fontWeight: 800 }}>{HG.hmShort(m.week)}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-3)", fontWeight: 600 }}>this week</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 40, marginTop: 14 }}>
                {m.days.map((d, i) => {
                  const max = Math.max(540, ...m.days);
                  const h = d === 0 ? 3 : Math.max(6, (d / max) * 34);
                  return (
                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                      <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                        <div style={{ width: "100%", maxWidth: 16, height: h, borderRadius: 4, background: d === 0 ? "var(--surface-3)" : (m.flag === "long" && d >= 480 ? "var(--warn)" : "var(--primary-soft)") }} />
                      </div>
                      <span className="num" style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)" }}>{HG.WEEKDAYS[i][0]}</span>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 12 }}>{flagChip(m)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── ADD / EDIT ENTRY SHEET ──────────────────────────────── */
export function EntrySheet({ app }) {
  const editing = app.editingEntry;
  const [date, setDate] = useState(editing ? editing.date : (app.todayISO || new Date().toISOString().slice(0, 10)));
  const [mode, setMode] = useState("range"); // range | duration
  const [start, setStart] = useState(editing ? editing.start : "09:00");
  const [end, setEnd] = useState(editing ? editing.end : "10:00");
  const [durH, setDurH] = useState(1);
  const [durM, setDurM] = useState(0);
  const [desc, setDesc] = useState(editing ? editing.description : "");
  const [tags, setTags] = useState(editing ? [...editing.tags] : []);

  const toggleTag = (t) => setTags((p) => p.includes(t) ? p.filter((x) => x !== t) : [...p, t]);
  const durMin = mode === "range" ? Math.max(0, HG.toMin(end) - HG.toMin(start)) : durH * 60 + durM;
  const long = durMin >= 480;

  const wide = app.device === "desktop";
  const save = () => app.saveEntry({ id: editing ? editing.id : null, date, start, end: mode === "range" ? end : null, durMin, description: desc, tags, long });

  const field = (label, node) => (
    <div><label className="field-label">{label}</label>{node}</div>
  );

  return (
    <div onClick={app.closeSheet} style={{
      position: "absolute", inset: 0, zIndex: 200,
      background: "rgba(43,37,33,0.34)", backdropFilter: "blur(2px)",
      display: "flex", alignItems: wide ? "center" : "flex-end", justifyContent: "center",
      animation: "fadein .18s ease",
    }}>
      <div onClick={(e) => e.stopPropagation()} className="scroll-area" style={{
        background: "var(--surface)", width: wide ? 460 : "100%",
        maxHeight: wide ? "86%" : "92%", overflow: "auto",
        borderRadius: wide ? "var(--r-xl)" : "26px 26px 0 0",
        boxShadow: "var(--sh-3)", padding: wide ? "26px 26px 24px" : "12px 22px 26px",
        animation: wide ? "fadein .2s ease" : "sheetup .26s cubic-bezier(.2,.8,.2,1)",
      }}>
        {!wide && <div style={{ width: 40, height: 5, borderRadius: 999, background: "var(--border-2)", margin: "0 auto 16px" }} />}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h3 style={{ fontSize: 20, fontWeight: 800, margin: 0, whiteSpace: "nowrap" }}>{editing ? "Edit entry" : "Add manual entry"}</h3>
          <button className="btn btn-quiet btn-sm" style={{ padding: "0 8px", height: 34 }} onClick={app.closeSheet}><Icon name="x" size={18} /></button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {field("Date", (
            <input type="date" className="input num" value={date} onChange={(e) => setDate(e.target.value)} />
          ))}

          {/* mode toggle */}
          <div style={{ display: "flex", gap: 4, background: "var(--surface-3)", padding: 4, borderRadius: "var(--r-md)" }}>
            {["range", "duration"].map((m) => (
              <button key={m} onClick={() => setMode(m)} className="btn btn-sm" style={{
                flex: 1, height: 36,
                background: mode === m ? "var(--surface)" : "transparent",
                color: mode === m ? "var(--text)" : "var(--text-2)",
                boxShadow: mode === m ? "var(--sh-1)" : "none",
              }}>{m === "range" ? "Start / End" : "Duration"}</button>
            ))}
          </div>

          {mode === "range" ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {field("Start", <input type="time" className="input num" value={start} onChange={(e) => setStart(e.target.value)} />)}
              {field("End", <input type="time" className="input num" value={end} onChange={(e) => setEnd(e.target.value)} />)}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {field("Hours", <input type="number" min="0" max="16" className="input num" value={durH} onChange={(e) => setDurH(+e.target.value || 0)} />)}
              {field("Minutes", <input type="number" min="0" max="59" step="5" className="input num" value={durM} onChange={(e) => setDurM(+e.target.value || 0)} />)}
            </div>
          )}

          {/* duration readout + soft warning */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderRadius: "var(--r-md)", background: long ? "var(--warn-soft)" : "var(--surface-2)" }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: long ? "var(--warn)" : "var(--text-2)" }}>
              {long ? "Long day — we'll flag this for review" : "Duration"}
            </span>
            <span className="num" style={{ fontSize: 16, fontWeight: 800, color: long ? "var(--warn)" : "var(--text)" }}>{HG.hm(durMin)}</span>
          </div>

          {field("Description", (
            <input className="input" placeholder="What did you work on?" value={desc} onChange={(e) => setDesc(e.target.value)} />
          ))}

          {field("Tags", (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {HG.TAGS.map((t) => (
                <button key={t} className={"tagsel" + (tags.includes(t) ? " on" : "")} onClick={() => toggleTag(t)}>{t}</button>
              ))}
            </div>
          ))}

          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button className="btn btn-ghost btn-lg" style={{ flex: 1 }} onClick={app.closeSheet}>Cancel</button>
            <button className="btn btn-primary btn-lg" style={{ flex: 2 }} onClick={save}>
              <Icon name="check" size={18} stroke={2.6} /> {editing ? "Save changes" : "Add entry"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
