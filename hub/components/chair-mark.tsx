import { useId } from "react";

interface ChairMarkProps {
  className?: string;
  /** Without a label the mark is decorative. */
  label?: string;
}

const SIZE = 320;

// The right arm and leg are the left ones mirrored point by point. A mirroring
// transform would also mirror the body gradient and put blue on both sides.
const mirror = (d: string) => d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${SIZE - Number(x)},${y}`);

const ARM =
  "M58,128 C28,128 12,150 14,176 C16,196 28,206 40,209 L46,264 C48,280 58,288 74,288 L94,288 C102,288 108,282 108,272 L108,176 C108,146 90,128 58,128 Z";
const LEG = "M94,284 L116,284 L106,318 C105,321 102,322 99,322 L92,322 C89,322 87,319 88,316 Z";

// The armchair from brand/armchair-judge-logo.png, redrawn so the intro can
// move the crown and the "10" paddle on their own. Class names are the hooks
// app/intro.css animates.
export function ChairMark({ className, label }: ChairMarkProps) {
  const id = useId().replace(/[^\w-]/g, "");
  const body = `url(#${id}-body)`;
  const sheen = `url(#${id}-sheen)`;

  const shape = (d: string, key: string, fill = body) => (
    <g key={key}>
      <path d={d} fill={fill} />
      <path d={d} fill={sheen} />
    </g>
  );

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE + 8}`}
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        <linearGradient id={`${id}-body`} gradientUnits="userSpaceOnUse" x1="40" y1="220" x2="290" y2="110">
          <stop offset="0" stopColor="#3b5bff" />
          <stop offset="0.4" stopColor="#7a2cff" />
          <stop offset="0.68" stopColor="#e83fd0" />
          <stop offset="1" stopColor="#ff9a3d" />
        </linearGradient>
        <linearGradient id={`${id}-seat`} gradientUnits="userSpaceOnUse" x1="90" y1="270" x2="230" y2="210">
          <stop offset="0" stopColor="#6a3bff" />
          <stop offset="0.6" stopColor="#c43ae6" />
          <stop offset="1" stopColor="#ff6f9a" />
        </linearGradient>
        <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.24" />
          <stop offset="0.4" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.78" stopColor="#02081e" stopOpacity="0" />
          <stop offset="1" stopColor="#02081e" stopOpacity="0.4" />
        </linearGradient>
        <linearGradient id={`${id}-bar`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#3b5bff" />
          <stop offset="0.5" stopColor="#e83fd0" />
          <stop offset="1" stopColor="#ff9a3d" />
        </linearGradient>
        <linearGradient id={`${id}-crown`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe45c" />
          <stop offset="1" stopColor="#ffb21c" />
        </linearGradient>
        <radialGradient id={`${id}-floor`}>
          <stop offset="0" stopColor="#7a2cff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#7a2cff" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse className="chair-floor" cx="160" cy="322" rx="130" ry="9" fill={`url(#${id}-floor)`} />

      <g className="chair-body">
        {shape(LEG, "leg-l")}
        {shape(mirror(LEG), "leg-r")}
        {shape("M70,118 C70,84 98,70 160,70 C222,70 250,84 250,118 L250,250 L70,250 Z", "back")}
        <rect x="80" y="236" width="160" height="56" rx="20" fill={body} />
        <rect x="80" y="236" width="160" height="56" rx="20" fill={sheen} />
        {shape(ARM, "arm-l")}
        {shape(mirror(ARM), "arm-r")}
        {shape("M92,244 C92,222 110,212 160,212 C210,212 228,222 228,244 C228,266 212,276 160,276 C108,276 92,266 92,244 Z", "seat", `url(#${id}-seat)`)}
      </g>

      <g className="chair-paddle">
        <rect x="104" y="92" width="112" height="108" rx="20" fill="#0a1036" />
        <text
          x="160"
          y="160"
          textAnchor="middle"
          fontSize="60"
          fontWeight="800"
          fill="#f5f6ff"
          style={{ fontFamily: "var(--font-poppins), sans-serif", letterSpacing: "-2px" }}
        >
          10
        </text>
        <rect className="chair-bar" x="120" y="176" width="80" height="9" rx="4.5" fill={`url(#${id}-bar)`} />
      </g>

      <g className="chair-crown">
        <path d="M110,60 L104,14 L134,36 L160,4 L186,36 L216,14 L210,60 Z" fill={`url(#${id}-crown)`} />
        <path d="M160,4 L186,36 L216,14 L210,60 L160,60 Z" fill="#ff8a00" fillOpacity="0.28" />
      </g>
    </svg>
  );
}
