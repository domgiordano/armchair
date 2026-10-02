import type { ReactNode } from "react";

import { reveal } from "@/lib/reveal";

interface Question {
  q: string;
  a: ReactNode;
}

const QUESTIONS: Question[] = [
  {
    q: "Is it free?",
    a: "Yes. Armchair Judge is free to use, and every show app runs on the same free account.",
  },
  {
    q: "Which shows can I judge?",
    a: "Dancing with the Stars and The Traitors (US and UK), live now for the current seasons. Survivor is on the way. Each show is its own app under the same account.",
  },
  {
    q: "Do I need to watch live?",
    a: "No. Play along on replay whenever you get to it. Nothing about a dance or an episode is shown until you make your call or choose to reveal it, so you stay unspoiled.",
  },
  {
    q: "Does my score count as a vote on the show?",
    a: (
      <>
        No. Paddles here are for bragging rights and never reach the show. To vote on Dancing with the Stars, text{" "}
        <span className="font-semibold text-text tabular-nums">21523</span> during the live East Coast broadcast; the
        app shows you how while voting is open.
      </>
    ),
  },
  {
    q: "Who can see my calls?",
    a: "Someone sees your score for a dance, or your picks for an episode, only after they've made their own. Your name and photo appear beside your calls; your email never does.",
  },
  {
    q: "What do you get from my Google account?",
    a: "Your name, email address and profile photo, used only to create your account. Nothing else: no contacts, Gmail, Drive or Calendar. We never sell or share your data.",
  },
  {
    q: "Is this made by the shows?",
    a: "No. Armchair Judge is an independent fan project, not affiliated with the networks or producers. The judges' scores and the results it compares you with are what the shows air.",
  },
];

export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-20 border-t border-line py-16 lg:py-24">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
        <div {...reveal()}>
          <p className="text-xs font-semibold tracking-[0.3em] text-orange uppercase">FAQ</p>
          <h2 id="faq-title" className="mt-3 text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
            Before you <span className="text-brand-gradient">make your first call.</span>
          </h2>
        </div>
        <div className="divide-y divide-line border-y border-line" {...reveal(1)}>
          {QUESTIONS.map(({ q, a }) => (
            <details key={q} className="faq-item group">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 font-semibold transition-colors group-open:text-gold hover:text-gold motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold [&::-webkit-details-marker]:hidden">
                {q}
                <svg
                  viewBox="0 0 16 16"
                  className="size-4 shrink-0 text-muted transition-transform duration-300 group-open:rotate-45 group-open:text-gold motion-reduce:transition-none"
                  aria-hidden="true"
                >
                  <path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </summary>
              <p className="faq-answer pb-5 text-sm leading-relaxed text-muted">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
