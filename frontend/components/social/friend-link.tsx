"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { PageLoader } from "@/components/disco-loader";
import { Redirect } from "@/components/redirect";
import { SignedIn } from "@/components/signed-in";
import { displayName, message } from "@/components/social/parts";
import { useToast } from "@/components/ui/toast";
import { groupHref } from "@armchair/app-core/api/groups";
import { profileHref } from "@/lib/api/people";
import { addFriend } from "@armchair/app-core/api/social";
import { SECONDARY } from "@/lib/ui";

/** /friends/: an invite link sends its request and opens their profile; older bookmarks land on your lists. */
export function FriendsRoute() {
  const params = useSearchParams();
  const code = params.get("add");
  if (code) {
    return (
      <SignedIn title="Add a friend">
        <AddByLink code={code} />
      </SignedIn>
    );
  }
  return <Redirect to={legacyTarget(params)} />;
}

/** Where the old Friends & Groups tabs live now. */
export function legacyTarget(params: URLSearchParams): string {
  const tab = params.get("tab");
  const group = params.get("group");
  if (tab === "groups" && group) return groupHref(group);
  if (tab === "groups" || tab === "requests") return `/profile/?sheet=${tab}`;
  return "/profile/?sheet=friends";
}

function AddByLink({ code }: { code: string }) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    addFriend({ code }).then(
      ({ status, user }) => {
        if (cancelled) return;
        const name = displayName(user);
        toast(status === "friend" ? `You and ${name} are friends` : `Friend request sent to ${name}`);
        router.replace(profileHref(user.sub));
      },
      (e: unknown) => !cancelled && setError(message(e)),
    );
    return () => {
      cancelled = true;
    };
  }, [code, router, toast]);

  if (error === null) return <PageLoader label="Sending a friend request" />;
  return (
    <div role="alert" className="flex flex-col items-start gap-4 rounded-xl border border-red-300/25 bg-red-400/5 p-5 animate-pop-in">
      <p className="text-pearl">Couldn&apos;t use that invite link: {error}</p>
      <Link href="/discover/" className={SECONDARY}>
        Find people instead
      </Link>
    </div>
  );
}
