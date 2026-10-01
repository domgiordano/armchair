"use client";

import { useSyncExternalStore } from "react";

// Reads the <html data-account> hint lib/account-hint-script.ts sets.

const noSubscribe = () => () => {};

export function useAccountHint(): boolean {
  return useSyncExternalStore(noSubscribe, () => document.documentElement.dataset.account === "1", () => false);
}

export function clearAccountHint() {
  delete document.documentElement.dataset.account;
}
