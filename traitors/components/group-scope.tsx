import { Select } from "@/components/ui/select";
import { EVERYONE, scopeOptions, type GroupScope } from "@armchair/app-core/show/group-scope";
import { button } from "@/lib/ui";

/**
 * Who the page compares against: Everyone, Friends, or a group. The same control and the
 * same saved scope on every page, with one tap back to Everyone. The server decides what each may show.
 */
export function GroupScopeControl(props: GroupScope) {
  const { groups, failed, scope, pick } = props;
  if (failed) return <p className="text-ash">Couldn&apos;t load your groups. Showing everyone.</p>;
  if (groups === null) return null;
  return (
    <div className="flex items-end gap-2">
      <Select
        label="Compare with"
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
  );
}
