import type { ReactNode } from "react";

import { cn } from "@/lib/ui";

interface CardProps {
  /** Heading id, for aria-labelledby. Without a title the card is a plain panel. */
  id?: string;
  title?: ReactNode;
  note?: ReactNode;
  /** A link or button at the heading's right. */
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** The one panel style: midnight glass with a hairline silver edge. */
export function Card({ id, title, note, action, className, children }: CardProps) {
  return (
    <section
      aria-labelledby={title ? id : undefined}
      className={cn(
        "flex flex-col gap-4 rounded-xl border border-silver/10 bg-ballroom/45 p-4 shadow-[inset_0_1px_0_rgb(213_219_234/0.05)] sm:p-5",
        className,
      )}
    >
      {title && (
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 id={id} className="text-lg font-semibold text-pearl">
              {title}
            </h2>
            {note && <p className="text-sm text-silver-dim">{note}</p>}
          </div>
          {action && <div className="shrink-0 pt-1">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
