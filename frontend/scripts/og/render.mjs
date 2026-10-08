#!/usr/bin/env node
// Renders the DWTS share cards and app icons into app/. Run after changing the
// copy below or the templates beside it, then commit the images:
//   PLAYWRIGHT=/path/to/node_modules/playwright node scripts/og/render.mjs
// Playwright isn't a dependency: the images are committed, so CI never renders.

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const playwright = await import(process.env.PLAYWRIGHT ?? "playwright");
// Imported by path it's CommonJS, so the browsers hang off default.
const { chromium } = playwright.chromium ? playwright : playwright.default;
const here = dirname(fileURLToPath(import.meta.url));
const app = join(here, "../../app");

// Route segment: [headline lines, sub, paddle, alt]. "" is the site default.
const CARDS = {
  "": [["your paddle.", "every dance."], "Score each couple before the judges do, then see how close you came.", "10", "Score every dance before the judges do"],
  join: [["you're invited.", "join the group."], "Score every Dancing with the Stars dance together, then see who called it closest.", "10", "You're invited to a group"],
  friends: [["add me.", "let's compare."], "We each paddle every dance, then see who lands closer to the judges.", "9", "Add me as a friend"],
  groups: [["our group's", "leaderboard."], "Who in the group scores closest to the judges, dance after dance.", "10", "Our group's leaderboard"],
  profile: [["see how", "i score."], "My paddles against the judges, all season long.", "8", "See how I score against the judges"],
  leaderboard: [["closest to", "the judges."], "The season's leaderboard: lowest average gap to the panel wins.", "10", "Who's closest to the judges"],
  episode: [["this week's", "show is on."], "Score each couple before the judges' paddles go up.", "7", "Score this week's show"],
  stats: [["how close", "did you get?"], "Your gap to every judge, every style and every week.", "9", "How close did you get"],
  couples: [["every couple.", "every score."], "Your average for each couple against the judges'.", "10", "Every couple, every score"],
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(pathToFileURL(join(here, "card.html")).href);
await page.evaluate(() => document.fonts.ready);

for (const [route, [lines, sub, paddle, alt]] of Object.entries(CARDS)) {
  await page.evaluate(
    ([lines, sub, paddle]) => {
      const h1 = document.getElementById("headline");
      h1.replaceChildren(
        ...lines.map((t) => {
          const outer = document.createElement("span");
          const inner = document.createElement("span");
          inner.className = "chrome";
          inner.style.display = "inline";
          inner.textContent = t;
          outer.append(inner);
          return outer;
        }),
      );
      document.getElementById("sub").textContent = sub;
      document.getElementById("paddle").textContent = paddle;
    },
    [lines, sub, paddle],
  );
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
  const dir = join(app, route);
  await page.screenshot({ path: join(dir, "opengraph-image.jpg"), type: "jpeg", quality: 86 });
  writeFileSync(join(dir, "opengraph-image.alt.txt"), `${alt}: Armchair Judge for Dancing with the Stars`);
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
writeFileSync(join(here, "../../public/brand/dwts-icon-192.png"), await icon(192, false));
writeFileSync(join(here, "../../public/brand/dwts-icon-512.png"), await icon(512, false));

await browser.close();
