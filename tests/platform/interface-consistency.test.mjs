import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { compileRelease } from "../../packages/release-compiler/dist/index.js";
import { hydrateReleaseSourceAssets } from "../../scripts/release-source-assets.mjs";

const candidates = [
  ["fractured-order/fractured-order-interface-release", "fractured-order/fractured-order-release"],
  ["validation/crisis-response/interface-release", "validation/crisis-response/release"],
  ["validation/policy-negotiation/interface-release", "validation/policy-negotiation/release"]
];
for (const [candidate, previous] of candidates) {
  test(`PS-842-T02: ${candidate} has a new identity and coherent navigation`, async () => {
    const url = new URL(`../../definitions/${candidate}-source.json`, import.meta.url);
    const source = JSON.parse(await readFile(url, "utf8"));
    const old = JSON.parse(await readFile(new URL(`../../definitions/${previous}-source.json`, import.meta.url), "utf8"));
    assert.notEqual(source.releaseId, old.releaseId);
    assert.notEqual(source.semanticVersion, old.semanticVersion);
    assert.equal(source.projectId, old.projectId);
    const compiled = compileRelease(await hydrateReleaseSourceAssets(source, url));
    assert.equal(await readFile(new URL(`../../definitions/${candidate}.json`, import.meta.url), "utf8"), new TextDecoder().decode(compiled.bytes));
    const concepts = new Map();
    for (const profile of source.materialization.coreDesign.interfaces) {
      assert.ok(profile.navigation.items.length > 0);
      assert.ok(profile.navigation.items.some((item) => item.id === profile.navigation.defaultItemId));
      for (const item of profile.navigation.items) {
        const module = profile.layout.regions.find((region) => region.id === item.target.regionId)?.modules[0];
        assert.ok(module, `Missing destination: ${item.id}`);
        assert.equal(item.label, module.title, `${profile.id}/${item.id}`);
        if (["Strategic Actions", "Team Action Review", "View Actions", "Actions", "Strategic Orientation", "Red Actions/Responses"].includes(item.label)) {
          assert.equal(module.configuration.navigationIcon, "action", `Action concept icon: ${profile.id}/${item.id}`);
        }
        if (["rfis", "inbox", "proposals", "injects", "timeline", "tribe-street-journal", "verba"].includes(item.id)) {
          const signature = [item.label, item.order, module.configuration.navigationIcon, module.configuration.navigationSection];
          if (concepts.has(item.id)) assert.deepEqual(signature, concepts.get(item.id), `Shared concept drift: ${item.id}`);
          concepts.set(item.id, signature);
        }
      }
    }
  });
}
