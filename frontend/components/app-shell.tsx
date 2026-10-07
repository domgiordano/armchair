"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";

import { Avatar } from "@/components/avatar";
import { AppList } from "@/components/app-list";
import { AppsMenu } from "@/components/apps-menu";
import { Brand } from "@/components/brand";
import { NavSheet } from "@/components/nav-sheet";
import { NotificationsBell } from "@/components/notifications";
import { SiteFooter } from "@/components/site-footer";
import { HeaderSearch } from "@/components/search/header-search";
import { Menu, MenuItem } from "@/components/ui/menu";
import { Select } from "@/components/ui/select";
import { Specks } from "@/components/ui/specks";
import { ToastProvider } from "@/components/ui/toast";
import { getMe, type Me } from "@armchair/app-core/api/client";
import { prefetchPage } from "@/lib/api/prefetch";
import { useAuth } from "@armchair/app-core/auth/use-auth";
import { canGoBack, parentOf, trackHistory } from "@/lib/nav/back";
import { SEASONS, seasonLabel, useSeasonId, withSeason } from "@/lib/show/seasons";
import { FOCUS } from "@/lib/ui";

interface Tab {
  href: string;
  label: string;
  // Path prefixes that light this tab up.
  match: string[];
}

export const TABS: Tab[] = [
  { href: "/", label: "Overview", match: ["/"] },
  { href: "/episode/", label: "Score", match: ["/episode"] },
  { href: "/leaderboard/", label: "Leaderboard", match: ["/leaderboard"] },
  { href: "/stats/", label: "Stats", match: ["/stats"] },
  { href: "/couples/", label: "Couples", match: ["/couples"] },
  { href: "/discover/", label: "Discover", match: ["/discover", "/people"] },
];

const bare = (path: string) => path.replace(/\/+$/, "") || "/";

export function activeTab(pathname: string): Tab | undefined {
  const path = bare(pathname);
  return TABS.find((t) =>
    t.match.some((m) => (m === "/" ? path === "/" : path === m || path.startsWith(`${m}/`))),
  );
}

const ICON_BUTTON = `relative flex size-11 shrink-0 items-center justify-center rounded-full text-silver transition-colors hover:bg-silver/10 hover:text-pearl active:bg-silver/15 aria-expanded:bg-silver/10 ${FOCUS}`;

interface AppShellProps {
  // Names the main landmark; the active tab already says where you are.
  title: string;
  // Pages with a desktop layout take the header's full width; the rest stay a reading column.
  wide?: boolean;
  children: ReactNode;
}

/** Header, tabs and phone menu around every signed-in page. Callers handle the sign-in wall. */
export function AppShell({ title, wide = false, children }: AppShellProps) {
  // The season lives in the query string, which a static export only has on the client.
  return (
    <Suspense>
      <ToastProvider>
        <Shell title={title} wide={wide}>
          {children}
        </Shell>
      </ToastProvider>
    </Suspense>
  );
}

