"use client";

import { ICON_TRIGGER, ShowIcon, type Show } from "@/components/show-icon";
import { Menu, MenuItem } from "@/components/ui/menu";
import { FOCUS } from "@/lib/ui";

export const HUB_URL = "https://armchairjudge.com";

/** The header's app switcher: this show, the ones coming, and the hub. */
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
      <p className="px-3 pt-1.5 pb-1 text-xs font-semibold tracking-[0.12em] text-silver-dim uppercase">Armchair Judge</p>
      <AppRow show="dwts" name="Dancing with the Stars" note="You're here" current />
      <AppRow show="traitors" name="The Traitors" note="Coming soon" />
      <AppRow show="survivor" name="Survivor" note="Coming soon" />
      <MenuItem href={HUB_URL} className="justify-between">
        All shows
        <ArrowIcon />
      </MenuItem>
    </Menu>
  );
}

interface AppRowProps {
  show: Show;
  name: string;
  note: string;
  current?: boolean;
}

// Not menu items: this app is where you already are, and the others aren't out yet.
function AppRow({ show, name, note, current = false }: AppRowProps) {
  return (
    <span aria-current={current ? "page" : undefined} className={`${ICON_TRIGGER} flex items-center gap-3 rounded-md px-3 py-1.5`}>
      <ShowIcon show={show} size={36} locked={!current} />
      <span className="flex flex-col">
        <span className={`text-sm font-medium whitespace-nowrap ${current ? "text-gold-light" : "text-silver-dim"}`}>{name}</span>
        <span className="text-xs text-silver-dim">{note}</span>
      </span>
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
