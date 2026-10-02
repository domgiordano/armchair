"use client";

import { useCallback, useState } from "react";
import { GoogleMark } from "@/components/google-mark";

import { Intro } from "@/components/intro";
import { LandingNav } from "@/components/landing-nav";
import { LandingDesk } from "@/components/landing-desk";
import { LandingSections } from "@/components/landing-sections";
import { LandingSteps } from "@/components/landing-steps";
import { reveal, ScrollReveals } from "@/components/scroll-reveals";
import { SiteFooter } from "@/components/site-footer";
import { Specks } from "@/components/ui/specks";
import { useReducedMotion } from "@/lib/motion";
import { button, DISPLAY } from "@/lib/ui";

const GOLD = button("primary");
const OUTLINE = button("secondary");

interface LandingProps {
  status: "loading" | "signedOut" | "unconfigured";
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

  return (
    <div className="relative isolate min-h-dvh overflow-clip text-silver">
      <ScrollReveals />
      <Specks />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 -z-10 h-[900px] bg-[radial-gradient(ellipse_60%_50%_at_75%_10%,rgb(232_194_104/0.16),transparent_70%),radial-gradient(ellipse_70%_60%_at_10%_0%,rgb(59_91_255/0.22),transparent_70%)]"
      />

      <LandingNav disabled={status !== "signedOut" || redirecting} onSignIn={() => void start()} />

      <main>
        <section className="mx-auto grid max-w-6xl gap-10 px-4 pt-10 pb-16 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-16 lg:pt-20 lg:pb-24">
          <div className="stagger flex flex-col gap-6">
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
              {/* Only this button reports the redirect; the header's just disable. */}
              <button
                type="button"
                onClick={() => void start()}
                disabled={status !== "signedOut" || redirecting}
                className={GOLD}
              >
                <span className="inline-flex items-center justify-center gap-2.5">
                  <GoogleMark />
                  {redirecting ? "Opening Google..." : "Sign in with Google"}
                </span>
              </button>
              <a href="#how" className={OUTLINE}>
                How it works
              </a>
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-silver">
              {FACTS.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <Sparkle className="size-3 text-gold" />
                  {f}
                </li>
              ))}
            </ul>
            <div aria-live="polite" className="min-h-5 text-sm text-silver-dim">
              {status === "unconfigured" && "Sign-in is not configured in this build."}
              {error && "Could not start sign-in. Try again."}
            </div>
          </div>
          <div className="relative animate-rise-in [animation-delay:250ms]">
            {/* Two follow-spots sweeping the floor behind the desk. */}
            <div aria-hidden="true" className="pointer-events-none absolute -inset-x-10 -top-24 bottom-0 -z-10">
              <span className="lx-beam absolute top-0 left-[15%] h-full w-40 origin-top bg-linear-to-b from-gold-light/25 to-transparent blur-xl [clip-path:polygon(40%_0,60%_0,100%_100%,0_100%)]" />
              <span className="lx-beam lx-beam-2 absolute top-0 right-[15%] h-full w-40 origin-top bg-linear-to-b from-silver/20 to-transparent blur-xl [clip-path:polygon(40%_0,60%_0,100%_100%,0_100%)]" />
            </div>
            <LandingDesk />
          </div>
        </section>

        <section id="how" className="scroll-mt-16 border-t border-silver/10 py-16 lg:py-24">
          <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 sm:px-6">
            <div className="flex max-w-2xl flex-col gap-3" {...reveal()}>
              <p className="text-xs font-semibold tracking-[0.2em] text-gold">HOW IT WORKS</p>
              <h2 className={`${DISPLAY} text-3xl leading-none sm:text-5xl`}>
                <span className="text-chrome">four steps, every dance.</span>
              </h2>
              <p className="leading-relaxed text-silver-dim">
                It runs alongside the live broadcast. Your phone is the paddle; the show is on the big screen.
              </p>
            </div>
            <div {...reveal(1)}>
              <LandingSteps />
            </div>
          </div>
        </section>

        <LandingSections />

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:pb-24">
          <aside
            className="flex flex-col gap-2 rounded-xl border border-gold/30 bg-gold/5 p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-6"
            {...reveal()}
          >
            <h2 className={`${DISPLAY} shrink-0 text-xl text-gold-light`}>vote for real.</h2>
            <p className="text-sm leading-relaxed text-silver-dim">
              Paddles here are for bragging rights. To vote for your couple on the show, text{" "}
              <span className="font-semibold text-silver tabular-nums">21523</span> during the live Eastern
              broadcast.
            </p>
          </aside>
        </section>

        <section aria-labelledby="cta-title" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:pb-28">
          <div
            className="relative overflow-hidden rounded-2xl border border-silver/15 bg-ballroom/60 px-6 py-12 text-center sm:px-12"
            {...reveal()}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_70%_at_50%_0%,rgb(232_194_104/0.18),transparent_70%)]"
            />
            <h2 id="cta-title" className={`${DISPLAY} relative text-3xl leading-none sm:text-5xl`}>
              <span className="text-chrome">the floor is yours.</span>
            </h2>
            <p className="relative mx-auto mt-4 max-w-md text-silver-dim">
              One Google sign-in, and it carries to every Armchair Judge show.
            </p>
            <button
              type="button"
              onClick={() => void start()}
              disabled={status !== "signedOut" || redirecting}
              className={`${GOLD} relative mt-8`}
            >
              <span className="inline-flex items-center justify-center gap-2.5">
                <GoogleMark />
                Sign in with Google
              </span>
            </button>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

const FACTS = ["Blind until you score", "Every judge, side by side", "Free, with Google"];

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
