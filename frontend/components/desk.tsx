"use client";

import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";

import { initials } from "@/components/avatar";
import { headshotUrl } from "@/components/headshot";
import { formatScore } from "@/components/performance-card";
import { getMe, type Me } from "@/lib/api/client";
import type { Judge, RevealedCard } from "@/lib/api/show";

export interface DeskMember {
  name: string;
  picture: string | null;
  value: number;
}

interface DeskProps {
  card: RevealedCard;
  judges: Map<string, Judge>;
  /** A group's seats. Without them the desk shows one everyone-average seat. */
  members?: DeskMember[];
  /** The plain number list, kept under "Details". */
  children: ReactNode;
}

type Tone = "judge" | "you" | "crowd" | "member";

interface SeatModel {
  key: string;
  plate: string;
  spoken: string;
  face: { src: string | null; name: string } | "crowd";
  value: number | null;
  provisional: boolean;
  caption: string | null;
  tone: Tone;
}

// One /users/me per page load, shared by every card's desk.
let mePromise: Promise<Me> | null = null;

function useMe() {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    let live = true;
    mePromise ??= getMe();
    mePromise.then(
      (m) => live && setMe(m),
      // The seat falls back to "You" and initials; the next desk retries.
      () => {
        mePromise = null;
      },
    );
    return () => {
      live = false;
    };
  }, []);
  return me;
}

const firstWord = (name: string) => name.trim().split(/\s+/)[0] ?? name;

export function Desk({ card, judges, members, children }: DeskProps) {
  const me = useMe();
  const { mine, aggregate } = card;

  const panel: SeatModel[] = card.judges.map((j) => {
    const judge = judges.get(j.id);
    const name = judge?.name ?? j.id;
    const provisional = j.value !== null && j.state === "provisional";
    return {
      key: `judge-${j.id}`,
      plate: firstWord(name),
      spoken:
        j.value === null
          ? `${name} pending`
          : `${name} ${formatScore(j.value)}${provisional ? " unconfirmed" : ""}`,
      face: { src: judge?.headshot ? headshotUrl(judge.headshot.file) : null, name },
      value: j.value,
      provisional,
      caption: j.value === null ? "pending" : null,
      tone: "judge",
    };
  });

  const myValue = mine !== null && "value" in mine ? mine.value : null;
  const you: SeatModel = {
    key: "you",
    plate: me?.name ? firstWord(me.name) : "You",
    spoken: `you ${myValue === null ? (mine === null ? "not scored" : "revealed without scoring") : myValue}`,
    face: { src: me?.picture ?? null, name: me?.name ?? me?.email ?? "You" },
    value: myValue,
    provisional: false,
    caption: myValue === null ? (mine === null ? "no score" : "skipped") : null,
    tone: "you",
  };

  const scores = `${aggregate.count} ${aggregate.count === 1 ? "score" : "scores"}`;
  const crowd: SeatModel[] = members
    ? members.map((m, i) => ({
        key: `member-${i}`,
        plate: firstWord(m.name),
        spoken: `${m.name} ${m.value}`,
        face: { src: m.picture, name: m.name },
        value: m.value,
        provisional: false,
        caption: null,
        tone: "member",
      }))
    : [
        {
          key: "everyone",
          plate: "All",
          spoken: `everyone ${aggregate.mean === null ? "no scores yet" : `${formatScore(aggregate.mean)} from ${scores}`}`,
          face: "crowd",
          value: aggregate.mean,
          provisional: false,
          caption: scores,
          tone: "crowd",
        },
      ];

  const seats = [...panel, you, ...crowd];
  const cols = Math.min(seats.length, 6);
  const anyProvisional = panel.some((s) => s.provisional);

  return (
    <div className="flex flex-col gap-2">
      <div
        role="img"
        aria-label={`Judges' desk: ${seats.map((s) => s.spoken).join(", ")}`}
        className="mx-auto grid w-full overflow-hidden rounded-b-md"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, maxWidth: `${cols * 76}px` }}
      >
        {seats.map((s, i) => (
          <Seat key={s.key} seat={s} index={i} divider={s.tone === "you"} />
        ))}
      </div>
      {anyProvisional && (
        <p className="text-center text-xs text-silver-dim">Dashed paddles are unconfirmed.</p>
      )}
      <details className="group text-sm">
        <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 rounded-md pr-2 text-silver transition-colors hover:text-gold-light focus-ring [&::-webkit-details-marker]:hidden">
          <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4 transition-transform duration-200 group-open:rotate-90">
            <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Details
        </summary>
        <div className="rounded-lg border border-silver/10 bg-ink/40 p-3 group-open:animate-pop-in">{children}</div>
      </details>
    </div>
  );
}

interface SeatProps {
  seat: SeatModel;
  index: number;
  divider: boolean;
}

