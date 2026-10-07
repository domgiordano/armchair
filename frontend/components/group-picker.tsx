import Link from "next/link";

import { Tabs } from "@/components/ui/tabs";
import { groupHref } from "@armchair/app-core/api/groups";
import type { GroupFilter } from "@/lib/show/group-filter";
import { EYEBROW, TEXT_LINK } from "@/lib/ui";

const GLOBAL = "global";

/** What the page compares against, for headings: "Global" or the group's name. */
export function scopeName({ groups, group }: Pick<GroupFilter, "groups" | "group">): string {
  return groups?.find((g) => g.id === group)?.name ?? "Global";
}

interface GroupPickerProps extends GroupFilter {
  /** The id of the content the switch filters. */
  panelId: string;
}

/** Global or one of the caller's groups, one tap each. The server decides what either may show. */
export function GroupPicker({ groups, failed, group, pick, panelId }: GroupPickerProps) {
  if (failed) return <p className="text-sm text-silver-dim">Couldn&apos;t load your groups. Showing everyone.</p>;
  if (groups === null) return null;
  if (groups.length === 0) {
    return (
      <Link href="/social/?view=groups" className={`${TEXT_LINK} inline-flex min-h-11 items-center self-start`}>
        Start a group to compare with friends
      </Link>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className={EYEBROW}>Compare with</span>
        {group && (
          <Link href={groupHref(group)} className={TEXT_LINK}>
            Group page
          </Link>
        )}
      </div>
      <Tabs
        label="Compare with"
        scroll
        tabs={[{ id: GLOBAL, label: "Global" }, ...groups.map((g) => ({ id: g.id, label: g.name }))]}
        value={group ?? GLOBAL}
        onChange={(id) => pick(id === GLOBAL ? null : id)}
        panelId={panelId}
      />
    </div>
  );
}
