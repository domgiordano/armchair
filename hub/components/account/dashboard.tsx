"use client";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { firstName, loadMe, useMe } from "@/lib/me";

import { AppsPanel } from "./apps-panel";
import { FriendsPanel } from "./friends-panel";
import { GroupsPanel } from "./groups-panel";
import { NotificationsPanel } from "./notifications-panel";
import { ErrorNote, Skeleton, step } from "./ui";

/** A member's armchairjudge.com: their apps, people and invites in one place. */
export function Dashboard() {
  return (
    <div id="page">
      <SiteHeader sections={false} />
      <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-4 pt-8 pb-20 outline-none sm:px-6 sm:pt-12">
        <Welcome />
        {/* Phone: one column, notifications second. Desktop: two columns. */}
        <div className="mt-8 flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-8">
          <div className="contents lg:flex lg:flex-col lg:gap-8">
            <div className="order-1">
              <AppsPanel index={1} />
            </div>
            <div className="order-3">
              <FriendsPanel index={3} />
            </div>
          </div>
          <div className="contents lg:flex lg:flex-col lg:gap-8">
            <div className="order-2">
              <NotificationsPanel index={2} />
            </div>
            <div className="order-4">
              <GroupsPanel index={4} />
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Welcome() {
  const load = useMe();
  return (
    <header className="rise" style={step(0)}>
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
          <div className="mt-4 max-w-md">
            <ErrorNote what="your account" message={load.message} retry={() => void loadMe()} />
          </div>
        </div>
      )}
      <p className="mt-3 max-w-xl text-muted">Your shows, your people and anything waiting on you.</p>
    </header>
  );
}
