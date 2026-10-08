"use client";

import { useState } from "react";

import { RoundTable } from "@/components/round-table";
import { Headshot } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { WaxSeal } from "@/components/ui/wax-seal";
import { submitWinner, type Faction, type Player, type SealedPick } from "@/lib/api/traitors";
import { playerOf, roman } from "@/lib/players";
import { multiplier, placeWorth, RANK_SHARE } from "@/lib/points";
import { button, cn, EYEBROW, HEADING } from "@/lib/ui";
import { ApiError } from "@armchair/app-core/api/client";

interface Pick {
  player: string;
  faction: Faction | null;
}

const MAX = RANK_SHARE.length;
const PLACES = ["1st", "2nd", "3rd"];

interface WinnerBetProps {
  season: string;
  roster: Player[];
  /** Places already sealed, 1st first. The rest are filled here. */
  sealed?: SealedPick[];
  episodes: number;
  released: number;
  /** Why it opened: a tap on a pick says what's waiting. */
  prompt?: string;
  onSealed: () => void;
}

/**
 * Your ranked top 3 winners and how each wins. The season is open to browse
 * without a 1st, but no call can be made until one is sealed. A sealed place is
 * final; an empty one can be filled later at what it's worth then, which the
 * candle shows.
 */
export function WinnerBet({ season, roster, sealed = [], episodes, released, prompt, onSealed }: WinnerBetProps) {
  const toast = useToast();
  const [picks, setPicks] = useState<Pick[]>([]);
  const m = multiplier(episodes, released);
  const room = MAX - sealed.length;
  const ready = picks.length > 0 && picks.every((p) => p.faction !== null);
  const locked = new Set(sealed.map((p) => p.player));

  const toggle = (id: string) => {
    if (locked.has(id)) return;
    setPicks((ps) =>
      ps.some((p) => p.player === id)
        ? ps.filter((p) => p.player !== id)
        : [...ps, { player: id, faction: null }].slice(0, room),
    );
  };
  const side = (id: string, faction: Faction) =>
    setPicks((ps) => ps.map((p) => (p.player === id ? { ...p, faction } : p)));
  // From the focus card: name them with a side, change the side, or the same again takes them back.
  const choose = (id: string, faction: Faction) =>
    setPicks((ps) => {
      const had = ps.find((p) => p.player === id);
      if (had?.faction === faction) return ps.filter((p) => p.player !== id);
      if (had) return ps.map((p) => (p.player === id ? { ...p, faction } : p));
      return ps.length < room ? [...ps, { player: id, faction }] : ps;
    });

  const seal = async () => {
    try {
      await submitWinner(season, [
        ...sealed.map((p) => ({ player: p.player, faction: p.faction })),
        ...picks.map((p) => ({ player: p.player, faction: p.faction ?? "Faithful" })),
      ]);
      onSealed();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        toast("Your bet changed on another device. Here it is as sealed.", "error");
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
          {sealed.length ? "Finish your top 3" : "Who takes the pot?"}
        </h2>
        <p className="text-lg leading-relaxed text-parchment">
          Rank three winners, each as a Faithful or a Traitor. A right 2nd choice earns 60% of a 1st, a 3rd 30%. Each place
          is final once sealed; seal your 1st to open your calls and add the rest later.
        </p>
        <div className="flex items-center gap-4 pt-1">
          <BetCandle share={m} />
          <p className="leading-snug">
            <span className="block font-display text-xl font-semibold text-candle nums">
              Worth {Math.round(m * 100)}% now
            </span>
            <span className="text-parchment">
              {released > 0 ? `${released} of ${episodes} episodes are already out.` : "Nothing has aired yet: full points."}
            </span>
          </p>
        </div>
        <WorthTable share={m} />
      </Card>

      <Places sealed={sealed} picks={picks} roster={roster} episodes={episodes} />

      <fieldset className="flex flex-col gap-3">
        <legend className={cn(EYEBROW, "mb-3")}>
          {room === 0 ? "Your top 3 is sealed" : picks.length >= room ? "Every place is chosen" : `Your ${PLACES[sealed.length + picks.length]} choice`}
        </legend>
        <p className="text-parchment">
          Turn the table to a player and pick them as a Faithful or a Traitor winner. They take your next empty place.
        </p>
        <RoundTable
          roster={roster}
          kind="WINNER"
          season={season}
          chosen={[...sealed.map((p) => p.player), ...picks.map((p) => p.player)]}
          onTap={toggle}
          actions={(p) => (
            <span role="group" aria-label="Pick as winner" className="flex flex-wrap gap-2">
              {SIDES.map((s) => {
                const on = picks.some((x) => x.player === p.id && x.faction === s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={on}
                    disabled={locked.has(p.id) || (!on && picks.length >= room && !picks.some((x) => x.player === p.id))}
                    onClick={() => choose(p.id, s.id)}
                    className={button(on ? "gold" : "primary", "sm")}
                  >
                    Pick as winner ({s.id})
                  </button>
                );
              })}
            </span>
          )}
          full={picks.length >= room}
        />
      </fieldset>

      {picks.map((p) => (
        <FactionChoice
          key={p.player}
          player={playerOf(p.player, roster)}
          value={p.faction}
          onChange={(f) => side(p.player, f)}
        />
      ))}

      <div className="flex flex-col items-start gap-2 border-t border-gilt/20 pt-4">
        <WaxSeal
          label={picks.length > 1 ? `Seal these ${picks.length} places` : sealed.length ? "Seal this place" : "Seal your bet"}
          sealed={false}
          disabled={!ready}
          onSeal={seal}
        />
        {!ready && (
          <p className="text-ash">
            {picks.length === 0 ? `Pick your ${PLACES[sealed.length]} choice to start.` : "Choose a side for each pick."}
          </p>
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
  player,
  value,
  onChange,
}: {
  player: Player;
  value: Faction | null;
  onChange: (f: Faction) => void;
}) {
  const name = player.name;
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 flex items-center gap-2 font-display tracking-[0.06em] text-bone">
        <span aria-hidden="true" className="inline-flex">
          <Headshot name={name} image={player.headshot} size={32} round />
        </span>
        {name} wins as
      </legend>
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

const upTo = (rank: number, share: number) => {
  const w = placeWorth(rank, share);
  return w.winner + w.faction;
};

/** The three places in rank order: sealed, being picked, or still empty. */
function Places({
  sealed,
  picks,
  roster,
  episodes,
}: {
  sealed: SealedPick[];
  picks: Pick[];
  roster: Player[];
  episodes: number;
}) {
  return (
    <ol aria-label="Your top 3" className="flex flex-col gap-2">
      {PLACES.map((place, i) => {
        const done = sealed[i];
        const next = done ? null : picks[i - sealed.length];
        const who = done?.player ?? next?.player;
        return (
          <li
            key={place}
            className={cn(
              "flex min-h-14 items-center gap-3 rounded-sm border px-3 py-2",
              done ? "border-gilt/50 bg-cloak/60" : next ? "border-candle/60 bg-stone" : "border-dashed border-gilt/30",
            )}
          >
            <span className="w-8 shrink-0 text-center font-display text-xl text-gilt">{roman(i + 1)}</span>
            {who ? (
              <>
                <span aria-hidden="true" className="inline-flex">
                  <Headshot name={playerOf(who, roster).name} image={playerOf(who, roster).headshot} size={36} round />
                </span>
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="truncate text-bone">{playerOf(who, roster).name}</span>
                  <span className="text-sm text-ash">
                    {(done?.faction ?? next?.faction) ? `as a ${done?.faction ?? next?.faction}` : "Choose a side below"}
                  </span>
                </span>
                {done ? (
                  <span className="shrink-0 text-right text-sm text-parchment">
                    Sealed
                    <span className="block text-ash">
                      up to <span className="nums">{upTo(i, multiplier(episodes, done.released))}</span> pts
                    </span>
                  </span>
                ) : (
                  <span className="shrink-0 text-sm text-candle">Not sealed yet</span>
                )}
              </>
            ) : (
              <span className="text-ash">Your {place} choice: empty</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** What each place earns if that player wins, at the bet's worth now. */
function WorthTable({ share }: { share: number }) {
  return (
    <table className="w-full text-left text-parchment">
      <caption className="sr-only">Points for each place if that player wins</caption>
      <thead>
        <tr className="font-display text-xs tracking-[0.14em] text-ash uppercase">
          <th scope="col" className="py-1 font-normal">
            Place
          </th>
          <th scope="col" className="py-1 text-right font-normal">
            They win
          </th>
          <th scope="col" className="py-1 text-right font-normal">
            Side right too
          </th>
        </tr>
      </thead>
      <tbody>
        {PLACES.map((place, i) => {
          const w = placeWorth(i, share);
          return (
            <tr key={place} className="border-t border-bone/10">
              <th scope="row" className="py-1 font-normal text-bone">
                {place}
              </th>
              <td className="py-1 text-right text-candle nums">{w.winner}</td>
              <td className="py-1 text-right text-candle nums">+{w.faction}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
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
