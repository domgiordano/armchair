import Link from "next/link";
import type { ReactNode } from "react";

import { Avatar } from "@/components/avatar";
import { NameEditor } from "@/components/name-editor";
import { ProfilePhoto } from "@/components/profile-photo";
import { plural, seasonShort } from "@/components/profile/parts";
import type { MyProfile, Profile } from "@/lib/api/profile";
import { cn, FOCUS } from "@/lib/ui";

const AVATAR = 112;

interface ProfileHeaderProps {
  profile: Profile;
  /** Set on your own profile, which adds the photo and name editors. */
  me: MyProfile | null;
  onMe: (me: MyProfile) => void;
  /** Opens the Social tab. */
  onSocial: () => void;
}

const memberSince = (iso: string | null) =>
  iso
    ? `Member since ${new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}`
    : null;

const CHIP =
  "relative inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm tabular-nums after:absolute after:-inset-1 after:content-['']";
const QUIET = "border-silver/15 bg-ink/40 text-silver";
const ACTIVE = `${QUIET} transition-colors hover:border-gold/40 hover:text-pearl active:bg-silver/10 ${FOCUS}`;

/** Who they are: photo, name, member since, leaderboard place and their people. Same for anyone; yours can be edited. */
export function ProfileHeader({ profile, me, onMe, onSocial }: ProfileHeaderProps) {
  const name = me?.name ?? profile.name ?? "Member";
  const place =
    profile.season.rank !== null && profile.season.season !== "all"
      ? `#${profile.season.rank} of ${profile.season.ranked} · ${seasonShort(profile.season.season)}`
      : profile.allTime.rank !== null
        ? `#${profile.allTime.rank} of ${profile.allTime.ranked} all-time`
        : null;
  const mutual = profile.mutual?.friends.length ?? 0;

  return (
    <header className="relative overflow-hidden rounded-2xl border border-silver/10 bg-gradient-to-br from-ballroom/90 via-ballroom/50 to-ink p-5 shadow-[inset_0_1px_0_rgb(213_219_234/0.06)] sm:p-7">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-28 -left-20 size-80 rounded-full bg-gold/15 blur-3xl"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -bottom-32 size-80 rounded-full bg-brand-violet/15 blur-3xl"
      />
      <div className="relative flex animate-page-in flex-col items-center gap-4 text-center sm:flex-row sm:gap-7 sm:text-left">
        {me ? (
          <ProfilePhoto me={me} onChange={onMe} size={AVATAR} />
        ) : (
          <div className="shrink-0 rounded-full bg-gradient-to-br from-gold-light via-gold-deep to-gold p-[3px] shadow-[0_0_34px_-6px_rgb(232_194_104/0.6)]">
            <Avatar name={name} email="" picture={profile.picture} size={AVATAR} />
          </div>
        )}
        <div className="flex min-w-0 flex-col items-center gap-2 sm:items-start">
          {me ? (
            <NameEditor me={me} onChange={onMe} />
          ) : (
            <h1 className="max-w-full truncate text-2xl font-semibold tracking-tight text-pearl sm:text-3xl">{name}</h1>
          )}
          {profile.memberSince && <p className="text-sm text-silver-dim">{memberSince(profile.memberSince)}</p>}
          <ul aria-label="At a glance" className="mt-1 flex flex-wrap justify-center gap-2 sm:justify-start">
            {place && (
              <Chip>
                <span className={cn(CHIP, "border-gold/45 bg-gold/10 font-semibold text-gold-light")}>
                  <CrownIcon />
                  {place}
                </span>
              </Chip>
            )}
            <Chip>
              {me ? (
                <Link href="/friends/" className={cn(CHIP, ACTIVE)}>
                  {plural(profile.friendCount, "friend")}
                </Link>
              ) : (
                <span className={cn(CHIP, QUIET)}>{plural(profile.friendCount, "friend")}</span>
              )}
            </Chip>
            {me && profile.groupCount !== undefined && (
              <Chip>
                <Link href="/groups/" className={cn(CHIP, ACTIVE)}>
                  {plural(profile.groupCount, "group")}
                </Link>
              </Chip>
            )}
            {mutual > 0 && (
              <Chip>
                <button type="button" onClick={onSocial} className={cn(CHIP, ACTIVE)}>
                  {plural(mutual, "mutual friend")}
                </button>
              </Chip>
            )}
          </ul>
        </div>
      </div>
    </header>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return <li className="flex">{children}</li>;
}

function CrownIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4" fill="currentColor">
      <path d="M3 15.5h14l1-8.5-4.5 3.2L10 4 6.5 10.2 2 7z" />
    </svg>
  );
}
