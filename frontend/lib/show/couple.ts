import type { Average, OpenRow, PerformanceRow, PersonPage, SeasonResult, Stint } from "@/lib/api/people";
import { ordinal } from "@/lib/show/couples";

export const paddle = (r: OpenRow) => (r.mine && "value" in r.mine ? r.mine.value : null);

const mean = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : null);

function pooled(groups: Average[]): Average {
  const count = groups.reduce((n, g) => n + g.count, 0);
  const total = groups.reduce((n, g) => n + (g.mean ?? 0) * g.count, 0);
  return { count, mean: count ? Math.round((total / count) * 100) / 100 : null };
}

export interface CoupleTotals {
  dances: number;
  /** Dances the gate still hides: the caller hasn't answered them. */
  locked: number;
  judges: number | null;
  judged: number;
  you: number | null;
  paddles: number;
  /** Your paddle minus the judges' mean, averaged over dances with both: positive is softer. */
  gap: number | null;
  friends: Average;
  everyone: Average;
  best: OpenRow | null;
  /** Only once there are two judged dances, or it would just be `best` again. */
  worst: OpenRow | null;
  favorite: OpenRow | null;
  /** The dance where your paddle and the judges' mean sat furthest apart. */
  split: OpenRow | null;
}

/** A couple's season in numbers, over the rows people_get returned for it. */
export function coupleTotals(rows: PerformanceRow[]): CoupleTotals {
  const open = rows.filter((r): r is OpenRow => !r.locked);
  const judged = open.filter((r) => r.panelMean !== null);
  const scored = open.filter((r) => paddle(r) !== null);
  const both = judged.filter((r) => paddle(r) !== null);
  const by = (pick: (r: OpenRow) => number) => (a: OpenRow, b: OpenRow) => pick(b) - pick(a) || a.ep - b.ep;
  const gap = (r: OpenRow) => (paddle(r) ?? 0) - (r.panelMean ?? 0);
  const byJudges = [...judged].sort(by((r) => r.panelMean ?? 0));
  return {
    dances: rows.length,
    locked: rows.length - open.length,
    judges: mean(judged.map((r) => r.panelMean ?? 0)),
    judged: judged.length,
    you: mean(scored.map((r) => paddle(r) ?? 0)),
    paddles: scored.length,
    gap: mean(both.map(gap)),
    friends: pooled(open.map((r) => r.friends)),
    everyone: pooled(open.map((r) => r.everyone)),
    best: byJudges[0] ?? null,
    worst: byJudges.length > 1 ? byJudges[byJudges.length - 1] : null,
    favorite: [...scored].sort(by((r) => paddle(r) ?? 0))[0] ?? null,
    split: [...both].sort(by((r) => Math.abs(gap(r))))[0] ?? null,
  };
}

/** The couple's result in `season`: null when the person never danced it. */
export function coupleResult(person: PersonPage, season: string): SeasonResult | null {
  return person.seasons.find((s) => s.season === season && s.role !== "judge")?.result ?? null;
}

/** "W3", or "Ep 6" for a night with no week. */
export const weekShort = (r: { ep: number; week: number | null }) => (r.week === null ? `Ep ${r.ep}` : `W${r.week}`);

/** "Won the season", "Runner-up", "5th of 12". */
export function placeText(place: number, cast: number): string {
  if (place === 1) return "Won the season";
  if (place === 2) return "Runner-up";
  return `${ordinal(place)} of ${cast}`;
}

const number = (season: string) => Number(season.split("-")[1]);

export interface Career {
  /** This season's place in their run on the show: 1 for a debut. */
  nth: number;
  /** Seasons they danced before this one, oldest first. */
  before: Stint[];
  partners: number;
  titles: Stint[];
  /** Their best finish before this season; a title counts. */
  best: Stint | null;
}

/** Someone's dancing seasons up to `season`, from the stints people_get lists. Places only exist for finished seasons. */
export function career(person: PersonPage, season: string): Career {
  const before = person.seasons
    .filter((s) => s.role !== "judge" && s.number < number(season))
    .sort((a, b) => a.number - b.number);
  const placed = before.filter((s) => s.place !== undefined);
  return {
    nth: before.length + 1,
    before,
    partners: new Set(before.flatMap((s) => (s.partners ?? []).map((p) => p.id))).size,
    titles: placed.filter((s) => s.place === 1),
    best: [...placed].sort((a, b) => (a.place ?? 0) - (b.place ?? 0) || b.number - a.number)[0] ?? null,
  };
}

