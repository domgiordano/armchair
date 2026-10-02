"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";

import { SeasonProvider, useShellSeason } from "@/components/season-provider";
import { Avatar } from "@/components/ui/avatar";
import { EmberGlow } from "@/components/ui/ember-glow";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { SkeletonList } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { TartanBand } from "@/components/ui/tartan-band";
import { ToastProvider } from "@/components/ui/toast";
import { seasonLabel, withSeason, type Edition } from "@/lib/seasons";
import { cn, FOCUS } from "@/lib/ui";
import { getMe, type Me } from "@armchair/app-core/api/client";
import { useAuth } from "@armchair/app-core/auth/use-auth";

interface Tab {
  href: string;
  label: string;
  // Path prefixes that light this tab up.
  match: string[];
}

export const TABS: Tab[] = [
  { href: "/", label: "Overview", match: ["/"] },
  { href: "/episodes/", label: "Episodes", match: ["/episodes", "/episode"] },
  { href: "/leaderboard/", label: "Leaderboard", match: ["/leaderboard"] },
  { href: "/stats/", label: "Stats", match: ["/stats"] },
  { href: "/players/", label: "Players", match: ["/players"] },
];

const bare = (path: string) => path.replace(/\/+$/, "") || "/";

export function activeTab(pathname: string): Tab | undefined {
  const path = bare(pathname);
  return TABS.find((t) => t.match.some((m) => (m === "/" ? path === "/" : path === m || path.startsWith(`${m}/`))));
}

const ICON_BUTTON = `${FOCUS} relative flex size-11 shrink-0 items-center justify-center rounded-sm text-parchment transition-colors hover:bg-cloak hover:text-bone active:bg-cloak/70 aria-expanded:bg-cloak`;

interface AppShellProps {
  // Names the main landmark; the active tab already says where you are.
  title: string;
  children: ReactNode;
}

/** Header, tabs and phone menu around every signed-in page. Callers handle the sign-in wall. */
export function AppShell({ title, children }: AppShellProps) {
  // The season lives in the query string, which a static export only has on the client.
  return (
    <Suspense>
      <ToastProvider>
        <SeasonProvider>
          <Shell title={title}>{children}</Shell>
        </SeasonProvider>
      </ToastProvider>
    </Suspense>
  );
}

