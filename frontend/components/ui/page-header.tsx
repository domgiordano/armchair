import type { ReactNode } from "react";

import { DISPLAY } from "@/lib/ui";

interface PageHeaderProps {
  /** Our own heading, set in chrome. Never a show name, theme or person. */
  title: string;
  eyebrow?: string;
  /** A control at the right, like a season picker. */
  action?: ReactNode;
  children?: ReactNode;
}

export function PageHeader({ title, eyebrow, action, children }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          {eyebrow && <p className="text-xs font-semibold tracking-[0.2em] text-gold uppercase">{eyebrow}</p>}
          <h1 className={`${DISPLAY} text-3xl leading-none sm:text-4xl`}>
            <span className="text-chrome">{title}</span>
          </h1>
        </div>
        {action}
      </div>
      {children && <div className="text-sm text-silver-dim">{children}</div>}
    </header>
  );
}
