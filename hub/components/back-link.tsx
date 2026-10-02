"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { FOCUS } from "@/components/account/ui";
import { canGoBack, trackHistory } from "@/lib/back";
import { TABS } from "@/lib/tabs";

const bare = (path: string) => path.replace(/\/+$/, "") || "/";

/**
 * Back through the hub's history, or home when there is none. Every hub page
 * hangs off the home page, so that is the only parent. Nothing on the tabs.
 */
export function BackLink() {
  // Null outside the app router, as in unit tests.
  const pathname = usePathname() ?? "/";
  useEffect(trackHistory, [pathname]);
  if (TABS.some((t) => bare(t.href) === bare(pathname))) return null;

  return (
    <Link
      key={pathname}
      href="/"
      aria-label="Back"
      onClick={(e) => {
        if (!canGoBack()) return;
        e.preventDefault();
        window.history.back();
      }}
      className={`back-in group flex first:-ml-2 size-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-line/60 hover:text-text active:bg-line motion-reduce:transition-none ${FOCUS}`}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-5.5 transition-transform duration-200 group-hover:-translate-x-0.5 group-active:-translate-x-1 motion-reduce:transition-none"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </Link>
  );
}
