"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { cn, FOCUS } from "@/lib/ui";

interface MenuProps {
  label: string;
  trigger: ReactNode;
  triggerClassName: string;
  children: ReactNode;
}

const items = (panel: HTMLElement | null) => [...(panel?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];

/**
 * A menu button: arrow keys walk the items, Escape or a click outside closes it
 * and focus goes back to the button. Picking an item closes it too.
 */
export function Menu({ label, trigger, triggerClassName, children }: MenuProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const focusOnOpen = useRef<"first" | "last">("first");
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const all = items(panel.current);
    (focusOnOpen.current === "first" ? all[0] : all.at(-1))?.focus();
    const outside = (e: Event) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const onButtonKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    focusOnOpen.current = e.key === "ArrowDown" ? "first" : "last";
    setOpen(true);
  };

  const onPanelKey = (e: KeyboardEvent) => {
    const all = items(panel.current);
    const at = all.indexOf(document.activeElement as HTMLElement);
    const next = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: all.length - 1 }[e.key];
    if (e.key === "Tab") setOpen(false);
    if (next === undefined) return;
    e.preventDefault();
    all[(next + all.length) % all.length]?.focus();
  };

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          focusOnOpen.current = "first";
          setOpen((o) => !o);
        }}
        onKeyDown={onButtonKey}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {open && (
        <div
          ref={panel}
          id={id}
          role="menu"
          aria-label={label}
          onKeyDown={onPanelKey}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('[role="menuitem"]')) setOpen(false);
          }}
          className="absolute top-full right-0 z-30 mt-2 flex min-w-56 origin-top-right flex-col rounded-lg border border-silver/15 bg-ballroom p-1.5 shadow-xl shadow-ink/70 animate-pop-in"
        >
          {children}
        </div>
      )}
    </div>
  );
}

const ITEM = cn(
  "flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm text-silver transition-colors hover:bg-silver/10 hover:text-pearl focus:bg-silver/10 focus:text-pearl active:bg-silver/15",
  FOCUS,
);

interface MenuItemProps {
  href?: string;
  onSelect?: () => void;
  className?: string;
  children: ReactNode;
}

/** A link when it has an href, a button otherwise. */
export function MenuItem({ href, onSelect, className, children }: MenuItemProps) {
  const props = { role: "menuitem", tabIndex: -1, onClick: onSelect, className: cn(ITEM, className) };
  // Only same-site paths go through the router.
  if (href?.startsWith("/")) {
    return (
      <Link href={href} {...props}>
        {children}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" {...props}>
      {children}
    </button>
  );
}
