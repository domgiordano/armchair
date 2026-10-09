import type { LineupDance } from "@/lib/api/admin";

const fold = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[^\x00-\x7f]/g, "")
    .toLowerCase();

const words = (s: string) => fold(s).split(/[^a-z0-9]+/).filter(Boolean);

/**
 * A running order pasted as text, one dance a line ("1. Ciara & Brandon – Jazz"),
 * matched to the night's dances by a celebrity's first or last name. Returns the
 * keys in the pasted order, then any dance no line named, and the lines that
 * named nobody.
 */
export function fromPaste(text: string, dances: LineupDance[]): { keys: string[]; unmatched: string[] } {
  const left = [...dances];
  const keys: string[] = [];
  const unmatched: string[] = [];
  for (const line of text.split("\n").map((l) => l.trim()).filter(Boolean)) {
    const have = new Set(words(line));
    const named = (d: LineupDance) => d.names.some((n) => words(n).some((w) => have.has(w)));
    const i = left.findIndex(named);
    if (i < 0) {
      unmatched.push(line);
      continue;
    }
    keys.push(left[i].key);
    left.splice(i, 1);
  }
  return { keys: [...keys, ...left.map((d) => d.key)], unmatched };
}
