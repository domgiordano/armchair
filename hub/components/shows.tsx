import { Cinzel, Permanent_Marker, Playfair_Display } from "next/font/google";
import type { ReactNode } from "react";

import { ICON_TRIGGER, ShowIcon, type Show } from "@/components/show-icon";
import { Tilt } from "@/components/tilt";
import { DWTS_URL } from "@/lib/links";
import { reveal } from "@/lib/reveal";

// Each show's card borrows the mood of the show, never its logo or artwork.
// Below the fold, so none of these preload.
const ballroom = Playfair_Display({ subsets: ["latin"], weight: "700", style: "italic", display: "swap", preload: false });
const castle = Cinzel({ subsets: ["latin"], weight: "700", display: "swap", preload: false });
const brush = Permanent_Marker({ subsets: ["latin"], weight: "400", display: "swap", preload: false });

const SPARKLES = [
  { x: 30, y: 40, s: 1, d: 0 },
  { x: 250, y: 150, s: 0.7, d: 600 },
  { x: 70, y: 150, s: 0.6, d: 1200 },
  { x: 210, y: 30, s: 0.8, d: 1800 },
  { x: 290, y: 95, s: 0.5, d: 900 },
];

function BallroomArt() {
  return (
    <svg viewBox="0 0 320 200" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMin slice" aria-hidden="true">
      <defs>
        <radialGradient id="ball-fill" cx="0.35" cy="0.3">
          <stop offset="0" stopColor="#f4f6ff" />
          <stop offset="0.55" stopColor="#9aa4c4" />
          <stop offset="1" stopColor="#3b4466" />
        </radialGradient>
        <clipPath id="ball-clip">
          <circle cx="160" cy="70" r="38" />
        </clipPath>
        <linearGradient id="ball-ray" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f3d98b" stopOpacity="0.35" />
          <stop offset="1" stopColor="#f3d98b" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M160 70 L60 210 L110 210 Z M160 70 L250 210 L290 210 Z" fill="url(#ball-ray)" />
      <path d="M160 0v32" stroke="#9aa4c4" strokeWidth="1.5" />
      <circle cx="160" cy="70" r="38" fill="url(#ball-fill)" />
      <g clipPath="url(#ball-clip)" stroke="#1d2547" strokeOpacity="0.55" strokeWidth="1">
        {[-30, -20, -10, 0, 10, 20, 30].map((dy) => (
          <path key={`h${dy}`} d={`M110 ${70 + dy}h100`} />
        ))}
        {[-30, -20, -10, 0, 10, 20, 30].map((dx) => (
          <ellipse key={`v${dx}`} cx="160" cy="70" rx={Math.abs(dx) + 0.5} ry="38" fill="none" />
        ))}
      </g>
      {SPARKLES.map((p) => (
        <path
          key={`${p.x}-${p.y}`}
          className="sparkle"
          style={{ animationDelay: `${p.d}ms` }}
          transform={`translate(${p.x} ${p.y}) scale(${p.s})`}
          d="M0 -10 C1 -2 2 -1 10 0 C2 1 1 2 0 10 C-1 2 -2 1 -10 0 C-2 -1 -1 -2 0 -10 Z"
          fill="#f3d98b"
        />
      ))}
    </svg>
  );
}

function Flame({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="0" cy="-6" rx="14" ry="18" fill="#ffb547" opacity="0.18" />
      <path className="flame" d="M0 -22 C6 -12 8 -6 6 0 C4 5 -4 5 -6 0 C-8 -6 -4 -12 0 -22 Z" fill="#ffb547" />
      <path d="M0 -12 C3 -7 3 -3 2 0 C1 2 -1 2 -2 0 C-3 -3 -2 -7 0 -12 Z" fill="#fff1c9" />
    </g>
  );
}

function CastleArt() {
  return (
    <svg viewBox="0 0 320 200" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <path
        d="M0 200 V120 h20 v-10 h10 v10 h10 v-10 h10 v10 h20 V70 h12 v-10 h8 v10 h8 v-10 h8 v10 h12 v50 h60 V60 h12 v-10 h8 v10 h8 v-10 h8 v10 h12 v60 h20 v-10 h10 v10 h10 v-10 h10 v10 h32 V200 Z"
        fill="#030b07"
      />
      {[
        [96, 92],
        [216, 84],
        [36, 140],
        [276, 140],
      ].map(([x, y]) => (
        <path key={x} d={`M${x - 5} ${y + 16} v-10 a5 5 0 0 1 10 0 v10 Z`} fill="#ffb547" opacity="0.7" />
      ))}
      {[120, 160, 200].map((x, i) => (
        <g key={x}>
          <rect x={x - 5} y={150 - i * 6} width="10" height={50 + i * 6} rx="2" fill="#e9dcc0" />
          <Flame x={x} y={148 - i * 6} scale={0.7} />
        </g>
      ))}
    </svg>
  );
}

function IslandArt() {
  return (
    <svg viewBox="0 0 320 200" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <radialGradient id="island-sun" cy="1">
          <stop offset="0" stopColor="#ff9a3d" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ff9a3d" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="160" cy="200" rx="180" ry="120" fill="url(#island-sun)" />
      {[14, 34, 286, 304].map((x, i) => (
        <g key={x}>
          <rect x={x - 5} y={20 + i * 8} width="10" height="200" fill="#6b5a1e" />
          {[60, 100, 140, 180].map((y) => (
            <rect key={y} x={x - 6} y={y + i * 8} width="12" height="3" fill="#3f340f" />
          ))}
        </g>
      ))}
      {[90, 230].map((x) => (
        <g key={x}>
          <path d={`M${x - 4} 200 L${x - 2} 120 L${x + 2} 120 L${x + 4} 200 Z`} fill="#3a1d0b" />
          <path d={`M${x - 9} 112 h18 l-3 10 h-12 Z`} fill="#5a2c0e" />
          <Flame x={x} y={112} scale={1.1} />
        </g>
      ))}
    </svg>
  );
}

// Twice over, so sliding the text by half its width loops without a seam.
const TAPE = "COMING SOON \u00b7 ".repeat(8);

function CautionTape() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden="true">
      <div className="caution-tape top-[17%] -rotate-12">
        <span className="tape-text">{TAPE}</span>
      </div>
      <div className="caution-tape top-[29%] rotate-6">
        <span className="tape-text">{TAPE}</span>
      </div>
    </div>
  );
}

