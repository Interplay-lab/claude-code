/* Icons — simple, rounded, minimal line icons.
   <Icon name="clock" size={20} stroke={2} /> */

export function Icon({ name, size = 20, stroke = 1.9, fill = "none", style }) {
  const p = {
    width: size, height: size, viewBox: "0 0 24 24", fill,
    stroke: "currentColor", strokeWidth: stroke,
    strokeLinecap: "round", strokeLinejoin: "round", style,
  };
  const paths = {
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
    play: <path d="M8 5.5l11 6.5-11 6.5z" fill="currentColor" stroke="none" />,
    stop: <rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" stroke="none" />,
    pause: <><rect x="7" y="5" width="3.5" height="14" rx="1.4" fill="currentColor" stroke="none"/><rect x="13.5" y="5" width="3.5" height="14" rx="1.4" fill="currentColor" stroke="none"/></>,
    plus: <path d="M12 5v14M5 12h14" />,
    list: <><path d="M8 7h12M8 12h12M8 17h12" /><circle cx="4" cy="7" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="17" r="1" fill="currentColor" stroke="none"/></>,
    users: <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" /><path d="M16 5.5a3 3 0 0 1 0 5.6M17.5 14c2.4.4 4 2.3 4 5" /></>,
    calendar: <><rect x="4" y="5.5" width="16" height="15" rx="3" /><path d="M4 10h16M8 3.5v4M16 3.5v4" /></>,
    chevR: <path d="M9 6l6 6-6 6" />,
    chevL: <path d="M15 6l-6 6 6 6" />,
    chevD: <path d="M6 9l6 6 6-6" />,
    pencil: <path d="M16.5 4.5l3 3L8 19l-4 1 1-4z" />,
    trash: <><path d="M4 7h16M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2" /><path d="M6 7l1 12.5a1.5 1.5 0 0 0 1.5 1.4h7a1.5 1.5 0 0 0 1.5-1.4L18 7" /></>,
    lock: <><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>,
    check: <path d="M5 12.5l4.5 4.5L19 7" />,
    checkCircle: <><circle cx="12" cy="12" r="9" /><path d="M8 12.2l2.8 2.8L16 9" /></>,
    alert: <><path d="M12 3.5L21.5 20H2.5z" /><path d="M12 10v4.5M12 17.4v.1" /></>,
    tag: <><path d="M11 3.5H5.5A1.5 1.5 0 0 0 4 5v5.5L13 19.5a2 2 0 0 0 2.8 0l3.7-3.7a2 2 0 0 0 0-2.8z" /><circle cx="8.5" cy="8.5" r="1.3" fill="currentColor" stroke="none" /></>,
    x: <path d="M6 6l12 12M18 6L6 18" />,
    google: <g stroke="none"><path d="M21.6 12.2c0-.7-.06-1.3-.18-1.96H12v3.7h5.4a4.6 4.6 0 0 1-2 3v2.5h3.24c1.9-1.75 3-4.33 3-7.24z" fill="#4285F4"/><path d="M12 22c2.7 0 4.96-.9 6.62-2.42l-3.24-2.5c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.58-4.12H3.06v2.58A10 10 0 0 0 12 22z" fill="#34A853"/><path d="M6.42 13.92a6 6 0 0 1 0-3.84V7.5H3.06a10 10 0 0 0 0 9z" fill="#FBBC05"/><path d="M12 5.96c1.47 0 2.79.5 3.83 1.5l2.87-2.87A10 10 0 0 0 12 2a10 10 0 0 0-8.94 5.5l3.36 2.58C7.2 7.72 9.4 5.96 12 5.96z" fill="#EA4335"/></g>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" /></>,
    arrowDown: <path d="M12 5v14M6 13l6 6 6-6" />,
    edit: <path d="M16.5 4.5l3 3L8 19l-4 1 1-4z" />,
    timer: <><circle cx="12" cy="13" r="8" /><path d="M12 13V9M9.5 2.5h5" /></>,
  };
  return <svg {...p}>{paths[name] || null}</svg>;
}
