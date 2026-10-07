"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";

import { AppList, AppsMenu } from "@/components/apps-menu";
import { BetProvider } from "@/components/bet";
import { HistoryScreen } from "@/components/history-screen";
import { PlayerSearch } from "@/components/player-search";
import { SeasonDataContext, useSeasonLoad } from "@/components/season-data";
import { SeasonProvider, useShellSeason } from "@/components/season-provider";
import { SiteFooter } from "@/components/site-footer";
import { Avatar } from "@/components/ui/avatar";
import { EmberGlow } from "@/components/ui/ember-glow";
import { UkFlag, UsFlag } from "@/components/ui/flags";
import { CloseIcon, MenuIcon } from "@/components/ui/icons";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { SkeletonList } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { TartanBand } from "@/components/ui/tartan-band";
import { ToastProvider } from "@/components/ui/toast";
import { seasonName, seasonNumber, withSeason, type Edition } from "@/lib/seasons";
import { cn, EYEBROW, FOCUS, ICON_BUTTON } from "@/lib/ui";
import { getMe, type Me } from "@armchair/app-core/api/client";
import { appLink } from "@armchair/app-core/apps";
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

interface AppShellProps {
  // Names the main landmark; the active tab already says where you are.
  title: string;
  /** A page about no one season, like a player's: no season load, bet gate or history swap. */
  seasonless?: boolean;
  children: ReactNode;
}

/** Header, tabs and phone menu around every signed-in page. Callers handle the sign-in wall. */
export function AppShell({ title, seasonless = false, children }: AppShellProps) {
  // The season lives in the query string, which a static export only has on the client.
  return (
    <Suspense>
      <ToastProvider>
        {/* Picking a season or edition from a seasonless page goes to that season's overview. */}
        <SeasonProvider home={seasonless ? "/" : undefined}>
          <Shell title={title} seasonless={seasonless}>
            {children}
          </Shell>
        </SeasonProvider>
      </ToastProvider>
    </Suspense>
  );
}

function Shell({ title, seasonless = false, children }: AppShellProps) {
  const pathname = usePathname();
  const { season, seasons } = useShellSeason();
  const summary = seasons?.find((s) => s.id === season);
  const load = useSeasonLoad(seasonless ? null : season);
  // A finished season has nothing to call: its history stands in for every tab.
  const finished = !seasonless && (summary ? !summary.current : load.data?.current === false);
  const tabs = !finished;
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
        <div className="mx-auto flex max-w-5xl items-center gap-1 px-2 sm:gap-2 py-1.5 sm:px-4">
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
          <Link
            href={href("/")}
            className={`${FOCUS} hidden rounded-sm px-1 font-title text-xl font-bold text-bone min-[360px]:block sm:text-3xl`}
          >
            Traitors
          </Link>
          <div className="ml-4 hidden w-56 md:block">
            <SeasonPicker hideLabel />
          </div>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <PlayerSearch />
            <EditionToggle />
            {/* A phone's header has no room: there the apps sit in the menu. */}
            <AppsMenu className="max-sm:hidden" />
            <AccountMenu />
          </div>
        </div>
        {tabs && (
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
        )}
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
        {tabs && (
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
        )}
        <SeasonPicker />
        <nav aria-label="Armchair Judge apps" className="-mx-3 flex flex-col gap-1 sm:hidden">
          <p className={cn(EYEBROW, "px-3")}>Armchair Judge apps</p>
          <AppList onPick={() => setMenuOpen(false)} />
        </nav>
        <TartanBand className="mt-auto" />
      </Sheet>

      <main
        id="main"
        aria-label={finished ? "Season history" : title}
        className="mx-auto flex w-full max-w-md flex-1 animate-page-in flex-col gap-5 px-4 py-6 sm:px-6 md:max-w-3xl"
      >
        <Content load={load} finished={finished} seasonless={seasonless}>
          {children}
        </Content>
      </main>
      <SiteFooter />
    </div>
  );
}

