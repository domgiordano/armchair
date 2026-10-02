"use client";

import { useState, type ReactNode } from "react";

import { Outcome } from "@/components/outcome";
import { RoundTable } from "@/components/round-table";
import { errorText } from "@/components/season-data";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SkeletonList } from "@/components/ui/skeleton";
import { Chalk, Slate } from "@/components/ui/slate";
import { ErrorState } from "@/components/ui/states";
import { tabId, Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { WaxSeal } from "@/components/ui/wax-seal";
import {
  submitPick,
  type Episode,
  type EpisodeEvent,
  type EventType,
  type Player,
  type SeasonEpisode,
} from "@/lib/api/traitors";
import { consensusRows, move, toggle } from "@/lib/ballot";
import { nameOf, roman } from "@/lib/players";
import { eventPoints } from "@/lib/points";
import { formatRelease } from "@/lib/schedule";
import { useEpisodePoll } from "@/lib/use-episode-poll";
import { cn, EYEBROW, FOCUS, HEADING } from "@/lib/ui";
import { ApiError } from "@armchair/app-core/api/client";
import type { GroupMember } from "@armchair/app-core/api/groups";

const COPY: Record<EventType, { tab: string; title: string; prompt: string }> = {
  MURDER: {
    tab: "Murder",
    title: "The murder",
    prompt: "Who won't come down in the morning? Tap one seat.",
  },
  RT: {
    tab: "Banish",
    title: "The round table",
    prompt: "Tap three seats in the order the votes fall. I is who you think leaves.",
  },
  RECRUIT: {
    tab: "Recruit",
    title: "The recruit",
    prompt: "If the Traitors recruit tonight, who gets the cloak? Tap one seat, or take no pick.",
  },
};

const PANEL = "event-panel";

interface BallotProps {
  season: string;
  episode: SeasonEpisode;
  group: string | null;
  members: GroupMember[] | null;
  /** The season's title for the header, when the page knows it. */
  seasonTitle?: string;
  /** After a call is sealed, so the season's answered counts catch up. */
  onSealed: () => void;
}

/** One episode's three calls: murder, round table, recruit. Blind and final, each under the wax seal. */
export function Ballot({ season, episode, group, members, seasonTitle, onSealed }: BallotProps) {
  const { data, error, reload } = useEpisodePoll(season, episode.ep, episode.releaseAt, group);
  const [tab, setTab] = useState<EventType | null>(null);

  if (data === null) {
    if (error !== null) return <ErrorState what="this episode" message={error} retry={reload} />;
    return <SkeletonList label="Laying the table" rows={3} row="h-24" />;
  }

  const active = data.events.find((e) => e.type === tab) ?? data.events.find((e) => e.locked) ?? data.events[0];
  const sealed = data.events.filter((e) => e.mine).length;

  return (
    <section aria-labelledby="episode-title" className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className={EYEBROW}>
            {seasonTitle && `${seasonTitle} · `}Episode {roman(data.ep)} · {formatRelease(data.releaseAt)}
          </p>
          <h1 id="episode-title" className={cn(HEADING, "text-2xl leading-tight")}>
            {data.title ?? `Episode ${data.ep}`}
          </h1>
        </div>
        <p className="shrink-0 pb-0.5 text-ash">
          {data.closed ? (
            "Closed · view only"
          ) : (
            <>
              <span className="nums">{sealed}</span> of <span className="nums">{data.events.length}</span> sealed
            </>
          )}
        </p>
      </div>
      {error !== null && (
        <p role="status" className="rounded-sm border border-ember/50 bg-ember/10 px-3 py-2 text-bone">
          Couldn&apos;t refresh: {error}. Showing the last view loaded.
        </p>
      )}
      {active && (
        <>
          <Tabs
            label="Calls this episode"
            tabs={data.events.map((e) => ({ id: e.type, label: COPY[e.type].tab, done: Boolean(e.mine) }))}
            value={active.type}
            onChange={setTab}
            panelId={PANEL}
          />
          <div id={PANEL} role="tabpanel" aria-labelledby={tabId(PANEL, active.type)} className="flex flex-col gap-4">
            <EventPanel
              key={active.type}
              season={season}
              episode={data}
              event={active}
              members={members}
              onSealed={() => {
                reload();
                onSealed();
              }}
            />
          </div>
        </>
      )}
    </section>
  );
}

interface EventPanelProps {
  season: string;
  episode: Episode;
  event: EpisodeEvent;
  members: GroupMember[] | null;
  onSealed: () => void;
}

function EventPanel({ season, episode, event, members, onSealed }: EventPanelProps) {
  const toast = useToast();
  const [picks, setPicks] = useState<string[]>([]);
  const [forfeit, setForfeit] = useState(false);
  const picking = event.locked && !episode.closed;
  const rows = consensusRows(event, Infinity);

  const submit = async () => {
    try {
      await submitPick(season, episode.ep, event.type, forfeit ? { forfeit: true } : { picks });
    } catch (e) {
      if (e instanceof ApiError && (e.status === 409 || e.status === 403)) {
        toast(e.status === 409 ? "You already made this call on another device." : "This episode is closed.", "error");
        onSealed();
      } else {
        toast(`Your call didn't go through: ${errorText(e)}`, "error");
      }
      throw e;
    }
    onSealed();
  };

  return (
    <>
      <div className="flex flex-col gap-1">
        <h2 className={cn(HEADING, "text-xl")}>{COPY[event.type].title}</h2>
        {picking && <p className="text-parchment">{COPY[event.type].prompt}</p>}
      </div>
      <RoundTable
        roster={episode.roster}
        kind={event.type}
        chosen={picking ? (forfeit ? [] : picks) : (event.mine?.picks ?? [])}
        onTap={picking && !forfeit ? (id) => setPicks((p) => toggle(p, id, event.picks)) : undefined}
        full={event.picks > 1 && picks.length >= event.picks}
        result={picking ? null : event.result}
        tallies={picking ? null : Object.fromEntries(rows.map((r) => [r.id, r.count]))}
      />
      {picking ? (
        <PickSlate
          event={event}
          roster={episode.roster}
          picks={picks}
          forfeit={forfeit}
          onPicks={setPicks}
          onForfeit={setForfeit}
          onSeal={submit}
        />
      ) : (
        <Reveal event={event} roster={episode.roster} members={members} closed={episode.closed} />
      )}
    </>
  );
}

interface PickSlateProps {
  event: EpisodeEvent;
  roster: Player[];
  picks: string[];
  forfeit: boolean;
  onPicks: (picks: string[]) => void;
  onForfeit: (forfeit: boolean) => void;
  onSeal: () => Promise<void>;
}

function PickSlate({ event, roster, picks, forfeit, onPicks, onForfeit, onSeal }: PickSlateProps) {
  const ranked = event.type === "RT";
  const ready = forfeit || picks.length === event.picks;
  const slots = Array.from({ length: event.picks }, (_, i) => picks[i] ?? null);

  return (
    <Slate className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className={EYEBROW}>Your slate</p>
        {ranked && picks.length > 0 && !forfeit && (
          <Button variant="ghost" size="sm" onClick={() => onPicks([])}>
            Clear
          </Button>
        )}
      </div>
      <ol aria-label="Your slate" className="flex flex-col gap-1">
        {slots.map((id, i) => (
          <li key={i} className="flex min-h-12 items-center gap-3 border-b border-bone/10 last:border-b-0">
            <span aria-hidden="true" className="w-8 shrink-0 font-display text-lg text-gilt">
              {ranked ? roman(i + 1) : ""}
            </span>
            {id && !forfeit ? (
              <>
                <Chalk key={id} className="min-w-0 flex-1 truncate">
                  <span className="sr-only">{ranked ? `${roman(i + 1)}: ` : ""}</span>
                  {nameOf(id, roster)}
                </Chalk>
                {ranked && (
                  <span className="flex shrink-0">
                    <SlateButton
                      label={`Move ${nameOf(id, roster)} up`}
                      disabled={i === 0}
                      onClick={() => onPicks(move(picks, i, -1))}
                    >
                      <path d="m6 15 6-6 6 6" />
                    </SlateButton>
                    <SlateButton
                      label={`Move ${nameOf(id, roster)} down`}
                      disabled={i === picks.length - 1}
                      onClick={() => onPicks(move(picks, i, 1))}
                    >
                      <path d="m6 9 6 6 6-6" />
                    </SlateButton>
                  </span>
                )}
                <SlateButton
                  label={`Rub out ${nameOf(id, roster)}`}
                  onClick={() => onPicks(picks.filter((p) => p !== id))}
                >
                  <path d="M7 7l10 10M17 7L7 17" />
                </SlateButton>
              </>
            ) : (
              <span className="text-ash italic">{forfeit ? "No pick" : "Tap a seat"}</span>
            )}
          </li>
        ))}
      </ol>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-parchment">
        <input
          type="checkbox"
          checked={forfeit}
          onChange={(e) => onForfeit(e.target.checked)}
          className={cn(FOCUS, "size-5 accent-[var(--candle)]")}
        />
        No pick (reveal)
      </label>
      <WaxSeal
        label={forfeit ? "Seal: no pick" : ranked ? "Seal your slate" : "Seal your call"}
        sealed={false}
        disabled={!ready}
        onSeal={onSeal}
      />
      <p className="text-sm text-ash">
        Sealed is final. The results and everyone else&apos;s calls open once you seal.
      </p>
    </Slate>
  );
}

function SlateButton({
  label,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        FOCUS,
        "flex size-11 items-center justify-center rounded-sm text-bone/70 transition-colors hover:bg-bone/10 hover:text-bone active:bg-bone/20 disabled:opacity-30 disabled:hover:bg-transparent",
      )}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        aria-hidden="true"
      >
        {children}
      </svg>
    </button>
  );
}

