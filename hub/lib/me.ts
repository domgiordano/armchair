"use client";

import { useSyncExternalStore } from "react";

import { getMyProfile, type MyProfile } from "@/lib/api/profile";
import { writeWho } from "@armchair/app-core/auth/who";

// Header, hero and profile page all show the same /users/me, so it's fetched
// once and an edit on the profile page reaches the header straight away.

export type MeLoad = { kind: "loading" } | { kind: "ready"; me: MyProfile } | { kind: "error"; message: string };

const LOADING: MeLoad = { kind: "loading" };
let state: MeLoad = LOADING;
let inflight = false;
const listeners = new Set<() => void>();

function emit(next: MeLoad) {
  state = next;
  listeners.forEach((l) => l());
}

export function setMe(me: MyProfile) {
  // Labels the "Continue as" button here and in the show apps next time.
  writeWho({ name: me.name ?? me.email, picture: me.picture });
  emit({ kind: "ready", me });
}

export async function loadMe() {
  if (inflight) return;
  inflight = true;
  if (state.kind === "error") emit(LOADING);
  try {
    setMe(await getMyProfile());
  } catch (e) {
    emit({ kind: "error", message: e instanceof Error ? e.message : "Request failed" });
  } finally {
    inflight = false;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (state.kind === "loading") void loadMe();
  return () => {
    listeners.delete(listener);
  };
}

export function useMe(): MeLoad {
  return useSyncExternalStore(subscribe, () => state, () => LOADING);
}

export const firstName = (name: string | null) => name?.trim().split(/\s+/)[0] || "there";

/** Test seam. */
export function resetMe() {
  state = LOADING;
  inflight = false;
}
