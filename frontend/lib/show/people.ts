/** A person's id from their name, as backend/scripts/build_season.py slug() makes contestant and judge ids. */
export function personSlug(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[^\x00-\x7f]/g, "")
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const personHref = (id: string) => `/people/?id=${encodeURIComponent(id)}`;

/** A couple's page for one season. A couple's id is their celebrity's. */
export function coupleHref(members: { name: string; role: string }[], season: string): string {
  const star = members.find((m) => m.role === "celebrity") ?? members[0];
  return `/couples/couple/?id=${encodeURIComponent(personSlug(star.name))}&season=${encodeURIComponent(season)}`;
}

/** "Guest judge, week 5", "Guest judge, weeks 5 and 7", or "Guest judge" before they've sat. */
export function guestLabel(weeks: number[] = []): string {
  if (weeks.length === 0) return "Guest judge";
  const list = weeks.length === 1 ? String(weeks[0]) : `${weeks.slice(0, -1).join(", ")} and ${weeks.at(-1)}`;
  return `Guest judge, week${weeks.length === 1 ? "" : "s"} ${list}`;
}
