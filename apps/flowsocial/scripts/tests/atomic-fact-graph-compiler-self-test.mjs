import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { hashUnifiedContent } from "../../content-agent/unified-content-contracts.mjs";
import {
  createExecutionAuthorityBinding,
  createSkillActivityInvocation
} from "../../content-agent/unified-execution-contracts.mjs";
import {
  createXhsPostCopy,
  createXhsFinalTitleBinding,
  createXhsCarouselPlanV2,
  createXhsVisualAssetPlan,
  compileXhsTraceabilityV2,
  compileXhsContentPreflightV2,
  assembleXhsPostPackageV4
} from "../../content-agent/xhs-content-components.mjs";
import {
  compileUnifiedAtomicFactGraph,
  validateUnifiedAtomicActivityBundle,
  validateUnifiedAtomicFactGraph
} from "../../content-agent/unified-atomic-fact-graph-compiler.mjs";

function freeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
}
const ref = (id, character) => ({ id, hash: character.repeat(64) });
const roles = ["hook", "problem", "diagnosis", "method", "evidence", "action"];
const bodyRoles = ["scene", "problem", "conclusion", "method", "evidence", "summary"];
const pageRoles = ["cover", "problem", "conclusion", "method", "evidence", "cta"];
const contentMaster = {
  content_master_id: "master", confirmed_facts: [], supported_interpretations: [], author_opinions: [],
  knowledge_contract: { allowed_assets: [] }, promotion: { mode: "none", allowed_items: [], disclosure: "" }
};
const outline = { outline_id: "outline", content_promise: "six useful steps", sections: roles.map((role, index) => ({ section_id: `s${index + 1}`, role })) };
const legacyAuthority = {
  companyId: "company", accountId: "account", activeStrategySnapshotRef: ref("strategy", "1"),
  contentOpportunityRef: ref("opportunity", "2"), mechanismDecisionRef: ref("decision", "3"),
  contentProjectRef: ref("project", "4"), platformRunRef: ref("run", "5"),
  sharedContentMasterRef: { id: contentMaster.content_master_id, hash: hashUnifiedContent(contentMaster) },
  platformBriefRef: ref("brief", "6"), confirmedOutlineRef: { id: outline.outline_id, hash: hashUnifiedContent(outline) },
  writerContextRef: ref("writer", "7"), designDnaRef: ref("dna", "8")
};
const authority = createExecutionAuthorityBinding({
  family: "atomic_v2", companyId: legacyAuthority.companyId, accountId: legacyAuthority.accountId,
  refs: Object.entries(legacyAuthority).filter(([key]) => key.endsWith("Ref")).map(([role, value]) => ({ role, ref: value }))
});

