import { readFile, stat } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const artifacts = [
  "output/playwright/ps-800/after/platform-lifecycle/platform-projects-1440x900.png",
  "output/playwright/ps-800/after/platform-lifecycle/platform-project-catalog-1440x900.png",
  "output/playwright/ps-800/after/platform-lifecycle/projects-empty-no-results-1440x900.png",
  "output/playwright/ps-800/after/platform-lifecycle/releases-empty-no-results-1440x900.png",
  "output/playwright/ps-800/after/platform-lifecycle/sessions-empty-no-results-1440x900.png",
  "output/playwright/ps-800/after/platform-lifecycle/sessions-error-recoverable-partial-failure-1440x900.png",
  "output/playwright/ps-800/after/platform-lifecycle/sessions-success-recovered-1440x900.png",
  "output/playwright/ps-800/after/platform-lifecycle/platform-lifecycle-1440x900.png",
  "output/playwright/ps-800/after/platform-lifecycle/platform-lifecycle-1280x600.png",
  "output/playwright/ps-800/after/platform-lifecycle/platform-lifecycle-1024x768-account-menu.png",
  "output/playwright/ps-800/after/platform-lifecycle/platform-lifecycle-768x1024-access-context.png",
  "output/playwright/ps-800/after/platform-lifecycle/platform-lifecycle-390x844-200-percent.png",
  "output/playwright/ps-800/after/platform-lifecycle/platform-lifecycle-320x720-200-percent.png",
  "output/playwright/ps-800/after/platform-lifecycle/platform-lifecycle-390x844-touch.png",
  "output/playwright/ps-800/after/platform-lifecycle/platform-lifecycle-390x844-reduced-motion.png",
  "output/playwright/ps-800/after/platform-lifecycle/platform-lifecycle-1280x720-forced-colors.png",
  "output/playwright/ps-800/after/view-families/studio-authoring-1440x900.png",
  "output/playwright/ps-800/after/view-families/participant-runtime-1440x900.png",
  "output/playwright/ps-800/after/view-families/operator-control-1440x900.png",
  "output/playwright/ps-800/after/view-families/organization-administration-1440x900.png",
  "output/playwright/ps-800/after/view-families/reporting-research-1440x900.png",
  "output/playwright/ps-800/after/view-families/replay-archive-1440x900.png",
  "output/playwright/ps-800/after/view-families/participant-runtime-320x720-200-percent.png",
  "output/playwright/ps-800/after/studio-authoring/project-qa-demo-1440x900.png",
  "output/playwright/ps-800/after/studio-authoring/project-qa-demo-320x720.png"
];

const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const errors = [];

for (const artifact of artifacts) {
  try {
    const url = new URL(artifact, root);
    const metadata = await stat(url);
    const bytes = await readFile(url);
    if (metadata.size < 1024) errors.push(`${artifact}: artifact is unexpectedly small (${metadata.size} bytes)`);
    if (!bytes.subarray(0, pngSignature.length).equals(pngSignature)) errors.push(`${artifact}: artifact is not a PNG`);
  } catch (error) {
    errors.push(`${artifact}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`PS-800 visual evidence PASS: ${artifacts.length} route, state, family, and constrained-viewport captures verified.`);
}
