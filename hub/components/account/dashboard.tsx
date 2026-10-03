"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { firstName, loadMe, useMe } from "@/lib/me";

import { AppsPanel } from "./apps-panel";
import { HubShell } from "./hub-shell";
import { LiveTicker } from "./live-ticker";
import { ErrorNote, FOCUS, Skeleton, step } from "./ui";

/** A member's armchairjudge.com home: what's on, their shows, and the way to every tab. Notifications live in the header. */
export function Dashboard() {
  return (
    <HubShell banner={<LiveTicker />}>
      <Welcome />
      <div className="mt-10 flex flex-col gap-10">
        <AppsPanel index={1} />
        <Shortcuts />
      </div>
    </HubShell>
  );
}

function Welcome() {
  const load = useMe();
  return (
    <header className="rise flex flex-col items-center text-center" style={step(0)}>
      <p className="text-xs font-semibold tracking-[0.3em] text-gold uppercase">Your couch</p>
      {load.kind === "loading" && (
        <div role="status">
          <span className="sr-only">Loading your account...</span>
          <Skeleton className="mt-3 h-11 w-72 max-w-full sm:h-14 sm:w-96" />
        </div>
      )}
      {load.kind === "ready" && (
        <h1 className="mt-3 text-4xl leading-[1.08] font-extrabold tracking-tight sm:text-5xl">
          Welcome back, <span className="text-brand-gradient">{firstName(load.me.name)}.</span>
        </h1>
      )}
      {load.kind === "error" && (
        <div className="mt-3">
          <h1 className="text-4xl font-extrabold tracking-tight">Welcome back.</h1>
          <div className="mx-auto mt-4 max-w-md text-left">
            <ErrorNote what="your account" message={load.message} retry={() => void loadMe()} />
          </div>
        </div>
      )}
      <p className="mt-3 max-w-xl text-muted">Your shows, your people and anything waiting on you.</p>
    </header>
  );
}

const SHORTCUTS: { href: string; title: string; line: string; icon: ReactNode }[] = [
  {
    href: "/stats/",
    title: "Stats",
    line: "Points, accuracy and rank, by show",
    icon: <path d="M4 19V11M10 19V5M16 19v-6M22 19H2" />,
  },
  {
    href: "/leaderboards/",
    title: "Leaderboards",
    line: "Everyone, or just friends",
    icon: <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" />,
  },
  {
    href: "/social/",
    title: "Social",
    line: "Friends and groups",
    icon: <path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21v-1a6 6 0 0 1 12 0v1M16 3.5a4 4 0 0 1 0 7.5M22 21v-1a6 6 0 0 0-4-5.6" />,
  },
];

function Shortcuts() {
  return (
    <nav aria-label="Jump to" className="rise mx-auto w-full max-w-3xl" style={step(2)}>
      <ul className="grid grid-cols-3 gap-3">
        {SHORTCUTS.map((s) => (
          <li key={s.href}>
            <Link
              href={s.href}
              className={`group flex h-full flex-col gap-3 rounded-2xl border border-line bg-night-2/70 p-4 transition hover:-translate-y-0.5 hover:border-muted active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${FOCUS}`}
            >
              <svg
                viewBox="0 0 24 24"
                className="size-6 text-gold transition-transform duration-300 group-hover:scale-110 motion-reduce:transition-none"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {s.icon}
              </svg>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold text-text sm:text-sm">{s.title}</span>
                <span className="mt-0.5 hidden text-xs leading-snug text-muted sm:block">{s.line}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
