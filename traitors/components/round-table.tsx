"use client";

import Link from "next/link";
import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";

import { FactionWord } from "@/components/faction-word";
import { CloakToken, DaggerToken, EmptyChair, Hood, ShieldMark, SlateToken, TableTop, Tally } from "@/components/table-art";
import { Headshot } from "@/components/ui/avatar";
import type { EventType, Faction, Player } from "@/lib/api/traitors";
import { RING_INSET, seatLayout, TABLE_ASPECT, tableWidth, toward, type SeatSpot } from "@/lib/ballot";
import { firstName, nameOf } from "@/lib/players";
import { cn, FOCUS } from "@/lib/ui";

export interface TableResult {
  banished?: string;
  faction?: Faction;
  victims?: string[];
  recruits?: string[];
}

type SeatState = "banished" | "murdered" | "recruited" | null;

interface RoundTableProps {
  roster: Player[];
  kind: EventType;
  /** Your selection, or your sealed call, in rank order. */
  chosen: string[];
  /** Present while you're picking; a sealed or closed call has none. */
  onTap?: (id: string) => void;
  /** A full slate: seats not on it can't be tapped. */
  full?: boolean;
  result?: TableResult | null;
  /** How many others called each player, or in a past season, the votes each drew. */
  tallies?: Record<string, number> | null;
  tallyLabel?: (count: number) => string;
  /** Names the table when a page shows more than one. */
  label?: string;
  /** Read-only seats link to each player's page. */
  hrefOf?: (id: string) => string;
  /** Voter id to target id: drawn as chalk arrows across the table. */
  ballots?: Record<string, string> | null;
  /** Who held a shield: a badge on their seat. */
  shields?: string[];
}

const RANKS = ["first", "second", "third"];
const LABELS: Record<EventType, string> = {
  MURDER: "Who is murdered",
  RT: "The round table vote",
  RECRUIT: "Who is recruited",
};

/**
 * The castle's table seen from a seat at it: every player still in sits round
 * it, and you call the night by tapping heads. Wider than a phone, it scrolls
 * sideways and opens centred.
 */
