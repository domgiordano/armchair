"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { FOCUS } from "@/lib/ui";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Names the dialog. */
  label: string;
  children: ReactNode;
}

/**
 * A detail panel: a bottom sheet on a phone, a centered card from md up. The
 * native dialog brings the focus trap, Escape and the inert page behind it.
 */
export function Sheet({ open, onClose, label, children }: SheetProps) {
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
      aria-label={label}
      onClose={onClose}
      // A click on the backdrop lands on the dialog itself.
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="m-0 mt-auto max-h-[88dvh] w-full max-w-none overflow-y-auto overscroll-contain rounded-t-2xl border border-b-0 border-silver/15 bg-ink p-0 text-pearl shadow-[0_-24px_60px_-20px_rgb(0_0_0/0.8)] backdrop:bg-ink/75 backdrop:backdrop-blur-sm open:animate-sheet-up md:m-auto md:max-w-lg md:rounded-2xl md:border-b md:open:animate-pop-in"
    >
      <div className="flex flex-col gap-5 px-4 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6">
        <div className="flex items-center justify-between">
          <span aria-hidden="true" className="mx-auto h-1 w-10 rounded-full bg-silver/25 md:hidden" />
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className={`absolute top-2 right-2 flex size-11 items-center justify-center rounded-full text-silver transition-colors hover:bg-silver/10 hover:text-pearl ${FOCUS}`}
          >
            <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
