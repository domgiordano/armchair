import type { Metadata } from "next";

import { ISSUES_URL, LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Privacy policy · Armchair Judge" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy">
      <p>
        Armchair Judge lets you score TV performances and compare your scores with the real judges and other viewers. This
        page covers the hub at armchairjudge.com and the show apps under it, such as dwts.armchairjudge.com.
      </p>

      <h2>Signing in</h2>
      <p>
        You sign in with Google. Sign-in runs through Amazon Cognito, part of Amazon Web Services (AWS). We never see or
        store your Google password.
      </p>

      <h2>What we store</h2>
      <ul>
        <li>From your Google account: your name, email address and the URL of your profile photo.</li>
        <li>The scores you give, and the performances you chose to reveal without scoring.</li>
        <li>The groups you create or join, and their invite codes.</li>
      </ul>
      <p>
        This is kept in AWS (DynamoDB, in the us-east-1 region). Your browser also keeps your sign-in session in local
        storage, and the hub remembers in session storage that you have seen its intro.
      </p>

      <h2>Who sees what</h2>
      <ul>
        <li>Other users can see your name, profile photo and scores.</li>
        <li>
          Someone only sees your score for a performance after they have scored it (or chosen to reveal it) themselves.
        </li>
        <li>Your email address is never shown to other users.</li>
      </ul>

      <h2>What we don&rsquo;t do</h2>
      <ul>
        <li>No ads.</li>
        <li>We don&rsquo;t sell or share your data.</li>
        <li>No third-party analytics or tracking.</li>
      </ul>
      <p>
        AWS processes standard request data, such as IP addresses, to serve the site and protect it from abuse.
      </p>

      <h2>Show data</h2>
      <p>
        Judges&rsquo; scores are sourced from Wikipedia. Headshots come from Wikimedia Commons and are used under their
        respective licenses.
      </p>

      <h2>Deleting your data</h2>
      <p>
        To have your account and scores deleted, open an issue on our{" "}
        <a href={ISSUES_URL}>GitHub issues page</a>. Issues are public, so don&rsquo;t include your email address or other
        personal details there; we will follow up to confirm which account is yours.
      </p>

      <h2>Children</h2>
      <p>Armchair Judge is not directed at children under 13.</p>

      <h2>Changes and contact</h2>
      <p>
        If this policy changes, we will update this page and its date. Questions go to the{" "}
        <a href={ISSUES_URL}>GitHub issues page</a>.
      </p>
      <p>
        Armchair Judge is not affiliated with ABC, Disney, BBC, Peacock, CBS or the shows&rsquo; producers.
      </p>
    </LegalPage>
  );
}
