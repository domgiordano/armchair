"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";

import { useMediaQuery } from "@/lib/motion";
import { cn, FOCUS } from "@/lib/ui";

export interface SelectOption {
  value: string;
  label: string;
  /** A second line under the label, like an air date. */
  detail?: string;
}

interface SelectProps {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  /** Keep the label for screen readers only. */
  hideLabel?: boolean;
  /** Label beside the button rather than above it. */
  inline?: boolean;
  compact?: boolean;
  className?: string;
}

const PHONE = "(max-width: 639px)";
const TYPEAHEAD_MS = 600;

/**
 * A select-only combobox (the APG pattern): focus stays on the button and
 * aria-activedescendant walks the list. A popover under the button, or a
 * bottom sheet on a phone.
 */
export function Select({ label, value, options, onChange, hideLabel, inline, compact, className }: SelectProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [host, setHost] = useState<Element | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const phone = useMediaQuery(PHONE);

  const selected = Math.max(0, options.findIndex((o) => o.value === value));
  const current = options[selected];

  useEffect(() => {
    if (!open) return;
    const outside = (e: Event) => {
      const t = e.target as Node;
      if (!root.current?.contains(t) && !sheet.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  useEffect(() => {
    if (open) list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView?.({ block: "nearest" });
  }, [open, active]);

  const show = (at = selected) => {
    setActive(at);
    setHost(trigger.current?.closest("dialog") ?? document.body);
    setOpen(true);
  };
  const pick = (i: number) => {
    setOpen(false);
    trigger.current?.focus();
    if (options[i] && options[i].value !== value) onChange(options[i].value);
  };

  // Type a few letters to jump to the first option starting with them.
  const typeahead = (key: string, now: number) => {
    const t = typed.current;
    t.text = now - t.at > TYPEAHEAD_MS ? key : t.text + key;
    t.at = now;
    const from = open ? active : selected;
    const order = [...options.keys()].map((k) => (from + 1 + k) % options.length);
    // A repeated single letter cycles through the matches.
    const needle = [...t.text].every((c) => c === t.text[0]) ? t.text[0] : t.text;
    const hit = order.find((i) => options[i].label.toLowerCase().startsWith(needle.toLowerCase()));
    if (hit === undefined) return;
    if (open) setActive(hit);
    else if (options[hit].value !== value) onChange(options[hit].value);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const last = options.length - 1;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        show();
      } else if (e.key === "Home" || e.key === "End") {
        e.preventDefault();
        show(e.key === "Home" ? 0 : last);
      } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        typeahead(e.key, e.timeStamp);
      }
      return;
    }
    const moves: Record<string, number> = {
      ArrowDown: Math.min(last, active + 1),
      ArrowUp: Math.max(0, active - 1),
      Home: 0,
      End: last,
      PageDown: Math.min(last, active + 10),
      PageUp: Math.max(0, active - 10),
    };
    if (e.key === "ArrowUp" && e.altKey) {
      e.preventDefault();
      pick(active);
    } else if (e.key in moves) {
      e.preventDefault();
      setActive(moves[e.key]);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(active);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "Tab") {
      pick(active);
    } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
      typeahead(e.key, e.timeStamp);
    }
  };

  const listbox = (
    <ul
      ref={list}
      id={`${id}-list`}
      role="listbox"
      aria-labelledby={`${id}-label`}
      tabIndex={-1}
      className={cn(
        "flex flex-col gap-0.5 overflow-y-auto overscroll-contain p-1.5",
        phone ? "max-h-[60dvh]" : "max-h-72",
      )}
    >
      {options.map((o, i) => (
        <li
          key={o.value}
          id={`${id}-opt-${i}`}
          data-index={i}
          role="option"
          aria-selected={i === selected}
          aria-label={o.detail ? `${o.label}, ${o.detail}` : undefined}
          onPointerEnter={() => setActive(i)}
          // Keep focus on the button so the combobox stays the one focus stop.
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => pick(i)}
          className={cn(
            "flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
            i === active ? "bg-silver/10 text-pearl" : "text-silver",
            i === selected && "font-semibold text-gold-light",
          )}
        >
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate">{o.label}</span>
            {o.detail && <span className="truncate text-xs font-normal text-silver-dim">{o.detail}</span>}
          </span>
          <CheckIcon visible={i === selected} />
        </li>
      ))}
    </ul>
  );

  return (
    <div ref={root} className={cn("relative flex text-sm", inline ? "items-center gap-2" : "flex-col gap-1.5", className)}>
      <span id={`${id}-label`} className={cn("text-silver-dim", hideLabel && "sr-only")}>
        {label}
      </span>
      <button
        ref={trigger}
        type="button"
        role="combobox"
        aria-labelledby={`${id}-label`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open ? `${id}-opt-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
        className={cn(
          "group flex w-full items-center justify-between gap-3 rounded-md border border-silver/20 bg-ink/60 px-3 text-left text-pearl transition-colors hover:border-silver/45 hover:bg-ballroom/60 aria-expanded:border-gold/60 aria-expanded:bg-ballroom/70",
          compact ? "min-h-11 md:min-h-9" : "min-h-11 text-base",
          FOCUS,
        )}
      >
        <span className="truncate">{current?.label}</span>
        <ChevronIcon />
      </button>
      {open &&
        (phone && host ? (
          // Portalled: the sticky header's backdrop blur would trap a fixed sheet. Inside the modal
          // phone menu it goes into the dialog, since everything outside a modal dialog is inert.
          createPortal(
          <div ref={sheet} className="fixed inset-0 z-50 flex items-end bg-ink/70 animate-fade-in" onClick={() => setOpen(false)}>
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full rounded-t-2xl border-t border-gold/30 bg-ballroom pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2xl animate-sheet-up"
            >
              <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 rounded-full bg-silver/30" />
              <p className="px-4 pt-3 pb-1 text-xs font-semibold tracking-[0.14em] text-gold uppercase">{label}</p>
              {listbox}
            </div>
          </div>,
          host,
          )
        ) : (
          <div className="absolute top-full right-0 left-0 z-40 mt-1.5 min-w-full origin-top rounded-lg border border-silver/15 bg-ballroom shadow-xl shadow-ink/70 animate-pop-in sm:min-w-56">
            {listbox}
          </div>
        ))}
    </div>
  );
}

function ChevronIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="size-4 shrink-0 text-silver-dim transition-transform duration-200 group-aria-expanded:rotate-180 group-aria-expanded:text-gold-light"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m4 6 4 4 4-4" />
    </svg>
  );
}

function CheckIcon({ visible }: { visible: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={cn("size-4 shrink-0 text-gold", !visible && "invisible")}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m3.5 8.5 3 3 6-7" />
    </svg>
  );
}