interface ShowCardProps {
  show: Show;
  name: string;
  line: string;
  titleClass: string;
  surface: string;
  art: ReactNode;
  href?: string;
}

function ShowCard({ show, name, line, titleClass, surface, art, href }: ShowCardProps) {
  const body = (
    <>
      <div className="tilt-art relative h-44 overflow-hidden">{art}</div>
      <div className="relative flex flex-1 flex-col p-6">
        <ShowIcon show={show} size={56} className="mb-4" />
        <p className="text-[11px] font-semibold tracking-[0.25em] uppercase opacity-80">
          {href ? (
            <span className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-current motion-safe:animate-pulse" aria-hidden="true" />
              Live now
            </span>
          ) : (
            "Coming soon"
          )}
        </p>
        <h3 className={`mt-2 text-3xl leading-tight ${titleClass}`}>{name}</h3>
        <p className="mt-2 text-sm leading-relaxed opacity-80">{line}</p>
        {href && (
          <span className="mt-auto flex items-center gap-2 pt-6 text-sm font-semibold">
            Start judging
            <svg viewBox="0 0 16 16" className="size-4 transition-transform group-hover:translate-x-1 motion-reduce:transition-none" aria-hidden="true">
              <path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}
      </div>
    </>
  );

  const frame = `${ICON_TRIGGER} relative flex min-h-96 flex-1 flex-col overflow-hidden rounded-3xl border ${surface}`;

  if (href) {
    return (
      <a
        href={href}
        aria-label={`${name}, start judging`}
        className={`group ${frame} transition hover:-translate-y-1 hover:shadow-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold active:translate-y-0 motion-reduce:transition-none`}
      >
        {body}
        <span className="tilt-glare" aria-hidden="true" />
      </a>
    );
  }

  return (
    <div className={`${frame} cursor-not-allowed select-none`}>
      <div className="flex flex-1 flex-col opacity-45 saturate-50">{body}</div>
      <CautionTape />
      <span className="tilt-glare" aria-hidden="true" />
    </div>
  );
}

export function Shows() {
  return (
    <section id="shows" aria-labelledby="shows-title" className="scroll-mt-20 border-t border-line py-16 lg:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div {...reveal()}>
          <p className="text-xs font-semibold tracking-[0.3em] text-magenta uppercase">Shows</p>
          <h2 id="shows-title" className="mt-3 text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
            Pick your panel.
          </h2>
          <p className="mt-3 max-w-xl text-muted">Dancing with the Stars is live now. Two more are in rehearsal.</p>
        </div>
        <ul className="mt-12 grid gap-6 lg:grid-cols-3">
          <li className="flex flex-col" {...reveal(1)}>
            <Tilt className="flex flex-1 flex-col">
              <ShowCard
                show="dwts"
                name="Dancing with the Stars"
                line="Every dance, every week. Get your score up before the panel does."
                titleClass={`${ballroom.className} bg-linear-to-r from-[#f3d98b] to-[#fff4d6] bg-clip-text text-transparent`}
                surface="border-[#2b3a7a] bg-linear-to-b from-[#0a1440] to-[#060b26] text-[#f3e6c0] hover:border-[#f3d98b]/70 hover:shadow-[#f3d98b]/10"
                art={<BallroomArt />}
                href={DWTS_URL}
              />
            </Tilt>
          </li>
          <li className="flex flex-col" {...reveal(2)}>
            <Tilt className="flex flex-1 flex-col">
              <ShowCard
                show="traitors"
                name="The Traitors"
                line="Candlelit schemes and round-table banishments, scored from the sofa."
                titleClass={`${castle.className} text-[#e9dcc0] tracking-wide`}
                surface="border-[#1c3a2a] bg-linear-to-b from-[#0b2418] to-[#040d08] text-[#e9dcc0]"
                art={<CastleArt />}
              />
            </Tilt>
          </li>
          <li className="flex flex-col" {...reveal(3)}>
            <Tilt className="flex flex-1 flex-col">
              <ShowCard
                show="survivor"
                name="Survivor"
                line="Torches, tribal council and blindsides. Your score before the vote."
                titleClass={`${brush.className} text-[#ffb070]`}
                surface="border-[#5a2a10] bg-linear-to-b from-[#3a1606] to-[#140803] text-[#ffe2c4]"
                art={<IslandArt />}
              />
            </Tilt>
          </li>
        </ul>
      </div>
    </section>
  );
}
