"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState, type FormEvent } from "react";

import { errorText } from "@/components/season-data";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { SkeletonList } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { button, cn, EYEBROW, FOCUS, HEADING } from "@/lib/ui";
import {
  createGroup,
  getGroupDetails,
  inviteLink,
  leaveGroup,
  manageGroup,
  plays,
  setGroupShow,
  type GroupDetail,
  type GroupPerson,
} from "@armchair/app-core/api/groups";
import { mySub } from "@armchair/app-core/api/social";
import { showRows } from "@armchair/app-core/social/group-shows";
import { useNotifications } from "@armchair/app-core/social/notifications";

type Load = { kind: "loading" } | { kind: "ready"; groups: GroupDetail[]; me: string | null } | { kind: "error"; message: string };

const NAME_MAX = 40;

/** `/groups/`: your groups, their boards and invite links, without leaving Traitors. */
export function GroupsScreen() {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getGroupDetails(), mySub()]).then(
      ([groups, me]) => !cancelled && setLoad({ kind: "ready", groups, me }),
      (e: unknown) => !cancelled && setLoad({ kind: "error", message: errorText(e) }),
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  // A link from another show's group page lands on that group's card.
  useEffect(() => {
    if (load.kind !== "ready") return;
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) document.getElementById(`g-${id}`)?.scrollIntoView({ block: "start" });
  }, [load.kind]);

  return (
    <>
      <div className="flex flex-col gap-1">
        <p className={EYEBROW}>Armchair Judge</p>
        <h1 className={cn(HEADING, "text-3xl leading-tight")}>Your groups</h1>
        <p className="text-parchment">The same groups in every Armchair Judge show. Each one gets its own board here.</p>
      </div>
      <Invites onAnswered={reload} />
      {load.kind === "loading" && <SkeletonList label="Loading your groups" rows={2} row="h-32" />}
      {load.kind === "error" && <ErrorState what="your groups" message={load.message} retry={reload} />}
      {load.kind === "ready" &&
        (load.groups.length === 0 ? (
          <EmptyState title="You're not in a group yet">Start one below and send its link round.</EmptyState>
        ) : (
          <ul aria-label="Your groups" className="flex flex-col gap-4">
            {load.groups.map((g) => (
              <li key={g.id}>
                <GroupCard group={g} owner={g.owner === load.me} me={load.me} onChanged={reload} />
              </li>
            ))}
          </ul>
        ))}
      <NewGroup onCreated={reload} />
    </>
  );
}

