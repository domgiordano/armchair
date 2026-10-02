"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { AppsIcon } from "@/components/ui/icons";
import { appHref } from "@/lib/apps";
import { cn, EYEBROW, FOCUS, ICON_BUTTON } from "@/lib/ui";
import { APPS, type App } from "@armchair/app-core/apps";

const ROW = `${FOCUS} flex min-h-14 flex-col justify-center rounded-sm px-3 py-1.5 transition-colors`;

/** The header's list of every Armchair Judge app; the others open already signed in. */
export function AppsMenu({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (e: Event) => !root.current?.contains(e.target as Node) && setOpen(false);
    const escape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div ref={root} className={cn("relative", className)}>
      <button
        ref={trigger}
        type="button"
        aria-label="Armchair Judge apps"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={ICON_BUTTON}
      >
        <AppsIcon />
      </button>
      {open && (
        <div className="absolute top-full right-0 z-40 mt-2 flex w-80 max-w-[calc(100vw-1rem)] flex-col gap-1 rounded-sm border border-gilt/50 bg-stone p-1.5 shadow-xl shadow-night/70 animate-pop-in">
          <p className={cn(EYEBROW, "px-3 pt-1.5 pb-1")}>Armchair Judge apps</p>
          <AppList onPick={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

/** The apps as rows: the header menu's list, and the phone menu's. */
export function AppList({ onPick }: { onPick: () => void }) {
  return (
    <ul className="flex flex-col gap-0.5">
      {APPS.map((app) => (
        <li key={app.id}>
          <Entry app={app} onPick={onPick} />
        </li>
      ))}
    </ul>
  );
}

function Entry({ app, onPick }: { app: App; onPick: () => void }) {
  const href = appHref(app);
  const here = app.id === "traitors";
  const body = (
    <>
      <span className="flex items-center gap-2 font-display text-sm font-semibold tracking-[0.06em] text-bone">
        {app.name}
        {here && <span className="text-[11px] tracking-[0.14em] text-candle uppercase">You&apos;re here</span>}
      </span>
      <span className="text-sm leading-snug text-ash">{app.line}</span>
    </>
  );
  if (!href) return <div className={cn(ROW, "opacity-70")}>{body}</div>;
  if (here) {
    return (
      <Link href={href} aria-current="page" onClick={onPick} className={cn(ROW, "bg-cloak/60 hover:bg-cloak active:bg-cloak-500")}>
        {body}
      </Link>
    );
  }
  return (
    <a href={href} className={cn(ROW, "hover:bg-cloak active:bg-cloak/70")}>
      {body}
    </a>
  );
}
