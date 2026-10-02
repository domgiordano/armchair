import { useId } from "react";

import type { Writeup as Text } from "@/lib/api/traitors";
import { cn, EYEBROW, TEXT_LINK } from "@/lib/ui";

/** A paragraph from Wikipedia under its heading, with the attribution its licence asks for. */
export function Writeup({ title, writeup, className }: { title: string; writeup: Text; className?: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn("flex flex-col gap-2", className)}>
      <h2 id={id} className={EYEBROW}>
        {title}
      </h2>
      <p className="text-lg leading-relaxed whitespace-pre-line text-parchment">{writeup.text}</p>
      <p className="text-sm text-ash">
        <a href={writeup.sourceUrl} target="_blank" rel="noreferrer" className={TEXT_LINK}>
          From Wikipedia
        </a>{" "}
        · CC BY-SA 4.0
      </p>
    </section>
  );
}
