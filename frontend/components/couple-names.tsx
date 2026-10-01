import Link from "next/link";

import type { Member } from "@/lib/api/show";
import { personHref, personSlug } from "@/lib/show/people";
import { cn, FOCUS } from "@/lib/ui";

/** A name that opens that person's page. */
export function PersonLink({ id, name, className }: { id: string; name: string; className?: string }) {
  return (
    <Link
      href={personHref(id)}
      prefetch={false}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "rounded-sm underline-offset-4 decoration-gold/50 transition-colors hover:text-gold-light hover:underline",
        FOCUS,
        className,
      )}
    >
      {name}
    </Link>
  );
}

/** "Celebrity & Pro", each name a link to their page. */
export function CoupleNames({ members, className }: { members: Member[]; className?: string }) {
  const ordered = [...members].sort((a, b) => (a.role === b.role ? 0 : a.role === "celebrity" ? -1 : 1));
  return (
    <span className={className}>
      {ordered.map((m, i) => (
        <span key={m.name}>
          {i > 0 && <span className="text-silver-dim"> &amp; </span>}
          <PersonLink id={personSlug(m.name)} name={m.name} />
        </span>
      ))}
    </span>
  );
}
