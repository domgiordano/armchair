"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

interface PopoverProps {
  label: string;
  trigger: ReactNode;
  triggerClassName: string;
  children: ReactNode;
}

/**
 * A disclosure: a button that shows a panel of links. Escape, a click outside,
 * focus leaving, or picking an item closes it. Not an ARIA menu, which would
 * promise arrow-key navigation.
 */
export function Popover({ label, trigger, triggerClassName, children }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const outside = (e: Event) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    // focusin rather than blur: Safari doesn't focus a clicked link, so a blur
    // would hide the panel before the click on its link lands.
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className={triggerClassName}
      >
        {trigger}
      </button>
      <div
        id={id}
        hidden={!open}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a, button")) setOpen(false);
        }}
        className="absolute top-full right-0 z-30 mt-2 flex min-w-56 flex-col rounded-lg border border-neutral-700 bg-ballroom p-1.5 shadow-xl shadow-ink/60"
      >
        {children}
      </div>
    </div>
  );
}
