import { Avatar } from "@/components/avatar";
import { displayName } from "@/components/social/parts";
import { UserLink } from "@/components/user-link";
import type { GroupMember } from "@armchair/app-core/api/groups";
import type { Leaderboard } from "@/lib/api/leaderboard";
import { cn, EYEBROW } from "@/lib/ui";

interface MemberProgressProps {
  board: Leaderboard;
  members: GroupMember[];
}

/** Everyone in the group and how far each is from a place on its leaderboard. */
export function MemberProgress({ board, members }: MemberProgressProps) {
  const { minDances } = board;
  const counts = new Map<string, { count: number; rank: number | null }>([
    ...board.unranked.map((u) => [u.sub, { count: u.count, rank: null }] as const),
    ...board.ranked.map((r) => [r.sub, { count: r.count, rank: r.rank }] as const),
  ]);
  const rows = members
    .map((m) => ({ member: m, ...(counts.get(m.sub) ?? { count: 0, rank: null }) }))
    .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity) || b.count - a.count);

  return (
    <section aria-labelledby="member-progress" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 id="member-progress" className={EYEBROW}>
          Members&apos; progress
        </h2>
        <p className="text-xs text-silver-dim">{minDances} scored dances puts you on the board</p>
      </div>
      <ul className="stagger grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(({ member, count, rank }) => {
          const name = displayName(member);
          const you = member.sub === board.me.sub;
          return (
            <li
              key={member.sub}
              className={cn(
                "flex items-center gap-3 rounded-lg border px-3 py-2.5",
                you ? "border-gold/35 bg-gold/[0.07]" : "border-silver/10 bg-ballroom/40",
              )}
            >
              <Avatar name={name} email="" picture={member.picture} size={32} />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="truncate text-sm font-medium text-pearl">
                  <UserLink sub={member.sub}>{name}</UserLink>
                  {you && <span className="text-gold-light"> (you)</span>}
                </p>
                <span
                  role="progressbar"
                  aria-label={`${name}: ${count} of ${minDances} dances to rank`}
                  aria-valuemin={0}
                  aria-valuemax={minDances}
                  aria-valuenow={Math.min(count, minDances)}
                  className="block h-1 overflow-hidden rounded-full bg-silver/10"
                >
                  <span
                    className={cn("grow-x block h-full rounded-full", rank === null ? "bg-silver/50" : "bg-gold")}
                    style={{ width: `${Math.min(1, count / minDances) * 100}%` }}
                  />
                </span>
              </div>
              <span className="shrink-0 text-right text-xs text-silver-dim tabular-nums">
                {rank === null ? (
                  <>
                    <span className="block text-sm font-semibold text-pearl">{count}</span>
                    {Math.max(0, minDances - count)} to rank
                  </>
                ) : (
                  <>
                    <span className="block text-sm font-semibold text-gold-light">#{rank}</span>
                    {count} dances
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
