import { useId } from "react";

import { headShare, type Point, type Ring } from "@/lib/spin";
import { cn } from "@/lib/ui";

// The round table from above, all ours. The franchise's emblem is a compass rose:
// an eight-point star, a crescent moon at its hub and a ring of moon phases. This
// table never draws that combination: its inlay is a twelve-point star of
// alternating lengths, the hub carries our hood, and the places are plain gilt
// candle discs. See docs/features/traitors/DESIGN-RESEARCH.md.

const HOOD = "M0-9c-5 2-7 7-7 12 0 3 1 5 2 7h10c1-2 2-4 2-7 0-5-2-10-7-12Z";
const HOOD_OPENING = "M0-3c-2.5 1.5-3.5 4-3.5 6.5 0 2 .7 3.5 1.5 4.5h4c.8-1 1.5-2.5 1.5-4.5 0-2.5-1-5-3.5-6.5Z";

/** Twelve points, long and short in turn, each split into a light and a dark half like cut veneer. */
function Star({ r }: { r: number }) {
  const pt = (a: number, d: number) => `${(d * Math.sin(a)).toFixed(2)} ${(-d * Math.cos(a)).toFixed(2)}`;
  const inner = r * 0.2;
  return (
    <g>
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * Math.PI) / 6;
        const tip = pt(a, i % 2 ? r * 0.68 : r);
        const left = pt(a - Math.PI / 12, inner);
        const right = pt(a + Math.PI / 12, inner);
        return (
          <g key={i}>
            <path d={`M0 0L${left}L${tip}Z`} fill="var(--bone)" fillOpacity={i % 2 ? 0.55 : 0.8} />
            <path d={`M0 0L${tip}L${right}Z`} fill="var(--gilt)" fillOpacity={i % 2 ? 0.6 : 0.9} />
          </g>
        );
      })}
    </g>
  );
}

/**
 * The table: a dark rim with a gilt and marquetry border, a radial-grained wood
 * field under a warm pool of light, the inlaid star and a raised hub. A gilt
 * candle disc sits in front of each seat, and the head of the table, where the
 * host stands, is lit. A cast too big for a round table gets an oval one. The
 * star turns `angle` degrees with the seats.
 */
