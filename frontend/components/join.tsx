"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { SignedIn } from "@/components/signed-in";
import { PageLoader } from "@/components/disco-loader";
import { groupHref, joinGroup } from "@armchair/app-core/api/groups";
import { saveGroup } from "@/lib/show/group-filter";
import { EmptyState } from "@/components/ui/states";
import { ApiError } from "@armchair/app-core/api/client";
import { button, SECONDARY } from "@/lib/ui";

const GONE = "gone";

export function JoinScreen() {
  return (
    <SignedIn title="Join a group">
      <Joiner />
    </SignedIn>
  );
}

/** Joins by the link's code, then opens the group's page; the scorecard is filtered to it from then on. */
function Joiner() {
  const router = useRouter();
  const code = useSearchParams().get("code");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    joinGroup(code).then(
      (group) => {
        if (cancelled) return;
        if (group.pending) {
          setPending(group.name);
          return;
        }
        saveGroup(group.id);
        router.replace(groupHref(group.id));
      },
      (e: unknown) =>
        !cancelled &&
        setError(e instanceof ApiError && e.status === 404 ? GONE : e instanceof Error ? e.message : "Request failed"),
    );
    return () => {
      cancelled = true;
    };
  }, [code, router]);

  if (pending !== null) {
    return (
      <EmptyState
        title={`Asked to join ${pending}`}
        action={
          <Link href="/social/?view=groups" className={SECONDARY}>
            Your groups
          </Link>
        }
      >
        The owner approves new members. You&apos;ll get a notification when you&apos;re in.
      </EmptyState>
    );
  }
  if (code && error === null) return <PageLoader label="Joining the group" />;
  return (
    <div role="alert">
      <EmptyState
        title={code ? "This link didn't open a group" : "This invite link is missing its code"}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/social/?view=groups" className={SECONDARY}>
              Paste another link
            </Link>
            <Link href="/" className={button("ghost")}>
              Go home
            </Link>
          </div>
        }
      >
        {!code
          ? "Ask whoever sent it to copy the whole link and send it again."
          : error === GONE
            ? "The group may have been deleted, or the link got cut off. Ask whoever sent it for a fresh one."
            : `Something went wrong: ${error}`}
      </EmptyState>
    </div>
  );
}
