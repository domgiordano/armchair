import type { BoardRow, CoupleDance, CoupleStats, CoupleSummary, Performers, WeekBoard } from "@/lib/api/couples";
import type { Overview } from "@/lib/api/overview";
import type { PerformanceRow, PersonPage } from "@/lib/api/people";
import type { Profile } from "@/lib/api/profile";
import type { Seals } from "@/lib/show/sealed";

/*
 * The server opens a dance's judges the moment you answer it; a dance locked
 * but not yet revealed (lib/show/sealed.ts) must not show them anywhere else
 * either. Each read below drops or blanks what a sealed dance would give away:
 * its judges' numbers, any average with them in it, and that night's eliminations.
 */

/** Highest first; ties share a rank and the next one skips, as week_board_get ranks. */
function ranks(values: (number | null)[]): (number | null)[] {
  return values.map((v) => (v === null ? null : 1 + values.filter((x) => x !== null && x > v).length));
}

export function sealBoard(board: WeekBoard, seals: Seals): WeekBoard {
  if (seals.none) return board;
  const held = board.couples.filter((r) => seals.couple(board.season, r.id) && seals.episode(board.season, board.ep));
  if (held.length === 0) return seals.episode(board.season, board.ep) ? { ...board, eliminated: [] } : board;
  const ids = new Set(held.map((r) => r.id));
  const blanked = board.couples.map((r): BoardRow => (ids.has(r.id) ? { ...r, judges: null, judgesTotal: null, rankDelta: null } : r));
  const judgeRanks = ranks(blanked.map((r) => r.judges));
  const couples = blanked.map((r, i) => {
    const judges = judgeRanks[i];
    const you = r.ranks.you;
    return { ...r, ranks: { ...r.ranks, judges }, rankDelta: judges && you ? judges - you : null };
  });
  return {
    ...board,
    couples,
    disagreements: board.disagreements.filter((id) => !ids.has(id)),
    eliminated: [],
    sealed: [...ids],
  };
}

function sealRow(row: PerformanceRow, seals: Seals): PerformanceRow {
  if (row.locked || !seals.dance(row.season, row.ep, row.key)) return row;
  const { season, ep, week, key, style, song, dancers } = row;
  return { season, ep, week, key, style, song, dancers, locked: true, sealed: true, writeup: row.writeup ? { locked: true } : null };
}

/** A person's page: sealed dances read as locked, and the numbers built over them go. */
export function sealPerson(page: PersonPage, seals: Seals): PersonPage {
  if (seals.none) return page;
  const performances = page.performances.map((r) => sealRow(r, seals));
  const judged = page.judged && { ...page.judged, rows: page.judged.rows.map((r) => sealRow(r, seals)) };
  const changed = (a: PerformanceRow[], b: PerformanceRow[]) => a.some((r, i) => r !== b[i]);
  const dancer = changed(performances, page.performances);
  const judge = page.judged !== null && judged !== null && changed(judged.rows, page.judged.rows);
  const seasons = page.seasons.map((s) =>
    s.result && "status" in s.result && s.result.status === "out" && seals.episode(s.season, s.result.ep)
      ? { ...s, result: { locked: true as const, season: s.season, ep: s.result.ep } }
      : s,
  );
  if (!dancer && !judge && seasons.every((s, i) => s === page.seasons[i])) return page;
  const d = page.stats.dancer;
  return {
    ...page,
    performances,
    judged,
    seasons,
    stats: {
      dancer: d && dancer ? { ...d, judges: { ...d.judges, mean: null }, best: null, mine: { ...d.mine, gap: null } } : d,
      judge: judge ? null : page.stats.judge,
    },
  };
}

/** Your profile or someone's: the best and worst calls and the weeks with a sealed dance in them. */
export function sealProfile(profile: Profile, seals: Seals): Profile {
  if (seals.none) return profile;
  const { detail } = profile;
  const call = (c: Profile["detail"]["best"]) => (c && seals.dance(c.season, c.ep, c.key) ? null : c);
  const weeks = detail.weeks.map((w) => (seals.episode(w.season, w.ep) ? { ...w, judges: null, mae: null } : w));
  const best = call(detail.best);
  const worst = call(detail.worst);
  if (best === detail.best && worst === detail.worst && weeks.every((w, i) => w === detail.weeks[i])) return profile;
  return { ...profile, detail: { ...detail, best, worst, weeks } };
}

function sealSummary<C extends CoupleSummary>(c: C, seals: Seals): C {
  const out = c.eliminated && seals.episode(c.season, c.eliminated.ep) ? null : c.eliminated;
  if (!seals.couple(c.season, c.id)) return out === c.eliminated ? c : { ...c, eliminated: out };
  return { ...c, judges: null, gap: null, absGap: null, eliminated: out };
}

function sealCouple(c: CoupleStats, seals: Seals): CoupleStats {
  const summary = sealSummary(c, seals);
  if (summary === c) return c;
  const dance = (d: CoupleDance) => (seals.dance(c.season, d.ep, d.key) ? { ...d, judges: null } : d);
  return { ...summary, best: dance(c.best), worst: dance(c.worst), weeks: c.weeks.map(dance) };
}

function sealCouples<C extends CoupleSummary>(p: Performers<C>, seals: Seals, seal: (c: C) => C): Performers<C> {
  if (seals.none) return p;
  const couples = p.couples.map(seal);
  // The lists name couples by ref, `season/id`.
  if (couples.every((c, i) => c === p.couples[i])) return p;
  // Only a sealed dance moves a couple's gap; a held exit doesn't.
  const held = new Set(couples.filter((c) => seals.couple(c.season, c.id)).map((c) => c.ref));
  const keep = (refs: string[]) => refs.filter((r) => !held.has(r));
  return { ...p, couples, softerOn: keep(p.softerOn), tougherOn: keep(p.tougherOn) };
}

export const sealPerformers = (p: Performers, seals: Seals) => sealCouples(p, seals, (c) => sealCouple(c, seals));

export const sealFavorites = (p: Performers<CoupleSummary>, seals: Seals) => sealCouples(p, seals, (c) => sealSummary(c, seals));

/** The overview's couple standings: no judges' average or elimination built on a sealed dance. */
export function sealOverview(o: Overview, seals: Seals): Overview {
  if (seals.none) return o;
  const couples = o.couples.map((c) => {
    const out = c.eliminated && seals.episode(o.season, c.eliminated.ep) ? null : c.eliminated;
    const average = seals.couple(o.season, c.id) ? null : c.average;
    return out === c.eliminated && average === c.average ? c : { ...c, average, eliminated: out };
  });
  if (couples.every((c, i) => c === o.couples[i])) return o;
  const hidden = couples.filter((c, i) => c.eliminated === null && o.couples[i].eliminated !== null).length;
  return { ...o, couples, progress: { ...o.progress, couplesLeft: o.progress.couplesLeft + hidden } };
}
