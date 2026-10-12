import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  adaptEvaluationCase,
  compileRuntimeInput,
  projectXhsPostPackage as projectRuntimeXhsPostPackage,
  validatePagePromptSpec as validateRuntimePagePromptSpec,
  validatePromptSetSchema as validateRuntimePromptSetSchema,
  validateVisualStyleSelection as validateRuntimeVisualStyleSelection
} from "./runtime-compiler.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const skillRoot = resolve(scriptDir, "..");
const appRoot = resolve(skillRoot, "..", "..");
const fixturePath = join(appRoot, "scripts", "fixtures", "xhs-integrated-design", "evaluation-cases.json");
const allowedStatuses = ["quarantine", "normalized", "experimental", "approved", "deprecated"];

const readJson = (path) => JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));

function assertKeys(value, keys, label) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), `${label} object`);
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), `${label} fields`);
}

export function validateTransition(from, to) {
  const fromIndex = allowedStatuses.indexOf(from);
  const toIndex = allowedStatuses.indexOf(to);
  return fromIndex >= 0 && toIndex >= 0 && (toIndex === fromIndex || toIndex === fromIndex + 1);
}

export function validateLibraryDocument(document, expectedLibrary, expectedCount) {
  assertKeys(document, expectedLibrary === "PagePromptPatternLibrary"
    ? ["schemaVersion", "library", "contentPolicy", "entries"]
    : ["schemaVersion", "library", "entries"], expectedLibrary);
  assert.equal(document.schemaVersion, "1.0", `${expectedLibrary} schemaVersion`);
  assert.equal(document.library, expectedLibrary);
  assert.equal(document.entries.length, expectedCount, `${expectedLibrary} entry count`);
  for (const entry of document.entries) {
    assert.match(entry.id, /^[a-z0-9]+(?:[.-][a-z0-9]+)+$/, `${entry.id} stable ID`);
    assert.equal(entry.schemaVersion, "1.0", `${entry.id} schemaVersion`);
    assert.equal(entry.status, "experimental", `${entry.id} must remain experimental without approval evidence`);
    assert.equal(entry.source?.kind, "flowsocial_original", `${entry.id} source kind`);
    assert.equal(entry.source?.workItem, "FS-V1-XHS-VISUAL-05B", `${entry.id} provenance`);
    assert.ok(entry.source?.license, `${entry.id} source license`);
    assert.ok(entry.applicability && Object.keys(entry.applicability).length, `${entry.id} applicability`);
    assert.ok(Array.isArray(entry.failureModes) && entry.failureModes.length, `${entry.id} failureModes`);
    assert.ok(Array.isArray(entry.remediation) && entry.remediation.length, `${entry.id} remediation`);
    assert.equal(entry.reviewedBy, undefined, `${entry.id} must not claim review`);
    assert.equal(entry.reviewedAt, undefined, `${entry.id} must not claim review time`);
    assert.equal(entry.decision, undefined, `${entry.id} must not claim approval decision`);
  }
  return document.entries.map((entry) => entry.id);
}

export function validateUniqueIds(ids) {
  assert.equal(new Set(ids).size, ids.length, "duplicate library ID");
  return true;
}

export function projectXhsPostPackage(packageValue, contentVersion) {
  return projectRuntimeXhsPostPackage(packageValue, contentVersion);
}

export function validatePagePromptSpec(value) {
  return validateRuntimePagePromptSpec(value);
}

export function validateVisualStyleSelection(value) {
  return validateRuntimeVisualStyleSelection(value);
}

export function validatePromptSetSchema(value) {
  const expectedFields = ["schemaVersion", "contract", "id", "status", "sourcePackage", "visualStyleSelection", "pagePromptSpecs", "crossPageRules", "visualSelectionGate", "productionEligible", "blockers", "trace"].sort();
  if (!value || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(expectedFields)) throw new Error("XhsIntegratedPagePromptSet fields");
  return validateRuntimePromptSetSchema(value);
}