interface RevealProps {
  event: EpisodeEvent;
  roster: Player[];
  members: GroupMember[] | null;
  closed: boolean;
}

function Reveal({ event, roster, members, closed }: RevealProps) {
  const points = eventPoints(event);
  const rows = consensusRows(event);
  const people = new Map((members ?? []).map((m) => [m.sub, m]));
  const mine = event.mine;

  return (
    <>
      <Slate className="flex flex-col gap-3">
        <p className={EYEBROW}>{mine ? "Your call" : "Result"}</p>
        {mine?.forfeit && <p className="text-ash italic">No pick</p>}
        {mine?.picks && (
          <ol className="flex flex-wrap gap-x-5 gap-y-1">
            {mine.picks.map((id, i) => (
              <li key={id} className="flex items-baseline gap-2">
                {event.type === "RT" && <span className="font-display text-gilt">{roman(i + 1)}</span>}
                <Chalk>{nameOf(id, roster)}</Chalk>
              </li>
            ))}
          </ol>
        )}
        {!mine && closed && <p className="text-ash">This episode aired before the season opened here: view only.</p>}
        <p
          className="flex flex-wrap items-baseline gap-x-2 border-t border-bone/10 pt-3 text-lg text-bone"
          aria-live="polite"
        >
          <span className="font-display text-xs tracking-[0.14em] text-ash uppercase">What happened</span>
          <Outcome event={event} roster={roster} />
        </p>
        {points !== null && (
          <p className="font-display text-2xl font-semibold text-candle">
            +<span className="nums">{points}</span> {points === 1 ? "point" : "points"}
          </p>
        )}
      </Slate>

      {rows.length > 0 && (
        <Card as="section" aria-labelledby="consensus-title" className="flex flex-col gap-3">
          <h3 id="consensus-title" className={EYEBROW}>
            Everyone&apos;s calls · <span className="nums">{event.consensus?.voters}</span>
          </h3>
          <ul className="flex flex-col gap-2.5">
            {rows.map((r, i) => (
              <li key={r.id} className="flex flex-col gap-1">
                <span className="text-parchment">
                  <span className="nums text-bone">{Math.round(r.share * 100)}%</span> had {nameOf(r.id, roster)}
                  {event.type === "RT" ? " first" : ""}
                </span>
                <span aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-night">
                  <span
                    className={cn(
                      "block h-full origin-left animate-grow-x rounded-full",
                      i === 0 ? "bg-candle" : "bg-gilt/60",
                    )}
                    style={{ width: `${Math.max(3, r.share * 100)}%` }}
                  />
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {event.group && (
        <Card as="section" aria-labelledby="group-title" className="flex flex-col gap-2">
          <h3 id="group-title" className={EYEBROW}>
            Your group
          </h3>
          {event.group.length === 0 ? (
            <p className="text-ash">Nobody else in the group has made this call yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {event.group.map((g) => {
                const who = people.get(g.sub);
                return (
                  <li key={g.sub} className="flex items-center gap-3">
                    <Avatar name={who?.name ?? null} picture={who?.picture ?? null} size={32} />
                    <span className="w-24 shrink-0 truncate text-bone">{who?.name ?? "Someone"}</span>
                    {g.picks ? (
                      <Chalk className="min-w-0 truncate text-xl">
                        {g.picks.map((id) => nameOf(id, roster)).join(" · ")}
                      </Chalk>
                    ) : (
                      <span className="text-ash italic">No pick</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}
    </>
  );
}
