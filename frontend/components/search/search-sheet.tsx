"use client";

import { useEffect, useRef } from "react";

import { SearchBox } from "@/components/search/people-search";
import { button } from "@/lib/ui";

interface SearchSheetProps {
  open: boolean;
  onClose: () => void;
}

/** Phone search: a full-screen dialog with the field on top and results under it. */
export function SearchSheet({ open, onClose }: SearchSheetProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label="Search"
      onClose={onClose}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-ink p-0 text-pearl backdrop:bg-ink/80 open:animate-fade-in motion-reduce:open:animate-none"
    >
      {/* Mounted only while open, so each search starts empty and the field takes focus. */}
      {open && (
        <div className="flex min-h-full flex-col px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
          <SearchBox
            variant="sheet"
            autoFocus
            onNavigate={onClose}
            onEscape={onClose}
            aside={
              <button type="button" onClick={onClose} className={button("ghost", "sm")}>
                Cancel
              </button>
            }
          />
        </div>
      )}
    </dialog>
  );
}
