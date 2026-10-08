"use client";

import Link from "next/link";
import { useState } from "react";

import { Avatar } from "@/components/avatar";
import { FriendButton } from "@/components/social/friend-button";
import { displayName } from "@/components/social/parts";
import { Chevron } from "@/components/social/social-sheet";
import { profileHref } from "@/lib/api/people";
import type { Leaderboard } from "@/lib/api/leaderboard";
import type { Person, Relation } from "@armchair/app-core/api/social";
import { cn, FOCUS } from "@/lib/ui";

interface FriendCardProps {
  friend: Person;
  /** The groups you share with them, by name. */
  groups: string[];
  /** Friends' leaderboard for this season: their numbers and yours. Null while it loads or if it failed. */
  board: Leaderboard | null;
  onChange: () => void;
}

/**
 * A friend at a glance: where they stand among your friends this season, how
 * they compare with you, and the groups you share. Season means only, never a
 * dance, so nothing here gets ahead of a scorecard.
 */
export function FriendCard({ friend, groups, board, onChange }: FriendCardProps) {
  const [relation, setRelation] = useState<Relation>("friend");
  const name = displayName(friend);
  const row = board && [...board.ranked, ...board.unranked].find((r) => r.sub === friend.sub);
  const ranked = board?.ranked.find((r) => r.sub === friend.sub);
  const mine = board?.me.mae ?? null;

  let versus: string | null = null;
  if (ranked && mine !== null) {
    const gap = Math.round((ranked.mae - mine) * 100) / 100;
    versus =
      gap === 0
        ? "Level with you"
        : gap < 0
          ? `${(-gap).toFixed(2)} closer than you`
          : `${gap.toFixed(2)} further off than you`;
  }

  return (
    <article
      aria-label={name}
      className={cn(
        "flex h-full flex-col gap-3 rounded-2xl border border-silver/10 bg-gradient-to-br from-ballroom/75 via-ballroom/45 to-ink p-4 transition-opacity",
        relation !== "friend" && "opacity-60",
      )}
    >
      <div className="flex items-center gap-3">
        <Avatar name={name} email="" picture={friend.picture} size={48} />
        <Link
          href={profileHref(friend.sub)}
          prefetch={false}
          className={cn("group flex min-w-0 flex-1 items-center gap-1 rounded-md", FOCUS)}
        >
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-semibold text-pearl group-hover:text-gold-light">{name}</span>
            <span className="truncate text-xs text-silver-dim">
              {groups.length > 0 ? `In ${groups.join(", ")}` : "No groups together yet"}
            </span>
          </span>
          <Chevron />
        </Link>
      </div>

      <dl className="grid grid-cols-3 gap-2 border-t border-silver/10 pt-3 text-center">
        <Figure label="Among friends" value={ranked ? `#${ranked.rank}` : row ? "Unranked" : "–"} />
        <Figure label="Off the judges" value={ranked ? ranked.mae.toFixed(2) : "–"} />
        <Figure label="Dances" value={row ? String(row.count) : "–"} />
      </dl>

      <div className="mt-auto flex items-center justify-between gap-2">
        <p className={cn("text-xs", versus?.includes("closer") ? "text-gold-light" : "text-silver-dim")}>
          {versus ?? (board ? `${board.minDances} dances to rank` : "")}
        </p>
        <FriendButton
          person={friend}
          relation={relation}
          compact
          onChange={(next) => {
            setRelation(next);
            onChange();
          }}
        />
      </div>
    </article>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col-reverse gap-0.5">
      <dt className="text-[11px] tracking-wide text-silver-dim uppercase">{label}</dt>
      <dd className="text-lg font-semibold text-pearl tabular-nums">{value}</dd>
    </div>
  );
}
