import Link from "next/link";

import { Select } from "@/components/ui/select";
import { groupHref } from "@armchair/app-core/api/groups";
import { EVERYONE, scopeOptions, type GroupScope } from "@armchair/app-core/show/group-scope";
import { button, EYEBROW, TEXT_LINK } from "@/lib/ui";

/**
 * Who the page compares against: Everyone, Friends where the page has them, or a group.
 * The same control and the same saved scope on every page, with one tap back to Everyone.
 * The server decides what each may show.
 */
export function GroupScopeControl(props: GroupScope) {
  const { groups, failed, friends, scope, group, pick } = props;
  if (failed) return <p className="text-sm text-silver-dim">Couldn&apos;t load your groups. Showing everyone.</p>;
  if (groups === null) return null;
  const start = (
    <Link href="/social/?view=groups" className={TEXT_LINK}>
      Start a group to compare with friends
    </Link>
  );
  if (groups.length === 0 && !friends) return <span className="inline-flex min-h-11 items-center self-start">{start}</span>;

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className={EYEBROW}>Compare with</span>
        {group ? (
          <Link href={groupHref(group)} className={TEXT_LINK}>
            Group page
          </Link>
        ) : (
          groups.length === 0 && start
        )}
      </div>
      <div className="flex items-center gap-2">
        <Select
          label="Compare with"
          hideLabel
          className="min-w-0 flex-1"
          value={scope ?? ""}
          options={scopeOptions(props)}
          onChange={(v) => pick(v || null)}
        />
        {scope !== null && (
          <button type="button" aria-label="Show Everyone" className={button("ghost", "sm")} onClick={() => pick(null)}>
            {EVERYONE}
          </button>
        )}
      </div>
    </div>
  );
}
