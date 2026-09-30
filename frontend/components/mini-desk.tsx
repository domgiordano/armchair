import Link from "next/link";

import { formatScore } from "@/components/performance-card";
import type { CoupleStanding, Reveal } from "@/lib/api/overview";
import { withSeason } from "@/lib/show/seasons";

interface MiniDeskProps {
  reveal: Reveal;
  couple: CoupleStanding | undefined;
  judgeName: (id: string) => string;
  weekLabel: string;
  season: string;
}

const firstWord = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/** One revealed dance as a row of paddles: the panel, then you, then how far apart. */
export function MiniDesk({ reveal, couple, judgeName, weekLabel, season }: MiniDeskProps) {
  const title = couple?.members.map((m) => m.name).join(" & ") ?? reveal.contestants.join(" & ");
  const mine = "value" in reveal.mine ? reveal.mine.value : null;
  const gap = mine !== null && reveal.panelMean !== null ? mine - reveal.panelMean : null;

  return (
    <article aria-label={title} className="flex flex-col gap-3 rounded-lg border border-silver/10 bg-ballroom/60 p-4">
      <header className="flex flex-col gap-0.5">
        <h3 className="truncate font-semibold text-pearl">{title}</h3>
        <p className="truncate text-xs text-silver-dim">
          {[weekLabel, reveal.style, reveal.song].filter(Boolean).join(" · ")}
        </p>
      </header>
      <ul aria-label="Paddles" className="flex items-end gap-1.5">
        {reveal.judges.map((j) => (
          <Paddle
            key={j.id}
            label={firstWord(judgeName(j.id))}
            spoken={judgeName(j.id)}
            value={j.value}
            dashed={j.state === "provisional"}
          />
        ))}
        <li aria-hidden="true" className="mx-1 h-10 w-px self-center bg-silver/15" />
        <Paddle label="You" spoken="You" value={mine} you />
      </ul>
      <div className="flex items-center justify-between gap-3 text-sm">
        <p className="text-silver-dim">
          {gap === null ? (
            "Judges not all confirmed yet"
          ) : gap === 0 ? (
            <span className="text-gold-light">Right on the judges&apos; average</span>
          ) : (
            <>
              <span className="font-semibold text-pearl tabular-nums">{formatScore(Math.abs(gap))}</span>{" "}
              {gap > 0 ? "above" : "below"} the judges ({formatScore(reveal.panelMean ?? 0)})
            </>
          )}
        </p>
        <Link
          href={withSeason(`/episode/?ep=${reveal.ep}`, season)}
          className="shrink-0 rounded-sm text-xs text-silver underline underline-offset-4 hover:text-pearl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light"
        >
          Scorecard<span className="sr-only">, {weekLabel}</span>
        </Link>
      </div>
    </article>
  );
}

interface PaddleProps {
  label: string;
  spoken: string;
  value: number | null;
  you?: boolean;
  dashed?: boolean;
}

function Paddle({ label, spoken, value, you = false, dashed = false }: PaddleProps) {
  return (
    <li className="flex w-12 flex-col items-center gap-1">
      <span className="sr-only">
        {spoken} {value === null ? "pending" : formatScore(value)}
        {dashed && ", unconfirmed"}
      </span>
      <span
        aria-hidden="true"
        className={`flex h-10 w-full items-center justify-center rounded-md border-2 text-lg font-bold tabular-nums ${
          value === null
            ? "border-neutral-700 bg-neutral-800 text-neutral-500"
            : you
              ? "border-gold-deep bg-gold text-ink"
              : "border-gold-deep/70 bg-pearl text-ink"
        } ${dashed ? "border-dashed" : ""}`}
      >
        {value === null ? "-" : formatScore(value)}
      </span>
      <span aria-hidden="true" className="w-full truncate text-center text-[11px] text-silver-dim">
        {label}
      </span>
    </li>
  );
}
