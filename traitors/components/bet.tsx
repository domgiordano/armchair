"use client";

import { createContext, useContext, useRef, useState, type ReactNode } from "react";

import { CloseIcon } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { Seal } from "@/components/ui/wax-seal";
import { WinnerBet } from "@/components/winner-bet";
import type { SeasonView } from "@/lib/api/traitors";
import { multiplier } from "@/lib/points";
import { released } from "@/lib/schedule";
import { button, cn, ICON_BUTTON } from "@/lib/ui";
import { useNow } from "@armchair/app-core/show/use-now";

interface Bet {
  /** The season waits on your winners before any call. */
  needed: boolean;
  /** Opens the bet sheet; `prompt` says why it came up. */
  open: (prompt?: string) => void;
}

const BetContext = createContext<Bet>({ needed: false, open: () => {} });

export const useBet = () => useContext(BetContext);

export const PICK_PROMPT = "Lock in your winners to start playing";

interface BetProviderProps {
  view: SeasonView;
  onSealed: () => void;
  children: ReactNode;
}

/** The winner bet as a sheet any page can open, and a banner asking for it until it's sealed. */
export function BetProvider({ view, onSealed, children }: BetProviderProps) {
  const toast = useToast();
  const now = useNow();
  const [prompt, setPrompt] = useState<string | null>(null);
  const opener = useRef<Element | null>(null);
  const needed = view.needsBet && view.betRoster !== undefined;
  const out = view.episodes.filter((e) => released(e, now)).length;

  const open = (why?: string) => {
    opener.current = document.activeElement;
    setPrompt(why ?? "");
  };
  const close = () => {
    setPrompt(null);
    if (opener.current instanceof HTMLElement) opener.current.focus();
  };

  return (
    <BetContext value={{ needed, open }}>
      {needed && <BetBanner worth={multiplier(view.episodes.length, out)} onOpen={() => open()} />}
      {children}
      {needed && (
        <Sheet open={prompt !== null} onClose={close} label="Your winner bet">
          <div className="-mb-3 flex justify-end">
            <button type="button" aria-label="Not now" onClick={close} className={ICON_BUTTON}>
              <CloseIcon />
            </button>
          </div>
          {prompt !== null && (
            <WinnerBet
              season={view.season}
              roster={view.betRoster ?? []}
              episodes={view.episodes.length}
              released={out}
              prompt={prompt || undefined}
              onSealed={() => {
                setPrompt(null);
                toast("Sealed. Your calls are open.", "success");
                onSealed();
              }}
            />
          )}
        </Sheet>
      )}
    </BetContext>
  );
}

function BetBanner({ worth, onOpen }: { worth: number; onOpen: () => void }) {
  return (
    <aside
      aria-label="Winner bet"
      className={cn(
        "flex items-center gap-3 rounded-sm border border-blood-hi/50 bg-oxblood/85 py-2 pr-2 pl-2.5",
        "shadow-[0_10px_30px_-18px_rgb(179_34_46/0.9)]",
      )}
    >
      <Seal className="size-9 shrink-0" />
      <p className="flex min-w-0 flex-1 flex-col leading-snug">
        <span className="font-display font-semibold tracking-[0.04em] text-bone">Lock in your winners</span>
        <span className="text-sm text-flame">
          Worth <span className="nums">{Math.round(worth * 100)}%</span> now<span className="max-sm:hidden">, less after every episode</span>
        </span>
      </p>
      <button type="button" onClick={onOpen} className={button("gold", "sm")}>
        Lock in
      </button>
    </aside>
  );
}
