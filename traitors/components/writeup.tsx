import { useId } from "react";

import type { Writeup as Text } from "@/lib/api/traitors";
import { cn, EYEBROW, TEXT_LINK } from "@/lib/ui";

/** The attribution CC BY-SA asks for, naming the wiki the text came from. */
export function Credit({ writeup, className }: { writeup: Text; className?: string }) {
  return (
    <p className={cn("text-sm text-ash", className)}>
      {writeup.source === "results" ? (
        <>Written from the episode&apos;s confirmed results</>
      ) : writeup.source === "official" ? (
        <a href={writeup.sourceUrl ?? undefined} target="_blank" rel="noreferrer" className={TEXT_LINK}>
          From the network&apos;s cast page
        </a>
      ) : writeup.source === "fandom" ? (
        <>
          <a href={writeup.sourceUrl ?? undefined} target="_blank" rel="noreferrer" className={TEXT_LINK}>
            From The Traitors Wiki (Fandom)
          </a>
          , CC BY-SA
        </>
      ) : (
        <>
          <a href={writeup.sourceUrl ?? undefined} target="_blank" rel="noreferrer" className={TEXT_LINK}>
            From Wikipedia
          </a>{" "}
          · CC BY-SA 4.0
        </>
      )}
    </p>
  );
}

/** A paragraph from a wiki under its heading, with the attribution its licence asks for. */
export function Writeup({ title, writeup, className }: { title: string; writeup: Text; className?: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn("flex flex-col gap-2", className)}>
      <h2 id={id} className={EYEBROW}>
        {title}
      </h2>
      <p className="text-lg leading-relaxed whitespace-pre-line text-parchment">{writeup.text}</p>
      <Credit writeup={writeup} />
    </section>
  );
}
