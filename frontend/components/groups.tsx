"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import { Avatar } from "@/components/avatar";
import { LoadError } from "@/components/load-error";
import { SignedIn } from "@/components/signed-in";
import { createGroup, getMyGroups, inviteLink, type Group } from "@/lib/api/groups";
import { saveGroup } from "@/lib/show/group-filter";
import { PRIMARY, SECONDARY } from "@/lib/ui";

const NAME_MAX = 40;

type Load = { kind: "loading" } | { kind: "ready"; groups: Group[] } | { kind: "error"; message: string };

export function GroupsScreen() {
  return (
    <SignedIn title="Groups">
      <Groups />
    </SignedIn>
  );
}

function Groups() {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getMyGroups().then(
      (groups) => !cancelled && setLoad({ kind: "ready", groups }),
      (e: unknown) =>
        !cancelled && setLoad({ kind: "error", message: e instanceof Error ? e.message : "Request failed" }),
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const reload = () => setAttempt((n) => n + 1);

  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">Groups</h1>
      <p className="text-sm text-neutral-400">
        Scores are shared with everyone. A group narrows the scorecard to the people in it.
      </p>
      <NewGroup onCreated={reload} />
      {load.kind === "loading" && <p className="text-neutral-400">Loading your groups...</p>}
      {load.kind === "error" && <LoadError what="your groups" message={load.message} retry={reload} />}
      {load.kind === "ready" && (
        <ul className="flex flex-col gap-3">
          {load.groups.map((g) => (
            <li key={g.id}>
              <GroupCard group={g} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function NewGroup({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const group = await createGroup(name.trim());
      saveGroup(group.id);
      setName("");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-sm text-neutral-400">
        New group name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={NAME_MAX}
          className="min-h-11 rounded-md border border-neutral-700 bg-neutral-900 px-3 text-base text-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
        />
      </label>
      <button type="submit" disabled={busy || !name.trim()} className={`${PRIMARY} self-start`}>
        Start group
      </button>
      {error !== null && (
        <p role="alert" className="text-sm text-amber-200">
          Couldn&apos;t start the group: {error}
        </p>
      )}
    </form>
  );
}

function GroupCard({ group }: { group: Group }) {
  const [copied, setCopied] = useState(false);
  const link = inviteLink(group.inviteCode);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // Clipboard access denied: the link stays on screen to copy by hand.
      setCopied(false);
    }
  };

  return (
    <article aria-label={group.name} className="flex flex-col gap-3 rounded-lg border border-neutral-700 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold">{group.name}</h2>
        <Link
          href="/episode/"
          onClick={() => saveGroup(group.id)}
          className="rounded-md text-sm text-neutral-400 underline underline-offset-4 hover:text-neutral-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
        >
          Scorecard
        </Link>
      </div>
      <ul aria-label="Members" className="flex flex-wrap gap-2">
        {group.members.map((m) => (
          <li key={m.sub}>
            <Avatar name={m.name ?? "Member"} email="" picture={m.picture} />
          </li>
        ))}
      </ul>
      <label className="flex flex-col gap-1 text-sm text-neutral-400">
        Invite link
        <input
          readOnly
          value={link}
          onFocus={(e) => e.target.select()}
          className="min-h-11 rounded-md border border-neutral-700 bg-neutral-900 px-3 text-sm text-neutral-100"
        />
      </label>
      <button type="button" onClick={() => void copy()} className={`${SECONDARY} self-start`}>
        {copied ? "Copied" : "Copy invite link"}
      </button>
    </article>
  );
}
