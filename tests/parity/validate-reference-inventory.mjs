import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

import {
    ROLE_CAPABILITIES,
    SHIPPED_ROLE_PROFILES
} from '../../references/fractured-order/tests/contracts/roleCapabilityMatrix.js';
import {
    OPERATIONAL_SCOPE_EXCLUSIONS,
    SHIPPED_NON_PLI_OPERATIONAL_FEATURES
} from '../../references/fractured-order/tests/contracts/operationalFeatureManifest.js';

const root = resolve(import.meta.dirname, '../..');
const loadJson = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const inventory = loadJson('definitions/fractured-order/reference-inventory.json');
const fixtures = loadJson('tests/parity/fractured-order-fixture-plan.json');
const snapshot = loadJson('references/fractured-order.snapshot.json');

assert.equal(inventory.taskId, 'PS-000');
assert.equal(inventory.reference.commit, snapshot.sourceCommit);
assert.equal(inventory.reference.tree, snapshot.sourceTree);
assert.equal(inventory.reference.releaseDigest, `sha256:${snapshot.archiveSha256}`);
assert.equal(snapshot.verification.result, 'PASS');

const allowedCategories = new Set(inventory.canonCategories);
assert.deepEqual(
    [...allowedCategories].sort(),
    [
        'FO-CONFIGURATION',
        'LEGACY-DEFECT',
        'METHODOLOGY-CORE',
        'PARITY-UI',
        'PLATFORM-SERVICE',
        'PLUGIN',
        'SCENARIO-CONTENT'
    ]
);

const fixtureTargets = new Set(fixtures.targets.map(({ id }) => id));
assert.equal(fixtureTargets.size, fixtures.targets.length, 'Parity target IDs must be unique.');

function assertCompleteClassification(sourceName, sourceCapabilities, classifications) {
    assert.deepEqual(
        Object.keys(classifications).sort(),
        Object.keys(sourceCapabilities).sort(),
        `${sourceName} classification keys must exactly match the pinned source manifest.`
    );

    for (const [id, classification] of Object.entries(classifications)) {
        assert(allowedCategories.has(classification.category), `${sourceName}.${id} has an invalid category.`);
        assert(fixtureTargets.has(classification.parityTarget), `${sourceName}.${id} has no fixture target.`);
        if (classification.reviewState === 'blocked') {
            assert.equal(classification.reviewOwner, 'Methodology Lead');
            assert.equal(classification.dependency, 'OPEN-026');
        } else {
            assert.equal(classification.reviewState, 'classified');
        }

        for (const evidence of sourceCapabilities[id].evidence) {
            const evidencePath = resolve(root, 'references/fractured-order', evidence.file);
            assert(existsSync(evidencePath), `${sourceName}.${id} evidence file is missing: ${evidence.file}`);
            assert(
                readFileSync(evidencePath, 'utf8').includes(evidence.anchor),
                `${sourceName}.${id} lost evidence anchor: ${evidence.anchor}`
            );
        }
    }
}

assertCompleteClassification(
    'roleCapabilityMatrix',
    ROLE_CAPABILITIES,
    inventory.classifications.roleCapabilityMatrix
);
assertCompleteClassification(
    'operationalFeatureManifest',
    SHIPPED_NON_PLI_OPERATIONAL_FEATURES,
    inventory.classifications.operationalFeatureManifest
);

for (const item of inventory.additionalObservedItems) {
    assert(allowedCategories.has(item.category), `${item.id} has an invalid category.`);
    assert(fixtureTargets.has(item.parityTarget), `${item.id} has no fixture target.`);
    assert(existsSync(resolve(root, item.sourceLocation)), `${item.id} source location is missing.`);
    if (item.reviewState === 'blocked') {
        assert.equal(item.reviewOwner, 'Methodology Lead');
        assert.equal(item.dependency, 'OPEN-026');
    }
}

const hardCodingIds = new Set();
for (const item of inventory.hardCodingRegister) {
    assert(!hardCodingIds.has(item.id), `Duplicate hard-coding ID: ${item.id}`);
    hardCodingIds.add(item.id);
    assert(allowedCategories.has(item.category), `${item.id} has an invalid category.`);
    const [relativePath] = item.sourceLocation.split('::');
    const sourcePath = resolve(root, relativePath);
    assert(existsSync(sourcePath), `${item.id} source location is missing.`);
    assert(statSync(sourcePath).isFile() || statSync(sourcePath).isDirectory());
    if (item.reviewState === 'blocked') {
        assert.equal(item.reviewOwner, 'Methodology Lead');
        assert.equal(item.dependency, 'OPEN-026');
    }
}

assert(SHIPPED_ROLE_PROFILES.length > 0, 'No shipped role profiles were observed.');
assert(OPERATIONAL_SCOPE_EXCLUSIONS.every(({ id }) => id.startsWith('pli.')));
assert(fixtures.targets.some(({ scenarios }) => scenarios.some((scenario) => scenario.includes('cross-role denial'))));
assert(fixtures.targets.some(({ scenarios }) => scenarios.some((scenario) => scenario.includes('disconnect'))));
assert(fixtures.targets.some(({ scenarios }) => scenarios.some((scenario) => scenario.includes('stale'))));
assert(fixtures.targets.some(({ scenarios }) => scenarios.some((scenario) => scenario.includes('partial failure'))));

const blocked = [
    ...Object.values(inventory.classifications.roleCapabilityMatrix),
    ...Object.values(inventory.classifications.operationalFeatureManifest),
    ...inventory.additionalObservedItems,
    ...inventory.hardCodingRegister
].filter(({ reviewState }) => reviewState === 'blocked').length;

console.log(JSON.stringify({
    result: 'PASS',
    commit: inventory.reference.commit,
    tree: inventory.reference.tree,
    roleProfiles: SHIPPED_ROLE_PROFILES.length,
    roleCapabilities: Object.keys(ROLE_CAPABILITIES).length,
    operationalCapabilities: Object.keys(SHIPPED_NON_PLI_OPERATIONAL_FEATURES).length,
    hardCodingItems: inventory.hardCodingRegister.length,
    parityTargets: fixtures.targets.length,
    methodologyReviewBlocks: blocked
}, null, 2));
