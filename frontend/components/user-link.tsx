import Link from "next/link";
import type { ReactNode } from "react";

import { profileHref } from "@/lib/api/people";
import { cn, FOCUS } from "@/lib/ui";

/** Someone's name as a link to their profile. Stops the click so a row's own action doesn't fire too. */
export function UserLink({ sub, className, children }: { sub: string; className?: string; children: ReactNode }) {
  return (
    <Link
      href={profileHref(sub)}
      prefetch={false}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "rounded-sm underline-offset-4 decoration-gold/50 transition-colors hover:text-gold-light hover:underline",
        FOCUS,
        className,
      )}
    >
      {children}
    </Link>
  );
}
