"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

import { AvatarStack, CheckIcon, Empty, GroupMark, PersonRow, displayName } from "@/components/social/parts";
import { SearchInput } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { tabId, Tabs, type TabItem } from "@/components/ui/tabs";
import { groupHref } from "@armchair/app-core/api/groups";
import type { Person } from "@armchair/app-core/api/social";
import { search } from "@/lib/search/match";
import { cn, FOCUS } from "@/lib/ui";

export type SocialView = "friends" | "groups" | "requests";

interface TheirProps {
  open: boolean;
  view: SocialView;
  onView: (view: SocialView) => void;
  onClose: () => void;
  name: string;
  friendCount: number;
  mutual: { friends: Person[]; groups: { id: string; name: string }[] };
}

const PANEL = "social-panel";

/** The friends and groups you share with someone, opened from the counts on their profile. */
export function TheirSocialSheet({ open, view, onView, onClose, name, friendCount, mutual }: TheirProps) {
  const tabs: TabItem<SocialView>[] = [
    { id: "friends", label: "Mutual friends" },
    { id: "groups", label: "Shared groups" },
  ];
  const shown = view === "requests" ? "friends" : view;
  return (
    <Sheet open={open} onClose={onClose} label={`${name}'s friends and groups`}>
      {open && (
        <div className="flex flex-col gap-4 text-left">
          <h2 className="truncate pr-10 text-lg font-semibold text-pearl">{name}</h2>
          <Tabs label={`${name}'s people`} tabs={tabs} value={shown} onChange={onView} panelId={PANEL} />
          <div key={shown} role="tabpanel" id={PANEL} aria-labelledby={tabId(PANEL, shown)} className="flex flex-col gap-3 animate-fade-in">
            {shown === "friends" ? (
              <>
                <p className="text-sm text-silver-dim">
                  {name} has {friendCount} {friendCount === 1 ? "friend" : "friends"}. You see the ones you share.
                </p>
                {mutual.friends.length === 0 ? (
                  <Empty>No friends in common yet.</Empty>
                ) : (
                  <FilteredPeople people={mutual.friends}>{() => <FriendTag />}</FilteredPeople>
                )}
              </>
            ) : mutual.groups.length === 0 ? (
              <Empty>No groups in common.</Empty>
            ) : (
              <ul className="stagger flex flex-col gap-2">
                {mutual.groups.map((g) => (
                  <li key={g.id}>
                    <GroupLink id={g.id} name={g.name} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Sheet>
  );
}

export function FriendTag() {
  return (
    <span className="flex items-center gap-1 text-xs font-medium text-gold-light">
      <CheckIcon className="size-3.5" />
      Friends
    </span>
  );
}

/** A list with a filter box once it's long enough to need one. */
function FilteredPeople({ people, children }: { people: Person[]; children: (p: Person) => ReactNode }) {
  const [q, setQ] = useState("");
  const shown = q.trim() ? search(people, q, displayName, people.length) : people;
  return (
    <div className="flex flex-col gap-2">
      {people.length > 6 && <SearchInput label="Search" value={q} onChange={setQ} maxLength={40} />}
      {shown.length === 0 ? (
        <p className="py-2 text-sm text-silver-dim">No one by that name.</p>
      ) : (
        <ul className="stagger divide-y divide-silver/10">
          {shown.map((p) => (
            <li key={p.sub}>
              <PersonRow person={p}>{children(p)}</PersonRow>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface GroupLinkProps {
  id: string;
  name: string;
  members?: Person[];
  owner?: boolean;
  waiting?: number;
}

export function GroupLink({ id, name, members, owner = false, waiting = 0 }: GroupLinkProps) {
  return (
    <Link
      href={groupHref(id)}
      prefetch={false}
      className={cn(
        "group flex min-h-16 items-center gap-3 rounded-xl border border-silver/10 bg-ballroom/45 p-3 transition-colors hover:border-gold/35 hover:bg-ballroom/70 active:bg-ballroom",
        FOCUS,
      )}
    >
      <GroupMark name={name} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-semibold text-pearl group-hover:text-gold-light">{name}</span>
        {members && (
          <span className="text-xs text-silver-dim">
            {members.length} {members.length === 1 ? "member" : "members"}
            {owner && " · Owner"}
            {waiting > 0 && <span className="text-brand-magenta"> · {waiting} waiting</span>}
          </span>
        )}
      </span>
      {members && <AvatarStack people={members} size={24} max={3} />}
      <Chevron />
    </Link>
  );
}

export function Chevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-4.5 shrink-0 text-silver-dim transition-transform group-hover:translate-x-0.5 group-hover:text-gold-light"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}
