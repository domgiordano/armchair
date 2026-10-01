"use client";

import { Desk, type DeskMember } from "@/components/desk";
import { CoupleAvatars, Headshot } from "@/components/headshot";
import type { GroupMember } from "@/lib/api/groups";
import type { Answer, Card, Contestant, Judge, LockedCard, Member, RevealedCard } from "@/lib/api/show";
import { PaddlePicker } from "@/components/paddle-picker";

interface PerformanceCardProps {
  card: Card;
  contestants: Map<string, Contestant>;
  judges: Map<string, Judge>;
  airsOn: string | null;
  /** The filtering group's members, or null for everyone. */
  members: GroupMember[] | null;
  onSubmit: (card: LockedCard, answer: Answer) => Promise<void>;
}

const celebrity = (c: Contestant | undefined): Member | undefined =>
  c?.members.find((m) => m.role === "celebrity");

/** 8, 7.5, 7.3: judges score in halves and averages need one decimal. */
export const formatScore = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

// `others` never holds the caller, who has their own seat. A member who hasn't
// scored this dance, or revealed it without scoring, gets no seat.
function memberSeats(card: RevealedCard, members: GroupMember[]): DeskMember[] {
  const values = new Map(card.others.map((o) => [o.sub, o.value]));
  return members.flatMap((m) => {
    const value = values.get(m.sub);
    return value === undefined ? [] : [{ sub: m.sub, name: m.name ?? "Member", picture: m.picture, value }];
  });
}

export function PerformanceCard({ card, contestants, judges, airsOn, members, onSubmit }: PerformanceCardProps) {
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
      className="flex h-full flex-col gap-4 rounded-xl border border-silver/10 bg-ballroom/45 p-4 shadow-[inset_0_1px_0_rgb(213_219_234/0.05)] transition-colors hover:border-silver/20"
    >
      <div className="flex items-center gap-3">
        {team ? (
          <div className="flex -space-x-3">
            {faces.map((m) => (
              <Headshot key={m.name} person={m} />
            ))}
          </div>
        ) : (
          <CoupleAvatars members={faces} size={48} />
        )}
        <div className="flex min-w-0 flex-col">
          <h3 id={headingId} className="leading-tight font-semibold text-pearl">
            {title}
          </h3>
          {details.length > 0 && <p className="text-sm text-silver-dim">{details.join(" · ")}</p>}
        </div>
      </div>
      {!card.locked ? (
        <Desk card={card} judges={judges} members={members ? memberSeats(card, members) : undefined}>
          <Scores card={card} judges={judges} />
        </Desk>
      ) : (
        <PaddlePicker label={title} airsOn={airsOn} onSubmit={(answer) => onSubmit(card, answer)} />
      )}
    </article>
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
  muted?: boolean;
  strong?: boolean;
}

function Row({ label, value, note, muted, strong }: RowProps) {
  return (
    <>
      <dt className={strong ? "font-medium text-pearl" : "text-silver-dim"}>{label}</dt>
      <dd className={`text-right tabular-nums ${muted ? "text-silver-dim/70" : strong ? "font-semibold text-pearl" : "text-silver"}`}>
        {value}
        {note && <span className="ml-2 text-xs font-normal text-silver-dim">{note}</span>}
      </dd>
    </>
  );
}
