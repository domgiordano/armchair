import { ChairMark } from "@/components/chair-mark";
import { ICON_TRIGGER, ShowIcon, type Show } from "@/components/show-icon";
import { reveal } from "@/lib/reveal";

const POINTS = [
  "One Google sign-in opens every show app. No new account per show.",
  "Groups and friends belong to your Armchair Judge account, not to a show. A group you start for Dancing with the Stars is already there when the next show opens.",
  "Accuracy is kept per show and per season, so a great ballroom eye doesn't prop up a bad read on the round table.",
];

const SHOWS: { show: Show; name: string; tile: string; live: boolean }[] = [
  { show: "dwts", name: "Dancing with the Stars", tile: "border-[#2b3a7a] from-[#16245e] to-[#060b26] text-[#f3e6c0]", live: true },
  { show: "traitors", name: "The Traitors", tile: "border-[#1c3a2a] from-[#0b2418] to-[#040d08] text-[#e9dcc0]", live: true },
  { show: "survivor", name: "Survivor", tile: "border-[#5a2a10] from-[#3a1606] to-[#140803] text-[#ffe2c4]", live: false },
];

function AccountDiagram() {
  return (
    <div className="relative mx-auto w-full max-w-md" aria-hidden="true" {...reveal(2)}>
      <div className="mx-auto flex w-fit items-center gap-3 rounded-2xl border border-line bg-night-2 px-4 py-3 shadow-xl shadow-violet/10">
        <ChairMark className="size-10" />
        <div>
          <p className="text-sm font-semibold">Your account</p>
          <p className="text-[11px] text-muted">Profile &middot; groups &middot; friends</p>
        </div>
      </div>
      <svg viewBox="0 0 300 60" className="h-14 w-full" preserveAspectRatio="none">
        {[50, 150, 250].map((x) => (
          <path key={x} d={`M150 0 C150 30 ${x} 30 ${x} 60`} fill="none" className="account-flow stroke-violet/60" strokeWidth="1.5" strokeDasharray="4 4" />
        ))}
      </svg>
      <ul className="grid grid-cols-3 gap-2">
        {SHOWS.map((s) => (
          <li
            key={s.name}
            className={`${ICON_TRIGGER} flex min-h-24 flex-col gap-2 rounded-2xl border bg-linear-to-b p-3 ${s.tile}`}
          >
            <ShowIcon show={s.show} size={36} locked={!s.live} />
            <span className={`text-xs leading-tight font-semibold ${s.live ? "" : "opacity-55"}`}>{s.name}</span>
            <span className="mt-auto text-[9px] font-bold tracking-[0.15em] opacity-80">{s.live ? "LIVE" : "SOON"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function OneAccount() {
  return (
    <section id="account" aria-labelledby="account-title" className="scroll-mt-20 border-t border-line py-16 lg:py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 lg:grid-cols-2 lg:gap-16">
        <div {...reveal()}>
          <p className="text-xs font-semibold tracking-[0.3em] text-violet uppercase">One account</p>
          <h2 id="account-title" className="mt-3 text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
            Every show, <span className="text-brand-gradient">the same couch.</span>
          </h2>
          <p className="mt-4 text-muted">
            Each show gets its own app with its own look, but you only sign up once. Your people come with you.
          </p>
          <ul className="mt-6 space-y-4">
            {POINTS.map((p) => (
              <li key={p} className="flex gap-3 text-sm leading-relaxed text-muted">
                <svg viewBox="0 0 16 16" className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden="true">
                  <path d="m3 8.5 3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <AccountDiagram />
      </div>
    </section>
  );
}
