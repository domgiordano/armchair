import { Select } from "@/components/ui/select";
import type { GroupFilter } from "@/lib/group-filter";

/** Everyone or one of the caller's groups. The server decides what either may show. */
export function GroupPicker({ groups, failed, group, pick }: GroupFilter) {
  if (failed) return <p className="text-ash">Couldn&apos;t load your groups. Showing everyone.</p>;
  if (groups === null || groups.length === 0) return null;
  return (
    <Select
      label="Compare with"
      value={group ?? ""}
      options={[
        { value: "", label: "Everyone" },
        ...groups.map((g) => ({ value: g.id, label: `${g.name} (${g.members.length})` })),
      ]}
      onChange={(id) => pick(id || null)}
    />
  );
}
