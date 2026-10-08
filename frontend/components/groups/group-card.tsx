"use client";

import Link from "next/link";

import { useGroupBoard } from "@/components/groups/use-group-board";
import { timeAgo } from "@/components/notifications";
import { AvatarStack, GroupMark, displayName } from "@/components/social/parts";
import { Chevron } from "@/components/social/social-sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { groupHref, type GroupDetail } from "@armchair/app-core/api/groups";
import type { Leaderboard } from "@/lib/api/leaderboard";
import { joins, standing, weekProgress } from "@/lib/social/group-summary";
import { seasonLabel, useSeasonId } from "@/lib/show/seasons";
import { cn, EYEBROW, FOCUS } from "@/lib/ui";

interface GroupCardProps {
  group: GroupDetail;
  me: string | null;
}

/** A group at a glance, on this show: your place, the leader, this week and the latest join. Opens the group. */
export function GroupCard({ group, me }: GroupCardProps) {
  const season = useSeasonId();
  const [load] = useGroupBoard(group.id, season);
  const owner = group.owner === me;
  const count = group.members.length;
  const latest = joins(group)[0];

  return (
    <Link
      href={groupHref(group.id)}
      prefetch={false}
      className={cn(
        "group relative flex h-full flex-col gap-4 overflow-hidden rounded-2xl border border-silver/10 bg-gradient-to-br from-ballroom/80 via-ballroom/45 to-ink p-4 shadow-[inset_0_1px_0_rgb(213_219_234/0.06)] transition-[border-color,transform] duration-200 hover:border-gold/40 active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100 sm:p-5",
        FOCUS,
      )}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-20 -right-16 size-48 rounded-full bg-gold/10 blur-3xl transition-opacity group-hover:opacity-100 sm:opacity-60"
      />
      <div className="relative flex items-start gap-3">
        <GroupMark name={group.name} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-lg leading-tight font-semibold text-pearl group-hover:text-gold-light">
            {group.name}
          </span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-silver-dim">
            <AvatarStack people={group.members} size={22} max={5} />
            <span className="whitespace-nowrap">
              {count} {count === 1 ? "member" : "members"}
            </span>
            {owner && <Badge tone="gold">Owner</Badge>}
            {owner && group.requests.length > 0 && <Badge tone="magenta">{group.requests.length} asking to join</Badge>}
          </span>
        </div>
        <Chevron />
      </div>

      <div className="relative flex flex-col gap-3 border-t border-silver/10 pt-3">
        <p className={EYEBROW}>Dancing with the Stars · {seasonLabel(season)}</p>
        {load.kind === "loading" && (
          <div role="status" className="flex flex-col gap-2">
            <span className="sr-only">Loading {group.name}&apos;s leaderboard...</span>
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        )}
        {load.kind === "error" && (
          <p className="text-sm text-silver-dim">Couldn&apos;t load the leaderboard. Open the group to try again.</p>
        )}
        {load.kind === "ready" && <Numbers group={group} board={load.board} />}
      </div>

      {latest && (
        <p className="relative mt-auto truncate text-xs text-silver-dim">
          {latest.member.sub === me ? "You" : displayName(latest.member)}{" "}
          {latest.member.sub === group.owner && group.members.length === 1 ? "started the group" : "joined"} ·{" "}
          {timeAgo(latest.at)}
        </p>
      )}
    </Link>
  );
}

function Numbers({ group, board }: { group: GroupDetail; board: Leaderboard }) {
  const { leader, rank, ranked } = standing(board);
  const week = weekProgress(group, board);
  return (
    <>
      <dl className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs text-silver-dim">Your place</dt>
          <dd className="text-xl font-semibold text-pearl tabular-nums">
            {rank === null ? "Unranked" : `#${rank}`}
            {rank !== null && <span className="text-sm font-normal text-silver-dim"> of {ranked}</span>}
          </dd>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <dt className="text-xs text-silver-dim">Leader</dt>
          <dd className="truncate text-xl font-semibold text-gold-light">
            {leader ? displayName(leader) : "No one yet"}
          </dd>
        </div>
      </dl>
      {week && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="text-silver">
              <span className="font-semibold text-pearl tabular-nums">{week.done.length}</span> of{" "}
              {group.members.length} scored week {week.week ?? week.ep}
            </span>
            {week.started.length > 0 && <span className="text-xs text-silver-dim">{week.started.length} partway</span>}
          </div>
          <span
            role="progressbar"
            aria-label={`Members who scored week ${week.week ?? week.ep}`}
            aria-valuemin={0}
            aria-valuemax={group.members.length}
            aria-valuenow={week.done.length}
            className="flex h-1.5 overflow-hidden rounded-full bg-silver/10"
          >
            <span
              className="grow-x h-full bg-gradient-to-r from-gold-deep to-gold-light"
              style={{ width: `${(week.done.length / group.members.length) * 100}%` }}
            />
            <span
              className="h-full bg-gold/30"
              style={{ width: `${(week.started.length / group.members.length) * 100}%` }}
            />
          </span>
        </div>
      )}
    </>
  );
}
