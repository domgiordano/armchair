"use client";

import { useId, useState, type ReactNode } from "react";

import {
  deleteUser,
  getAnswers,
  SCREENS,
  setAnswer,
  setFriendship,
  setMembership,
  setProfile,
  viewAs,
  type Answer,
  type Answers,
  type Screen,
  type UserDetail,
  type UserFriend,
  type UserGroup,
  type ViewAs,
} from "@/lib/api/admin";
import { message } from "@/lib/load";

import { INPUT, PRIMARY, QUIET, SECONDARY } from "../account/ui";
import { CARD } from "./parts";

const DANGER = `${PRIMARY} bg-magenta text-text hover:bg-magenta/80`;

interface ActionProps {
  label: string;
  /** Shown above the reason: what this will do, and any extra inputs. */
  children?: ReactNode;
  /** False keeps the confirm button disabled until the extra inputs are filled. */
  ready?: boolean;
  danger?: boolean;
  run: (reason: string) => Promise<unknown>;
  onDone: () => void;
}

/**
 * One support action: a button that opens a short form asking why. Every action
 * the API takes needs a reason for the audit log, so the form can't be skipped.
 */
export function Action({ label, children, ready = true, danger = false, run, onDone }: ActionProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${danger ? `${SECONDARY} border-magenta/50 text-magenta` : SECONDARY} self-start`}
      >
        {label}
      </button>
    );
  }
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await run(reason.trim());
      setOpen(false);
      setReason("");
      onDone();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="flex w-full flex-col gap-3 rounded-2xl border border-line bg-night/70 p-4"
      aria-label={label}
    >
      {children}
      <label htmlFor={id} className="text-sm text-muted">
        Reason (kept in the audit log)
      </label>
      <textarea
        id={id}
        value={reason}
        maxLength={300}
        rows={2}
        onChange={(e) => setReason(e.target.value)}
        className={`${INPUT} py-2`}
      />
      {error && (
        <p role="alert" className="text-sm text-magenta">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy || !ready || !reason.trim()} className={danger ? DANGER : PRIMARY}>
          {busy ? "Working..." : label}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={QUIET}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function ProfileTools({
  profile,
  onDone,
  onDeleted,
}: {
  profile: UserDetail["profile"];
  onDone: () => void;
  onDeleted: () => void;
}) {
  const [name, setName] = useState(profile.customName ?? profile.name ?? "");
  const [email, setEmail] = useState("");
  const nameId = useId();
  const emailId = useId();
  return (
    <section aria-labelledby="tools-title" className={`${CARD} flex flex-col gap-4`}>
      <h2 id="tools-title" className="text-lg font-bold">
        Support
      </h2>
      <div className="flex flex-wrap items-start gap-2">
        <Action
          label="Rename"
          ready={name.trim().length >= 2}
          run={(r) => setProfile(profile.sub, r, { name: name.trim() })}
          onDone={onDone}
        >
          <label htmlFor={nameId} className="text-sm text-muted">
            Display name
          </label>
          <input id={nameId} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} className={INPUT} />
        </Action>
        {profile.customName && (
          <Action label="Use Google name" run={(r) => setProfile(profile.sub, r, { name: null })} onDone={onDone}>
            <p className="text-sm">
              Drops &ldquo;{profile.customName}&rdquo; for {profile.googleName ?? "their Google name"}.
            </p>
          </Action>
        )}
        <Action label="Reset photo" run={(r) => setProfile(profile.sub, r, { resetAvatar: true })} onDone={onDone}>
          <p className="text-sm">Deletes any uploaded photo and goes back to their Google picture or initials.</p>
        </Action>
        <Action
          label="Delete account"
          danger
          ready={email.trim().toLowerCase() === profile.email.toLowerCase()}
          run={(r) => deleteUser(profile.sub, r, email)}
          onDone={onDeleted}
        >
          <p className="text-sm">
            Deletes their profile, scores, picks, groups they alone are in, friends, activity and sign-in. This can&rsquo;t be
            undone.
          </p>
          <label htmlFor={emailId} className="text-sm text-muted">
            Type {profile.email} to confirm
          </label>
          <input id={emailId} value={email} autoComplete="off" onChange={(e) => setEmail(e.target.value)} className={INPUT} />
        </Action>
      </div>
    </section>
  );
}

export function GroupActions({ sub, group, onDone }: { sub: string; group: UserGroup; onDone: () => void }) {
  const act = (action: "remove" | "repair" | "resend") => (r: string) => setMembership(sub, group.id, action, r);
  return (
    <div className="flex flex-wrap gap-2">
      {(!group.exists || !group.member) && (
        <Action label="Repair" run={act("repair")} onDone={onDone}>
          <p className="text-sm">
            {group.exists ? "Writes the missing member row, keeping when they joined." : "Drops their link to the deleted group."}
          </p>
        </Action>
      )}
      {group.exists && !group.owner && (
        <Action label="Remove" run={act("remove")} onDone={onDone}>
          <p className="text-sm">Takes them out of {group.name}.</p>
        </Action>
      )}
    </div>
  );
}

export function AddToGroup({ sub, onDone }: { sub: string; onDone: () => void }) {
  const [group, setGroup] = useState("");
  const [action, setAction] = useState<"add" | "resend">("add");
  const id = useId();
  const valid = /^[A-Za-z0-9_-]{12}$/.test(group.trim());
  return (
    <Action label="Add to a group" ready={valid} run={(r) => setMembership(sub, group.trim(), action, r)} onDone={onDone}>
      <label htmlFor={id} className="text-sm text-muted">
        Group id (12 characters, from the group&rsquo;s page or link)
      </label>
      <input id={id} value={group} onChange={(e) => setGroup(e.target.value)} className={INPUT} />
      <fieldset className="flex flex-wrap gap-4 text-sm">
        <legend className="sr-only">How</legend>
        <label className="flex items-center gap-2">
          <input type="radio" checked={action === "add"} onChange={() => setAction("add")} /> Add them now
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" checked={action === "resend"} onChange={() => setAction("resend")} /> Send a fresh invite
        </label>
      </fieldset>
    </Action>
  );
}

export function FriendActions({ sub, friend, onDone }: { sub: string; friend: UserFriend; onDone: () => void }) {
  if (friend.status === "blocked") {
    return (
      <Action label="Unblock" run={(r) => setFriendship(sub, friend.sub, "unblock", r)} onDone={onDone}>
        <p className="text-sm">Clears the block both ways. Either can send a request again.</p>
      </Action>
    );
  }
  return (
    <Action
      label={friend.status === "friend" ? "Unfriend" : "Cancel request"}
      run={(r) => setFriendship(sub, friend.sub, "unlink", r)}
      onDone={onDone}
    />
  );
}

const describe = (a: Answer | null) => {
  if (!a) return "No answer";
  if (a.forfeit) return "Revealed without answering";
  if (a.picks) return a.picks.join(", ");
  return `Scored ${a.value}`;
};

const STATE: Record<Answers["state"], string> = {
  live: "Taking answers",
  closed: "Closed: changes need an override",
  upcoming: "Not aired yet: nothing to fix",
};

export function AnswerFixer({ sub }: { sub: string }) {
  const [season, setSeason] = useState("dwts-35");
  const [ep, setEp] = useState("");
  const [answers, setAnswers] = useState<Answers | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seasonId = useId();
  const epId = useId();
  const load = async () => {
    setError(null);
    try {
      setAnswers(await getAnswers(sub, season.trim(), ep.trim()));
    } catch (e) {
      setAnswers(null);
      setError(message(e));
    }
  };
  return (
    <section aria-labelledby="fix-title" className={`${CARD} flex flex-col gap-4`}>
      <div>
        <h2 id="fix-title" className="text-lg font-bold">
          Fix a score or pick
        </h2>
        <p className="text-xs text-muted">Only this user&rsquo;s own answers. Nobody else&rsquo;s and no results are shown.</p>
      </div>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
      >
        <span className="flex flex-col gap-1">
          <label htmlFor={seasonId} className="text-sm text-muted">
            Season
          </label>
          <input
            id={seasonId}
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            className={`${INPUT} w-36`}
            placeholder="dwts-35"
          />
        </span>
        <span className="flex flex-col gap-1">
          <label htmlFor={epId} className="text-sm text-muted">
            Episode
          </label>
          <input
            id={epId}
            value={ep}
            inputMode="numeric"
            onChange={(e) => setEp(e.target.value)}
            className={`${INPUT} w-24`}
            placeholder="04"
          />
        </span>
        <button type="submit" disabled={!season.trim() || !ep.trim()} className={SECONDARY}>
          Load answers
        </button>
      </form>
      {error && (
        <p role="alert" className="text-sm text-magenta">
          {error}
        </p>
      )}
      {answers && (
        <>
          <p className={`text-sm ${answers.state === "live" ? "text-gold" : "text-muted"}`}>
            {answers.season} episode {answers.ep}: {STATE[answers.state]}
          </p>
          <ul className="flex flex-col divide-y divide-line/70">
            {answers.slots.map((slot) => (
              <li key={slot.key} className="flex flex-col gap-2 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">{slot.label}</span>
                  <span className="text-sm text-muted">
                    {describe(slot.answer)}
                    {slot.answer?.adminBy && " · set by an admin"}
                  </span>
                </div>
                {answers.state !== "upcoming" && <SlotFix sub={sub} answers={answers} slot={slot} onDone={() => void load()} />}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function SlotFix({
  sub,
  answers,
  slot,
  onDone,
}: {
  sub: string;
  answers: Answers;
  slot: Answers["slots"][number];
  onDone: () => void;
}) {
  const [mode, setMode] = useState<"set" | "forfeit" | "clear">("set");
  const [value, setValue] = useState(String(slot.answer?.value ?? 7));
  const [picks, setPicks] = useState<string[]>(slot.answer?.picks ?? Array.from({ length: slot.picks ?? 0 }, () => ""));
  const [confirm, setConfirm] = useState("");
  const closed = answers.state === "closed";
  const traitors = answers.app === "traitors";
  const filled = !traitors || mode !== "set" || (picks.every(Boolean) && new Set(picks).size === picks.length);
  const run = (reason: string) =>
    setAnswer({
      sub,
      season: answers.season,
      ep: String(answers.ep),
      key: slot.key,
      reason,
      ...(mode === "clear"
        ? { clear: true }
        : mode === "forfeit"
          ? { forfeit: true }
          : traitors
            ? { picks }
            : { value: Number(value) }),
      ...(closed ? { override: true, confirm } : {}),
    });
  return (
    <Action label="Fix" ready={filled && (!closed || confirm === "OVERRIDE")} run={run} onDone={onDone}>
      <fieldset className="flex flex-wrap gap-4 text-sm">
        <legend className="mb-1 text-muted">Set their answer to</legend>
        <label className="flex items-center gap-2">
          <input type="radio" checked={mode === "set"} onChange={() => setMode("set")} /> {traitors ? "Picks" : "A score"}
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" checked={mode === "forfeit"} onChange={() => setMode("forfeit")} /> Revealed
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" checked={mode === "clear"} onChange={() => setMode("clear")} /> No answer
        </label>
      </fieldset>
      {mode === "set" && !traitors && (
        <label className="flex items-center gap-2 text-sm">
          Score
          <select value={value} onChange={(e) => setValue(e.target.value)} className={`${INPUT} w-24`}>
            {Array.from({ length: 10 }, (_, i) => (
              <option key={i + 1}>{i + 1}</option>
            ))}
          </select>
        </label>
      )}
      {mode === "set" &&
        traitors &&
        picks.map((p, i) => (
          <label key={i} className="flex items-center gap-2 text-sm whitespace-nowrap">
            Pick {i + 1}
            <select
              value={p}
              onChange={(e) => setPicks((all) => all.map((x, j) => (j === i ? e.target.value : x)))}
              className={INPUT}
            >
              <option value="">Choose a player</option>
              {answers.roster?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        ))}
      {closed && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-magenta">This episode is closed. Type OVERRIDE to change it anyway.</span>
          <input value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" className={INPUT} />
        </label>
      )}
    </Action>
  );
}

const SCREEN_PARAMS: Partial<Record<Screen, ("season" | "ep")[]>> = {
  overview: ["season"],
  profile: ["season"],
  episode: ["season", "ep"],
  stats: ["season"],
  leaderboard: ["season"],
  week_board: ["season", "ep"],
  performers: ["season"],
  traitors_season: ["season"],
  traitors_episode: ["season", "ep"],
  traitors_stats: ["season"],
};

export function ViewAsPanel({ sub }: { sub: string }) {
  const [screen, setScreen] = useState<Screen>("overview");
  const [season, setSeason] = useState("dwts-35");
  const [ep, setEp] = useState("");
  const [result, setResult] = useState<ViewAs | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const wants = SCREEN_PARAMS[screen] ?? [];
  const screenId = useId();
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (wants.includes("season")) params.season = season.trim();
      if (wants.includes("ep")) params.ep = ep.trim();
      setResult(await viewAs(sub, screen, params));
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section aria-labelledby="viewas-title" className={`${CARD} flex flex-col gap-4`}>
      <div>
        <h2 id="viewas-title" className="text-lg font-bold">
          See what they see
        </h2>
        <p className="text-xs text-muted">
          Read-only: the screen&rsquo;s own data as the app sends it to them. Nothing is written.
        </p>
      </div>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <span className="flex flex-col gap-1">
          <label htmlFor={screenId} className="text-sm text-muted">
            Screen
          </label>
          <select id={screenId} value={screen} onChange={(e) => setScreen(e.target.value as Screen)} className={`${INPUT} w-48`}>
            {SCREENS.map((s) => (
              <option key={s} value={s}>
                {s.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </span>
        {wants.includes("season") && (
          <label className="flex flex-col gap-1 text-sm text-muted">
            Season
            <input value={season} onChange={(e) => setSeason(e.target.value)} className={`${INPUT} w-36`} />
          </label>
        )}
        {wants.includes("ep") && (
          <label className="flex flex-col gap-1 text-sm text-muted">
            Episode
            <input value={ep} onChange={(e) => setEp(e.target.value)} className={`${INPUT} w-24`} />
          </label>
        )}
        <button type="submit" disabled={busy} className={SECONDARY}>
          {busy ? "Loading..." : "View"}
        </button>
      </form>
      {error && (
        <p role="alert" className="text-sm text-magenta">
          {error}
        </p>
      )}
      {result && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted">
            {result.screen.replaceAll("_", " ")} answered {result.status}
            {result.error && `: ${result.error.message}`}
          </p>
          <pre className="max-h-96 overflow-auto rounded-2xl border border-line bg-night/70 p-4 text-xs text-muted">
            {JSON.stringify(result.data, null, 2)}
          </pre>
        </div>
      )}
    </section>
  );
}
