/** Lowercase, accents and apostrophes off, one space between words, as backend people.fold(). */
export function fold(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[^\x00-\x7f]/g, "")
    .replace(/'/g, "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

const words = (folded: string) => folded.split(/[^a-z0-9]+/).filter(Boolean);

/** Optimal string alignment distance: Levenshtein plus swapping two neighbours. */
export function distance(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
      }
    }
  }
  return rows[a.length][b.length];
}

// A typed word of this length or more may be one edit off: below it, one edit
// matches half the names in the show.
const FUZZY_MIN = 4;

/** A typed word against a name's word, which the user may not have finished typing. */
function close(typed: string, word: string): boolean {
  if (word.startsWith(typed)) return true;
  if (typed.length < FUZZY_MIN) return false;
  // One edit off the start of the word, at the length typed or one either side.
  return [typed.length - 1, typed.length, typed.length + 1].some((n) => distance(typed, word.slice(0, n)) <= 1);
}

export const EXACT = 0;
export const PREFIX = 1;
export const WORD = 2;
export const INSIDE = 3;
export const FUZZY = 4;

/**
 * How well `name` matches `q` (already folded), best first: the whole name, its
 * start, every typed word starting a word of the name, `q` anywhere in it, then
 * every typed word within one typo of a word. Null when it doesn't match.
 */
export function rank(name: string, q: string): number | null {
  const folded = fold(name);
  if (folded === q) return EXACT;
  if (folded.startsWith(q)) return PREFIX;
  const have = words(folded);
  const typed = words(q);
  if (typed.length === 0) return null;
  if (typed.every((t) => have.some((w) => w.startsWith(t)))) return WORD;
  if (folded.includes(q)) return INSIDE;
  return typed.every((t) => have.some((w) => close(t, w))) ? FUZZY : null;
}

/** Up to `limit` of `items` matching `q`, best first; ties keep `items` order. */
export function search<T>(items: readonly T[], q: string, name: (item: T) => string, limit: number): T[] {
  const folded = fold(q);
  if (!folded) return [];
  const hits: { item: T; r: number; i: number }[] = [];
  items.forEach((item, i) => {
    const r = rank(name(item), folded);
    if (r !== null) hits.push({ item, r, i });
  });
  return hits
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .slice(0, limit)
    .map((h) => h.item);
}
