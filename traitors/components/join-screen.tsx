"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { errorText } from "@/components/season-data";
import { Card } from "@/components/ui/card";
import { SkeletonList } from "@/components/ui/skeleton";
import { saveGroup } from "@/lib/group-filter";
import { button, cn, EYEBROW, HEADING } from "@/lib/ui";
import { joinGroup } from "@armchair/app-core/api/groups";

/** `/join/?code=`: an invite link lands here, joins, and opens your groups with this one picked. */
export function JoinScreen() {
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
        router.replace("/groups/");
      },
      (e: unknown) => !cancelled && setError(errorText(e)),
    );
    return () => {
      cancelled = true;
    };
  }, [code, router]);

  if (pending !== null) {
    return (
      <Card as="section" role="status" tone="cloak" className="flex flex-col items-start gap-3">
        <p className={EYEBROW}>Request sent</p>
        <h1 className={cn(HEADING, "text-2xl")}>Asked to join {pending}</h1>
        <p className="text-parchment">The owner lets people in. It shows in your groups once they do.</p>
        <Link href="/groups/" className={button("outline", "sm")}>
          Your groups
        </Link>
      </Card>
    );
  }
  if (code && error === null) return <SkeletonList label="Joining the group" rows={1} row="h-24" />;
  return (
    <Card as="section" role="alert" className="flex flex-col items-start gap-3">
      <h1 className={cn(HEADING, "text-2xl")}>{code ? "Couldn't join" : "This invite link is missing its code"}</h1>
      {error && <p className="text-parchment">{error}</p>}
      <Link href="/groups/" className={button("outline", "sm")}>
        Your groups
      </Link>
    </Card>
  );
}
