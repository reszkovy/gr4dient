import js from "@eslint/js";
import html from "eslint-plugin-html";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    files: ["index.html"],
    plugins: { html },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      // the renderer core publishes R352Gr4dient; the MP4 muxer is loaded on demand from jsDelivr
      globals: { ...globals.browser, R352Gr4dient: "readonly", Mp4Muxer: "readonly" },
    },
    rules: {
      // reading storage or clipboard may throw in private windows; there is nothing to do when it does
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    files: ["scripts/**/*.mjs", "eslint.config.mjs"],
    languageOptions: { ecmaVersion: 2022, sourceType: "module", globals: globals.node },
  },
  {
    // the callbacks passed to page.evaluate run inside the browser
    files: ["scripts/smoke.mjs", "scripts/screenshot.mjs"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
];