const postCopy = createXhsPostCopy({
  schemaVersion: "1.0", contract: "XhsPostCopy@1.0", id: "post", authorityBinding: legacyAuthority,
  contentPromise: outline.content_promise,
  engagementStrategy: { mode: "auto", primaryAction: "save", reason: "use later", ctaPlacement: "ending", ctaText: "save" },
  titleCandidates: ["draft one", "draft two", "draft three"].map((title, index) => ({ title, hookType: ["result", "problem", "checklist"][index], claimIds: [], risk: "low" })),
  recommendedTitle: "draft one", opening: "opening",
  bodySections: roles.map((role, index) => ({ sectionId: `s${index + 1}`, outlineRole: role, role: bodyRoles[index], text: `body ${index + 1}`, claimIds: [], knowledgeAssetIds: [] })),
  ending: "ending", pinnedComment: "", hashtags: ["method", "guide", "steps"], cta: "save",
  promotionUse: { mode: "none", itemIds: [], disclosure: "" }
});
const titleOutput = { id: "title-output", candidates: [{ title_id: "balanced", title: "final title", risk: "low", claim_ids: [] }], recommendations: { balanced: "balanced" } };
const finalTitleBinding = createXhsFinalTitleBinding({ id: "final-title", postCopy, titleOutput, titleOutputRef: { id: titleOutput.id, hash: hashUnifiedContent(titleOutput) }, contentMaster });
const carouselPlan = createXhsCarouselPlanV2({
  schemaVersion: "2.0", contract: "XhsCarouselPlan@2.0", id: "carousel", authorityBinding: legacyAuthority,
  postCopyRef: { id: postCopy.id, hash: postCopy.componentHash }, finalTitleBindingRef: { id: finalTitleBinding.id, hash: finalTitleBinding.bindingHash },
  deckId: "deck", canvas: { width: 1080, height: 1440, ratio: "3:4" }, designDnaVersion: "dna-v1", readingArc: "promise-action",
  pages: roles.map((role, index) => ({
    page: index + 1, outlineSectionId: `s${index + 1}`, outlineRole: role, role: pageRoles[index], objective: `objective ${index + 1}`,
    takeaway: `takeaway ${index + 1}`, textLayers: [{ type: "headline", text: index === 0 ? titleOutput.candidates[0].title : `page ${index + 1}`, maxLines: 2, priority: 1 }],
    layoutHint: `layout ${index + 1}`, factIds: [], interpretationIds: [], knowledgeAssetIds: [], mustAvoid: []
  }))
}, { postCopy, finalTitleBinding });
const visualAssetPlan = createXhsVisualAssetPlan({
  schemaVersion: "1.0", contract: "XhsVisualAssetPlan@1.0", id: "visual", authorityBinding: legacyAuthority,
  carouselPlanRef: { id: carouselPlan.id, hash: carouselPlan.componentHash }, designDnaVersion: "dna-v1",
  pageVisuals: roles.map((_, index) => ({ page: index + 1, visualFunction: "explain", visualNeed: `visual ${index + 1}`, renderStrategy: "html_css", mustKeep: [], mustAvoid: [] })),
  imageSpecs: [], skippedPages: roles.map((_, index) => ({ page: index + 1, reason: "html_css" })), authorizedReferenceAssets: [],
  pageAssetBindings: roles.map((_, index) => ({ page: index + 1, plannedAssetIds: [] }))
});
const traceability = compileXhsTraceabilityV2({ postCopy, finalTitleBinding, carouselPlan, visualAssetPlan, contentMaster, authorizedReferenceAssets: [] });
const preflightReport = compileXhsContentPreflightV2({ postCopy, finalTitleBinding, carouselPlan, visualAssetPlan, traceability, contentMaster, confirmedOutline: outline, authorizedReferenceAssets: [] });
assert.equal(preflightReport.status, "passed");
const packageV4 = assembleXhsPostPackageV4({ id: "package", postCopy, finalTitleBinding, carouselPlan, visualAssetPlan, traceability, preflightReport });

const plan = freeze({ schemaVersion: "1.0", graphMode: "atomic_v4", steps: [
  { id: "post", kind: "skill", capability: "write-xhs-post-copy", outputContract: "XhsPostCopyCreativeOutput@1.0" },
  { id: "carousel", kind: "skill", capability: "plan-xhs-carousel", outputContract: "XhsCarouselPlanCreativeOutput@1.0" },
  { id: "visual", kind: "skill", capability: "plan-xhs-visual-assets", outputContract: "XhsVisualAssetPlanCreativeOutput@1.0" }
] });
const components = [postCopy, carouselPlan, visualAssetPlan];
const contexts = plan.steps.map((step, index) => freeze({
  capability: step.capability,
  input: index === 0 ? { content_master: contentMaster, confirmed_outline: outline } : {},
  systemContext: { authorityBinding: legacyAuthority, ...(index === 2 ? { authorizedReferenceAssets: [] } : {}) },
  step, executionPlan: plan
}));
const bundles = contexts.map((context, index) => {
  const inputHash = hashUnifiedContent({ input: context.input, systemContext: context.systemContext });
  const invocation = createSkillActivityInvocation({
    id: `invocation-${index}`, skill: { name: context.capability, version: context.step.outputContract },
    inputRef: { id: `input-${index}`, hash: inputHash }, authorityBinding: authority, planHash: hashUnifiedContent(plan)
  });
  const rawProviderEnvelopeRef = { id: `raw-${index}`, hash: ["9", "a", "b"][index].repeat(64) };
  const executionEvidence = { outputHash: rawProviderEnvelopeRef.hash, executionPlanHash: invocation.planHash };
  const draft = { schemaVersion: "1.0", contract: "UnifiedAtomicActivityBundle@1.0", id: `bundle-${index}`, capability: context.capability, invocation, rawProviderEnvelopeRef, executionEvidence, verifiedComponent: components[index] };
  return freeze({ ...draft, bundleHash: hashUnifiedContent(draft) });
});