function Invites({ onAnswered }: { onAnswered: () => void }) {
  const { items, answer } = useNotifications();
  const toast = useToast();
  const invites = items.filter((n) => n.type === "group_invite" && n.state === "pending" && n.group);
  if (invites.length === 0) return null;
  const reply = async (n: (typeof invites)[number], accept: boolean) => {
    try {
      await answer(n, accept);
      onAnswered();
    } catch (e) {
      toast(`That didn't go through: ${errorText(e)}`, "error");
    }
  };
  return (
    <Card as="section" tone="cloak" aria-labelledby="invites-title" className="flex flex-col gap-3">
      <h2 id="invites-title" className={EYEBROW}>
        Invites
      </h2>
      <ul className="flex flex-col gap-3">
        {invites.map((n) => (
          <li key={n.id} className="flex flex-wrap items-center gap-3">
            <Avatar name={n.from.name} picture={n.from.picture} size={36} />
            <span className="min-w-0 flex-1 text-parchment">
              <span className="text-bone">{n.from.name ?? "Someone"}</span> invited you to{" "}
              <span className="text-bone">{n.group?.name ?? "a group"}</span>
            </span>
            <span className="flex gap-2">
              <button type="button" onClick={() => void reply(n, true)} className={button("gold", "sm")}>
                Join
              </button>
              <button type="button" onClick={() => void reply(n, false)} className={button("outline", "sm")}>
                Decline
              </button>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

const FACES = 8;

function GroupCard({
  group: g,
  owner,
  me,
  onChanged,
}: {
  group: GroupDetail;
  owner: boolean;
  me: string | null;
  onChanged: () => void;
}) {
  const toast = useToast();
  const here = plays(g, "traitors");
  const start = async (app: "dwts" | "traitors", name: string) => {
    try {
      await setGroupShow(g.id, app, true);
      toast(`${g.name} is playing ${name}. Everyone in it has been told.`, "success");
      onChanged();
    } catch (e) {
      toast(`Couldn't start it: ${errorText(e)}`, "error");
    }
  };
  const others = showRows(g, me).filter((r) => r.app !== "traitors");
  const [leaving, setLeaving] = useState(false);
  const link = inviteLink(g.inviteCode);
  const more = g.members.length - FACES;

  const share = async () => {
    const text = `Join ${g.name} on Armchair Judge and call The Traitors with us.`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `Join ${g.name}`, text, url: link });
        return;
      } catch (e) {
        // Closing the share sheet isn't a failure.
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(link);
      toast("Invite link copied.", "success");
    } catch {
      toast("Couldn't copy the link. Press and hold it below to copy.", "error");
    }
  };
  const leave = async () => {
    try {
      await leaveGroup(g.id);
      toast(`You left ${g.name}.`, "success");
      onChanged();
    } catch (e) {
      toast(`Couldn't leave: ${errorText(e)}`, "error");
      setLeaving(false);
    }
  };

  return (
    <Card as="article" tartan id={`g-${g.id}`} aria-labelledby={`group-${g.id}`} className="flex scroll-mt-24 flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id={`group-${g.id}`} className={cn(HEADING, "text-xl")}>
          {g.name}
        </h2>
        <span className="text-sm text-ash">
          <span className="nums">{g.members.length}</span> {g.members.length === 1 ? "member" : "members"}
          {owner && " · yours"}
        </span>
      </div>
      <ul aria-label={`${g.name} members`} className="flex flex-wrap items-center gap-1.5">
        {g.members.slice(0, FACES).map((m) => (
          <li key={m.sub} title={m.name ?? "Member"}>
            <Avatar name={m.name} picture={m.picture} size={36} />
            <span className="sr-only">{m.name ?? "Member"}</span>
          </li>
        ))}
        {more > 0 && <li className="pl-1 text-sm text-ash nums">+{more}</li>}
      </ul>
      {owner && g.requests.length > 0 && <Requests group={g} onChanged={onChanged} />}
      {others.length > 0 && (
        <section aria-label={`${g.name} on other shows`} className="flex flex-col gap-2 border-t border-gilt/20 pt-3">
          <p className={EYEBROW}>On other shows</p>
          {others.map((r) => (
            <div key={r.app} className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="min-w-0 flex-1 text-parchment">
                <span className="text-bone">{r.name}</span>
                {" · "}
                {r.active ? `${r.playing} of ${g.members.length} playing` : "not playing yet"}
                {!r.youPlay && r.homeHref && (
                  <>
                    {" · "}
                    <a href={r.homeHref} className={cn(FOCUS, "rounded-sm text-gilt underline-offset-4 hover:underline")}>
                      start watching
                    </a>
                  </>
                )}
              </span>
              {r.active && r.groupHref ? (
                <a href={r.groupHref} className={button("outline", "sm")}>
                  Open in {r.app === "dwts" ? "DWTS" : r.name}
                </a>
              ) : (
                <button type="button" onClick={() => void start(r.app, r.name)} className={button("outline", "sm")}>
                  Start it with this group
                </button>
              )}
            </div>
          ))}
        </section>
      )}
      <div className="flex flex-col gap-2">
        <label htmlFor={`link-${g.id}`} className="text-sm text-ash">
          Invite link{g.approval && ", you approve who joins"}
        </label>
        <input
          id={`link-${g.id}`}
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className={cn(FOCUS, "min-h-11 w-full truncate rounded-sm border border-gilt/40 bg-night/70 px-3 text-parchment")}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {here ? (
          <Link href={`/leaderboard/?group=${encodeURIComponent(g.id)}`} className={button("primary", "sm")}>
            Group board
          </Link>
        ) : (
          <button type="button" onClick={() => void start("traitors", "The Traitors")} className={button("primary", "sm")}>
            Start The Traitors with this group
          </button>
        )}
        <button type="button" onClick={() => void share()} className={button("gold", "sm")}>
          Share invite
        </button>
        {leaving ? (
          <span role="group" aria-label={`Leave ${g.name}?`} className="flex gap-2">
            <button type="button" onClick={() => void leave()} className={button("blood", "sm")}>
              Leave {g.name}
            </button>
            <button type="button" onClick={() => setLeaving(false)} className={button("ghost", "sm")}>
              Stay
            </button>
          </span>
        ) : (
          <button type="button" onClick={() => setLeaving(true)} className={button("ghost", "sm")}>
            Leave
          </button>
        )}
      </div>
    </Card>
  );
}

function Requests({ group: g, onChanged }: { group: GroupDetail; onChanged: () => void }) {
  const toast = useToast();
  const decide = async (p: GroupPerson, approve: boolean) => {
    try {
      await manageGroup(g.id, { action: approve ? "approve" : "deny", sub: p.sub });
      onChanged();
    } catch (e) {
      toast(`That didn't go through: ${errorText(e)}`, "error");
    }
  };
  return (
    <section aria-label="Asking to join" className="flex flex-col gap-2 border-t border-gilt/20 pt-3">
      <p className={EYEBROW}>Asking to join</p>
      {g.requests.map((p) => (
        <div key={p.sub} className="flex flex-wrap items-center gap-3">
          <Avatar name={p.name} picture={p.picture} size={32} />
          <span className="min-w-0 flex-1 truncate text-bone">{p.name ?? "Someone"}</span>
          <button type="button" onClick={() => void decide(p, true)} className={button("gold", "sm")}>
            Let in
          </button>
          <button type="button" onClick={() => void decide(p, false)} className={button("outline", "sm")}>
            Turn away
          </button>
        </div>
      ))}
    </section>
  );
}

function NewGroup({ onCreated }: { onCreated: () => void }) {
  const id = useId();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      await createGroup(trimmed, "traitors");
      setName("");
      onCreated();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-2 border-t border-gilt/20 pt-4">
      <label htmlFor={id} className={EYEBROW}>
        Start a group
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={NAME_MAX}
          placeholder="Round table regulars"
          aria-invalid={error !== null}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(FOCUS, "min-h-11 min-w-0 flex-1 rounded-sm border border-gilt/40 bg-night/70 px-3 text-bone placeholder:text-ash")}
        />
        <button type="submit" disabled={busy} className={cn(button("gold"), "shrink-0")}>
          {busy ? "Starting..." : "Start"}
        </button>
      </div>
      {error !== null && (
        <p id={`${id}-error`} role="alert" className="text-sm text-blood-hi">
          {error}
        </p>
      )}
    </form>
  );
}
