import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { validateStudioDraft } from "../dist/index.js";
import { copySimulationTemplate, METHODOLOGY_CONTRACT_ID, METHODOLOGY_CONCEPT_REGISTRY, methodologyControls,
  projectEnabledConcepts, validateMethodologyConcepts } from "../../simulation-schema/dist/index.js";
import { STRUCTURED_FORM_CONTRACT_ID, FORM_LIMITS, BASIC_FIELD_TYPES, assertStructuredFormContract,
  validateRuntimeFormPayload, fieldEditable, assertFormExpressions, recomputeFormValues, parseFormattedText,
  importFormDefinition, importFormRecord, parseFormCsv, previewFormCsv, formRecordTables, runtimeFormValue, setRuntimeFormValue } from "../../simulation-schema/dist/index.js";

const boundedForm = (fields = []) => ({ contractId: STRUCTURED_FORM_CONTRACT_ID, id: "bounded", name: "Bounded", formVersion: "2",
  sections: [{ id: "details", fields }] });
const formField = (type, extra = {}) => ({ id: type, key: type, label: type, type, required: true, ...extra });

test("PS-830-T06 versioned Form/record interchange preserves types and refuses malformed or mismatched input", () => {
  const form = boundedForm([formField("short_text"), formField("number")]);
  const definition = { contractId: "form-interchange-v1", kind: "form", form };
  assert.deepEqual(importFormDefinition(JSON.stringify(definition)), form);
  const exported = { contractId: "form-interchange-v1", kind: "record", artifactId: "record", governingReleaseId: "release", formId: form.id, formVersion: "2", payload: { short_text: "Text", number: 2.5 } };
  assert.deepEqual(importFormRecord(JSON.stringify(exported), form, "release"), exported.payload);
  for (const text of ["{", JSON.stringify({ ...definition, contractId: "unknown" }), JSON.stringify({ ...definition, form: {} }),
    '{"contractId":"form-interchange-v1","kind":"form","form":{"__proto__":{"polluted":true}}}', "x".repeat(2_000_001)]) assert.throws(() => importFormDefinition(text));
  for (const invalid of [{ ...exported, formVersion: "1" }, { ...exported, governingReleaseId: "other" }, { ...exported, artifactId: null },
    { ...exported, payload: { number: "bad" } }, { ...exported, unexpected: true }]) assert.throws(() => importFormRecord(JSON.stringify(invalid), form, "release"));
  assert.throws(() => setRuntimeFormValue({}, "__proto__.polluted", true), /Unsafe/u);
  assert.throws(() => setRuntimeFormValue({}, "nested.constructor.polluted", true), /Unsafe/u);
  assert.equal(runtimeFormValue({}, "constructor"), undefined);
  assert.equal({}.polluted, undefined);
});

test("PS-830-T06 attachment manifests preserve identity without importing file authority or bytes", () => {
  const form = boundedForm([formField("short_text")]);
  const file = { id: "83000000-0000-4000-8000-000000000001", fileName: "proof.txt", mediaType: "text/plain", sizeBytes: FORM_LIMITS.attachmentBytes,
    sha256: "a".repeat(64), scanStatus: "clean", retentionPolicyId: "83000000-0000-4000-8000-000000000002", expiresAt: "2026-11-10T00:00:00.000Z" };
  const files = Array.from({ length: 5 }, (_, index) => ({ ...file, id: `83000000-0000-4000-8000-${String(index + 3).padStart(12, "0")}` }));
  const record = { contractId: "form-interchange-v1", kind: "record", artifactId: "record", governingReleaseId: "release", formId: form.id, formVersion: "2",
    payload: { short_text: "Values only" }, attachmentManifest: { bytesIncluded: false, files } };
  assert.deepEqual(importFormRecord(JSON.stringify(record), form, "release"), record.payload);
  for (const invalid of [{ bytesIncluded: true, files }, { bytesIncluded: false, files: [...files, file] }, { bytesIncluded: false, files: [file, file] },
    ...[{ fileName: "" }, { fileName: "../proof.txt" }, { id: "invalid" }, { retentionPolicyId: "invalid" }, { mediaType: "text/html" },
      { sizeBytes: FORM_LIMITS.attachmentBytes + 1 }, { sizeBytes: 0 }, { sha256: "wrong" }, { scanStatus: "pending" }, { expiresAt: "invalid" },
      { contentBase64: "not-allowed" }].map((change) => ({ bytesIncluded: false, files: [{ ...file, ...change }] }))]) {
    assert.throws(() => importFormRecord(JSON.stringify({ ...record, attachmentManifest: invalid }), form, "release"), /manifest/u);
  }
});

