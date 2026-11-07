// README screenshot of the whole interface: canvas, draggable points, panel with controls.
// Usage: node scripts/screenshot.mjs  -> docs/interface.jpg (1600x1000 at 2x, saved at 1600 px wide)
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
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

const browser = await puppeteer.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--no-sandbox"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 1500)); // let the loop move off its first frame
  await mkdir(join(root, "docs"), { recursive: true });
  await page.screenshot({ path: join(root, "docs/interface.jpg"), type: "jpeg", quality: 88 });
  console.log("docs/interface.jpg");
} finally {
  await browser.close();
  server.closeAllConnections();
  server.close();
}
