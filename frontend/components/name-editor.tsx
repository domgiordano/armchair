"use client";

import { useRef, useState, type FormEvent } from "react";

import { updateProfile, type MyProfile } from "@/lib/api/profile";
import { PRIMARY, SECONDARY } from "@/lib/ui";

export const NAME_MIN = 2;
export const NAME_MAX = 40;

interface NameEditorProps {
  me: MyProfile;
  onChange: (me: MyProfile) => void;
}

/** The display name as the page heading, with an inline form to change it. */
export function NameEditor({ me, onChange }: NameEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const edit = useRef<HTMLButtonElement>(null);

  const open = () => {
    setDraft(me.name ?? "");
    setError(null);
    setEditing(true);
  };
  const close = () => {
    setEditing(false);
    // The button is back in the DOM only after this render.
    requestAnimationFrame(() => edit.current?.focus());
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const name = draft.trim();
    if (name.length < NAME_MIN || name.length > NAME_MAX) {
      setError(`Use ${NAME_MIN} to ${NAME_MAX} characters.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onChange(await updateProfile({ name }));
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  if (!editing) {
    return (
      <div className="flex min-w-0 items-center gap-1">
        <h1 className="truncate text-2xl font-semibold tracking-tight">{me.name ?? "No name yet"}</h1>
        <button
          ref={edit}
          type="button"
          onClick={open}
          aria-label="Edit display name"
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 active:bg-neutral-700"
        >
          <PencilIcon />
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => void submit(e)}
      onKeyDown={(e) => e.key === "Escape" && !busy && close()}
      className="flex flex-col gap-2"
      noValidate
    >
      <label className="flex flex-col gap-1 text-sm text-neutral-300">
        Display name
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={NAME_MAX}
          aria-describedby="name-help"
          aria-invalid={error !== null}
          className="min-h-11 rounded-md border border-neutral-700 bg-neutral-900 px-3 text-base text-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 aria-invalid:border-amber-300"
        />
      </label>
      <p id="name-help" className="text-xs text-neutral-400">
        What friends see on the scorecard and leaderboards. {NAME_MIN} to {NAME_MAX} characters.
      </p>
      {error !== null && (
        <p role="alert" className="text-sm text-amber-200">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={PRIMARY}>
          {busy ? "Saving..." : "Save"}
        </button>
        <button type="button" onClick={close} disabled={busy} className={SECONDARY}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function PencilIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className="size-4.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
    >
      <path d="M12.9 3.6a1.8 1.8 0 0 1 2.5 2.5L7 14.5 3.8 15.2l.7-3.2z" strokeLinejoin="round" />
      <path d="m11.5 5 2.5 2.5" />
    </svg>
  );
}
