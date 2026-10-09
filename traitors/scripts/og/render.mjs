#!/usr/bin/env node
// Renders the Traitors share cards and app icons into app/, as frontend/scripts/og does for DWTS. Run after changing the
// copy below or the templates beside it, then commit the images:
//   PLAYWRIGHT=/path/to/node_modules/playwright node scripts/og/render.mjs
// Playwright isn't a dependency: the images are committed, so CI never renders.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const playwright = await import(process.env.PLAYWRIGHT ?? "playwright");
// Imported by path it's CommonJS, so the browsers hang off default.
const { chromium } = playwright.chromium ? playwright : playwright.default;
const here = dirname(fileURLToPath(import.meta.url));
const app = join(here, "../../app");

// Route segment: [headline lines, sub, alt]. "" is the site default; players/player
// is a player's profile.
const CARDS = {
  "": [["trust no one.", "call it first."], "Name the murder, the banishment and the recruit before the round table does.", "Call The Traitors before the round table does"],
  join: [["you're invited.", "take a seat."], "Call The Traitors with the group, episode by episode, then see who saw it coming.", "You're invited to a group"],
  groups: [["our round", "table."], "Who in the group reads the castle best, episode after episode.", "Our group's round table"],
  players: [["who are they", "really?"], "Every player's season: the votes they cast, the votes they drew, and how they left.", "A player's season in the castle"],
  "players/player": [["who are they", "really?"], "Every player's season: the votes they cast, the votes they drew, and how they left.", "A player's season in the castle"],
  picks: [["my calls.", "sealed."], "Every call I made this season, and what each one scored.", "My sealed calls"],
  episode: [["the round table", "is waiting."], "Seal your calls for the murder, the banishment and the recruit.", "Seal your calls for this episode"],
  leaderboard: [["who saw", "it coming?"], "The season's standings: points for every call that came true.", "Who saw it coming"],
  stats: [["read the", "ledger."], "Your points by call and by episode, all season long.", "My Traitors ledger"],
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(pathToFileURL(join(here, "card.html")).href);
await page.evaluate(() => document.fonts.ready);

for (const [route, [lines, sub, alt]] of Object.entries(CARDS)) {
  await page.evaluate(
    ([lines, sub]) => {
      document.getElementById("headline").replaceChildren(
        ...lines.map((t) => {
          const line = document.createElement("span");
          line.className = "gilt";
          line.textContent = t;
          return line;
        }),
      );
      document.getElementById("sub").textContent = sub;
    },
    [lines, sub],
  );
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
  const dir = join(app, route);
  await page.screenshot({ path: join(dir, "opengraph-image.jpg"), type: "jpeg", quality: 86 });
  writeFileSync(join(dir, "opengraph-image.alt.txt"), `${alt}: Armchair Judge for The Traitors`);
}

// ICO with PNG entries, which every browser reads.
function ico(pngs) {
  const header = Buffer.alloc(6 + 16 * pngs.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  pngs.forEach(([size, png], i) => {
    const at = 6 + 16 * i;
    header.writeUInt8(size % 256, at);
    header.writeUInt8(size % 256, at + 1);
    header.writeUInt16LE(1, at + 4);
    header.writeUInt16LE(32, at + 6);
    header.writeUInt32LE(png.length, at + 8);
    header.writeUInt32LE(offset, at + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...pngs.map(([, png]) => png)]);
}

const icon = async (size, round) => {
  await page.setViewportSize({ width: size, height: size });
  await page.goto(pathToFileURL(join(here, "icon.html")).href);
  await page.evaluate(
    ([s, r]) => {
      document.documentElement.style.setProperty("--s", `${s}px`);
      document.documentElement.style.setProperty("--r", `${r}px`);
    },
    [size, round ? size * 0.22 : 0],
  );
  return page.screenshot({ type: "png", omitBackground: true });
};

// iOS rounds the apple icon itself, so it ships square.
writeFileSync(join(app, "apple-icon.png"), await icon(180, false));
writeFileSync(join(app, "icon.png"), await icon(32, true));
writeFileSync(join(app, "favicon.ico"), ico([[48, await icon(48, true)], [32, await icon(32, true)], [16, await icon(16, true)]]));
mkdirSync(join(here, "../../public/brand"), { recursive: true });
writeFileSync(join(here, "../../public/brand/traitors-icon-192.png"), await icon(192, false));
writeFileSync(join(here, "../../public/brand/traitors-icon-512.png"), await icon(512, false));

await browser.close();
