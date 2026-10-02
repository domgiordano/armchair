import { useId } from "react";

import { APPS, appLink } from "@armchair/app-core/apps";

import { AppIcon, appNote } from "@/components/app-icon";
import { ICON_TRIGGER } from "@/components/show-icon";
import { FOCUS } from "@/lib/ui";

const ROW = `${ICON_TRIGGER} flex items-center gap-3 rounded-md px-3 py-2`;

/** Every Armchair app as rows, for the phone menu sheets: this one marked, the others opening signed in. */
export function AppList() {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-1">
      <h2 id={id} className="px-3 text-xs font-semibold tracking-[0.12em] text-silver-dim uppercase">
        Armchair Judge apps
      </h2>
      <ul className="flex flex-col">
        {APPS.map((app) => {
          const here = app.id === "dwts";
          const href = here ? null : appLink(app.id);
          const body = (
            <>
              <AppIcon id={app.id} size={40} locked={!here && !href} />
              <span className="flex flex-col">
                <span className={`text-sm font-medium ${here ? "text-gold-light" : href ? "text-silver" : "text-silver-dim"}`}>
                  {app.name}
                </span>
                <span className="text-xs text-silver-dim">{appNote(app)}</span>
              </span>
            </>
          );
          return (
            <li key={app.id}>
              {href ? (
                <a href={href} className={`${ROW} transition-colors hover:bg-ballroom/60 active:bg-ballroom ${FOCUS}`}>
                  {body}
                </a>
              ) : (
                <span aria-current={here ? "page" : undefined} className={ROW}>
                  {body}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
