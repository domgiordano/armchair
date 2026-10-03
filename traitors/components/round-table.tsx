"use client";

import Link from "next/link";
import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";

import { FactionWord } from "@/components/faction-word";
import { CloakToken, DaggerToken, EmptyChair, Hood, ShieldMark, SlateToken, TableTop, Tally } from "@/components/table-art";
import { Headshot } from "@/components/ui/avatar";
import type { EventType, Exit, Faction, Player } from "@/lib/api/traitors";
import { tableLayout, toward, type SeatSpot, type TableLayout } from "@/lib/ballot";
import { finishText } from "@/lib/history";
import { firstName, nameOf } from "@/lib/players";
import { button, cn, FOCUS } from "@/lib/ui";

export interface TableResult {
  banished?: string;
  faction?: Faction;
  victims?: string[];
  recruits?: string[];
}

/** A player at the table; the cast view also knows how they left and, once out, their side. */
export type Seated = Player & { exit?: Exit | null; faction?: Faction | null };

/** The three calls, plus the winner bet, which picks up to three seats too. */
export type TableKind = EventType | "WINNER";

type SeatState = "banished" | "murdered" | "recruited" | null;

interface RoundTableProps {
  roster: Seated[];
  kind: TableKind;
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
  /** The whole cast: the out are crossed off with how they left, unmasked Traitors ringed in red. */
  cast?: boolean;
  /** Always offer the list view, not only for a crowded table. */
  listToggle?: boolean;
  /** What the list view shows instead of the plain list of seats. */
  list?: ReactNode;
}

// From here a phone's table is wider than the screen: offer a list to scan instead.
const CROWDED = 20;

const RANKS = ["first", "second", "third"];
const LABELS: Record<TableKind, string> = {
  MURDER: "Who is murdered",
  RT: "The round table vote",
  RECRUIT: "Who is recruited",
  WINNER: "Pick your winners",
};