export interface Partnership {
  nights: number;
  /** Every style they danced, in order, locked dances included: the pre-show table names them. */
  styles: string[];
  /** The judges' best average for them, over dances the caller can see. */
  top: number | null;
  /** Confirmed 10s from any judge. */
  tens: number;
}

export function partnership(rows: PerformanceRow[]): Partnership {
  const open = rows.filter((r): r is OpenRow => !r.locked);
  const means = open.flatMap((r) => (r.panelMean === null ? [] : [r.panelMean]));
  return {
    nights: new Set(rows.map((r) => r.ep)).size,
    styles: [...new Set(rows.flatMap((r) => (r.style ? [r.style.replace(/\s*\n\s*/g, " ")] : [])))],
    top: means.length ? Math.max(...means) : null,
    tens: open.reduce((n, r) => n + r.judges.filter((j) => j.value === 10 && j.state === "confirmed").length, 0),
  };
}

/** Plain text, or a person to link. */
export type Segment = string | { id: string; name: string };

const article = (word: string) => (/^(?:eu|uni|one)/i.test(word) || !/^[aeiou]/i.test(word) ? "a" : "an");

/** "American figure skater (born 1999)" → "an American figure skater". */
function described(description: string): string {
  const bare = description.replace(/\s*\([^)]*\)\s*$/, "").trim();
  return `${article(bare)} ${bare}`;
}

function names(stints: Stint[], cap: number): Segment[] {
  const partners = stints.flatMap((s) => s.partners ?? []).reverse();
  const shown = partners.slice(0, cap);
  const out: Segment[] = [];
  shown.forEach((p, i) => {
    if (i > 0) out.push(i === shown.length - 1 && partners.length <= cap ? " and " : ", ");
    out.push({ id: p.id, name: p.name });
  });
  if (partners.length > cap) out.push(` and ${partners.length - cap} more`);
  return out;
}

const seasonOf = (s: Stint) => `Season ${s.number}`;

/**
 * A couple's overview as sentences of text and linked people: who the celebrity
 * is, their earlier seasons, and the pro's run before this one. Every place in
 * it comes from a finished season, so nothing here is a result the gate holds back.
 */
export function overviewLines(celeb: PersonPage, pro: { id: string; name: string; page: PersonPage | null }, season: string): Segment[][] {
  const lines: Segment[][] = [];
  const me = { id: celeb.id, name: celeb.name };
  if (celeb.bio?.description) lines.push([me, ` is ${described(celeb.bio.description)}.`]);
  else if (celeb.facts?.occupations.length) lines.push([me, ` is known as ${described(celeb.facts.occupations[0])}.`]);

  const back = career(celeb, season).before;
  if (back.length) {
    const last = back[back.length - 1];
    const finish = !last.place || !last.cast ? "" : last.place === 1 ? " and winning it" : `, finishing ${last.place === 2 ? "runner-up" : `${ordinal(last.place)} of ${last.cast}`}`;
    lines.push(["Back on the floor after dancing with ", ...names([last], 1), ` in ${seasonOf(last)}${finish}.`]);
  }

  if (!pro.page) return lines;
  const run = career(pro.page, season);
  const who = { id: pro.id, name: pro.name };
  if (run.nth === 1) {
    lines.push(["This is ", who, "'s first season as a pro."]);
    return lines;
  }
  lines.push(["This is ", who, `'s ${ordinal(run.nth)} season as a pro, after partnering `, ...names(run.before, 3), "."]);
  const [first, ...more] = [...run.titles].reverse();
  if (first) {
    const partner = first.partners?.[0];
    lines.push([
      more.length ? `${run.titles.length}-time champion, most recently with ` : "A champion before, with ",
      ...(partner ? [{ id: partner.id, name: partner.name }] : []),
      ` in ${seasonOf(first)}.`,
    ]);
  } else if (run.best?.place && run.best.cast && run.best.place <= 3) {
    const partner = run.best.partners?.[0];
    lines.push([
      `Best finish before this: ${placeText(run.best.place, run.best.cast).toLowerCase()} with `,
      ...(partner ? [{ id: partner.id, name: partner.name }] : []),
      ` in ${seasonOf(run.best)}.`,
    ]);
  }
  return lines;
}