interface ContentProps {
  load: ReturnType<typeof useSeasonLoad>;
  finished: boolean;
  seasonless: boolean;
  children: ReactNode;
}

function Content({ load, finished, seasonless, children }: ContentProps) {
  const { season, failed, retry } = useShellSeason();
  const { data, error, reload } = load;
  if (seasonless) return children;
  if (season === null && failed)
    return <ErrorState what="the seasons" message="the castle didn't answer" retry={retry} />;
  if (season !== null && finished) return <HistoryScreen key={season} season={season} summary={data?.summary} />;
  if (data === null && error !== null) return <ErrorState what="this season" message={error} retry={reload} />;
  if (data === null) return <SkeletonList label="Opening the season" rows={3} row="h-20" />;
  return (
    <SeasonDataContext value={{ view: data, reload }}>
      <BetProvider key={data.season} view={data} onSealed={reload}>
        {children}
      </BetProvider>
    </SeasonDataContext>
  );
}

const EDITION_LABELS: { id: Edition; short: string; name: string; Flag: typeof UsFlag }[] = [
  { id: "us", short: "US", name: "United States edition", Flag: UsFlag },
  { id: "uk", short: "UK", name: "United Kingdom edition", Flag: UkFlag },
];

function EditionToggle() {
  const { edition, chooseEdition } = useShellSeason();
  return (
    <div role="group" aria-label="Edition" className="flex rounded-sm border border-gilt/50 bg-night/70 p-0.5">
      {EDITION_LABELS.map(({ id, short, name, Flag }) => (
        <button
          key={id}
          type="button"
          aria-label={name}
          aria-pressed={edition === id}
          onClick={() => chooseEdition(id)}
          className={cn(
            FOCUS,
            "group flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-sm px-1.5 font-display text-xs font-semibold tracking-[0.14em] transition-colors",
            edition === id ? "bg-cloak-500 text-bone" : "text-ash hover:text-bone active:bg-cloak",
          )}
        >
          <Flag
            className={cn(
              "h-3.5 ring-1 ring-night/60 transition-[filter,opacity]",
              edition !== id && "opacity-55 saturate-50 group-hover:opacity-100 group-hover:saturate-100",
            )}
          />
          <span aria-hidden="true" className="max-sm:hidden">
            {short}
          </span>
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
    : [...(seasons ?? []), { id: season, number: seasonNumber(season), year: 0, current: false }];
  return (
    <Select
      label="Season"
      hideLabel={hideLabel}
      value={season}
      options={options.map((s) => {
        const name = seasonName(s);
        const detail = [name.numbered, s.current && "Live now"].filter(Boolean).join(" · ");
        return { value: s.id, label: name.title, detail: detail || undefined };
      })}
      onChange={chooseSeason}
    />
  );
}

const MENU_ITEM = `${FOCUS} flex min-h-11 items-center rounded-sm px-3 text-left text-parchment transition-colors hover:bg-cloak hover:text-bone active:bg-cloak/70`;

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
        {me ? (
          <Avatar name={me.name ?? me.email} picture={me.picture} size={34} />
        ) : (
          <span className="size-[34px] skeleton rounded-full" />
        )}
      </button>
      {open && (
        <div className="absolute top-full right-0 z-40 mt-2 flex w-56 flex-col gap-1 rounded-sm border border-gilt/50 bg-stone p-1.5 shadow-xl shadow-night/70 animate-pop-in">
          {me && <p className="truncate border-b border-gilt/20 px-3 pt-1.5 pb-2.5 text-bone">{me.name ?? me.email}</p>}
          {/* Friends and groups are family-wide; DWTS hosts them until the hub does. */}
          <a href={appLink("dwts", "/social/") ?? undefined} className={MENU_ITEM}>
            Friends &amp; Groups
          </a>
          <button type="button" onClick={() => void signOut().then(() => router.push("/"))} className={MENU_ITEM}>
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
