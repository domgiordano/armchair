"use client";

import { CoupleLink, CoupleNames, PersonLink } from "@/components/couple-names";
import { Desk } from "@/components/desk";
import { GroupCarousel, type GroupScore } from "@/components/group-carousel";
import { EliminatedStamp } from "@/components/eliminated";
import { Headshot } from "@/components/headshot";
import { Badge } from "@/components/ui/badge";
import type { Elimination } from "@/lib/api/couples";
import { personSlug } from "@/lib/show/people";
import type { GroupMember } from "@armchair/app-core/api/groups";
import type { Answer, Card, Contestant, Judge, LockedCard, Member, RevealedCard } from "@/lib/api/show";
import { Paddle as PaddleArt } from "@/components/paddle";
import { PaddlePicker } from "@/components/paddle-picker";
import { button } from "@/lib/ui";
import { WhatHappened } from "@/components/what-happened";

interface PerformanceCardProps {
  card: Card;
  season: string;
  contestants: Map<string, Contestant>;
  judges: Map<string, Judge>;
  airsOn: string | null;
  /** The filtering group, or null for everyone. */
  group: { name: string; members: GroupMember[] } | null;
  onSubmit: (card: LockedCard, answer: Answer) => Promise<void>;
  /** The couple went home this episode, and the caller may know it. */
  out?: Elimination;
  /** Locked in here but not revealed yet: the judges stay face down. */
  sealed?: boolean;
  onReveal?: () => void;
  /** Its window closed before you scored it. */
  missed?: boolean;
}

const celebrity = (c: Contestant | undefined): Member | undefined =>
  c?.members.find((m) => m.role === "celebrity");

/** 8, 7.5, 7.3: judges score in halves and averages need one decimal. */
export const formatScore = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

// `others` never holds the caller. A member who hasn't scored this dance, or
// revealed it without scoring, isn't in it.
function groupScores(card: RevealedCard, members: GroupMember[]): GroupScore[] {
  const values = new Map(card.others.map((o) => [o.sub, o.value]));
  return members.flatMap((m) => {
    const value = values.get(m.sub);
    return value === undefined ? [] : [{ sub: m.sub, name: m.name ?? "Member", picture: m.picture, value }];
  });
}

function panelMean(card: RevealedCard): number | null {
  const values = card.judges.map((j) => j.value);
  return values.length > 0 && values.every((v) => v !== null) ? values.reduce<number>((a, v) => a + (v ?? 0), 0) / values.length : null;
}

export function PerformanceCard({
  card,
  season,
  contestants,
  judges,
  airsOn,
  group,
  onSubmit,
  out,
  sealed = false,
  onReveal,
  missed = false,
}: PerformanceCardProps) {
  const team = card.contestants.length > 1;
  const couple = contestants.get(card.contestants[0]);
  const faces = team
    ? card.contestants.map((id) => celebrity(contestants.get(id))).filter((m) => m !== undefined)
    : (couple?.members ?? []);
  const title = team
    ? faces.map((m) => m.name).join(", ")
    : (couple?.members.map((m) => m.name).join(" & ") ?? card.contestants[0]);
  const details = [
    team ? "Team dance" : card.n > 1 ? `Dance ${card.n}` : null,
    card.style,
    card.song && `"${card.song}"`,
  ].filter(Boolean);
  const headingId = `perf-${card.key}`;

  return (
    <article
      aria-labelledby={headingId}
      className="relative flex h-full flex-col gap-4 rounded-xl border border-silver/10 bg-ballroom/45 p-4 shadow-[inset_0_1px_0_rgb(213_219_234/0.05)] transition-colors hover:border-silver/20"
    >
      {out && <EliminatedStamp out={out} className="absolute right-5 bottom-5 z-10" />}
      <div className="flex items-center gap-3">
        {team ? (
          <div className="flex -space-x-3">
            {faces.map((m) => (
              <Headshot key={m.name} person={m} />
            ))}
          </div>
        ) : (
          <CoupleLink members={faces} season={season} size={48} />
        )}
        <div className="flex min-w-0 flex-col">
          <h3 id={headingId} className="leading-tight font-semibold text-pearl">
            {team ? (
              faces.map((m, i) => (
                <span key={m.name}>
                  {i > 0 && ", "}
                  <PersonLink id={personSlug(m.name)} name={m.name} />
                </span>
              ))
            ) : couple ? (
              <CoupleNames members={couple.members} />
            ) : (
              title
            )}
          </h3>
          {details.length > 0 && <p className="text-sm text-silver-dim">{details.join(" · ")}</p>}
        </div>
        {missed && (
          <Badge tone="muted" className="ml-auto self-start">
            Missed
          </Badge>
        )}
      </div>
      {!card.locked && sealed ? (
        <Sealed card={card} onReveal={onReveal} />
      ) : !card.locked ? (
        <Desk card={card} judges={judges}>
          <Scores card={card} judges={judges} />
        </Desk>
      ) : (
        <PaddlePicker label={title} airsOn={airsOn} onSubmit={(answer) => onSubmit(card, answer)} />
      )}
      {!card.locked && group && (
        // Others' paddles once yours is locked; their gap to the judges only once you've looked.
        <GroupCarousel group={group.name} scores={groupScores(card, group.members)} panelMean={sealed ? null : panelMean(card)} />
      )}
      {!sealed && <WhatHappened writeup={card.writeup} judges={[...judges.values()]} />}
    </article>
  );
}

