"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { EmailSettings } from "@/components/profile/email-settings";
import { message } from "@/components/social/parts";
import { Input } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { deleteAccount } from "@armchair/app-core/api/client";
import { useAuth } from "@armchair/app-core/auth/use-auth";
import { button, EYEBROW } from "@/lib/ui";

const CONFIRM = "DELETE";

/** Your own account's settings, at the bottom of your profile. The account menu links to #settings. */
export function AccountSettings() {
  const ref = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);

  // The profile renders after its fetch, too late for the browser's own jump to the hash.
  useEffect(() => {
    if (window.location.hash === "#settings") ref.current?.scrollIntoView();
  }, []);

  return (
    <section
      ref={ref}
      id="settings"
      aria-labelledby="settings-heading"
      className="flex scroll-mt-24 flex-col items-start gap-3 border-t border-silver/10 pt-6"
    >
      <h2 id="settings-heading" className={EYEBROW}>
        Settings
      </h2>
      <EmailSettings />
      <p className="mt-4 text-sm text-silver-dim">Delete your account and everything you&apos;ve scored. This can&apos;t be undone.</p>
      <button type="button" onClick={() => setOpen(true)} className={button("danger")}>
        Delete account
      </button>
      <DeleteAccountSheet open={open} onClose={() => setOpen(false)} />
    </section>
  );
}

function DeleteAccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const { signOut } = useAuth();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  const close = () => {
    setTyped("");
    onClose();
  };

  const confirm = async () => {
    setBusy(true);
    try {
      await deleteAccount();
    } catch (e) {
      toast(message(e), "error");
      setBusy(false);
      return;
    }
    // The ID token outlives the deleted user, so drop it before leaving.
    await signOut();
    router.push("/");
  };

  return (
    <Sheet open={open} onClose={close} label="Delete your account?">
      <div className="flex flex-col gap-5 text-left">
        <div className="flex flex-col gap-1 pr-10">
          <h2 className="text-lg font-semibold text-pearl">Delete your account?</h2>
          <p className="text-sm text-silver-dim">This can&apos;t be undone. It removes:</p>
        </div>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-silver">
          <li>Every score and Traitors pick, and your place on every leaderboard</li>
          <li>Your friends, requests and notifications</li>
          <li>Your group memberships. A group you own passes to the member who joined first, or is deleted if no one else is in it</li>
          <li>Your profile and photo, and your sign-in</li>
        </ul>
        <Input
          label={`Type ${CONFIRM} to confirm`}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
        />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={close} className={button("secondary")}>
            Keep my account
          </button>
          <button
            type="button"
            disabled={busy || typed.trim() !== CONFIRM}
            onClick={() => void confirm()}
            className={button("danger")}
          >
            {busy ? "Deleting..." : "Delete account"}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