export function RoundTable({
  roster,
  kind,
  chosen,
  onTap,
  full = false,
  result = null,
  tallies = null,
  tallyLabel = (n) => `${n} called`,
  label,
  hrefOf,
  ballots = null,
  shields = [],
}: RoundTableProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const size = useSize(ring, ballots !== null);
  const width = tableWidth(roster.length);
  const spots = seatLayout(roster.length, width);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, [width]);

  const stateOf = (id: string): SeatState => {
    if (!result) return null;
    if (kind === "RT" && result.banished === id) return "banished";
    if (kind === "MURDER" && result.victims?.includes(id)) return "murdered";
    if (kind === "RECRUIT" && result.recruits?.includes(id)) return "recruited";
    return null;
  };

  return (
    <div ref={scroller} className="-mx-4 overflow-x-auto overscroll-x-contain px-4 sm:mx-0 sm:px-0">
      <div
        role="group"
        aria-label={label ?? LABELS[kind]}
        className="relative mx-auto w-full max-w-2xl"
        style={{ minWidth: width, aspectRatio: TABLE_ASPECT }}
      >
        <div
          ref={ring}
          className="absolute"
          style={{ left: RING_INSET.x, right: RING_INSET.x, top: RING_INSET.top, bottom: RING_INSET.bottom }}
        >
          <div className="absolute inset-x-[3%] inset-y-[6%]">
            <TableTop />
          </div>
          {ballots && size && <VoteLines roster={roster} spots={spots} ballots={ballots} size={size} />}
          {roster.map((p, i) => {
            const rank = chosen.indexOf(p.id);
            const count = tallies?.[p.id] ?? 0;
            return (
              <div key={p.id}>
                {/* With the votes drawn, your slate tokens would sit on the arrows; the slate below still lists them. */}
                {rank >= 0 && !ballots && (
                  <Placed spot={toward(spots[i], 0.34)} z={5}>
                    <Token kind={kind} rank={rank} />
                  </Placed>
                )}
                {count > 0 && (
                  <Placed spot={toward(spots[i], 0.58)} z={4}>
                    <Tally count={count} />
                  </Placed>
                )}
              </div>
            );
          })}
          {roster.map((p, i) => (
            <Seat
              key={p.id}
              player={p}
              spot={spots[i]}
              kind={kind}
              rank={chosen.indexOf(p.id)}
              state={stateOf(p.id)}
              faction={result?.faction}
              onTap={onTap}
              disabled={full && !chosen.includes(p.id)}
              tally={tallies?.[p.id] ? tallyLabel(tallies[p.id]) : null}
              href={hrefOf?.(p.id)}
              shield={shields.includes(p.id)}
              votedFor={ballots?.[p.id] ? nameOf(ballots[p.id], roster) : null}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

type Size = { w: number; h: number };

/** The seat ring's size in pixels, tracked only while something is drawn on it. */
function useSize(ref: RefObject<HTMLDivElement | null>, on: boolean): Size | null {
  const [size, setSize] = useState<Size | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!on || !el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, on]);
  return size;
}

type Point = { x: number; y: number };
const unit = (from: Point, to: Point) => {
  const len = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  return { x: (to.x - from.x) / len, y: (to.y - from.y) / len };
};

/**
 * Each vote as a chalk arrow from voter to target, bowed toward the middle of the
 * table so votes for one player fan in rather than lie on top of each other.
 */
function VoteLines({ roster, spots, ballots, size }: { roster: Player[]; spots: SeatSpot[]; ballots: Record<string, string>; size: Size }) {
  const filter = useId();
  const seat = new Map(roster.map((p, i) => [p.id, i]));
  // The face sits above the seat's centre, its name below; ends stop at the face's rim.
  const face = (i: number) => ({
    x: (spots[i].x / 100) * size.w,
    y: (spots[i].y / 100) * size.h - 8 * spots[i].scale,
    r: 27 * spots[i].scale,
  });
  const centre = { x: size.w / 2, y: size.h / 2 };
  const paths = Object.entries(ballots).flatMap(([voter, target]) => {
    const a = seat.get(voter);
    const b = seat.get(target);
    if (a === undefined || b === undefined || a === b) return [];
    const p0 = face(a);
    const p2 = face(b);
    const mid = { x: (p0.x + p2.x) / 2, y: (p0.y + p2.y) / 2 };
    const c = { x: mid.x + (centre.x - mid.x) * 0.35, y: mid.y + (centre.y - mid.y) * 0.35 };
    const out = unit(p0, c);
    const into = unit(c, p2);
    const s = { x: p0.x + out.x * p0.r, y: p0.y + out.y * p0.r };
    const e = { x: p2.x - into.x * p2.r, y: p2.y - into.y * p2.r };
    const barb = (turn: number) => {
      const cos = Math.cos(turn);
      const sin = Math.sin(turn);
      return { x: e.x - 10 * (into.x * cos - into.y * sin), y: e.y - 10 * (into.x * sin + into.y * cos) };
    };
    const l = barb(0.5);
    const r = barb(-0.5);
    const f = (n: number) => n.toFixed(1);
    return [
      {
        voter,
        d: `M${f(s.x)} ${f(s.y)}Q${f(c.x)} ${f(c.y)} ${f(e.x)} ${f(e.y)}M${f(l.x)} ${f(l.y)}L${f(e.x)} ${f(e.y)}L${f(r.x)} ${f(r.y)}`,
      },
    ];
  });

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[5] overflow-visible"
      width={size.w}
      height={size.h}
      viewBox={`0 0 ${size.w} ${size.h}`}
    >
      <defs>
        <filter id={filter}>
          <feTurbulence type="fractalNoise" baseFrequency={1.1} numOctaves={1} seed={3} />
          <feDisplacementMap in="SourceGraphic" scale={2} />
        </filter>
      </defs>
      <g filter={`url(#${filter})`} fill="none" stroke="var(--bone)" strokeOpacity={0.88} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {paths.map((p, i) => (
          <path
            key={p.voter}
            d={p.d}
            pathLength={1}
            strokeDasharray={1}
            className="animate-draw"
            style={{ animationDelay: `${i * 70}ms` }}
          />
        ))}
      </g>
    </svg>
  );
}

function Placed({ spot, z, children }: { spot: { x: number; y: number }; z: number; children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${spot.x}%`, top: `${spot.y}%`, zIndex: z }}
    >
      {children}
    </span>
  );
}

function Token({ kind, rank }: { kind: EventType; rank: number }) {
  if (kind === "RT") return <SlateToken rank={rank} className="animate-stamp" />;
  if (kind === "MURDER") return <DaggerToken className="size-9 animate-stamp drop-shadow-[0_3px_4px_rgb(0_0_0/0.7)]" />;
  return <CloakToken className="size-9 animate-stamp drop-shadow-[0_3px_4px_rgb(0_0_0/0.7)]" />;
}

interface SeatProps {
  player: Player;
  spot: SeatSpot;
  kind: EventType;
  rank: number;
  state: SeatState;
  faction: Faction | undefined;
  onTap?: (id: string) => void;
  disabled: boolean;
  tally: string | null;
  href?: string;
  shield: boolean;
  votedFor: string | null;
}

function Seat({ player, spot, kind, rank, state, faction, onTap, disabled, tally, href, shield, votedFor }: SeatProps) {
  const picked = rank >= 0;
  const label = [
    player.name,
    picked && (kind === "RT" ? `your ${RANKS[rank]}` : "your pick"),
    state === "banished" && `banished${faction ? `, ${faction}` : ""}`,
    state === "murdered" && "murdered",
    state === "recruited" && "recruited",
    tally,
    votedFor && `voted for ${votedFor}`,
    shield && "held a shield",
  ]
    .filter(Boolean)
    .join(", ");

  const face = (
    <span
      className={cn(
        "relative block size-12 overflow-hidden rounded-full bg-night ring-2 shadow-[0_6px_14px_-4px_rgb(0_0_0/0.9)] transition-[box-shadow,transform] duration-150",
        picked ? "ring-candle shadow-[0_0_16px_2px_rgb(233_185_73/0.45)]" : "ring-gilt/80",
        (href || (onTap && !disabled)) && "group-hover:ring-candle group-active:scale-95",
      )}
    >
      {state === "murdered" ? (
        <EmptyChair className="size-full" />
      ) : state !== "banished" ? (
        <Headshot round name={player.name} image={player.headshot} size={48} />
      ) : null}
      {state === "banished" && (
        <span className="absolute inset-0 animate-hood-drop">
          <Hood className="size-full" />
        </span>
      )}
      {state === "recruited" && (
        <span className="absolute inset-0 animate-fade-in [animation-duration:900ms]">
          <Hood className="size-full" />
        </span>
      )}
    </span>
  );
  const body = (
    <>
      {face}
      {shield && <ShieldMark className="absolute top-0 right-0.5 h-5 w-4 drop-shadow-[0_2px_2px_rgb(0_0_0/0.8)]" />}
      <span
        className={cn(
          "max-w-16 truncate font-display text-[11px] font-semibold tracking-[0.08em] uppercase",
          picked ? "text-candle" : "text-bone",
        )}
      >
        {firstName(player.name)}
      </span>
      {state === "banished" && faction && (
        <FactionWord
          faction={faction}
          className="absolute top-full left-1/2 -translate-x-1/2 text-sm whitespace-nowrap [animation-delay:1.2s]"
        />
      )}
    </>
  );
  const style: CSSProperties = {
    left: `${spot.x}%`,
    top: `${spot.y}%`,
    // The banished seat's reveal word overhangs its neighbours, so it sits on top.
    zIndex: state === "banished" ? 60 : 10 + Math.round(spot.depth * 40),
    transform: `translate(-50%, -50%) scale(${spot.scale.toFixed(3)})`,
  };
  const box = "absolute flex w-16 flex-col items-center gap-1";

  if (!onTap && href) {
    return (
      <Link href={href} aria-label={label} style={style} className={cn(box, FOCUS, "group rounded-sm pt-1 pb-0.5")}>
        {body}
      </Link>
    );
  }
  if (!onTap) {
    return (
      <div role="img" aria-label={label} style={style} className={box}>
        {body}
      </div>
    );
  }
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={picked}
      disabled={disabled}
      onClick={() => onTap(player.id)}
      style={style}
      className={cn(box, FOCUS, "group rounded-sm pt-1 pb-0.5 disabled:cursor-not-allowed disabled:opacity-45")}
    >
      {body}
    </button>
  );
}
