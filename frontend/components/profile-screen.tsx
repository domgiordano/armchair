"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { Avatar } from "@/components/avatar";
import { PageLoader } from "@/components/disco-loader";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { NameEditor } from "@/components/name-editor";
import { ProfileAllTime } from "@/components/profile-all-time";
import { ProfilePhoto } from "@/components/profile-photo";
import { ProfileSeason } from "@/components/profile-season";
import { SignedIn } from "@/components/signed-in";
import { ApiError } from "@/lib/api/client";
import { getMyProfile, getProfile, type MyProfile } from "@/lib/api/profile";
import type { Season } from "@/lib/api/show";
import { useAuth } from "@/lib/auth/use-auth";
import { useSeason } from "@/lib/show/use-season";
import { SECONDARY } from "@/lib/ui";

export function ProfileScreen() {
  return (
    <SignedIn title="Profile" wide>
      {/* ?u= is only readable on the client in a static export. */}
      <Suspense fallback={<ProfileSkeleton />}>
        <ProfileRoute />
      </Suspense>
    </SignedIn>
  );
}

function ProfileRoute() {
  const other = useSearchParams().get("u");
  const load = useSeason();
  if (load.kind === "loading") return <PageLoader label="Loading the profile" />;
  if (load.kind === "error") return <ErrorState what="the season" message={load.message} retry={load.retry} />;
  return other ? <OtherProfile key={other} season={load.season} sub={other} /> : <OwnProfile season={load.season} />;
}

type Load<T> =
  { kind: "loading" } | { kind: "ready"; data: T } | { kind: "error"; message: string; status: number | null };

function useLoad<T>(fetcher: () => Promise<T>, deps: unknown[]): [Load<T>, () => void, (data: T) => void] {
  const [load, setLoad] = useState<Load<T>>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetcher().then(
      (data) => !cancelled && setLoad({ kind: "ready", data }),
      (e: unknown) =>
        !cancelled &&
        setLoad({
          kind: "error",
          message: e instanceof Error ? e.message : "Request failed",
          status: e instanceof ApiError ? e.status : null,
        }),
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the caller names what the fetch depends on
  }, [...deps, attempt]);

  const retry = () => {
    setLoad({ kind: "loading" });
    setAttempt((n) => n + 1);
  };
  return [load, retry, (data: T) => setLoad({ kind: "ready", data })];
}

// Phone: one column. Desktop: who they are on the left, their season beside it.
const PAGE = "flex flex-col gap-8 lg:grid lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start lg:gap-x-12 lg:gap-y-8";

const memberSince = (iso: string | null) =>
  iso
    ? `Member since ${new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}`
    : null;

function OwnProfile({ season }: { season: Season }) {
  const [load, retry, setData] = useLoad(
    () => Promise.all([getMyProfile(), getProfile(season.season)]),
    [season.season],
  );
  const { signOut } = useAuth();
  const router = useRouter();

  if (load.kind === "loading") return <ProfileSkeleton />;
  if (load.kind === "error") return <ErrorState what="your profile" message={load.message} retry={retry} />;
  const [me, profile] = load.data;
  const onChange = (next: MyProfile) => setData([next, profile]);

  return (
    <div className={`${PAGE} lg:grid-rows-[auto_auto_1fr]`}>
      <header className="flex flex-col gap-3 lg:col-start-1">
        <ProfilePhoto me={me} onChange={onChange} />
        <div className="flex flex-col gap-0.5">
          <NameEditor me={me} onChange={onChange} />
          <p className="text-sm text-silver-dim">{memberSince(me.createdAt)}</p>
        </div>
      </header>

      <nav aria-label="Your people" className="grid grid-cols-2 gap-3 lg:col-start-1">
        <CountLink href="/friends/" label="Friends" count={profile.friendCount} />
        <CountLink href="/groups/" label="Groups" count={profile.groupCount} />
      </nav>

      <div className="flex flex-col gap-10 lg:col-start-2 lg:row-span-3 lg:row-start-1">
        <ProfileSeason season={season} profile={profile} own />
        <ProfileAllTime season={season} profile={profile} />
      </div>

      <button
        type="button"
        onClick={() => void signOut().then(() => router.push("/"))}
        className={`${SECONDARY} self-start lg:col-start-1`}
      >
        Sign out
      </button>
    </div>
  );
}

function OtherProfile({ season, sub }: { season: Season; sub: string }) {
  const [load, retry] = useLoad(() => getProfile(season.season, sub), [season.season, sub]);

  if (load.kind === "loading") return <ProfileSkeleton />;
  if (load.kind === "error") {
    if (load.status === 404) {
      return (
        <>
          <h1 className="sr-only">No one here</h1>
          <EmptyState
            title="No one here"
            action={
              <Link href="/profile/" className={SECONDARY}>
                Your profile
              </Link>
            }
          >
            That profile link doesn&apos;t match anyone who has signed in.
          </EmptyState>
        </>
      );
    }
    return <ErrorState what="this profile" message={load.message} retry={retry} />;
  }
  const profile = load.data;

  return (
    <div className={PAGE}>
      <header className="flex items-center gap-4 lg:flex-col lg:items-start">
        <div className="rounded-full bg-gradient-to-br from-gold-light via-gold-deep to-gold p-[3px]">
          <Avatar name={profile.name ?? "Member"} email="" picture={profile.picture} size={88} />
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="truncate text-2xl font-semibold tracking-tight text-pearl">{profile.name ?? "Member"}</h1>
          <p className="text-sm text-silver-dim">{memberSince(profile.memberSince)}</p>
          {profile.friendCount !== undefined && (
            <p className="text-sm text-silver tabular-nums">
              {profile.friendCount} {profile.friendCount === 1 ? "friend" : "friends"}
            </p>
          )}
        </div>
      </header>
      <div className="flex flex-col gap-10">
        <ProfileSeason season={season} profile={profile} own={false} />
        <ProfileAllTime season={season} profile={profile} />
      </div>
    </div>
  );
}

function CountLink({ href, label, count }: { href: string; label: string; count?: number }) {
  return (
    <Link
      href={href}
      className="group flex min-h-16 items-center justify-between gap-2 rounded-xl border border-silver/10 bg-ballroom/45 px-4 py-3 transition-colors hover:border-gold/35 hover:bg-ballroom/70 focus-ring active:bg-ballroom"
    >
      <span className="flex flex-col">
        {count !== undefined && <span className="text-xl font-semibold text-pearl tabular-nums">{count}</span>}
        <span className="text-sm text-silver-dim group-hover:text-pearl">{label}</span>
      </span>
      <svg
        viewBox="0 0 20 20"
        aria-hidden="true"
        className="size-4 text-silver-dim transition-transform group-hover:translate-x-0.5 group-hover:text-gold-light"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
      >
        <path d="m8 5 5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}

function ProfileSkeleton() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">Loading the profile...</span>
      <Skeleton className="size-28 rounded-full" />
      <Skeleton className="h-7 w-48" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
      </div>
      <Skeleton className="h-40 rounded-xl" />
    </div>
  );
}
