import { beforeEach, describe, expect, it, vi } from "vitest";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("../api/client", async (real) => ({ ...(await real<typeof import("../api/client")>()), request }));

import { ApiError } from "../api/client";
import { sealStore } from "./sealed";

const X = "dwts-35|6|tyler-cameron#1";
const Y = "dwts-35|6|amber-glenn#1";
const Z = "dwts-35|7|amber-glenn#1";

/** A server holding one user's seals, answering as /seals/* do. */
function server(initial: string[] = []) {
  let held = [...initial];
  const calls: { path: string; body: Record<string, unknown> | null }[] = [];
  request.mockImplementation(async (path: string, init?: RequestInit) => {
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;
    calls.push({ path, body });
    if (path.startsWith("/seals/seal")) held = [...new Set([...held, ...(body!.ids as string[])])];
    if (path.startsWith("/seals/reveal")) {
      held = body!.ids
        ? held.filter((id) => !(body!.ids as string[]).includes(id))
        : held.filter((id) => !id.startsWith(`${body!.season}|${body!.ep}|`));
    }
    return { app: "dwts", sealed: [...held].sort() };
  });
  return {
    calls,
    get held() {
      return held;
    },
    set held(next: string[]) {
      held = next;
    },
  };
}

const offline = () => request.mockRejectedValue(new TypeError("Failed to fetch"));

let n = 0;
// A fresh key each test: a store's state is its storage.
const store = () => sealStore(`t.sealed.${(n += 1)}`, "dwts");

beforeEach(() => {
  localStorage.clear();
  request.mockReset();
});

describe("sealStore", () => {
  it("seals at once and tells the server", async () => {
    const api = server();
    const s = store();
    s.seal(X);
    expect(s.ids()).toEqual([X]);
    await s.sync();
    expect(api.held).toEqual([X]);
    expect(api.calls[0]).toEqual({ path: "/seals/seal", body: { app: "dwts", ids: [X] } });
  });

  it("takes the server's list on sync: a reveal on another device turns it over here", async () => {
    const api = server();
    const s = store();
    s.seal(X);
    s.seal(Y);
    await s.sync();
    api.held = [Y];
    await s.sync();
    expect(s.ids()).toEqual([Y]);
  });

  it("picks up a seal made on another device", async () => {
    server([Z]);
    const s = store();
    await s.sync();
    expect(s.ids()).toEqual([Z]);
  });

  it("keeps seals made offline and sends them in order once back", async () => {
    offline();
    const s = store();
    s.seal(X);
    s.seal(Y);
    await s.reveal(X);
    expect(s.ids()).toEqual([Y]);
    const api = server();
    await s.sync();
    expect(api.calls.map((c) => c.path)).toEqual(["/seals/seal", "/seals/seal", "/seals/reveal", "/seals/list?app=dwts"]);
    expect(api.held).toEqual([Y]);
    expect(s.ids()).toEqual([Y]);
  });

  it("posts a device's old seals once, the first time it syncs", async () => {
    const key = `t.sealed.${(n += 1)}`;
    localStorage.setItem(key, JSON.stringify([X, Z]));
    const api = server();
    await sealStore(key, "dwts").sync();
    expect(api.calls[0]).toEqual({ path: "/seals/seal", body: { app: "dwts", ids: [X, Z] } });
    expect(api.held).toEqual([X, Z]);
    api.calls.length = 0;
    await sealStore(key, "dwts").sync();
    expect(api.calls.map((c) => c.path)).toEqual(["/seals/list?app=dwts"]);
  });

  it("reveals a card sealed on another device before this one has synced", async () => {
    const api = server([X]);
    const s = store();
    await s.reveal(X);
    expect(api.held).toEqual([]);
  });

  it("reveals a whole episode, every device's seals in it", async () => {
    const api = server([X, Y, Z]);
    const s = store();
    await s.revealEpisode("dwts-35", 6);
    expect(api.calls[0].body).toEqual({ app: "dwts", season: "dwts-35", ep: 6 });
    expect(api.held).toEqual([Z]);
    expect(s.ids()).toEqual([Z]);
  });

  it("drops a change the server refuses outright, and keeps one it may take later", async () => {
    request.mockRejectedValueOnce(new ApiError(400, "Not a dwts seal id"));
    const s = store();
    s.seal("bad");
    request.mockRejectedValueOnce(new ApiError(401, "Not signed in"));
    s.seal(X);
    await s.sync().catch(() => {});
    const api = server();
    await s.sync();
    expect(api.calls.map((c) => c.path)).toEqual(["/seals/seal", "/seals/list?app=dwts"]);
    expect(api.held).toEqual([X]);
  });
});
