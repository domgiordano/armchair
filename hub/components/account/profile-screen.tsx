"use client";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ChairLoader } from "@/components/chair-loader";
import { GoogleMark } from "@/components/google-mark";
import { signInWithGoogle, useAuth } from "@/lib/auth/use-auth";
import { dwtsLink } from "@/lib/links";
import { loadMe, useMe } from "@/lib/me";

import { NameEditor, ProfilePhoto } from "./profile-editor";
import { ErrorNote, PRIMARY, QUIET, Skeleton } from "./ui";

const memberSince = (iso: string) =>
  `Member since ${new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}`;

export function ProfileScreen() {
  const { status } = useAuth();
  return (
    <div id="page">
      <SiteHeader sections={false} />
      <main id="main" tabIndex={-1} className="mx-auto max-w-2xl px-4 pt-10 pb-24 outline-none sm:px-6 sm:pt-14">
        {status === "loading" && (
          <div className="grid place-items-center py-24">
            <ChairLoader className="size-20" label="Loading" />
          </div>
        )}
        {status === "unconfigured" && <p className="text-muted">Sign-in is not configured in this build.</p>}
        {status === "signedOut" && <SignInWall />}
        {status === "signedIn" && <OwnProfile />}
      </main>
      <SiteFooter />
    </div>
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

function SignInWall() {
  return (
    <div className="rise flex flex-col items-start gap-5">
      <p className="text-xs font-semibold tracking-[0.3em] text-gold uppercase">Your profile</p>
      <h1 className="text-4xl font-extrabold tracking-tight">
        Take your <span className="text-brand-gradient">seat.</span>
      </h1>
      <p className="text-muted">Sign in to edit your name and photo.</p>
      <button type="button" onClick={() => void signInWithGoogle()} className={PRIMARY}>
        <GoogleMark className="h-4 w-4" />
        Sign in with Google
      </button>
    </div>
  );
}
