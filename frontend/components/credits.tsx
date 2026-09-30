"use client";

import { ErrorState } from "@/components/ui/states";
import { Headshot } from "@/components/headshot";
import { SignedIn } from "@/components/signed-in";
import type { Headshot as Shot, Person, Season } from "@/lib/api/show";
import { useSeason } from "@/lib/show/use-season";

type Credited = Person & { headshot: Shot };

export function Credits() {
  return (
    <SignedIn title="Credits">
      <CreditList />
    </SignedIn>
  );
}

export function credited(season: Season): Credited[] {
  const people: Person[] = [...season.judges, ...season.contestants.flatMap((c) => c.members)];
  return people
    .filter((p): p is Credited => p.headshot !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function CreditList() {
  const load = useSeason();
  if (load.kind === "loading") return <p className="text-neutral-400">Loading credits...</p>;
  if (load.kind === "error") return <ErrorState what="credits" message={load.message} retry={load.retry} />;

  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">Photo credits</h1>
      <p className="text-sm text-neutral-400">
        Headshots come from Wikimedia Commons under the licenses below, shown cropped to a circle.
      </p>
      <ul className="flex flex-col gap-4">
        {credited(load.season).map((p) => (
          <li key={p.headshot.file} className="flex gap-3">
            <Headshot person={p} />
            <div className="flex min-w-0 flex-col text-sm">
              <span className="font-medium">{p.name}</span>
              <span className="text-neutral-400">
                {p.headshot.author} · {p.headshot.license}
              </span>
              <a
                href={p.headshot.sourceUrl}
                rel="noopener noreferrer"
                target="_blank"
                className="self-start rounded-sm text-amber-300 underline underline-offset-4 hover:text-amber-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
              >
                Source on Commons
                <span className="sr-only"> for {p.name} (opens in a new tab)</span>
              </a>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
