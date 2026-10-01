import Link from "next/link";

const link =
  "rounded-sm text-text underline decoration-muted/60 underline-offset-4 transition-colors hover:text-gold hover:decoration-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold motion-reduce:transition-none";

// Google's OAuth brand review reads the home page for the app's purpose and
// what it does with Google data, so both are stated here in plain words.
export function About() {
  return (
    <section id="about" aria-labelledby="about-title" className="scroll-mt-20 border-t border-line py-16 lg:py-24">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
        <div>
          <p className="text-xs font-semibold tracking-[0.3em] text-gold">ABOUT ARMCHAIR JUDGE</p>
          <h2 id="about-title" className="mt-3 text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
            What this app is, and what it does with your Google account
          </h2>
        </div>
        <div className="space-y-4 leading-relaxed text-muted">
          <p>
            Armchair Judge is a free companion for TV competition shows. While an episode airs, or whenever you watch
            it, you score each performance from 1 to 10. Your score stays private until you submit it; then you see the
            real judges&rsquo; scores, other viewers&rsquo; scores, and how close you were over the season. Dancing with
            the Stars is available now; more shows are coming.
          </p>
          <p>
            We use Google Sign-In only to create your account. We receive your name, email address and profile photo
            from Google, and nothing else: no contacts, Gmail, Drive, Calendar or other Google data. Your name and photo
            appear next to your scores; your email is never shown to other people. We never sell or share your data.
          </p>
          <p>
            Armchair Judge does not generate, edit or host images of people, and it uses no AI image or video generation
            of any kind. The only photos in the app are public, openly licensed headshots of the shows&rsquo; cast and
            judges, credited to their photographers, plus the profile photo from your own Google account.
          </p>
          <p>
            Details are in our{" "}
            <Link href="/privacy/" className={link}>
              privacy policy
            </Link>{" "}
            and{" "}
            <Link href="/terms/" className={link}>
              terms of service
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
