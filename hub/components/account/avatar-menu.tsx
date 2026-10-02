"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FocusEvent } from "react";

import { useAuth } from "@armchair/app-core/auth/use-auth";
import { dwtsLink } from "@/lib/links";
import { useMe } from "@/lib/me";

import { Avatar, FOCUS } from "./ui";

const ITEM = `flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 text-left text-sm font-medium text-text hover:bg-line/60 active:bg-line ${FOCUS}`;

/** The signed-in header's avatar, opening Profile and Sign out. */
export function AvatarMenu() {
  const load = useMe();
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();
  const me = load.kind === "ready" ? load.me : null;

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
    <div ref={root} className="relative ml-1" onBlur={onBlur}>
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={me ? `Account: ${me.name ?? me.email}` : "Account"}
        onClick={() => setOpen((o) => !o)}
        className={`flex size-11 items-center justify-center rounded-full ring-2 transition active:scale-95 motion-reduce:transition-none ${
          open ? "ring-gold" : "ring-line hover:ring-muted"
        } ${FOCUS}`}
      >
        {me ? (
          <Avatar name={me.name ?? me.email} picture={me.picture} size={40} decorative />
        ) : (
          <span aria-hidden="true" className="skeleton block size-10 rounded-full" />
        )}
      </button>
      {open && (
        <div
          id={id}
          className="account-menu absolute top-full right-0 z-50 mt-2 w-64 rounded-3xl border border-line bg-night-2 p-2 shadow-2xl shadow-night"
        >
          {me && (
            <div className="px-3 pt-2 pb-3">
              <p className="truncate text-sm font-semibold text-text">{me.name ?? "No name yet"}</p>
              <p className="truncate text-xs text-muted">{me.email}</p>
            </div>
          )}
          <ul className="border-t border-line pt-2">
            <li>
              <Link href="/profile/" onClick={() => setOpen(false)} className={ITEM}>
                Profile
              </Link>
            </li>
            <li>
              <a href={dwtsLink()} className={ITEM}>
                Open Dancing with the Stars
              </a>
            </li>
            <li>
              <button
                type="button"
                disabled={leaving}
                onClick={() => {
                  setLeaving(true);
                  // Amplify navigates to Cognito's /logout and back to the hub.
                  signOut().catch(() => setLeaving(false));
                }}
                className={`${ITEM} text-muted hover:text-text disabled:opacity-60`}
              >
                {leaving ? "Signing out..." : "Sign out"}
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
