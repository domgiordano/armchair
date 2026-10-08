"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";

import { GroupMark, useAction } from "@/components/social/parts";
import { Input } from "@/components/ui/field";
import { createGroup, groupHref } from "@armchair/app-core/api/groups";
import type { Notification } from "@armchair/app-core/api/social";
import { useNotifications } from "@armchair/app-core/social/notifications";
import { inviteCode } from "@/lib/social/group-summary";
import { button, cn, PRIMARY, SECONDARY } from "@/lib/ui";

const NAME_MAX = 40;

function ActionCard({
  title,
  note,
  icon,
  children,
}: {
  title: string;
  note: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-gold/25 bg-gradient-to-br from-gold/[0.07] via-ballroom/55 to-ballroom/30 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-gold/35 bg-gold/10 text-gold-light"
        >
          {icon}
        </span>
        <div className="flex flex-col gap-0.5">
          <h2 className="font-semibold text-pearl">{title}</h2>
          <p className="text-sm text-silver-dim">{note}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

/** Name a group and land on its page, ready to invite. */
export function StartGroup() {
  const router = useRouter();
  const [name, setName] = useState("");
  const { busy, error, run } = useAction();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run("create", async () => {
      const group = await createGroup(name.trim());
      router.push(groupHref(group.id));
    });
  };

  return (
    <ActionCard
      title="Start a group"
      note="Its own leaderboard, and every scorecard narrowed to the people in it."
      icon={<PlusIcon />}
    >
      <form onSubmit={submit}>
        <Input
          label="Group name"
          hideLabel
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={NAME_MAX}
          placeholder="Family, work, the group chat..."
          error={error && `Couldn't start the group: ${error}`}
          action={
            <button type="submit" disabled={busy !== null || !name.trim()} className={`${PRIMARY} shrink-0`}>
              {busy ? "Creating..." : "Create"}
            </button>
          }
        />
      </form>
    </ActionCard>
  );
}

/** Paste a group link someone sent, or its code. */
export function JoinByLink() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [bad, setBad] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const code = inviteCode(text);
    setBad(code === null);
    if (code) router.push(`/join/?code=${encodeURIComponent(code)}`);
  };

  return (
    <ActionCard title="Join with a link" note="Got a group link in a message? Paste it here." icon={<LinkIcon />}>
      <form onSubmit={submit}>
        <Input
          label="Group link or code"
          hideLabel
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setBad(false);
          }}
          placeholder="Paste the link"
          error={bad ? "That doesn't look like a group link. Copy the whole link and try again." : null}
          action={
            <button type="submit" disabled={!text.trim()} className={`${SECONDARY} shrink-0`}>
              Join
            </button>
          }
        />
      </form>
    </ActionCard>
  );
}

/** Someone asked you into a group: a card with its name, who asked, and the answer buttons. */
export function GroupInviteCard({ invite }: { invite: Notification }) {
  const router = useRouter();
  const { answer } = useNotifications();
  const act = useAction();
  const name = invite.group?.name ?? "A group";
  const id = invite.group?.id;

  return (
    <section
      aria-label={`Invite to ${name}`}
      className="flex flex-col gap-3 rounded-2xl border border-brand-magenta/35 bg-gradient-to-br from-brand-magenta/10 via-ballroom/60 to-ink p-4 sm:flex-row sm:items-center sm:p-5"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <GroupMark name={name} />
        <div className="flex min-w-0 flex-col">
          <p className="text-xs font-semibold tracking-[0.14em] text-brand-magenta uppercase">Invite</p>
          <p className="truncate font-semibold text-pearl">{name}</p>
          <p className="text-xs text-silver-dim">From {invite.from.name ?? "someone"}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={act.busy !== null}
          onClick={() =>
            void act.run("join", async () => {
              await answer(invite, true);
              if (id) router.push(groupHref(id));
            })
          }
          className={cn(button("primary", "sm"), "flex-1 sm:flex-none")}
        >
          {act.busy === "join" ? "Joining..." : "Join"}
        </button>
        <button
          type="button"
          disabled={act.busy !== null}
          onClick={() => void act.run("decline", () => answer(invite, false))}
          className={cn(button("secondary", "sm"), "flex-1 sm:flex-none")}
        >
          Decline
        </button>
      </div>
      {act.error && (
        <p role="alert" className="text-sm text-red-300">
          {act.error}
        </p>
      )}
    </section>
  );
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
    >
      <path d="M10 4.5v11M4.5 10h11" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8.5 11.5a3.2 3.2 0 0 0 4.5 0l2.5-2.5a3.2 3.2 0 0 0-4.5-4.5l-1 1" />
      <path d="M11.5 8.5a3.2 3.2 0 0 0-4.5 0L4.5 11a3.2 3.2 0 0 0 4.5 4.5l1-1" />
    </svg>
  );
}
