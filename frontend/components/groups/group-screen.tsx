"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type MouseEvent } from "react";

import { GroupBoard } from "@/components/groups/group-board";
import { GroupMembers } from "@/components/groups/group-members";
import { InviteSheet, LeaveSheet, SettingsSheet } from "@/components/groups/group-sheets";
import { Redirect } from "@/components/redirect";
import { SignedIn } from "@/components/signed-in";
import { AvatarStack, GroupMark, useAction, useLoad } from "@/components/social/parts";
import { Badge } from "@/components/ui/badge";
import { Menu, MenuItem } from "@/components/ui/menu";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { tabId, Tabs } from "@/components/ui/tabs";
import { getGroupDetails, type GroupDetail } from "@armchair/app-core/api/groups";
import { getFriends, mySub } from "@armchair/app-core/api/social";
import { saveGroup } from "@/lib/show/group-filter";
import { useNotifications } from "@armchair/app-core/social/notifications";
import { button, cn, FOCUS } from "@/lib/ui";

/** /groups/?id=: one group's page. Without an id, your groups list on your profile. */
export function GroupRoute() {
  const id = useSearchParams().get("id");
  if (!id) return <Redirect to="/social/?view=groups" />;
  return (
    <SignedIn title="Group" wide>
      <GroupScreen key={id} id={id} />
    </SignedIn>
  );
}

type Sheet = "invite" | "settings" | "leave" | null;
type Tab = "board" | "members";
const PANEL = "group-panel";

function GroupScreen({ id }: { id: string }) {
  const [groups, reload] = useLoad(getGroupDetails);
  const [me] = useLoad(mySub);

  if (groups.kind === "loading" || me.kind === "loading") return <GroupSkeleton />;
  if (groups.kind === "error") return <ErrorState what="the group" message={groups.message} retry={reload} />;
  const group = groups.value.find((g) => g.id === id);
  if (!group) return <NotIn id={id} onJoined={reload} />;
  return <GroupView group={group} me={me.kind === "ready" ? me.value : null} reload={reload} />;
}

function GroupView({ group, me, reload }: { group: GroupDetail; me: string | null; reload: () => void }) {
  const owner = group.owner === me;
  const [tab, setTab] = useState<Tab>("board");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [friends, reloadFriends] = useLoad(getFriends);
  const count = group.members.length;

  // Safari doesn't focus a clicked button, and the sheet hands focus back to whatever had it on close.
  const open = (which: Sheet) => (e: MouseEvent<HTMLElement>) => {
    e.currentTarget.focus();
    setSheet(which);
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="relative rounded-2xl border border-silver/10 bg-gradient-to-br from-ballroom/90 via-ballroom/50 to-ink p-5 shadow-[inset_0_1px_0_rgb(213_219_234/0.06)] sm:p-7">
        {/* Clipped on their own layer, so the options menu can hang past the card. */}
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
          <span className="absolute -top-28 -right-20 size-80 rounded-full bg-gold/15 blur-3xl" />
          <span className="absolute -bottom-32 -left-24 size-80 rounded-full bg-brand-violet/15 blur-3xl" />
        </span>
        <div className="relative flex animate-page-in flex-col items-center gap-5 text-center sm:flex-row sm:gap-8 sm:text-left">
          <GroupMark name={group.name} size="lg" />
          <div className="flex w-full min-w-0 flex-1 flex-col items-center gap-3 sm:items-start">
            <div className="flex max-w-full flex-col items-center gap-1.5 sm:items-start">
              <p className="text-xs font-semibold tracking-[0.2em] text-gold uppercase">Group</p>
              <h1 className="max-w-full truncate text-2xl font-semibold tracking-tight text-pearl sm:text-3xl">{group.name}</h1>
              <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-silver-dim sm:justify-start">
                <AvatarStack people={group.members} size={26} max={5} />
                <span>
                  {count} {count === 1 ? "member" : "members"}
                </span>
                <Badge tone={owner ? "gold" : "silver"}>{owner ? "Owner" : "Member"}</Badge>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <button type="button" onClick={open("invite")} className={cn(button("primary"), "min-w-28")}>
                <InviteIcon />
                Invite
              </button>
              <Link href="/episode/" onClick={() => saveGroup(group.id)} className={button("secondary")}>
                Scorecard
              </Link>
              <Menu
                label="Group options"
                trigger={<DotsIcon />}
                triggerClassName={cn(
                  "flex size-11 items-center justify-center rounded-md border border-silver/30 bg-ballroom/40 text-pearl transition-colors hover:border-silver/55 hover:bg-silver/10 active:bg-silver/15 aria-expanded:bg-silver/10",
                  FOCUS,
                )}
              >
                {owner ? (
                  <MenuItem onSelect={() => setSheet("settings")}>Group settings</MenuItem>
                ) : (
                  <MenuItem onSelect={() => setSheet("leave")} className="text-red-200 hover:text-red-100 focus:text-red-100">
                    Leave group
                  </MenuItem>
                )}
              </Menu>
            </div>
          </div>
        </div>
      </header>

      <div className="md:max-w-sm">
        <Tabs
          label="Group sections"
          tabs={[
            { id: "board", label: "Leaderboard" },
            { id: "members", label: "Members", badge: owner && group.requests.length > 0 ? group.requests.length : undefined },
          ]}
          value={tab}
          onChange={setTab}
          panelId={PANEL}
        />
      </div>
      <div key={tab} role="tabpanel" id={PANEL} aria-labelledby={tabId(PANEL, tab)} className="flex flex-1 flex-col gap-4 animate-fade-in">
        {tab === "board" ? (
          <GroupBoard group={group} />
        ) : (
          <GroupMembers group={group} me={me} owner={owner} reload={reload} onInvite={open("invite")} />
        )}
      </div>

      <InviteSheet
        open={sheet === "invite"}
        onClose={() => setSheet(null)}
        group={group}
        friends={friends}
        reloadFriends={reloadFriends}
        onInvited={reload}
      />
      {owner ? (
        <SettingsSheet open={sheet === "settings"} onClose={() => setSheet(null)} group={group} reload={reload} />
      ) : (
        <LeaveSheet open={sheet === "leave"} onClose={() => setSheet(null)} group={group} />
      )}
    </div>
  );
}

