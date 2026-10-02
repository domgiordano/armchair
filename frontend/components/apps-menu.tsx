"use client";

import { APPS, appLink, type App } from "@armchair/app-core/apps";

import { AppIcon, appNote } from "@/components/app-icon";
import { ICON_TRIGGER } from "@/components/show-icon";
import { Menu, MenuItem } from "@/components/ui/menu";
import { FOCUS } from "@/lib/ui";

/** The header's app switcher: every Armchair app, this one marked, the others opening signed in. */
export function AppsMenu() {
  return (
    <Menu
      label="Apps"
      trigger={
        <>
          <GridIcon />
          <span className="text-sm font-medium">Apps</span>
        </>
      }
      triggerClassName={`flex min-h-11 items-center gap-2 rounded-md px-3 text-silver transition-colors hover:bg-silver/10 hover:text-pearl active:bg-silver/15 aria-expanded:bg-silver/10 ${FOCUS}`}
    >
      <p className="px-3 pt-1.5 pb-1 text-xs font-semibold tracking-[0.12em] text-silver-dim uppercase">Armchair Judge apps</p>
      {APPS.map((app) => {
        const href = app.id === "dwts" ? null : appLink(app.id);
        if (!href) return <AppRow key={app.id} app={app} />;
        return (
          <MenuItem key={app.id} href={href} className={`${ICON_TRIGGER} py-1.5`}>
            <AppIcon id={app.id} size={36} />
            <AppText app={app} />
          </MenuItem>
        );
      })}
    </Menu>
  );
}

function AppText({ app }: { app: App }) {
  const here = app.id === "dwts";
  return (
    <span className="flex flex-col">
      <span className={`text-sm font-medium whitespace-nowrap ${here ? "text-gold-light" : app.url ? "" : "text-silver-dim"}`}>{app.name}</span>
      <span className="text-xs text-silver-dim">{appNote(app)}</span>
    </span>
  );
}

// Not menu items: this app is where you already are, and a coming-soon app has nowhere to go.
function AppRow({ app }: { app: App }) {
  const here = app.id === "dwts";
  return (
    <span aria-current={here ? "page" : undefined} className={`${ICON_TRIGGER} flex items-center gap-3 rounded-md px-3 py-1.5`}>
      <AppIcon id={app.id} size={36} locked={!here} />
      <AppText app={app} />
    </span>
  );
}

const ICON = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

function GridIcon() {
  return (
    <svg {...ICON} width={18} height={18}>
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <rect x="14" y="14" width="6" height="6" rx="1" />
    </svg>
  );
}

export function ArrowIcon() {
  return (
    <svg {...ICON} width={16} height={16}>
      <path d="M7 17 17 7M9 7h8v8" />
    </svg>
  );
}
