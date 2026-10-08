"use client";

import { useEffect, useState } from "react";

import { getMyGroups, plays, type Group } from "@armchair/app-core/api/groups";

// The same key as the DWTS app: a group is family-wide, so the pick follows you.
const KEY = "armchair.group";

// Storage throws when it is disabled or full (Safari private mode among them);
// the pick then lasts only until the tab closes.
function readGroup(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveGroup(id: string | null): void {
  try {
    if (id === null) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, id);
  } catch {
    // See readGroup.
  }
}

export interface GroupFilter {
  groups: Group[] | null;
  failed: boolean;
  group: string | null;
  pick: (id: string | null) => void;
}

/**
 * The caller's groups and the one filtering the episode, remembered across
 * visits. A remembered group the caller isn't in reads as Everyone once the list arrives.
 */
export function useGroupFilter(): GroupFilter {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [picked, setPicked] = useState(readGroup);

  useEffect(() => {
    let cancelled = false;
    getMyGroups().then(
      // Only groups playing The Traitors have a board here.
      (g) => !cancelled && setGroups(g.filter((x) => plays(x, "traitors"))),
      () => !cancelled && setFailed(true),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const pick = (id: string | null) => {
    saveGroup(id);
    setPicked(id);
  };
  const group = groups !== null && !groups.some((g) => g.id === picked) ? null : picked;
  return { groups, failed, group, pick };
}
