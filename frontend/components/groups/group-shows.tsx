"use client";

import { ShowIcon } from "@/components/show-icon";
import { useAction } from "@/components/social/parts";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { setGroupShow, type GroupDetail } from "@armchair/app-core/api/groups";
import { showRows, type ShowRow } from "@armchair/app-core/social/group-shows";
import { button, cn, TEXT_LINK } from "@/lib/ui";

/** The group isn't playing DWTS yet: one tap starts it, and the rest of the group hears about it. */
export function StartHere({ group, onStarted }: { group: GroupDetail; onStarted: () => void }) {
  const { busy, error, run } = useAction();
  const toast = useToast();
  return (
    <section
      aria-labelledby="start-dwts"
      className="flex flex-col gap-3 rounded-xl border border-gold/40 bg-gradient-to-br from-gold/[0.09] via-ballroom/60 to-ballroom/40 p-4 sm:p-5"
    >
      <ShowIcon show="dwts" size={48} className="shrink-0" />
      <div className="flex flex-col gap-1">
        <h2 id="start-dwts" className="font-semibold text-pearl">
          {group.name} isn&apos;t playing Dancing with the Stars yet
        </h2>
        <p className="text-sm text-silver-dim">
          Start it and everyone in the group gets a notification. The group&apos;s leaderboard and scorecards start here.
        </p>
        {error && (
          <p role="alert" className="text-sm text-red-300">
            {error}
          </p>
        )}
      </div>
      <button
        type="button"
        disabled={busy !== null}
        onClick={() =>
          void run("start", async () => {
            await setGroupShow(group.id, "dwts", true);
            toast(`${group.name} is playing Dancing with the Stars`);
            onStarted();
          })
        }
        className={cn(button("primary"), "w-full")}
      >
        {busy ? "Starting..." : "Start it with this group"}
      </button>
    </section>
  );
}

/** Where else the group plays: open it there, start it there, or start watching that show yourself. */
export function OtherShows({ group, me, reload }: { group: GroupDetail; me: string | null; reload: () => void }) {
  const rows = showRows(group, me).filter((r) => r.app !== "dwts");
  if (rows.length === 0) return null;
  return (
    <Card id="other-shows" title="On other shows" note="Same people, same group. Each show keeps its own leaderboard.">
      <ul className="flex flex-col gap-3">
        {rows.map((r) => (
          <li key={r.app}>
            <ShowLine group={group} row={r} reload={reload} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ShowLine({ group, row, reload }: { group: GroupDetail; row: ShowRow; reload: () => void }) {
  const { busy, error, run } = useAction();
  const toast = useToast();
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-silver/10 bg-ink/40 p-3">
      <div className="flex items-center gap-3">
        <ShowIcon show={row.app} size={36} className="shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium text-pearl">{row.name}</span>
          <span className="text-xs text-silver-dim">
            {row.active
              ? `${row.playing} of ${group.members.length} playing`
              : "Not playing yet"}
          </span>
        </div>
      </div>
      {row.active && row.groupHref && (
        <a href={row.groupHref} className={cn(button("secondary", "sm"), "w-full")}>
          Open in {row.name}
        </a>
      )}
      {!row.active && (
        <button
          type="button"
          disabled={busy !== null}
          onClick={() =>
            void run("start", async () => {
              await setGroupShow(group.id, row.app, true);
              toast(`${group.name} is playing ${row.name}`);
              reload();
            })
          }
          className={cn(button("primary", "sm"), "w-full")}
        >
          {busy ? "Starting..." : `Start ${row.name} with this group`}
        </button>
      )}
      {!row.youPlay && row.homeHref && (
        <p className="text-xs text-silver-dim">
          You haven&apos;t played {row.name} yet.{" "}
          <a href={row.homeHref} className={TEXT_LINK}>
            Start watching
          </a>
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
