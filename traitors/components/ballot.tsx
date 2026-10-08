"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

import { FaceDownNotice, RevealSheet } from "@/components/face-down";
import { Outcome } from "@/components/outcome";
import { PlayerChip } from "@/components/player-chip";
import { seasonPlayerHref } from "@/components/player-link";
import { RecapCard, SealedScroll } from "@/components/recap";
import { RoundTable } from "@/components/round-table";
import { ShieldMark, Tally } from "@/components/table-art";
import { errorText } from "@/components/season-data";
import { Avatar, Headshot } from "@/components/ui/avatar";
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
  type CastMember,
  type Episode,
  type EpisodeEvent,
  type EventType,
  type Player,
  type SeasonEpisode,
} from "@/lib/api/traitors";
import { chalk, chalkable, consensusRows, move, toggle } from "@/lib/ballot";
import { finishText } from "@/lib/history";
import { firstName, nameOf, playerOf, roman } from "@/lib/players";
import { eventPoints } from "@/lib/points";
import { votesByTarget } from "@/lib/recap";
import { formatRelease } from "@/lib/schedule";
import { revealCall, sealCall, useFaceDown } from "@/lib/sealed";
import { useEpisodePoll } from "@/lib/use-episode-poll";
import { button, cn, EYEBROW, FOCUS, HEADING } from "@/lib/ui";
import { ApiError } from "@armchair/app-core/api/client";
import type { GroupMember } from "@armchair/app-core/api/groups";

const COPY: Record<EventType, { tab: string; title: string; prompt: string }> = {
  MURDER: {
    tab: "Murder",
    title: "The murder",
    prompt: "Who won't come down in the morning? Turn the table to them and choose them for the murder.",
  },
  RT: {
    tab: "Banish",
    title: "The round table",
    prompt: "Chalk three names in the order the votes fall. I is who you think leaves.",
  },
  RECRUIT: {
    tab: "Recruit",
    title: "The recruit",
    prompt: "If the Traitors recruit tonight, who gets the cloak? Turn the table to them and choose, or take no pick.",
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
  /** A pick tried before the winner bet: the caller asks for it. */
  onNeedBet?: () => void;
  /** The season's cast, for the faces of those already gone. */
  cast?: CastMember[];
}

/** One episode's three calls: murder, round table, recruit. Blind and final, each under the wax seal. */
export function Ballot({ season, episode, group, members, seasonTitle, onSealed, onNeedBet, cast = [] }: BallotProps) {
  const { data, error, reload } = useEpisodePoll(season, episode.ep, episode.releaseAt, group);
  const [tab, setTab] = useState<EventType | null>(null);
  const [locked, setLocked] = useState<EventType | null>(null);
  const faceDown = useFaceDown(season);

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
      {data.out.length > 0 && <Gone season={season} out={data.out} cast={cast} />}
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
              onNeedBet={onNeedBet}
              onSealed={() => {
                reload();
                onSealed();
              }}
              onLocked={setLocked}
            />
          </div>
        </>
      )}
      {data.recap && faceDown.episode(data.ep) ? (
        <FaceDownNotice season={season} ep={data.ep} what="The recap" link={false} />
      ) : data.recap ? (
        <RecapCard recap={data.recap} />
      ) : data.closed || data.events.every((e) => e.mine) ? (
        <p className="text-ash">The recap isn&apos;t written yet. It appears here once the wiki has it.</p>
      ) : (
        <SealedScroll />
      )}
      <RevealSheet
        locked={locked && { what: `Your ${COPY[locked].title.replace(/^The /, "")} call`, ep: data.ep }}
        onReveal={() => {
          if (locked) revealCall(season, data.ep, locked);
          setLocked(null);
        }}
        onClose={() => setLocked(null)}
      />
    </section>
  );
}

