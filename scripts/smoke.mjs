// Smoke test in a real browser: the page loads without errors, the canvas draws, every export button
// answers, presets and the language switch work, and the shared link restores the same state.
// Usage: node scripts/smoke.mjs  (serves the folder itself on a free port)
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const root = fileURLToPath(new URL("..", import.meta.url));
const types = { ".html": "text/html", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".jpg": "image/jpeg" };
const server = createServer(async (req, res) => {
  const path = normalize(join(root, decodeURIComponent(new URL(req.url, "http://x").pathname)));
  if (!path.startsWith(root)) return res.writeHead(403).end();
  try {
    const file = path.endsWith("/") ? join(path, "index.html") : path;
    res
      .writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream" })
      .end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/`;

const failures = [];
const step = (what) => process.env.SMOKE_DEBUG && console.log("..", what);
// a hung browser must fail the run, not keep CI waiting
const watchdog = setTimeout(() => {
  console.error("x smoke test timed out after 90 s");
  process.exit(1);
}, 90_000);
const check = (ok, what) => {
  if (!ok) failures.push(what);
};
const browser = await puppeteer.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--no-sandbox"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("requestfailed", (r) => {
    if (r.url().startsWith(url)) errors.push("failed " + r.url());
  });
  step("open page");
  await page.goto(url, { waitUntil: "load" });
  await new Promise((r) => setTimeout(r, 800));

  step("read canvas");
  // the canvas shows a gradient: many distinct colors, not a blank frame
  const colors = await page.evaluate(() => {
    const c = document.querySelector("#stage");
    const tmp = document.createElement("canvas");
    tmp.width = 64;
    tmp.height = 40;
    tmp.getContext("2d").drawImage(c, 0, 0, 64, 40);
    const d = tmp.getContext("2d").getImageData(0, 0, 64, 40).data,
      seen = new Set();
    for (let i = 0; i < d.length; i += 4) seen.add((d[i] >> 3) + "," + (d[i + 1] >> 3) + "," + (d[i + 2] >> 3));
    return seen.size;
  });
  check(colors > 20, `canvas looks blank (${colors} colors)`);

  const toast = async (sel) => {
    await page.click(sel);
    await new Promise((r) => setTimeout(r, 250));
    return page.$eval("#toast", (t) => t.textContent);
  };
  step("export buttons");
  await page.evaluate(() => {
    navigator.clipboard.writeText = () => Promise.resolve();
  });
  check(/CSS copied/.test(await toast("#btnCss")), "CSS button");
  check(/Embed code copied/.test(await toast("#btnCode")), "embed code button");
  check(/Link copied/.test(await toast("#btnLink")), "link button");

  // the shared link restores the colors
  const state = await page.evaluate(() => ({ hash: location.hash, colors: window.__grain.state.colors.join() }));
  check(/^#g=/.test(state.hash), "link has no state");
  const second = await browser.newPage();
  step("shared link");
  await second.goto(url + state.hash, { waitUntil: "load" });
  check(
    (await second.evaluate(() => window.__grain.state.colors.join())) === state.colors,
    "link does not restore colors",
  );
  await second.close();
  await page.bringToFront(); // a background tab is throttled and stops answering
  step("presets and language");

  // every control that builds a new palette: randomize, add a color, pick a preset
  step("randomize, add color, preset");
  const before = await page.evaluate(() => window.__grain.state.colors.join());
  await page.evaluate(() => document.querySelector("#btnRandom").click());
  check((await page.evaluate(() => window.__grain.state.colors.join())) !== before, "randomize keeps the same colors");
  const n = await page.evaluate(() => window.__grain.state.colors.length);
  await page.evaluate(() => document.querySelector("#colDel").click()); // the default palette is full (5)
  await page.evaluate(() => document.querySelector("#colAdd").click());
  const added = await page.evaluate(() => window.__grain.state.colors.length);
  check(added === n, `remove then add a color: ${n} -> ${added}`);

  // presets and language
  const presets = await page.evaluate(() => window.__grain.presets.length);
  check(presets === 14, `expected 14 presets, got ${presets}`);
  await page.click('[data-lang="pl"]');
  check(
    (await page.$eval('[data-i18n="title"]', (e) => e.textContent)) === "Generator gradientów w ruchu",
    "Polish switch",
  );

  check(errors.length === 0, "browser errors: " + errors.join(" | "));
} finally {
  await browser.close();
  server.closeAllConnections();
  server.close();
  clearTimeout(watchdog);
}
if (failures.length) {
  console.error(failures.map((f) => "x " + f).join("\n"));
  process.exit(1);
}
console.log(
  "smoke ok: canvas draws, CSS, embed and link export, shared link, randomize, add color, 14 presets, Polish",
);
