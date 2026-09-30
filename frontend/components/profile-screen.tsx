"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { Avatar } from "@/components/avatar";
import { ErrorState } from "@/components/ui/states";
import { NameEditor } from "@/components/name-editor";
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
    <SignedIn title="Profile">
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
  if (load.kind === "loading") return <ProfileSkeleton />;
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
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <ProfilePhoto me={me} onChange={onChange} />
        <div className="flex flex-col gap-0.5">
          <NameEditor me={me} onChange={onChange} />
          <p className="text-sm text-neutral-400">{memberSince(me.createdAt)}</p>
        </div>
      </header>

      <nav aria-label="Your people" className="grid grid-cols-2 gap-3">
        <CountLink href="/friends/" label="Friends" count={profile.friendCount} />
        <CountLink href="/groups/" label="Groups" count={profile.groupCount} />
      </nav>

      <ProfileSeason season={season} profile={profile} own />

      <button
        type="button"
        onClick={() => void signOut().then(() => router.push("/"))}
        className={`${SECONDARY} self-start`}
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
        <div className="flex flex-col items-start gap-3">
          <h1 className="text-xl font-semibold">No one here</h1>
          <p className="text-neutral-400">That profile link doesn&apos;t match anyone who has signed in.</p>
          <Link href="/profile/" className={SECONDARY}>
            Your profile
          </Link>
        </div>
      );
    }
    return <ErrorState what="this profile" message={load.message} retry={retry} />;
  }
  const profile = load.data;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center gap-4">
        <div className="rounded-full p-1 ring-1 ring-gold/50">
          <Avatar name={profile.name ?? "Member"} email="" picture={profile.picture} size={88} />
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{profile.name ?? "Member"}</h1>
          <p className="text-sm text-neutral-400">{memberSince(profile.memberSince)}</p>
          {profile.friendCount !== undefined && (
            <p className="text-sm text-neutral-300 tabular-nums">
              {profile.friendCount} {profile.friendCount === 1 ? "friend" : "friends"}
            </p>
          )}
        </div>
      </header>
      <ProfileSeason season={season} profile={profile} own={false} />
    </div>
  );
}

function CountLink({ href, label, count }: { href: string; label: string; count?: number }) {
  return (
    <Link
      href={href}
      className="group flex min-h-16 items-center justify-between gap-2 rounded-xl border border-neutral-800 px-4 py-3 hover:border-neutral-600 hover:bg-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 active:bg-neutral-800"
    >
      <span className="flex flex-col">
        {count !== undefined && <span className="text-xl font-semibold tabular-nums">{count}</span>}
        <span className="text-sm text-neutral-400 group-hover:text-neutral-200">{label}</span>
      </span>
      <svg
        viewBox="0 0 20 20"
        aria-hidden="true"
        className="size-4 text-neutral-500"
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
    <div aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">Loading the profile...</span>
      <div className="size-28 rounded-full bg-neutral-800 motion-safe:animate-pulse" />
      <div className="h-7 w-48 rounded-md bg-neutral-800 motion-safe:animate-pulse" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-16 rounded-xl bg-neutral-900 motion-safe:animate-pulse" />
        <div className="h-16 rounded-xl bg-neutral-900 motion-safe:animate-pulse" />
      </div>
      <div className="h-40 rounded-xl bg-neutral-900 motion-safe:animate-pulse" />
    </div>
  );
}
