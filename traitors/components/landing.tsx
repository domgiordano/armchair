"use client";

import { type ReactNode, useCallback, useState, useSyncExternalStore } from "react";

import { GoogleMark } from "@/components/google-mark";
import { Intro } from "@/components/intro";
import { Blind } from "@/components/landing/blind";
import { Calls } from "@/components/landing/calls";
import { Faq } from "@/components/landing/faq";
import { Friends } from "@/components/landing/friends";
import { Ledger } from "@/components/landing/ledger";
import { Night } from "@/components/landing/night";
import { Reveal } from "@/components/landing/reveal";
import { TableScene } from "@/components/landing/table-scene";
import { EmberGlow } from "@/components/ui/ember-glow";
import { Seal } from "@/components/ui/wax-seal";
import { BUTTON } from "@/lib/ui";
import { rememberReturn } from "@armchair/app-core/auth/return-to";
import { useAuth } from "@armchair/app-core/auth/use-auth";

import styles from "./landing/landing.module.css";

const LINK =
  "focus-ring inline-flex min-h-11 items-center justify-center rounded-sm px-2 font-display text-sm font-semibold tracking-[0.12em] text-parchment uppercase underline decoration-gilt/60 underline-offset-8 transition-colors hover:text-candle hover:decoration-candle active:text-flame motion-reduce:transition-none";

const EYEBROW = "font-display text-xs font-semibold tracking-[0.24em] text-candle uppercase";
const H2 = "mt-3 max-w-2xl font-display text-3xl leading-tight font-bold text-bone sm:text-4xl";

const EDITIONS = [
  {
    flag: "US",
    name: "The Traitors US",
    body: "The American series, hosted in tartan and capes. Every season, from the first to the one airing now.",
  },
  {
    flag: "UK",
    name: "The Traitors UK",
    body: "The British series and the celebrity one, each with its own seasons, picks and leaderboards.",
  },
];

const reducedQuery = () => window.matchMedia?.("(prefers-reduced-motion: reduce)");
const subscribeReduced = (onChange: () => void) => {
  const m = reducedQuery();
  m?.addEventListener("change", onChange);
  return () => m?.removeEventListener("change", onChange);
};

interface SectionProps {
  id: string;
  eyebrow: string;
  title: ReactNode;
  children: ReactNode;
}

