/* Mock data — Interplay Time Tracker
   "Today" is Wed Jun 3 2026. Week = Mon Jun 1 → Sun Jun 7.
   NOTE: this is seed/demo data. Wiring to the app database + the daily
   Airtable push (see ../../DESIGN.md) is the next milestone. */

export const HG = (function () {
  const TAGS = ["Client work", "Internal", "Meetings", "Design", "Research", "Writing", "Admin", "1:1"];

  // helpers
  const pad = (n) => String(n).padStart(2, "0");
  const hm = (min) => `${Math.floor(min / 60)}h ${pad(min % 60)}m`;
  const hmShort = (min) => min % 60 === 0 ? `${min / 60}h` : `${Math.floor(min / 60)}h ${min % 60}m`;
  const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const fmtRange = (s, e) => `${fmt12(s)} – ${fmt12(e)}`;
  function fmt12(t) {
    let [h, m] = t.split(":").map(Number);
    const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
    return `${h}:${pad(m)} ${ap}`;
  }

  // current user entries — keyed by date
  // status: running | synced | locked | needs-review
  let idc = 100;
  const E = (date, start, end, description, tags, status) => {
    const dur = end ? toMin(end) - toMin(start) : 0;
    return { id: ++idc, date, start, end, description, tags, status, dur };
  };

  const entries = [
    // Wed Jun 3 (today)
    E("2026-06-03", "09:15", "10:45", "Onboarding flow review", ["Design", "Meetings"], "synced"),
    E("2026-06-03", "11:00", "12:30", "Component library cleanup", ["Internal", "Design"], "synced"),
    // Tue Jun 2
    E("2026-06-02", "09:00", "12:15", "Client kickoff — Northwind", ["Client work", "Meetings"], "synced"),
    E("2026-06-02", "13:00", "17:30", "Prototype build", ["Client work", "Design"], "synced"),
    // Mon Jun 1
    E("2026-06-01", "08:45", "13:00", "Research synthesis", ["Research"], "synced"),
    E("2026-06-01", "14:00", "16:00", "Team planning", ["Internal", "Meetings"], "synced"),
    E("2026-06-01", "16:15", "16:45", "Weekly 1:1 — Sam", ["1:1"], "synced"),
    // last week — locked (paid/finalized)
    E("2026-05-29", "09:00", "17:30", "Workshop facilitation", ["Client work"], "needs-review"),
    E("2026-05-28", "09:30", "12:00", "Writing — case study", ["Writing"], "locked"),
    E("2026-05-28", "13:00", "16:30", "Design QA pass", ["Design", "Client work"], "locked"),
    E("2026-05-27", "10:00", "12:00", "Admin & invoicing prep", ["Admin"], "locked"),
    E("2026-05-27", "13:30", "17:00", "Client work — Aster", ["Client work"], "locked"),
    E("2026-05-26", "09:00", "12:30", "Research interviews", ["Research", "Client work"], "locked"),
    E("2026-05-26", "13:30", "15:30", "Synthesis", ["Research"], "locked"),
    E("2026-05-25", "09:00", "13:00", "Sprint planning", ["Internal", "Meetings"], "locked"),
  ];

  // group by date, newest first
  function grouped(list) {
    const map = {};
    list.forEach((e) => { (map[e.date] ||= []).push(e); });
    return Object.keys(map).sort().reverse().map((date) => ({
      date,
      entries: map[date].sort((a, b) => toMin(a.start) - toMin(b.start)),
      total: map[date].reduce((s, e) => s + e.dur, 0),
    }));
  }

  const dayName = (iso) => {
    const d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString("en-US", { weekday: "long" });
  };
  const dayLabel = (iso) => {
    const d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
  const relDay = (iso) => {
    if (iso === "2026-06-03") return "Today";
    if (iso === "2026-06-02") return "Yesterday";
    return dayName(iso);
  };

  // weekly total for current week (Jun 1–7)
  const WEEK = ["2026-06-01","2026-06-02","2026-06-03","2026-06-04","2026-06-05","2026-06-06","2026-06-07"];
  const weekMinutes = entries.filter(e => WEEK.includes(e.date)).reduce((s,e)=>s+e.dur,0);

  // per-day bars for the week
  const weekBars = WEEK.map((iso) => ({
    iso,
    label: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][WEEK.indexOf(iso)],
    min: entries.filter(e => e.date === iso).reduce((s,e)=>s+e.dur,0),
    today: iso === "2026-06-03",
  }));

  // admin — team overview
  const team = [
    { name: "Maya Okafor",  role: "Designer",   initials: "MO", week: 1830, days: [255,435,180,0,0,0,0], flag: null, status: "on-track" },
    { name: "Sam Reyes",    role: "Engineer",   initials: "SR", week: 2010, days: [480,510,495,0,0,0,0], flag: null, status: "on-track" },
    { name: "Devi Patel",   role: "Researcher", initials: "DP", week: 2280, days: [540,510,570,0,0,0,0], flag: "long", status: "review" },
    { name: "Theo Lindqvist",role: "Contractor",initials: "TL", week: 960,  days: [240,360,0,0,0,0,0],   flag: null, status: "on-track" },
    { name: "Jun Park",     role: "Designer",   initials: "JP", week: 1560, days: [300,420,300,0,0,0,0],  flag: null, status: "on-track" },
    { name: "Ada Cole",     role: "Contractor", initials: "AC", week: 240,  days: [0,120,0,0,0,0,0],      flag: "low", status: "low" },
  ];
  const teamWeek = team.reduce((s,m)=>s+m.week,0);

  return {
    TAGS, entries, grouped, dayName, dayLabel, relDay,
    hm, hmShort, fmt12, fmtRange, toMin,
    weekMinutes, weekBars, team, teamWeek, WEEK,
    WEEKDAYS: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
  };
})();
