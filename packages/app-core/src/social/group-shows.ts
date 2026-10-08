import type { Group, ShowApp } from "../api/groups";
import { APPS, appLink } from "../apps";

export interface ShowRow {
  app: ShowApp;
  name: string;
  active: boolean;
  /** Members with anything counted on the show. */
  playing: number;
  /** Whether the viewer has played the show at all. */
  youPlay: boolean;
  /** The group's page on that show's site, signed in. */
  groupHref: string | null;
  /** That show's home, for someone who hasn't started watching it. */
  homeHref: string | null;
}

/** One row per show for a group's "on other shows" panel, in menu order. */
export function showRows(group: Group, me: string | null): ShowRow[] {
  return (group.shows ?? []).flatMap((s) => {
    const app = APPS.find((a) => a.id === s.app);
    if (!app?.url) return [];
    return [
      {
        app: s.app,
        name: app.name,
        active: s.active,
        playing: s.playing.length,
        youPlay: me !== null && s.playing.includes(me),
        groupHref: appLink(s.app, "/groups/", { id: group.id }),
        homeHref: appLink(s.app, "/"),
      },
    ];
  });
}

export const showName = (app: string | null | undefined) => APPS.find((a) => a.id === app)?.name ?? "a show";
