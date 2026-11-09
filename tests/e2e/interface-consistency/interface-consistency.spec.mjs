import { mkdir, writeFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { plan } from "./cases.mjs";
import { interfaceFindings } from "./assertions.mjs";

const output = "output/playwright/ps-842/regression";
const modes = [["desktop", { width: 1440, height: 900 }], ["minimum", { width: 1024, height: 768 }], ["zoom", { width: 512, height: 384 }]];
for (const [persona, token, routes] of plan) for (const [name, url] of routes) {
  test(`PS-842-T01-T04 ${persona}: ${name}`, async ({ browser, baseURL }) => {
    await mkdir(output, { recursive: true });
    const results = [], errors = [];
    const context = await browser.newContext({ baseURL, viewport: modes[0][1], colorScheme: "light", reducedMotion: "reduce",
      ...(token ? { extraHTTPHeaders: { Authorization: `Bearer ${token}` } } : {}) });
    await context.addInitScript(() => localStorage.setItem("plenum.theme", "light"));
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.goto(url, { waitUntil: "networkidle" });
      await expect(page.locator(".plenum-loader:visible")).toHaveCount(0);
      if (url.startsWith("/studio/projects/")) await expect(page.getByLabel("Design workspace", { exact: true })).toHaveCount(1);
      for (const theme of ["light", "dark"]) {
        if (theme === "dark") await page.getByRole("button", { name: /^Theme:/ }).click();
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        for (const [mode, viewport] of modes) {
          await page.setViewportSize(viewport);
          await page.keyboard.press("Tab");
          const findings = await interfaceFindings(page);
          if (name.startsWith("unknown-")) {
            await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
            await expect(page.getByText("Connection error", { exact: true })).toHaveCount(0);
          }
          if (url.startsWith("/studio/projects/")) {
            const selected = page.locator('.editor-nav [aria-current="page"]');
            await expect(selected).toHaveCount(1);
            const label = (await selected.innerText()).trim();
            await expect(page.getByRole("heading", { name: label, exact: true })).toHaveCount(1);
          }
          if (mode === "desktop") {
            const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
            findings.push(...axe.violations.map((v) => `Accessibility: ${v.id} ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`));
          }
          await page.screenshot({ path: `${output}/${persona}-${name}-${mode}-${theme}.png` });
          results.push({ mode, viewport, theme, findings });
        }
      }
      await page.emulateMedia({ forcedColors: "active" });
      results.push({ mode: "zoom-forced-colors", findings: await interfaceFindings(page) });
      await page.screenshot({ path: `${output}/${persona}-${name}-forced-colors.png` });
    } finally {
      await writeFile(`${output}/${persona}-${name}.json`, JSON.stringify({ persona, name, url, synthetic: true, results, errors }, null, 2));
      await context.close();
    }
    expect([...results.flatMap((r) => r.findings.map((f) => `${r.mode}/${r.theme ?? "system"}: ${f}`)), ...errors]).toEqual([]);
  });
}
