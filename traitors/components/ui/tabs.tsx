"use client";

import { useRef, type KeyboardEvent } from "react";

import { cn, FOCUS } from "@/lib/ui";

export interface TabItem<T extends string> {
  id: T;
  label: string;
  /** A candle mark beside the label, read out as "sealed". */
  done?: boolean;
}

interface TabsProps<T extends string> {
  label: string;
  tabs: readonly TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  /** The id of the panel the tabs control. */
  panelId: string;
}

export const tabId = (panelId: string, id: string) => `${panelId}-tab-${id}`;

/** A segmented tab bar. Arrow keys, Home and End move and select; a gilt plate slides under the pick. */
export function Tabs<T extends string>({ label, tabs, value, onChange, panelId }: TabsProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const at = Math.max(0, tabs.findIndex((t) => t.id === value));

  const onKey = (e: KeyboardEvent, i: number) => {
    const last = tabs.length - 1;
    const next = { ArrowRight: i === last ? 0 : i + 1, ArrowLeft: i === 0 ? last : i - 1, Home: 0, End: last }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    onChange(tabs[next].id);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      className="relative grid rounded-sm border border-gilt/30 bg-night/70 p-1"
      style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-1 left-1 rounded-sm border border-gilt bg-cloak-500 transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.3,1)]"
        style={{ width: `calc((100% - 0.5rem) / ${tabs.length})`, transform: `translateX(${at * 100}%)` }}
      />
      {tabs.map((t, i) => (
        <button
          key={t.id}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="tab"
          id={tabId(panelId, t.id)}
          aria-selected={i === at}
          aria-controls={panelId}
          tabIndex={i === at ? 0 : -1}
          onClick={() => onChange(t.id)}
          onKeyDown={(e) => onKey(e, i)}
          className={cn(
            "relative flex min-h-11 items-center justify-center rounded-sm px-2 font-display text-xs font-semibold tracking-[0.06em] uppercase transition-colors",
            i === at ? "text-bone" : "text-ash hover:text-parchment active:text-bone",
            FOCUS,
          )}
        >
          <span className="truncate">{t.label}</span>
          {t.done && (
            <>
              <span aria-hidden="true" className="ml-1.5 size-1.5 shrink-0 rotate-45 bg-candle" />
              <span className="sr-only">, sealed</span>
            </>
          )}
        </button>
      ))}
    </div>
  );
}