const titleEnvelope = { status: "success", data: titleOutput, warnings: [], blocked_reasons: [] };
const titleBase = {
  schemaVersion: "1.0", contract: "UnifiedSkillOutputFact@1.0", id: "title-fact", invocationRef: ref("title-invocation", "a"),
  executionRecordRef: ref("title-record", "b"), platform: "xiaohongshu", stepId: "title", capability: "generate-platform-titles",
  inputContract: "PlatformTitleInput@1.0", outputContract: "PlatformTitleList@1.0", planRef: ref("plan", "c"),
  bundleHash: "d".repeat(64), inputHash: "e".repeat(64), outputHash: hashUnifiedContent(titleEnvelope), runtimeOutput: titleEnvelope,
  verifiedDomainOutput: null, executionMode: "offline_fixture", status: "completed", productionEligibleOutput: true
};
const titleFact = freeze({ ...titleBase, factHash: hashUnifiedContent(titleBase) });
const snapshot = { platformRuns: [{ platform: "xiaohongshu", platformRunRef: { id: "run" }, xhsAtomicArtifacts: { postCopy, finalTitleBinding, carouselPlan, visualAssetPlan, traceability, preflightReport, package: packageV4 } }] };

const result = compileUnifiedAtomicFactGraph({ activityBundles: bundles, compilerContexts: contexts, titleFact, orchestrationSnapshot: snapshot });
validateUnifiedAtomicFactGraph(result.graph);
assert.ok(Object.isFrozen(result.graph) && Object.isFrozen(result.graph.componentFactRefs));
assert.equal(result.graph.activityRefs.length, 3);
assert.equal(result.graph.componentFactRefs.length, 6);
assert.equal(JSON.stringify(result.graph).includes("final title"), false, "Fact Graph must expose refs, not component or Provider payloads");
assert.equal(result.assembly.assemblyOutput.packageHash, packageV4.packageHash);

const staleInput = structuredClone(contexts);
staleInput[0].input.confirmed_outline.content_promise = "tampered";
assert.throws(() => compileUnifiedAtomicFactGraph({ activityBundles: bundles, compilerContexts: staleInput, titleFact, orchestrationSnapshot: snapshot }), (error) => error.code === "UNIFIED_ATOMIC_ACTIVITY_INPUT_STALE");
const duplicate = [bundles[0], bundles[0], bundles[2]];
assert.throws(() => compileUnifiedAtomicFactGraph({ activityBundles: duplicate, compilerContexts: contexts, titleFact, orchestrationSnapshot: snapshot }), (error) => error.code === "UNIFIED_ATOMIC_ACTIVITY_ORDER_INVALID");
const tamperedBundle = structuredClone(bundles[0]);
tamperedBundle.rawProviderEnvelopeRef.hash = "f".repeat(64);
assert.throws(() => validateUnifiedAtomicActivityBundle(tamperedBundle), (error) => ["UNIFIED_ATOMIC_ACTIVITY_OUTPUT_STALE", "UNIFIED_ATOMIC_ACTIVITY_BUNDLE_HASH_MISMATCH"].includes(error.code));
const driftSnapshot = structuredClone(snapshot);
driftSnapshot.platformRuns[0].xhsAtomicArtifacts.package.packageHash = "f".repeat(64);
assert.throws(() => compileUnifiedAtomicFactGraph({ activityBundles: bundles, compilerContexts: contexts, titleFact, orchestrationSnapshot: driftSnapshot }), (error) => error.code === "UNIFIED_ATOMIC_PACKAGE_ASSEMBLER_DRIFT");

const serverSource = await readFile(new URL("../../content-agent/unified-content-server-adapter.mjs", import.meta.url), "utf8");
const compileIndex = serverSource.indexOf("compileUnifiedAtomicFactGraph({");
const cutoverIndex = serverSource.indexOf('"UNIFIED_ATOMIC_CANDIDATE_CUTOVER_PENDING"');
const candidateIndex = serverSource.indexOf("deriveUnifiedPlatformCandidate({", compileIndex);
const persistenceIndex = serverSource.indexOf("projects.push(record)", compileIndex);
assert.ok(compileIndex > 0 && cutoverIndex > compileIndex && candidateIndex > cutoverIndex && persistenceIndex > candidateIndex, "flag-on server path must compile and stop before Candidate derivation or persistence");
assert.ok(serverSource.includes("if (serverFeatureFlags.unifiedContentXhsAtomicGraphV1 === true)"));

console.log("atomic-fact-graph-compiler-self-test: ok");
