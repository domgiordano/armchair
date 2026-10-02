"use client";

import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";

import { FactionWord } from "@/components/faction-word";
import { CloakToken, DaggerToken, EmptyChair, Hood, SlateToken, TableTop, Tally } from "@/components/table-art";
import { Headshot } from "@/components/ui/avatar";
import type { EventType, Faction, Player } from "@/lib/api/traitors";
import { RING_INSET, seatLayout, TABLE_ASPECT, tableWidth, toward, type SeatSpot } from "@/lib/ballot";
import { firstName } from "@/lib/players";
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
}: RoundTableProps) {
  const scroller = useRef<HTMLDivElement>(null);
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
          className="absolute"
          style={{ left: RING_INSET.x, right: RING_INSET.x, top: RING_INSET.top, bottom: RING_INSET.bottom }}
        >
          <div className="absolute inset-x-[3%] inset-y-[6%]">
            <TableTop />
          </div>
          {roster.map((p, i) => {
            const rank = chosen.indexOf(p.id);
            const count = tallies?.[p.id] ?? 0;
            return (
              <div key={p.id}>
                {rank >= 0 && (
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
            />
          ))}
        </div>
      </div>
    </div>
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
}

function Seat({ player, spot, kind, rank, state, faction, onTap, disabled, tally }: SeatProps) {
  const picked = rank >= 0;
  const label = [
    player.name,
    picked && (kind === "RT" ? `your ${RANKS[rank]}` : "your pick"),
    state === "banished" && `banished${faction ? `, ${faction}` : ""}`,
    state === "murdered" && "murdered",
    state === "recruited" && "recruited",
    tally,
  ]
    .filter(Boolean)
    .join(", ");

  const face = (
    <span
      className={cn(
        "relative block size-12 overflow-hidden rounded-full bg-night ring-2 shadow-[0_6px_14px_-4px_rgb(0_0_0/0.9)] transition-[box-shadow,transform] duration-150",
        picked ? "ring-candle shadow-[0_0_16px_2px_rgb(233_185_73/0.45)]" : "ring-gilt/80",
        onTap && !disabled && "group-hover:ring-candle group-active:scale-95",
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
