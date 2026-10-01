"use client";

import { ChairLoader } from "@/components/chair-loader";
import { useAuth } from "@/lib/auth/use-auth";
import { dwtsLink } from "@/lib/links";
import { loadMe, useMe } from "@/lib/me";

import { HubShell, SignInWall } from "./hub-shell";
import { NameEditor, ProfilePhoto } from "./profile-editor";
import { ErrorNote, QUIET, Skeleton } from "./ui";

const memberSince = (iso: string) =>
  `Member since ${new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}`;

export function ProfileScreen() {
  const { status } = useAuth();
  return (
    <HubShell>
      <div className="mx-auto max-w-2xl pt-2 sm:pt-4">
        {status === "loading" && (
          <div className="grid place-items-center py-24">
            <ChairLoader className="size-20" label="Loading" />
          </div>
        )}
        {status === "unconfigured" && <p className="text-muted">Sign-in is not configured in this build.</p>}
        {status === "signedOut" && <SignInWall eyebrow="Your profile" pitch="Sign in to edit your name and photo." />}
        {status === "signedIn" && <OwnProfile />}
      </div>
    </HubShell>
  );
}

function OwnProfile() {
  const load = useMe();
  if (load.kind === "loading") {
    return (
      <div role="status" className="flex flex-col gap-5">
        <span className="sr-only">Loading your profile...</span>
        <Skeleton className="size-28 rounded-full" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-40" />
      </div>
    );
  }
  if (load.kind === "error") return <ErrorNote what="your profile" message={load.message} retry={() => void loadMe()} />;
  const { me } = load;
  return (
    <div className="rise flex flex-col gap-6">
      <ProfilePhoto me={me} />
      <div className="flex flex-col gap-1">
        <NameEditor me={me} />
        <p className="text-sm text-muted">{me.email}</p>
        <p className="text-sm text-muted">{memberSince(me.createdAt)}</p>
      </div>
      <p className="border-t border-line pt-6 text-sm leading-relaxed text-muted">
        Your name and photo are the same in every Armchair Judge show. Season stats live in each show&rsquo;s app.
      </p>
      <a href={dwtsLink("/profile/")} className={`${QUIET} -ml-3 self-start`}>
        Your Dancing with the Stars season
      </a>
    </div>
  );
}
