"use client";

import { useEffect, useState } from "react";

import { getMyGroups, plays, type Group, type ShowApp } from "../api/groups";

/** Everyone is no scope at all: null. Friends is this word; anything else is a group id. */
export const FRIENDS = "friends";
export const EVERYONE = "Everyone";

// One key for every show: a group is family-wide, so picking it on one page or app carries
// to the rest, and leaving it on one leaves it everywhere.
const KEY = "armchair.group";

// Storage throws when it is disabled or full (Safari private mode among them);
// the pick then lasts only until the tab closes.
export function readScope(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveScope(scope: string | null): void {
  try {
    if (scope === null) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, scope);
  } catch {
    // See readScope.
  }
}

export interface GroupScope {
  /** The caller's groups playing this show; null while loading. */
  groups: Group[] | null;
  failed: boolean;
  /** Whether this page can show Friends. */
  friends: boolean;
  /** null for Everyone, FRIENDS, or a group id. */
  scope: string | null;
  /** The scoped group's id; null for Everyone and Friends. */
  group: string | null;
  pick: (scope: string | null) => void;
}

interface Options {
  friends?: boolean;
  /** A scope the URL names, which wins over the saved one and becomes it. */
  asked?: string | null;
}

/**
 * The scope every page shares. A saved scope this page can't show (Friends where there's no
 * Friends, a group the caller isn't in) reads as Everyone without being forgotten.
 */
export function useGroupScope(app: ShowApp, { friends = false, asked }: Options = {}): GroupScope {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [picked, setPicked] = useState(readScope);

  useEffect(() => {
    let cancelled = false;
    getMyGroups().then(
      (g) => !cancelled && setGroups(g.filter((x) => plays(x, app))),
      () => !cancelled && setFailed(true),
    );
    return () => {
      cancelled = true;
    };
  }, [app]);

  useEffect(() => {
    if (asked !== undefined) saveScope(asked);
  }, [asked]);

  const pick = (next: string | null) => {
    saveScope(next);
    setPicked(next);
  };
  const raw = asked === undefined ? picked : asked;
  const known = raw === FRIENDS ? friends : !failed && (groups === null || groups.some((g) => g.id === raw));
  const scope = raw !== null && known ? raw : null;
  return { groups, failed, friends, scope, group: scope === FRIENDS ? null : scope, pick };
}

/** "Everyone", "Friends" or the group's name, for the control and for headings. */
export function scopeName(scope: string | null, groups: Group[] | null): string {
  if (scope === null) return EVERYONE;
  if (scope === FRIENDS) return "Friends";
  return groups?.find((g) => g.id === scope)?.name ?? EVERYONE;
}

/** The control's options, in the one order every page uses. Everyone's value is "". */
export function scopeOptions({ groups, friends }: Pick<GroupScope, "groups" | "friends">) {
  return [
    { value: "", label: EVERYONE },
    ...(friends ? [{ value: FRIENDS, label: "Friends" }] : []),
    ...(groups ?? []).map((g) => ({ value: g.id, label: g.name })),
  ];
}
