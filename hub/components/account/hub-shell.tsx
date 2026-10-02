"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";

import { rememberReturn } from "@armchair/app-core/auth/return-to";
import { useAuth } from "@armchair/app-core/auth/use-auth";

import { ChairLoader } from "@/components/chair-loader";
import { ChairMark } from "@/components/chair-mark";
import { GoogleMark } from "@/components/google-mark";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TABS } from "@/lib/tabs";

import { AppLinks } from "./app-links";
import { NavSheet } from "./nav-sheet";
import { FOCUS, PRIMARY } from "./ui";

const isActive = (href: string, pathname: string) => {
  const path = pathname.replace(/\/+$/, "") || "/";
  return href === "/" ? path === "/" : path === href.replace(/\/+$/, "");
};

const ICON_BUTTON = `flex size-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-line/60 hover:text-text active:bg-line ${FOCUS}`;

interface HubShellProps {
  children: ReactNode;
}

/** Header, tabs and footer around the hub's pages. The tabs only show once signed in. */
export function HubShell({ children }: HubShellProps) {
  const { status } = useAuth();
  // Null outside the app router, as in unit tests.
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const hamburger = useRef<HTMLButtonElement>(null);
  const signedIn = status === "signedIn";

  const close = () => {
    setOpen(false);
    hamburger.current?.focus();
  };

  return (
    <div id="page" className="flex min-h-dvh flex-col">
      <SiteHeader
        sections={false}
        menu={
          signedIn && (
            <button
              ref={hamburger}
              type="button"
              aria-label="Open menu"
              aria-expanded={open}
              onClick={() => setOpen(true)}
              className={`${ICON_BUTTON} -ml-2 md:hidden`}
            >
              <svg viewBox="0 0 24 24" className="size-5.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
          )
        }
        tabs={signedIn && <Tabs pathname={pathname} />}
      />
      {signedIn && (
        <NavSheet open={open} onClose={close}>
          <div className="-mx-1 -mt-1 flex items-center gap-2">
            <button type="button" aria-label="Close menu" onClick={close} className={ICON_BUTTON}>
              <svg viewBox="0 0 24 24" className="size-5.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
            <ChairMark className="h-8 w-8" />
            <span className="font-bold tracking-tight">
              Armchair <span className="text-brand-gradient">Judge</span>
            </span>
          </div>
          <nav aria-label="Main">
            <ul className="flex flex-col gap-1">
              {[...TABS, { href: "/profile/", label: "Profile" }].map((t) => {
                const active = isActive(t.href, pathname);
                return (
                  <li key={t.href}>
                    <Link
                      href={t.href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setOpen(false)}
                      className={`flex min-h-12 items-center rounded-2xl border-l-2 px-4 text-base font-medium transition-colors ${FOCUS} ${
                        active
                          ? "border-gold bg-line/60 text-text"
                          : "border-transparent text-muted hover:bg-line/40 hover:text-text active:bg-line/60"
                      }`}
                    >
                      {t.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="mt-auto flex flex-col gap-1">
            <p className="px-1 text-[11px] font-semibold tracking-[0.25em] text-muted uppercase">Apps</p>
            <AppLinks />
          </div>
        </NavSheet>
      )}
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 pt-8 pb-20 outline-none sm:px-6 sm:pt-10">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

function Tabs({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Main" className="mx-auto hidden max-w-6xl px-4 md:block sm:px-6">
      <ul className="-mx-3 flex gap-1">
        {TABS.map((t) => {
          const active = isActive(t.href, pathname);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-11 items-center rounded-t-xl px-3 text-sm font-medium whitespace-nowrap transition-colors ${FOCUS} after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:origin-center after:rounded-full after:transition-transform after:duration-300 motion-reduce:after:transition-none ${
                  active
                    ? "text-text after:scale-x-100 after:bg-linear-to-r after:from-blue after:via-magenta after:to-orange"
                    : "text-muted after:scale-x-0 after:bg-muted/60 hover:text-text hover:after:scale-x-100 active:text-text"
                }`}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

interface SignedInPageProps {
  /** Over the sign-in prompt: "Your stats". */
  eyebrow: string;
  /** What signing in shows here. */
  pitch: string;
  children: ReactNode;
}

/** A tab page: its content once signed in, a sign-in prompt before. UX only; the API refuses a missing token. */
export function SignedInPage({ eyebrow, pitch, children }: SignedInPageProps) {
  const { status } = useAuth();
  return (
    <HubShell>
      {status === "loading" && (
        <div className="grid place-items-center py-24">
          <ChairLoader className="size-20" label="Loading" />
        </div>
      )}
      {status === "unconfigured" && <p className="text-muted">Sign-in is not configured in this build.</p>}
      {status === "signedOut" && <SignInWall eyebrow={eyebrow} pitch={pitch} />}
      {status === "signedIn" && children}
    </HubShell>
  );
}

export function SignInWall({ eyebrow, pitch }: { eyebrow: string; pitch: string }) {
  const { signInWithGoogle } = useAuth();
  return (
    <div className="rise mx-auto flex max-w-2xl flex-col items-start gap-5 py-8">
      <p className="text-xs font-semibold tracking-[0.3em] text-gold uppercase">{eyebrow}</p>
      <h1 className="text-4xl font-extrabold tracking-tight">
        Take your <span className="text-brand-gradient">seat.</span>
      </h1>
      <p className="text-muted">{pitch}</p>
      <button type="button" onClick={() => {
          rememberReturn();
          void signInWithGoogle();
        }} className={PRIMARY}>
        <GoogleMark className="h-4 w-4" />
        Sign in with Google
      </button>
    </div>
  );
}
