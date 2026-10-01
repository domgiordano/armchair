import type { ReactNode } from "react";

import { AccuracyArt, BlindArt, GroupArt, RevealArt, SeasonsArt, VoteArt } from "@/components/feature-art";
import { reveal } from "@/lib/reveal";

interface Feature {
  title: string;
  body: string;
  art: ReactNode;
  live: boolean;
  /** Grid span on large screens; wide cards put the art beside the text. */
  span: "one" | "two" | "row";
}

const FEATURES: Feature[] = [
  {
    title: "Blind, final scoring",
    body: "Hold up a paddle from 1 to 10 for every performance. Nobody else's number shows until yours is in, and once it's in, it stays. No peeking, no second thoughts.",
    art: <BlindArt />,
    live: true,
    span: "two",
  },
  {
    title: "The reveal desk",
    body: "The moment your paddle is up, that dance turns over: each judge, your group, and the whole room's average, next to yours.",
    art: <RevealArt />,
    live: true,
    span: "one",
  },
  {
    title: "Accuracy and leaderboards",
    body: "Every score is measured against the judges' average, so you can watch your gap shrink week by week. Leaderboards for friends, groups and everyone are next.",
    art: <AccuracyArt />,
    live: true,
    span: "one",
  },
  {
    title: "Groups that follow you",
    body: "Start a group, share the invite link, and filter any reveal down to just them. Groups belong to your Armchair Judge account, so the same crew is there for every show.",
    art: <GroupArt />,
    live: true,
    span: "one",
  },
  {
    title: "Vote reminders",
    body: "While the live East Coast broadcast runs, the episode screen puts the show's text-vote number in front of you and keeps count of your votes per couple.",
    art: <VoteArt />,
    live: true,
    span: "one",
  },
  {
    title: "Every past season",
    body: "Dancing with the Stars back to season 1: cast, dances and the panel's scores. Score any of it after the fact; the blind rule still holds, so you see the judges only once you've committed.",
    art: <SeasonsArt />,
    live: false,
    span: "row",
  },
];

const SPAN = {
  one: "",
  two: "lg:col-span-2 lg:grid-cols-[1.1fr_1fr]",
  row: "sm:col-span-2 lg:col-span-3 lg:grid-cols-[1.4fr_1fr]",
};

function Status({ live }: { live: boolean }) {
  return live ? (
    <span className="self-start rounded-full bg-magenta/15 px-2.5 py-1 text-[10px] font-bold tracking-[0.15em] text-magenta">LIVE</span>
  ) : (
    <span className="self-start rounded-full border border-line px-2.5 py-1 text-[10px] font-bold tracking-[0.15em] text-muted">COMING SOON</span>
  );
}

export function Features() {
  return (
    <section id="features" aria-labelledby="features-title" className="scroll-mt-20 border-t border-line py-16 lg:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr] lg:items-end" {...reveal()}>
          <div>
            <p className="text-xs font-semibold tracking-[0.3em] text-blue uppercase">What you get</p>
            <h2 id="features-title" className="mt-3 text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
              A judge&rsquo;s desk <span className="text-brand-gradient">in your pocket.</span>
            </h2>
          </div>
          <p className="max-w-lg text-muted lg:justify-self-end">
            Everything below runs in the Dancing with the Stars app today, except where it says otherwise. The screens
            are illustrations with invented names and scores.
          </p>
        </div>
        <ul className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <li
              key={f.title}
              className={`grid grid-cols-1 overflow-hidden rounded-3xl border border-line bg-night-2/60 transition hover:-translate-y-1 hover:border-muted/40 hover:shadow-2xl hover:shadow-violet/10 motion-reduce:transition-none ${SPAN[f.span]}`}
              {...reveal((i % 3) + 1)}
            >
              <div
                className={`h-44 border-b border-line bg-[radial-gradient(80%_90%_at_50%_0%,rgb(122_44_255/0.18),transparent)] ${
                  f.span === "one" ? "" : "lg:order-last lg:h-auto lg:border-b-0 lg:border-l"
                }`}
                aria-hidden="true"
              >
                {f.art}
              </div>
              <div className="flex flex-col p-6">
                <Status live={f.live} />
                <h3 className="mt-3 text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
