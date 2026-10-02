import { LeagueDemo } from "@/components/league-demo";
import { reveal } from "@/lib/reveal";

const POINTS = [
  {
    title: "Friends",
    body: "Add people by name or send your invite link. Friends see your calls on a dance or an episode only once they've made their own.",
  },
  {
    title: "Groups",
    body: "Start a group for the people you watch with and share its link. It belongs to your account, so the same group is there on every show.",
  },
  {
    title: "Leaderboards",
    body: "Each show ranks the season its own way: points off the judges on Dancing with the Stars, points on The Traitors. See everyone, your friends, or one group.",
  },
];

export function FriendsLeague() {
  return (
    <section id="friends" aria-labelledby="friends-title" className="scroll-mt-20 border-t border-line py-16 lg:py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 lg:grid-cols-2 lg:gap-16">
        <div {...reveal()}>
          <p className="text-xs font-semibold tracking-[0.3em] text-magenta uppercase">Friends, groups, leaderboards</p>
          <h2 id="friends-title" className="mt-3 text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
            One crew, <span className="text-brand-gradient">every show.</span>
          </h2>
          <p className="mt-4 text-muted">
            The people you play with follow your account, not a show. Bring them once and they&rsquo;re on every board.
          </p>
          <dl className="mt-8 flex flex-col gap-6">
            {POINTS.map((p, i) => (
              <div key={p.title} className="border-l-2 border-violet/60 pl-4" {...reveal(i + 1)}>
                <dt className="font-semibold">{p.title}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-muted">{p.body}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div {...reveal(2)}>
          <LeagueDemo />
        </div>
      </div>
    </section>
  );
}
