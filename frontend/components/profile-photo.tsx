"use client";

import { useRef, useState, type ChangeEvent } from "react";

import { Avatar } from "@/components/avatar";
import { AvatarCropper } from "@/components/avatar-cropper";
import type { AvatarKind } from "@/lib/api/client";
import { updateProfile, uploadAvatar, type MyProfile } from "@/lib/api/profile";
import { SECONDARY } from "@/lib/ui";

// Well past any phone photo; the cropper shrinks it to 512px before it leaves the device.
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

interface ProfilePhotoProps {
  me: MyProfile;
  onChange: (me: MyProfile) => void;
}

type Status = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; message: string };

/** The big avatar with its editor: pick Google, an upload or initials, or upload and crop a new one. */
export function ProfilePhoto({ me, onChange }: ProfilePhotoProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const toggle = useRef<HTMLButtonElement>(null);

  const choose = async (avatar: AvatarKind) => {
    setStatus({ kind: "saving" });
    try {
      onChange(await updateProfile({ avatar }));
      setStatus({ kind: "saved" });
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "Request failed" });
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
    onChange(await uploadAvatar(photo));
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
      <div className="flex items-end gap-3">
        <div className="rounded-full bg-gradient-to-br from-gold-light via-gold-deep to-gold p-[3px] shadow-[0_0_30px_-6px_rgb(232_194_104/0.6)]">
          <Avatar name={me.name} email={me.email} picture={me.picture} size={104} />
        </div>
        <button
          ref={toggle}
          type="button"
          aria-expanded={open}
          aria-controls="photo-editor"
          onClick={() => (open ? close() : setOpen(true))}
          className={`${SECONDARY} text-sm`}
        >
          <CameraIcon />
          <span className="ml-2">{open ? "Close" : "Change photo"}</span>
        </button>
      </div>

      {open && (
        <section
          id="photo-editor"
          aria-label="Profile photo"
          className="flex flex-col gap-4 rounded-xl border border-silver/15 bg-ballroom/60 p-4 animate-pop-in"
        >
          {file ? (
            <AvatarCropper file={file} onCancel={() => setFile(null)} onCropped={cropped} />
          ) : (
            <>
              <fieldset className="flex flex-col gap-2" disabled={status.kind === "saving"}>
                <legend className="mb-2 text-xs font-semibold tracking-[0.14em] text-silver-dim uppercase">Show</legend>
                {options.map((o) => (
                  <label
                    key={o.kind}
                    className="flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border border-silver/15 px-3 transition-colors hover:border-silver/30 hover:bg-silver/5 has-checked:border-gold/60 has-checked:bg-gold/10 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-gold-light"
                  >
                    <input
                      type="radio"
                      name="avatar"
                      value={o.kind}
                      checked={me.avatarKind === o.kind}
                      onChange={() => void choose(o.kind)}
                      className="radio-gold"
                    />
                    <span aria-hidden="true">
                      <Avatar name={me.name} email={me.email} picture={o.picture} size={36} />
                    </span>
                    <span className="text-sm text-pearl">{o.label}</span>
                  </label>
                ))}
              </fieldset>
              <div className="flex flex-col gap-1">
                <label
                  className={`${SECONDARY} cursor-pointer self-start has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-gold-light`}
                >
                  <input type="file" accept="image/*" onChange={pick} className="sr-only" />
                  Upload a new photo
                </label>
                <p className="text-xs text-silver-dim">Any photo. You&apos;ll frame it as a square next.</p>
              </div>
            </>
          )}
        </section>
      )}

      <p
        aria-live="polite"
        className={`min-h-5 text-sm ${status.kind === "error" ? "text-red-300" : "text-silver-dim"}`}
      >
        {status.kind === "saving" && "Saving..."}
        {status.kind === "saved" && "Photo updated."}
        {status.kind === "error" && `Couldn't update the photo: ${status.message}`}
      </p>
    </div>
  );
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path
        d="M3 7.5A1.5 1.5 0 0 1 4.5 6h2l1.2-2h4.6L13.5 6h2A1.5 1.5 0 0 1 17 7.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.5z"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="11" r="3" />
    </svg>
  );
}
