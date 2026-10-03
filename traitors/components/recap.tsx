"use client";

import Link from "next/link";
import { useId, useState } from "react";

import { ScrollArt } from "@/components/table-art";
import { Card } from "@/components/ui/card";
import { Seal } from "@/components/ui/wax-seal";
import { Credit } from "@/components/writeup";
import type { Writeup } from "@/lib/api/traitors";
import { excerpt } from "@/lib/recap";
import { button, cn, EYEBROW, HEADING } from "@/lib/ui";

const BODY = "text-lg leading-relaxed whitespace-pre-line text-parchment";

/** The episode's recap in full, once every call is made. */
export function RecapCard({ recap }: { recap: Writeup }) {
  const id = useId();
  return (
    <Card as="section" aria-labelledby={id} tartan className="flex animate-pop-in flex-col gap-3">
      <h2 id={id} className={cn(HEADING, "text-xl")}>
        What happened
      </h2>
      <p className={BODY}>{recap.text}</p>
      <Credit writeup={recap} />
    </Card>
  );
}

/** A recap folded to its opening lines, for a list of episodes. */
export function RecapFold({ recap, max = 260 }: { recap: Writeup; max?: number }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const short = excerpt(recap.text, max);
  const long = short.endsWith("…");
  return (
    <div className="flex flex-col items-start gap-2">
      <p id={id} className={BODY}>
        {open ? recap.text : short}
      </p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {long && (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={id}
            onClick={() => setOpen((o) => !o)}
            className={button("ghost", "sm")}
          >
            {open ? "Show less" : "Read the recap"}
          </button>
        )}
        <Credit writeup={recap} />
      </div>
    </div>
  );
}

interface SealedScrollProps {
  /** Where to go to make the calls, when they aren't on this page. */
  href?: string;
  /** In a list or inside a card: no frame of its own. */
  bare?: boolean;
  className?: string;
}

/** The recap stays rolled up until your calls are in. Says nothing of what's inside. */
export function SealedScroll({ href, bare = false, className }: SealedScrollProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-4",
        !bare && "rounded-sm border border-dashed border-gilt/30 bg-night/40 p-4",
        className,
      )}
    >
      <span className="relative shrink-0">
        <ScrollArt className="h-12 w-24" />
        <Seal className="absolute top-1/2 left-1/2 size-8 -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_2px_3px_rgb(0_0_0/0.6)]" />
      </span>
      <div className="flex min-w-0 flex-col items-start gap-2">
        <p className={EYEBROW}>The recap is sealed</p>
        <p className="text-parchment">Make your calls to unseal the recap.</p>
        {href && (
          <Link href={href} className={button("outline", "sm")}>
            Make your calls
          </Link>
        )}
      </div>
    </div>
  );
}
