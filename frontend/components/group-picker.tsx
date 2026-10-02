import Link from "next/link";

import { Select } from "@/components/ui/select";
import { groupHref } from "@armchair/app-core/api/groups";
import type { GroupFilter } from "@/lib/show/group-filter";
import { button, TEXT_LINK } from "@/lib/ui";

/** Everyone or one of the caller's groups. The server decides what either may show. */
export function GroupPicker({ groups, failed, group, pick }: GroupFilter) {
  if (failed) return <p className="text-sm text-silver-dim">Couldn&apos;t load your groups. Showing everyone.</p>;
  if (groups === null) return null;
  if (groups.length === 0) {
    return (
      <Link href="/profile/?sheet=groups" className={`${TEXT_LINK} inline-flex min-h-11 items-center self-start`}>
        Start a group to compare with friends
      </Link>
    );
  }

  return (
    <div className="flex items-end gap-2">
      <Select
        label="Compare with"
        className="flex-1"
        value={group ?? ""}
        options={[
          { value: "", label: "Everyone" },
          ...groups.map((g) => ({ value: g.id, label: `${g.name} (${g.members.length})` })),
        ]}
        onChange={(id) => pick(id || null)}
      />
      <Link href={group ? groupHref(group) : "/profile/?sheet=groups"} className={button("ghost", "sm")}>
        {group ? "Group" : "Groups"}
      </Link>
    </div>
  );
}
