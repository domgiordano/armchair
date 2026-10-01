"use client";

import { PageLoader } from "@/components/disco-loader";
import { ErrorState } from "@/components/ui/states";
import { Headshot } from "@/components/headshot";
import { SignedIn } from "@/components/signed-in";
import { PageHeader } from "@/components/ui/page-header";
import type { Headshot as Shot, Person, Season } from "@/lib/api/show";
import { useSeason } from "@/lib/show/use-season";
import { TEXT_LINK } from "@/lib/ui";

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
  if (load.kind === "loading") return <PageLoader label="Loading credits" />;
  if (load.kind === "error") return <ErrorState what="credits" message={load.message} retry={load.retry} />;

  return (
    <>
      <PageHeader title="Photo credits">
        Headshots come from Wikimedia Commons under the licenses below, shown cropped to a circle.
      </PageHeader>
      <ul className="flex flex-col divide-y divide-silver/10">
        {credited(load.season).map((p) => (
          <li key={p.headshot.file} className="flex gap-3 py-3">
            <Headshot person={p} />
            <div className="flex min-w-0 flex-col text-sm">
              <span className="font-medium text-pearl">{p.name}</span>
              <span className="text-silver-dim">
                {p.headshot.author} · {p.headshot.license}
              </span>
              <a
                href={p.headshot.sourceUrl}
                rel="noopener noreferrer"
                target="_blank"
                className={`${TEXT_LINK} inline-flex min-h-11 items-center self-start`}
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
