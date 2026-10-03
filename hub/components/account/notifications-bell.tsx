"use client";

import { useEffect, useId, useRef, useState, type FocusEvent } from "react";

import { useNotifications } from "@/lib/notifications";

import { NotificationsPanel } from "./notifications-panel";
import { FOCUS } from "./ui";

/** The header's bell: an unread count, opening the notifications as a dropdown, or a bottom sheet on phones. */
export function NotificationsBell() {
  const { unread } = useNotifications();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (e.target instanceof Node && !root.current?.contains(e.target)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  // Tabbing out of the panel closes it, as clicking away does.
  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (e.relatedTarget instanceof Node && !root.current?.contains(e.relatedTarget)) setOpen(false);
  };

  return (
    <div ref={root} className="relative" onBlur={onBlur}>
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        onClick={() => setOpen((o) => !o)}
        className={`relative flex size-11 items-center justify-center rounded-full transition-colors hover:bg-line/60 hover:text-text active:bg-line motion-reduce:transition-none ${
          open ? "bg-line/60 text-gold" : "text-muted"
        } ${FOCUS}`}
      >
        <svg
          viewBox="0 0 24 24"
          className={`size-5.5 ${unread > 0 ? "bell-ring" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9ZM10 19.5a2.2 2.2 0 0 0 4 0" />
        </svg>
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute top-1 right-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-magenta px-1 text-[10px] font-bold text-night ring-2 ring-night tabular-nums"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="apps-backdrop fixed inset-0 z-40 bg-night/70 sm:hidden" aria-hidden="true" onClick={() => setOpen(false)} />
          <section
            id={panelId}
            aria-labelledby={titleId}
            className="bell-panel fixed inset-x-0 bottom-0 z-50 max-h-[80dvh] overflow-y-auto overscroll-contain rounded-t-3xl border-t border-line bg-night-2 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl shadow-night sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:bottom-auto sm:mt-2 sm:max-h-[min(36rem,80dvh)] sm:w-[26rem] sm:rounded-3xl sm:border sm:pb-3"
          >
            <span className="mx-auto mb-1 block h-1 w-10 rounded-full bg-line sm:hidden" aria-hidden="true" />
            <NotificationsPanel titleId={titleId} />
          </section>
        </>
      )}
    </div>
  );
}
