"use client";

import Image from "next/image";
import { useState } from "react";

import { initials } from "@/components/avatar";
import type { Member, Person } from "@/lib/api/show";

interface HeadshotProps {
  person: Person;
  // Pixels on a side, ring included.
  size?: number;
}

export const headshotUrl = (file: string) => `/headshots/${encodeURIComponent(file)}`;

/** Decorative: every use sits beside the person's name. */
export function Headshot({ person, size = 48 }: HeadshotProps) {
  // Keyed by file so a different person in the same slot gets a fresh try.
  const [failed, setFailed] = useState<string | null>(null);
  const file = person.headshot?.file;

  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className="flex shrink-0 rounded-full bg-gradient-to-br from-gold-light via-gold to-ballroom p-0.5"
    >
      {file && failed !== file ? (
        <Image
          src={headshotUrl(file)}
          alt=""
          width={size}
          height={size}
          unoptimized
          loading="lazy"
          onError={() => setFailed(file)}
          // Commons portraits put the face in the upper third.
          className="size-full rounded-full bg-ballroom object-cover object-[50%_20%]"
        />
      ) : (
        <span
          style={{ fontSize: Math.round(size * 0.34) }}
          className="flex size-full items-center justify-center rounded-full bg-gradient-to-br from-ballroom to-ink font-semibold text-gold-light"
        >
          {initials(person.name, "")}
        </span>
      )}
    </span>
  );
}

export const coupleName = (c: { members: Member[] }) => c.members.map((m) => m.name).join(" & ");

interface CoupleAvatarsProps {
  members: Member[];
  size?: number;
}

/** Celebrity in front, pro tucked behind: the pair beside a "Celebrity & Pro" name. */
export function CoupleAvatars({ members, size = 40 }: CoupleAvatarsProps) {
  const celebrity = members.find((m) => m.role === "celebrity") ?? members[0];
  const pro = members.find((m) => m !== celebrity);

  return (
    <span className="flex shrink-0">
      {celebrity && (
        <span className="relative z-10 rounded-full ring-2 ring-ink">
          <Headshot person={celebrity} size={size} />
        </span>
      )}
      {pro && (
        <span style={{ marginLeft: -Math.round(size * 0.3) }} className="rounded-full ring-2 ring-ink">
          <Headshot person={pro} size={size} />
        </span>
      )}
    </span>
  );
}
