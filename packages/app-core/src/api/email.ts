import { request } from "./client";

/** Every email type, as the backend names them (common/email_prefs.py TYPES). */
export type EmailType =
  | "dwts.tonight"
  | "dwts.closing"
  | "dwts.digest"
  | "traitors.tonight"
  | "traitors.digest"
  | "social"
  | "groups";

export interface EmailSettings {
  address: string | null;
  prefs: Record<EmailType, boolean>;
  /** Whether the first-run "we'll email you" notice was dismissed. */
  noticeSeen: boolean;
  /** SES reported the address bouncing or complaining: nothing reaches it. */
  suppressed: boolean;
}

export const getEmailSettings = () => request<EmailSettings>("/email/prefs");

export const setEmailSettings = (change: { prefs?: Partial<Record<EmailType, boolean>>; noticeSeen?: true }) =>
  request<EmailSettings>("/email/prefs-set", { method: "POST", body: JSON.stringify(change) });
