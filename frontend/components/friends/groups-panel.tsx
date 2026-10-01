"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";

import { Avatar } from "@/components/avatar";
import {
  ConfirmButton,
  CopyLink,
  Empty,
  FOCUS,
  INPUT,
  PersonRow,
  QUIET,
  SECTION_TITLE,
  SMALL_PRIMARY,
  SMALL_SECONDARY,
  SPLIT,
  displayName,
  useAction,
  useLoad,
} from "@/components/friends/parts";
import { LoadError } from "@/components/load-error";
import {
  createGroup,
  deleteGroup,
  getGroupDetails,
  inviteLink,
  inviteToGroup,
  leaveGroup,
  manageGroup,
  type GroupDetail,
} from "@/lib/api/groups";
import { mySub, type Contact } from "@/lib/api/social";
import { saveGroup } from "@/lib/show/group-filter";
import { PRIMARY } from "@/lib/ui";

const NAME_MAX = 40;

export function GroupsPanel({ friends }: { friends: Contact[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const selected = params.get("group");
  const [groups, reload] = useLoad(getGroupDetails);
  const [me] = useLoad(mySub);

  const open = (id: string | null) => {
    const next = new URLSearchParams(params.toString());
    next.set("tab", "groups");
    if (id) next.set("group", id);
    else next.delete("group");
    router.replace(`/friends/?${next}`, { scroll: false });
  };

  if (groups.kind === "loading") return <p className="text-neutral-400">Loading your groups...</p>;
  if (groups.kind === "error") return <LoadError what="your groups" message={groups.message} retry={reload} />;

  const group = groups.value.find((g) => g.id === selected);
  // Phone: the list or one group. Desktop: the list stays beside the open group.
  return (
    <div className={`${SPLIT} gap-6`}>
      <div className={`flex-col gap-6 ${group ? "hidden lg:flex" : "flex"}`}>
        <p className="text-sm text-neutral-400">
          A group narrows every scorecard and leaderboard to the people in it, in any Armchair Judge show.
        </p>
        <NewGroup onCreated={(id) => (reload(), open(id))} />
        {groups.value.length === 0 ? (
          <Empty>You&apos;re not in any groups yet.</Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {groups.value.map((g) => {
              const current = g.id === group?.id;
              return (
                <li key={g.id}>
                  <button
                    type="button"
                    aria-current={current ? "true" : undefined}
                    onClick={() => open(g.id)}
                    className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left hover:border-neutral-600 hover:bg-neutral-900 active:bg-neutral-800 ${FOCUS} ${
                      current ? "border-gold/50 bg-ballroom" : "border-neutral-800"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-neutral-100">{g.name}</p>
                      <p className="text-xs text-neutral-500">
                        {g.members.length} {g.members.length === 1 ? "member" : "members"}
                        {g.requests.length > 0 && (
                          <span className="text-brand-magenta"> · {g.requests.length} waiting</span>
                        )}
                      </p>
                    </div>
                    <span className="flex -space-x-2" aria-hidden="true">
                      {g.members.slice(0, 4).map((m) => (
                        <span key={m.sub} className="rounded-full ring-2 ring-ink">
                          <Avatar name={displayName(m)} email="" picture={m.picture} />
                        </span>
                      ))}
                    </span>
                    <Chevron />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {group ? (
        <GroupDetailView
          group={group}
          me={me.kind === "ready" ? me.value : null}
          friends={friends}
          reload={reload}
          back={() => open(null)}
        />
      ) : (
        <p className="hidden rounded-xl border border-dashed border-neutral-700 px-6 py-16 text-center text-sm text-neutral-400 lg:block">
          {groups.value.length === 0
            ? "Start a group and it opens here."
            : "Pick a group to see its members, invite friends and share its link."}
        </p>
      )}
    </div>
  );
}

function NewGroup({ onCreated }: { onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const { busy, error, run } = useAction();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run("create", async () => {
      const group = await createGroup(name.trim());
      setName("");
      onCreated(group.id);
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label htmlFor="new-group" className="text-sm text-neutral-400">
        Start a group
      </label>
      <div className="flex gap-2">
        <input
          id="new-group"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={NAME_MAX}
          placeholder="Family, work, the group chat..."
          className={INPUT}
        />
        <button type="submit" disabled={busy !== null || !name.trim()} className={`${PRIMARY} shrink-0`}>
          Create
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-amber-200">
          Couldn&apos;t start the group: {error}
        </p>
      )}
    </form>
  );
}

function GroupDetailView({
  group,
  me,
  friends,
  reload,
  back,
}: {
  group: GroupDetail;
  me: string | null;
  friends: Contact[];
  reload: () => void;
  back: () => void;
}) {
  const owner = group.owner === me;
  const inside = new Set([...group.members, ...group.invited].map((m) => m.sub));
  const invitable = friends.filter((f) => !inside.has(f.sub));
  const act = useAction();

  const change = (name: string, fn: () => Promise<unknown>) => act.run(name, () => fn().then(reload));

  return (
    <article
      aria-labelledby="group-name"
      className="flex flex-col gap-6 lg:rounded-xl lg:border lg:border-neutral-800 lg:bg-ballroom/40 lg:p-6"
    >
      <div className="flex flex-col gap-2">
        <button type="button" onClick={back} className={`${QUIET} -ml-3 self-start lg:hidden`}>
          <Chevron flip /> All groups
        </button>
        <div className="flex items-center justify-between gap-3">
          <h2 id="group-name" className="truncate text-lg font-semibold">
            {group.name}
          </h2>
          <Link
            href="/episode/"
            onClick={() => saveGroup(group.id)}
            className={`shrink-0 rounded-md text-sm text-neutral-400 underline underline-offset-4 hover:text-neutral-200 ${FOCUS}`}
          >
            Scorecard
          </Link>
        </div>
        {owner && <Rename group={group} reload={reload} />}
      </div>

      {owner && group.requests.length > 0 && (
        <Section title="Asking to join" count={group.requests.length}>
          {group.requests.map((r) => (
            <li key={r.sub}>
              <Row person={r}>
                {(a) => (
                  <>
                    <button
                      type="button"
                      disabled={a.busy !== null}
                      onClick={() => void a.run("approve", () => manageGroup(group.id, { action: "approve", sub: r.sub }).then(reload))}
                      className={SMALL_PRIMARY}
                    >
                      Let in
                    </button>
                    <button
                      type="button"
                      disabled={a.busy !== null}
                      onClick={() => void a.run("deny", () => manageGroup(group.id, { action: "deny", sub: r.sub }).then(reload))}
                      className={SMALL_SECONDARY}
                    >
                      Deny
                    </button>
                  </>
                )}
              </Row>
            </li>
          ))}
        </Section>
      )}

      <Section title="Members" count={group.members.length}>
        {group.members.map((m) => (
          <li key={m.sub}>
            <Row person={m} detail={m.sub === group.owner ? "Owner" : m.sub === me ? "You" : undefined}>
              {(a) =>
                owner && m.sub !== me ? (
                  <ConfirmButton
                    label="Remove"
                    confirm="Remove"
                    busy={a.busy !== null}
                    onConfirm={() => void a.run("remove", () => manageGroup(group.id, { action: "remove", sub: m.sub }).then(reload))}
                  />
                ) : null
              }
            </Row>
          </li>
        ))}
        {group.invited.map((m) => (
          <li key={m.sub}>
            <PersonRow person={m} detail="Invited" />
          </li>
        ))}
      </Section>

      <div className="flex flex-col gap-2">
        <h3 className={SECTION_TITLE}>Invite friends</h3>
        {invitable.length === 0 ? (
          <Empty>{friends.length === 0 ? "Add friends first, or share the group link below." : "All your friends are in."}</Empty>
        ) : (
          <ul className="divide-y divide-neutral-800">
            {invitable.map((f) => (
              <li key={f.sub}>
                <Row person={f}>
                  {(a) => (
                    <button
                      type="button"
                      disabled={a.busy !== null}
                      onClick={() => void a.run("invite", () => inviteToGroup(group.id, f.sub).then(reload))}
                      className={SMALL_PRIMARY}
                    >
                      {a.busy ? "Inviting..." : "Invite"}
                    </button>
                  )}
                </Row>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-neutral-800 p-4">
        <CopyLink label="Group link" link={inviteLink(group.inviteCode)} />
        {owner ? (
          <label className="flex min-h-11 items-center gap-3 text-sm text-neutral-300">
            <input
              type="checkbox"
              checked={group.approval}
              disabled={act.busy !== null}
              onChange={(e) => void change("approval", () => manageGroup(group.id, { action: "approval", approval: e.target.checked }))}
              className="size-5 accent-amber-300"
            />
            Approve people who join by link
          </label>
        ) : (
          group.approval && <p className="text-xs text-neutral-500">The owner approves people who join by link.</p>
        )}
      </div>

      <div className="flex flex-col items-start gap-2 border-t border-neutral-800 pt-4">
        {owner ? (
          <ConfirmButton
            label="Delete group"
            confirm="Delete for everyone"
            busy={act.busy !== null}
            onConfirm={() => void act.run("delete", () => deleteGroup(group.id).then(() => (reload(), back())))}
          />
        ) : (
          <ConfirmButton
            label="Leave group"
            confirm="Leave"
            busy={act.busy !== null}
            onConfirm={() => void act.run("leave", () => leaveGroup(group.id).then(() => (reload(), back())))}
          />
        )}
        {act.error && (
          <p role="alert" className="text-sm text-amber-200">
            {act.error}
          </p>
        )}
      </div>
    </article>
  );
}

function Rename({ group, reload }: { group: GroupDetail; reload: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);
  const { busy, error, run } = useAction();

  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} className={`${QUIET} -ml-3 self-start`}>
        Rename
      </button>
    );
  }
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run("rename", async () => {
      await manageGroup(group.id, { action: "rename", name: name.trim() });
      setEditing(false);
      reload();
    });
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label htmlFor="rename-group" className="sr-only">
        Group name
      </label>
      <div className="flex gap-2">
        <input id="rename-group" value={name} onChange={(e) => setName(e.target.value)} maxLength={NAME_MAX} className={INPUT} />
        <button type="submit" disabled={busy !== null || !name.trim()} className={SMALL_PRIMARY}>
          Save
        </button>
        <button type="button" onClick={() => setEditing(false)} className={QUIET}>
          Cancel
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-amber-200">
          {error}
        </p>
      )}
    </form>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <h3 className={SECTION_TITLE}>
        {title} <span className="text-neutral-500 tabular-nums">{count}</span>
      </h3>
      <ul className="divide-y divide-neutral-800">{children}</ul>
    </div>
  );
}

function Row({
  person,
  detail,
  children,
}: {
  person: Contact | GroupDetail["members"][number];
  detail?: string;
  children: (a: ReturnType<typeof useAction>) => ReactNode;
}) {
  const a = useAction();
  return (
    <PersonRow person={person} detail={detail} error={a.error}>
      {children(a)}
    </PersonRow>
  );
}

function Chevron({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 text-neutral-500 ${flip ? "rotate-180" : ""}`}
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}