/** Your paddle up, the panel's face down, and the one button that turns them over. */
function Sealed({ card, onReveal }: { card: RevealedCard; onReveal?: () => void }) {
  const mine = card.mine !== null && "value" in card.mine ? card.mine.value : null;
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-gold/25 bg-ink/40 px-3 py-4 animate-fade-in">
      <div className="flex items-end gap-2" aria-hidden="true">
        {card.judges.map((j) => (
          <PaddleArt key={j.id} face="?" tone="pending" size="sm" className="w-10" />
        ))}
        <span className="mx-1 h-10 w-px self-start bg-gold/25" />
        <PaddleArt face={mine === null ? "-" : String(mine)} tone="you" size="sm" className="w-10" />
      </div>
      <p className="text-center text-sm text-silver-dim">
        {mine === null ? "Locked in." : `Locked in at ${mine}.`} The judges stay face down until you look.
      </p>
      <button type="button" onClick={onReveal} className={button("primary", "sm")}>
        Reveal judges&apos; scores
      </button>
    </div>
  );
}

interface ScoresProps {
  card: RevealedCard;
  judges: Map<string, Judge>;
}

function Scores({ card, judges }: ScoresProps) {
  const values = card.judges.map((j) => j.value);
  const allIn = values.every((v) => v !== null);
  const judgesMean = allIn ? values.reduce<number>((a, v) => a + (v ?? 0), 0) / values.length : null;
  const { mine, aggregate } = card;

  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
      {card.judges.map((j) => (
        <Row
          key={j.id}
          label={judges.get(j.id)?.name ?? j.id}
          value={j.value === null ? "Pending" : formatScore(j.value)}
          tag={judges.get(j.id)?.guest ? "Guest" : null}
          note={j.state === "provisional" ? "unconfirmed" : null}
          muted={j.value === null}
        />
      ))}
      <Row label="Judges' average" value={judgesMean === null ? "Pending" : formatScore(judgesMean)} strong />
      <Row
        label="You"
        value={
          mine === null ? "Not scored" : "forfeit" in mine ? "Revealed" : formatScore(mine.value)
        }
        strong
      />
      <Row
        label="Everyone"
        value={aggregate.mean === null ? "No scores yet" : formatScore(aggregate.mean)}
        note={`${aggregate.count} ${aggregate.count === 1 ? "score" : "scores"}`}
        strong
      />
    </dl>
  );
}

interface RowProps {
  label: string;
  value: string;
  note?: string | null;
  /** A badge after the label: a guest judge's. */
  tag?: string | null;
  muted?: boolean;
  strong?: boolean;
}

function Row({ label, value, note, tag, muted, strong }: RowProps) {
  return (
    <>
      <dt className={strong ? "font-medium text-pearl" : "text-silver-dim"}>
        {label}
        {tag && (
          <Badge tone="magenta" className="ml-2 align-middle">
            {tag}
          </Badge>
        )}
      </dt>
      <dd className={`text-right tabular-nums ${muted ? "text-silver-dim/70" : strong ? "font-semibold text-pearl" : "text-silver"}`}>
        {value}
        {note && <span className="ml-2 text-xs font-normal text-silver-dim">{note}</span>}
      </dd>
    </>
  );
}
