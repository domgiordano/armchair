"use client";

import { useCallback, useEffect, useState } from "react";

import { getAdminMe } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { useLoad } from "@/lib/load";

import { SignedInPage } from "../account/hub-shell";
import { ErrorNote, Segmented, Skeleton } from "../account/ui";
import { AuditTab } from "./audit-tab";
import { LiveTab } from "./live-tab";
import { OrderTab } from "./order-tab";
import { OverviewTab } from "./overview-tab";
import { UsersTab } from "./users-tab";
import { UserView } from "./user-view";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "users", label: "Users" },
  { value: "live", label: "Live" },
  { value: "order", label: "Running order" },
  { value: "audit", label: "Audit" },
] as const;
type Tab = (typeof TABS)[number]["value"];

interface Route {
  tab: Tab;
  user: string | null;
}

function read(): Route {
  const params = new URLSearchParams(window.location.search);
  const tab = TABS.find((t) => t.value === params.get("tab"))?.value ?? "overview";
  return { tab, user: params.get("user") };
}

/** The console's place lives in the query string, so Back works and a user's page can be linked. */
function useRoute(): [Route, (next: Route) => void] {
  const [route, setRoute] = useState<Route>({ tab: "overview", user: null });
  useEffect(() => {
    const sync = () => setRoute(read());
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  const go = useCallback((next: Route) => {
    const params = new URLSearchParams({ tab: next.tab, ...(next.user ? { user: next.user } : {}) });
    window.history.pushState(null, "", `?${params}`);
    setRoute(next);
    window.scrollTo({ top: 0 });
  }, []);
  return [route, go];
}

// 403 is an answer, not a failure: this account isn't an admin.
const whoami = () =>
  getAdminMe().catch((e: unknown) => {
    if (e instanceof ApiError && e.status === 403) return null;
    throw e;
  });

export function AdminConsole() {
  return (
    <SignedInPage eyebrow="Admin" pitch="Sign in with an admin account to open the console.">
      <Gate />
    </SignedInPage>
  );
}

function Gate() {
  const [load, retry] = useLoad(whoami);
  if (load.kind === "loading") return <Skeleton className="h-40 rounded-3xl" />;
  if (load.kind === "error") return <ErrorNote what="the admin console" message={load.message} retry={retry} />;
  if (!load.value) {
    return (
      <div className="rise mx-auto flex max-w-xl flex-col gap-3 py-12 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight">Admins only</h1>
        <p className="text-muted">This account can&rsquo;t open the admin console.</p>
      </div>
    );
  }
  return <Console email={load.value.email} />;
}

function Console({ email }: { email: string }) {
  const [route, go] = useRoute();
  const open = (sub: string) => go({ tab: "users", user: sub });
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.3em] text-gold uppercase">Admin</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Console</h1>
          <p className="mt-1 text-sm text-muted">Signed in as {email}</p>
        </div>
        <Segmented label="Section" options={[...TABS]} value={route.tab} onChange={(tab) => go({ tab, user: null })} />
      </header>
      {route.user ? (
        <UserView key={route.user} sub={route.user} onBack={() => go({ tab: "users", user: null })} />
      ) : (
        <>
          {route.tab === "overview" && <OverviewTab />}
          {route.tab === "users" && <UsersTab onOpen={open} />}
          {route.tab === "live" && <LiveTab onOpen={open} />}
          {route.tab === "order" && <OrderTab />}
          {route.tab === "audit" && <AuditTab onOpen={open} />}
        </>
      )}
    </div>
  );
}
