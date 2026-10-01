import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchAuthSession } = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_URL = "https://api.test";
  return { fetchAuthSession: vi.fn() };
});
vi.mock("aws-amplify/auth", () => ({ fetchAuthSession }));

import { getProfile, uploadAvatar } from "./profile";

const envelope = (data: unknown) => new Response(JSON.stringify({ data, error: null, meta: null }));

beforeEach(() => {
  fetchAuthSession.mockResolvedValue({ tokens: { idToken: { toString: () => "id-token", payload: { sub: "u1" } } } });
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchAuthSession.mockReset();
});

describe("profile api", () => {
  it("asks for someone else's profile by sub and season", async () => {
    const fetchMock = vi.fn(async () => envelope({ sub: "b" }));
    vi.stubGlobal("fetch", fetchMock);
    await getProfile("dwts-35", "b");
    expect(fetchMock).toHaveBeenCalledWith("https://api.test/users/get?season=dwts-35&sub=b", expect.anything());
  });

  it("uploads to S3 with the policy fields before the file, then points the avatar at the key", async () => {
    const post = {
      key: "avatars/a/0123.jpg",
      url: "https://bucket.s3.amazonaws.com/",
      fields: { key: "avatars/a/0123.jpg", "Content-Type": "image/jpeg", policy: "p" },
      maxBytes: 2097152,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(envelope(post))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(envelope({ sub: "a", avatarKind: "upload" }));
    vi.stubGlobal("fetch", fetchMock);

    const photo = new Blob(["jpeg"], { type: "image/jpeg" });
    await expect(uploadAvatar(photo)).resolves.toMatchObject({ avatarKind: "upload" });

    const [presign, s3, update] = fetchMock.mock.calls as [string, RequestInit][];
    expect(presign[0]).toBe("https://api.test/users/avatar-upload");
    expect(JSON.parse(presign[1].body as string)).toEqual({ contentType: "image/jpeg" });

    expect(s3[0]).toBe(post.url);
    const form = s3[1].body as FormData;
    expect([...form.keys()]).toEqual(["key", "Content-Type", "policy", "file"]);
    // S3 authorizes the POST from the policy; our ID token must not go to AWS.
    expect(s3[1].headers).toBeUndefined();

    expect(update[0]).toBe("https://api.test/users/update");
    expect(update[1].method).toBe("PATCH");
    expect(JSON.parse(update[1].body as string)).toEqual({ uploadKey: post.key });
  });

  it("stops when S3 refuses the file", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(envelope({ key: "k", url: "https://s3", fields: {}, maxBytes: 1 }))
      .mockResolvedValueOnce(new Response("<Error/>", { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(uploadAvatar(new Blob(["x"], { type: "image/jpeg" }))).rejects.toMatchObject({ status: 400 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
