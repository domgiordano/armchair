"use client";

import { APP_NAMES, getOverview, type AppName, type Overview } from "@/lib/api/admin";
import { useLoad } from "@/lib/load";

import { ErrorNote, Skeleton } from "../account/ui";
import { BarChart, CARD, day, pct, Stat, TABLE_WRAP, TD, TH } from "./parts";

const APPS: AppName[] = ["dwts", "traitors", "hub"];

export function OverviewTab() {
  const [load, retry] = useLoad(getOverview);
  if (load.kind === "loading") {
    return (
      <div role="status" className="grid gap-4 sm:grid-cols-2">
        <span className="sr-only">Loading the overview...</span>
        <Skeleton className="h-28 rounded-3xl sm:col-span-2" />
        <Skeleton className="h-64 rounded-3xl" />
        <Skeleton className="h-64 rounded-3xl" />
      </div>
    );
  }
  if (load.kind === "error") return <ErrorNote what="the overview" message={load.message} retry={retry} />;
  return <OverviewBody data={load.value} />;
}

function OverviewBody({ data }: { data: Overview }) {
  const { totals, funnel } = data;
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted">
        Activity since tracking began on {day(data.since)}. Signups and answers count from launch.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Users" value={totals.users} />
        <Stat label="DAU" value={totals.dau} />
        <Stat label="WAU" value={totals.wau} />
        <Stat label="MAU" value={totals.mau} />
        <Stat label="Devices" value={totals.devices30} note="30 days" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="weeks-title" className={CARD}>
          <h2 id="weeks-title" className="mb-4 text-lg font-bold">
            Users by week
          </h2>
          <BarChart
            title="Active users and signups per week"
            bars={data.weeks.map((w) => ({ label: w.week.slice(5), values: [w.active, w.signups], muted: !w.tracked }))}
            series={[
              { name: "active", className: "fill-blue" },
              { name: "signups", className: "fill-gold" },
            ]}
          />
        </section>

        <section aria-labelledby="apps-title" className={CARD}>
          <h2 id="apps-title" className="mb-4 text-lg font-bold">
            By app
          </h2>
          <div className={TABLE_WRAP}>
            <table className="w-full min-w-[22rem] text-sm">
              <thead>
                <tr>
                  <th className={TH}>App</th>
                  <th className={TH}>DAU</th>
                  <th className={TH}>WAU</th>
                  <th className={TH}>MAU</th>
                  <th className={TH}>Events 30d</th>
                </tr>
              </thead>
              <tbody>
                {APPS.map((a) => (
                  <tr key={a} className="border-t border-line/70">
                    <th scope="row" className={`${TD} text-left font-semibold`}>
                      {APP_NAMES[a]}
                    </th>
                    <td className={TD}>{data.apps[a].dau}</td>
                    <td className={TD}>{data.apps[a].wau}</td>
                    <td className={TD}>{data.apps[a].mau}</td>
                    <td className={TD}>{data.apps[a].events30}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="funnel-title" className={CARD}>
          <h2 id="funnel-title" className="mb-1 text-lg font-bold">
            Funnel, 30 days
          </h2>
          <p className="mb-4 text-xs text-muted">{funnel.signups} new signups in the same 30 days.</p>
          <ol className="flex flex-col gap-3">
            {(
              [
                ["Visited", funnel.visitors, "browsers"],
                ["Signed in", funnel.signedIn, "accounts"],
                ["Scored or picked", funnel.answered, "accounts"],
              ] as const
            ).map(([label, n, unit], i, all) => {
              const of = i ? all[i - 1][1] : n;
              return (
                <li key={label} className="flex flex-col gap-1">
                  <span className="flex justify-between text-sm">
                    <span>{label}</span>
                    <span className="text-muted tabular-nums">
                      {n} {unit}
                      {i > 0 && of > 0 && ` · ${pct(n / of)}`}
                    </span>
                  </span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-line">
                    <span
                      className="block h-full rounded-full bg-linear-to-r from-blue via-magenta to-orange"
                      style={{ width: `${funnel.visitors ? (n / funnel.visitors) * 100 : 0}%` }}
                    />
                  </span>
                </li>
              );
            })}
          </ol>
        </section>

        <section aria-labelledby="retention-title" className={CARD}>
          <h2 id="retention-title" className="mb-1 text-lg font-bold">
            Retention by signup week
          </h2>
          <p className="mb-4 text-xs text-muted">Share of each week&rsquo;s signups active in each week after. Blank is before tracking.</p>
          <div className={TABLE_WRAP}>
            <table className="w-full min-w-[24rem] text-xs">
              <thead>
                <tr>
                  <th className={TH}>Week</th>
                  <th className={TH}>Size</th>
                  {data.retention[0]?.weeks.map((_, k) => (
                    <th key={k} className={TH}>
                      W{k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.retention.map((c) => (
                  <tr key={c.cohort} className="border-t border-line/70">
                    <th scope="row" className={`${TD} text-left font-medium whitespace-nowrap`}>
                      {c.cohort.slice(5)}
                    </th>
                    <td className={TD}>{c.size}</td>
                    {c.weeks.map((w, k) => (
                      <td
                        key={k}
                        className={`${TD} text-center`}
                        style={w === null ? undefined : { backgroundColor: `rgb(59 91 255 / ${0.12 + w * 0.7})` }}
                      >
                        {w === null ? "" : pct(w)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {data.participation.map((s) => (
        <section key={s.season} aria-labelledby={`p-${s.season}`} className={CARD}>
          <h2 id={`p-${s.season}`} className="mb-4 text-lg font-bold">
            {s.app === "dwts" ? "Scoring" : "Picks"} per episode · {s.season}
          </h2>
          {s.episodes.length ? (
            <BarChart
              title={`Users who answered each episode of ${s.season}`}
              bars={s.episodes.map((e) => ({ label: `Ep ${e.ep}`, values: [e.users, e.forfeits] }))}
              series={[
                { name: s.app === "dwts" ? "users who scored" : "users who picked", className: "fill-magenta" },
                { name: "forfeits", className: "fill-muted" },
              ]}
            />
          ) : (
            <p className="text-sm text-muted">No episodes have aired yet.</p>
          )}
        </section>
      ))}
    </div>
  );
}