function Shell({ title, children }: AppShellProps) {
  const pathname = usePathname();
  const { season, failed, retry } = useShellSeason();
  const current = activeTab(pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  const hamburger = useRef<HTMLButtonElement>(null);
  const href = (path: string) => (season ? withSeason(path, season) : path);

  const closeMenu = () => {
    setMenuOpen(false);
    hamburger.current?.focus();
  };

  return (
    <div className="relative isolate flex min-h-dvh flex-col">
      <EmberGlow />
      <a
        href="#main"
        className={`${FOCUS} sr-only z-50 rounded-sm bg-candle px-4 py-2 font-display text-night focus:not-sr-only focus:fixed focus:top-2 focus:left-2`}
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-20 bg-night/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-2 py-1.5 sm:px-4">
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
          <Link href={href("/")} className={`${FOCUS} rounded-sm px-1 font-title text-2xl font-bold text-bone sm:text-3xl`}>
            Traitors
          </Link>
          <div className="ml-4 hidden w-56 md:block">
            <SeasonPicker hideLabel />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <EditionToggle />
            <AccountMenu />
          </div>
        </div>
        <nav aria-label="Main" className="mx-auto hidden max-w-5xl px-2 md:block lg:px-4">
          <ul className="flex gap-1">
            {TABS.map((t) => (
              <li key={t.href}>
                <Link
                  href={href(t.href)}
                  aria-current={t === current ? "page" : undefined}
                  className={cn(
                    FOCUS,
                    "relative flex min-h-11 items-center px-3 font-display text-sm font-semibold tracking-[0.12em] uppercase transition-colors after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:origin-center after:transition-transform after:duration-300",
                    t === current
                      ? "text-candle after:scale-x-100 after:bg-candle after:shadow-[0_0_10px_rgb(233_185_73/0.8)]"
                      : "text-ash after:scale-x-0 after:bg-gilt hover:text-bone hover:after:scale-x-100 active:text-parchment",
                  )}
                >
                  {t.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <TartanBand />
      </header>

      <Sheet open={menuOpen} onClose={closeMenu} label="Menu" side="left">
        {/* Close sits where the hamburger was, and comes first so the dialog focuses it on open. */}
        <div className="-mx-2 -mt-1.5 flex items-center gap-2">
          <button type="button" aria-label="Close menu" onClick={closeMenu} className={ICON_BUTTON}>
            <CloseIcon />
          </button>
          <span className="font-title text-2xl font-bold text-bone">Traitors</span>
        </div>
        <nav aria-label="Main">
          <ul className="flex flex-col gap-1">
            {TABS.map((t) => (
              <li key={t.href}>
                <Link
                  href={href(t.href)}
                  aria-current={t === current ? "page" : undefined}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    FOCUS,
                    "flex min-h-12 items-center rounded-sm border-l-2 px-3 font-display text-sm font-semibold tracking-[0.12em] uppercase transition-colors",
                    t === current
                      ? "border-candle bg-cloak text-candle"
                      : "border-transparent text-parchment hover:bg-cloak/60 hover:text-bone active:bg-cloak",
                  )}
                >
                  {t.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <SeasonPicker />
        <TartanBand className="mt-auto" />
      </Sheet>

      <main
        id="main"
        aria-label={title}
        className="mx-auto flex w-full max-w-md flex-1 animate-page-in flex-col gap-5 px-4 py-6 sm:px-6 md:max-w-3xl"
      >
        {season !== null ? (
          children
        ) : failed ? (
          <ErrorState what="the seasons" message="the castle didn't answer" retry={retry} />
        ) : (
          <SkeletonList label="Finding the season" rows={3} row="h-20" />
        )}
      </main>
      <footer className="border-t border-gilt/20 px-6 py-5 text-center text-sm text-ash">
        Not affiliated with The Traitors, BBC, NBC or Peacock.
      </footer>
    </div>
  );
}

const EDITION_LABELS: [Edition, string][] = [
  ["us", "US"],
  ["uk", "UK"],
];

function EditionToggle() {
  const { edition, chooseEdition } = useShellSeason();
  return (
    <div role="group" aria-label="Edition" className="flex rounded-sm border border-gilt/50 bg-night/70 p-0.5">
      {EDITION_LABELS.map(([id, label]) => (
        <button
          key={id}
          type="button"
          aria-pressed={edition === id}
          onClick={() => chooseEdition(id)}
          className={cn(
            FOCUS,
            "flex min-h-10 min-w-11 items-center justify-center rounded-sm font-display text-xs font-semibold tracking-[0.14em] transition-colors",
            edition === id ? "bg-cloak-500 text-bone" : "text-ash hover:text-bone active:bg-cloak",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function SeasonPicker({ hideLabel = false }: { hideLabel?: boolean }) {
  const { season, seasons, chooseSeason } = useShellSeason();
  if (season === null) return null;
  // Until the list arrives, the URL's season is the only option.
  const options = seasons?.some((s) => s.id === season)
    ? seasons
    : [...(seasons ?? []), { id: season, number: Number(season.split("-")[1]), year: 0, current: false }];
  return (
    <Select
      label="Season"
      hideLabel={hideLabel}
      value={season}
      options={options.map((s) => ({ value: s.id, label: seasonLabel(s), detail: s.current ? "Live now" : undefined }))}
      onChange={chooseSeason}
    />
  );
}

function AccountMenu() {
  const router = useRouter();
  const { signOut } = useAuth();
  const me = useMe();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (e: Event) => !root.current?.contains(e.target as Node) && setOpen(false);
    const escape = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label="Account"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(ICON_BUTTON, "rounded-full")}
      >
        {me ? <Avatar name={me.name ?? me.email} picture={me.picture} size={34} /> : <span className="size-[34px] skeleton rounded-full" />}
      </button>
      {open && (
        <div className="absolute top-full right-0 z-40 mt-2 flex w-56 flex-col gap-1 rounded-sm border border-gilt/50 bg-stone p-1.5 shadow-xl shadow-night/70 animate-pop-in">
          {me && <p className="truncate border-b border-gilt/20 px-3 pt-1.5 pb-2.5 text-bone">{me.name ?? me.email}</p>}
          <button
            type="button"
            onClick={() => void signOut().then(() => router.push("/"))}
            className={`${FOCUS} flex min-h-11 items-center rounded-sm px-3 text-left text-parchment transition-colors hover:bg-cloak hover:text-bone active:bg-cloak/70`}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
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
