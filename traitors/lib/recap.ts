/** The opening of a recap, cut at a word and never mid-sentence punctuation. */
export function excerpt(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > 0 ? cut.slice(0, space) : cut).replace(/[\s,;:.–—-]+$/, "")}…`;
}

/** Each target with who voted for them, most votes first. */
export function votesByTarget(ballots: Record<string, string>): { target: string; voters: string[] }[] {
  const by = new Map<string, string[]>();
  for (const [voter, target] of Object.entries(ballots)) by.set(target, [...(by.get(target) ?? []), voter]);
  return [...by]
    .map(([target, voters]) => ({ target, voters }))
    .sort((a, b) => b.voters.length - a.voters.length || a.target.localeCompare(b.target));
}
