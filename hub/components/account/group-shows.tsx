"use client";

import { useEffect, useState } from "react";

import { ShowIcon } from "@/components/show-icon";
import { dwtsGroupBoard, setGroupShow, traitorsGroupBoard, type Group, type GroupBoardSummary } from "@/lib/api/groups";
import { useAction } from "@/lib/load";
import { showRows, type ShowRow } from "@armchair/app-core/social/group-shows";

import { FOCUS, PRIMARY, SECONDARY } from "./ui";

interface GroupShowsProps {
  group: Group;
  me: string | null;
  /** The current DWTS season id, for the group's board there. */
  dwtsSeason: string | null;
  onChange: () => void;
}

/** The group on every show: open it where it plays, start it where it doesn't, start watching yourself. */
export function GroupShows({ group, me, dwtsSeason, onChange }: GroupShowsProps) {
  const rows = showRows(group, me);
  if (rows.length === 0) return null;
  return (
    <ul aria-label={`${group.name} on each show`} className="flex flex-col gap-2">
      {rows.map((r) => (
        <li key={r.app}>
          <ShowLine group={group} row={r} dwtsSeason={dwtsSeason} onChange={onChange} />
        </li>
      ))}
    </ul>
  );
}

function ShowLine({ group, row, dwtsSeason, onChange }: { group: Group; row: ShowRow; dwtsSeason: string | null; onChange: () => void }) {
  const { busy, error, run } = useAction();
  const board = useBoard(group.id, row, dwtsSeason);
  const n = group.members.length;

  let status = "Not playing yet";
  if (row.active) {
    const parts = [`${row.playing} of ${n} playing`];
    if (board?.leader) parts.push(`${board.leader} leads`);
    if (board?.rank) parts.push(`you're #${board.rank}`);
    if (board?.week) parts.push(`${board.week.done} of ${n} scored week ${board.week.week ?? ""}`.trim());
    status = parts.join(" · ");
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line/70 bg-night/40 p-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <ShowIcon show={row.app} size={40} />
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-semibold text-text">{row.name}</span>
          <span className="text-xs text-muted">{status}</span>
          {!row.youPlay && row.homeHref && (
            <span className="text-xs text-muted">
              You haven&rsquo;t started watching.{" "}
              <a href={row.homeHref} className={`rounded-sm text-gold underline-offset-4 hover:underline ${FOCUS}`}>
                Start watching {row.name}
              </a>
            </span>
          )}
          {error && (
            <span role="alert" className="text-sm text-magenta">
              {error}
            </span>
          )}
        </div>
      </div>
      {row.active && row.groupHref && (
        <a href={row.groupHref} className={`${SECONDARY} w-full whitespace-normal! text-center`}>
          Open in {row.app === "dwts" ? "DWTS" : row.name}
        </a>
      )}
      {!row.active && (
        <button
          type="button"
          disabled={busy !== null}
          onClick={() =>
            void run("start", async () => {
              await setGroupShow(group.id, row.app, true);
              onChange();
            })
          }
          className={`${PRIMARY} w-full whitespace-normal! text-center`}
        >
          {busy ? "Starting..." : `Start ${row.name} with this group`}
        </button>
      )}
    </div>
  );
}

/** The group's board on an active show; null while loading, or if it fails, so the line just says less. */
function useBoard(group: string, row: ShowRow, dwtsSeason: string | null): GroupBoardSummary | null {
  const [board, setBoard] = useState<GroupBoardSummary | null>(null);
  useEffect(() => {
    if (!row.active) return;
    const read = row.app === "dwts" ? (dwtsSeason ? dwtsGroupBoard(dwtsSeason, group) : null) : traitorsGroupBoard("tus", group);
    if (!read) return;
    let cancelled = false;
    read.then(
      (b) => !cancelled && setBoard(b),
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [group, row.app, row.active, dwtsSeason]);
  return board;
}
