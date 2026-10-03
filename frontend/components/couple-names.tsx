import Link from "next/link";
import { Fragment, type ReactNode } from "react";

import { CoupleAvatars, coupleName } from "@/components/headshot";
import type { Member } from "@/lib/api/show";
import { coupleHref, personHref, personSlug } from "@/lib/show/people";
import { cn, FOCUS } from "@/lib/ui";

const starFirst = (members: Member[]) =>
  [...members].sort((a, b) => (a.role === b.role ? 0 : a.role === "celebrity" ? -1 : 1));

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
  const ordered = starFirst(members);
  return (
    <span className={className}>
      {/* Flat, spaces as bare text: an accessible name trims each element child's text. */}
      {ordered.map((m, i) => (
        <Fragment key={m.name}>
          {i > 0 && (
            <>
              {" "}
              <span className="text-silver-dim">&amp;</span>{" "}
            </>
          )}
          <PersonLink id={personSlug(m.name)} name={m.name} />
        </Fragment>
      ))}
    </span>
  );
}

interface CoupleLinkProps {
  members: Member[];
  season: string;
  /** Avatar size when there are no children. */
  size?: number;
  className?: string;
  /** What to show instead of the pair's faces. */
  children?: ReactNode;
}

/** Opens the couple's page for `season`: their faces by default, beside CoupleNames' person links. */
export function CoupleLink({ members, season, size = 40, className, children }: CoupleLinkProps) {
  return (
    <Link
      href={coupleHref(members, season)}
      prefetch={false}
      onClick={(e) => e.stopPropagation()}
      aria-label={children ? undefined : `${coupleName({ members: starFirst(members) })}, couple page`}
      className={cn(
        children
          ? "rounded-sm underline-offset-4 decoration-gold/50 transition-colors hover:text-gold-light hover:underline"
          : "shrink-0 rounded-full transition-transform duration-150 hover:scale-105 active:scale-95",
        FOCUS,
        className,
      )}
    >
      {children ?? <CoupleAvatars members={members} size={size} />}
    </Link>
  );
}
