import type { HTMLAttributes } from "react";

import { TartanBand } from "@/components/ui/tartan-band";
import { cn } from "@/lib/ui";

type Tone = "stone" | "cloak" | "blood";

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: "div" | "section" | "article" | "li";
  /** blood is the red cloak: rare moments only, like the winner bet. */
  tone?: Tone;
  /** A tartan selvedge down the left edge. */
  tartan?: boolean;
}

const TONES: Record<Tone, string> = {
  stone: "bg-stone",
  cloak: "bg-cloak",
  blood: "bg-oxblood [border-color:var(--blood-hi)]",
};

/** A gilt-framed panel. One level deep: a card never holds another card. */
export function Card({ as: Tag = "div", tone = "stone", tartan = false, className, children, ...rest }: CardProps) {
  return (
    <Tag className={cn("gilt-frame relative overflow-hidden rounded-sm p-4", TONES[tone], tartan && "pl-6", className)} {...rest}>
      {tartan && <TartanBand vertical className="absolute inset-y-0 left-0 w-2" />}
      {children}
    </Tag>
  );
}
