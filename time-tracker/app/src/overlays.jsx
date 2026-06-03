/* App overlays: the add/edit sheet, the delete-confirmation dialog,
   and the lightweight success toast. Rendered once per shell. */
import { HG } from "./data.js";
import { Icon } from "./icons.jsx";
import { EntrySheet } from "./admin.jsx";

/* ── Delete confirmation ─────────────────────────────────── */
function ConfirmDelete({ app }) {
  const e = app.confirm;
  if (!e) return null;
  const wide = app.device === "desktop";
  return (
    <div onClick={app.cancelDelete} style={{
      position: "absolute", inset: 0, zIndex: 250,
      background: "rgba(43,37,33,0.34)", backdropFilter: "blur(2px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24, animation: "fadein .16s ease",
    }}>
      <div onClick={(ev) => ev.stopPropagation()} style={{
        background: "var(--surface)", width: wide ? 380 : "min(360px, 100%)",
        borderRadius: "var(--r-xl)", boxShadow: "var(--sh-3)",
        padding: "26px 24px 22px", textAlign: "center",
        animation: "fadein .2s ease",
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: 999, margin: "0 auto 14px",
          background: "var(--primary-soft)", color: "var(--primary-700)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon name="trash" size={24} stroke={2} />
        </div>
        <h3 style={{ fontSize: 19, fontWeight: 800, margin: "0 0 6px" }}>Delete this entry?</h3>
        <p style={{ fontSize: 14, color: "var(--text-2)", margin: "0 0 2px", lineHeight: 1.45 }}>
          <span style={{ fontWeight: 600, color: "var(--text)" }}>
            {e.description || "No description"}
          </span>
          {" · "}
          <span className="num" style={{ fontWeight: 600 }}>{HG.hmShort(e.dur)}</span>
        </p>
        <p style={{ fontSize: 12.5, color: "var(--text-3)", margin: "0 0 20px" }}>This can't be undone.</p>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-ghost btn-md" style={{ flex: 1 }} onClick={app.cancelDelete}>Cancel</button>
          <button className="btn btn-primary btn-md" style={{ flex: 1 }} onClick={app.confirmDelete}>
            <Icon name="trash" size={16} stroke={2.1} /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Success toast ───────────────────────────────────────── */
function Toast({ app }) {
  if (!app.toast) return null;
  const wide = app.device === "desktop";
  return (
    <div style={{
      position: "absolute", left: 0, right: 0, zIndex: 300, pointerEvents: "none",
      bottom: wide ? 28 : "calc(env(safe-area-inset-bottom) + 84px)",
      display: "flex", justifyContent: "center", padding: "0 16px",
    }}>
      <div className="toast" style={{
        pointerEvents: "auto",
        display: "inline-flex", alignItems: "center", gap: 9,
        background: "var(--text)", color: "#fff",
        height: 44, padding: "0 18px", borderRadius: 999,
        fontSize: 14, fontWeight: 600, boxShadow: "var(--sh-3)",
      }}>
        <span style={{
          width: 20, height: 20, borderRadius: 999, flexShrink: 0,
          background: "var(--ok)", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon name="check" size={13} stroke={3} />
        </span>
        {app.toast}
      </div>
    </div>
  );
}

export function Overlays({ app }) {
  return (
    <>
      {app.sheetOpen && <EntrySheet app={app} />}
      <ConfirmDelete app={app} />
      <Toast app={app} />
    </>
  );
}
