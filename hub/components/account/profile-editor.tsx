"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";

import type { AvatarKind } from "@/lib/api/client";
import { updateProfile, uploadAvatar, type MyProfile } from "@/lib/api/profile";
import { setMe } from "@/lib/me";

import { AvatarCropper } from "./avatar-cropper";
import { Avatar, FOCUS, INPUT, PRIMARY, SECONDARY } from "./ui";

// The DWTS profile page's editors (frontend/components/profile-photo.tsx,
// name-editor.tsx), on the same /users endpoints.

// Well past any phone photo; the cropper shrinks it to 512px before it leaves the device.
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
export const NAME_MIN = 2;
export const NAME_MAX = 40;

type Status = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; message: string };

const errorText = (err: unknown) => (err instanceof Error ? err.message : "Request failed");

export function ProfilePhoto({ me }: { me: MyProfile }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const toggle = useRef<HTMLButtonElement>(null);

  const choose = async (avatar: AvatarKind) => {
    setStatus({ kind: "saving" });
    try {
      setMe(await updateProfile({ avatar }));
      setStatus({ kind: "saved" });
    } catch (err) {
      setStatus({ kind: "error", message: errorText(err) });
    }
  };

  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    // Cleared so picking the same file again still fires change.
    e.target.value = "";
    if (!picked) return;
    if (!picked.type.startsWith("image/")) {
      setStatus({ kind: "error", message: "That file isn't a photo." });
      return;
    }
    if (picked.size > MAX_SOURCE_BYTES) {
      setStatus({ kind: "error", message: "That photo is over 25 MB. Try a smaller one." });
      return;
    }
    setStatus({ kind: "idle" });
    setFile(picked);
  };

  const cropped = async (photo: Blob) => {
    setMe(await uploadAvatar(photo));
    setFile(null);
    setStatus({ kind: "saved" });
  };

  const close = () => {
    setOpen(false);
    setFile(null);
    setStatus({ kind: "idle" });
    toggle.current?.focus();
  };

  const options: { kind: AvatarKind; label: string; picture: string | null }[] = [
    ...(me.googlePicture ? [{ kind: "google" as const, label: "Google photo", picture: me.googlePicture }] : []),
    ...(me.uploadPicture ? [{ kind: "upload" as const, label: "Your upload", picture: me.uploadPicture }] : []),
    { kind: "initials", label: "Initials", picture: null },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-4">
        <div className="rounded-full bg-linear-to-br from-blue via-magenta to-orange p-[3px] shadow-[0_0_40px_-8px_rgb(232_63_208/0.6)]">
          <Avatar name={me.name ?? me.email} picture={me.picture} size={112} />
        </div>
        <button
          ref={toggle}
          type="button"
          aria-expanded={open}
          aria-controls="photo-editor"
          onClick={() => (open ? close() : setOpen(true))}
          className={SECONDARY}
        >
          {open ? "Close" : "Change photo"}
        </button>
      </div>

      {open && (
        <section id="photo-editor" aria-label="Profile photo" className="account-pop flex flex-col gap-4 border-t border-line pt-4">
          {file ? (
            <AvatarCropper file={file} onCancel={() => setFile(null)} onCropped={cropped} />
          ) : (
            <>
              <fieldset className="flex flex-col gap-2" disabled={status.kind === "saving"}>
                <legend className="mb-2 text-xs font-semibold tracking-[0.2em] text-muted uppercase">Show</legend>
                {options.map((o) => (
                  <label
                    key={o.kind}
                    className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border border-line px-3 transition-colors hover:border-muted hover:bg-line/30 has-checked:border-gold has-checked:bg-gold/10 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-gold"
                  >
                    <input
                      type="radio"
                      name="avatar"
                      value={o.kind}
                      checked={me.avatarKind === o.kind}
                      onChange={() => void choose(o.kind)}
                      className="size-4 accent-gold"
                    />
                    <Avatar name={me.name ?? me.email} picture={o.picture} size={36} decorative />
                    <span className="text-sm text-text">{o.label}</span>
                  </label>
                ))}
              </fieldset>
              <div className="flex flex-col gap-1">
                <label className={`${SECONDARY} cursor-pointer self-start has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-gold`}>
                  <input type="file" accept="image/*" onChange={pick} className="sr-only" />
                  Upload a new photo
                </label>
                <p className="text-xs text-muted">Any photo. You&rsquo;ll frame it as a square next.</p>
              </div>
            </>
          )}
        </section>
      )}

      <p aria-live="polite" className={`min-h-5 text-sm ${status.kind === "error" ? "text-magenta" : "text-muted"}`}>
        {status.kind === "saving" && "Saving..."}
        {status.kind === "saved" && "Photo updated."}
        {status.kind === "error" && `Couldn't update the photo: ${status.message}`}
      </p>
    </div>
  );
}

/** The display name as the page heading, with an inline form to change it. */
export function NameEditor({ me }: { me: MyProfile }) {
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
      setMe(await updateProfile({ name }));
      close();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  if (!editing) {
    return (
      <div className="flex min-w-0 items-center gap-1">
        <h1 className="truncate text-3xl font-extrabold tracking-tight sm:text-4xl">{me.name ?? "No name yet"}</h1>
        <button
          ref={edit}
          type="button"
          onClick={open}
          aria-label="Edit display name"
          className={`flex size-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-line/60 hover:text-gold active:bg-line ${FOCUS}`}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4.5" fill="none" stroke="currentColor" strokeWidth={1.6}>
            <path d="M12.9 3.6a1.8 1.8 0 0 1 2.5 2.5L7 14.5 3.8 15.2l.7-3.2z" strokeLinejoin="round" />
            <path d="m11.5 5 2.5 2.5" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => void submit(e)}
      onKeyDown={(e) => e.key === "Escape" && !busy && close()}
      className="account-pop flex flex-col gap-2"
      noValidate
    >
      <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">
        Display name
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={NAME_MAX}
          aria-describedby="name-help"
          aria-invalid={error !== null}
          className={INPUT}
        />
      </label>
      <p id="name-help" className="text-xs text-muted">
        What friends see on scorecards and leaderboards in every show. {NAME_MIN} to {NAME_MAX} characters.
      </p>
      {error !== null && (
        <p role="alert" className="text-sm text-magenta">
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
