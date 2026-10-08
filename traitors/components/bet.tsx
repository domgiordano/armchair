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
  /** A 1st is sealed but a 2nd or 3rd is still empty. */
  incomplete: boolean;
  /** Opens the bet sheet; `prompt` says why it came up. */
  open: (prompt?: string) => void;
}

const BetContext = createContext<Bet>({ needed: false, incomplete: false, open: () => {} });

export const useBet = () => useContext(BetContext);

export const PICK_PROMPT = "Lock in your winners to start playing";

interface BetProviderProps {
  view: SeasonView;
  onSealed: () => void;
  children: ReactNode;
}

/** The winner bet as a sheet any page can open while a place is empty, and a banner asking for it until a 1st is sealed. */
export function BetProvider({ view, onSealed, children }: BetProviderProps) {
  const toast = useToast();
  const now = useNow();
  const [prompt, setPrompt] = useState<string | null>(null);
  const opener = useRef<Element | null>(null);
  const fillable = view.betRoster !== undefined;
  const needed = view.needsBet && fillable;
  const incomplete = !view.needsBet && fillable && view.bet !== null;
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
    <BetContext value={{ needed, incomplete, open }}>
      {needed && <BetBanner worth={multiplier(view.episodes.length, out)} onOpen={() => open()} />}
      {children}
      {fillable && (
        <Sheet open={prompt !== null} onClose={close} label="Your winner bet" size="large">
          <div className="-mb-3 flex justify-end">
            <button type="button" aria-label="Not now" onClick={close} className={ICON_BUTTON}>
              <CloseIcon />
            </button>
          </div>
          {prompt !== null && (
            <WinnerBet
              season={view.season}
              roster={view.betRoster ?? []}
              sealed={view.bet?.picks ?? []}
              episodes={view.episodes.length}
              released={out}
              prompt={prompt || undefined}
              onSealed={() => {
                setPrompt(null);
                toast(needed ? "Sealed. Your calls are open." : "Sealed. Your top 3 is updated.", "success");
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
