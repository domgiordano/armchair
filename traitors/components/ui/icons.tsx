const ICON = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

export function MenuIcon() {
  return (
    <svg {...ICON}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg {...ICON}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg {...ICON}>
      <circle cx={10.5} cy={10.5} r={6} />
      <path d="M15 15l5 5" />
    </svg>
  );
}
