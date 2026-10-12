import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { hashUnifiedContent } from "../../content-agent/unified-content-contracts.mjs";
import { createXhsCarouselPlan, createXhsVisualAssetPlan } from "../../content-agent/xhs-content-components.mjs";

const SKILL_DIR = new URL("../../skills/plan-xhs-visual-assets/", import.meta.url);
const skillText = await readFile(new URL("SKILL.md", SKILL_DIR), "utf8");
const contractText = await readFile(new URL("references/contract.md", SKILL_DIR), "utf8");
const metadataText = await readFile(new URL("agents/openai.yaml", SKILL_DIR), "utf8");

assert.match(skillText, /deterministic compatibility bridge, not a second visual director/);
assert.match(skillText, /Emit `imageSpecs=\[\]`/);
assert.match(skillText, /Do not call a text or image Provider/);
assert.match(skillText, /design-xhs-integrated-pages.*only production Prompt Set/s);
assert.match(skillText, /Return only `XhsVisualAssetPlanCreativeOutput@1\.0`/);
assert.match(skillText, /Do not output component IDs, authority bindings, component hashes/);
assert.match(skillText, /Never claim Provider execution, image generation, rendering, selection, delivery, or publication/);
assert.match(contractText, /page,visualFunction,visualNeed,renderStrategy,mustKeep,mustAvoid/);
assert.match(contractText, /plannedAssetId,page,useCase,assetType,scene,subject,styleAndMedium,composition,lighting,palette,materials,textSafeArea,prompt,negativePrompt,referenceAssetIds,size,mustKeep,mustAvoid,textPolicy/);
assert.match(contractText, /ImageSpecs do not contain `designDnaVersion`; deterministic assembly injects/);
assert.match(metadataText, /\$plan-xhs-visual-assets/);
assert.match(metadataText, /without generating images/);