/** Not a member: a pending invite can be answered here; otherwise, the way back to your groups. */
function NotIn({ id, onJoined }: { id: string; onJoined: () => void }) {
  const router = useRouter();
  const { items, answer } = useNotifications();
  const invite = items.find((n) => n.type === "group_invite" && n.state === "pending" && n.group?.id === id);
  const act = useAction();

  if (invite) {
    const name = invite.group?.name ?? "this group";
    return (
      <EmptyState
        title={`${invite.from.name ?? "Someone"} invited you to ${name}`}
        action={
          <div className="flex flex-col items-center gap-2">
            <div className="flex gap-2">
              <button
                type="button"
                disabled={act.busy !== null}
                onClick={() => void act.run("join", () => answer(invite, true).then(onJoined))}
                className={button("primary", "sm")}
              >
                {act.busy === "join" ? "Joining..." : "Join group"}
              </button>
              <button
                type="button"
                disabled={act.busy !== null}
                onClick={() => void act.run("decline", () => answer(invite, false).then(() => router.push("/social/?view=groups")))}
                className={button("secondary", "sm")}
              >
                Decline
              </button>
            </div>
            {act.error && (
              <p role="alert" className="text-sm text-red-300">
                {act.error}
              </p>
            )}
          </div>
        }
      >
        Join to see its leaderboard and compare scorecards with everyone in it.
      </EmptyState>
    );
  }
  return (
    <>
      <h1 className="sr-only">Group not found</h1>
      <EmptyState
        title="You're not in this group"
        action={
          <Link href="/social/?view=groups" className={button("secondary", "sm")}>
            Your groups
          </Link>
        }
      >
        Ask someone in it for the group&apos;s invite link.
      </EmptyState>
    </>
  );
}

function GroupSkeleton() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">Loading the group...</span>
      <div className="flex flex-col items-center gap-5 rounded-2xl border border-silver/10 p-5 sm:flex-row sm:gap-8 sm:p-7">
        <Skeleton className="size-24 shrink-0 rounded-3xl sm:size-28" />
        <div className="flex flex-col items-center gap-3 sm:items-start">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-5 w-40" />
          <div className="flex gap-2">
            <Skeleton className="h-11 w-28" />
            <Skeleton className="h-11 w-28" />
            <Skeleton className="size-11" />
          </div>
        </div>
      </div>
      <Skeleton className="h-12 rounded-lg md:max-w-sm" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function InviteIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="7" r="3" />
      <path d="M2.5 16.5c.6-2.8 2.8-4.5 5.5-4.5s4.9 1.7 5.5 4.5M15.5 6v5M13 8.5h5" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5" fill="currentColor">
      <circle cx="4.5" cy="10" r="1.6" />
      <circle cx="10" cy="10" r="1.6" />
      <circle cx="15.5" cy="10" r="1.6" />
    </svg>
  );
}
