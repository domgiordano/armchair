"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { cn } from "@/lib/ui";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Names the dialog. */
  label: string;
  /** bottom: a detail panel (a centred card from md up). left: the phone menu. */
  side?: "bottom" | "left";
  children: ReactNode;
}

/** A modal panel on the native dialog, which brings the focus trap, Escape and the inert page. */
export function Sheet({ open, onClose, label, side = "bottom", children }: SheetProps) {
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
      className={cn(
        "m-0 max-w-none overflow-y-auto overscroll-contain bg-stone p-0 text-left text-parchment backdrop:bg-night/80 backdrop:backdrop-blur-sm",
        side === "left"
          ? "h-dvh max-h-none w-[min(20rem,85vw)] border-r border-gilt/50 open:animate-sheet-in"
          : "mt-auto max-h-[88dvh] w-full rounded-t-md border-t border-gilt/60 open:animate-sheet-up md:m-auto md:max-w-lg md:rounded-md md:border md:open:animate-pop-in",
      )}
    >
      <div
        className={cn(
          "flex flex-col gap-5 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6",
          side === "left" ? "min-h-full pt-[max(1rem,env(safe-area-inset-top))]" : "pt-4",
        )}
      >
        {children}
      </div>
    </dialog>
  );
}