function object(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function exact(value, keys) {
  return object(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function text(value) {
  return typeof value === "string" && Boolean(value.trim());
}

function string(value) {
  return typeof value === "string";
}

function strings(value) {
  return Array.isArray(value) && value.every(text) && new Set(value).size === value.length;
}

function fail(paths) {
  throw Object.assign(new Error("XHS visual asset creative output is invalid"), {
    code: "XHS_VISUAL_ASSET_PLAN_CREATIVE_OUTPUT_INVALID",
    details: { fieldPaths: [...new Set(paths)] }
  });
}

function requirePaths(tests) {
  const paths = tests.filter(([, passed]) => !passed).map(([path]) => path);
  if (paths.length) fail(paths);
}

function validateInput(value) {
  const rootKeys = ["schemaVersion", "contract", "carouselPlan", "confirmedDesignDna", "designDnaRef", "pageTextTruth", "authorizedReferenceAssets"];
  requirePaths([
    ["input", exact(value, rootKeys)],
    ["input.schemaVersion", value?.schemaVersion === "1.0"],
    ["input.contract", value?.contract === "PlanXhsVisualAssetsInput@1.0"],
    ["input.carouselPlan", value?.carouselPlan?.contract === "XhsCarouselPlan@1.0"],
    ["input.confirmedDesignDna", object(value?.confirmedDesignDna) && value.confirmedDesignDna.status === "confirmed"],
    ["input.designDnaRef", exact(value?.designDnaRef, ["id", "hash"]) && value.designDnaRef.id === value?.confirmedDesignDna?.id && value.designDnaRef.hash === hashUnifiedContent(value.confirmedDesignDna)],
    ["input.pageTextTruth", Array.isArray(value?.pageTextTruth) && value.pageTextTruth.length === value?.carouselPlan?.pages?.length && value.pageTextTruth.every((item, index) => exact(item, ["page", "textLayers"]) && item.page === index + 1 && hashUnifiedContent(item.textLayers) === hashUnifiedContent(value.carouselPlan.pages[index].textLayers))],
    ["input.authorizedReferenceAssets", Array.isArray(value?.authorizedReferenceAssets) && value.authorizedReferenceAssets.every((item) => exact(item, ["id", "hash", "usageSummary", "allowedUseCases", "mustKeep", "mustAvoid"]) && text(item.id) && /^[a-f0-9]{64}$/.test(item.hash) && text(item.usageSummary) && strings(item.allowedUseCases) && strings(item.mustKeep) && strings(item.mustAvoid))]
  ]);
  return value;
}

function validateCreativeOutput(value, input) {
  validateInput(input);
  const envelopeKeys = ["status", "data", "warnings", "blocked_reasons"];
  const dataKeys = ["schemaVersion", "contract", "pageVisuals", "imageSpecs", "skippedPages", "pageAssetBindings"];
  const pageKeys = ["page", "visualFunction", "visualNeed", "renderStrategy", "mustKeep", "mustAvoid"];
  const specKeys = ["plannedAssetId", "page", "useCase", "assetType", "scene", "subject", "styleAndMedium", "composition", "lighting", "palette", "materials", "textSafeArea", "prompt", "negativePrompt", "referenceAssetIds", "size", "mustKeep", "mustAvoid", "textPolicy"];
  const data = value?.data;
  const pages = data?.pageVisuals;
  const specs = data?.imageSpecs;
  const skipped = data?.skippedPages;
  const bindings = data?.pageAssetBindings;
  const authorizedIds = new Set(input.authorizedReferenceAssets.map((item) => item.id));
  requirePaths([
    ["output", exact(value, envelopeKeys)],
    ["output.status", value?.status === "success"],
    ["output.data", exact(data, dataKeys)],
    ["output.warnings", strings(value?.warnings)],
    ["output.blocked_reasons", Array.isArray(value?.blocked_reasons) && value.blocked_reasons.length === 0],
    ["output.data.schemaVersion", data?.schemaVersion === "1.0"],
    ["output.data.contract", data?.contract === "XhsVisualAssetPlanCreativeOutput@1.0"],
    ["output.data.pageVisuals", Array.isArray(pages) && pages.length === input.carouselPlan.pages.length],
    ["output.data.pageVisuals[]", Array.isArray(pages) && pages.every((item) => exact(item, pageKeys))],
    ["output.data.imageSpecs", Array.isArray(specs)],
    ["output.data.imageSpecs[]", Array.isArray(specs) && specs.every((item) => exact(item, specKeys))],
    ["output.data.skippedPages", Array.isArray(skipped) && skipped.every((item) => exact(item, ["page", "reason"]))],
    ["output.data.pageAssetBindings", Array.isArray(bindings) && bindings.length === input.carouselPlan.pages.length && bindings.every((item) => exact(item, ["page", "plannedAssetIds"]))]
  ]);
  requirePaths([
    ["output.data.pageVisuals[].page", pages.every((item, index) => item.page === index + 1)],
    ["output.data.pageVisuals[].visualFunction", pages.every((item) => ["attention", "explain", "compare", "demonstrate", "pace", "none"].includes(item.visualFunction))],
    ["output.data.pageVisuals[].visualNeed", pages.every((item) => string(item.visualNeed) && (item.renderStrategy !== "no_visual_needed" || item.visualNeed === ""))],
    ["output.data.pageVisuals[].renderStrategy", pages.every((item) => ["html_css", "authorized_asset", "generated_raster", "no_visual_needed"].includes(item.renderStrategy))],
    ["output.data.pageVisuals[].constraints", pages.every((item) => strings(item.mustKeep) && strings(item.mustAvoid))],
    ["output.data.imageSpecs[].fields", specs.every((item) => text(item.plannedAssetId) && Number.isInteger(item.page) && ["illustration-story", "photorealistic-natural", "stylized-concept", "product-context", "texture-background"].includes(item.useCase) && ["carousel-background", "subject-cutout", "scene-illustration"].includes(item.assetType) && ["scene", "subject", "styleAndMedium", "composition", "lighting", "materials", "textSafeArea", "prompt", "negativePrompt"].every((key) => text(item[key])) && strings(item.palette) && strings(item.referenceAssetIds) && strings(item.mustKeep) && strings(item.mustAvoid) && item.size === "1024x1536" && item.textPolicy === "no_text_in_image")],
    ["output.data.imageSpecs[].negativePrompt", specs.every((item) => ["text", "letters", "numbers", "watermark", "logo", "interface screenshot", "illegible symbols"].every((token) => item.negativePrompt.toLowerCase().includes(token)))],
    ["output.data.imageSpecs[].referenceAssetIds", specs.every((item) => item.referenceAssetIds.every((id) => authorizedIds.has(id)))],
    ["output.data.skippedPages[]", skipped.every((item) => Number.isInteger(item.page) && ["html_css", "authorized_asset", "no_visual_needed"].includes(item.reason))],
    ["output.data.pageAssetBindings[]", bindings.every((item, index) => item.page === index + 1 && strings(item.plannedAssetIds))]
  ]);
  const generated = pages.filter((item) => item.renderStrategy === "generated_raster");
  const nonGenerated = pages.filter((item) => item.renderStrategy !== "generated_raster");
  const specPages = new Set(specs.map((item) => item.page));
  const specIds = new Set(specs.map((item) => item.plannedAssetId));
  const skippedPages = new Set(skipped.map((item) => item.page));
  requirePaths([
    ["output.data.imageSpecs.uniqueness", specPages.size === specs.length && specIds.size === specs.length],
    ["output.data.imageSpecs.coverage", specs.length === generated.length && generated.every((item) => specPages.has(item.page)) && specs.every((item) => pages[item.page - 1]?.renderStrategy === "generated_raster")],
    ["output.data.skippedPages.coverage", skipped.length === nonGenerated.length && skippedPages.size === skipped.length && nonGenerated.every((item) => skippedPages.has(item.page)) && skipped.every((item) => pages[item.page - 1]?.renderStrategy === item.reason)],
    ["output.data.pageAssetBindings.coverage", bindings.every((item) => pages[item.page - 1]?.renderStrategy === "generated_raster" ? item.plannedAssetIds.length === 1 && specIds.has(item.plannedAssetIds[0]) && specs.find((spec) => spec.page === item.page)?.plannedAssetId === item.plannedAssetIds[0] : item.plannedAssetIds.length === 0)]
  ]);
  return value;
}

const designDna = {
  id: "dna_fixture",
  version: "dna_fixture_v1",
  status: "confirmed",
  palette: ["warm white", "dark green"],
  direction: "restrained editorial illustration",
  forbiddenMotifs: ["fake text", "watermark"]
};
const asset = {
  id: "REF001",
  hash: "a".repeat(64),
  usageSummary: "authorized visual composition reference only",
  allowedUseCases: ["stylized-concept"],
  mustKeep: ["restrained palette"],
  mustAvoid: ["copying text"]
};
const authorityBinding = {
  companyId: "company_fixture",
  accountId: "account_fixture",
  activeStrategySnapshotRef: { id: "strategy", hash: "1".repeat(64) },
  contentOpportunityRef: { id: "opportunity", hash: "2".repeat(64) },
  mechanismDecisionRef: { id: "mechanism", hash: "3".repeat(64) },
  contentProjectRef: { id: "project", hash: "4".repeat(64) },
  platformRunRef: { id: "run", hash: "5".repeat(64) },
  sharedContentMasterRef: { id: "master", hash: "6".repeat(64) },
  platformBriefRef: { id: "brief", hash: "7".repeat(64) },
  confirmedOutlineRef: { id: "outline", hash: "8".repeat(64) },
  writerContextRef: { id: "writer", hash: "9".repeat(64) },
  designDnaRef: { id: designDna.id, hash: hashUnifiedContent(designDna) }
};
const carouselPlan = createXhsCarouselPlan({
  schemaVersion: "1.0",
  contract: "XhsCarouselPlan@1.0",
  id: "carousel_fixture",
  authorityBinding,
  postCopyRef: { id: "copy", hash: "b".repeat(64) },
  deckId: "deck_fixture",
  canvas: { width: 1080, height: 1440, ratio: "3:4" },
  designDnaVersion: designDna.version,
  readingArc: "promise-evidence-action",
  pages: ["hook", "problem", "diagnosis", "evidence", "example", "action"].map((outlineRole, index) => ({
    page: index + 1,
    outlineSectionId: `S${index + 1}`,
    outlineRole,
    role: ["cover", "problem", "conclusion", "evidence", "case", "cta"][index],
    objective: `objective ${index + 1}`,
    takeaway: `takeaway ${index + 1}`,
    textLayers: [{ type: "headline", text: `page text ${index + 1}`, maxLines: 3, priority: 1 }],
    layoutHint: `layout ${index + 1}`,
    factIds: [],
    interpretationIds: [],
    knowledgeAssetIds: [],
    mustAvoid: []
  }))
});
const input = {
  schemaVersion: "1.0",
  contract: "PlanXhsVisualAssetsInput@1.0",
  carouselPlan,
  confirmedDesignDna: designDna,
  designDnaRef: { id: designDna.id, hash: hashUnifiedContent(designDna) },
  pageTextTruth: carouselPlan.pages.map((page) => ({ page: page.page, textLayers: structuredClone(page.textLayers) })),
  authorizedReferenceAssets: [asset]
};

function validOutput() {
  return {
    status: "success",
    data: {
      schemaVersion: "1.0",
      contract: "XhsVisualAssetPlanCreativeOutput@1.0",
      pageVisuals: carouselPlan.pages.map((page) => ({
        page: page.page,
        visualFunction: page.page === 3 ? "demonstrate" : "explain",
        visualNeed: page.page === 5 ? "" : `visual need ${page.page}`,
        renderStrategy: page.page === 3 ? "generated_raster" : page.page === 5 ? "no_visual_needed" : "html_css",
        mustKeep: [],
        mustAvoid: []
      })),
      imageSpecs: [{
        plannedAssetId: "xhs-deck-fixture-p03-plan",
        page: 3,
        useCase: "stylized-concept",
        assetType: "scene-illustration",
        scene: "quiet work setting",
        subject: "one person organizing neutral cards",
        styleAndMedium: "restrained editorial illustration",
        composition: "subject on right with center-left empty",
        lighting: "soft natural light",
        palette: ["warm white", "dark green"],
        materials: "paper and subtle grain",
        textSafeArea: "center-left empty",
        prompt: "no-text editorial scene matching the confirmed visual system",
        negativePrompt: "text, letters, numbers, watermark, logo, interface screenshot, illegible symbols",
        referenceAssetIds: [asset.id],
        size: "1024x1536",
        mustKeep: ["empty text-safe area"],
        mustAvoid: ["brand logo"],
        textPolicy: "no_text_in_image"
      }],
      skippedPages: carouselPlan.pages.filter((page) => page.page !== 3).map((page) => ({ page: page.page, reason: page.page === 5 ? "no_visual_needed" : "html_css" })),
      pageAssetBindings: carouselPlan.pages.map((page) => ({ page: page.page, plannedAssetIds: page.page === 3 ? ["xhs-deck-fixture-p03-plan"] : [] }))
    },
    warnings: [],
    blocked_reasons: []
  };
}

const output = validOutput();
const inputBefore = structuredClone(input);
const outputBefore = structuredClone(output);
validateCreativeOutput(output, input);
assert.deepEqual(input, inputBefore);
assert.deepEqual(output, outputBefore);

const usedReferenceIds = new Set(output.data.imageSpecs.flatMap((item) => item.referenceAssetIds));
const component = createXhsVisualAssetPlan({
  schemaVersion: "1.0",
  contract: "XhsVisualAssetPlan@1.0",
  id: "visual_plan_fixture",
  authorityBinding: structuredClone(carouselPlan.authorityBinding),
  carouselPlanRef: { id: carouselPlan.id, hash: carouselPlan.componentHash },
  designDnaVersion: carouselPlan.designDnaVersion,
  pageVisuals: structuredClone(output.data.pageVisuals),
  imageSpecs: output.data.imageSpecs.map((item) => ({ ...structuredClone(item), designDnaVersion: carouselPlan.designDnaVersion })),
  skippedPages: structuredClone(output.data.skippedPages),
  authorizedReferenceAssets: input.authorizedReferenceAssets.filter((item) => usedReferenceIds.has(item.id)).map(({ id, hash }) => ({ id, hash })),
  pageAssetBindings: structuredClone(output.data.pageAssetBindings)
});
assert.equal(component.contract, "XhsVisualAssetPlan@1.0");
assert.equal(component.imageSpecs[0].designDnaVersion, designDna.version);
assert.ok(Object.isFrozen(component));

for (const shape of ["missing", "extra", "null", "primitive"]) {
  let invalid;
  if (shape === "null") invalid = null;
  else if (shape === "primitive") invalid = 7;
  else {
    invalid = validOutput();
    if (shape === "missing") delete invalid.data;
    else invalid.unexpected = "PRIVATE_VALUE";
  }
  assert.throws(
    () => validateCreativeOutput(invalid, input),
    (error) => error.code === "XHS_VISUAL_ASSET_PLAN_CREATIVE_OUTPUT_INVALID" && error.details.fieldPaths.some((path) => ["output", "output.data"].includes(path)) && !JSON.stringify(error.details).includes("PRIVATE_VALUE"),
    `${shape} output must fail at a safe exact path`
  );
}

for (const shape of ["missing", "extra", "null", "primitive"]) {
  const invalid = validOutput();
  if (shape === "missing") delete invalid.data.imageSpecs[0].prompt;
  else if (shape === "extra") invalid.data.imageSpecs[0].unexpected = "PRIVATE_SPEC";
  else invalid.data.imageSpecs[0] = shape === "null" ? null : 7;
  assert.throws(
    () => validateCreativeOutput(invalid, input),
    (error) => error.code === "XHS_VISUAL_ASSET_PLAN_CREATIVE_OUTPUT_INVALID" && error.details.fieldPaths.includes("output.data.imageSpecs[]") && !JSON.stringify(error.details).includes("PRIVATE_SPEC"),
    `${shape} ImageSpec must fail at its exact collection path`
  );
}

const unauthorized = validOutput();
unauthorized.data.imageSpecs[0].referenceAssetIds = ["UNAUTHORIZED_PRIVATE_REF"];
assert.throws(
  () => validateCreativeOutput(unauthorized, input),
  (error) => error.code === "XHS_VISUAL_ASSET_PLAN_CREATIVE_OUTPUT_INVALID" && error.details.fieldPaths.includes("output.data.imageSpecs[].referenceAssetIds") && !JSON.stringify(error.details).includes("UNAUTHORIZED_PRIVATE_REF")
);

const duplicate = validOutput();
duplicate.data.imageSpecs.push({ ...structuredClone(duplicate.data.imageSpecs[0]), page: 4 });
assert.throws(
  () => validateCreativeOutput(duplicate, input),
  (error) => error.code === "XHS_VISUAL_ASSET_PLAN_CREATIVE_OUTPUT_INVALID" && error.details.fieldPaths.includes("output.data.imageSpecs.uniqueness")
);

const dangling = validOutput();
dangling.data.pageAssetBindings[2].plannedAssetIds = ["DANGLING_PRIVATE_PLAN"];
assert.throws(
  () => validateCreativeOutput(dangling, input),
  (error) => error.code === "XHS_VISUAL_ASSET_PLAN_CREATIVE_OUTPUT_INVALID" && error.details.fieldPaths.includes("output.data.pageAssetBindings.coverage") && !JSON.stringify(error.details).includes("DANGLING_PRIVATE_PLAN")
);

const conflict = validOutput();
conflict.data.skippedPages.push({ page: 3, reason: "html_css" });
assert.throws(
  () => validateCreativeOutput(conflict, input),
  (error) => error.code === "XHS_VISUAL_ASSET_PLAN_CREATIVE_OUTPUT_INVALID" && error.details.fieldPaths.includes("output.data.skippedPages.coverage")
);

const missingPage = validOutput();
missingPage.data.skippedPages = missingPage.data.skippedPages.filter((item) => item.page !== 2);
assert.throws(
  () => validateCreativeOutput(missingPage, input),
  (error) => error.code === "XHS_VISUAL_ASSET_PLAN_CREATIVE_OUTPUT_INVALID" && error.details.fieldPaths.includes("output.data.skippedPages.coverage")
);

console.log("xhs-visual-asset-plan-skill-self-test: ok");
