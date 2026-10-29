import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const text = async (path) => readFile(new URL(path, root), "utf8");
const bytes = async (path) => readFile(new URL(path, root));
const digest = (value) => createHash("sha256").update(value).digest("hex");
const errors = [];
const conformance = JSON.parse(await text("packages/design-system/conformance.json"));
const tokens = await text("packages/design-system/src/tokens.css");
const runtimeStyles = await text("apps/runtime-web/src/styles.css");
const runtimeApp = await text("apps/runtime-web/src/App.tsx");
const studioApp = await text("apps/studio/src/App.tsx");

if (conformance.productionDecisionSignal !== "mineralSage") errors.push("production decision signal is not Mineral Sage");
if (!runtimeStyles.startsWith('@import "../../../packages/design-system/src/tokens.css";')) errors.push("Runtime does not import the Teludens foundation first");
for (const token of ["--material-canvas", "--signal-decision", "--focus-ring", "[data-density=\"operations\"]", ".teludens-node", "prefers-reduced-motion"]) {
  if (!tokens.includes(token)) errors.push(`missing Teludens contract ${token}`);
}
for (const forbidden of ["#f24b35", "#d93a27", "#b72d1d", "#ff6b52"]) {
  if (`${tokens}${runtimeStyles}${runtimeApp}${studioApp}`.toLowerCase().includes(forbidden)) errors.push(`conflicting Vermilion decision value ${forbidden}`);
}
for (const app of ["runtime-web", "studio"]) {
  for (const tone of ["dark", "light"]) {
    const source = await bytes(`references/teludens-design-system-catalog/assets/logos/Plenum. Wordmark ${tone === "dark" ? "Dark" : "Light"}.png`);
    const target = await bytes(`apps/${app}/public/branding/plenum-wordmark-${tone}.png`);
    if (digest(source) !== digest(target)) errors.push(`${app} ${tone} wordmark differs from catalog source`);
  }
}
for (const source of [runtimeApp, studioApp]) {
  if (!source.includes("brand-wordmark-dark") || !source.includes("brand-wordmark-light")) errors.push("an application does not expose both theme-safe wordmarks");
}
if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else console.log("teludens-design-system-v1 PASS: semantic map, density, grammar, motion, and exact brand assets verified");
