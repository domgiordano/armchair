"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useId, useRef, useState, type CSSProperties, type FocusEvent, type KeyboardEvent } from "react";
import { ICON_TRIGGER, ShowIcon, type Show } from "@/components/show-icon";

import { DWTS_URL } from "@/lib/links";
import { useReducedMotion } from "@/lib/use-reduced-motion";

interface ShowApp {
  name: string;
  line: string;
  /** Only live apps have one; the rest render as "coming soon" rows. */
  href?: string;
  show: Show;
}

const APPS: ShowApp[] = [
  { name: "Dancing with the Stars", line: "Score every dance before the judges' paddles go up.", href: DWTS_URL, show: "dwts" },
  { name: "The Traitors", line: "Call the banishment before the round table does.", show: "traitors" },
  { name: "Survivor", line: "Rate the blindside before the tribe has spoken.", show: "survivor" },
];

// The longer of the two exit animations in app/motion.css.
const CLOSE_MS = 200;

const row = (i: number) => ({ "--row": i }) as CSSProperties;

const SECTION_LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/#shows", label: "Shows" },
];

function AppRow({ app }: { app: ShowApp }) {
  const body = (
    <>
      <ShowIcon show={app.show} size={44} locked={!app.href} />
      <span className={`min-w-0 flex-1 ${app.href ? "" : "opacity-60"}`}>
        <span className="block text-sm font-semibold text-text">{app.name}</span>
        <span className="mt-0.5 block text-xs leading-snug text-muted">{app.line}</span>
      </span>
      {app.href ? (
        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-magenta/15 px-2.5 py-1 text-[10px] font-bold tracking-[0.15em] text-magenta">
          <span className="size-1.5 rounded-full bg-current motion-safe:animate-pulse" aria-hidden="true" />
          LIVE
        </span>
      ) : (
        <span className="shrink-0 rounded-full border border-line px-2.5 py-1 text-[10px] font-bold tracking-[0.15em] whitespace-nowrap text-muted">
          COMING SOON
        </span>
      )}
    </>
  );

  if (!app.href) {
    return <div className={`${ICON_TRIGGER} flex items-center gap-3 rounded-2xl p-3`}>{body}</div>;
  }
  return (
    <a
      href={app.href}
      className={`${ICON_TRIGGER} flex items-center gap-3 rounded-2xl p-3 hover:bg-line/50 focus-visible:bg-line/50 focus-visible:outline-2 focus-visible:outline-gold active:bg-line`}
    >
      {body}
    </a>
  );
}

/** The header's app switcher: a dropdown from sm up, a bottom sheet below. */
export function AppsMenu() {
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  // Still mounted while the exit animation plays; aria-expanded is already false.
  const [closing, setClosing] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const expanded = open && !closing;

  const show = () => {
    setClosing(false);
    setOpen(true);
  };

  const close = () => {
    // jsdom has no Web Animations, and reduced motion has nothing to play.
    if (reduced || typeof panel.current?.getAnimations !== "function") return setOpen(false);
    setClosing(true);
  };

  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, CLOSE_MS);
    return () => window.clearTimeout(timer);
  }, [closing]);

  const dismiss = useEffectEvent(close);

  useEffect(() => {
    if (!expanded) return;
    const onPointerDown = (e: PointerEvent) => {
      if (e.target instanceof Node && !root.current?.contains(e.target)) dismiss();
    };
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      dismiss();
      button.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [expanded]);

  // Some rows are display:none at wider breakpoints; arrows skip them. jsdom lacks checkVisibility.
  const links = () =>
    Array.from(panel.current?.querySelectorAll<HTMLAnchorElement>("a[href]") ?? []).filter(
      (a) => typeof a.checkVisibility !== "function" || a.checkVisibility(),
    );

  const focusLink = (pick: (all: HTMLAnchorElement[], i: number) => number) => {
    const all = links();
    if (all.length === 0) return;
    const i = all.indexOf(document.activeElement as HTMLAnchorElement);
    all[(pick(all, i) + all.length) % all.length].focus();
  };

  const onButtonKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "ArrowDown") return;
    e.preventDefault();
    show();
    // The panel mounts on this render; focus it on the next frame.
    requestAnimationFrame(() => focusLink(() => 0));
  };

  const onPanelKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, (all: HTMLAnchorElement[], i: number) => number> = {
      ArrowDown: (_, i) => i + 1,
      ArrowUp: (all, i) => (i === -1 ? all.length - 1 : i - 1),
      Home: () => 0,
      End: (all) => all.length - 1,
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    focusLink(move);
  };

  // Tabbing past the last row closes the menu, like clicking away does.
  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (e.relatedTarget instanceof Node && !root.current?.contains(e.relatedTarget)) close();
  };

  return (
    <div ref={root} className="relative" onBlur={onBlur}>
      <button
        ref={button}
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={expanded ? close : show}
        onKeyDown={onButtonKeyDown}
        className={`flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold transition-colors hover:border-gold hover:text-gold focus-visible:outline-2 focus-visible:outline-gold active:scale-95 motion-reduce:transition-none ${
          expanded ? "border-gold text-gold" : "border-line text-text"
        }`}
      >
        <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true" fill="currentColor">
          {[2, 7, 12].flatMap((y) => [2, 7, 12].map((x) => <rect key={`${x}-${y}`} x={x} y={y} width="2.6" height="2.6" rx="0.8" />))}
        </svg>
        Apps
        <svg
          viewBox="0 0 16 16"
          className={`size-3.5 transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <>
          <div
            className="apps-backdrop fixed inset-0 z-40 bg-night/70 sm:hidden"
            data-closing={closing || undefined}
            aria-hidden="true"
            onClick={close}
          />
          <div
            ref={panel}
            id={panelId}
            data-closing={closing || undefined}
            onKeyDown={onPanelKeyDown}
            className="apps-panel fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto overscroll-contain rounded-t-3xl border-t border-line bg-night-2 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl shadow-night sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:bottom-auto sm:mt-2 sm:w-[25rem] sm:rounded-3xl sm:border sm:p-2 sm:pb-2"
          >
            <span className="mx-auto mb-2 block h-1 w-10 rounded-full bg-line sm:hidden" aria-hidden="true" />
            <p className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-[0.25em] text-muted">ARMCHAIR JUDGE APPS</p>
            <ul>
              {APPS.map((app, i) => (
                <li key={app.name} style={row(i)}>
                  <AppRow app={app} />
                </li>
              ))}
            </ul>
            <div className="mt-2 border-t border-line pt-2 md:hidden">
              <ul>
                {SECTION_LINKS.map(({ href, label }, i) => (
                  <li key={href} style={row(APPS.length + i)}>
                    <Link
                      href={href}
                      onClick={close}
                      className="flex min-h-11 items-center rounded-2xl px-3 text-sm font-medium text-muted hover:bg-line/50 hover:text-text focus-visible:outline-2 focus-visible:outline-gold"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
