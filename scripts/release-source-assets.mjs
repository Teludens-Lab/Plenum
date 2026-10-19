import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export async function hydrateReleaseSourceAssets(input, sourceUrl) {
  const hydrated = structuredClone(input);
  const coreDesign = hydrated?.materialization?.coreDesign;
  for (const form of coreDesign?.forms ?? []) {
    for (const section of form.sections ?? []) {
      for (const field of section.fields ?? []) {
        if (field.optionSource?.kind !== "team_cells") continue;
        field.options = (coreDesign.teamCells ?? [])
          .filter((cell) => cell.enabled && cell.teamId === field.optionSource.teamId && cell.kind === field.optionSource.cellKind)
          .map((cell) => ({ value: cell.id, label: cell.name }));
      }
    }
  }

  const resources = coreDesign?.resources;
  if (!Array.isArray(resources)) return hydrated;

  for (const resource of resources) {
    if (typeof resource?.sourcePath !== "string") continue;
    const bytes = await readFile(new URL(resource.sourcePath, sourceUrl));
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (digest !== resource.contentDigest) throw new Error(`Resource ${resource.id} digest mismatch`);
    resource.dataUri = `data:${resource.mediaType};base64,${bytes.toString("base64")}`;
    delete resource.sourcePath;
  }
  return hydrated;
}
