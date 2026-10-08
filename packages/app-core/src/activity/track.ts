import { fetchAuthSession } from "aws-amplify/auth";

/**
 * First-party activity events, batched to /events/track (signed in) or
 * /events/anon (signed out). What is sent and why: docs/architecture/activity.md.
 * A signed-out browser with Do-Not-Track or Global Privacy Control sends nothing.
 */

export type ActivityApp = "dwts" | "traitors" | "hub";
export type ActivityKind = "view" | "action" | "error";
export type Props = Record<string, string | number | boolean>;

interface Pending {
  kind: ActivityKind;
  name: string;
  route: string;
  at: number;
  props?: Props;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
const BATCH = 25;
const DELAY_MS = 5000;
const IDLE_MS = 30 * 60 * 1000;
const DID_KEY = "armchair.did";
const SESSION_KEY = "armchair.session";

let app: ActivityApp | null = null;
let queue: Pending[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function randomId(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

function stored(storage: Storage, key: string): string {
  const id = storage.getItem(key) ?? randomId();
  storage.setItem(key, id);
  return id;
}

/** Per tab, renewed after 30 idle minutes. */
function session(): string {
  const now = Date.now();
  const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "null") as { id: string; last: number } | null;
  const id = saved && now - saved.last < IDLE_MS ? saved.id : randomId();
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id, last: now }));
  return id;
}

export function deviceClass(width: number): "phone" | "tablet" | "desktop" {
  if (width < 640) return "phone";
  return width < 1024 ? "tablet" : "desktop";
}

export function optedOut(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.doNotTrack === "1" || nav.globalPrivacyControl === true;
}

/** Only these query params survive; the server applies the same list. */
const KEEP = new Set(["season", "ep", "id", "tab", "show", "group"]);

export function currentRoute(): string {
  const params = new URLSearchParams(window.location.search);
  const kept = [...params].filter(([k]) => KEEP.has(k));
  return window.location.pathname + (kept.length ? `?${new URLSearchParams(kept)}` : "");
}

async function idToken(): Promise<string | null> {
  try {
    return (await fetchAuthSession()).tokens?.idToken?.toString() ?? null;
  } catch {
    // Amplify unconfigured (local dev without env) reads as signed out.
    return null;
  }
}

export async function flush(): Promise<void> {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!app || !queue.length || !API_URL) return;
  const events = queue.slice(0, BATCH);
  queue = queue.slice(BATCH);
  const token = await idToken();
  if (!token && optedOut()) return;
  const body = JSON.stringify({
    app,
    did: stored(localStorage, DID_KEY),
    session: session(),
    device: deviceClass(window.innerWidth),
    events,
  });
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = token;
  try {
    // keepalive lets a flush on pagehide outlive the page.
    await fetch(`${API_URL}/events/${token ? "track" : "anon"}`, { method: "POST", headers, body, keepalive: true });
  } catch {
    // Offline or blocked: the batch is dropped. Analytics never gets in the way of the app.
  }
  if (queue.length) await flush();
}

export function track(kind: ActivityKind, name: string, props?: Props): void {
  if (!app || typeof window === "undefined") return;
  queue.push({ kind, name, route: currentRoute(), at: Date.now(), ...(props ? { props } : {}) });
  if (queue.length >= BATCH) void flush();
  else timer ??= setTimeout(() => void flush(), DELAY_MS);
}

/** API writes become actions named for the endpoint: POST /scores/submit is scores_submit. */
export function trackRequest(path: string, method: string, status: number): void {
  const endpoint = path.split("?")[0].replace(/^\//, "").replaceAll("/", "_").replaceAll("-", "_");
  if (status >= 400) track("error", "api", { endpoint, status });
  else if (method !== "GET") track("action", endpoint);
}

const SITES: Record<string, ActivityApp> = {
  "armchairjudge.com": "hub",
  "dwts.armchairjudge.com": "dwts",
  "traitors.armchairjudge.com": "traitors",
};

/** Starts the queue for one site. Returns a cleanup for the listeners it adds. */
export function startActivity(name: ActivityApp): () => void {
  app = name;
  const onHide = () => {
    if (document.visibilityState === "hidden") void flush();
  };
  const onClick = (e: MouseEvent) => {
    const link = (e.target as Element | null)?.closest?.("a[href]");
    if (!link) return;
    const to = SITES[new URL((link as HTMLAnchorElement).href, window.location.href).hostname];
    if (to && to !== app) track("action", "app_switch", { to });
  };
  const onError = (e: ErrorEvent) => track("error", "js", { message: String(e.message).slice(0, 100) });
  document.addEventListener("visibilitychange", onHide);
  document.addEventListener("click", onClick, { capture: true });
  window.addEventListener("error", onError);
  return () => {
    document.removeEventListener("visibilitychange", onHide);
    document.removeEventListener("click", onClick, { capture: true });
    window.removeEventListener("error", onError);
  };
}

/** For tests. */
export function resetActivity(): void {
  app = null;
  queue = [];
  if (timer) clearTimeout(timer);
  timer = null;
}
