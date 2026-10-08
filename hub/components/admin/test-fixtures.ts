import type { ActivityEvent, AuditEntry, Overview, UserDetail, UserRow } from "@/lib/api/admin";

// Invented people and numbers for the console's tests and screenshots. No real user appears here.

export const ADMIN_EMAIL = "admin@example.com";
export const PAT = "3f1c2b9a-0000-4000-8000-00000000000a";
export const ROBIN = "3f1c2b9a-0000-4000-8000-00000000000b";
export const SAM = "3f1c2b9a-0000-4000-8000-00000000000c";

const weeks = ["07-20", "07-27", "08-03", "08-10", "08-17", "08-24", "08-31", "09-07", "09-14", "09-21", "09-28", "10-05"];

export const OVERVIEW: Overview = {
  since: "2026-09-08",
  totals: { users: 64, dau: 18, wau: 41, mau: 57, devices30: 83 },
  apps: {
    dwts: { dau: 15, wau: 36, mau: 52, devices30: 70, events30: 9120 },
    traitors: { dau: 7, wau: 19, mau: 24, devices30: 29, events30: 2210 },
    hub: { dau: 4, wau: 12, mau: 20, devices30: 31, events30: 640 },
  },
  weeks: weeks.map((w, i) => ({
    week: `2026-${w}`,
    active: i < 7 ? 0 : [22, 34, 39, 44, 41][i - 7],
    byApp: { dwts: i < 7 ? 0 : 30, traitors: i < 7 ? 0 : 12, hub: i < 7 ? 0 : 8 },
    signups: [0, 0, 0, 0, 1, 2, 3, 19, 21, 8, 6, 4][i],
    tracked: i >= 7,
  })),
  retention: [
    { cohort: "2026-08-17", size: 1, weeks: [null, null, null, 1, 1, 1, 1, 1] },
    { cohort: "2026-08-24", size: 2, weeks: [null, null, 0.5, 1, 0.5, 0.5, 0.5] },
    { cohort: "2026-08-31", size: 3, weeks: [null, 0.667, 0.667, 0.667, 0.333, 0.667] },
    { cohort: "2026-09-07", size: 19, weeks: [0.947, 0.842, 0.789, 0.737, 0.684] },
    { cohort: "2026-09-14", size: 21, weeks: [1, 0.857, 0.81, 0.714] },
    { cohort: "2026-09-21", size: 8, weeks: [1, 0.75, 0.625] },
    { cohort: "2026-09-28", size: 6, weeks: [1, 0.667] },
    { cohort: "2026-10-05", size: 4, weeks: [1] },
  ],
  funnel: { visitors: 83, signedIn: 57, answered: 49, signups: 18 },
  participation: [
    {
      season: "dwts-35",
      app: "dwts",
      episodes: [
        { ep: 1, title: null, users: 38, answers: 290, forfeits: 14 },
        { ep: 2, title: null, users: 41, answers: 301, forfeits: 9 },
        { ep: 3, title: null, users: 44, answers: 296, forfeits: 11 },
        { ep: 4, title: null, users: 40, answers: 270, forfeits: 7 },
      ],
    },
    {
      season: "tus-5",
      app: "traitors",
      episodes: [
        { ep: 2, title: "Ep 2", users: 17, answers: 48, forfeits: 3 },
        { ep: 3, title: "Ep 3", users: 19, answers: 55, forfeits: 2 },
      ],
    },
  ],
};

const row = (sub: string, name: string, email: string, n: number, extra: Partial<UserRow> = {}): UserRow => ({
  sub,
  name,
  email,
  picture: null,
  avatarKind: "initials",
  createdAt: "2026-09-10T20:00:00+00:00",
  lastSeenAt: "2026-10-07T23:10:00+00:00",
  events: n,
  sessions: Math.round(n / 25),
  answers: Math.round(n / 9),
  lastActive: "2026-10-08T01:12:00.000Z",
  apps: { dwts: n },
  groups: 2,
  ...extra,
});

export const USERS: UserRow[] = [
  row(PAT, "Pat Couch", "pat@example.com", 912),
  row(ROBIN, "Robin Sofa", "robin@example.com", 455, { sessions: 60, groups: 4, apps: { dwts: 300, traitors: 155 } }),
  row(SAM, "Sam Recliner", "sam@example.com", 0, { sessions: 0, answers: 0, groups: 0, lastActive: null, createdAt: "2026-10-06T12:00:00+00:00" }),
];