/**
 * The castle's table seen from above: the host's place at the head, everyone
 * else round the rim. You call the night by tapping heads; read-only, a head
 * opens that player's page. Wider than a phone, it scrolls sideways and opens
 * centred, and a crowded table offers a list.
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
  cast = false,
  listToggle = false,
  list,
}: RoundTableProps) {
  const [view, setView] = useState<"table" | "list">("table");
  const name = label ?? LABELS[kind];
  const seat = (p: Seated, i: number, spot: SeatSpot | null) => (
    <Seat
      key={p.id}
      player={p}
      spot={spot}
      kind={kind}
      rank={chosen.indexOf(p.id)}
      state={stateOf(kind, result, p.id)}
      faction={result?.faction}
      onTap={onTap}
      disabled={full && !chosen.includes(p.id)}
      tally={tallies?.[p.id] ? tallyLabel(tallies[p.id]) : null}
      href={hrefOf?.(p.id)}
      shield={shields.includes(p.id)}
      votedFor={ballots?.[p.id] ? nameOf(ballots[p.id], roster) : null}
      cast={cast}
    />
  );

  const toggle = (listToggle || roster.length >= CROWDED) && (
    <div role="group" aria-label={`${name}: view`} className="flex justify-end gap-1">
      {(["table", "list"] as const).map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={view === v}
          onClick={() => setView(v)}
          className={button(view === v ? "primary" : "ghost", "sm")}
        >
          {v === "table" ? "Table" : "List"}
        </button>
      ))}
    </div>
  );

  if (view === "list") {
    return (
      <div className="flex flex-col gap-3">
        {toggle}
        {list ?? (
          <ul aria-label={name} className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {roster.map((p, i) => (
              <li key={p.id}>{seat(p, i, null)}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {toggle}
      <Table
        roster={roster}
        name={name}
        kind={kind}
        chosen={chosen}
        tallies={tallies}
        ballots={ballots}
        cast={cast}
        seat={seat}
      />
    </div>
  );
}

function stateOf(kind: TableKind, result: TableResult | null, id: string): SeatState {
  if (!result) return null;
  if (kind === "RT" && result.banished === id) return "banished";
  if (kind === "MURDER" && result.victims?.includes(id)) return "murdered";
  if (kind === "RECRUIT" && result.recruits?.includes(id)) return "recruited";
  return null;
}

interface TableProps {
  roster: Seated[];
  name: string;
  kind: TableKind;
  chosen: string[];
  tallies: Record<string, number> | null;
  ballots: Record<string, string> | null;
  cast: boolean;
  seat: (p: Seated, i: number, spot: SeatSpot) => ReactNode;
}

function Table({ roster, name, kind, chosen, tallies, ballots, cast, seat }: TableProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const size = useSize(stage, ballots !== null);
  const layout = tableLayout(roster.length);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, [layout.width]);

  return (
    <div ref={scroller} className="-mx-4 overflow-x-auto overscroll-x-contain px-4 sm:mx-0 sm:px-0">
      <div
        ref={stage}
        role="group"
        aria-label={name}
        className="relative mx-auto w-full max-w-2xl"
        // Seats stay 44px however big the table draws, so a small table mustn't grow far past its own size.
        style={{ minWidth: layout.width, maxWidth: layout.width * 1.4, aspectRatio: `${layout.width} / ${layout.height}` }}
      >
        <TableTop layout={layout} />
        {ballots && size && <VoteLines roster={roster} layout={layout} ballots={ballots} size={size} />}
        {roster.map((p, i) => {
          const rank = chosen.indexOf(p.id);
          const count = tallies?.[p.id] ?? 0;
          const finish = cast ? finishText(p.exit ?? null) : null;
          return (
            <div key={p.id}>
              {/* How they left, chalked on the wood in front of them: under the name it would run into the next seat. */}
              {finish && (
                <Placed
                  // Neighbours' notes alternate depth so they don't run into each other.
                  spot={toward(layout, layout.seats[i], i % 2 ? 0.28 : 0.46)}
                  z={4}
                  align={layout.seats[i].x < 45 ? "start" : layout.seats[i].x > 55 ? "end" : "center"}
                >
                  <span
                    className={cn(
                      "font-hand text-base leading-none whitespace-nowrap",
                      p.exit?.how === "winner" ? "text-candle" : "text-bone/85",
                    )}
                  >
                    {finish}
                  </span>
                </Placed>
              )}
              {/* With the votes drawn, your slate tokens would sit on the arrows; the slate below still lists them. */}
              {rank >= 0 && !ballots && (
                <Placed spot={toward(layout, layout.seats[i], 0.3)} z={5}>
                  <Token kind={kind} rank={rank} />
                </Placed>
              )}
              {count > 0 && (
                <Placed spot={toward(layout, layout.seats[i], 0.5)} z={4}>
                  <Tally count={count} />
                </Placed>
              )}
            </div>
          );
        })}
        {roster.map((p, i) => seat(p, i, layout.seats[i]))}
      </div>
    </div>
  );
}

type Size = { w: number; h: number };

/** The table's size in pixels, tracked only while something is drawn on it. */
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

interface VoteLinesProps {
  roster: Player[];
  layout: TableLayout;
  ballots: Record<string, string>;
  size: Size;
}

/**
 * Each vote as a chalk arrow from voter to target, bowed toward the middle of the
 * table so votes for one player fan in rather than lie on top of each other.
 */
function VoteLines({ roster, layout, ballots, size }: VoteLinesProps) {
  const filter = useId();
  const seat = new Map(roster.map((p, i) => [p.id, i]));
  // Ends stop at the face's rim.
  const face = (i: number) => ({ x: (layout.seats[i].x / 100) * size.w, y: (layout.seats[i].y / 100) * size.h, r: 25 });
  const centre = { x: (layout.ring.cx / layout.width) * size.w, y: (layout.ring.cy / layout.height) * size.h };
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
      <g
        filter={`url(#${filter})`}
        fill="none"
        stroke="var(--bone)"
        strokeOpacity={0.88}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
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

interface PlacedProps {
  spot: SeatSpot;
  z: number;
  /** Which edge sits on the spot: a seat's note grows inward, away from the seat. */
  align?: "start" | "center" | "end";
  children: ReactNode;
}

function Placed({ spot, z, align = "center", children }: PlacedProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute -translate-y-1/2",
        align === "center" && "-translate-x-1/2",
        align === "end" && "-translate-x-full",
      )}
      style={{ left: `${spot.x}%`, top: `${spot.y}%`, zIndex: z }}
    >
      {children}
    </span>
  );
}