export function loadLibraries() {
  return {
    archetypes: readJson(join(skillRoot, "references", "page-archetypes.json")),
    styles: readJson(join(skillRoot, "references", "style-packs.json")),
    patterns: readJson(join(skillRoot, "references", "prompt-patterns.json"))
  };
}

export function compileEvaluationCase(sample, libraries = loadLibraries()) {
  return compileRuntimeInput(adaptEvaluationCase(sample), libraries);
}

function assertExpected(sample, result) {
  const expected = sample.expectedPromptSet;
  assert.equal(result.contract, expected.contract, `${sample.id} contract`);
  assert.equal(result.status, expected.status, `${sample.id} status`);
  assert.equal(result.pagePromptSpecs.length, expected.pageCount, `${sample.id} page count`);
  assert.equal(result.visualStyleSelection.stylePackId, expected.stylePackId, `${sample.id} style`);
  assert.deepEqual(Object.fromEntries(result.pagePromptSpecs.map((item) => [item.pageId, item.pageArchetypeId])), expected.pageArchetypeIds, `${sample.id} archetypes`);
  assert.deepEqual(Object.fromEntries(result.pagePromptSpecs.map((item) => [item.pageId, item.promptPatternIds])), expected.promptPatternIdsByPage, `${sample.id} patterns`);
  assert.deepEqual(result.blockers.map((item) => item.code), expected.blockerCodes, `${sample.id} blockers`);
  assert.equal(result.productionEligible, false);
  assert.equal(result.visualSelectionGate.status, "pending_user_review");
}

export function validateAll() {
  const skillText = readFileSync(join(skillRoot, "SKILL.md"), "utf8").replace(/^\uFEFF/, "");
  const frontmatter = skillText.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert.ok(frontmatter, "SKILL.md frontmatter");
  assert.match(frontmatter[1], /^name: design-xhs-integrated-pages$/m);
  assert.match(frontmatter[1], /^description: .+$/m);
  assert.doesNotMatch(skillText, /\[TODO|TODO:/, "SKILL.md placeholders");
  assert.doesNotMatch(skillText, /visual_style_selection|page_prompt_specs/, "legacy Prompt Set field names");
  const libraries = loadLibraries();
  const ids = [
    ...validateLibraryDocument(libraries.archetypes, "PageArchetypeLibrary", 6),
    ...validateLibraryDocument(libraries.styles, "VisualStylePackLibrary", 3),
    ...validateLibraryDocument(libraries.patterns, "PagePromptPatternLibrary", 15)
  ];
  validateUniqueIds(ids);
  const fixtures = readJson(fixturePath);
  assertKeys(fixtures, ["schemaVersion", "contract", "description", "cases"], "fixture set");
  assert.equal(fixtures.schemaVersion, "2.0");
  assert.equal(fixtures.contract, "XhsIntegratedPagePromptSet@1.0");
  assert.equal(fixtures.cases.length, 12, "offline evaluation case count");
  const coverage = new Set(fixtures.cases.flatMap((sample) => sample.coverage));
  for (const requirement of [
    "cover.promise", "list.key-points", "process.vertical-steps", "comparison.before-after",
    "explanation.concept-map", "summary.cta", "exact_numbers", "english_product_name",
    "chinese_proper_noun", "high_density", "authorized_asset", "cta",
    "cross_page_consistency", "deterministic_layout"
  ]) assert.ok(coverage.has(requirement), `fixture coverage: ${requirement}`);
  for (const sample of fixtures.cases) assertExpected(sample, compileEvaluationCase(sample, libraries));
  return { status: "passed", archetypes: 6, stylePacks: 3, promptPatterns: 15, fixtures: 12, fullPromptSetsValidated: 12, networkCalls: 0, providerCalls: 0, databaseWrites: 0 };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(validateAll()));
