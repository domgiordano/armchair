import Link from "next/link";

import { appHref } from "@/lib/apps";
import { cn, EYEBROW, TEXT_LINK } from "@/lib/ui";
import { APPS } from "@armchair/app-core/apps";

/** Every Armchair Judge app, the others opening signed in, and the line that says we're not the show. */
export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer className={cn("border-t border-gilt/25 bg-night/70", className)}>
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-6 sm:flex-row sm:items-end sm:justify-between">
        <nav aria-label="Armchair Judge apps" className="flex flex-col gap-2">
          <p className={EYEBROW}>Armchair Judge</p>
          <ul className="flex flex-wrap gap-x-5 gap-y-1">
            {APPS.map((app) => {
              const href = appHref(app);
              return (
                <li key={app.id} className="flex min-h-11 items-center">
                  {app.id === "traitors" && href ? (
                    <Link href={href} aria-current="page" className={cn(TEXT_LINK, "text-bone")}>
                      {app.name}
                    </Link>
                  ) : href ? (
                    <a href={href} className={TEXT_LINK}>
                      {app.name}
                    </a>
                  ) : (
                    <span className="text-ash">
                      {app.name} <span className="text-sm italic">coming soon</span>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
        <p className="text-sm text-ash">Not affiliated with The Traitors, BBC, NBC or Peacock.</p>
      </div>
    </footer>
  );
}
