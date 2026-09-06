import { readFileSync } from "node:fs";

const root = new URL("../design/", import.meta.url);
const css = readFileSync(new URL("tokens.css", root), "utf8");
const components = readFileSync(new URL("components.css", root), "utf8");
const html = readFileSync(new URL("preview.html", root), "utf8");
const tokens = new Map(
  [...css.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, key, value]) => [
    key,
    value.trim(),
  ]),
);
const errors: string[] = [];
for (const [, key] of `${css}\n${components}`.matchAll(/var\((--[\w-]+)\)/g)) {
  if (!tokens.has(key)) errors.push(`Unknown token: ${key}`);
}
if (/#[0-9a-f]{3,8}\b|\b(?:rgb|hsl)a?\(/i.test(components))
  errors.push("Component colors must come from tokens");
if (!html.includes('href="components.css"'))
  errors.push("Preview must use shared components");
if (/style=|<style[\s>]/i.test(html))
  errors.push("Preview must not redefine styles");
function color(name: string, seen = new Set<string>()): string {
  if (seen.has(name)) throw new Error(`Cyclic token: ${name}`);
  seen.add(name);
  const value = tokens.get(`--${name}`);
  if (!value) throw new Error(`Missing token: ${name}`);
  const alias = value.match(/^var\(--([\w-]+)\)$/);
  if (alias) return color(alias[1], seen);
  if (!/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`Not a color: ${name}`);
  return value;
}
function luminance(hex: string): number {
  const channels = [1, 3, 5]
    .map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
const pairs: [string, string, number][] = [
  ["color-text", "color-canvas", 4.5],
  ["color-text", "color-surface", 4.5],
  ["color-text", "color-selected", 4.5],
  ["color-text-secondary", "color-canvas", 4.5],
  ["color-text-secondary", "color-surface", 4.5],
  ["color-text-secondary", "color-selected", 4.5],
  ["color-on-dark", "color-nav", 4.5],
  ["color-on-dark", "palette-leaf", 4.5],
  ["color-on-dark", "palette-moss", 4.5],
  ["color-on-dark", "color-action", 4.5],
  ["color-on-dark", "color-action-hover", 4.5],
  ["color-error", "color-canvas", 4.5],
  ["color-error", "color-surface", 4.5],
  ["color-warning", "color-canvas", 4.5],
  ["color-border", "color-surface", 3],
  ["color-focus", "color-canvas", 3],
  ["color-focus", "color-surface", 3],
  ["color-focus-on-dark", "color-nav", 3],
];
const contrasts = pairs.map(([foreground, background, minimum]) => {
  const values = [
    luminance(color(foreground)),
    luminance(color(background)),
  ].sort((a, b) => b - a);
  const ratio = (values[0] + 0.05) / (values[1] + 0.05);
  if (ratio < minimum)
    errors.push(`${foreground} on ${background}: ${ratio} < ${minimum}`);
  return { foreground, background, ratio: Number(ratio.toFixed(2)), minimum };
});
process.stdout.write(
  `${JSON.stringify({ ok: !errors.length, tokens: tokens.size, contrasts, errors }, null, 2)}\n`,
);
process.exitCode = errors.length ? 1 : 0;
