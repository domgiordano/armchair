"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { SignedIn } from "@/components/signed-in";
import { joinGroup } from "@/lib/api/groups";
import { saveGroup } from "@/lib/show/group-filter";
import { SECONDARY } from "@/lib/ui";

export function JoinScreen() {
  return (
    <SignedIn title="Join a group">
      <Joiner />
    </SignedIn>
  );
}

/** Joins by the link's code, then opens the scorecard filtered to that group. */
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
        router.replace("/episode/");
      },
      (e: unknown) => !cancelled && setError(e instanceof Error ? e.message : "Request failed"),
    );
    return () => {
      cancelled = true;
    };
  }, [code, router]);

  if (pending !== null) {
    return (
      <div role="status" className="flex flex-col items-start gap-3">
        <p>
          Asked to join <span className="font-semibold">{pending}</span>. You&apos;ll get a notification when the owner
          lets you in.
        </p>
        <Link href="/friends/?tab=groups" className={SECONDARY}>
          Your groups
        </Link>
      </div>
    );
  }
  if (code && error === null) return <p className="text-neutral-400">Joining the group...</p>;
  return (
    <div role="alert" className="flex flex-col items-start gap-3">
      <p>{code ? `Couldn't join: ${error}` : "This invite link is missing its code."}</p>
      <Link href="/" className={SECONDARY}>
        Go home
      </Link>
    </div>
  );
}
