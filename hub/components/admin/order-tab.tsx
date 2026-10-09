"use client";

import { useCallback, useState, type DragEvent } from "react";

import { getLineup, setOrder, type Lineup, type LineupDance, type OrderSource } from "@/lib/api/admin";
import { request } from "@/lib/api/client";
import { currentSeason, listSeasons } from "@/lib/api/dwts";
import { message, useLoad } from "@/lib/load";
import { fromPaste } from "@/lib/order-paste";

import { ErrorNote, INPUT, PRIMARY, QUIET, SECONDARY, SkeletonRows } from "../account/ui";
import { CARD, when } from "./parts";

interface SeasonEpisode {
  ep: number;
  week: number;
  airDate: string | null;
  theme: string | null;
}

interface Schedule {
  season: string;
  episodes: SeasonEpisode[];
  /** The first episode airing today or later: the one an order is usually for. */
  next: number;
}

async function schedule(): Promise<Schedule | null> {
  const season = currentSeason(await listSeasons());
  if (!season) return null;
  const { episodes } = await request<{ episodes: SeasonEpisode[] }>(`/seasons/get?season=${encodeURIComponent(season.id)}`);
  // Air dates are the show's calendar days, so compare days, not instants.
  const today = new Date().toLocaleDateString("en-CA");
  const next = episodes.find((e) => e.airDate && e.airDate >= today) ?? episodes[episodes.length - 1];
  return { season: season.id, episodes, next: next?.ep ?? 1 };
}

const SOURCE: Record<Exclude<OrderSource, null>, string> = {
  wikipedia: "from Wikipedia",
  admin: "set here",
  live: "from the live show",
};

export function sourceLine(l: Pick<Lineup, "runningOrder" | "orderSource" | "orderAt">): string {
  if (!l.runningOrder || !l.orderSource) return "Not announced yet. The episode page shows last week's order.";
  return `Running order ${SOURCE[l.orderSource]}${l.orderAt ? `, ${when(l.orderAt)}` : ""}.`;
}

/** The current season's running order for one night: arrange it by hand, or paste it, before the show. */
export function OrderTab() {
  const [load, retry] = useLoad(schedule);
  if (load.kind === "loading") return <SkeletonRows label="Loading the season" rows={3} />;
  if (load.kind === "error") return <ErrorNote what="the season" message={load.message} retry={retry} />;
  if (!load.value) return <p className="text-sm text-muted">No DWTS season yet.</p>;
  return <Night schedule={load.value} />;
}

function Night({ schedule: s }: { schedule: Schedule }) {
  const [ep, setEp] = useState(s.next);
  const fetcher = useCallback(() => getLineup(s.season, ep), [s.season, ep]);
  const [load, retry, replace] = useLoad(fetcher);

  return (
    <section aria-labelledby="order-title" className={`${CARD} flex flex-col gap-4`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="order-title" className="text-lg font-bold">
            Running order
          </h2>
          <p className="text-xs text-muted">
            Set it here when you have it before Wikipedia does. Once the show starts scoring, the live order takes over.
          </p>
        </div>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
          Episode
          <select value={ep} onChange={(e) => setEp(Number(e.target.value))} className={`${INPUT} w-auto`}>
            {s.episodes.map((e) => (
              <option key={e.ep} value={e.ep}>
                {`Week ${e.week}${e.theme ? ` · ${e.theme}` : ""}${e.airDate ? ` · ${e.airDate}` : ""}`}
              </option>
            ))}
          </select>
        </label>
      </div>
      {load.kind === "loading" && <SkeletonRows label="Loading the night" rows={6} />}
      {load.kind === "error" && <ErrorNote what="this night" message={load.message} retry={retry} />}
      {load.kind === "ready" && <Arrange key={ep} lineup={load.value} onSaved={replace} />}
    </section>
  );
}

function Arrange({ lineup, onSaved }: { lineup: Lineup; onSaved: (l: Lineup) => void }) {
  const [order, setOrderState] = useState<LineupDance[]>(lineup.dances);
  const [dragging, setDragging] = useState<number | null>(null);
  const [paste, setPaste] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const live = lineup.orderSource === "live";
  const dirty = order.some((d, i) => d.key !== lineup.dances[i]?.key) || (!lineup.runningOrder && order.length > 0);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || from === to) return;
    const next = [...order];
    const [d] = next.splice(from, 1);
    next.splice(to, 0, d);
    setOrderState(next);
    setNote(null);
  };
  const onDrop = (e: DragEvent, to: number) => {
    e.preventDefault();
    if (dragging !== null) move(dragging, to);
    setDragging(null);
  };
  const applyPaste = () => {
    const { keys, unmatched } = fromPaste(paste, order);
    const byKey = new Map(order.map((d) => [d.key, d]));
    setOrderState(keys.flatMap((k) => byKey.get(k) ?? []));
    setNote(unmatched.length ? `No dance for: ${unmatched.join("; ")}. Those couples kept their places at the end.` : "Pasted. Check it, then save.");
  };
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const saved = await setOrder(lineup.season, lineup.ep, order.map((d) => d.key));
      onSaved({ ...lineup, ...saved, runningOrder: true, dances: order.map((d, i) => ({ ...d, order: i + 1 })) });
      setNote("Saved. The episode page lists the dances in this order now.");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p role="status" className="text-sm">
        {sourceLine(lineup)}
      </p>
      <ol aria-label="Dances in running order" className="flex flex-col gap-1.5">
        {order.map((d, i) => (
          <li
            key={d.key}
            draggable={!live}
            onDragStart={() => setDragging(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onDrop(e, i)}
            onDragEnd={() => setDragging(null)}
            className={`flex items-center gap-3 rounded-2xl border border-line bg-night/60 px-3 py-2 ${dragging === i ? "opacity-50" : ""} ${live ? "" : "cursor-grab active:cursor-grabbing"}`}
          >
            <span aria-hidden="true" className="w-6 text-right font-bold text-gold tabular-nums">
              {i + 1}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-semibold">{d.names.join(", ")}</span>
              {(d.style || d.song) && <span className="truncate text-xs text-muted">{[d.style, d.song].filter(Boolean).join(" · ")}</span>}
            </span>
            {!live && (
              <span className="flex shrink-0 gap-1">
                <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`Move ${d.names[0]} up`} className={QUIET}>
                  Up
                </button>
                <button type="button" onClick={() => move(i, i + 1)} disabled={i === order.length - 1} aria-label={`Move ${d.names[0]} down`} className={QUIET}>
                  Down
                </button>
              </span>
            )}
          </li>
        ))}
      </ol>
      {!live && (
        <>
          <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
            Paste an order, one couple a line
            <textarea
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              rows={4}
              placeholder={"1. Ciara & Brandon\n2. Ezra & Daniella"}
              className={`${INPUT} min-h-28 py-3 font-normal`}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={applyPaste} disabled={!paste.trim()} className={SECONDARY}>
              Use pasted order
            </button>
            <button type="button" onClick={() => void save()} disabled={busy || !dirty} className={PRIMARY}>
              {busy ? "Saving..." : "Save running order"}
            </button>
          </div>
        </>
      )}
      {note && <p className="text-sm text-muted">{note}</p>}
      {error && (
        <p role="alert" className="text-sm text-magenta">
          Not saved: {error}
        </p>
      )}
    </div>
  );
}
