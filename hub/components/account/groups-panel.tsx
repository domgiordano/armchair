"use client";

import { useEffect, useId, useState, type FormEvent } from "react";

import { createGroup, getMyGroups, type Group } from "@/lib/api/groups";
import type { Notification } from "@/lib/api/social";
import { dwtsLink, profileLink } from "@/lib/links";
import { message, useAction, useLoad } from "@/lib/load";
import { onAnswered, useNotifications } from "@/lib/notifications";

import { Avatar, displayName, Empty, ErrorNote, EYEBROW, FOCUS, INPUT, Panel, PersonRow, PRIMARY, QUIET, SECONDARY, SkeletonRows } from "./ui";

const NAME_MAX = 40;
const FACES = 5;

export function GroupsPanel({ index }: { index: number }) {
  const [load, reload] = useLoad(getMyGroups);
  useEffect(() => onAnswered(reload), [reload]);
  const { items } = useNotifications();
  const invites = items.filter((n) => n.type === "group_invite" && n.state === "pending");

  return (
    <Panel
      id="groups"
      title="Groups"
      count={invites.length}
      countLabel="invites"
      index={index}
      action={
        <a href={dwtsLink("/friends/", { tab: "groups" })} className={QUIET}>
          Manage
        </a>
      }
    >
      {invites.length > 0 && (
        <div>
          <h3 className={EYEBROW}>Invites</h3>
          <ul className="divide-y divide-line/70">
            {invites.map((n) => (
              <li key={n.id}>
                <InviteRow invite={n} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {load.kind === "loading" && <SkeletonRows label="Loading your groups" rows={2} />}
      {load.kind === "error" && <ErrorNote what="your groups" message={load.message} retry={reload} />}
      {load.kind === "ready" && <GroupList groups={load.value} />}
      <NewGroup onCreated={reload} />
    </Panel>
  );
}

function InviteRow({ invite }: { invite: Notification }) {
  const { answer } = useNotifications();
  const { busy, error, run } = useAction();
  return (
    <PersonRow person={invite.from} detail={`Invited you to ${invite.group?.name ?? "a group"}`} error={error}>
      <button type="button" disabled={busy !== null} onClick={() => void run("join", () => answer(invite, true))} className={PRIMARY}>
        {busy === "join" ? "Joining..." : "Join"}
      </button>
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => void run("decline", () => answer(invite, false))}
        className={SECONDARY}
      >
        Decline
      </button>
    </PersonRow>
  );
}

function GroupList({ groups }: { groups: Group[] }) {
  if (groups.length === 0) return <Empty>You&rsquo;re not in any groups yet. Start one for your watch party.</Empty>;
  return (
    <ul className="divide-y divide-line/70">
      {groups.map((g) => {
        const more = g.members.length - FACES;
        return (
          <li key={g.id} className="flex flex-col gap-1 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <a
                href={dwtsLink("/friends/", { tab: "groups", group: g.id })}
                className={`min-w-0 truncate rounded-md font-semibold text-text decoration-gold underline-offset-4 hover:underline ${FOCUS}`}
              >
                {g.name}
              </a>
              <span className="shrink-0 text-xs text-muted tabular-nums">
                {g.members.length} {g.members.length === 1 ? "member" : "members"}
              </span>
            </div>
            <ul aria-label={`${g.name} members`} className="flex flex-wrap items-center">
              {g.members.slice(0, FACES).map((m) => (
                <li key={m.sub}>
                  <a
                    href={profileLink(m.sub)}
                    aria-label={displayName(m)}
                    title={displayName(m)}
                    className={`flex size-11 items-center justify-center rounded-full transition-transform hover:-translate-y-0.5 motion-reduce:transition-none ${FOCUS}`}
                  >
                    <Avatar name={displayName(m)} picture={m.picture} size={34} decorative />
                  </a>
                </li>
              ))}
              {more > 0 && <li className="pl-1 text-xs text-muted tabular-nums">+{more}</li>}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}

function NewGroup({ onCreated }: { onCreated: () => void }) {
  const id = useId();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give the group a name.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const group = await createGroup(trimmed);
      setName("");
      setCreated(group.name);
      onCreated();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-2 border-t border-line/70 pt-4">
      <label htmlFor={id} className="text-sm font-medium text-muted">
        Start a group
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setCreated(null);
          }}
          maxLength={NAME_MAX}
          placeholder="Sunday couch crew"
          aria-invalid={error !== null}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`${INPUT} min-w-0`}
        />
        <button type="submit" disabled={busy} className={`${PRIMARY} shrink-0`}>
          {busy ? "Creating..." : "Create"}
        </button>
      </div>
      {error !== null && (
        <p id={`${id}-error`} role="alert" className="text-sm text-magenta">
          {error}
        </p>
      )}
      <p aria-live="polite" className="text-sm text-gold empty:hidden">
        {created && `${created} is ready. Invite people from Manage.`}
      </p>
    </form>
  );
}
