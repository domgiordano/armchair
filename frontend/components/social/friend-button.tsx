"use client";

import { useState } from "react";

import { CheckIcon, displayName, message } from "@/components/social/parts";
import { Menu, MenuItem } from "@/components/ui/menu";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { acceptFriend, addFriend, removeFriend, setBlocked, type Person, type Relation } from "@armchair/app-core/api/social";
import { button, cn } from "@/lib/ui";

interface FriendButtonProps {
  person: Person;
  relation: Relation;
  onChange: (next: Relation) => void;
}

type Confirm = "remove" | "block" | null;

const WIDE = "min-w-32 justify-center";

/** The one action on someone else's profile, following where you stand with them. */
export function FriendButton({ person, relation, onChange }: FriendButtonProps) {
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const toast = useToast();
  const name = displayName(person);

  const run = async (fn: () => Promise<Relation>, done?: string) => {
    setBusy(true);
    try {
      const next = await fn();
      onChange(next);
      if (done) toast(done);
    } catch (e) {
      toast(message(e), "error");
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const add = () =>
    run(async () => {
      const { status } = await addFriend({ sub: person.sub });
      return status;
    });
  const accept = () => run(() => acceptFriend(person.sub).then(() => "friend" as const), `You and ${name} are friends`);
  const remove = (done?: string) => run(() => removeFriend(person.sub).then(() => null), done);
  const block = () => run(() => setBlocked(person.sub, true).then(() => "blocked" as const), `Blocked ${name}`);

  let control;
  if (relation === "friend") {
    control = (
      <Menu
        label="Friends"
        trigger={
          <>
            <CheckIcon className="text-gold animate-pop-in" />
            Friends
            <Caret />
          </>
        }
        triggerClassName={cn(button("secondary"), WIDE)}
      >
        <MenuItem onSelect={() => setConfirm("remove")}>Remove friend</MenuItem>
        <MenuItem onSelect={() => setConfirm("block")} className="text-red-200 hover:text-red-100 focus:text-red-100">
          Block
        </MenuItem>
      </Menu>
    );
  } else if (relation === "outgoing") {
    control = (
      <Menu
        label="Requested"
        trigger={
          <>
            Requested
            <Caret />
          </>
        }
        triggerClassName={cn(button("secondary"), WIDE, "text-silver")}
      >
        <MenuItem onSelect={() => void remove("Request cancelled")}>Cancel request</MenuItem>
      </Menu>
    );
  } else if (relation === "incoming") {
    control = (
      <span className="flex gap-2">
        <button type="button" disabled={busy} onClick={() => void accept()} className={cn(button("primary"), WIDE)}>
          {busy ? "Accepting..." : "Accept"}
        </button>
        <button type="button" disabled={busy} onClick={() => void remove()} className={button("secondary")}>
          Decline
        </button>
      </span>
    );
  } else if (relation === "blocked") {
    control = (
      <button
        type="button"
        disabled={busy}
        onClick={() => void run(() => setBlocked(person.sub, false).then(() => null), `Unblocked ${name}`)}
        className={cn(button("secondary"), WIDE)}
      >
        Unblock
      </button>
    );
  } else {
    control = (
      <button type="button" disabled={busy} onClick={() => void add()} className={cn(button("primary"), WIDE)}>
        <PlusIcon />
        {busy ? "Adding..." : "Add friend"}
      </button>
    );
  }

  return (
    <>
      <div aria-live="polite" className="flex">
        {control}
      </div>
      <Sheet
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        label={confirm === "block" ? `Block ${name}?` : `Remove ${name}?`}
      >
        <div className="flex flex-col gap-2 pr-10 text-left">
          <h2 className="text-lg font-semibold text-pearl">{confirm === "block" ? `Block ${name}?` : `Remove ${name}?`}</h2>
          <p className="text-sm text-silver-dim">
            {confirm === "block"
              ? "They won't see your profile or be able to add you, and you'll stop being friends. You can unblock them later from your requests."
              : "They drop off your Friends leaderboard. You can add them again any time."}
          </p>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => setConfirm(null)} className={button("secondary")}>
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void (confirm === "block" ? block() : remove(`Removed ${name}`))}
            className={button("danger")}
          >
            {busy ? "Working..." : confirm === "block" ? "Block" : "Remove friend"}
          </button>
        </div>
      </Sheet>
    </>
  );
}

function Caret() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5 shrink-0 opacity-70" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="m4 6 4 4 4-4" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
      <path d="M10 4.5v11M4.5 10h11" />
    </svg>
  );
}