// Seat art is a 64x100 box whose bottom edge is the desk top. The paddle sits
// behind the body, so lowering it 62 units leaves a sliver past the shoulder.
function Seat({ seat, index, divider }: SeatProps) {
  const up = seat.value !== null;
  const you = seat.tone === "you";

  return (
    <div
      data-seat={seat.tone}
      data-state={!up ? "pending" : seat.provisional ? "provisional" : "confirmed"}
      className="flex min-w-0 flex-col"
    >
      <div className="relative">
        <svg viewBox="0 0 64 100" aria-hidden="true" className="block w-full">
          <g
            data-paddle={up ? "up" : "down"}
            className={up ? "motion-safe:animate-raise" : "[transform:translateY(62px)]"}
            style={up ? { animationDelay: `${index * 90}ms` } : undefined}
          >
            <rect x="39.5" y="37" width="5" height="60" rx="2.5" className={up ? "fill-lacquer" : "fill-silver/20"} />
            <rect x="38" y="34.5" width="8" height="4" rx="1.2" className={up ? "fill-gold" : "fill-silver/25"} />
            <rect
              x="24"
              y="3"
              width="36"
              height="33"
              rx="7"
              strokeWidth="2"
              strokeDasharray={seat.provisional ? "4 3" : undefined}
              className={
                !up
                  ? "fill-ballroom stroke-silver/25"
                  : you
                    ? "fill-gold stroke-gold-deep"
                    : seat.provisional
                      ? "fill-paddle-shade stroke-gold-deep"
                      : "fill-paddle stroke-gold-deep"
              }
            />
            {up && <rect x="27" y="5.5" width="30" height="8" rx="4" className="fill-paddle opacity-50" />}
            {up && (
              <text x="42" y="27" textAnchor="middle" className="fill-ink text-[18px] font-extrabold tabular-nums">
                {formatScore(seat.value ?? 0)}
              </text>
            )}
          </g>
          <path
            d="M4 100C4 87 13 81 26 81C39 81 48 87 48 100Z"
            className={you ? "fill-gold-deep" : seat.tone === "crowd" ? "fill-silver/15" : "fill-silver/25"}
          />
        </svg>
        <Face face={seat.face} muted={!up && seat.tone === "judge"} you={you} />
      </div>
      <div
        className={`flex flex-1 flex-col items-center border-t-2 border-gold/70 bg-gradient-to-b from-ballroom to-ink px-0.5 pt-1 pb-1.5 text-center ${divider ? "border-l border-l-gold/30" : ""}`}
      >
        <span className={`w-full truncate text-xs font-medium ${up ? "text-pearl" : "text-silver"}`}>
          {seat.plate}
        </span>
        <span className="min-h-4 w-full truncate text-[10px] leading-4 text-silver-dim">{seat.caption}</span>
      </div>
    </div>
  );
}

interface FaceProps {
  face: SeatModel["face"];
  muted: boolean;
  you: boolean;
}

// Head: a 32-unit circle centred at (26, 66) in the seat art, placed as HTML so
// photos keep referrerPolicy and the initials fallback.
function Face({ face, muted, you }: FaceProps) {
  const [failed, setFailed] = useState<string | null>(null);
  const ring = you ? "ring-2 ring-gold" : "ring-2 ring-ink";
  const box = `absolute top-1/2 left-[15.6%] aspect-square w-1/2 overflow-hidden rounded-full ${ring} ${muted ? "opacity-60 grayscale" : ""}`;

  if (face === "crowd") {
    return (
      <span className={`${box} flex items-center justify-center bg-ballroom text-silver`}>
        <svg viewBox="0 0 24 24" aria-hidden="true" className="w-3/4">
          <circle cx="9" cy="9" r="3.2" fill="currentColor" />
          <circle cx="16.5" cy="10" r="2.6" fill="currentColor" opacity="0.7" />
          <path d="M3 20c0-3.6 2.7-6 6-6s6 2.4 6 6Z" fill="currentColor" />
          <path d="M15 20c0-2.2-.6-4-1.7-5.1a5 5 0 0 1 3.2-1c2.6 0 4.5 2 4.5 6.1Z" fill="currentColor" opacity="0.7" />
        </svg>
      </span>
    );
  }

  if (face.src && failed !== face.src) {
    const src = face.src;
    return (
      <span className={`${box} bg-ballroom`}>
        <Image
          src={src}
          alt=""
          fill
          sizes="32px"
          unoptimized
          referrerPolicy="no-referrer"
          onError={() => setFailed(src)}
          className="object-cover"
        />
      </span>
    );
  }

  return (
    <span
      className={`${box} flex items-center justify-center text-[11px] font-semibold ${you ? "bg-gold text-ink" : "bg-silver/25 text-pearl"}`}
    >
      {initials(face.name, "")}
    </span>
  );
}
