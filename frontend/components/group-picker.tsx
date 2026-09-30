import Link from "next/link";

import type { GroupFilter } from "@/lib/show/group-filter";

const LINK =
  "rounded-md text-sm text-neutral-400 underline underline-offset-4 hover:text-neutral-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300";

/** Everyone or one of the caller's groups. The server decides what either may show. */
export function GroupPicker({ groups, failed, group, pick }: GroupFilter) {
  if (failed) return <p className="text-sm text-neutral-400">Couldn&apos;t load your groups. Showing everyone.</p>;
  if (groups === null) return null;
  if (groups.length === 0) {
    return (
      <Link href="/groups/" className={`${LINK} self-start`}>
        Start a group to compare with friends
      </Link>
    );
  }

  return (
    <div className="flex items-end gap-3">
      <label className="flex flex-1 flex-col gap-1 text-sm text-neutral-400">
        Compare with
        <select
          value={group ?? ""}
          onChange={(e) => pick(e.target.value || null)}
          className="min-h-11 rounded-md border border-neutral-700 bg-neutral-900 px-3 text-base text-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
        >
          <option value="">Everyone</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name} ({g.members.length})
            </option>
          ))}
        </select>
      </label>
      <Link href="/groups/" className={`${LINK} self-center`}>
        Groups
      </Link>
    </div>
  );
}
