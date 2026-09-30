"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";

import { Avatar } from "@/components/avatar";
import { Brand } from "@/components/brand";
import { NavSheet } from "@/components/nav-sheet";
import { NotificationsBell } from "@/components/notifications";
import { Popover } from "@/components/popover";
import { getMe, type Me } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/use-auth";
import { SEASONS, seasonLabel, useSeasonId, withSeason } from "@/lib/show/seasons";

export const HUB_URL = "https://armchairjudge.com";

interface Tab {
  href: string;
  label: string;
  // Path prefixes that light this tab up; /groups/ and /join/ live under Friends & Groups.
  match: string[];
}

export const TABS: Tab[] = [
  { href: "/", label: "Overview", match: ["/"] },
  { href: "/episode/", label: "Episodes", match: ["/episode"] },
  { href: "/leaderboard/", label: "Leaderboard", match: ["/leaderboard"] },
  { href: "/stats/", label: "Stats", match: ["/stats"] },
  { href: "/friends/", label: "Friends & Groups", match: ["/friends", "/groups", "/join"] },
  { href: "/profile/", label: "Profile", match: ["/profile"] },
];

export function activeTab(pathname: string): Tab | undefined {
  const path = pathname.replace(/\/+$/, "") || "/";
  return TABS.find((t) =>
    t.match.some((m) => (m === "/" ? path === "/" : path === m || path.startsWith(`${m}/`))),
  );
}

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300";
const ICON_BUTTON = `relative flex size-11 shrink-0 items-center justify-center rounded-full text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100 active:bg-neutral-700 ${FOCUS}`;
const PANEL_ITEM = `flex min-h-11 w-full items-center rounded-md px-3 text-left text-sm text-neutral-200 hover:bg-neutral-800 active:bg-neutral-700 ${FOCUS}`;

interface AppShellProps {
  // Names the main landmark; the active tab already says where you are.
  title: string;
  // Dashboard pages take the header's full width; forms and scorecards stay phone-width.
  wide?: boolean;
  children: ReactNode;
}

/** Header, tabs and phone menu around every signed-in page. Callers handle the sign-in wall. */
export function AppShell({ title, wide = false, children }: AppShellProps) {
  // The season lives in the query string, which a static export only has on the client.
  return (
    <Suspense>
      <Shell title={title} wide={wide}>
        {children}
      </Shell>
    </Suspense>
  );
}

