"use client";

import { useCallback, useId, useMemo, useState } from "react";

import { getUsers, type UserRow } from "@/lib/api/admin";
import { useLoad } from "@/lib/load";

import { Avatar, ErrorNote, FOCUS, INPUT, Segmented, SkeletonRows } from "../account/ui";
import { CARD, day, TABLE_WRAP, TD, TH, when } from "./parts";

type SortKey = "events" | "sessions" | "lastActive" | "answers" | "groups" | "createdAt";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "events", label: "Events" },
  { key: "sessions", label: "Sessions" },
  { key: "answers", label: "Scores/picks" },
  { key: "groups", label: "Groups" },
  { key: "lastActive", label: "Last seen" },
  { key: "createdAt", label: "Joined" },
];

const DAYS = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
] as const;

const lastSeen = (u: UserRow) => u.lastActive ?? u.lastSeenAt;

function compare(a: UserRow, b: UserRow, key: SortKey): number {
  if (key === "lastActive") return (lastSeen(b) ?? "").localeCompare(lastSeen(a) ?? "");
  if (key === "createdAt") return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
  return b[key] - a[key];
}

export function UsersTab({ onOpen }: { onOpen: (sub: string) => void }) {
  const [days, setDays] = useState<(typeof DAYS)[number]["value"]>("30");
  const fetcher = useCallback(() => getUsers(Number(days)), [days]);
  const [load, retry] = useLoad(fetcher);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("events");
  const searchId = useId();

  const rows = useMemo(() => {
    if (load.kind !== "ready") return [];
    const needle = q.trim().toLowerCase();
    const hits = needle
      ? load.value.filter((u) => [u.name, u.email, u.sub].some((f) => f?.toLowerCase().includes(needle)))
      : load.value;
    return [...hits].sort((a, b) => compare(a, b, sort));
  }, [load, q, sort]);

  return (
    <section aria-labelledby="users-title" className={`${CARD} flex flex-col gap-4`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="users-title" className="text-lg font-bold">
          Users{load.kind === "ready" && <span className="ml-2 text-sm font-normal text-muted">{load.value.length}</span>}
        </h2>
        <Segmented label="Activity window" options={[...DAYS]} value={days} onChange={setDays} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={searchId} className="text-sm text-muted">
          Find a user by name, email or id
        </label>
        <input id={searchId} type="search" value={q} onChange={(e) => setQ(e.target.value)} className={INPUT} />
      </div>
      {load.kind === "loading" && <SkeletonRows label="Loading users" rows={5} />}
      {load.kind === "error" && <ErrorNote what="users" message={load.message} retry={retry} />}
      {load.kind === "ready" && (
        <>
          <div className={`${TABLE_WRAP} hidden md:block`}>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={TH}>User</th>
                  {COLUMNS.map((c) => (
                    <th key={c.key} className={TH} aria-sort={sort === c.key ? "descending" : "none"}>
                      <button type="button" onClick={() => setSort(c.key)} className={`rounded uppercase ${FOCUS} ${sort === c.key ? "text-gold" : ""}`}>
                        {c.label}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.sub} className="border-t border-line/70 hover:bg-line/30">
                    <td className={TD}>
                      <button type="button" onClick={() => onOpen(u.sub)} className={`flex items-center gap-3 rounded-xl text-left ${FOCUS}`}>
                        <Avatar name={u.name} picture={u.picture} size={32} decorative />
                        <span className="min-w-0">
                          <span className="block font-medium text-text underline-offset-4 hover:underline">{u.name ?? "No name"}</span>
                          <span className="block text-xs text-muted">{u.email}</span>
                        </span>
                      </button>
                    </td>
                    <td className={TD}>{u.events}</td>
                    <td className={TD}>{u.sessions}</td>
                    <td className={TD}>{u.answers}</td>
                    <td className={TD}>{u.groups}</td>
                    <td className={`${TD} whitespace-nowrap`}>{when(lastSeen(u))}</td>
                    <td className={`${TD} whitespace-nowrap`}>{day(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 md:hidden">
            <label className="flex items-center gap-2 text-sm text-muted">
              Sort by
              <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={`${INPUT} w-auto`}>
                {COLUMNS.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <ul className="flex flex-col divide-y divide-line/70">
              {rows.map((u) => (
                <li key={u.sub}>
                  <button type="button" onClick={() => onOpen(u.sub)} className={`flex w-full items-center gap-3 rounded-xl py-3 text-left ${FOCUS}`}>
                    <Avatar name={u.name} picture={u.picture} size={40} decorative />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{u.name ?? "No name"}</span>
                      <span className="block truncate text-xs text-muted">{u.email}</span>
                      <span className="block text-xs text-muted tabular-nums">
                        {u.events} events · {u.sessions} sessions · {u.answers} scores/picks · {u.groups} groups
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-xs text-muted">{when(lastSeen(u))}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          {!rows.length && <p className="text-sm text-muted">Nobody matches &ldquo;{q}&rdquo;.</p>}
        </>
      )}
    </section>
  );
}
