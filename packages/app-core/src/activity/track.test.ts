import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchAuthSession } = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_URL = "https://api.test";
  return { fetchAuthSession: vi.fn() };
});
vi.mock("aws-amplify/auth", () => ({ fetchAuthSession }));

import { deviceClass, flush, resetActivity, startActivity, track, trackRequest } from "./track";

let fetchMock: ReturnType<typeof vi.spyOn<typeof globalThis, "fetch">>;
let stop: () => void;

function signedIn() {
  fetchAuthSession.mockResolvedValue({ tokens: { idToken: { toString: () => "id-token" } } });
}

function signedOut() {
  fetchAuthSession.mockResolvedValue({ tokens: undefined });
}

function sent(): { url: string; init: RequestInit; body: Record<string, unknown> }[] {
  return fetchMock.mock.calls.map(([url, init]) => ({
    url: url as string,
    init: init as RequestInit,
    body: JSON.parse((init as RequestInit).body as string),
  }));
}

function setDnt(value: string | null) {
  Object.defineProperty(navigator, "doNotTrack", { value, configurable: true });
}

beforeEach(() => {
  fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("{}", { status: 200 }));
  localStorage.clear();
  sessionStorage.clear();
  setDnt(null);
  window.history.replaceState(null, "", "/episode/?season=dwts-35&ep=02&code=SECRET");
  stop = startActivity("dwts");
});

afterEach(() => {
  stop();
  resetActivity();
  fetchMock.mockRestore();
  fetchAuthSession.mockReset();
});

describe("activity tracking", () => {
  it("sends a signed-in batch to /events/track with the token and a stable device id", async () => {
    signedIn();
    track("view", "page");
    track("action", "share", { via: "copy" });
    await flush();
    track("view", "page");
    await flush();

    const [first, second] = sent();
    expect(first.url).toBe("https://api.test/events/track");
    expect(new Headers(first.init.headers).get("Authorization")).toBe("id-token");
    expect(first.init.keepalive).toBe(true);
    expect(first.body).toMatchObject({ app: "dwts", device: "desktop" });
    expect(first.body.events).toEqual([
      expect.objectContaining({ kind: "view", name: "page", route: "/episode/?season=dwts-35&ep=02" }),
      expect.objectContaining({ kind: "action", name: "share", props: { via: "copy" } }),
    ]);
    expect(second.body.did).toBe(first.body.did);
    expect(second.body.session).toBe(first.body.session);
  });

  it("sends a signed-out batch to /events/anon with no token", async () => {
    signedOut();
    track("view", "page");
    await flush();
    const [only] = sent();
    expect(only.url).toBe("https://api.test/events/anon");
    expect(new Headers(only.init.headers).has("Authorization")).toBe(false);
  });

  it("sends nothing for a signed-out visitor with Do-Not-Track on", async () => {
    signedOut();
    setDnt("1");
    track("view", "page");
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("still tracks a signed-in visitor with Do-Not-Track on, under their account", async () => {
    signedIn();
    setDnt("1");
    track("view", "page");
    await flush();
    expect(sent()[0].url).toBe("https://api.test/events/track");
  });

  it("names API writes for their endpoint and reports API failures as errors", async () => {
    signedIn();
    trackRequest("/scores/submit", "POST", 200);
    trackRequest("/scores/reveal-all", "POST", 200);
    trackRequest("/overview/get?season=dwts-35", "GET", 200);
    trackRequest("/groups/join", "POST", 404);
    await flush();
    expect(sent()[0].body.events).toEqual([
      expect.objectContaining({ kind: "action", name: "scores_submit" }),
      expect.objectContaining({ kind: "action", name: "scores_reveal_all" }),
      expect.objectContaining({ kind: "error", name: "api", props: { endpoint: "groups_join", status: 404 } }),
    ]);
  });

  it("records a click through to another Armchair site as an app switch", async () => {
    signedIn();
    const link = document.createElement("a");
    link.href = "https://traitors.armchairjudge.com/?sso=1";
    link.addEventListener("click", (e) => e.preventDefault());
    document.body.append(link);
    link.click();
    link.remove();
    await flush();
    expect(sent()[0].body.events).toEqual([expect.objectContaining({ name: "app_switch", props: { to: "traitors" } })]);
  });

  it("splits more than 25 events into batches", async () => {
    signedIn();
    for (let i = 0; i < 30; i++) track("view", "page");
    await flush();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(sent().map((s) => (s.body.events as unknown[]).length)).toEqual([25, 5]);
  });

  it("classes devices by viewport width", () => {
    expect([deviceClass(390), deviceClass(800), deviceClass(1280)]).toEqual(["phone", "tablet", "desktop"]);
  });
});
