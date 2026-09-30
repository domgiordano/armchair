import type { Metadata } from "next";

import { ISSUES_URL, LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy policy · Armchair Judge",
  description: "What Armchair Judge collects, including Google user data, how it is used and shared, and how to delete it.",
};

const USER_DATA_POLICY_URL = "https://developers.google.com/terms/api-services-user-data-policy";
const GOOGLE_PERMISSIONS_URL = "https://myaccount.google.com/permissions";

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy">
      <p>
        This policy explains what Armchair Judge collects when you use it, how that information is used and shared, and
        how you can have it deleted.
      </p>

      <h2>Who we are</h2>
      <p>
        Armchair Judge is a free, non-commercial app that lets you score TV performances and compare your scores with the
        real judges and other viewers. It is run by an independent developer. This policy covers the hub at
        armchairjudge.com and its show sites, such as dwts.armchairjudge.com (&ldquo;Armchair Judge&rdquo;,
        &ldquo;we&rdquo;, &ldquo;us&rdquo;).
      </p>

      <h2>Information we collect</h2>
      <p>
        <strong>Google user data.</strong> You sign in with your Google account. Sign-in runs through Amazon Cognito, part
        of Amazon Web Services (AWS), and requests only the <code>openid</code>, <code>email</code> and{" "}
        <code>profile</code> scopes. From Google we receive and store:
      </p>
      <ul>
        <li>your name;</li>
        <li>your email address;</li>
        <li>the URL of your Google profile picture;</li>
        <li>your Google account identifier, which Cognito links to an Armchair Judge account identifier.</li>
      </ul>
      <p>
        We receive nothing else from Google. We do not request or access your contacts, Google Drive, Gmail, Calendar or
        any other Google data, and we never see your Google password.
      </p>
      <p>
        <strong>Data you create in the app.</strong>
      </p>
      <ul>
        <li>The scores you give each performance, and the performances you chose to reveal without scoring (forfeits), each with the time it was submitted.</li>
        <li>The groups you create or join, with the time you joined, and each group&rsquo;s name and invite code.</li>
        <li>When your account was created and when you last signed in.</li>
      </ul>
      <p>
        <strong>Data kept only in your browser.</strong> Some things never leave your device. The show sites keep your
        per-device vote tally and your chosen group filter in your browser&rsquo;s local storage, and the page to return
        to after sign-in in session storage. The hub remembers in session storage that you have seen its intro.
      </p>
      <p>
        <strong>Technical data.</strong> Our servers write operational logs to AWS CloudWatch: which function ran, request
        metadata, and any errors. These logs are kept for 30 days. AWS also processes standard request data, such as IP
        addresses, to deliver the site and protect it from abuse.
      </p>
      <p>
        We use no analytics, no advertising and no tracking cookies. The only sign-in data in your browser is the session
        tokens that the Cognito sign-in library (AWS Amplify) keeps in browser storage to keep you signed in.
      </p>

      <h2>How we use it</h2>
      <ul>
        <li>To sign you in and keep your scores tied to your account.</li>
        <li>
          To show your name and profile picture next to your score for a performance, to other users who have already
          scored or revealed that performance themselves. Until then, nobody else sees your score.
        </li>
        <li>To show your name and profile picture to the other members of groups you create or join.</li>
        <li>To work out accuracy stats: how close your scores are to the judges&rsquo;, and how you compare with others.</li>
        <li>
          Your email address is used only to identify your account. It is never shown to other users, and we send no
          marketing email.
        </li>
      </ul>
      <p>We do not use your data, including Google user data, for advertising, profiling or training AI models.</p>

      <h2>How we share it</h2>
      <p>
        We do not sell your data, and we do not share it with third parties. Two service providers process it on our
        behalf:
      </p>
      <ul>
        <li>Amazon Web Services, which hosts the app and its data in the us-east-1 (N. Virginia) region.</li>
        <li>Google, which handles signing in with your Google account.</li>
      </ul>
      <p>We would disclose data only if required by law.</p>

      <h2>Google API Services User Data Policy</h2>
      <p>
        Armchair Judge&rsquo;s use and transfer of information received from Google APIs adheres to the{" "}
        <a href={USER_DATA_POLICY_URL}>Google API Services User Data Policy</a>, including the Limited Use requirements.
      </p>

      <h2>Storage and security</h2>
      <ul>
        <li>Your data is stored in AWS (Amazon DynamoDB) in the us-east-1 region.</li>
        <li>It is encrypted at rest with an AWS KMS key, and encrypted in transit with TLS (HTTPS).</li>
        <li>Access is least-privilege: each server function can reach only the tables it needs.</li>
      </ul>

      <h2>Retention</h2>
      <ul>
        <li>Your profile, scores and group memberships are kept for as long as your account exists.</li>
        <li>Server logs are deleted after 30 days.</li>
        <li>
          When you ask us to delete your account, we delete its data within 30 days. Encrypted database backups roll off
          within a further 35 days.
        </li>
      </ul>

      <h2>Your choices and deletion</h2>
      <ul>
        <li>
          To have your account and data deleted, or to get a copy of it, open an issue on our{" "}
          <a href={ISSUES_URL}>GitHub issues page</a>. Issues are public, so don&rsquo;t include your email address or
          other personal details; we will follow up to confirm which account is yours.
        </li>
        <li>
          You can revoke Armchair Judge&rsquo;s access to your Google account at any time at{" "}
          <a href={GOOGLE_PERMISSIONS_URL}>myaccount.google.com/permissions</a>.
        </li>
        <li>You can clear the data kept in your browser by clearing this site&rsquo;s storage.</li>
      </ul>

      <h2>Children</h2>
      <p>Armchair Judge is not directed to children under 13, and we do not knowingly collect their data.</p>

      <h2>Show data</h2>
      <p>
        Judges&rsquo; scores are sourced from Wikipedia. Headshots come from Wikimedia Commons and are used under their
        respective licenses. Armchair Judge is not affiliated with ABC, Disney, BBC, Peacock, CBS or the shows&rsquo;
        producers.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        If this policy changes, we will update this page and the date at the top. If a change affects how we use Google
        user data, we will ask for your consent before applying it to data we already hold.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this policy or your data go to the <a href={ISSUES_URL}>GitHub issues page</a>.
      </p>
    </LegalPage>
  );
}