const event = (at: string, kind: ActivityEvent["kind"], name: string, route: string, extra: Partial<ActivityEvent> = {}): ActivityEvent => ({
  at,
  sk: `${at}#${name}${route}`,
  uid: PAT,
  sub: PAT,
  did: "c0ffee00aa11bb22",
  app: "dwts",
  kind,
  name,
  route,
  session: "s1",
  device: "phone",
  ...extra,
});

export const RECENT = {
  events: [
    event("2026-10-08T01:12:00.000Z", "action", "scores_submit", "/episode/?season=dwts-35&ep=04"),
    event("2026-10-08T01:11:40.000Z", "view", "page", "/episode/?season=dwts-35&ep=04"),
    event("2026-10-08T01:10:02.000Z", "action", "traitors_pick", "/episode/?season=tus-5&ep=03", { uid: ROBIN, sub: ROBIN, app: "traitors", device: "desktop" }),
    event("2026-10-08T01:09:00.000Z", "view", "page", "/", { uid: "anon#d00d", sub: undefined, did: "d00d1234", app: "hub", device: "desktop" }),
    event("2026-10-08T01:08:30.000Z", "error", "api", "/groups/", { props: { endpoint: "groups_join", status: 404 } }),
  ],
  people: {
    [PAT]: { sub: PAT, name: "Pat Couch", picture: null, avatarKind: "initials" as const },
    [ROBIN]: { sub: ROBIN, name: "Robin Sofa", picture: null, avatarKind: "initials" as const },
  },
};

export const AUDIT: AuditEntry[] = [
  {
    sk: "2026-10-07T18:00:00.000Z#a1",
    admin: ADMIN_EMAIL,
    action: "answer",
    target: PAT,
    reason: "Score button froze mid-episode",
    before: { season: "dwts-35", ep: 4, key: "jackson-olson#1", answer: null },
    after: { season: "dwts-35", ep: 4, key: "jackson-olson#1", answer: { value: 8 } },
  },
  {
    sk: "2026-10-06T15:30:00.000Z#a2",
    admin: ADMIN_EMAIL,
    action: "membership_repair",
    target: ROBIN,
    reason: "Joined from the link but never showed in the group",
    before: { group: "g1", member: false, linked: true, invited: false },
    after: { group: "g1", member: true, linked: true, invited: false },
  },
];

export const DETAIL: UserDetail = {
  profile: {
    sub: PAT,
    email: "pat@example.com",
    name: "Pat Couch",
    picture: null,
    avatarKind: "initials",
    createdAt: "2026-09-10T20:00:00+00:00",
    lastSeenAt: "2026-10-07T23:10:00+00:00",
    customName: null,
    googleName: "Pat Couch",
    uploadPicture: null,
  },
  groups: [
    { id: "aaaaaaaaaaaa", name: "Ballroom Bench", owner: true, members: 6, joinedAt: "2026-09-12T01:00:00+00:00", member: true, exists: true },
    { id: "bbbbbbbbbbbb", name: "Work Watch Party", owner: false, members: 11, joinedAt: "2026-09-20T01:00:00+00:00", member: false, exists: true },
  ],
  friends: [
    { sub: ROBIN, name: "Robin Sofa", picture: null, avatarKind: "initials", status: "friend", blocking: false, blockedBy: false, at: "2026-09-14T00:00:00+00:00" },
    { sub: SAM, name: "Sam Recliner", picture: null, avatarKind: "initials", status: "blocked", blocking: true, blockedBy: false, at: "2026-10-01T00:00:00+00:00" },
  ],
  devices: [
    { did: "c0ffee00aa11bb22", device: "phone", last: "2026-10-08T01:12:00.000Z", events: 80 },
    { did: "beef0000cc33dd44", device: "desktop", last: "2026-10-05T22:00:00.000Z", events: 20 },
  ],
  daily: Array.from({ length: 30 }, (_, i) => ({
    day: `2026-${i < 21 ? "09" : "10"}-${String(i < 21 ? i + 9 : i - 20).padStart(2, "0")}`,
    events: [0, 3, 40, 12, 0, 0, 0, 55][i % 8],
  })),
  audit: [AUDIT[0]],
  events: RECENT.events.filter((e) => e.sub === PAT),
};