function Section({ id, eyebrow, title, children }: SectionProps) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="mx-auto max-w-6xl scroll-mt-6 px-5 py-20 sm:px-8 lg:py-28">
      <Reveal>
        <p className={EYEBROW}>{eyebrow}</p>
        <h2 id={`${id}-title`} className={H2}>
          {title}
        </h2>
      </Reveal>
      {children}
    </section>
  );
}

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
      rememberReturn();
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
    <div className="relative flex min-h-dvh flex-col overflow-clip">
      <EmberGlow />
      <div aria-hidden="true" className={`${styles.tartan} h-4`} />

      <main className="flex-1">
        <section className={`${styles.hearth} border-b border-gilt/25`}>
          <div className="mx-auto grid max-w-6xl gap-14 px-5 pt-12 pb-20 sm:px-8 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:pt-20 lg:pb-28">
            <div className={`${styles.heroCopy} flex flex-col gap-6`}>
              <p className={`${styles.title} font-title text-5xl leading-none font-black sm:text-6xl`}>Traitors</p>
              <p className={EYEBROW}>Armchair Judge · for the US and UK shows</p>
              <h1 className="font-display text-4xl leading-[1.08] font-bold text-bone sm:text-5xl">
                <span className="block">Trust no one.</span>
                <span className="block text-flame">Call it first.</span>
              </h1>
              <p className="max-w-xl text-lg leading-relaxed">
                Every episode, rank the round table&rsquo;s top three in the order you think the votes fall, then name who gets
                murdered in the night and who gets recruited. Back your season winners before it gets away from you. Everyone&rsquo;s
                calls stay hidden until you&rsquo;ve made yours, and once made, yours are final. Every call that lands scores
                points, on a leaderboard against your friends.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
                {signIn}
                <a href="#night" className={LINK}>
                  How it plays
                </a>
              </div>
              <div aria-live="polite" className="min-h-6 text-ash">
                {status === "unconfigured" && "Sign-in is not configured in this build."}
                {error && "Could not start sign-in. Try again."}
              </div>
            </div>
            <div className={styles.heroArt}>
              <TableScene />
            </div>
          </div>
        </section>

        <Section id="night" eyebrow="How a night works" title="Four beats an episode. Three of them are yours to call.">
          <Night />
        </Section>

        <div aria-hidden="true" className={`${styles.tartan} h-3`} />

        <Section id="calls" eyebrow="Your calls" title="Chalk it, seal it, and wait for the castle to prove you right.">
          <Calls />
        </Section>

        <section id="points" aria-labelledby="points-title" className={`${styles.ledgerBand} scroll-mt-6 border-y border-gilt/25`}>
          <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_1.2fr] lg:py-28">
            <Reveal className="flex flex-col gap-4">
              <p className={EYEBROW}>The ledger</p>
              <h2 id="points-title" className="font-display text-3xl leading-tight font-bold text-bone sm:text-4xl">
                How the points work
              </h2>
              <p className="max-w-md leading-relaxed">
                The round table pays most for the banishment itself. Murders and recruits pay the same. The big money is a season
                winner called early, and more again if you&rsquo;ve read their faction right.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">{signIn}</div>
            </Reveal>
            <Reveal delay={120}>
              <Ledger />
            </Reveal>
          </div>
        </section>

        <section aria-labelledby="blind-title" className="mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_1.2fr] lg:items-center lg:py-28">
          <Reveal className="flex flex-col gap-4">
            <p className={EYEBROW}>Blind until you call it</p>
            <h2 id="blind-title" className="font-display text-3xl leading-tight font-bold text-bone sm:text-4xl">
              Nobody&rsquo;s calls, and no results, until yours are in.
            </h2>
            <p className="max-w-md leading-relaxed">
              Your friends&rsquo; picks lie sealed. Make yours and stamp it, and theirs turn over, along with what actually happened.
              No peeking, no changing your mind: like the slate, once it&rsquo;s shown, it&rsquo;s shown.
            </p>
          </Reveal>
          <Blind />
        </section>

        <section aria-labelledby="friends-title" className="border-t border-gilt/15">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:py-28">
            <div className="order-2 lg:order-1">
              <Friends />
            </div>
            <Reveal className="order-1 flex flex-col gap-4 lg:order-2">
              <p className={EYEBROW}>Play your friends</p>
              <h2 id="friends-title" className="font-display text-3xl leading-tight font-bold text-bone sm:text-4xl">
                A round table of your own.
              </h2>
              <p className="max-w-md leading-relaxed">
                Start a group, send the link, and everyone plays the same season. There&rsquo;s a board for your group, one for your
                friends and one for everybody, season by season and all time.
              </p>
            </Reveal>
          </div>
        </section>

        <Section id="editions" eyebrow="Both sides of the Atlantic" title="The US and UK shows, in one castle.">
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {EDITIONS.map((e, i) => (
              <Reveal key={e.flag} delay={i * 120}>
                <div className="gilt-frame flex h-full gap-5 rounded-sm bg-stone/80 p-6">
                  <span aria-hidden="true" className={styles.edition}>
                    {e.flag}
                  </span>
                  <div className="flex flex-col gap-2">
                    <h3 className="font-display text-xl font-semibold text-bone">{e.name}</h3>
                    <p className="leading-relaxed">{e.body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal>
            <p className="mt-6 max-w-2xl leading-relaxed text-ash">
              Both are filmed at the same Highland castle. Switch editions from the menu; each season keeps its own calls.
            </p>
          </Reveal>
        </Section>

        <Section id="faq" eyebrow="Before you sit down" title="Questions at the table">
          <Faq />
        </Section>

        <section aria-labelledby="final-title" className={`${styles.finale} border-t border-gilt/25`}>
          <Reveal className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-5 py-24 text-center sm:px-8 lg:py-32">
            <Seal className="size-24 -rotate-12 drop-shadow-[0_10px_16px_rgb(0_0_0/0.6)]" />
            <h2 id="final-title" className="font-display text-3xl leading-tight font-bold text-bone sm:text-4xl">
              The castle doors are open. Take your seat.
            </h2>
            <p className="max-w-xl text-lg leading-relaxed">Sign in, back your winners, and make the first call before the next round table.</p>
            {signIn}
          </Reveal>
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
