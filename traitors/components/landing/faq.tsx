import { WINNERS } from "./calls";
import styles from "./landing.module.css";

const QUESTIONS = [
  {
    q: "Do I have to make my calls before the episode airs?",
    a: "No. Nothing locks on a clock: call an episode whenever you like. What you can't do is see its results, or anyone else's calls, until yours are in.",
  },
  {
    q: "Can I change a call?",
    a: "No. Once you seal it, it's final. That's what keeps everyone honest when the results are a tap away.",
  },
  {
    q: "Will it spoil an episode I haven't watched?",
    a: "Not unless you ask it to. Results stay hidden until you've made your own call for that episode, so catching up a week late is safe.",
  },
  {
    q: "What if nobody is recruited, or there's no murder?",
    a: "Then that call voids: no points, and no penalty. A recruit call is optional anyway.",
  },
  {
    q: "What about ties, revotes and daggers?",
    a: "Your top three is ranked by the first vote, daggers and all, and tied players share a rank. Your first pick scores against whoever actually leaves, after any revote.",
  },
  {
    q: "How do the winner picks work?",
    a: `You rank your top ${WINNERS}, each as a Faithful or a Traitor, when you first open a season. A right 1st choice scores 20, a 2nd 12 and a 3rd 6, plus 10, 6 or 3 for their side. Sealing your 1st opens your calls; you can fill 2nd and 3rd later. Each place is final once sealed, and the earlier you seal it, the more it's worth.`,
  },
  {
    q: "Which shows?",
    a: "The Traitors in the US, and in the UK, celebrity series included. Switch editions from the menu; each season keeps its own picks and leaderboards.",
  },
  {
    q: "Is it free? Is it official?",
    a: "Free, with a Google sign-in. It's a fan game, not affiliated with the show, the BBC, NBC or Peacock.",
  },
];

/** The questions a friend asks before they sign in. Native disclosure, so it works by keyboard and screen reader as is. */
export function Faq() {
  return (
    <div className="mt-10 flex flex-col border-t border-gilt/25">
      {QUESTIONS.map(({ q, a }) => (
        <details key={q} className={`${styles.faq} group border-b border-gilt/25`}>
          <summary className="focus-ring flex min-h-14 cursor-pointer list-none items-center justify-between gap-6 rounded-sm py-4 font-display text-lg font-semibold text-bone transition-colors hover:text-candle [&::-webkit-details-marker]:hidden">
            {q}
            <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4 shrink-0 text-gilt transition-transform duration-200 group-open:rotate-45 motion-reduce:transition-none">
              <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </summary>
          <p className="max-w-3xl pb-6 leading-relaxed">{a}</p>
        </details>
      ))}
    </div>
  );
}
