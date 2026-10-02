import type { CSSProperties } from "react";

// Fixed positions, not random: the server and client render the same embers.
const EMBERS = [
  { left: "8%", delay: "0s", duration: "9s", drift: "18px" },
  { left: "21%", delay: "3.1s", duration: "11s", drift: "-12px" },
  { left: "37%", delay: "6.4s", duration: "10s", drift: "22px" },
  { left: "55%", delay: "1.7s", duration: "12s", drift: "-20px" },
  { left: "71%", delay: "4.8s", duration: "9.5s", drift: "14px" },
  { left: "86%", delay: "7.9s", duration: "10.5s", drift: "-16px" },
  { left: "94%", delay: "2.6s", duration: "11.5s", drift: "-8px" },
];

/**
 * The castle at night behind every page: two candle pools that flicker and a few
 * rising embers. Opacity and transform only, so it stays on the compositor;
 * reduced motion keeps the glow still and drops the embers.
 */
export function EmberGlow() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_0%,var(--cloak),var(--night)_70%)]" />
      <div className="absolute -top-40 -left-32 size-[28rem] animate-flicker rounded-full bg-[radial-gradient(circle,rgb(233_185_73/0.22),rgb(242_102_42/0.08)_45%,transparent_70%)]" />
      <div className="absolute -top-48 -right-40 size-[30rem] animate-flicker rounded-full bg-[radial-gradient(circle,rgb(233_185_73/0.18),rgb(242_102_42/0.06)_45%,transparent_70%)] [animation-delay:-1.9s]" />
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-[radial-gradient(ellipse_70%_100%_at_50%_100%,rgb(242_102_42/0.08),transparent_70%)]" />
      {EMBERS.map((e) => (
        <span
          key={e.left}
          className="absolute -bottom-2 size-1 animate-ember rounded-full bg-flame shadow-[0_0_6px_2px_rgb(242_102_42/0.7)] motion-reduce:hidden"
          style={{ left: e.left, animationDelay: e.delay, animationDuration: e.duration, "--drift": e.drift } as CSSProperties}
        />
      ))}
    </div>
  );
}
