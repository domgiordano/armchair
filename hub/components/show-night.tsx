"use client";

import { useEffect, useRef } from "react";

import { reveal } from "@/lib/reveal";
import { useReducedMotion } from "@/lib/use-reduced-motion";

interface Beat {
  time: string;
  title: string;
  body: string;
}

const BEATS: Beat[] = [
  {
    time: "8:00 PM ET",
    title: "The night opens",
    body: "Tonight's couples appear in alphabetical order, so the running order gives nothing away. Voting on the show opens with the broadcast.",
  },
  {
    time: "Each dance",
    title: "Paddle up",
    body: "Tap the couple on the floor and score them 1 to 10 while they dance. Submit and it's final. Don't want to score one? Reveal it without scoring.",
  },
  {
    time: "Minutes later",
    title: "The reveal",
    body: "The panel's scores land a few minutes after each dance. Yours is already in, so the desk turns over: judges, your group, everyone.",
  },
  {
    time: "10:00 PM ET",
    title: "Results",
    body: "Voting closes with the broadcast. Your accuracy for the night updates against the full panel, ready to compare with your group.",
  },
  {
    time: "Any night after",
    title: "Catch up",
    body: "Watching on replay? Every dance waits for you, unspoiled. Already seen the week? Reveal all and move on.",
  },
];

const clamp = (n: number) => Math.min(Math.max(n, 0), 1);

// Draws the line as the section scrolls up the screen and lights each beat as the line reaches it.
function useDrawOnScroll() {
  const reduced = useReducedMotion();
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = track.current;
    if (!el || reduced) return;
    const row = window.matchMedia("(min-width: 64rem)");
    const beats = Array.from(el.querySelectorAll("li"));
    let frame = 0;
    const draw = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = clamp((vh * 0.8 - r.top) / (r.height + vh * 0.3));
      el.style.setProperty("--p", p.toFixed(3));
      for (const li of beats) {
        const at = row.matches ? li.offsetLeft / el.clientWidth : li.offsetTop / el.clientHeight;
        li.toggleAttribute("data-lit", p > 0 && p >= at);
      }
    };
    const schedule = () => {
      frame ||= requestAnimationFrame(draw);
    };
    el.setAttribute("data-live", "");
    draw();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      el.removeAttribute("data-live");
      el.style.removeProperty("--p");
    };
  }, [reduced]);

  return track;
}

export function ShowNight() {
  const track = useDrawOnScroll();
  return (
    <section id="night" aria-labelledby="night-title" className="scroll-mt-20 border-t border-line py-16 lg:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div {...reveal()}>
          <p className="text-xs font-semibold tracking-[0.3em] text-gold uppercase">Show night</p>
          <h2 id="night-title" className="mt-3 max-w-2xl text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
            How a show night <span className="text-brand-gradient">plays out.</span>
          </h2>
          <p className="mt-3 max-w-xl text-muted">Dancing with the Stars airs live on the East Coast, 8 to 10 PM Eastern.</p>
        </div>

        <div ref={track} className="night-track relative mt-12">
          <span
            className="night-line absolute top-2 bottom-2 left-[7px] w-0.5 bg-linear-to-b from-blue via-magenta to-orange opacity-60 lg:top-[7px] lg:right-0 lg:bottom-auto lg:left-0 lg:h-0.5 lg:w-auto lg:bg-linear-to-r"
            aria-hidden="true"
          />
          <ol className="grid gap-8 lg:grid-cols-5 lg:gap-6">
          {BEATS.map((b) => (
            <li key={b.title} className="relative pl-9 lg:pt-10 lg:pl-0">
              <span
                className="night-dot absolute top-0.5 left-0 size-4 rounded-full border-2 border-night bg-text ring-2 ring-violet lg:top-0"
                aria-hidden="true"
              />
              <p className="text-xs font-semibold tracking-[0.15em] text-gold uppercase tabular-nums">{b.time}</p>
              <h3 className="mt-1.5 text-lg font-semibold">{b.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{b.body}</p>
            </li>
          ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
