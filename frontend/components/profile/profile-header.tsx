import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";

import { Avatar } from "@/components/avatar";
import { NameEditor } from "@/components/name-editor";
import { ProfilePhoto } from "@/components/profile-photo";
import { plural, seasonShort } from "@/components/profile/parts";
import { FriendButton } from "@/components/social/friend-button";
import { AvatarStack, displayName } from "@/components/social/parts";
import type { SocialView } from "@/components/social/social-sheet";
import { CountUp } from "@/components/ui/count-up";
import type { MyProfile, Profile } from "@/lib/api/profile";
import type { Person, Relation } from "@/lib/api/social";
import { cn, FOCUS } from "@/lib/ui";

const AVATAR = 112;

/** What the header can do about your people: open the lists, and on someone else's, the friend action. */
export type HeaderSocial =
  | { own: true; friends: number; groups: number; waiting: number; open: (view: SocialView) => void }
  | {
      own: false;
      friends: number;
      groups: number;
      /** Undefined until your own friends list says where you stand. */
      relation: Relation | undefined;
      onRelation: (next: Relation) => void;
      open: (view: SocialView) => void;
    };

interface ProfileHeaderProps {
  profile: Profile;
  /** Set on your own profile, which adds the photo and name editors. */
  me: MyProfile | null;
  onMe: (me: MyProfile) => void;
  social: HeaderSocial;
}

const memberSince = (iso: string | null) =>
  iso
    ? `Member since ${new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}`
    : null;

// Safari doesn't focus a clicked button, and the sheet hands focus back to whatever had it on close.
const opener = (open: () => void) => (e: MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.focus();
  open();
};

