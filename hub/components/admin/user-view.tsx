"use client";

import { useCallback, useState } from "react";

import { getUser, type ActivityEvent, type UserDetail } from "@/lib/api/admin";
import { message, useLoad } from "@/lib/load";

import { Avatar, ErrorNote, QUIET, SECONDARY, Skeleton } from "../account/ui";
import { AuditList } from "./audit-tab";
import { BarChart, CARD, day, EventLine, when } from "./parts";

const STATUS: Record<string, string> = {
  friend: "Friends",
  outgoing: "Asked them",
  incoming: "They asked",
  blocked: "Blocked",
};

export function UserView({ sub, onBack }: { sub: string; onBack: () => void }) {
  const fetcher = useCallback(() => getUser(sub), [sub]);
  const [load, retry] = useLoad(fetcher);

  return (
    <div className="flex flex-col gap-6">
      <button type="button" onClick={onBack} className={`${QUIET} -ml-3 self-start`}>
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" />
        </svg>
        All users
      </button>
      {load.kind === "loading" && (
        <div role="status" className="flex flex-col gap-4">
          <span className="sr-only">Loading the user...</span>
          <Skeleton className="h-28 rounded-3xl" />
          <Skeleton className="h-64 rounded-3xl" />
        </div>
      )}
      {load.kind === "error" && <ErrorNote what="this user" message={load.message} retry={retry} />}
      {load.kind === "ready" && (
        <UserBody sub={sub} detail={load.value.data} next={(load.value.meta?.next as string | null) ?? null} reload={retry} />
      )}
    </div>
  );
}

interface BodyProps {
  sub: string;
  detail: UserDetail;
  next: string | null;
  reload: () => void;
}

function UserBody({ sub, detail, next, reload }: BodyProps) {
  const { profile } = detail;
  return (
    <>
      <section aria-label="Profile" className={`${CARD} flex flex-col gap-4 sm:flex-row sm:items-center`}>
        <Avatar name={profile.name} picture={profile.picture} size={72} decorative />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-2xl font-extrabold tracking-tight">{profile.name ?? "No name"}</h2>
          <p className="truncate text-sm text-muted">{profile.email}</p>
          <p className="truncate text-xs text-muted">
            <code>{profile.sub}</code>
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <dt className="text-muted">Joined</dt>
          <dd>{day(profile.createdAt)}</dd>
          <dt className="text-muted">Last sign-in</dt>
          <dd>{when(profile.lastSeenAt)}</dd>
          <dt className="text-muted">Photo</dt>
          <dd>{profile.avatarKind}</dd>
          <dt className="text-muted">Google name</dt>
          <dd className="truncate">{profile.googleName ?? "--"}</dd>
        </dl>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="daily-title" className={CARD}>
          <h2 id="daily-title" className="mb-4 text-lg font-bold">
            Events per day
          </h2>
          <BarChart
            title="This user's events per day, last 30 days"
            bars={detail.daily.map((d) => ({ label: d.day.slice(5), values: [d.events] }))}
            series={[{ name: "events", className: "fill-magenta" }]}
          />
        </section>

        <section aria-labelledby="devices-title" className={CARD}>
          <h2 id="devices-title" className="mb-4 text-lg font-bold">
            Devices
          </h2>
          {detail.devices.length ? (
            <ul className="flex flex-col divide-y divide-line/70 text-sm">
              {detail.devices.map((d) => (
                <li key={d.did} className="flex justify-between gap-3 py-2">
                  <span>
                    <span className="font-medium capitalize">{d.device}</span>{" "}
                    <code className="text-xs text-muted">{d.did.slice(0, 10)}</code>
                  </span>
                  <span className="text-muted tabular-nums">
                    {d.events} events · {when(d.last)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No tracked activity.</p>
          )}
        </section>

        <section aria-labelledby="groups-title" className={CARD}>
          <h2 id="groups-title" className="mb-4 text-lg font-bold">
            Groups
          </h2>
          {detail.groups.length ? (
            <ul className="flex flex-col divide-y divide-line/70 text-sm">
              {detail.groups.map((g) => (
                <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="min-w-0">
                    <span className="font-medium">{g.name ?? "Deleted group"}</span>
                    <span className="ml-2 text-xs text-muted">
                      {g.owner ? "owner · " : ""}
                      {g.members} members · joined {day(g.joinedAt)}
                    </span>
                  </span>
                  {!g.exists && <span className="rounded-full bg-magenta/15 px-2 py-0.5 text-xs text-magenta">Group gone</span>}
                  {g.exists && !g.member && (
                    <span className="rounded-full bg-magenta/15 px-2 py-0.5 text-xs text-magenta">Stuck join</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">In no groups.</p>
          )}
        </section>

        <section aria-labelledby="friends-title" className={CARD}>
          <h2 id="friends-title" className="mb-4 text-lg font-bold">
            Friends and blocks
          </h2>
          {detail.friends.length ? (
            <ul className="flex flex-col divide-y divide-line/70 text-sm">
              {detail.friends.map((f) => (
                <li key={f.sub} className="flex items-center justify-between gap-2 py-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <Avatar name={f.name} picture={f.picture} size={28} decorative />
                    <span className="truncate">{f.name ?? "No name"}</span>
                  </span>
                  <span className={`text-xs ${f.status === "blocked" ? "text-magenta" : "text-muted"}`}>
                    {f.status === "blocked" ? (f.blocking ? "Blocked them" : "Blocked by them") : STATUS[f.status]}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No friends or requests.</p>
          )}
        </section>
      </div>

      <section aria-labelledby="user-audit-title" className={CARD}>
        <h2 id="user-audit-title" className="mb-4 text-lg font-bold">
          Admin actions on this user
        </h2>
        <AuditList entries={detail.audit} />
      </section>

      <ActivityLog sub={sub} first={detail.events} next={next} key={detail.events[0]?.sk ?? "none"} onReload={reload} />
    </>
  );
}

function ActivityLog({ sub, first, next, onReload }: { sub: string; first: ActivityEvent[]; next: string | null; onReload: () => void }) {
  const [rows, setRows] = useState(first);
  const [cursor, setCursor] = useState(next);
  const [error, setError] = useState<string | null>(null);
  const more = async () => {
    if (!cursor) return;
    try {
      const page = await getUser(sub, cursor);
      setRows((r) => [...r, ...page.data.events]);
      setCursor((page.meta?.next as string | null) ?? null);
    } catch (e) {
      setError(message(e));
    }
  };
  return (
    <section aria-labelledby="log-title" className={`${CARD} flex flex-col gap-4`}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="log-title" className="text-lg font-bold">
          Activity log
        </h2>
        <button type="button" onClick={onReload} className={QUIET}>
          Refresh
        </button>
      </div>
      {rows.length ? (
        <ol className="flex flex-col divide-y divide-line/70 text-sm">
          {rows.map((e) => (
            <li key={e.sk} className="flex items-start gap-3 py-2">
              <time dateTime={e.at} className="w-28 shrink-0 text-xs text-muted tabular-nums">
                {when(e.at)}
              </time>
              <span className="min-w-0 flex-1">
                <EventLine event={e} />
              </span>
              <span className="hidden shrink-0 text-xs text-muted sm:inline">{e.device}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted">No tracked activity.</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-magenta">
          {error}
        </p>
      )}
      {cursor && (
        <button type="button" onClick={() => void more()} className={`${SECONDARY} self-start`}>
          Load older
        </button>
      )}
    </section>
  );
}
