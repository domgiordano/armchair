import { cn } from "@/lib/ui";

// Drawn for the ballot's round table, all ours: an oval seen from a seat at it,
// never from above, so it can't read as the franchise's round-table emblem.

/** The table: a wooden oval with its near edge showing, a gilt inlay and three candles. */
export function TableTop() {
  return (
    <svg viewBox="0 0 200 120" preserveAspectRatio="xMidYMid meet" aria-hidden="true" className="h-full w-full">
      <defs>
        <radialGradient id="table-wood" cx="50%" cy="42%" r="62%">
          <stop offset="0%" stopColor="var(--wood)" />
          <stop offset="100%" stopColor="var(--wood-dark)" />
        </radialGradient>
        <radialGradient id="table-light">
          <stop offset="0%" stopColor="var(--flame)" stopOpacity={0.45} />
          <stop offset="60%" stopColor="var(--ember)" stopOpacity={0.12} />
          <stop offset="100%" stopColor="var(--ember)" stopOpacity={0} />
        </radialGradient>
        <radialGradient id="table-shadow">
          <stop offset="0%" stopColor="var(--night)" stopOpacity={0.9} />
          <stop offset="100%" stopColor="var(--night)" stopOpacity={0} />
        </radialGradient>
      </defs>
      <ellipse cx={100} cy={76} rx={98} ry={38} fill="url(#table-shadow)" />
      <path
        d="M14 60v7c0 16 39 30 86 30s86-14 86-30v-7"
        fill="var(--wood-dark)"
        stroke="var(--gilt)"
        strokeOpacity={0.5}
        strokeWidth={0.6}
      />
      <ellipse cx={100} cy={60} rx={86} ry={30} fill="url(#table-wood)" stroke="var(--gilt)" strokeWidth={1.2} />
      <ellipse
        cx={100}
        cy={60}
        rx={74}
        ry={24}
        fill="none"
        stroke="var(--gilt)"
        strokeOpacity={0.55}
        strokeWidth={0.6}
      />
      <ellipse cx={100} cy={57} rx={46} ry={16} fill="url(#table-light)" className="animate-flicker" />
      <Candle x={86} y={56} h={10} delay="-0.4s" />
      <Candle x={100} y={52} h={14} delay="-1.3s" />
      <Candle x={114} y={56} h={9} delay="-2.1s" />
    </svg>
  );
}

function Candle({ x, y, h, delay }: { x: number; y: number; h: number; delay: string }) {
  return (
    <g>
      <ellipse cx={x} cy={y + 0.6} rx={4} ry={1.4} fill="var(--gilt)" />
      <rect x={x - 2} y={y - h} width={4} height={h} rx={0.8} fill="var(--parchment)" />
      <path
        d={`M${x} ${y - h - 6}c-1.4 1.8-2.2 3.2-2.2 4.2a2.2 2.2 0 0 0 4.4 0c0-1-0.8-2.4-2.2-4.2Z`}
        fill="var(--flame)"
        className="animate-flicker"
        style={{ animationDelay: delay }}
      />
    </g>
  );
}

/** A green cloak's hood with nothing inside it. Never a face. */
export function Hood({ className, tone = "cloak" }: { className?: string; tone?: "cloak" | "blood" }) {
  return (
    <svg viewBox="0 0 60 60" aria-hidden="true" className={className}>
      <path
        d="M30 4C16 10 9 24 9 38c0 9 3 16 6 22h30c3-6 6-13 6-22C51 24 44 10 30 4Z"
        fill={tone === "blood" ? "var(--blood)" : "var(--cloak-500)"}
        stroke={tone === "blood" ? "var(--oxblood)" : "var(--cloak)"}
        strokeWidth={1.5}
      />
      <path d="M30 20c-8 5-11 13-11 21 0 6 2 11 4 14h14c2-3 4-8 4-14 0-8-3-16-11-21Z" fill="var(--night)" />
      <path
        d="M20 16c3-5 6-8 10-10"
        fill="none"
        stroke="rgb(244 236 218 / 0.25)"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </svg>
  );
}

/** The murdered player's place: an empty high-backed chair and a candle gone out. */
export function EmptyChair({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 60" aria-hidden="true" className={className}>
      <path d="M18 8h22l2 26H16Z" fill="var(--wood)" stroke="var(--gilt)" strokeWidth={1} />
      <path d="M22 12h14l1 18H21Z" fill="var(--oxblood)" opacity={0.8} />
      <path d="M12 34h34l-3 6H15Z" fill="var(--wood-dark)" stroke="var(--gilt)" strokeWidth={1} />
      <path d="M16 40v14M42 40v14" stroke="var(--wood)" strokeWidth={3} strokeLinecap="round" />
      <rect x={47} y={44} width={4} height={9} rx={0.8} fill="var(--parchment)" opacity={0.7} />
      <path d="M49 44v-2" stroke="var(--ash-dim)" strokeWidth={1} />
      <path
        d="M49 41c-2-2 2-4 0-6s2-4 0-6"
        fill="none"
        stroke="var(--ash)"
        strokeWidth={0.8}
        strokeLinecap="round"
        opacity={0.7}
      />
    </svg>
  );
}

/** The murder token: a dagger laid on the table. */
export function DaggerToken({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className={className}>
      <g transform="rotate(-35 20 20)">
        <path d="M20 2l3 22h-6Z" fill="var(--bone)" stroke="var(--ash)" strokeWidth={0.6} />
        <path d="M20 4v18" stroke="var(--ash)" strokeWidth={0.5} />
        <rect x={12} y={24} width={16} height={3} rx={1.2} fill="var(--gilt)" />
        <rect x={18} y={27} width={4} height={8} rx={1} fill="var(--oxblood)" />
        <circle cx={20} cy={36.5} r={2} fill="var(--gilt)" />
      </g>
    </svg>
  );
}

/** The recruit token: a red cloak held out. */
export function CloakToken({ className }: { className?: string }) {
  return <Hood tone="blood" className={className} />;
}

/** The round-table token: a small slate with the rank chalked on it. */
export function SlateToken({ rank, className }: { rank: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "slate flex h-7 min-w-8 items-center justify-center rounded-[3px] border border-gilt/80 px-1.5 font-hand text-xl leading-none text-bone shadow-[0_3px_6px_rgb(0_0_0/0.6)]",
        className,
      )}
    >
      {["I", "II", "III"][rank]}
    </span>
  );
}

/** A count in chalk tally marks, gates of five; past ten it writes the number. */
export function Tally({ count, className }: { count: number; className?: string }) {
  if (count > 10) {
    return <span className={cn("font-hand text-lg leading-none text-bone/85", className)}>{count}</span>;
  }
  const gates = Array.from({ length: Math.ceil(count / 5) }, (_, g) => Math.min(5, count - g * 5));
  return (
    <span className={cn("flex gap-1", className)}>
      {gates.map((marks, g) => (
        <svg key={g} viewBox="0 0 22 16" className="h-4 w-5.5" aria-hidden="true">
          {Array.from({ length: Math.min(marks, 4) }, (_, i) => (
            <path
              key={i}
              d={`M${3 + i * 4.5} 2l${i % 2 ? 0.6 : -0.4} 12`}
              stroke="var(--bone)"
              strokeOpacity={0.85}
              strokeWidth={1.4}
              strokeLinecap="round"
            />
          ))}
          {marks === 5 && (
            <path d="M1 12L20 4" stroke="var(--bone)" strokeOpacity={0.85} strokeWidth={1.4} strokeLinecap="round" />
          )}
        </svg>
      ))}
    </span>
  );
}