function Shell({ title, wide, children }: AppShellProps) {
  const pathname = usePathname();
  const season = useSeasonId();
  const current = activeTab(pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  const hamburger = useRef<HTMLButtonElement>(null);

  const closeMenu = () => {
    setMenuOpen(false);
    hamburger.current?.focus();
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className={`sr-only z-50 rounded-md bg-amber-300 px-4 py-2 font-medium text-amber-950 focus:not-sr-only focus:fixed focus:top-2 focus:left-2 ${FOCUS}`}
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-20 border-b border-neutral-800 bg-ink/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-2 py-1.5 sm:px-4">
          <button
            ref={hamburger}
            type="button"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
            className={`${ICON_BUTTON} md:hidden`}
          >
            <MenuIcon />
          </button>
          <Brand />
          <div className="ml-2 hidden md:block">
            <SeasonPicker season={season} />
          </div>
          <div className="ml-auto flex items-center gap-1">
            <div className="hidden md:block">
              <AppsMenu />
            </div>
            <NotificationsBell />
            <AccountMenu />
          </div>
        </div>
        <nav aria-label="Main" className="mx-auto hidden max-w-6xl px-2 md:block lg:px-4">
          <ul className="flex gap-1">
            {TABS.map((t) => (
              <li key={t.href}>
                <TabLink tab={t} season={season} active={t === current} />
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <NavSheet open={menuOpen} onClose={closeMenu}>
        {/* Close sits where the hamburger was, and comes first so the dialog focuses it on open. */}
        <div className="-mx-2 -mt-1.5 flex items-center gap-2">
          <button type="button" aria-label="Close menu" onClick={closeMenu} className={ICON_BUTTON}>
            <CloseIcon />
          </button>
          <Brand />
        </div>
        <nav aria-label="Main">
          <ul className="flex flex-col gap-1">
            {TABS.map((t) => (
              <li key={t.href}>
                <Link
                  href={withSeason(t.href, season)}
                  aria-current={t === current ? "page" : undefined}
                  onClick={() => setMenuOpen(false)}
                  className={`flex min-h-12 items-center rounded-md border-l-2 px-3 text-base font-medium ${FOCUS} ${
                    t === current
                      ? "border-gold bg-ballroom text-gold-light"
                      : "border-transparent text-neutral-300 hover:bg-neutral-900 hover:text-neutral-100 active:bg-neutral-800"
                  }`}
                >
                  {t.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <SeasonPicker season={season} />
        <a
          href={HUB_URL}
          className={`mt-auto flex min-h-11 items-center gap-2 rounded-md text-sm text-neutral-400 hover:text-neutral-200 ${FOCUS}`}
        >
          More shows on Armchair Judge
          <ArrowIcon />
        </a>
      </NavSheet>
      <main
        id="main"
        aria-label={title}
        aria-live="polite"
        className={`mx-auto flex w-full flex-1 flex-col gap-4 px-4 py-6 ${wide ? "max-w-6xl sm:px-6" : "max-w-md"}`}
      >
        {children}
      </main>
    </div>
  );
}

function TabLink({ tab, season, active }: { tab: Tab; season: string; active: boolean }) {
  return (
    <Link
      href={withSeason(tab.href, season)}
      aria-current={active ? "page" : undefined}
      className={`relative flex min-h-11 items-center rounded-t-md px-3 text-sm font-medium whitespace-nowrap ${FOCUS} after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full ${
        active
          ? "text-gold-light after:bg-gold"
          : "text-neutral-400 after:bg-transparent hover:text-neutral-100 hover:after:bg-neutral-600 active:text-neutral-200"
      }`}
    >
      {tab.label}
    </Link>
  );
}

function SeasonPicker({ season }: { season: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const options = SEASONS.some((s) => s.id === season) ? SEASONS : [...SEASONS, { id: season, label: seasonLabel(season) }];

  return (
    <label className="flex items-center gap-2 text-sm text-neutral-400">
      Season
      <select
        value={season}
        // A new season drops the other params: episode 7 of one season isn't episode 7 of another.
        onChange={(e) => router.push(withSeason(pathname, e.target.value))}
        className={`min-h-11 rounded-md border border-neutral-700 bg-neutral-900 px-3 text-sm text-neutral-100 hover:border-neutral-500 md:min-h-9 ${FOCUS}`}
      >
        {options.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label.replace(/^Season /, "")}
          </option>
        ))}
      </select>
    </label>
  );
}

function AppsMenu() {
  return (
    <Popover
      label="Apps"
      trigger={
        <>
          <GridIcon />
          <span className="text-sm font-medium">Apps</span>
        </>
      }
      triggerClassName={`flex min-h-11 items-center gap-2 rounded-md px-3 text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100 active:bg-neutral-700 aria-expanded:bg-neutral-800 ${FOCUS}`}
    >
      <p className="px-3 pt-1.5 pb-1 text-xs font-semibold tracking-[0.12em] text-silver-dim uppercase">Armchair Judge</p>
      <span aria-current="page" className="flex min-h-11 items-center justify-between gap-3 rounded-md px-3 text-sm text-gold-light">
        Dancing with the Stars
        <span className="text-xs text-silver-dim">You&apos;re here</span>
      </span>
      <a href={HUB_URL} className={`${PANEL_ITEM} justify-between gap-3`}>
        All shows
        <ArrowIcon />
      </a>
    </Popover>
  );
}

function AccountMenu() {
  const router = useRouter();
  const { signOut } = useAuth();
  const me = useMe();

  return (
    <Popover
      label="Account"
      trigger={
        me ? (
          <Avatar name={me.name} email={me.email} picture={me.picture} />
        ) : (
          <span className="size-9 rounded-full bg-neutral-800" />
        )
      }
      triggerClassName={`flex size-11 items-center justify-center rounded-full hover:bg-neutral-800 active:bg-neutral-700 ${FOCUS}`}
    >
      {me && (
        <p className="truncate border-b border-neutral-800 px-3 pt-1.5 pb-2.5 text-sm font-medium text-neutral-100">
          {me.name ?? me.email}
        </p>
      )}
      <Link href="/profile/" className={PANEL_ITEM}>
        Profile
      </Link>
      <button
        type="button"
        onClick={() => {
          void signOut().then(() => router.push("/"));
        }}
        className={PANEL_ITEM}
      >
        Sign out
      </button>
    </Popover>
  );
}

/** The signed-in user for the avatar; null while loading or if /users/me fails, which the avatar can live without. */
function useMe(): Me | null {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    let cancelled = false;
    getMe().then(
      (m) => !cancelled && setMe(m),
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, []);
  return me;
}

const ICON = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

function MenuIcon() {
  return (
    <svg {...ICON}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg {...ICON}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg {...ICON} width={18} height={18}>
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <rect x="14" y="14" width="6" height="6" rx="1" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg {...ICON} width={16} height={16}>
      <path d="M7 17 17 7M9 7h8v8" />
    </svg>
  );
}
