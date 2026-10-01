"use client";

import { useEffect, useRef, useState, type FocusEvent } from "react";

import { SearchBox } from "@/components/search/people-search";
import { SearchSheet } from "@/components/search/search-sheet";
import { loadIndex } from "@/lib/search/people";

// Tailwind's md breakpoint, where the header has room for the field.
const WIDE = "(min-width: 48rem)";

type Mode = "closed" | "field" | "sheet";

// Fetches the people index while the pointer is still on its way. A failure
// here shows up, with a message, when the search itself loads it.
const prefetch = () => void loadIndex().catch(() => {});

/** The header's search: an icon that opens into a field on desktop and a full-screen sheet on phones. */
export function HeaderSearch({ buttonClassName }: { buttonClassName: string }) {
  const [mode, setMode] = useState<Mode>("closed");
  const button = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const refocus = useRef(false);

  useEffect(() => {
    if (mode !== "closed" || !refocus.current) return;
    refocus.current = false;
    button.current?.focus();
  }, [mode]);

  const close = (returnFocus: boolean) => {
    refocus.current = returnFocus;
    setMode("closed");
  };

  // Leaving an empty field folds it back to the icon; one with a query stays put.
  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget) && !input.current?.value) close(false);
  };

  return (
    <>
      {mode === "field" ? (
        <div onBlur={onBlur}>
          <SearchBox
            variant="popover"
            inputRef={input}
            autoFocus
            onNavigate={() => close(false)}
            onEscape={() => close(true)}
            className="mr-1"
          />
        </div>
      ) : (
        <button
          ref={button}
          type="button"
          aria-label="Search"
          aria-expanded={mode === "sheet"}
          onPointerEnter={prefetch}
          onFocus={prefetch}
          onPointerDown={prefetch}
          onClick={() => setMode(window.matchMedia?.(WIDE).matches ? "field" : "sheet")}
          className={buttonClassName}
        >
          <SearchGlyph />
        </button>
      )}
      <SearchSheet open={mode === "sheet"} onClose={() => close(true)} />
    </>
  );
}

function SearchGlyph() {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}
