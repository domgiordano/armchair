"use client";

import { useState } from "react";

import { RoundTable } from "@/components/round-table";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { WaxSeal } from "@/components/ui/wax-seal";
import { submitWinner, type Faction, type Player } from "@/lib/api/traitors";
import { FACTION, multiplier, WINNER } from "@/lib/points";
import { cn, EYEBROW, HEADING } from "@/lib/ui";
import { ApiError } from "@armchair/app-core/api/client";

interface Pick {
  player: string;
  faction: Faction | null;
}

const MAX = 3;

interface WinnerBetProps {
  season: string;
  roster: Player[];
  episodes: number;
  released: number;
  /** Why it opened: a tap on a pick says what's waiting. */
  prompt?: string;
  onSealed: () => void;
}

/**
 * Up to three winners and how each wins. The season is open to browse without
 * it, but no call can be made until it's sealed. Late bets are worth less; the
 * candle shows how much is left.
 */
export function WinnerBet({ season, roster, episodes, released, prompt, onSealed }: WinnerBetProps) {
  const toast = useToast();
  const [picks, setPicks] = useState<Pick[]>([]);
  const m = multiplier(episodes, released);
  const ready = picks.length > 0 && picks.every((p) => p.faction !== null);
  const names = new Map(roster.map((p) => [p.id, p.name]));

  const toggle = (id: string) =>
    setPicks((ps) =>
      ps.some((p) => p.player === id)
        ? ps.filter((p) => p.player !== id)
        : [...ps, { player: id, faction: null }].slice(0, MAX),
    );
  const side = (id: string, faction: Faction) =>
    setPicks((ps) => ps.map((p) => (p.player === id ? { ...p, faction } : p)));

  const seal = async () => {
    try {
      await submitWinner(
        season,
        picks.map((p) => ({ player: p.player, faction: p.faction ?? "Faithful" })),
      );
      onSealed();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        toast("You already sealed a bet for this season.", "error");
        onSealed();
      } else {
        toast(`Your bet didn't go through: ${e instanceof Error ? e.message : "try again"}`, "error");
      }
      throw e;
    }
  };

  return (
    <section aria-labelledby="bet-title" className="flex flex-col gap-6">
      <Card tone="blood" tartan className="flex flex-col gap-3 p-5 sm:p-6">
        <p className={cn(EYEBROW, "text-flame")}>{prompt ?? "Your top 3 winners"}</p>
        <h2 id="bet-title" className={cn(HEADING, "text-3xl leading-tight sm:text-4xl")}>
          Who takes the pot?
        </h2>
        <p className="text-lg leading-relaxed text-parchment">
          Name up to three winners, and whether each wins as a Faithful or a Traitor. Every one is scored the same.
          Your seal makes it final, and your calls open once it&apos;s set.
        </p>
        <div className="flex items-center gap-4 pt-1">
          <BetCandle share={m} />
          <p className="leading-snug">
            <span className="block font-display text-xl font-semibold text-candle nums">
              Worth {Math.round(m * 100)}% now
            </span>
            <span className="text-parchment">
              <span className="nums">{Math.round(WINNER * m)}</span> points per right winner,{" "}
              <span className="nums">+{Math.round(FACTION * m)}</span> if you call their side.
              {released > 0 && ` ${released} of ${episodes} episodes are already out.`}
            </span>
          </p>
        </div>
      </Card>

      <fieldset className="flex flex-col gap-3">
        <legend className={cn(EYEBROW, "mb-3")}>
          Pick up to three · {picks.length} of {MAX}
        </legend>
        <p className="text-parchment">Tap a seat to name a winner; tap again to take it back.</p>
        <RoundTable
          roster={roster}
          kind="WINNER"
          chosen={picks.map((p) => p.player)}
          onTap={toggle}
          full={picks.length >= MAX}
        />
      </fieldset>

      {picks.map((p) => (
        <FactionChoice
          key={p.player}
          name={names.get(p.player) ?? p.player}
          value={p.faction}
          onChange={(f) => side(p.player, f)}
        />
      ))}

      <div className="flex flex-col items-start gap-2 border-t border-gilt/20 pt-4">
        <WaxSeal label="Seal your bet" sealed={false} disabled={!ready} onSeal={seal} />
        {!ready && (
          <p className="text-ash">{picks.length === 0 ? "Pick a player to start." : "Choose a side for each pick."}</p>
        )}
      </div>
    </section>
  );
}

const SIDES: { id: Faction; swatch: string }[] = [
  { id: "Faithful", swatch: "bg-cloak-500 text-bone peer-checked:border-moss" },
  { id: "Traitor", swatch: "bg-oxblood text-bone peer-checked:border-blood-hi" },
];

function FactionChoice({
  name,
  value,
  onChange,
}: {
  name: string;
  value: Faction | null;
  onChange: (f: Faction) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 font-display tracking-[0.06em] text-bone">{name} wins as</legend>
      <div className="grid grid-cols-2 gap-2">
        {SIDES.map((s) => (
          <label key={s.id} className="relative cursor-pointer">
            <input
              type="radio"
              name={`side-${name}`}
              value={s.id}
              checked={value === s.id}
              onChange={() => onChange(s.id)}
              className="peer sr-only"
            />
            <span
              className={cn(
                "flex min-h-12 items-center justify-center gap-2 rounded-sm border-2 border-transparent font-title text-lg font-bold transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-candle hover:brightness-125",
                s.swatch,
                value !== null && value !== s.id && "opacity-60",
              )}
            >
              {s.id}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** The multiplier as a candle: the later the bet, the shorter the wax. */
function BetCandle({ share }: { share: number }) {
  const wax = 8 + 44 * share;
  return (
    <svg viewBox="0 0 32 72" aria-hidden="true" className="h-20 w-9 shrink-0">
      <defs>
        <radialGradient id="bet-flame-glow">
          <stop offset="0%" stopColor="var(--flame)" stopOpacity={0.6} />
          <stop offset="100%" stopColor="var(--ember)" stopOpacity={0} />
        </radialGradient>
      </defs>
      <circle cx={16} cy={64 - wax - 8} r={12} fill="url(#bet-flame-glow)" className="animate-flicker" />
      <path
        d={`M16 ${64 - wax - 15}c-2.5 3-4 5.5-4 7.5a4 4 0 0 0 8 0c0-2-1.5-4.5-4-7.5Z`}
        fill="var(--flame)"
        className="animate-flicker [animation-delay:-0.8s]"
      />
      <rect x={10} y={64 - wax} width={12} height={wax} rx={1.5} fill="var(--parchment)" />
      <rect x={6} y={64} width={20} height={4} rx={2} fill="var(--gilt)" />
    </svg>
  );
}
