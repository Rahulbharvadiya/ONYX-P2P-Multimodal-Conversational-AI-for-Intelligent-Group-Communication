#!/usr/bin/env node
/**
 * WCAG 2.1 contrast check for the §6 semantic design tokens.
 *
 * Parses src/app/globals.css, resolves the CSS custom properties it defines
 * for `:root` (light) and `.dark`, and asserts every text-on-surface pair the
 * UI actually uses meets 4.5:1 (normal text) or 3:1 (large text / UI). This
 * is a real, runnable complement to the axe-core browser gate and keeps the
 * tokens honest without needing a browser. Exits non-zero on a violation.
 *
 * Run: node scripts/contrast.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(root, "src/app/globals.css"), "utf8");

/** Extract `name: value;` declarations inside the first matching selector block. */
function extractBlock(selector) {
  const re = new RegExp(`${selector}\\s*\\{([^}]*)\\}`, "s");
  const m = css.match(re);
  if (!m) throw new Error(`could not find block: ${selector}`);
  const vars = {};
  for (const decl of m[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    vars[decl[1]] = decl[2].trim();
  }
  return vars;
}

const lightBlock = extractBlock(":root");
// `.dark { ... }` — the `@custom-variant dark` line is not a `{`-block, so
// this only matches the actual `.dark` rule. Dark inherits every `:root`
// variable it does not redeclare, so we merge the two maps.
const dark = { ...lightBlock, ...extractBlock("\\.dark") };

function resolve(map, name) {
  let v = map[name];
  let guard = 0;
  while (v && v.startsWith("var(") && guard < 8) {
    const inner = v.match(/var\(\s*(--[\w-]+)\s*\)/);
    if (!inner) break;
    v = map[inner[1]] ?? inner[1];
    guard += 1;
  }
  return v;
}

function srgb(c) {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function luminance(hex) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
}
function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * [name, fg, bg, min] where fg/bg are CSS var names — resolved per theme.
 */
const pairs = [
  ["text-primary on bg-app", "--text-primary", "--bg-app", 4.5],
  ["text-primary on surface", "--text-primary", "--bg-surface", 4.5],
  ["text-secondary on bg-app", "--text-secondary", "--bg-app", 4.5],
  ["fg-muted on bg-app", "--fg-muted", "--bg-app", 4.5],
  ["fg-muted on surface", "--fg-muted", "--bg-surface", 4.5],
  ["fg-muted on surface-elevated", "--fg-muted", "--bg-surface-raised", 4.5],
  ["fg-muted on bg-subtle", "--fg-muted", "--bg-subtle", 4.5],
  ["fg-subtle on bg-app", "--fg-subtle", "--bg-app", 4.5],
  ["fg-subtle on bg-subtle", "--fg-subtle", "--bg-subtle", 4.5],
  ["accent-fg on accent (button)", "--accent-fg", "--accent", 4.5],
  ["accent text on bg-app", "--accent-text", "--bg-app", 4.5],
  ["accent text on bg-subtle", "--accent-text", "--bg-subtle", 4.5],
  // The accent color is also used as an icon/SVG on the accent-subtle badge;
  // graphical objects only need 3:1.
  ["accent icon/graphics on accent-subtle", "--accent-text", "--accent-subtle", 3.0],
  ["accent text on accent-subtle", "--accent-text", "--accent-subtle", 4.5],
  ["ai-fg on ai (pill fill)", "--ai-foreground", "--ai", 4.5],
  ["bubble-ai-fg on bubble-ai-bg", "--bubble-ai-fg", "--bubble-ai-bg", 4.5],
  ["bubble-user-fg on bubble-user-bg", "--bubble-user-fg", "--bubble-user-bg", 4.5],
  ["bubble-other-fg on bubble-other-bg", "--bubble-other-fg", "--bubble-other-bg", 4.5],
  // Markdown links inside an AI / other bubble (.prose-chat a uses
  // --accent-text; inside an own bubble they inherit the bubble fg).
  ["accent text on bubble-ai-bg", "--accent-text", "--bubble-ai-bg", 4.5],
  ["accent text on bubble-other-bg", "--accent-text", "--bubble-other-bg", 4.5],
  ["accent text on surface-raised", "--accent-text", "--bg-surface-raised", 4.5],
  ["ai-accent text on bg-app", "--ai-accent", "--bg-app", 4.5],
  ["ai-accent text on surface", "--ai-accent", "--bg-surface", 4.5],
  ["info on bg-app", "--info", "--bg-app", 4.5],
  ["warning on bg-app", "--warning", "--bg-app", 4.5],
  ["danger on bg-app", "--danger", "--bg-app", 4.5],
  ["success on bg-app", "--success", "--bg-app", 4.5],
];

let failures = 0;
let checked = 0;
for (const theme of ["light", "dark"]) {
  const map = theme === "light" ? lightBlock : dark;
  console.log(`\n=== ${theme.toUpperCase()} ===`);
  for (const [name, fg, bg, min] of pairs) {
    const fgV = resolve(map, fg);
    const bgV = resolve(map, bg);
    if (!fgV || !bgV || !fgV.startsWith("#") || !bgV.startsWith("#")) {
      console.log(`SKIP  ${name}: unresolved ${fg}=${fgV} ${bg}=${bgV}`);
      continue;
    }
    checked += 1;
    const c = contrast(fgV, bgV);
    const ok = c >= min;
    console.log(`${ok ? "ok " : "FAIL"}  ${name}: ${c.toFixed(2)}:1 (min ${min}:1)  [${fgV} on ${bgV}]`);
    if (!ok) failures += 1;
  }
}

console.log(`\n${failures === 0 ? "PASS" : `${failures} FAILURE(S)`} — ${checked} pairs checked`);
process.exit(failures === 0 ? 0 : 1);
