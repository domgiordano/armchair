"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import { Brand } from "@/components/brand";
import { Intro } from "@/components/intro";
import { LandingDesk } from "@/components/landing-desk";
import { LandingSteps } from "@/components/landing-steps";
import { useReducedMotion } from "@/lib/motion";

const BUTTON =
  "flex min-h-11 items-center justify-center gap-2 rounded-md px-5 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light disabled:cursor-not-allowed disabled:opacity-50";
const GOLD = `${BUTTON} bg-gold text-ink hover:bg-gold-light active:bg-gold-deep`;
// Archivo Black ships one weight; font-bold here would get a synthesized, smeared bold.
const DISPLAY = "font-display font-normal tracking-[-0.045em] text-pearl";
const OUTLINE = `${BUTTON} border border-silver/35 text-silver hover:bg-silver/10 active:bg-silver/15`;

interface LandingProps {
  status: "signedOut" | "unconfigured";
  onSignIn: () => Promise<void>;
}

/** The signed-out front door: the ballroom intro on every visit, then the pitch. */
export function Landing({ status, onSignIn }: LandingProps) {
  const reduced = useReducedMotion();
  const [done, setDone] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState(false);

  const finishIntro = useCallback(() => setDone(true), []);

  if (!done && !reduced) return <Intro onDone={finishIntro} />;

  const start = async () => {
    setRedirecting(true);
    setError(false);
    try {
      await onSignIn();
    } catch {
      setRedirecting(false);
      setError(true);
    }
  };

  // Only the hero button reports the redirect; the header one just disables.
  const signIn = (label: string, className: string, busy: boolean) => (
    <button
      type="button"
      onClick={() => void start()}
      disabled={status !== "signedOut" || redirecting}
      className={className}
    >
      {busy && redirecting ? "Opening Google..." : label}
    </button>
  );

  return (
    <div className="relative isolate min-h-dvh overflow-hidden text-silver">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 -z-10 h-[900px] bg-[radial-gradient(ellipse_60%_50%_at_75%_10%,rgb(232_194_104/0.16),transparent_70%),radial-gradient(ellipse_70%_60%_at_10%_0%,rgb(59_91_255/0.22),transparent_70%)]"
      />

      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
        <Brand />
        {signIn("Sign in", `${OUTLINE} px-4 text-sm`, false)}
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl gap-10 px-4 pt-10 pb-16 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-16 lg:pt-20 lg:pb-24">
          <div className="flex flex-col gap-6">
            <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-gold">
              <Sparkle className="size-3.5" />
              DANCING WITH THE STARS · SEASON 35
            </p>
            <h1 className={`${DISPLAY} text-[2.75rem] leading-[0.95] sm:text-7xl`}>
              <span className="block">
                <span className="text-chrome">score every dance.</span>
              </span>{" "}
              <span className="block">
                <span className="text-chrome">before the judges do.</span>
              </span>
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-silver-dim sm:text-lg">
              Hold up your paddle for each couple as they dance. Scores stay hidden until you submit yours. Then
              the desk turns over: the judges, your friends, everyone watching, and how close you came.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              {signIn("Sign in with Google", GOLD, true)}
              <a href="#how" className={OUTLINE}>
                How it works
              </a>
            </div>
            <div aria-live="polite" className="min-h-5 text-sm text-silver-dim">
              {status === "unconfigured" && "Sign-in is not configured in this build."}
              {error && "Could not start sign-in. Try again."}
            </div>
          </div>
          <LandingDesk />
        </section>

        <section id="how" className="scroll-mt-4 border-t border-silver/10 py-16 lg:py-24">
          <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 sm:px-6">
            <div className="flex max-w-2xl flex-col gap-3">
              <p className="text-xs font-semibold tracking-[0.2em] text-gold">HOW IT WORKS</p>
              <h2 className={`${DISPLAY} text-3xl leading-none sm:text-5xl`}>
                <span className="text-chrome">four steps, every dance.</span>
              </h2>
              <p className="leading-relaxed text-silver-dim">
                It runs alongside the live broadcast. Your phone is the paddle; the show is on the big screen.
              </p>
            </div>
            <LandingSteps />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:pb-24">
          <aside className="flex flex-col gap-2 rounded-xl border border-gold/30 bg-gold/5 p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
            <h2 className={`${DISPLAY} shrink-0 text-xl text-gold-light`}>vote for real.</h2>
            <p className="text-sm leading-relaxed text-silver-dim">
              Paddles here are for bragging rights. To vote for your couple on the show, text{" "}
              <span className="font-semibold text-silver tabular-nums">21523</span> during the live Eastern
              broadcast.
            </p>
          </aside>
        </section>
      </main>

      <footer className="border-t border-silver/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-silver-dim sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>Not affiliated with ABC, Disney or BBC Studios.</p>
          <div className="flex gap-4">
            <a
              href="https://armchairjudge.com"
              className="rounded-sm underline underline-offset-4 hover:text-silver focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light"
            >
              More shows at Armchair Judge
            </a>
            <Link
            href="/credits/"
            className="rounded-sm underline underline-offset-4 hover:text-silver focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light"
          >
              Photo credits
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

interface SparkleProps {
  className: string;
}

function Sparkle({ className }: SparkleProps) {
  return (
    <svg viewBox="-1 -1 2 2" aria-hidden="true" className={`fill-current ${className}`}>
      <path d="M0-1C.1-.1.1-.1 1 0 .1.1.1.1 0 1-.1.1-.1.1-1 0-.1-.1-.1-.1 0-1Z" />
    </svg>
  );
}
