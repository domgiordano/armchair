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

/** A couple's every dance in one season: their celebrity's page, narrowed to it. */
export function coupleHref(members: { name: string; role: string }[], season: string): string {
  const star = members.find((m) => m.role === "celebrity") ?? members[0];
  return `${personHref(personSlug(star.name))}&season=${encodeURIComponent(season)}`;
}