/** Who has already left the castle, crossed off, so the table's empty places make sense. */
function Gone({ season, out, cast }: { season: string; out: Episode["out"]; cast: CastMember[] }) {
  const faces = new Map(cast.map((p) => [p.id, p]));
  const hrefOf = seasonPlayerHref(season);
  return (
    <section aria-labelledby="gone-title" className="flex flex-col gap-2">
      <h2 id="gone-title" className={EYEBROW}>
        Gone from the castle
      </h2>
      <ul className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {out.map((o) => {
          const name = faces.get(o.id)?.name ?? nameOf(o.id, null);
          return (
            <li key={o.id} className="shrink-0">
              <Link
                href={hrefOf(o.id)}
                aria-label={`${name}, ${finishText(o)}${o.faction ? `, ${o.faction}` : ""}`}
                className={cn(FOCUS, "group flex w-16 flex-col items-center gap-1 rounded-sm p-1 text-center hover:bg-cloak/50")}
              >
                <span aria-hidden="true">
                  <Headshot name={name} image={faces.get(o.id)?.headshot ?? null} exit={o} size={44} />
                </span>
                <span className="w-full truncate text-xs text-ash group-hover:text-bone">{firstName(name)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

interface EventPanelProps {
  season: string;
  episode: Episode;
  event: EpisodeEvent;
  members: GroupMember[] | null;
  onSealed: () => void;
  onNeedBet?: () => void;
  /** Sealed just now, on this device: its result stays face down until revealed. */
  onLocked: (type: EventType) => void;
}

function EventPanel({ season, episode, event, members, onSealed, onNeedBet, onLocked }: EventPanelProps) {
  const toast = useToast();
  const faceDown = useFaceDown(season);
  const [picks, setPicks] = useState<string[]>([]);
  const [forfeit, setForfeit] = useState(false);
  const [showVotes, setShowVotes] = useState(true);
  const picking = event.locked && !episode.closed;
  const hidden = !picking && faceDown.call(episode.ep, event.type);
  // Before the winner bet the table looks the same, but a tap asks for the bet.
  const waiting = episode.needsBet ? onNeedBet : undefined;
  const rows = consensusRows(event, Infinity);
  const shown = !picking && !hidden && event.type === "RT";
  const ballots = shown ? (event.result?.ballots ?? null) : null;
  const shields = shown ? (event.result?.shields ?? []) : [];
  const drawn = ballots && showVotes ? ballots : null;

  const submit = async () => {
    // Sealed before the request, so a poll landing in between can't turn the result over.
    sealCall(season, episode.ep, event.type);
    try {
      await submitPick(season, episode.ep, event.type, forfeit ? { forfeit: true } : { picks });
    } catch (e) {
      revealCall(season, episode.ep, event.type);
      if (e instanceof ApiError && (e.status === 409 || e.status === 403)) {
        toast(e.status === 409 ? "You already made this call on another device." : "This episode is closed.", "error");
        onSealed();
      } else {
        toast(`Your call didn't go through: ${errorText(e)}`, "error");
      }
      throw e;
    }
    onSealed();
    onLocked(event.type);
  };

  return (
    <>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <h2 className={cn(HEADING, "text-xl")}>{COPY[event.type].title}</h2>
          {ballots && (
            <button
              type="button"
              aria-pressed={showVotes}
              onClick={() => setShowVotes((v) => !v)}
              className={button(showVotes ? "primary" : "outline", "sm")}
            >
              Show the votes
            </button>
          )}
        </div>
        {picking && <p className="text-parchment">{COPY[event.type].prompt}</p>}
        {ballots && (
          <p className="text-sm text-ash">
            {showVotes
              ? "Chalk arrows run from each player to who they wrote on their slate."
              : "Chalk marks count everyone's calls."}
          </p>
        )}
      </div>
      <RoundTable
        roster={episode.roster}
        kind={event.type}
        season={season}
        chosen={picking ? (forfeit ? [] : picks) : (event.mine?.picks ?? [])}
        onTap={
          picking && waiting
            ? () => waiting()
            : picking && !forfeit
              ? (id) => setPicks((p) => toggle(p, id, event.picks))
              : undefined
        }
        actions={
          picking && (waiting || !forfeit)
            ? (p) => (
                <PickActions
                  type={event.type}
                  id={p.id}
                  picks={picks}
                  max={event.picks}
                  onPicks={waiting ? () => waiting() : setPicks}
                />
              )
            : undefined
        }
        full={event.picks > 1 && picks.length >= event.picks}
        result={picking || hidden ? null : event.result}
        tallies={
          picking || hidden
            ? null
            : drawn
              ? Object.fromEntries(votesByTarget(drawn).map((v) => [v.target, v.voters.length]))
              : Object.fromEntries(rows.map((r) => [r.id, r.count]))
        }
        tallyLabel={drawn ? (n) => `${n} ${n === 1 ? "vote" : "votes"}` : undefined}
        hrefOf={picking ? undefined : seasonPlayerHref(season)}
        ballots={drawn}
        shields={shields}
      />
      {picking && waiting ? (
        <Slate className="flex flex-col items-start gap-3">
          <p className={EYEBROW}>Your slate</p>
          <p className="text-parchment">Lock in your winners to start playing. Your calls open once they&apos;re sealed.</p>
          <Button variant="gold" onClick={waiting}>
            Lock in your winners
          </Button>
        </Slate>
      ) : picking ? (
        <PickSlate
          event={event}
          roster={episode.roster}
          picks={picks}
          forfeit={forfeit}
          onPicks={setPicks}
          onForfeit={setForfeit}
          onSeal={submit}
        />
      ) : hidden ? (
        <FaceDownCall season={season} event={event} roster={episode.roster} ep={episode.ep} />
      ) : (
        <>
          <Reveal season={season} event={event} roster={episode.roster} members={members} closed={episode.closed} />
          {ballots && <Votes season={season} ballots={ballots} shields={shields} roster={episode.roster} />}
        </>
      )}
    </>
  );
}

const ACTION: Record<Exclude<EventType, "RT">, string> = {
  MURDER: "Choose for the murder",
  RECRUIT: "Choose to recruit",
};

interface PickActionsProps {
  type: EventType;
  id: string;
  picks: string[];
  max: number;
  onPicks: (picks: string[]) => void;
}

/** The focus card's call on whoever is at the head: a rank on the slate, or the one pick. */
function PickActions({ type, id, picks, max, onPicks }: PickActionsProps) {
  if (type !== "RT") {
    const on = picks.includes(id);
    return (
      <button
        type="button"
        aria-pressed={on}
        onClick={() => onPicks(toggle(picks, id, max))}
        className={button(on ? "gold" : "primary", "sm")}
      >
        {ACTION[type]}
      </button>
    );
  }
  return (
    <span role="group" aria-label="Chalk on your slate" className="flex gap-2">
      {Array.from({ length: max }, (_, r) => (
        <button
          key={r}
          type="button"
          aria-pressed={picks[r] === id}
          disabled={!chalkable(picks, id, r, max)}
          onClick={() => onPicks(chalk(picks, id, r, max))}
          className={button(picks[r] === id ? "gold" : "primary", "sm")}
        >
          Chalk {roman(r + 1)}
        </button>
      ))}
    </span>
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
                <span aria-hidden="true" className="inline-flex">
                  <Headshot name={nameOf(id, roster)} image={playerOf(id, roster).headshot} size={32} round />
                </span>
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
              <span className="text-ash italic">{forfeit ? "No pick" : "Turn to a seat"}</span>
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

interface VotesProps {
  season: string;
  ballots: Record<string, string>;
  shields: string[];
  roster: Player[];
}

/** The slates as they were read out, gathered by who they named. */
function Votes({ season, ballots, shields, roster }: VotesProps) {
  const hrefOf = seasonPlayerHref(season);
  const link = (id: string) => <PlayerChip key={id} player={playerOf(id, roster)} href={hrefOf(id)} size={24} />;
  const list = (ids: string[]) => ids.flatMap((id, i) => (i > 0 ? [", ", link(id)] : [link(id)]));
  return (
    <Card as="section" aria-labelledby="votes-title" className="flex flex-col gap-3">
      <h3 id="votes-title" className={EYEBROW}>
        How the castle voted
      </h3>
      <ul className="flex flex-col gap-2">
        {votesByTarget(ballots).map(({ target, voters }) => (
          <li key={target} className="flex flex-col gap-1 border-b border-bone/10 pb-2 last:border-b-0 last:pb-0">
            <span className="flex items-center gap-3">
              <PlayerChip
                player={playerOf(target, roster)}
                href={hrefOf(target)}
                size={36}
                nameClassName="font-display font-semibold"
              />
              <Tally count={voters.length} />
              <span className="ml-auto text-sm text-ash">
                <span className="nums">{voters.length}</span> {voters.length === 1 ? "vote" : "votes"}
              </span>
            </span>
            <span className="text-parchment">from {list(voters)}</span>
          </li>
        ))}
      </ul>
      {shields.length > 0 && (
        <p className="flex items-center gap-2 border-t border-bone/10 pt-3 text-parchment">
          <ShieldMark className="h-5 w-4 shrink-0" />
          <span>Shielded tonight: {list(shields)}</span>
        </p>
      )}
    </Card>
  );
}

interface FaceDownCallProps {
  season: string;
  event: EpisodeEvent;
  roster: Player[];
  ep: number;
}

/** Your sealed call with what happened still face down, and the one button that turns it over. */
function FaceDownCall({ season, event, roster, ep }: FaceDownCallProps) {
  return (
    <Slate className="flex flex-col items-start gap-3">
      <p className={EYEBROW}>Your call · locked in</p>
      <MyCall season={season} event={event} roster={roster} />
      <p className="border-t border-bone/10 pt-3 text-parchment">
        What happened, everyone&apos;s calls and your points are face down until you choose to look.
      </p>
      <Button variant="gold" onClick={() => revealCall(season, ep, event.type)}>
        Reveal what happened
      </Button>
    </Slate>
  );
}

function MyCall({ season, event, roster }: { season: string; event: EpisodeEvent; roster: Player[] }) {
  const mine = event.mine;
  if (mine?.forfeit) return <p className="text-ash italic">No pick</p>;
  if (!mine?.picks) return null;
  return (
    <ol className="flex flex-wrap gap-x-5 gap-y-1">
      {mine.picks.map((id, i) => (
        <li key={id} className="flex items-center gap-2">
          {event.type === "RT" && <span className="font-display text-gilt">{roman(i + 1)}</span>}
          <Chalk>
            <PlayerChip player={playerOf(id, roster)} href={seasonPlayerHref(season)(id)} />
          </Chalk>
        </li>
      ))}
    </ol>
  );
}

interface RevealProps {
  season: string;
  event: EpisodeEvent;
  roster: Player[];
  members: GroupMember[] | null;
  closed: boolean;
}

function Reveal({ season, event, roster, members, closed }: RevealProps) {
  const points = eventPoints(event);
  const rows = consensusRows(event);
  const people = new Map((members ?? []).map((m) => [m.sub, m]));
  const mine = event.mine;

  return (
    <>
      <Slate className="flex flex-col gap-3">
        <p className={EYEBROW}>{mine ? "Your call" : "Result"}</p>
        <MyCall season={season} event={event} roster={roster} />
        {!mine && closed && <p className="text-ash">This episode aired before the season opened here: view only.</p>}
        <p
          className="flex flex-wrap items-baseline gap-x-2 border-t border-bone/10 pt-3 text-lg text-bone"
          aria-live="polite"
        >
          <span className="font-display text-xs tracking-[0.14em] text-ash uppercase">What happened</span>
          <Outcome event={event} roster={roster} season={season} />
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
                  <span className="nums text-bone">{Math.round(r.share * 100)}%</span> had{" "}
                  <PlayerChip player={playerOf(r.id, roster)} href={seasonPlayerHref(season)(r.id)} size={24} />
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
                      <Chalk className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-xl">
                        {g.picks.map((id) => (
                          <PlayerChip key={id} player={playerOf(id, roster)} href={seasonPlayerHref(season)(id)} size={24} />
                        ))}
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
