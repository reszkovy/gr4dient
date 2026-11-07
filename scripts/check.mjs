// Release check for gr4dient: run `node scripts/check.mjs` before every push (CI runs it too).
// Fails on: a script that does not parse, a local file that is referenced but missing, debug leftovers,
// CSS tokens nobody reads, a UI string present in one language only, long dashes in the page.
import { readFileSync, existsSync } from "node:fs";
import { Script, runInNewContext } from "node:vm";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const errors = [];

// 1. every inline script parses
const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*ld\+json)[^>]*>([\s\S]*?)<\/script>/g)].map(
  (m) => m[1],
);
scripts.forEach((src, i) => {
  try {
    new Script(src, { filename: `inline-${i}.js` });
  } catch (e) {
    errors.push(`script ${i} does not parse: ${e.message}`);
  }
});

// 2. local files referenced from the page exist
const refs = [...html.matchAll(/(?:src|href)="([^"#:?]+)"|url\("?([^")#:?]+)"?\)/g)]
  .map((m) => m[1] || m[2])
  .filter((r) => !r.startsWith("data") && !r.startsWith("/") && !r.startsWith("%23")); // %23 = #id inside inline SVG
// root paths ("/x") work on r352.com only; the repo has to run from any folder or host
for (const [, r] of html.matchAll(/(?:src|href)="(\/[^"/][^"]*)"|url\("?(\/[^"/)][^")]*)/g))
  if (r) errors.push(`root-absolute path (breaks outside r352.com): ${r}`);
for (const r of new Set(refs)) if (!existsSync(new URL("../" + r, import.meta.url))) errors.push(`missing file: ${r}`);

// 3. no debug leftovers
for (const bad of ["console.log(", "debugger;"]) if (html.includes(bad)) errors.push(`debug leftover: ${bad}`);

// 4. every CSS custom property defined in :root is read somewhere (the exported CSS may name one in a string)
const root = html.match(/:root\{([\s\S]*?)\}/)?.[1] ?? "";
for (const [, v] of root.matchAll(/(--[\w-]+)\s*:/g))
  if (!html.includes(`var(${v}`)) errors.push(`unused CSS token: ${v}`);

// 5. English and Polish UI strings have the same keys (the TXT literal is read as data in a sandbox, not run with the page)
let en = null,
  pl = null;
const at = html.indexOf("var TXT =") >= 0 ? html.indexOf("var TXT =") : html.indexOf("var TXT=");
if (at >= 0) {
  let i = html.indexOf("{", at),
    depth = 0,
    quote = "";
  const from = i;
  for (; i < html.length; i++) {
    const ch = html[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) break;
  }
  try {
    const txt = runInNewContext("(" + html.slice(from, i + 1) + ")", {}, { timeout: 1000 });
    en = new Set(Object.keys(txt.en || {}));
    pl = new Set(Object.keys(txt.pl || {}));
  } catch (e) {
    errors.push("UI strings: TXT does not evaluate: " + e.message);
  }
}
if (!en || !pl) errors.push("UI strings: en or pl block not found");
else
  for (const [a, b, n] of [
    [en, pl, "pl"],
    [pl, en, "en"],
  ])
    for (const k of a) if (!b.has(k)) errors.push(`UI string "${k}" missing in ${n}`);

// 6. house style: plain hyphens only
if (/[\u2013\u2014]/.test(html)) errors.push("long dash in index.html (use -)");

if (errors.length) {
  console.error(errors.map((e) => "x " + e).join("\n"));
  process.exit(1);
}
console.log(`ok: ${scripts.length} scripts, ${new Set(refs).size} local files, ${en.size} UI strings in en and pl`);
