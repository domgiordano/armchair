"use client";

import { dwtsLink } from "@/lib/links";

import { FriendsPanel } from "./friends-panel";
import { GroupsPanel } from "./groups-panel";
import { SignedInPage } from "./hub-shell";
import { QUIET, step } from "./ui";

/** Friends and groups at a glance. The full social pages live in each show's app. */
export function SocialScreen() {
  return (
    <SignedInPage eyebrow="Social" pitch="Sign in to see your friends and groups.">
      <header className="rise flex flex-wrap items-end justify-between gap-4" style={step(0)}>
        <div>
          <p className="text-xs font-semibold tracking-[0.3em] text-gold uppercase">Social</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
            Your <span className="text-brand-gradient">people.</span>
          </h1>
          <p className="mt-3 max-w-xl text-muted">The same friends and groups in every Armchair Judge show.</p>
        </div>
        <a href={dwtsLink("/discover/")} className={`${QUIET} -ml-3`}>
          Find people
          <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
            <path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      </header>
      <div className="mt-8 grid gap-6 lg:grid-cols-2 lg:items-start lg:gap-8">
        <FriendsPanel index={1} />
        <GroupsPanel index={2} />
      </div>
    </SignedInPage>
  );
}
