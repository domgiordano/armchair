"use client";

export interface Notifications {
  unread: number;
}

// A stub until the notifications API lands; the header bell already reads it.
export function useNotifications(): Notifications {
  return { unread: 0 };
}
