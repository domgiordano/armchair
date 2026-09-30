import type { Metadata } from "next";

import { ISSUES_URL, LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Terms of use · Armchair Judge" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use">
      <p>By using Armchair Judge you agree to these terms. If you don&rsquo;t, please don&rsquo;t use it.</p>

      <h2>The service</h2>
      <p>
        Armchair Judge is free. It is provided as-is, without warranties of any kind, and may change, break or go away
        at any time. We are not liable for any loss arising from its use.
      </p>

      <h2>Your scores</h2>
      <p>Scores are final once submitted. They cannot be edited or withdrawn.</p>

      <h2>Groups</h2>
      <p>
        Be decent. Group names and anything else you add must not be offensive, harassing or unlawful. We may remove
        content or accounts that break these terms, or for any other reason, without notice.
      </p>

      <h2>Voting</h2>
      <p>
        Voting links point to the shows&rsquo; official voting channels. Armchair Judge does not cast votes for you,
        and your scores here have no effect on the show.
      </p>

      <h2>The shows</h2>
      <p>
        Armchair Judge is not affiliated with ABC, Disney, BBC, Peacock, CBS or the shows&rsquo; producers. Show names are
        used to describe what you can rate. Judges&rsquo; scores are sourced from Wikipedia and headshots from Wikimedia
        Commons under their respective licenses.
      </p>

      <h2>Contact</h2>
      <p>
        Questions go to the <a href={ISSUES_URL}>GitHub issues page</a>.
      </p>
    </LegalPage>
  );
}
