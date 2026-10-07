import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchAuthSession } = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_URL = "https://api.test";
  return { fetchAuthSession: vi.fn() };
});
vi.mock("aws-amplify/auth", () => ({ fetchAuthSession }));

import { ApiError, deleteAccount, getMe } from "./client";

function respond(status: number, body: unknown) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  fetchAuthSession.mockResolvedValue({
    tokens: {
      idToken: { toString: () => "id-token", payload: { sub: "u1" } },
      accessToken: { toString: () => "access-token" },
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchAuthSession.mockReset();
});

describe("api client", () => {
  it("getMe sends the ID token and returns the envelope data", async () => {
    const me = {
      sub: "abc",
      email: "viewer@example.com",
      name: "Viewer",
      picture: null,
      avatarKind: "initials",
      createdAt: "2026-09-30T12:00:00+00:00",
      lastSeenAt: "2026-09-30T12:00:00+00:00",
    };
    const fetchMock = respond(200, { data: me, error: null, meta: null });

    await expect(getMe()).resolves.toEqual(me);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.test/users/me");
    expect(new Headers(init.headers).get("Authorization")).toBe("id-token");
  });

  it("deleteAccount posts to /users/delete", async () => {
    const fetchMock = respond(200, { data: { ok: true }, error: null, meta: null });

    await expect(deleteAccount()).resolves.toEqual({ ok: true });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.test/users/delete");
    expect(init.method).toBe("POST");
  });

  it("throws the envelope error", async () => {
    respond(500, { data: null, error: { handler: "users_me", message: "Internal error" }, meta: null });

    const err = await getMe().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 500, message: "Internal error" });
  });

  it("throws on an authorizer rejection, which is not an envelope", async () => {
    respond(401, { message: "Unauthorized" });

    await expect(getMe()).rejects.toMatchObject({ status: 401, message: "Request failed (401)" });
  });

  it("throws without calling the API when signed out", async () => {
    fetchAuthSession.mockResolvedValue({ tokens: undefined });
    const fetchMock = respond(200, {});

    await expect(getMe()).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