function Shell({ title, wide, children }: AppShellProps) {
  const pathname = usePathname();
  const params = useSearchParams();
  const search = params.toString();
  const season = useSeasonId();
  const current = activeTab(pathname);
  // Score is a tab, but every scorecard link lands on it, so it keeps a way back.
  const back = bare(pathname) === "/episode" || !TABS.some((t) => bare(t.href) === bare(pathname));
  const [menuOpen, setMenuOpen] = useState(false);
  const hamburger = useRef<HTMLButtonElement>(null);

  // Effects run child first, so the page's own first reads are already in
  // flight and this adds the ones it would only make after its season loads.
  useEffect(() => prefetchPage(`${pathname}?${search}`, season), [pathname, search, season]);
  useEffect(trackHistory, [pathname, search]);

  const closeMenu = () => {
    setMenuOpen(false);
    hamburger.current?.focus();
  };

  return (
    <div className="relative isolate flex min-h-dvh flex-col">
      <Specks />
      <a
        href="#main"
        className={`sr-only z-50 rounded-md bg-gold px-4 py-2 font-medium text-ink focus:not-sr-only focus:fixed focus:top-2 focus:left-2 ${FOCUS}`}
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-20 border-b border-silver/10 bg-ink/85 backdrop-blur-md">
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
          {back && <BackLink key={pathname} parent={parentOf(pathname, params, season)} />}
          <Brand compact={back} />
          <div className="ml-2 hidden md:block">
            <SeasonPicker season={season} />
          </div>
          <div className="ml-auto flex items-center gap-1">
            <HeaderSearch buttonClassName={ICON_BUTTON} />
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
                  onPointerEnter={() => prefetchPage(t.href, season)}
                  onClick={() => setMenuOpen(false)}
                  className={`flex min-h-12 items-center rounded-md border-l-2 px-3 text-base font-medium transition-colors ${FOCUS} ${
                    t === current
                      ? "border-gold bg-ballroom text-gold-light"
                      : "border-transparent text-silver hover:bg-ballroom/60 hover:text-pearl active:bg-ballroom"
                  }`}
                >
                  {t.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <SeasonPicker season={season} />
        <div className="mt-auto">
          <AppList />
        </div>
      </NavSheet>
      <main
        id="main"
        aria-label={title}
        aria-live="polite"
        className={`mx-auto flex w-full flex-1 animate-page-in flex-col gap-4 px-4 py-6 sm:px-6 ${wide ? "max-w-6xl lg:py-8" : "max-w-md md:max-w-2xl"}`}
      >
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

/** Back through this site's history, or a plain link up to the page's parent when there is none. */
function BackLink({ parent }: { parent: string }) {
  return (
    <Link
      href={parent}
      aria-label="Back"
      onClick={(e) => {
        if (!canGoBack()) return;
        e.preventDefault();
        window.history.back();
      }}
      className={`${ICON_BUTTON} group animate-back-in`}
    >
      <svg {...ICON} className="transition-transform duration-200 group-hover:-translate-x-0.5 group-active:-translate-x-1">
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </Link>
  );
}

function TabLink({ tab, season, active }: { tab: Tab; season: string; active: boolean }) {
  return (
    <Link
      href={withSeason(tab.href, season)}
      aria-current={active ? "page" : undefined}
      onPointerEnter={() => prefetchPage(tab.href, season)}
      onFocus={() => prefetchPage(tab.href, season)}
      className={`relative flex min-h-11 items-center rounded-t-md px-3 text-sm font-medium whitespace-nowrap transition-colors ${FOCUS} after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:origin-center after:rounded-full after:transition-transform after:duration-300 ${
        active
          ? "text-gold-light after:scale-x-100 after:bg-gold after:shadow-[0_0_10px_rgb(232_194_104/0.7)]"
          : "text-silver-dim after:scale-x-0 after:bg-silver/50 hover:text-pearl hover:after:scale-x-100 active:text-silver"
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
    <Select
      label="Season"
      inline
      compact
      value={season}
      options={options.map((s) => ({ value: s.id, label: s.label }))}
      // A new season drops the other params: episode 7 of one season isn't episode 7 of another.
      onChange={(id) => router.push(withSeason(pathname, id))}
    />
  );
}

function AccountMenu() {
  const router = useRouter();
  const { signOut } = useAuth();
  const me = useMe();

  return (
    <Menu
      label="Account"
      trigger={
        me ? (
          <Avatar name={me.name} email={me.email} picture={me.picture} />
        ) : (
          <span className="size-9 rounded-full skeleton" />
        )
      }
      triggerClassName={`flex size-11 items-center justify-center rounded-full transition-colors hover:bg-silver/10 active:bg-silver/15 aria-expanded:bg-silver/10 ${FOCUS}`}
    >
      {me && (
        <p className="truncate border-b border-silver/10 px-3 pt-1.5 pb-2.5 text-sm font-medium text-pearl">
          {me.name ?? me.email}
        </p>
      )}
      <MenuItem href="/profile/">Your profile</MenuItem>
      <MenuItem onSelect={() => void signOut().then(() => router.push("/"))}>Sign out</MenuItem>
    </Menu>
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

export function MenuIcon() {
  return (
    <svg {...ICON}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg {...ICON}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
