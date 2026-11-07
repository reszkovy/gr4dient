# Architecture

gr4dient is one static page, `index.html`, with two inline scripts and no build step. It runs from any folder
or static host.

## The two scripts

| Script | Role |
|---|---|
| `<script id="grain-core">` | The renderer. Publishes `R352Gr4dient` with `create(canvas)` and `mount(canvas, state, id)`. Self-contained on purpose: the "Code" export copies this exact script into the user's page, so the embed draws the same pixels as the editor. |
| second script | The editor: controls, presets, draggable points, URL state, exporters, EN/PL strings. Talks to the renderer only through `R352Gr4dient.create`. |

## Rendering

- One WebGL fragment shader with four modes, picked by `uMode`: Field (`mesh`), Current (`flow`),
  Fold (`silk`), Beam (`rays`). Grain, dither, contrast, saturation and vignette are applied in the same pass.
- Colors are blended in Oklab, not sRGB (`srgbToOklab` on the CPU, `oklab2srgb` in the shader), so mixes
  stay clean instead of going grey between hues.
- Time is a phase from 0 to 1 over one loop. Loop length in seconds is `bars * 240 / bpm` (four beats per bar),
  so every loop ends on the bar. With `prefers-reduced-motion` the page draws one still frame.

## State

- All settings live in one object `S` (mode, colors, points, seed, tempo, texture).
- The URL hash `#g=...` holds `S`, so a copied link restores the same gradient. Nothing leaves the browser.
- The only storage is the interface language (`localStorage`, key `r352gr4dient.lang`), wrapped in try/catch
  because private windows can block it.

## Export

| Output | How |
|---|---|
| PNG | A second, offscreen renderer at the chosen size and aspect (up to 5760 px). Draggable points are remapped so the composition holds in another aspect. |
| Video | Frame-exact: every frame is rendered at phase `i/n` and encoded to H.264 with WebCodecs, muxed by mp4-muxer (loaded from jsDelivr only when recording). Without WebCodecs: real-time capture with MediaRecorder (MP4 or WebM, whichever the browser supports). |
| CSS | A static approximation: radial or linear gradients plus an SVG noise layer for grain. |
| Embed code | The renderer script plus one `mount` call with the current state. |

## Checks

`npm run check` (also in CI on every push):

- `scripts/check.mjs`: inline scripts parse; every local file the page links exists and is linked by a
  relative path; no `console.log` or `debugger`; every CSS token in `:root` is read; EN and PL strings have the
  same keys; no long dashes.
- ESLint (recommended rules, scripts inside HTML through `eslint-plugin-html`).
- Prettier formatting.

`npm run smoke` opens the page in headless Chrome: the canvas draws a gradient, the CSS, embed and link
buttons answer, a copied link restores the colors, randomize and add color work, 14 presets load, the Polish
switch works, and the browser reports no errors.

## Where it comes from

The page is the open copy of the tool at r352.com/gr4dient. Code that only makes sense on r352.com (analytics,
links to other r352 tools, the "Pro" waitlist) is not in this repository.
