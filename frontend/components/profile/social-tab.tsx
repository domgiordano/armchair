"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/avatar";
import { plural } from "@/components/profile/parts";
import { UserLink } from "@/components/user-link";
import { Card } from "@/components/ui/card";
import { SkeletonList } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { getMyGroups } from "@/lib/api/groups";
import type { Profile } from "@/lib/api/profile";
import { getFriends, type Person } from "@/lib/api/social";
import { TEXT_LINK } from "@/lib/ui";

interface Circle {
  friends: Person[];
  groups: { id: string; name: string; members?: number }[];
}

type Load = { kind: "loading" } | { kind: "ready"; data: Circle } | { kind: "error"; message: string };

const loadMine = async (): Promise<Circle> => {
  const [friends, groups] = await Promise.all([getFriends(), getMyGroups()]);
  return {
    friends: friends.friends,
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      members: g.members.length,
    })),
  };
};

/** Your friends and groups; on someone else's profile, the ones you share. */
export function SocialTab({ profile, own }: { profile: Profile; own: boolean }) {
  const [load, setLoad] = useState<Load>(() =>
    own ? { kind: "loading" } : { kind: "ready", data: profile.mutual ?? { friends: [], groups: [] } },
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!own) return;
    let cancelled = false;
    loadMine().then(
      (data) => !cancelled && setLoad({ kind: "ready", data }),
      (e: unknown) =>
        !cancelled &&
        setLoad({
          kind: "error",
          message: e instanceof Error ? e.message : "Request failed",
        }),
    );
    return () => {
      cancelled = true;
    };
  }, [own, attempt]);

  if (load.kind === "loading") return <SkeletonList label="Loading friends and groups" rows={5} avatar />;
  if (load.kind === "error") {
    const retry = () => {
      setLoad({ kind: "loading" });
      setAttempt((n) => n + 1);
    };
    return <ErrorState what="friends and groups" message={load.message} retry={retry} />;
  }

  const { friends, groups } = load.data;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
      <Card
        id="social-friends"
        title={own ? `Friends · ${friends.length}` : `Mutual friends · ${friends.length}`}
        action={
          own ? (
            <Link href="/friends/" className={TEXT_LINK}>
              Manage
            </Link>
          ) : undefined
        }
      >
        {friends.length === 0 ? (
          <p className="text-sm text-silver-dim">
            {own
              ? "No friends yet. Add some from the Friends page."
              : `No friends in common with ${profile.name ?? "them"} yet.`}
          </p>
        ) : (
          <ul className="stagger grid gap-2 sm:grid-cols-2">
            {friends.map((f) => (
              <li
                key={f.sub}
                className="flex min-h-12 items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-silver/5"
              >
                <Avatar name={f.name} email="" picture={f.picture} size={36} />
                <UserLink sub={f.sub} className="min-w-0 truncate text-sm font-medium text-pearl">
                  {f.name ?? "Member"}
                </UserLink>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        id="social-groups"
        title={own ? `Groups · ${groups.length}` : `Groups in common · ${groups.length}`}
        action={
          own ? (
            <Link href="/groups/" className={TEXT_LINK}>
              Manage
            </Link>
          ) : undefined
        }
      >
        {groups.length === 0 ? (
          <p className="text-sm text-silver-dim">{own ? "You're not in a group yet." : "No groups in common."}</p>
        ) : (
          <ul className="stagger flex flex-col divide-y divide-silver/10">
            {groups.map((g) => (
              <li key={g.id} className="flex min-h-12 items-center justify-between gap-3 py-2">
                <span className="flex min-w-0 items-center gap-3">
                  <GroupMark name={g.name} />
                  <Link
                    href="/groups/"
                    prefetch={false}
                    className={`${TEXT_LINK} truncate font-medium text-pearl no-underline`}
                  >
                    {g.name}
                  </Link>
                </span>
                {g.members !== undefined && (
                  <span className="shrink-0 text-xs text-silver-dim tabular-nums">{plural(g.members, "member")}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function GroupMark({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-gold/30 bg-gold/10 text-sm font-semibold text-gold-light"
    >
      {Array.from(name.trim())[0]?.toUpperCase() ?? "?"}
    </span>
  );
}
