"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";

import { cn, FOCUS } from "@/lib/ui";

export interface TabItem<T extends string> {
  id: T;
  label: string;
  /** A count shown in a pill, and read out as "N waiting". */
  badge?: number;
}

interface TabsProps<T extends string> {
  label: string;
  tabs: readonly TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  /** The id of the panel the tabs control. */
  panelId: string;
  /** Tabs keep their natural width and the bar scrolls sideways when they don't fit. */
  scroll?: boolean;
}

export const tabId = (panelId: string, id: string) => `${panelId}-tab-${id}`;

/** A segmented tab bar. Arrow keys, Home and End move and select; a gold plate slides under the pick. */
export function Tabs<T extends string>({ label, tabs, value, onChange, panelId, scroll = false }: TabsProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const bar = useRef<HTMLDivElement>(null);
  const at = Math.max(0, tabs.findIndex((t) => t.id === value));
  // Tabs of their own width can't slide by a share of the bar, so the plate follows the pick's box.
  const [box, setBox] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const el = refs.current[at];
    const strip = bar.current;
    if (!scroll || !el || !strip) return;
    const measure = () => setBox({ left: el.offsetLeft, width: el.offsetWidth });
    measure();
    // Scrolls the strip only: scrollIntoView would also move the page to the tabs.
    if (el.offsetLeft < strip.scrollLeft || el.offsetLeft + el.offsetWidth > strip.scrollLeft + strip.clientWidth) {
      strip.scrollTo?.({ left: el.offsetLeft - 16, behavior: "smooth" });
    }
    const watch = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    watch?.observe(el);
    return () => watch?.disconnect();
  }, [scroll, at]);

  const plate: CSSProperties = scroll
    ? {
        width: box?.width ?? 0,
        transform: `translateX(${box?.left ?? 0}px)`,
        opacity: box ? 1 : 0,
      }
    : {
        width: `calc((100% - 0.5rem) / ${tabs.length})`,
        transform: `translateX(${at * 100}%)`,
      };

  const onKey = (e: KeyboardEvent, i: number) => {
    const last = tabs.length - 1;
    const next = {
      ArrowRight: i === last ? 0 : i + 1,
      ArrowLeft: i === 0 ? last : i - 1,
      Home: 0,
      End: last,
    }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    onChange(tabs[next].id);
    refs.current[next]?.focus();
  };

  return (
    <div
      ref={bar}
      role="tablist"
      aria-label={label}
      className={cn(
        "relative rounded-lg border border-silver/10 bg-ink/60 p-1",
        scroll
          ? "flex w-fit max-w-full gap-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          : "grid",
      )}
      style={scroll ? undefined : { gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-y-1 rounded-md border border-gold/40 bg-ballroom shadow-[0_4px_14px_-6px_rgb(232_194_104/0.5)] transition-[transform,width] duration-300 ease-[cubic-bezier(0.2,0.8,0.3,1)]",
          scroll ? "left-0" : "left-1",
        )}
        style={plate}
      />
      {tabs.map((t, i) => {
        const selected = i === at;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={tabId(panelId, t.id)}
            aria-label={t.badge ? `${t.label}, ${t.badge} waiting` : undefined}
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              "relative flex min-h-10 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors",
              scroll ? "shrink-0 px-4" : "px-2",
              selected ? "text-gold-light" : "text-silver-dim hover:text-pearl active:text-silver",
              FOCUS,
            )}
          >
            <span className="truncate">{t.label}</span>
            {t.badge ? (
              <span
                aria-hidden="true"
                className="rounded-full bg-brand-magenta px-1.5 text-[11px] leading-4 font-semibold text-pearl tabular-nums"
              >
                {t.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
