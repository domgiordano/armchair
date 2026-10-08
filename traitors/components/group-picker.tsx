import { Select } from "@/components/ui/select";
import { FRIENDS } from "@/lib/api/traitors";
import type { GroupFilter } from "@/lib/group-filter";

/** Everyone, your friends, or one of your groups. The server decides what each may show. */
export function GroupPicker({ groups, failed, group, pick }: GroupFilter) {
  if (failed) return <p className="text-ash">Couldn&apos;t load your groups. Showing everyone.</p>;
  if (groups === null) return null;
  return (
    <Select
      label="Compare with"
      value={group ?? ""}
      options={[
        { value: "", label: "Everyone" },
        { value: FRIENDS, label: "Friends" },
        ...groups.map((g) => ({ value: g.id, label: `${g.name} (${g.members.length})` })),
      ]}
      onChange={(id) => pick(id || null)}
    />
  );
}
