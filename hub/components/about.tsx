import Link from "next/link";

// Google's OAuth brand review reads the home page for the app's purpose and
// what it does with Google data, so both are stated here in plain words.
export function About() {
  return (
    <section id="about" aria-labelledby="about-title" className="mx-auto max-w-3xl px-6 py-20">
      <p className="text-xs font-semibold tracking-[0.3em] text-gold">ABOUT ARMCHAIR JUDGE</p>
      <h2 id="about-title" className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
        What this app is, and what it does with your Google account
      </h2>
      <div className="mt-6 space-y-4 leading-relaxed text-muted">
        <p>
          Armchair Judge is a free companion for TV competition shows. While an episode airs, or whenever you watch it,
          you score each performance from 1 to 10. Your score stays private until you submit it; then you see the real
          judges&rsquo; scores, other viewers&rsquo; scores, and how close you were over the season. Dancing with the
          Stars is available now; more shows are coming.
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
          <Link href="/privacy/" className="text-text underline underline-offset-4">
            privacy policy
          </Link>{" "}
          and{" "}
          <Link href="/terms/" className="text-text underline underline-offset-4">
            terms of service
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
