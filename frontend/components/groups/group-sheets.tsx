"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import {
  CheckIcon,
  ConfirmButton,
  CopyLink,
  Empty,
  PersonRow,
  SMALL_PRIMARY,
  displayName,
  useAction,
  type Load,
} from "@/components/social/parts";
import { Input, SearchInput, Toggle } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { SkeletonList } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { deleteGroup, inviteLink, inviteToGroup, leaveGroup, manageGroup, type GroupDetail } from "@armchair/app-core/api/groups";
import type { Friends, Person } from "@armchair/app-core/api/social";
import { search } from "@/lib/search/match";
import { button, EYEBROW, PRIMARY } from "@/lib/ui";

const NAME_MAX = 40;
const HOME = "/social/?view=groups";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  group: GroupDetail;
}

function Title({ children, note }: { children: string; note?: string }) {
  return (
    <div className="flex flex-col gap-1 pr-10 text-left">
      <h2 className="text-lg font-semibold text-pearl">{children}</h2>
      {note && <p className="text-sm text-silver-dim">{note}</p>}
    </div>
  );
}

interface InviteProps extends SheetProps {
  friends: Load<Friends>;
  reloadFriends: () => void;
  onInvited: () => void;
}

/** The group's link to share, and your friends who aren't in yet. */
export function InviteSheet({ open, onClose, group, friends, reloadFriends, onInvited }: InviteProps) {
  return (
    <Sheet open={open} onClose={onClose} label={`Invite to ${group.name}`}>
      {open && (
        <div className="flex flex-col gap-5 text-left">
          <Title note={group.approval ? "You'll approve anyone who joins by the link." : "Anyone with the link can join."}>
            {`Invite to ${group.name}`}
          </Title>
          <CopyLink
            label="Group link"
            link={inviteLink(group.inviteCode)}
            share={{
              title: `Join ${group.name} on Armchair Judge`,
              text: `Join ${group.name} on Armchair Judge. Rate Dancing with the Stars with us.`,
            }}
          />
          {friends.kind === "loading" && <SkeletonList label="Loading your friends" rows={3} avatar />}
          {friends.kind === "error" && <ErrorState what="your friends" message={friends.message} retry={reloadFriends} />}
          {friends.kind === "ready" && <InviteFriends group={group} friends={friends.value.friends} onInvited={onInvited} />}
        </div>
      )}
    </Sheet>
  );
}

function InviteFriends({ group, friends, onInvited }: { group: GroupDetail; friends: Person[]; onInvited: () => void }) {
  const [q, setQ] = useState("");
  const members = new Set(group.members.map((m) => m.sub));
  const invited = new Set(group.invited.map((m) => m.sub));
  const outside = friends.filter((f) => !members.has(f.sub));
  const shown = q.trim() ? search(outside, q, displayName, outside.length) : outside;

  if (friends.length === 0) return <Empty>Add friends from your profile, or share the link above.</Empty>;
  if (outside.length === 0) return <Empty>All your friends are in.</Empty>;
  return (
    <div className="flex flex-col gap-2">
      <p className={EYEBROW}>Invite friends</p>
      {outside.length > 6 && <SearchInput label="Search friends" value={q} onChange={setQ} maxLength={40} />}
      <ul className="stagger divide-y divide-silver/10">
        {shown.map((f) => (
          <li key={f.sub}>
            <InviteRow group={group.id} friend={f} invited={invited.has(f.sub)} onInvited={onInvited} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function InviteRow({ group, friend, invited, onInvited }: { group: string; friend: Person; invited: boolean; onInvited: () => void }) {
  const { busy, error, run } = useAction();
  const [sent, setSent] = useState(invited);
  const invite = () =>
    run("invite", async () => {
      await inviteToGroup(group, friend.sub);
      setSent(true);
      onInvited();
    });
  return (
    <PersonRow person={friend} error={error}>
      {sent ? (
        <span className="flex min-h-10 items-center gap-1 px-2 text-sm font-medium text-gold-light animate-pop-in">
          <CheckIcon />
          Invited
        </span>
      ) : (
        <button type="button" disabled={busy !== null} onClick={() => void invite()} className={SMALL_PRIMARY}>
          {busy ? "Inviting..." : "Invite"}
        </button>
      )}
    </PersonRow>
  );
}

/** Owner only: the name, whether the link needs approval, and deleting the group. */
export function SettingsSheet({ open, onClose, group, reload }: SheetProps & { reload: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} label="Group settings">
      {open && <Settings group={group} reload={reload} onClose={onClose} />}
    </Sheet>
  );
}

function Settings({ group, reload, onClose }: { group: GroupDetail; reload: () => void; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(group.name);
  const rename = useAction();
  const approval = useAction();
  const remove = useAction();
  const changed = name.trim() !== "" && name.trim() !== group.name;

  const save = (e: FormEvent) => {
    e.preventDefault();
    void rename.run("rename", async () => {
      await manageGroup(group.id, { action: "rename", name: name.trim() });
      reload();
      toast("Group renamed");
      onClose();
    });
  };

  return (
    <div className="flex flex-col gap-5 text-left">
      <Title>Group settings</Title>
      <form onSubmit={save}>
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={NAME_MAX}
          error={rename.error}
          action={
            <button type="submit" disabled={rename.busy !== null || !changed} className={`${PRIMARY} shrink-0`}>
              {rename.busy ? "Saving..." : "Save"}
            </button>
          }
        />
      </form>
      <div className="flex flex-col gap-1">
        <Toggle
          label="Approve people who join by link"
          hint="Off: anyone with the link joins straight away."
          checked={group.approval}
          disabled={approval.busy !== null}
          onChange={(on) =>
            void approval.run("approval", async () => {
              await manageGroup(group.id, { action: "approval", approval: on });
              reload();
              toast(on ? "You'll approve new members" : "Anyone with the link joins");
            })
          }
        />
        {approval.error && (
          <p role="alert" className="text-sm text-red-300">
            {approval.error}
          </p>
        )}
      </div>
      <div className="flex flex-col items-start gap-2 border-t border-silver/10 pt-4">
        <p className="text-sm text-silver-dim">Deleting removes the group for everyone in it. Scores stay.</p>
        <ConfirmButton
          label="Delete group"
          confirm="Delete for everyone"
          busy={remove.busy !== null}
          onConfirm={() =>
            void remove.run("delete", async () => {
              await deleteGroup(group.id);
              toast(`Deleted ${group.name}`);
              router.push(HOME);
            })
          }
        />
        {remove.error && (
          <p role="alert" className="text-sm text-red-300">
            {remove.error}
          </p>
        )}
      </div>
    </div>
  );
}

export function LeaveSheet({ open, onClose, group }: SheetProps) {
  const router = useRouter();
  const toast = useToast();
  const { busy, error, run } = useAction();
  return (
    <Sheet open={open} onClose={onClose} label={`Leave ${group.name}?`}>
      <div className="flex flex-col gap-5 text-left">
        <Title note="Your scores stay. You can rejoin with the group's link.">{`Leave ${group.name}?`}</Title>
        {error && (
          <p role="alert" className="text-sm text-red-300">
            {error}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className={button("secondary")}>
            Stay
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() =>
              void run("leave", async () => {
                await leaveGroup(group.id);
                toast(`Left ${group.name}`);
                router.push(HOME);
              })
            }
            className={button("danger")}
          >
            {busy ? "Leaving..." : "Leave group"}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
