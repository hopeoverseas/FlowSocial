import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { featureFlags } from "../../feature-flags.mjs";
import { getSkillRuntimeStatus } from "../../skill-runtime.mjs";
import {
  compileEvaluationCase,
  loadLibraries,
  projectXhsPostPackage,
  validateAll,
  validateLibraryDocument,
  validatePagePromptSpec,
  validatePromptSetSchema,
  validateTransition,
  validateUniqueIds,
  validateVisualStyleSelection
} from "../../skills/design-xhs-integrated-pages/scripts/validate-library.mjs";

const testDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(testDir, "..", "..");
const readUtf8 = (path) => readFileSync(path, "utf8").replace(/^\uFEFF/, "");
const readJson = (path) => JSON.parse(readUtf8(path));
const firstJsonExample = (text) => JSON.parse(text.match(/```json\r?\n([\s\S]*?)\r?\n```/)[1]);

const summary = validateAll();
assert.deepEqual(summary, {
  status: "passed",
  archetypes: 6,
  stylePacks: 3,
  promptPatterns: 15,
  fixtures: 12,
  fullPromptSetsValidated: 12,
  networkCalls: 0,
  providerCalls: 0,
  databaseWrites: 0
});

const manifest = readJson(join(appRoot, "skills", "skill-manifest.json"));
const registrations = [...manifest.testing, ...manifest.p0, ...manifest.p1].filter((item) => item.capability === "design-xhs-integrated-pages");
assert.equal(registrations.length, 1);
const registration = registrations[0];
assert.equal(registration.lifecycle, "stable_conditional");
assert.equal(registration.default_enabled, false);
assert.equal(registration.invocation, "when_explicit_visual_design_flag_enabled");
assert.equal(registration.production_eligible_output, false);
assert.equal(registration.automatic_provider_execution, false);
assert.equal(registration.automatic_promotion, false);
assert.equal(manifest.feature_flags.xhsIntegratedPageDesignSkill, false);
assert.equal(featureFlags().xhsIntegratedPageDesignSkill, false);
assert.equal(getSkillRuntimeStatus().registered.includes("design-xhs-integrated-pages"), true);

const contractText = readUtf8(join(appRoot, "contracts", "XhsIntegratedPagePromptSet.md"));
const pageContractText = readUtf8(join(appRoot, "contracts", "PagePromptSpec.md"));
const styleContractText = readUtf8(join(appRoot, "contracts", "VisualStyleSelection.md"));
const skillText = readUtf8(join(appRoot, "skills", "design-xhs-integrated-pages", "SKILL.md"));
const referenceText = readUtf8(join(appRoot, "skills", "design-xhs-integrated-pages", "references", "contract.md"));
for (const text of [contractText, skillText, referenceText]) {
  assert.match(text, /visualStyleSelection/);
  assert.match(text, /pagePromptSpecs/);
  assert.match(text, /visualSelectionGate/);
  assert.doesNotMatch(text, /visual_style_selection|page_prompt_specs/);
}
assert.equal(validatePromptSetSchema(firstJsonExample(contractText)), true);
validatePagePromptSpec(firstJsonExample(pageContractText));
validateVisualStyleSelection(firstJsonExample(styleContractText));

const fixtures = readJson(join(appRoot, "scripts", "fixtures", "xhs-integrated-design", "evaluation-cases.json"));
const libraries = loadLibraries();
assert.equal(fixtures.cases.length, 12);
for (const sample of fixtures.cases) {
  assert.ok(sample.input?.xhsPostPackage?.data?.deck?.pages?.length >= 2, `${sample.id} multi-page package`);
  assert.ok(sample.selection?.stylePackId, `${sample.id} style selection`);
  assert.equal(sample.selection.pages.length, sample.input.xhsPostPackage.data.deck.pages.length, `${sample.id} page selections`);
  const result = compileEvaluationCase(sample, libraries);
  assert.equal(validatePromptSetSchema(result), true);
  assert.equal(result.productionEligible, false);
  assert.equal(result.visualSelectionGate.status, "pending_user_review");
  assert.equal(result.visualStyleSelection.status, "experimental");
}

const first = fixtures.cases[0];
const packageBefore = JSON.stringify(first.input.xhsPostPackage);
const projected = projectXhsPostPackage(first.input.xhsPostPackage, first.input.contentVersion);
assert.equal(JSON.stringify(first.input.xhsPostPackage), packageBefore, "adapter must be read-only");
assert.equal(projected.length, 2);
assert.equal(projected[0].headline, "80 条样本，先看 12.5% 差异");
assert.ok(projected[0].protectedTerms.includes("12.5%"));
assert.throws(() => projectXhsPostPackage({ status: "success", data: { platform: "xiaohongshu", deck: { pages: [] } } }, 1), /INPUT_TRUTH_INCOMPLETE/);

const validPromptSet = compileEvaluationCase(first, libraries);
const legacyPages = structuredClone(validPromptSet);
legacyPages.pages = legacyPages.pagePromptSpecs;
delete legacyPages.pagePromptSpecs;
assert.throws(() => validatePromptSetSchema(legacyPages), /XhsIntegratedPagePromptSet fields/);
const snakeCase = structuredClone(validPromptSet);
snakeCase.visual_style_selection = snakeCase.visualStyleSelection;
delete snakeCase.visualStyleSelection;
assert.throws(() => validatePromptSetSchema(snakeCase), /XhsIntegratedPagePromptSet fields/);
const bypassedGate = structuredClone(validPromptSet);
bypassedGate.productionEligible = true;
assert.throws(() => validatePromptSetSchema(bypassedGate));

for (const [document, name, count] of [
  [libraries.archetypes, "PageArchetypeLibrary", 6],
  [libraries.styles, "VisualStylePackLibrary", 3],
  [libraries.patterns, "PagePromptPatternLibrary", 15]
]) {
  const ids = validateLibraryDocument(document, name, count);
  assert.ok(document.entries.every((item) => item.status === "experimental"));
  const duplicated = structuredClone(document);
  duplicated.entries[1].id = duplicated.entries[0].id;
  assert.throws(() => validateUniqueIds(validateLibraryDocument(duplicated, name, count)), /duplicate library ID/);
  validateUniqueIds(ids);
}
assert.equal(validateTransition("quarantine", "normalized"), true);
assert.equal(validateTransition("quarantine", "approved"), false);
assert.equal(validateTransition("approved", "experimental"), false);

console.log(JSON.stringify({ ...summary, manifestStatus: registration.lifecycle, featureFlagDefault: false, adapter: "stable_conditional", assetStatus: "experimental", visualSelectionGate: "pending_user_review" }));