function Token({ kind, rank }: { kind: TableKind; rank: number }) {
  if (kind === "MURDER") return <DaggerToken className="size-9 animate-stamp drop-shadow-[0_3px_4px_rgb(0_0_0/0.7)]" />;
  if (kind === "RECRUIT") return <CloakToken className="size-9 animate-stamp drop-shadow-[0_3px_4px_rgb(0_0_0/0.7)]" />;
  return <SlateToken rank={rank} className="animate-stamp" />;
}

interface SeatProps {
  player: Seated;
  /** On the table; null in the list view. */
  spot: SeatSpot | null;
  kind: TableKind;
  rank: number;
  state: SeatState;
  faction: Faction | undefined;
  onTap?: (id: string) => void;
  disabled: boolean;
  tally: string | null;
  href?: string;
  shield: boolean;
  votedFor: string | null;
  cast: boolean;
}

function Seat({ player, spot, kind, rank, state, faction, onTap, disabled, tally, href, shield, votedFor, cast }: SeatProps) {
  const picked = rank >= 0;
  const finish = cast ? finishText(player.exit ?? null) : null;
  const won = cast && player.exit?.how === "winner";
  const unmasked = cast && player.faction === "Traitor" && Boolean(player.exit);
  const label = [
    player.name,
    cast && player.faction,
    finish,
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
        "relative block size-11 shrink-0 overflow-hidden rounded-full bg-night ring-2 shadow-[0_6px_14px_-4px_rgb(0_0_0/0.9)] transition-[box-shadow,transform] duration-150",
        picked || won ? "ring-candle shadow-[0_0_16px_2px_rgb(233_185_73/0.45)]" : unmasked ? "ring-blood" : "ring-gilt/80",
        (href || (onTap && !disabled)) && "group-hover:ring-candle group-active:scale-95",
      )}
    >
      {state === "murdered" ? (
        <EmptyChair className="size-full" />
      ) : state !== "banished" ? (
        <Headshot round name={player.name} image={player.headshot} size={44} exit={cast ? player.exit : null} />
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
  const marker = spot === null && picked && (
    <span aria-hidden="true" className="ml-auto shrink-0 font-display text-sm text-candle">
      {kind === "RT" || kind === "WINNER" ? ["I", "II", "III"][rank] : "Pick"}
    </span>
  );
  const nameText = (
    <span
      className={cn(
        "font-display font-semibold tracking-[0.08em] uppercase",
        spot ? "max-w-16 truncate text-[11px] leading-tight" : "min-w-0 truncate text-xs",
        picked || won ? "text-candle" : "text-bone",
      )}
    >
      {spot ? firstName(player.name) : player.name}
    </span>
  );
  const body = (
    <>
      {face}
      {shield && (
        <ShieldMark
          className={cn("h-5 w-4 drop-shadow-[0_2px_2px_rgb(0_0_0/0.8)]", spot ? "absolute -top-1 -right-0.5" : "shrink-0")}
        />
      )}
      {spot ? (
        <>
          {nameText}
        </>
      ) : (
        <span className="flex min-w-0 flex-col">
          {nameText}
          {finish && <span className="text-xs text-ash">{finish}</span>}
        </span>
      )}
      {marker}
      {state === "banished" && faction && (
        <FactionWord
          faction={faction}
          className={cn(
            "text-sm whitespace-nowrap [animation-delay:1.2s]",
            spot && "absolute top-full left-1/2 -translate-x-1/2",
          )}
        />
      )}
    </>
  );
  // On the table the face is centred on the seat's spot; the name hangs below it.
  const style: CSSProperties | undefined = spot
    ? {
        left: `${spot.x}%`,
        top: `${spot.y}%`,
        // The banished seat's reveal word overhangs its neighbours, so it sits on top.
        zIndex: state === "banished" ? 60 : 10 + Math.round(spot.y / 4),
        transform: "translate(-50%, -22px)",
      }
    : undefined;
  const box = spot
    ? "absolute flex w-14 flex-col items-center gap-0.5 rounded-sm"
    : "flex min-h-14 w-full items-center gap-2.5 rounded-sm border border-gilt/25 bg-stone/80 p-1.5 text-left";
  const hover = spot ? "" : "transition-colors hover:border-gilt hover:bg-cloak active:bg-cloak-500";

  if (!onTap && href) {
    return (
      <Link href={href} aria-label={label} style={style} className={cn(box, FOCUS, "group", hover)}>
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
      className={cn(box, FOCUS, "group disabled:cursor-not-allowed disabled:opacity-45", hover)}
    >
      {body}
    </button>
  );
}
