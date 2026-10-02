import { APPS, appLink } from "@armchair/app-core/apps";

import { AppIcon } from "@/components/app-icon";
import { ICON_TRIGGER } from "@/components/show-icon";

import { FOCUS } from "./ui";

const ROW = `${ICON_TRIGGER} flex min-h-12 items-center gap-3 rounded-2xl px-2 text-sm`;

/** Every Armchair app as a compact list, for the avatar menu and the phone menu sheet. */
export function AppLinks() {
  return (
    <ul className="flex flex-col">
      {APPS.map((app) => {
        const here = app.id === "hub";
        const href = here ? null : appLink(app.id);
        const body = (
          <>
            <AppIcon id={app.id} size={32} locked={!here && !href} />
            <span className="flex min-w-0 flex-col leading-tight">
              <span className={`truncate font-semibold ${here || href ? "text-text" : "text-muted"}`}>{app.name}</span>
              <span className="text-xs text-muted">{here ? "You're here" : href ? "Live now" : "Coming soon"}</span>
            </span>
          </>
        );
        return (
          <li key={app.id}>
            {href ? (
              <a href={href} className={`${ROW} hover:bg-line/60 active:bg-line ${FOCUS}`}>
                {body}
              </a>
            ) : (
              <span className={ROW}>
                {body}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
