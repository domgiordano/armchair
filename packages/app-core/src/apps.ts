export type AppId = "hub" | "dwts" | "traitors" | "survivor";

export interface App {
  id: AppId;
  name: string;
  line: string;
  url: string | null;
}

/** Every Armchair Judge site, in the order menus and footers list them. `url: null` is coming soon. */
export const APPS: App[] = [
  { id: "hub", name: "Armchair Judge", line: "Every show, one account, your friends.", url: "https://armchairjudge.com" },
  {
    id: "dwts",
    name: "Dancing with the Stars",
    line: "Score every dance before the judges' paddles go up.",
    url: "https://dwts.armchairjudge.com",
  },
  {
    id: "traitors",
    name: "The Traitors",
    line: "Call the round table, the murder and the winners.",
    url: "https://traitors.armchairjudge.com",
  },
  { id: "survivor", name: "Survivor", line: "Coming soon.", url: null },
];

/**
 * A page on another Armchair site that opens signed in: `sso=1` tells it to resume
 * the shared Cognito session silently when it has none of its own.
 */
export function appLink(id: AppId, path = "/", params: Record<string, string> = {}): string | null {
  const base = APPS.find((a) => a.id === id)?.url;
  if (!base) return null;
  return `${base}${path}?${new URLSearchParams({ ...params, sso: "1" })}`;
}
