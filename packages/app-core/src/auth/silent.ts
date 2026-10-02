const KEY = "armchair.silent";

/** Marks the coming redirect as a prompt=none attempt, so its failure isn't shown as an error. */
export function markSilent(): void {
  try {
    window.sessionStorage.setItem(KEY, "1");
  } catch {
    // Storage disabled: a failed silent attempt shows the error page instead.
  }
}

/** Whether the redirect that just came back was silent; reading it clears it. */
export function takeSilent(): boolean {
  try {
    const silent = window.sessionStorage.getItem(KEY) === "1";
    window.sessionStorage.removeItem(KEY);
    return silent;
  } catch {
    return false;
  }
}
