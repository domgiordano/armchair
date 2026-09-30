"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { cn, FOCUS } from "@/lib/ui";

type Tone = "success" | "error";

interface Toast {
  id: number;
  text: string;
  tone: Tone;
}

type Show = (text: string, tone?: Tone) => void;

// Outside a provider (a component rendered alone in a test) a toast is a no-op.
const ToastContext = createContext<Show>(() => {});

const SHOWN_MS = 4000;

export const useToast = () => useContext(ToastContext);

/** Short confirmations at the bottom of the screen, announced politely. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), []);
  const show = useCallback<Show>((text, tone = "success") => {
    const id = next.current++;
    // A newer toast replaces older ones past two, so they never pile up.
    setToasts((ts) => [...ts.slice(-1), { id, text, tone }]);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDone={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDone }: { toast: Toast; onDone: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDone(toast.id), SHOWN_MS);
    return () => clearTimeout(timer);
  }, [toast.id, onDone]);

  return (
    <div
      role={toast.tone === "error" ? "alert" : undefined}
      className={cn(
        "pointer-events-auto flex max-w-sm items-center gap-3 rounded-full border py-1.5 pr-1.5 pl-4 text-sm shadow-xl shadow-ink/70 backdrop-blur animate-sheet-up",
        toast.tone === "error" ? "border-red-300/40 bg-ballroom/95 text-red-100" : "border-gold/40 bg-ballroom/95 text-pearl",
      )}
    >
      <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", toast.tone === "error" ? "bg-red-300" : "bg-gold")} />
      <span className="min-w-0 flex-1">{toast.text}</span>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => onDone(toast.id)}
        className={cn("flex size-9 shrink-0 items-center justify-center rounded-full text-silver-dim hover:bg-silver/10 hover:text-pearl", FOCUS)}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
          <path d="m4.5 4.5 7 7m0-7-7 7" />
        </svg>
      </button>
    </div>
  );
}
