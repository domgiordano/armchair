"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface NavSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

/** The phone menu: a modal dialog from the left. The native dialog brings the focus trap and Escape. */
export function NavSheet({ open, onClose, children }: NavSheetProps) {
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
      aria-label="Menu"
      onClose={onClose}
      // A click on the backdrop lands on the dialog itself.
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="nav-sheet m-0 h-dvh max-h-none w-[min(20rem,85vw)] max-w-none border-r border-line bg-night-2 p-0 text-text"
    >
      <div className="flex min-h-full flex-col gap-6 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {children}
      </div>
    </dialog>
  );
}