/** Who they are, their place and their people as counts you can open. Same for anyone; yours can be edited. */
export function ProfileHeader({ profile, me, onMe, social }: ProfileHeaderProps) {
  const name = me?.name ?? profile.name ?? "Member";
  const seasonal = profile.season.rank !== null && profile.season.season !== "all";
  const place = seasonal ? profile.season : profile.allTime;
  const rank = place.rank;
  const where = seasonal ? seasonShort(profile.season.season) : "all-time";
  const rankNote = rank === null ? "Unranked" : `of ${place.ranked} · ${seasonal ? `S${profile.season.season.split("-")[1]}` : "all-time"}`;
  const mutual = profile.mutual?.friends ?? [];

  return (
    <header className="relative rounded-2xl border border-silver/10 bg-gradient-to-br from-ballroom/90 via-ballroom/50 to-ink p-5 shadow-[inset_0_1px_0_rgb(213_219_234/0.06)] sm:p-7">
      {/* The glows are clipped on their own layer, so the friend menu can hang past the card. */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
        <span className="absolute -top-28 -left-20 size-80 rounded-full bg-gold/15 blur-3xl" />
        <span className="absolute -right-24 -bottom-32 size-80 rounded-full bg-brand-violet/15 blur-3xl" />
      </span>
      <div className="relative flex animate-page-in flex-col items-center gap-5 text-center sm:flex-row sm:items-center sm:gap-8 sm:text-left">
        {me ? (
          <ProfilePhoto me={me} onChange={onMe} size={AVATAR} />
        ) : (
          <div className="shrink-0 rounded-full bg-gradient-to-br from-gold-light via-gold-deep to-gold p-[3px] shadow-[0_0_34px_-6px_rgb(232_194_104/0.6)]">
            <Avatar name={name} email="" picture={profile.picture} size={AVATAR} />
          </div>
        )}
        <div className="flex w-full min-w-0 flex-1 flex-col items-center gap-4 sm:items-start">
          <div className="flex max-w-full flex-col items-center gap-1 sm:items-start">
            {me ? (
              <NameEditor me={me} onChange={onMe} />
            ) : (
              <h1 className="max-w-full truncate text-2xl font-semibold tracking-tight text-pearl sm:text-3xl">{name}</h1>
            )}
            {profile.memberSince && <p className="text-sm text-silver-dim">{memberSince(profile.memberSince)}</p>}
          </div>

          <ul aria-label="At a glance" className="grid w-full max-w-sm grid-cols-3 gap-1 sm:max-w-md">
            <li className="flex">
              <Link
                href="/leaderboard/"
                aria-label={rank === null ? "Unranked, see the leaderboard" : `Rank #${rank} of ${place.ranked}, ${where}`}
                className={cn(STAT, "hover:bg-gold/10")}
              >
                <StatValue gold>{rank === null ? "-" : <CountUp value={rank} format={(n) => `#${Math.round(n)}`} />}</StatValue>
                <StatLabel>{rankNote}</StatLabel>
              </Link>
            </li>
            <li className="flex">
              <button
                type="button"
                aria-label={plural(social.friends, "friend")}
                onClick={opener(() => social.open("friends"))}
                className={STAT}
              >
                <StatValue>
                  <CountUp value={social.friends} />
                </StatValue>
                <StatLabel>{social.friends === 1 ? "Friend" : "Friends"}</StatLabel>
              </button>
            </li>
            <li className="flex">
              <button
                type="button"
                aria-label={plural(social.groups, social.own ? "group" : "shared group")}
                onClick={opener(() => social.open("groups"))}
                className={STAT}
              >
                <StatValue>
                  <CountUp value={social.groups} />
                </StatValue>
                <StatLabel>{social.own ? (social.groups === 1 ? "Group" : "Groups") : "Shared groups"}</StatLabel>
              </button>
            </li>
          </ul>

          {social.own ? (
            social.waiting > 0 && (
              <button
                type="button"
                aria-label={`Requests, ${social.waiting} waiting`}
                onClick={opener(() => social.open("requests"))}
                className={cn(
                  "inline-flex min-h-10 items-center gap-2 rounded-full border border-brand-magenta/45 bg-brand-magenta/10 pr-1.5 pl-4 text-sm font-medium text-pearl transition-colors hover:bg-brand-magenta/20 active:bg-brand-magenta/25 animate-pop-in",
                  FOCUS,
                )}
              >
                Requests
                <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-brand-magenta px-2 text-xs font-semibold tabular-nums">
                  {social.waiting}
                </span>
              </button>
            )
          ) : (
            <div className="flex w-full flex-col items-center gap-3 sm:items-start">
              {social.relation === undefined ? (
                <span aria-hidden="true" className="h-11 w-36 rounded-md skeleton" />
              ) : (
                <FriendButton
                  person={{ sub: profile.sub, name: profile.name, picture: profile.picture, avatarKind: profile.avatarKind }}
                  relation={social.relation}
                  onChange={social.onRelation}
                />
              )}
              {mutual.length > 0 && <MutualLine people={mutual} onOpen={() => social.open("friends")} />}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

const STAT = cn(
  "flex min-h-16 w-full flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-2 transition-colors hover:bg-silver/10 active:bg-silver/15 sm:items-start sm:px-3",
  FOCUS,
);

function StatValue({ gold = false, children }: { gold?: boolean; children: ReactNode }) {
  return (
    <span className={cn("text-xl leading-tight font-semibold tabular-nums sm:text-2xl", gold ? "text-gold-light" : "text-pearl")}>
      {children}
    </span>
  );
}

function StatLabel({ children }: { children: ReactNode }) {
  return <span className="truncate text-xs text-silver-dim">{children}</span>;
}

/** "Friends with Alex and 3 others you know", with their faces. */
export function mutualText(people: Person[]): { first: string; rest: string } {
  const [a, b] = people.map(displayName);
  if (people.length === 1) return { first: a, rest: "" };
  if (people.length === 2) return { first: a, rest: ` and ${b}` };
  const others = people.length - 1;
  return { first: a, rest: ` and ${others} ${others === 1 ? "other" : "others"} you know` };
}

function MutualLine({ people, onOpen }: { people: Person[]; onOpen: () => void }) {
  const { first, rest } = mutualText(people);
  return (
    <button
      type="button"
      onClick={opener(onOpen)}
      className={cn(
        "-mx-2 flex min-h-11 items-center gap-2.5 rounded-full px-2 text-left text-sm text-silver-dim transition-colors hover:text-silver",
        FOCUS,
      )}
    >
      <AvatarStack people={people} size={26} max={3} />
      <span>
        Friends with <span className="font-semibold text-pearl">{first}</span>
        {rest}
      </span>
    </button>
  );
}
