"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

import { GoogleMark } from "@/components/google-mark";
import { Intro } from "@/components/intro";
import { Ledger } from "@/components/landing/ledger";
import { Slate } from "@/components/landing/slate";
import { BUTTON } from "@/lib/ui";
import { useAuth } from "@armchair/app-core/auth/use-auth";

import styles from "./landing/landing.module.css";

const LINK =
  "focus-ring inline-flex min-h-11 items-center justify-center rounded-sm px-2 font-display text-sm font-semibold tracking-[0.12em] text-parchment uppercase underline decoration-gilt/60 underline-offset-8 transition-colors hover:text-candle hover:decoration-candle active:text-flame motion-reduce:transition-none";

const STEPS = [
  {
    numeral: "I",
    title: "The round table",
    body: "Rank the three players you think draw the most votes. Your first pick is who you think gets banished.",
  },
  {
    numeral: "II",
    title: "The night",
    body: "Name who the Traitors murder. Smell a recruitment? Name the recruit too. It's optional, and if nobody is recruited it simply doesn't count.",
  },
  {
    numeral: "III",
    title: "The endgame",
    body: "Back one or two winners, and say whether each wins as a Faithful or a Traitor. Lock in before the premiere for full points; every episode that airs first shrinks them.",
  },
];

const reducedQuery = () => window.matchMedia?.("(prefers-reduced-motion: reduce)");
const subscribeReduced = (onChange: () => void) => {
  const m = reducedQuery();
  m?.addEventListener("change", onChange);
  return () => m?.removeEventListener("change", onChange);
};

/** The signed-out front door: the procession on every visit, then the pitch. */
export function Landing() {
  const { status, signInWithGoogle } = useAuth();
  // False on the server, so the static HTML opens on the intro's load-in.
  const reduced = useSyncExternalStore(subscribeReduced, () => reducedQuery()?.matches ?? false, () => false);
  const [done, setDone] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState(false);

  const finishIntro = useCallback(() => setDone(true), []);

  if (!done && !reduced) return <Intro onDone={finishIntro} />;

  const start = async () => {
    setRedirecting(true);
    setError(false);
    try {
      await signInWithGoogle();
    } catch {
      setRedirecting(false);
      setError(true);
    }
  };
  const disabled = status !== "signedOut" || redirecting;

  const signIn = (
    <button type="button" onClick={() => void start()} disabled={disabled} className={`${BUTTON} ${styles.cta}`}>
      <GoogleMark />
      {redirecting ? "Opening Google..." : "Sign in with Google"}
    </button>
  );

  return (
    <div className="flex min-h-dvh flex-col overflow-clip">
      <div aria-hidden="true" className={`${styles.tartan} h-4`} />

      <main className="flex-1">
        <section className={`${styles.hearth} border-b border-gilt/25`}>
          <div className="mx-auto grid max-w-6xl gap-14 px-5 pt-12 pb-20 sm:px-8 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:pt-20 lg:pb-28">
            <div className="flex flex-col gap-6">
              <p className={`${styles.title} font-title text-5xl leading-none font-black sm:text-6xl`}>Traitors</p>
              <p className="font-display text-xs font-semibold tracking-[0.24em] text-candle uppercase">
                Armchair Judge · for the US and UK shows
              </p>
              <h1 className="font-display text-4xl leading-[1.08] font-bold text-bone sm:text-5xl">
                <span className="block">Trust no one.</span>
                <span className="block text-flame">Call it first.</span>
              </h1>
              <p className="max-w-xl text-lg leading-relaxed">
                Every episode, rank the round table&rsquo;s top three in the order you think the votes fall, then name
                who gets murdered in the night and who gets recruited. Before the season gets away from you, lock in up
                to two winners. Everyone&rsquo;s picks stay hidden until you&rsquo;ve made yours, and once made, yours are
                final. Every call that lands scores points, on a leaderboard against your friends.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
                {signIn}
                <a href="#points" className={LINK}>
                  How the points work
                </a>
              </div>
              <div aria-live="polite" className="min-h-6 text-ash">
                {status === "unconfigured" && "Sign-in is not configured in this build."}
                {error && "Could not start sign-in. Try again."}
              </div>
            </div>
            <Slate />
          </div>
        </section>

        <section aria-labelledby="how" className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
          <p className="font-display text-xs font-semibold tracking-[0.24em] text-candle uppercase">How a night plays</p>
          <h2 id="how" className="mt-3 max-w-2xl font-display text-3xl leading-tight font-bold text-bone sm:text-4xl">
            Three calls an episode, and one for the whole season.
          </h2>
          <ol className="mt-12 flex flex-col">
            {STEPS.map((s) => (
              <li key={s.numeral} className="grid grid-cols-[4rem_1fr] gap-x-5 border-t border-bone/10 py-8 sm:grid-cols-[6rem_1fr]">
                <span aria-hidden="true" className={`${styles.numeral} text-4xl leading-none sm:text-5xl`}>
                  {s.numeral}
                </span>
                <div className="flex max-w-2xl flex-col gap-2">
                  <h3 className="font-display text-xl font-semibold text-bone">{s.title}</h3>
                  <p className="leading-relaxed">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-4 max-w-2xl border-l-2 border-blood-hi pl-4 text-lg leading-relaxed text-bone italic">
            Blind, then final. You see nobody&rsquo;s picks, and no result, until your own are in. Then they&rsquo;re
            sealed.
          </p>
        </section>

        <div aria-hidden="true" className={`${styles.tartan} h-3`} />

        <section id="points" aria-labelledby="points-title" className="scroll-mt-6">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_1.2fr] lg:py-28">
            <div className="flex flex-col gap-4">
              <p className="font-display text-xs font-semibold tracking-[0.24em] text-candle uppercase">The ledger</p>
              <h2 id="points-title" className="font-display text-3xl leading-tight font-bold text-bone sm:text-4xl">
                How the points work
              </h2>
              <p className="max-w-md leading-relaxed">
                The round table pays most for the banishment itself. Murders and recruits pay the same. The big money
                is a season winner called early, and more again if you&rsquo;ve read their faction right.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">{signIn}</div>
            </div>
            <Ledger />
          </div>
        </section>
      </main>

      <footer className="border-t border-gilt/25">
        <div aria-hidden="true" className={`${styles.tartan} h-3`} />
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-6 text-sm text-ash sm:flex-row sm:justify-between sm:px-8">
          <p className="font-display tracking-[0.14em] uppercase">Armchair Judge</p>
          <p>Not affiliated with The Traitors, BBC, NBC or Peacock.</p>
        </div>
      </footer>
    </div>
  );
}
