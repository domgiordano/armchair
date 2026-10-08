"use client";

import { useState } from "react";

import { getAudit, type AuditEntry } from "@/lib/api/admin";
import { message, useLoad } from "@/lib/load";

import { ErrorNote, FOCUS, SECONDARY, SkeletonRows } from "../account/ui";
import { CARD, Detail, when } from "./parts";

const firstPage = () => getAudit();

export function AuditList({ entries, onOpen }: { entries: AuditEntry[]; onOpen?: (sub: string) => void }) {
  if (!entries.length) return <p className="text-sm text-muted">No admin actions yet.</p>;
  return (
    <ol className="flex flex-col divide-y divide-line/70">
      {entries.map((a) => (
        <li key={a.sk} className="grid gap-2 py-3 text-sm sm:grid-cols-[10rem_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-0.5">
            <time dateTime={a.sk.split("#")[0]} className="text-xs text-muted">
              {when(a.sk.split("#")[0])}
            </time>
            <span className="font-semibold">{a.action.replaceAll("_", " ")}</span>
            <span className="truncate text-xs text-muted">by {a.admin}</span>
            {onOpen ? (
              <button type="button" onClick={() => onOpen(a.target)} className={`truncate text-left text-xs text-gold underline-offset-4 hover:underline ${FOCUS}`}>
                user {a.target.slice(0, 8)}
              </button>
            ) : null}
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted">Reason</span>
            <span>{a.reason}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-xs text-muted">Before</span>
              <Detail value={a.before} />
            </div>
            <div>
              <span className="text-xs text-muted">After</span>
              <Detail value={a.after} />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function AuditTab({ onOpen }: { onOpen: (sub: string) => void }) {
  const [load, retry] = useLoad(firstPage);
  const [more, setMore] = useState<{ entries: AuditEntry[]; next: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (load.kind === "loading") return <SkeletonRows label="Loading the audit log" rows={4} />;
  if (load.kind === "error") return <ErrorNote what="the audit log" message={load.message} retry={retry} />;

  const entries = [...load.value.data, ...(more?.entries ?? [])];
  const next = more ? more.next : ((load.value.meta?.next as string | null) ?? null);
  const loadMore = async () => {
    if (!next) return;
    try {
      const page = await getAudit(next);
      setMore({ entries: [...(more?.entries ?? []), ...page.data], next: (page.meta?.next as string | null) ?? null });
    } catch (e) {
      setError(message(e));
    }
  };

  return (
    <section aria-labelledby="audit-title" className={`${CARD} flex flex-col gap-4`}>
      <div>
        <h2 id="audit-title" className="text-lg font-bold">
          Audit log
        </h2>
        <p className="text-xs text-muted">Every change an admin made to someone&rsquo;s data, newest first.</p>
      </div>
      <AuditList entries={entries} onOpen={onOpen} />
      {error && (
        <p role="alert" className="text-sm text-magenta">
          {error}
        </p>
      )}
      {next && (
        <button type="button" onClick={() => void loadMore()} className={`${SECONDARY} self-start`}>
          Load older
        </button>
      )}
    </section>
  );
}