export function TableTop({ ring, angle, seats }: { ring: Ring; angle: number; seats: (Point & { k: number })[] }) {
  const id = useId();
  const { cx, cy, rx, ry } = ring;
  const R = rx - 4;
  const squash = ry / rx;
  const field = R * 0.86;
  // Where a seat's disc sits: in from the face, on the wood, measured before the squash.
  const disc = (s: Point, inset: number) => {
    const dx = s.x - cx;
    const dy = (s.y - cy) / squash;
    const len = Math.hypot(dx, dy) || 1;
    return { x: (dx * (len - inset)) / len, y: (dy * (len - inset)) / len };
  };
  const ids = { light: `${id}l`, rim: `${id}r`, grain: `${id}g`, sheen: `${id}s`, hub: `${id}h`, glow: `${id}w` };

  return (
    <svg
      viewBox={`0 0 ${ring.width} ${ring.height}`}
      aria-hidden="true"
      className="absolute inset-0 h-full w-full overflow-visible"
    >
      <defs>
        <radialGradient id={ids.light}>
          <stop offset="0%" stopColor="var(--flame)" stopOpacity={0.2} />
          <stop offset="70%" stopColor="var(--ember)" stopOpacity={0.06} />
          <stop offset="100%" stopColor="var(--ember)" stopOpacity={0} />
        </radialGradient>
        <radialGradient id={ids.rim}>
          <stop offset="80%" stopColor="var(--wood-dark)" />
          <stop offset="100%" stopColor="var(--night)" />
        </radialGradient>
        <radialGradient id={ids.grain} gradientUnits="userSpaceOnUse" cx={0} cy={0} r={R * 0.06} spreadMethod="repeat">
          <stop offset="0%" stopColor="var(--wood-dark)" stopOpacity={0} />
          <stop offset="55%" stopColor="var(--wood-dark)" stopOpacity={0.28} />
          <stop offset="100%" stopColor="var(--wood-dark)" stopOpacity={0} />
        </radialGradient>
        <radialGradient id={ids.sheen}>
          <stop offset="0%" stopColor="var(--flame)" stopOpacity={0.24} />
          <stop offset="45%" stopColor="var(--ember)" stopOpacity={0.06} />
          <stop offset="78%" stopColor="var(--night)" stopOpacity={0.2} />
          <stop offset="100%" stopColor="var(--night)" stopOpacity={0.62} />
        </radialGradient>
        <radialGradient id={ids.hub} cx="40%" cy="35%">
          <stop offset="0%" stopColor="var(--wood)" />
          <stop offset="100%" stopColor="var(--wood-dark)" />
        </radialGradient>
        <radialGradient id={ids.glow}>
          <stop offset="0%" stopColor="var(--flame)" stopOpacity={0.55} />
          <stop offset="100%" stopColor="var(--ember)" stopOpacity={0} />
        </radialGradient>
      </defs>

      <g transform={`translate(${cx} ${cy}) scale(1 ${squash.toFixed(4)})`}>
        <circle r={R * 1.3} fill={`url(#${ids.light})`} />
        <circle r={R + 3} cy={7} fill="var(--night)" opacity={0.85} />
        <circle r={R} fill={`url(#${ids.rim})`} stroke="var(--gilt)" strokeOpacity={0.7} strokeWidth={1} />

        {/* The border: blocks of pale and dark veneer between two gilt lines. */}
        <circle r={R * 0.9} fill="none" stroke="var(--wood)" strokeWidth={R * 0.07} />
        <circle r={R * 0.9} fill="none" stroke="var(--bone)" strokeOpacity={0.5} strokeWidth={R * 0.07} strokeDasharray="5 7" />
        <circle r={R * 0.935} fill="none" stroke="var(--gilt)" strokeWidth={1.2} />
        <circle r={R * 0.865} fill="none" stroke="var(--gilt)" strokeWidth={1.2} />

        <circle r={field} fill="var(--wood)" />
        <circle r={field} fill={`url(#${ids.grain})`} />
        <g transform={`rotate(${angle.toFixed(2)})`}>
          <Star r={field * 0.62} />
        </g>
        <circle r={field * 0.68} fill="none" stroke="var(--gilt)" strokeOpacity={0.55} strokeWidth={0.8} />
        <circle r={field} fill={`url(#${ids.sheen})`} />

        {/* The head of the table, lit: whoever is turned to it is the one being read about. */}
        <ellipse cy={-R + 30} rx={56} ry={40} fill={`url(#${ids.glow})`} className="animate-flicker" />

        {/* The hub, raised: a shadow under it, a lit edge on it, our hood on top. */}
        <circle r={R * 0.14} cy={3} fill="var(--night)" opacity={0.7} />
        <circle r={R * 0.14} fill={`url(#${ids.hub})`} stroke="var(--gilt)" strokeWidth={1.4} />
        <circle r={R * 0.11} fill="none" stroke="var(--gilt)" strokeOpacity={0.45} strokeWidth={0.6} />
        <g transform={`scale(${(R * 0.1) / 10})`}>
          <path d={HOOD} fill="var(--gilt)" />
          <path d={HOOD_OPENING} fill="var(--wood-dark)" />
        </g>

        {seats.map((s, i) => {
          const d = disc(s, 32);
          return (
            // The head's disc gives way to its name.
            <g key={i} transform={`translate(${d.x.toFixed(1)} ${d.y.toFixed(1)})`} opacity={1 - headShare(s.k)}>
              <circle r={5.5} fill="var(--gilt)" stroke="var(--wood-dark)" strokeWidth={1} />
              <circle r={2.5} fill="var(--candle)" />
              <circle
                r={1.6}
                cx={6}
                cy={-4}
                fill="var(--flame)"
                className="animate-flicker"
                style={{ animationDelay: `${-((i * 0.77) % 3.7)}s` }}
              />
            </g>
          );
        })}
      </g>
    </svg>
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

/** A heater shield in gilt: held that night, so safe from murder. */
export function ShieldMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 24" aria-hidden="true" className={className}>
      <path
        d="M10 1.5 2 4.5v6.5c0 5.5 3.4 9.4 8 11.5 4.6-2.1 8-6 8-11.5V4.5Z"
        fill="var(--cloak-500)"
        stroke="var(--candle)"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <path d="M10 4.5v15M5 9.5h10" stroke="var(--candle)" strokeWidth={1.4} strokeLinecap="round" />
    </svg>
  );
}

/** A recap still rolled up and tied with our seal's ribbon. */
export function ScrollArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 56" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id="scroll-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--bone)" />
          <stop offset="55%" stopColor="var(--parchment)" />
          <stop offset="100%" stopColor="var(--gilt)" />
        </linearGradient>
      </defs>
      <ellipse cx={60} cy={49} rx={50} ry={4} fill="var(--night)" opacity={0.8} />
      <rect x={14} y={13} width={92} height={30} fill="url(#scroll-body)" />
      <path d="M14 20h92M14 37h92" stroke="var(--wood)" strokeOpacity={0.18} strokeWidth={0.8} />
      <ellipse cx={14} cy={28} rx={6} ry={15} fill="var(--parchment)" stroke="var(--gilt)" strokeWidth={1} />
      <ellipse cx={14} cy={28} rx={2.5} ry={7} fill="var(--wood-dark)" />
      <ellipse cx={106} cy={28} rx={6} ry={15} fill="var(--parchment)" stroke="var(--gilt)" strokeWidth={1} />
      <ellipse cx={106} cy={28} rx={2.5} ry={7} fill="var(--wood-dark)" />
      <path d="M55 13h10v30H55Z" fill="var(--blood)" />
      <path d="M57 43l-3 10 4-3 2 4 1-11Z M63 43l3 9-4-2-1 4-1-11Z" fill="var(--oxblood)" />
    </svg>
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