test("PS-830-T06 CSV mapping is bounded, typed and explicit; linked tables preserve record identities", () => {
  const form = boundedForm([formField("short_text"), formField("number"), formField("yes_no")]);
  const csv = parseFormCsv('Label,Amount,Ready\r\n"Text, with ""quotes""\nand lines",2.5,no\r\n');
  const preview = previewFormCsv(form, csv, { Label: "short_text", Amount: "number", Ready: "yes_no" });
  assert.deepEqual(preview, [{ rowNumber: 2, payload: { short_text: 'Text, with "quotes"\nand lines', number: 2.5, yes_no: false }, issues: [] }]);
  assert.throws(() => previewFormCsv(form, csv, {}), /Map at least/u);
  assert.throws(() => previewFormCsv(form, csv, { Label: "number", Amount: "number" }), /distinct/u);
  assert.throws(() => previewFormCsv(form, csv, { Label: "unknown" }), /declared/u);
  assert.ok(previewFormCsv(form, parseFormCsv("Amount\nnot-a-number"), { Amount: "number" })[0].issues.length);
  for (const invalid of ['A,A\n1,2', 'A\n"unfinished', 'A\n"closed"junk', 'A\n1,2', 'A\n' + 'x\n'.repeat(101),
    Array.from({ length: 101 }, (_, i) => `C${i}`).join(","), "A\n" + "x".repeat(FORM_LIMITS.structuredBytes)]) assert.throws(() => parseFormCsv(invalid));
  assert.equal(parseFormCsv("A\n" + "x\n".repeat(100)).rows.length, 100);
  assert.equal(parseFormCsv("A\n" + "x".repeat(FORM_LIMITS.structuredBytes - 2)).rows.length, 1);
  form.sections.push({ id: "items", repeatable: true, fields: [formField("short_text", { key: "label" })] });
  const source = { contractId: "form-interchange-v1", kind: "record", artifactId: "record", governingReleaseId: "release", formId: form.id, formVersion: "2",
    payload: { short_text: "=HYPERLINK(unsafe)", number: -2, yes_no: false, items: [{ label: "First" }, { label: "Second" }] } };
  const tables = formRecordTables(form, [source]);
  assert.equal(tables.length, 2);
  assert.match(tables[0].csv, /"'=HYPERLINK/u);
  assert.match(tables[0].csv, /"-2"/u);
  assert.deepEqual(parseFormCsv(tables[1].csv).rows, [["record", "items", "1", "First"], ["record", "items", "2", "Second"]]);
  assert.equal(source.payload.short_text, "=HYPERLINK(unsafe)");
});

test("PS-830-T06 attachments require explicit versioned file types and preserve legacy Form behavior", () => {
  const form = boundedForm([formField("short_text")]);
  form.attachments = { contractId: "form-attachments-v1", allowedMediaTypes: ["text/plain", "application/pdf"] };
  assert.doesNotThrow(() => assertStructuredFormContract(form));
  for (const attachments of [{ ...form.attachments, contractId: "unknown" }, { ...form.attachments, allowedMediaTypes: [] },
    { ...form.attachments, allowedMediaTypes: ["text/html"] }, { ...form.attachments, allowedMediaTypes: ["text/plain", "text/plain"] },
    { ...form.attachments, allowUnscanned: true }]) assert.throws(() => assertStructuredFormContract({ ...form, attachments }), /attachments/u);
  assert.throws(() => assertStructuredFormContract({ ...form, contractId: undefined }), /structured-form-v2/u);
});

test("PS-830-T04 approved basic fields accept canonical values and reject wrong types", () => {
  const cases = {
    short_text: ["Short", 1], long_text: ["Long text", {}], number: [2.5, "2.5"], yes_no: [false, "false"],
    date: ["2024-02-29", "2025-02-29"], time: ["23:59:59", "24:00:00"], date_time: ["2026-11-08T12:30:00.000Z", "2026-11-08T12:30:00-05:00"],
    currency: [12.25, 12.251], percentage: [50.25, 100.001], single_select: ["one", "bad"], multi_select: [["one"], ["bad"]],
    artifact_reference: [["artifact"], "artifact"], entity_reference: ["team", "unavailable"], formatted_text: ["A **safe** paragraph", "<script>alert(1)</script>"]
  };
  assert.deepEqual(Object.keys(cases), [...BASIC_FIELD_TYPES]);
  for (const [type, [valid, invalid]] of Object.entries(cases)) {
    const field = formField(type, {
      ...(type === "currency" || type === "percentage" ? { numeric: { unit: type === "currency" ? "EUR" : "%", precision: 2 }, validation: { min: 0, max: 100 } } : {}),
      ...(type.endsWith("select") ? { options: [{ value: "one", label: "One" }] } : {}),
      ...(type === "entity_reference" ? { entityReference: { kind: "team", multiple: false }, options: [{ value: "team", label: "Team" }] } : {}),
      ...(type === "formatted_text" ? { formattedTextContractId: "formatted-text-v1" } : {})
    });
    const form = boundedForm([field]);
    assert.doesNotThrow(() => assertStructuredFormContract(form));
    assert.deepEqual(validateRuntimeFormPayload(form, { [type]: valid }), [], type);
    assert.ok(validateRuntimeFormPayload(form, { [type]: invalid }).length > 0, type);
    assert.deepEqual(JSON.parse(JSON.stringify({ form, payload: { [type]: valid } })), { form, payload: { [type]: valid } });
  }
});

const literal = (value) => ({ kind: "literal", value });
const operation = (operator, ...args) => ({ kind: "operation", operator, arguments: args });
const computation = (expression) => ({ contractId: "form-expression-v1", version: "formula-1", expression });
test("PS-830-T05 deterministic expressions replace forged values, respect precision and preserve versions", () => {
  for (const [operator, a, b, expected] of [["add", 3, 2, 5], ["subtract", 3, 2, 1], ["multiply", 3, 2, 6], ["divide", 3, 2, 1.5],
    ["greater_than", 3, 2, true], ["less_than", 3, 2, false], ["equals", "same", "same", true]]) {
    const form = boundedForm([formField(typeof expected === "boolean" ? "yes_no" : "number", { key: "result", computation: computation(operation(operator, literal(a), literal(b))) })]);
    assert.doesNotThrow(() => assertStructuredFormContract(form));
    const source = { result: "forged" };
    assert.deepEqual(recomputeFormValues(form, source), { payload: { result: expected }, issues: [] });
    assert.deepEqual(source, { result: "forged" });
  }
  const form = boundedForm([formField("number", { key: "amount" }), formField("number", { key: "result", numeric: { unit: "units", precision: 2 },
    computation: computation(operation("if", operation("greater_than", { kind: "field", key: "amount" }, literal(0)), operation("divide", { kind: "field", key: "amount" }, literal(3)), literal(0))) })]);
  const result = recomputeFormValues(form, { amount: 1, result: 999 });
  assert.deepEqual(result, { payload: { amount: 1, result: 0.33 }, issues: [] });
  assert.deepEqual(recomputeFormValues(JSON.parse(JSON.stringify(form)), { amount: 1 }), result);
  assert.equal(form.sections[0].fields[1].computation.version, "formula-1");
  assert.equal(fieldEditable(form.sections[0].fields[1], "participant", "draft"), false);
});

test("PS-830-T05 counts and totals evaluate typed repeating inputs and computed dependencies", () => {
  const form = boundedForm([
    formField("number", { key: "count", computation: computation({ kind: "count", sectionId: "items" }) }),
    formField("number", { key: "total", computation: computation({ kind: "total", sectionId: "items", field: "doubled" }) })
  ]);
  form.sections.push({ id: "items", repeatable: true, fields: [formField("number", { key: "amount" }),
    formField("number", { key: "doubled", computation: computation(operation("multiply", { kind: "field", key: "amount" }, literal(2))) })] });
  assert.doesNotThrow(() => assertStructuredFormContract(form));
  assert.deepEqual(recomputeFormValues(form, { items: [{ amount: 2 }, { amount: 3 }] }), {
    payload: { count: 2, total: 10, items: [{ amount: 2, doubled: 4 }, { amount: 3, doubled: 6 }] }, issues: [] });
  assert.ok(recomputeFormValues(form, { items: [{}] }).issues.some(({ message }) => /Missing input/u.test(message)));
  assert.throws(() => assertFormExpressions(form, ["items"]), /excluded/u);
});

test("PS-830-T05 rejects cycles, external or hidden inputs, unbounded trees, code and invalid arithmetic", () => {
  const form = boundedForm([formField("number", { key: "a", computation: computation({ kind: "field", key: "b" }) }),
    formField("number", { key: "b", computation: computation({ kind: "field", key: "a" }) })]);
  assert.throws(() => assertStructuredFormContract(form), /cycle/u);
  delete form.sections[0].fields[1].computation;
  assert.throws(() => assertFormExpressions(form, ["b"]), /excluded/u);
  form.sections[0].fields[0].computation.expression = { kind: "field", key: "session.secret" };
  assert.throws(() => assertStructuredFormContract(form), /out-of-scope/u);
  form.sections[0].fields[0].computation.expression = { kind: "script", code: "fetch('https://example.org')" };
  assert.throws(() => assertStructuredFormContract(form), /unsupported/u);
  form.sections[0].fields[0].computation.expression = operation("divide", literal(1), literal(0));
  assert.match(recomputeFormValues(form, { b: 2, a: 123 }).issues[0].message, /Division by zero/u);
  assert.equal(recomputeFormValues(form, { b: 2, a: 123 }).payload.a, null);
  form.sections[0].fields[0].computation.expression = operation("multiply", literal(Number.MAX_SAFE_INTEGER), literal(2));
  assert.match(recomputeFormValues(form, { b: 2 }).issues[0].message, /safe numeric range/u);
  let tree = literal(1); for (let i = 0; i < 8; i++) tree = operation("add", tree, literal(1));
  form.sections[0].fields[0].computation.expression = tree;
  assert.throws(() => assertStructuredFormContract(form), /8 levels/u);
  const balanced = (leaves) => leaves === 1 ? literal(1) : operation("add", balanced(Math.floor(leaves / 2)), balanced(Math.ceil(leaves / 2)));
  form.sections[0].fields[0].computation.expression = operation("if", literal(true), balanced(49), literal(0));
  assert.doesNotThrow(() => assertStructuredFormContract(form), "100 nodes and 8 levels are allowed");
  form.sections[0].fields[0].computation.expression = balanced(51);
  assert.throws(() => assertStructuredFormContract(form), /100 nodes/u, "101 nodes are rejected");
  form.sections[0].fields[0].computation.expression = operation("add", literal("wrong"), literal(1));
  assert.throws(() => assertStructuredFormContract(form), /require numbers/u);
  delete form.contractId;
  assert.throws(() => assertStructuredFormContract(form), /structured-form-v2/u);
});

test("PS-830-T05 formatted text preserves paragraphs, lists, emphasis and safe links without HTML", () => {
  const blocks = parseFormattedText("Plain **bold** and *emphasis*.\n\n- First\n- [Reference](https://example.org/path?q=1)\n\n1. One\n2. Two");
  assert.deepEqual(blocks.map(({ kind }) => kind), ["paragraph", "bullet_list", "numbered_list"]);
  assert.equal(blocks[1].items[1][0].href, "https://example.org/path?q=1");
  for (const input of ["<script>alert(1)</script>", "<img src=x onerror=alert(1)>", "[bad](javascript:alert)", "[bad](data:text/html,evil)",
    "[bad](file:///etc/passwd)", "[bad](https://user:password@example.org)", "![image](https://example.org/image.png)", "```code```"]) {
    assert.throws(() => parseFormattedText(input));
  }
  assert.deepEqual(parseFormattedText("&lt;script&gt;"), [{ kind: "paragraph", content: [{ kind: "text", text: "&lt;script&gt;" }] }]);
  assert.throws(() => parseFormattedText(Array.from({ length: 201 }, () => "Text").join("\n\n")), /200 blocks/u);
  assert.throws(() => parseFormattedText(Array.from({ length: 2001 }, () => "- ").join("\n")), /2000 list items/u);
  assert.equal(parseFormattedText("[".repeat(20000))[0].content[0].text.length, 20000);
});

test("PS-830-T04 exact limits, one-over cases, decimal MB and UTF-8 structured bytes", () => {
  assert.equal(FORM_LIMITS.attachmentBytes, 20_000_000);
  assert.equal(FORM_LIMITS.totalAttachmentBytes, 100_000_000);
  const form = boundedForm();
  form.sections = Array.from({ length: 20 }, (_, index) => ({ id: `section${index}`, fields: Array.from({ length: 5 }, (_, j) => formField("short_text", { id: `field${index}_${j}`, key: `field${index}_${j}` })) }));
  assert.doesNotThrow(() => assertStructuredFormContract(form));
  form.sections[0].fields.push(formField("number"));
  assert.throws(() => assertStructuredFormContract(form), /100/u);
  form.sections[0].fields.pop(); form.sections.push({ id: "extra", fields: [] });
  assert.throws(() => assertStructuredFormContract(form), /20/u);
  const repeating = boundedForm([formField("number")]); repeating.sections[0].repeatable = true;
  assert.deepEqual(validateRuntimeFormPayload(repeating, { details: Array.from({ length: 50 }, () => ({ number: 0 })) }), []);
  assert.ok(validateRuntimeFormPayload(repeating, { details: Array.from({ length: 51 }, () => ({ number: 0 })) }, { draft: true }).length > 0);
  repeating.sections[0].maxItems = 51; assert.throws(() => assertStructuredFormContract(repeating), /50/u);
  repeating.sections[0].maxItems = 50; repeating.sections[0].sections = [];
  assert.throws(() => assertStructuredFormContract(repeating), /nested/u);
  const textForm = boundedForm([formField("long_text")]);
  const overhead = Buffer.byteLength(JSON.stringify({ long_text: "" }));
  const content = { long_text: "é".repeat(Math.floor((FORM_LIMITS.structuredBytes - overhead) / 2)) + "a".repeat((FORM_LIMITS.structuredBytes - overhead) % 2) };
  assert.equal(Buffer.byteLength(JSON.stringify(content)), FORM_LIMITS.structuredBytes);
  assert.deepEqual(validateRuntimeFormPayload(textForm, content), []);
  content.long_text += "a";
  assert.match(validateRuntimeFormPayload(textForm, content, { draft: true })[0].message, /UTF-8 JSON bytes/u);
  delete textForm.contractId;
  assert.deepEqual(validateRuntimeFormPayload(textForm, content), [], "historical contract not retroactively constrained");
});

test("PS-830-T04 conditions, hidden type validation, draft bounds and editability remain server-enforceable", () => {
  const answer = formField("long_text", { required: false, requiredWhen: { field: "yes_no", operator: "equals", value: false },
    visibleWhen: { field: "yes_no", operator: "equals", value: false }, editableBySessionRoleIds: ["reviewer"], editableInWorkflowStates: ["review"] });
  const form = boundedForm([formField("yes_no"), answer]);
  assert.ok(validateRuntimeFormPayload(form, { yes_no: false }).some(({ field }) => field === "long_text"));
  assert.deepEqual(validateRuntimeFormPayload(form, { yes_no: false }, { draft: true }), []);
  assert.ok(validateRuntimeFormPayload(form, { yes_no: true, long_text: {} }, { draft: true }).length > 0);
  assert.ok(validateRuntimeFormPayload(form, { yes_no: false, unknown: 1 }).length > 0);
  assert.equal(fieldEditable(answer, "reviewer", "review"), true);
  assert.equal(fieldEditable(answer, "participant", "review"), false);
  assert.equal(fieldEditable(answer, "reviewer", "draft"), false);
  assert.equal(fieldEditable({ ...answer, readOnly: true }, "reviewer", "review"), false);
  answer.key = "constructor.polluted"; assert.throws(() => assertStructuredFormContract(form), /unsafe/u);
});

async function fixture() {
  const release = JSON.parse(await readFile(new URL("../../../definitions/fractured-order/fractured-order-release.json", import.meta.url), "utf8"));
  return { coreDesign: release.coreDesign, scenario: release.scenario };
}

function simpleDesign() {
  return {
    coreDesign: { pluginBindings: [], methodologyContractId: METHODOLOGY_CONTRACT_ID,
      teams: [], sessionRoles: [{ id: "participant", name: "Participant", capabilities: [], interfaceProfileIds: ["main"], isControlRole: false, enabled: true }],
      seats: [{ id: "seat", name: "Participant", sessionRoleIds: ["participant"], minOccupancy: 1, maxOccupancy: null, required: true, joinMode: "operator_assignment" }],
      stageGroups: [], stages: [{ id: "exercise", name: "Exercise", stageType: "exercise", allowedActivityIds: [], transitions: [] }],
      artifactTypes: [], forms: [], workflows: [], informationPolicies: [],
      communications: { messageChannels: [], routes: [], voiceChannels: [] },
      interfaces: [{ id: "main", name: "Workspace", selectors: { sessionRoleIds: ["participant"] },
        layout: { template: "single_column", regions: [{ id: "main", modules: [{ id: "status", moduleType: "session_status", configuration: {} }] }] },
        navigation: { items: [] } }], reports: [] },
    scenario: { id: "exercise", name: "Learning exercise", description: "One Stage", deliveryModes: ["in_person"], tags: [], injects: [] }
  };
}

test("PS-830-T03 a one-Stage learning exercise needs no optional mechanics or research protocol", () => {
  const draft = simpleDesign();
  draft.coreDesign.methodologyConcepts = methodologyControls(draft.coreDesign).map((item) => ({ ...item,
    enabled: METHODOLOGY_CONCEPT_REGISTRY.find(({ key }) => key === item.key).mandatory }));
  assert.deepEqual(validateStudioDraft(draft).issues, []);
  for (const key of ["stages", "sessionRoles", "seats"]) {
    const missing = structuredClone(draft);
    missing.coreDesign[key] = [];
    assert.ok(validateStudioDraft(missing).issues.some(({ code }) => code === "methodology.minimum_structure"));
  }
});

test("PS-830-T03 foundations cannot be disabled through forged labels or dependency hints", () => {
  for (const concept of METHODOLOGY_CONCEPT_REGISTRY.filter(({ mandatory }) => mandatory)) {
    const draft = simpleDesign();
    draft.coreDesign.methodologyConcepts = [{ key: concept.key, label: "Optional", enabled: false, dependsOn: [] }];
    assert.ok(validateStudioDraft(draft).issues.some(({ code }) => code === "methodology.foundation_required"), concept.key);
  }
});

test("PS-830-T03 retained inactive content is excluded without mutating the authored Draft", () => {
  const draft = simpleDesign();
  draft.coreDesign.methodologyConcepts = [{ key: "team", label: "Renamed", enabled: false, dependsOn: [] }];
  draft.coreDesign.teams = [{ id: "retained", name: "Retained team", enabled: true, objectiveIds: [] }];
  const before = structuredClone(draft);
  assert.deepEqual(validateStudioDraft(draft).issues, []);
  assert.deepEqual(projectEnabledConcepts(draft).coreDesign.teams, []);
  assert.deepEqual(draft, before);
  const workflow = { id: "retained-workflow", initialState: "draft", states: [{ key: "draft" }] };
  draft.coreDesign.workflows = [workflow];
  draft.coreDesign.methodologyConcepts.push({ key: "state_variable", label: "State Variable", enabled: false, dependsOn: [] });
  assert.deepEqual(projectEnabledConcepts(draft).coreDesign.workflows, [workflow]);
  draft.coreDesign.workflows = [];
  draft.coreDesign.seats[0].teamId = "retained";
  const issue = validateStudioDraft(draft).issues.find(({ code }) => code === "methodology.disabled_dependency");
  assert.equal(issue.path, "seats.seat.teamId");
  assert.match(issue.message, /Enable.*remove this reference/u);
  assert.match(issue.message, /^Participant requires Team/u);
  assert.doesNotMatch(issue.message, /seats\.seat/u);
});

test("PS-830-T03 actual references cover Gates, interfaces, capability costs and decision types", () => {
  const cases = [
    ["state_variable", (core) => { core.stages[0].entryGate = { operator: "all", conditions: [{ fact: "state.energy", operator: "equals", value: 1 }] }; }],
    ["inject", (core) => { core.interfaces[0].layout.regions[0].modules[0].moduleType = "inject_inbox"; }],
    ["resource", (core) => { core.capabilities = [{ id: "cap", costs: [{ resourceId: "fuel", amount: 1 }] }]; }],
    ["decision_record", (core) => { core.artifactTypes = [{ id: "decision", decisionBearing: true }]; core.interfaces[0].layout.regions[0].modules[0].configuration = { artifactTypeId: "decision" }; }]
  ];
  for (const [key, mutate] of cases) {
    const draft = simpleDesign();
    draft.coreDesign.methodologyConcepts = [{ key, label: "Translated label", enabled: false, dependsOn: [] }];
    mutate(draft.coreDesign);
    assert.ok(validateMethodologyConcepts(draft).some(({ code }) => code === "methodology.disabled_dependency"), key);
  }
  const draft = simpleDesign();
  draft.coreDesign.methodologyConcepts = [{ key: "resource", label: "Resource", enabled: false, dependsOn: [] }];
  draft.coreDesign.capabilities = [{ id: "cap", costs: [] }];
  assert.deepEqual(validateMethodologyConcepts(draft), []);
});

test("PS-830-T03 Forms owned only by inactive Decision Records are retained outside execution", () => {
  const draft = simpleDesign();
  draft.coreDesign.methodologyConcepts = [{ key: "decision_record", label: "Decision Record", enabled: false, dependsOn: [] }];
  draft.coreDesign.artifactTypes = [{ id: "decision", decisionBearing: true, formId: "decision-form", workflowId: "decision-workflow" }];
  draft.coreDesign.forms = [{ id: "decision-form", sections: [] }];
  draft.coreDesign.workflows = [{ id: "decision-workflow" }];
  assert.deepEqual(validateStudioDraft(draft).issues, []);
  const active = projectEnabledConcepts(draft);
  assert.deepEqual(active.coreDesign.artifactTypes, []);
  assert.deepEqual(active.coreDesign.forms, []);
  assert.deepEqual(active.coreDesign.workflows, []);
  assert.equal(draft.coreDesign.forms.length, 1);
});

test("PS-830-T03 original Fractured Order remains valid and legacy snapshots are not rewritten", async () => {
  const draft = await fixture();
  assert.deepEqual(validateStudioDraft(draft).issues, []);
  assert.deepEqual(projectEnabledConcepts(draft), draft);
  draft.coreDesign.methodologyContractId = METHODOLOGY_CONTRACT_ID;
  draft.coreDesign.methodologyConcepts = methodologyControls(draft.coreDesign);
  assert.ok(validateStudioDraft(draft).issues.some(({ code }) => code === "methodology.output_required"));
  draft.coreDesign.adjudicationModels[0].output = { outcomeCategories: ["accepted", "returned"], rationaleRequired: true,
    confidenceRequired: false, stateEffects: [], followOnInjectIds: [] };
  assert.deepEqual(validateStudioDraft(draft).issues, []);
});

test("SYNC-01 validation blocks an invalid merged workflow with a source link", async () => {
  const invalid = structuredClone(await fixture());
  invalid.coreDesign.workflows[0].initialState = "missing-state";
  const report = validateStudioDraft(invalid);
  assert.equal(report.valid, false);
  assert.equal(report.issues.length > 0, true);
  assert.match(report.issues[0].message, /Workflow/u);
  assert.match(report.issues[0].path, /^workflows\./u);
  assert.match(report.reportDigest, /^[0-9a-f]{64}$/u);
});

test("PS-310-T01 REQ-011 defect catalog blocks Publication with targeted messages", async (context) => {
  const cases = [
    ["duplicate identifier", "core_design.invalid", (draft) => { draft.coreDesign.teams[1].id = draft.coreDesign.teams[0].id; }],
    ["missing reference", "core_design.invalid", (draft) => { draft.coreDesign.seats[0].sessionRoleIds = ["missing-role"]; }],
    ["Stage with no exit", "stage.no_exit", (draft) => { draft.coreDesign.stages[0].transitions = []; }],
    ["circular automatic Stages", "stage.automatic_cycle", (draft) => {
      draft.coreDesign.stages[0].transitions = [{ id: "cycle-a", targetStageId: draft.coreDesign.stages[1].id, mode: "automatic" }];
      draft.coreDesign.stages[1].transitions = [{ id: "cycle-b", targetStageId: draft.coreDesign.stages[0].id, mode: "automatic" }];
    }],
    ["workflow without terminal state", "core_design.invalid", (draft) => { draft.coreDesign.workflows[0].states.forEach((state) => { state.kind = "review"; }); }],
    ["unassigned task", "workflow.task_unassigned", (draft) => { draft.coreDesign.workflows[0].states[1] = { key: "with_facilitator", label: "Unassigned", kind: "task" }; }],
    ["approval without approver", "workflow.approver_required", (draft) => { draft.coreDesign.workflows[0].states[1] = { key: "with_facilitator", label: "Approval", kind: "approval" }; }],
    ["impossible Inject condition", "scenario.invalid", (draft) => { draft.scenario.injects[0].releaseMode = "gate"; delete draft.scenario.injects[0].releaseGate; }],
    ["inaccessible interface module", "interface.policy_inaccessible", (draft) => { draft.coreDesign.interfaces[0].layout.regions[0].modules[0].configuration.informationPolicyId = "policy-team-control"; }],
    ["missing effect target", "effect.reference_missing", (draft) => { draft.scenario.injects[0].effects = [{ stateVariableId: "missing-state", operation: "set", value: 1 }]; }],
    ["route without recipient", "core_design.invalid", (draft) => { draft.coreDesign.communications.routes[0].recipient = {}; }],
    ["report source unavailable", "report.data_unavailable", (draft) => { draft.coreDesign.reports[0].sections[0].source = "missing-source"; }],
    ["permission contradiction", "permission.contradiction", (draft) => {
      const roleId = draft.coreDesign.seats[0].sessionRoleIds[0];
      draft.coreDesign.sessionRoles.find(({ id }) => id === roleId).enabled = false;
    }],
    ["Information Policy leakage", "information_policy.leakage", (draft) => { draft.coreDesign.communications.routes[0].recipient = { public: true }; }],
    ["disabled concept dependency", "methodology.disabled_dependency", (draft) => { draft.coreDesign.methodologyConcepts = [{ key: "team", label: "Team", enabled: false, dependsOn: ["seat"] }]; }],
    ["missing decision trace", "research.traceability_missing", (draft) => { draft.coreDesign.decisionTraceability = []; }]
  ];
  for (const [name, code, mutate] of cases) await context.test(name, async () => {
    const draft = structuredClone(await fixture());
    mutate(draft);
    const report = validateStudioDraft(draft);
    assert.equal(report.valid, false);
    assert.ok(report.issues.some((item) => item.code === code), `${name} should report ${code}: ${JSON.stringify(report.issues)}`);
    assert.ok(report.issues.every((item) => item.message.length > 0 && item.path.length > 0));
  });
});

test("PS-310-T02 INV-007 template copies omit Scenario content unless explicitly selected", async () => {
  const source = await fixture();
  const omitted = copySimulationTemplate(source.coreDesign, source.scenario, "project-copy-default", "scenario-copy-default");
  assert.equal(omitted.projectId, "project-copy-default");
  assert.deepEqual(omitted.scenario, { id: "scenario-copy-default", name: "Untitled Scenario", description: "", deliveryModes: [], tags: [] });
  assert.notEqual(omitted.coreDesign, source.coreDesign);
  const included = copySimulationTemplate(source.coreDesign, source.scenario, "project-copy-explicit", "scenario-copy-explicit", true);
  assert.equal(included.projectId, "project-copy-explicit");
  assert.equal(included.scenario.id, "scenario-copy-explicit");
  assert.deepEqual(included.scenario.content, source.scenario.content);
  assert.notEqual(included.scenario.content, source.scenario.content);
});

test("PS-320 VOTE-15 rejects implicit Poll rules and gated ballot modes", async (context) => {
  const cases = [
    ["implicit denominator", "poll.counting_rule_incomplete", (poll) => { delete poll.thresholdRule.denominator; }],
    ["implicit tie rule", "poll.counting_rule_incomplete", (poll) => { delete poll.tieRule; }],
    ["secret ballot", "poll.secret_ballot_policy_pending", (poll) => { poll.secrecy = "secret_ballot"; }],
    ["anonymous survey", "poll.anonymous_survey_unavailable", (poll) => { poll.secrecy = "anonymous_survey"; }]
  ];
  for (const [name, code, mutate] of cases) await context.test(name, async () => {
    const draft = structuredClone(await fixture());
    const poll = {
      id: "vote-proof", scope: "session", question: "Proceed?", options: [{ id: "yes", label: "Yes" }, { id: "no", label: "No" }],
      pollType: "single_choice", minSelections: 1, maxSelections: 1, tallyMethod: "builtin_count", tallyMethodVersion: "1",
      electoratePolicyId: draft.coreDesign.informationPolicies[0].id, oneBallotPer: "seat_assignment", allowRevote: false, secrecy: "open",
      thresholdRule: { kind: "simple_majority", denominator: "valid_votes", abstentionCountsTowardDenominator: false },
      quorumRule: { basis: "electorate_at_open", minimum: 0, abstentionCountsTowardParticipation: true }, weights: [], vetoRule: { holderSeatIds: [] },
      tieRule: "no_decision", openTrigger: { mode: "manual" }, closeTrigger: { mode: "manual" }, deadlinePolicy: { graceSeconds: 0 },
      resultVisibilityPolicyId: draft.coreDesign.informationPolicies[0].id, certificationPolicy: {}
    };
    mutate(poll);
    draft.coreDesign.polls = [poll];
    const report = validateStudioDraft(draft);
    assert.ok(report.issues.some((item) => item.code === code), `${name} should report ${code}: ${JSON.stringify(report.issues)}`);
  });
});

test("PS-320 VOICE-09 validates Media Provider capability per target profile", async () => {
  const draft = structuredClone(await fixture());
  const adapterId = draft.coreDesign.communications.voiceChannels[0].mediaProviderAdapterBindingId;
  const adapter = draft.coreDesign.platformAdapters.find(({ id }) => id === adapterId);
  adapter.kind = "media_provider";
  adapter.voiceCapabilities = [
    { profile: "cloud", modes: ["radio_ptt"], recording: false, transcription: false },
    { profile: "institutional", modes: [], recording: false, transcription: false },
    { profile: "air_gapped", modes: ["radio_ptt"], recording: false, transcription: false }
  ];
  const report = validateStudioDraft(draft);
  assert.ok(report.issues.some(({ code, message }) => code === "voice.adapter_capability_missing" && /institutional/u.test(message)));
});

test("PS-400-T01/T02 validates typed Gates and rejects unknown Facts", async () => {
  const rehearsal = JSON.parse(await readFile(new URL("../../../definitions/crisis-response/ps-400-rehearsal.json", import.meta.url), "utf8"));
  const valid = structuredClone(await fixture());
  valid.coreDesign.stateVariables = [{ ...rehearsal.stateVariable,
    informationPolicyId: valid.coreDesign.informationPolicies[0].id }];
  valid.coreDesign.stages[0].completionGate = rehearsal.stages[0].completionGate;
  assert.equal(validateStudioDraft(valid).valid, true);

  valid.coreDesign.stages[0].completionGate.conditions[0].fact = "state.not-in-the-release";
  const report = validateStudioDraft(valid);
  assert.equal(report.valid, false);
  assert.ok(report.issues.some(({ message }) => /unknown Fact state\.not-in-the-release/u.test(message)));
});

test("PS-400-T01 validates bounded parallel branches with an explicit join", async () => {
  const draft = structuredClone(await fixture());
  const fork = draft.coreDesign.stages[0];
  const join = draft.coreDesign.stages[1];
  const controls = { allowStart: false, allowEnd: false, allowReopen: false, allowExtend: false,
    allowSkip: false, allowReturnToPrevious: false, requireReason: true };
  const branch = (id) => ({ id, name: id, stageType: "phase", order: 1, timerMode: "none", allowedActivityIds: [],
    transitions: [{ id: `${id}-join`, targetStageId: join.id, mode: "automatic" }], operatorControls: controls });
  fork.transitionMode = "parallel";
  fork.parallelJoinStageId = join.id;
  fork.transitions = [
    { id: "fork-a", targetStageId: "bounded-a", mode: "automatic" },
    { id: "fork-b", targetStageId: "bounded-b", mode: "automatic" }
  ];
  join.joinMode = "all";
  draft.coreDesign.stages.splice(1, 0, branch("bounded-a"), branch("bounded-b"));
  assert.equal(validateStudioDraft(draft).valid, true);

  draft.coreDesign.stages.find(({ id }) => id === "bounded-b").transitions[0].mode = "manual";
  const report = validateStudioDraft(draft);
  assert.equal(report.valid, false);
  assert.ok(report.issues.some(({ message }) => /bounded automatic logic/u.test(message)));
});

test("PS-730-T01 foundational Activities, nested Stage Groups, and role restrictions validate as one Runtime model", async () => {
  const draft = structuredClone(await fixture());
  const role = draft.coreDesign.sessionRoles[0];
  const artifact = draft.coreDesign.artifactTypes[0];
  const stage = draft.coreDesign.stages[0];
  draft.coreDesign.activities = [{
    id: "activity-foundation", name: "Foundation activity", description: "A guided activity",
    instructions: "Complete the governed work.", sessionRoleIds: [role.id], artifactTypeIds: [artifact.id], required: true
  }];
  stage.allowedActivityIds = ["activity-foundation"];
  role.allowedStageIds = [stage.id];
  draft.coreDesign.stageGroups.push(
    { id: "group-parent", name: "Parent", stageType: "phase", order: 0 },
    { id: "group-child", name: "Child", stageType: "round", order: 0, parentGroupId: "group-parent" }
  );
  stage.stageGroupId = "group-child";
  assert.equal(validateStudioDraft(draft).valid, true);

  draft.coreDesign.activities[0].sessionRoleIds = ["missing-role"];
  const report = validateStudioDraft(draft);
  assert.equal(report.valid, false);
  assert.ok(report.issues.some(({ path, message }) => path === "activities.activity-foundation" && /missing-role/u.test(message)));
});

test("PS-730 validation links identify the exact Team with a missing Objective", async () => {
  const draft = structuredClone(await fixture());
  draft.coreDesign.teams[0].objectiveIds = ["missing-objective"];
  const report = validateStudioDraft(draft);
  assert.equal(report.valid, false);
  assert.ok(report.issues.some(({ path, message }) => path === `teams.${draft.coreDesign.teams[0].id}` && /missing-objective/u.test(message)));
});

test("PS-750-T01 validates an explicit world-state adjudication contract and rejects unknown Facts", async () => {
  const draft = structuredClone(await fixture());
  draft.coreDesign.stateVariables = [{
    id: "ps750-pressure", name: "Operational pressure", description: "Synthetic adjudication input",
    scope: "global", type: "integer", minimum: 0, maximum: 10, unit: "points",
    informationPolicyId: "policy-public", editableBySessionRoleIds: ["white_cell"],
    historyMode: "full", display: "gauge"
  }];
  draft.scenario.initialState = [{ stateVariableId: "ps750-pressure", value: 2 }];
  draft.coreDesign.adjudicationModels = [{
    id: "ps750-model", name: "PS-750 rules preview", doctrine: "rules_based", mechanism: "rules",
    appliesToArtifactTypeIds: ["blue-action"], reviewerSessionRoleIds: ["white_cell"],
    leadReviewerSessionRoleIds: ["white_cell"], perspectives: [{
      id: "ps750-control-perspective", label: "Control perspective", reviewerSessionRoleIds: ["white_cell"]
    }],
    rules: [{
      id: "ps750-pressure-rule", label: "Pressure is elevated",
      when: { operator: "all", conditions: [{ fact: "state.ps750-pressure", operator: "greater_than", value: 1 }] },
      outcome: "review", explanation: "Suggest review when operational pressure exceeds one point."
    }],
    timeoutSeconds: 300, approvingSessionRoleIds: ["white_cell"],
    output: {
      outcomeCategories: ["accept", "revise", "reject"], rationaleRequired: true, confidenceRequired: true,
      revealedInformationPolicyId: "policy-public",
      stateEffects: [{ stateVariableId: "ps750-pressure", operation: "increment", value: 1, rationale: "Approved synthetic fixture" }],
      followOnInjectIds: ["opening-briefing"]
    },
    publicationScope: { public: true }, precedent: "advisory"
  }];

  const validReport = validateStudioDraft(draft);
  assert.equal(validReport.valid, true, JSON.stringify(validReport.issues));
  draft.coreDesign.adjudicationModels[0].rules[0].when.conditions[0].fact = "state.missing";
  const report = validateStudioDraft(draft);
  assert.equal(report.valid, false);
  assert.ok(report.issues.some(({ path, message }) => path === "adjudicationModels.ps750-model" && /state\.missing/u.test(message)));
});

test("PS-760-T01 validates versioned measurement and report traceability", async () => {
  const draft = structuredClone(await fixture());
  const artifact = draft.coreDesign.artifactTypes.find(({ decisionBearing }) => decisionBearing);
  assert.ok(artifact);
  draft.coreDesign.measurementDefinitions = [{
    id: "decision-count", key: "decision_count", version: 1, researchQuestionIds: [],
    label: "Decision count", description: "Count submitted decisions", source: "artifacts",
    aggregation: "count", unit: "decisions"
  }];
  draft.coreDesign.decisionTraceability = [{
    id: "decision-trace", artifactTypeId: artifact.id, researchQuestionIds: [],
    ownerSessionRoleId: draft.coreDesign.sessionRoles[0].id, trigger: "submission",
    informationRequirements: "governed evidence", availableActions: "submit", adjudicationMethod: "review",
    affectedStateVariableIds: [], measurementDefinitionIds: ["decision-count"]
  }];
  draft.coreDesign.reports = [{ id: "decision-report", name: "Decision report", audience: "Control", formats: ["json"],
    sections: [{ id: "summary", title: "Summary", source: "artifacts", measurementDefinitionIds: ["decision-count"] }] }];
  assert.equal(validateStudioDraft(draft).issues.some(({ code }) => code.startsWith("measurement.") || code === "report.measurement_missing"), false);
  draft.coreDesign.reports[0].sections[0].measurementDefinitionIds = ["missing-measurement"];
  const report = validateStudioDraft(draft);
  assert.ok(report.issues.some(({ code, path }) => code === "report.measurement_missing" && path === "reports.decision-report"));
});
