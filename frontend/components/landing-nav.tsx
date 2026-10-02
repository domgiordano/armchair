"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { CloseIcon, MenuIcon } from "@/components/app-shell";
import { AppList } from "@/components/app-list";
import { AppsMenu } from "@/components/apps-menu";
import { Brand } from "@/components/brand";
import { GoogleMark } from "@/components/google-mark";
import { NavSheet } from "@/components/nav-sheet";
import { button, FOCUS } from "@/lib/ui";

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#accuracy", label: "Scoring" },
  { href: "/discover/", label: "Discover" },
];

const ICON_BUTTON = `flex size-11 shrink-0 items-center justify-center rounded-full text-silver transition-colors hover:bg-silver/10 hover:text-pearl active:bg-silver/15 ${FOCUS}`;

// The underline grows out from the middle, like the signed-in tabs.
const TOP_LINK = `relative flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-silver-dim transition-colors hover:text-pearl active:text-silver after:absolute after:inset-x-3 after:bottom-1.5 after:h-0.5 after:origin-center after:scale-x-0 after:rounded-full after:bg-gold after:transition-transform after:duration-300 hover:after:scale-x-100 motion-reduce:after:transition-none ${FOCUS}`;

const SHEET_LINK = `flex min-h-12 items-center rounded-md px-3 text-base font-medium text-silver transition-colors hover:bg-ballroom/60 hover:text-pearl active:bg-ballroom ${FOCUS}`;

interface LandingNavProps {
  disabled: boolean;
  onSignIn: () => void;
}

/** The signed-out header: brand, the page's links, the apps, and Sign in. A sheet holds the links on phones. */
export function LandingNav({ disabled, onSignIn }: LandingNavProps) {
  const [open, setOpen] = useState(false);
  const hamburger = useRef<HTMLButtonElement>(null);

  const close = () => {
    setOpen(false);
    hamburger.current?.focus();
  };

  return (
    <header className="sticky top-0 z-20 border-b border-silver/10 bg-ink/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-2 py-1.5 sm:px-4">
        <button
          ref={hamburger}
          type="button"
          aria-label="Open menu"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className={`${ICON_BUTTON} md:hidden`}
        >
          <MenuIcon />
        </button>
        <Brand />
        <nav aria-label="Main" className="ml-auto hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={TOP_LINK}>
              {l.label}
            </Link>
          ))}
          <AppsMenu />
        </nav>
        <button
          type="button"
          onClick={onSignIn}
          disabled={disabled}
          aria-label="Sign in with Google"
          className={`${button("secondary", "sm")} ml-auto size-11 px-0 md:ml-2 md:w-auto md:px-4`}
        >
          <GoogleMark />
          <span className="hidden md:inline" aria-hidden="true">
            Sign in
          </span>
        </button>
      </div>

      <NavSheet open={open} onClose={close}>
        <div className="-mx-2 -mt-1.5 flex items-center gap-2">
          <button type="button" aria-label="Close menu" onClick={close} className={ICON_BUTTON}>
            <CloseIcon />
          </button>
          <Brand />
        </div>
        <nav aria-label="Main">
          <ul className="flex flex-col gap-1">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} onClick={() => setOpen(false)} className={SHEET_LINK}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <AppList />
        <div className="mt-auto flex flex-col gap-3">
          <button
            type="button"
            onClick={onSignIn}
            disabled={disabled}
            className={button("primary")}
          >
            <GoogleMark />
            Sign in with Google
          </button>
        </div>
      </NavSheet>
    </header>
  );
}
