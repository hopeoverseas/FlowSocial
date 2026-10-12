import { stableHash } from "../image-providers/xhs-integrated-page/canonical.mjs";
import { refreshSkillExecutionPlan } from "./skill-execution-plan.mjs";
import { deriveUnifiedPlatformCandidate } from "./unified-skill-output-contracts.mjs";
import { appendUnifiedContentArtifact } from "./unified-content-artifact-store.mjs";
import { buildXhsDesignRuntimeBindings, runPlannedXhsDesignRuntime, validateXhsDesignRuntimeEvidence } from "./xhs-design-runtime-adapter.mjs";
import { buildUnifiedContentXhsProviderAuthority } from "./unified-content-xhs-provider-authority.mjs";
import { resolveUnifiedContentAuthority } from "./unified-content-authority-resolver.mjs";
import { invokeDesignXhsIntegratedPages } from "../skills/design-xhs-integrated-pages/scripts/invoke-skill.mjs";

const HASH = /^[a-f0-9]{64}$/;
const clone = (value) => value == null ? value : structuredClone(value);

function fail(code, message = code, statusCode = 409, details = null) {
  throw Object.assign(new Error(message), { code, statusCode, details });
}

function text(value, code) {
  if (typeof value !== "string" || !value.trim()) fail(code, code, 400);
  return value.trim();
}

function exactRef(value, code) {
  if (!value || typeof value !== "object" || Array.isArray(value) || typeof value.id !== "string" || !value.id.trim() || !HASH.test(value.hash || "")) {
    fail(code, code, 400);
  }
  return { id: value.id.trim(), hash: value.hash };
}

function sameRef(left, right) {
  return Boolean(left && right && left.id === right.id && left.hash === right.hash);
}

function assertRef(actual, expected, code) {
  if (!sameRef(actual, expected)) fail(code, code, 409, { expected, actual: actual || null });
}

function companyAccountContext(store, input, featureFlags) {
  const authority = resolveUnifiedContentAuthority(store, { ...input, platform: "xiaohongshu" }, {
    atomicProductEnabled: featureFlags.unifiedContentAtomicProductV1 === true,
    codes: {
      workspaceRequired: "UNIFIED_XHS_DESIGN_WORKSPACE_REQUIRED", companyRequired: "UNIFIED_XHS_DESIGN_COMPANY_REQUIRED",
      accountRequired: "UNIFIED_XHS_DESIGN_ACCOUNT_REQUIRED", projectRequired: "UNIFIED_XHS_DESIGN_PROJECT_REQUIRED",
      companyNotFound: "UNIFIED_XHS_DESIGN_COMPANY_NOT_FOUND", workspaceMismatch: "UNIFIED_XHS_DESIGN_WORKSPACE_MISMATCH",
      accountOwnershipMismatch: "UNIFIED_XHS_DESIGN_ACCOUNT_OWNERSHIP_MISMATCH", accountWorkspaceMismatch: "UNIFIED_XHS_DESIGN_ACCOUNT_WORKSPACE_MISMATCH",
      projectNotFound: "UNIFIED_XHS_DESIGN_PROJECT_NOT_FOUND", projectOwnershipMismatch: "UNIFIED_XHS_DESIGN_PROJECT_OWNERSHIP_MISMATCH",
      projectAccountMismatch: "UNIFIED_XHS_DESIGN_PROJECT_ACCOUNT_MISMATCH", snapshotHashMismatch: "UNIFIED_XHS_DESIGN_SNAPSHOT_HASH_MISMATCH",
      candidateNotFound: "UNIFIED_XHS_DESIGN_CANDIDATE_STALE_OR_CROSS_PLATFORM", candidateMismatch: "UNIFIED_XHS_DESIGN_CANDIDATE_REF_MISMATCH"
    }
  });
  return authority.authorityKind === "legacy_snapshot_v1"
    ? { ...authority, snapshot: authority.payload.snapshot, platform: authority.payload.platformSnapshot }
    : authority;
}

function atomicRuntimePackage(components, candidate) {
  const { postCopy, finalTitleBinding, carouselPlan, visualAssetPlan, traceability, preflightReport } = components;
  const visuals = new Map(visualAssetPlan.pageVisuals.map((item) => [item.page, item]));
  const assets = new Map(visualAssetPlan.pageAssetBindings.map((item) => [item.page, item.plannedAssetIds]));
  const data = {
    platform: "xiaohongshu", topic_id: "atomic-materialized", intent_profile_id: "atomic-materialized", content_purpose_id: "atomic-materialized",
    account_context: {}, creative_mechanism: "atomic_materialized", journey_stage: "atomic_materialized", matrix_coordination: {},
    content_promise: postCopy.contentPromise, engagement_strategy: {
      mode: postCopy.engagementStrategy.mode, primary_action: postCopy.engagementStrategy.primaryAction,
      reason: postCopy.engagementStrategy.reason, cta_placement: postCopy.engagementStrategy.ctaPlacement, cta_text: postCopy.engagementStrategy.ctaText
    },
    post_copy: {
      title_candidates: postCopy.titleCandidates.map((item) => ({ title: item.title, hook_type: item.hookType, claim_ids: clone(item.claimIds), risk: item.risk })),
      recommended_title: finalTitleBinding.title, opening: postCopy.opening,
      body_sections: postCopy.bodySections.map((item) => ({ section_id: item.sectionId, role: item.role, text: item.text, claim_ids: clone(item.claimIds) })),
      ending: postCopy.ending, pinned_comment: postCopy.pinnedComment, hashtags: clone(postCopy.hashtags), cta: postCopy.cta
    },
    deck: {
      deck_id: carouselPlan.deckId, canvas: clone(carouselPlan.canvas), design_dna_version: carouselPlan.designDnaVersion, reading_arc: carouselPlan.readingArc,
      pages: carouselPlan.pages.map((page) => ({
        page: page.page, role: page.role, objective: page.objective, takeaway: page.takeaway,
        text_layers: page.textLayers.map((item) => ({ type: item.type, text: item.text, max_lines: item.maxLines, priority: item.priority })),
        layout_hint: page.layoutHint, visual_function: visuals.get(page.page).visualFunction, visual_need: visuals.get(page.page).visualNeed,
        render_strategy: visuals.get(page.page).renderStrategy, asset_ids: clone(assets.get(page.page) || []), fact_ids: clone(page.factIds),
        interpretation_ids: clone(page.interpretationIds), must_avoid: [...new Set([...page.mustAvoid, ...visuals.get(page.page).mustAvoid])]
      }))
    },
    image_specs: visualAssetPlan.imageSpecs.map((item) => ({
      asset_id: item.plannedAssetId, page: item.page, use_case: item.useCase, asset_type: item.assetType, scene: item.scene, subject: item.subject,
      style_and_medium: item.styleAndMedium, composition: item.composition, lighting: item.lighting, palette: clone(item.palette), materials: item.materials,
      text_safe_area: item.textSafeArea, prompt: item.prompt, negative_prompt: item.negativePrompt, reference_asset_ids: clone(item.referenceAssetIds),
      design_dna_version: item.designDnaVersion, size: item.size, must_keep: clone(item.mustKeep), must_avoid: clone(item.mustAvoid), text_policy: item.textPolicy
    })),
    skipped_image_pages: visualAssetPlan.skippedPages.map((item) => ({ page: item.page, reason: item.reason })),
    traceability: { used_fact_ids: clone(traceability.usedFactIds), used_interpretation_ids: clone(traceability.usedInterpretationIds), used_knowledge_asset_ids: clone(traceability.usedKnowledgeAssetIds), page_claim_map: traceability.pageClaimMap.map((item) => ({ page: item.page, claim_ids: clone(item.claimIds) })) },
    preflight_checks: preflightReport.checks.map((item) => ({ check: item.check, result: item.result, detail: item.detail }))
  };
  return {
    status: "success",
    data,
    materializedPackageRef: { id: components.package?.id || "atomic-package", hash: components.package?.packageHash || null },
    materializedCandidate: clone(candidate)
  };
}

function atomicDesignDna(store, context) {
  const ref = context.payload.components.postCopy.authorityBinding.designDnaRef;
  const matches = (store.designDnaSnapshots || []).filter((item) => item.id === ref.id && stableHash(item) === ref.hash);
  if (matches.length !== 1 || matches[0].status !== "confirmed") fail("UNIFIED_XHS_DESIGN_DNA_AUTHORITY_MISSING");
  return matches[0];
}

function atomicPlan(createdAt) {
  return {
    kind: "UnifiedSkillExecutionPlan@atomic-xhs-design-1.0", platform: "xiaohongshu", authorization: { mode: "strict" },
    steps: [{ id: "visual_design", kind: "skill", capability: "design-xhs-integrated-pages", enabled: true, state: "planned", decision: "enabled", inputContract: "DesignXhsIntegratedPagesRuntimeInput@1.0", outputContract: "XhsIntegratedPagePromptSet@1.0", createdAt }]
  };
}

function atomicEvidence({ runtimeInput, context, visualDirection, plan }) {
  const skillInvocation = invokeDesignXhsIntegratedPages(runtimeInput);
  const bindings = {
    xhsPostPackageRef: { id: context.payload.assemblyOutput.id, hash: context.payload.assemblyOutput.packageHash },
    sharedContentMasterRef: clone(context.payload.contentProject.sharedContentMasterRef), platformRunRef: clone(context.platformRunRef),
    candidateRef: clone(context.candidateRef), visualSelectionRef: { id: `${runtimeInput.id}:visual-selection`, hash: stableHash(visualDirection) }
  };
  const outputs = { skillInvocation, promptSetHash: skillInvocation.promptSetHash, integratedPageExecutionPlan: null };
  const bundle = { skill: clone(skillInvocation.skill), libraryRefs: clone(skillInvocation.libraryRefs), referenceDocs: clone(skillInvocation.referenceDocs) };
  const base = {
    schemaVersion: "1.0", contract: "XhsVisualDesignRuntimeEvidence@1.0", id: `xhs-design-evidence:${context.platformRunRef.id}:${context.candidateRef.id}:${skillInvocation.invocationHash.slice(0, 16)}`,
    capability: "design-xhs-integrated-pages", stage: "visual_design", platform: "xiaohongshu", status: "prompt_set_ready", executionMode: "deterministic_adapter",
    authorization: { mode: "strict", planRef: { kind: plan.kind, platform: plan.platform, hash: stableHash(plan) }, stepRef: { id: "visual_design", capability: "design-xhs-integrated-pages", hash: stableHash(plan.steps[0]) } },
    bindings, outputs,
    hashes: { bundleHash: stableHash(bundle), libraryHashes: clone(skillInvocation.libraryRefs), inputHash: stableHash({ bindings, runtimeInputRef: skillInvocation.runtimeInputRef }), outputHash: stableHash(outputs), planHash: stableHash(plan), providerExecutionPlanHash: null },
    boundary: { counters: { networkCalls: 0, providerCalls: 0, retries: 0, cost: 0, databaseWrites: 0 }, pageRevisionRefs: [], selectionAuthority: false, deliveryBundleCreated: false, publicationPerformed: false },
    productionEligible: false, nextGate: "ProviderExecutionPlanningInputsRequired"
  };
  const evidence = { ...base, evidenceHash: stableHash(base) };
  validateXhsDesignRuntimeEvidence(evidence);
  return evidence;
}

function normalizedVisualDirection(value, pageIds) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("UNIFIED_XHS_DESIGN_VISUAL_DIRECTION_REQUIRED", "Explicit visualDirection is required", 400);
  const stylePackId = text(value.stylePackId, "UNIFIED_XHS_DESIGN_STYLE_PACK_REQUIRED");
  const reason = text(value.reason, "UNIFIED_XHS_DESIGN_VISUAL_REASON_REQUIRED");
  if (!Array.isArray(value.pages) || value.pages.length !== pageIds.length) fail("UNIFIED_XHS_DESIGN_PAGE_SELECTION_MISMATCH", "Visual direction must select every candidate page exactly once", 409);
  const pages = value.pages.map((page) => {
    if (!page || typeof page !== "object" || Array.isArray(page)) fail("UNIFIED_XHS_DESIGN_PAGE_SELECTION_INVALID", "Invalid visual page selection", 400);
    return {
      pageId: text(page.pageId, "UNIFIED_XHS_DESIGN_PAGE_ID_REQUIRED"),
      archetypeId: text(page.archetypeId, "UNIFIED_XHS_DESIGN_ARCHETYPE_REQUIRED"),
      patternIds: Array.isArray(page.patternIds) ? page.patternIds.map((item) => text(item, "UNIFIED_XHS_DESIGN_PATTERN_REQUIRED")) : [],
      referenceAssetIds: Array.isArray(page.referenceAssetIds) ? page.referenceAssetIds.map((item) => text(item, "UNIFIED_XHS_DESIGN_REFERENCE_ASSET_INVALID")) : [],
      verbatimTextOverride: page.verbatimTextOverride == null ? null : text(page.verbatimTextOverride, "UNIFIED_XHS_DESIGN_TEXT_OVERRIDE_INVALID"),
      stylePackId: page.stylePackId == null ? null : text(page.stylePackId, "UNIFIED_XHS_DESIGN_PAGE_STYLE_INVALID")
    };
  });
  if (new Set(pages.map((page) => page.pageId)).size !== pages.length
    || [...pages.map((page) => page.pageId)].sort().some((id, index) => id !== [...pageIds].sort()[index])) {
    fail("UNIFIED_XHS_DESIGN_PAGE_SELECTION_MISMATCH", "Visual direction must bind the exact candidate page set", 409);
  }
  return { stylePackId, reason, pages };
}

function pageIdsFromPackage(xhsPostPackage) {
  const pages = xhsPostPackage?.data?.deck?.pages;
  if (!Array.isArray(pages) || pages.length === 0) fail("UNIFIED_XHS_DESIGN_CANDIDATE_DECK_REQUIRED", "Candidate writer output has no designable deck", 409);
  const ids = pages.map((page, index) => `P${Number.isInteger(page?.page) ? page.page : index + 1}`);
  if (new Set(ids).size !== ids.length) fail("UNIFIED_XHS_DESIGN_CANDIDATE_PAGE_IDS_INVALID");
  return ids;
}

function derivedPageDensity(xhsPostPackage) {
  return Object.fromEntries(xhsPostPackage.data.deck.pages.map((page, index) => {
    const count = Array.isArray(page.text_layers) ? page.text_layers.length : 0;
    // A normal title + body page is medium-density design input.  Classifying
    // it as low made every method/list archetype in the current library
    // inapplicable and blocked the design stage before prompt compilation.
    return [`P${Number.isInteger(page.page) ? page.page : index + 1}`, count <= 1 ? "low" : count <= 5 ? "medium" : "high"];
  }));
}

function canonicalWriterPackage(snapshot, candidate) {
  const xhsFacts = (snapshot.skillOutputFacts || []).filter((fact) => fact.platform === "xiaohongshu" && fact.capability === "write-xhs-content");
  if (xhsFacts.length !== 1) fail("UNIFIED_XHS_DESIGN_WRITER_FACT_AMBIGUOUS", "Exactly one canonical XHS writer fact is required", 409);
  const fact = xhsFacts[0];
  if (stableHash(fact.runtimeOutput) !== fact.outputHash) fail("UNIFIED_XHS_DESIGN_WRITER_OUTPUT_HASH_MISMATCH");
  if (candidate.writerOutputRef?.hash && candidate.writerOutputRef.hash !== fact.outputHash) fail("UNIFIED_XHS_DESIGN_CANDIDATE_WRITER_REF_MISMATCH");
  if (fact.runtimeOutput?.status !== "success" || !fact.runtimeOutput?.data) fail("UNIFIED_XHS_DESIGN_WRITER_OUTPUT_NOT_SUCCESS", "Canonical writer output is not a successful XhsPostPackage", 409);
  return clone(fact.runtimeOutput);
}

function runtimeInputFor({ snapshot, candidate, xhsPostPackage, visualDirection, providerCapabilityOverride = null }) {
  const platformBrief = snapshot.orchestrationSnapshot?.platformRuns?.find((run) => run.platform === "xiaohongshu")?.platformBrief?.brief || {};
  const designDna = platformBrief.designDna;
  const designDnaRef = platformBrief.designDnaRef;
  if (!designDna || typeof designDna !== "object" || Array.isArray(designDna)) fail("UNIFIED_XHS_DESIGN_DNA_AUTHORITY_MISSING");
  if (designDna.status !== "confirmed") fail("UNIFIED_XHS_DESIGN_DNA_NOT_CONFIRMED");
  if (!designDnaRef?.id || !HASH.test(designDnaRef.hash || "") || designDna.id !== designDnaRef.id || stableHash(designDna) !== designDnaRef.hash) {
    fail("UNIFIED_XHS_DESIGN_DNA_REFERENCE_MISMATCH");
  }
  if (xhsPostPackage?.data?.deck?.design_dna_version !== designDnaRef.id
    || xhsPostPackage?.data?.image_specs?.some((item) => item?.design_dna_version !== designDnaRef.id)) {
    fail("UNIFIED_XHS_WRITER_DESIGN_DNA_BINDING_MISMATCH");
  }
  const runtimeDesignDna = {
    snapshotId: designDnaRef.id,
    palette: clone(designDna.colors),
    typographyRoles: clone(designDna.fontPreferences),
    constraints: clone([
      ...designDna.layoutPreferences,
      ...designDna.materials,
      ...(designDna.photographyOrIllustrationDirection.trim() ? [designDna.photographyOrIllustrationDirection] : []),
      ...designDna.forbiddenMotifs
    ])
  };
  return {
    schemaVersion: "1.0",
    contract: "DesignXhsIntegratedPagesRuntimeInput@1.0",
    id: `xhs-design-runtime:${candidate.id}:${stableHash(visualDirection).slice(0, 16)}`,
    xhsPostPackage,
    contentVersion: Number.isInteger(candidate.contentVersion) && candidate.contentVersion > 0 ? candidate.contentVersion : 1,
    designDna: runtimeDesignDna,
    authorizedAssets: Array.isArray(platformBrief.authorizedAssets) ? clone(platformBrief.authorizedAssets) : [],
    providerCapability: providerCapabilityOverride || (platformBrief.providerCapability && typeof platformBrief.providerCapability === "object" && !Array.isArray(platformBrief.providerCapability) ? clone(platformBrief.providerCapability) : {}),
    pageDensity: derivedPageDensity(xhsPostPackage),
    visualSelection: clone(visualDirection)
  };
}

function assertNoCallerAuthority(input) {
  const forbidden = ["evidence", "runtimeInput", "sharedContentMaster", "platformRun", "candidate", "skillExecutionPlan", "expectedPlanHash", "providerPlanningInput"];
  const supplied = forbidden.filter((key) => Object.hasOwn(input, key));
  if (supplied.length) fail("UNIFIED_XHS_DESIGN_CALLER_AUTHORITY_FORBIDDEN", "Caller cannot inject runtime or evidence authority", 400, { fields: supplied });
}

function evidenceWithTruthfulNextGate(runtimeEvidence) {
  const evidence = clone(runtimeEvidence);
  const executionPlan = evidence.outputs?.integratedPageExecutionPlan || null;
  const readyForApproval = executionPlan?.execution?.status === "ready_for_isolated_provider_execution";
  const nextGate = readyForApproval
    ? "HumanProviderExecutionApproval"
    : executionPlan
      ? "ProviderExecutionPlanResolutionRequired"
      : "ProviderExecutionPlanningInputsRequired";
  if (evidence.nextGate === nextGate) return evidence;
  delete evidence.evidenceHash;
  evidence.nextGate = nextGate;
  evidence.evidenceHash = stableHash(evidence);
  validateXhsDesignRuntimeEvidence(evidence);
  return evidence;
}

export function executeUnifiedContentXhsDesignStage(store, input, { featureFlags = {}, now = new Date().toISOString() } = {}) {
  assertNoCallerAuthority(input || {});
  if (featureFlags.xhsIntegratedPageDesignSkill !== true) fail("UNIFIED_XHS_DESIGN_FEATURE_DISABLED", "XHS integrated page design is disabled", 404);
  const context = companyAccountContext(store, input || {}, featureFlags);
  if (context.authorityKind === "atomic_v2") {
    const requestedRunRef = exactRef(input.platformRunRef, "UNIFIED_XHS_DESIGN_RUN_REF_REQUIRED");
    assertRef(requestedRunRef, context.platformRunRef, "UNIFIED_XHS_DESIGN_RUN_REF_MISMATCH");
    const requestedCandidateRef = exactRef(input.candidateRef, "UNIFIED_XHS_DESIGN_CANDIDATE_REF_REQUIRED");
    assertRef(requestedCandidateRef, context.candidateRef, "UNIFIED_XHS_DESIGN_CANDIDATE_REF_MISMATCH");
    const components = { ...context.payload.components, package: context.payload.assemblyOutput };
    const xhsPostPackage = atomicRuntimePackage(components, context.payload.candidate);
    const pageIds = pageIdsFromPackage(xhsPostPackage);
    const visualDirection = normalizedVisualDirection(input.visualDirection, pageIds);
    const directionHash = stableHash(visualDirection);
    const existingFacts = (store.unifiedContentXhsDesignFacts || []).filter((fact) => sameRef(fact.contentProjectRef, context.executionProjectRef)
      && sameRef(fact.materializedContentProjectRef, context.materializedProjectRef)
      && sameRef(fact.platformRunRef, context.platformRunRef) && sameRef(fact.candidateRef, context.candidateRef));
    for (const fact of existingFacts) {
      const priorHash = fact.evidence?.bindings?.visualSelectionRef?.hash;
      if (priorHash && priorHash !== directionHash) fail("UNIFIED_XHS_DESIGN_VISUAL_DIRECTION_CONFLICT", "Candidate already has immutable evidence for another visual direction", 409);
    }
    const dna = atomicDesignDna(store, context);
    const providerAuthority = featureFlags.unifiedContentXhsProviderAuthorityV1 === true
      ? buildUnifiedContentXhsProviderAuthority({ stylePackId: visualDirection.stylePackId }) : null;
    const runtimeInput = {
      schemaVersion: "1.0", contract: "DesignXhsIntegratedPagesRuntimeInput@1.0",
      id: `xhs-design-runtime:${context.candidateRef.id}:${directionHash.slice(0, 16)}`, xhsPostPackage, contentVersion: 1,
      designDna: { snapshotId: dna.id, palette: clone(dna.colors), typographyRoles: clone(dna.fontPreferences), constraints: [...clone(dna.layoutPreferences), ...clone(dna.materials), dna.photographyOrIllustrationDirection, ...clone(dna.forbiddenMotifs)].filter(Boolean) },
      authorizedAssets: context.payload.components.visualAssetPlan.authorizedReferenceAssets.map((item) => ({ assetId: item.id, hash: item.hash, status: "authorized" })),
      providerCapability: providerAuthority ? clone(providerAuthority.capabilitySnapshot.capabilities) : {},
      pageDensity: Object.fromEntries(context.payload.components.carouselPlan.pages.map((page) => [`P${page.page}`, ["cover", "cta", "summary"].includes(page.role) ? "low" : "medium"])), visualSelection: clone(visualDirection)
    };
    const plan = atomicPlan(context.payload.contentProject.createdAt);
    const evidence = atomicEvidence({ runtimeInput, context, visualDirection, plan });
    const appended = appendUnifiedContentArtifact(store, {
      workspaceId: context.workspaceId, companyId: context.companyId, accountId: context.accountId,
      projectId: context.projectId, productSnapshotHash: context.productAuthorityHash, platform: "xiaohongshu", candidateId: context.candidateRef.id,
      operation: "xhs_design_evidence", evidence, idempotencyKey: text(input.idempotencyKey, "UNIFIED_XHS_DESIGN_IDEMPOTENCY_KEY_REQUIRED")
    }, {
      now, featureFlags,
      authoritativeXhsDesignBindings: { platformRunRef: context.platformRunRef, candidateRef: context.candidateRef, productCandidateRef: context.candidateRef }
    });
    return {
      schemaVersion: "1.0", contract: "UnifiedXhsDesignStageResult@1.0", created: appended.created,
      authorityKind: context.authorityKind, contentProjectRef: clone(context.executionProjectRef), materializedContentProjectRef: clone(context.materializedProjectRef),
      evidence: clone(evidence), artifactFact: clone(appended.facts[0]), artifactState: clone(appended.artifactState), nextGate: evidence.nextGate,
      planningReadiness: { integratedPageExecutionPlanPresent: false, readyForHumanProviderExecutionApproval: false, missingAuthorityInputs: ["provider_review_decision_ref", "provider_capability_snapshot_ref", "provider_registry_snapshot_ref", "provider_cost_confirmation_ref"] },
      providerPlanningOptions: providerAuthority ? { mode: "isolated_experimental", authoritySnapshotRef: { id: providerAuthority.id, hash: providerAuthority.snapshotHash }, stylePackId: providerAuthority.supportedStylePackId, directionCandidates: clone(providerAuthority.directionCandidates), productionVerified: false, providerApprovalEligible: false } : null,
      claims: { providerTextCalls: 0, providerImageCalls: 0, providerCalls: 0, platformCalls: 0, externalCalls: 0, networkCalls: 0, databaseWrites: appended.created ? 1 : 0, pageRevisionRefs: [], visualReviewPerformed: false, selectionAuthority: false, deliveryBundleCreated: false, publicationPerformed: false }
    };
  }
  if (!HASH.test(input.productSnapshotHash || "") || input.productSnapshotHash !== context.snapshot.productSnapshotHash) fail("UNIFIED_XHS_DESIGN_SNAPSHOT_HASH_MISMATCH", "Caller must bind the exact product snapshot", 409);
  const requestedRunRef = exactRef(input.platformRunRef, "UNIFIED_XHS_DESIGN_RUN_REF_REQUIRED");
  assertRef(requestedRunRef, context.platform.platformRunRef, "UNIFIED_XHS_DESIGN_RUN_REF_MISMATCH");
  const requestedCandidateRef = exactRef(input.candidateRef, "UNIFIED_XHS_DESIGN_CANDIDATE_REF_REQUIRED");
  const currentCandidateRef = (context.platform.candidateRefs || []).find((ref) => ref.id === requestedCandidateRef.id);
  if (!currentCandidateRef) fail("UNIFIED_XHS_DESIGN_CANDIDATE_STALE_OR_CROSS_PLATFORM", "Candidate is not current for this run", 409);
  assertRef(requestedCandidateRef, currentCandidateRef, "UNIFIED_XHS_DESIGN_CANDIDATE_REF_MISMATCH");
  const orchestrationRun = context.snapshot.orchestrationSnapshot?.platformRuns?.find((run) => run.platform === "xiaohongshu");
  if (!orchestrationRun?.platformRunRef || !orchestrationRun.executionPlan) fail("UNIFIED_XHS_DESIGN_ORCHESTRATION_AUTHORITY_MISSING");
  if (stableHash(orchestrationRun.executionPlan) !== orchestrationRun.executionPlanHash) fail("UNIFIED_XHS_DESIGN_SOURCE_PLAN_HASH_MISMATCH", "Stored XHS execution plan does not verify", 409);
  const derived = deriveUnifiedPlatformCandidate({
    contentProjectId: context.projectId,
    platform: "xiaohongshu",
    platformRunRef: orchestrationRun.platformRunRef,
    outputFacts: context.snapshot.skillOutputFacts || []
  });
  assertRef(derived.candidateRef, currentCandidateRef, "UNIFIED_XHS_DESIGN_DERIVED_CANDIDATE_MISMATCH");
  const candidate = clone(derived.candidate);
  const xhsPostPackage = canonicalWriterPackage(context.snapshot, candidate);
  const pageIds = pageIdsFromPackage(xhsPostPackage);
  const visualDirection = normalizedVisualDirection(input.visualDirection, pageIds);
  const existingFacts = (store.unifiedContentXhsDesignFacts || []).filter((fact) => sameRef(fact.contentProjectRef, { id: context.projectId, hash: context.snapshot.contentProject.projectHash })
    && sameRef(fact.platformRunRef, context.platform.platformRunRef) && sameRef(fact.candidateRef, currentCandidateRef));
  const directionHash = stableHash(visualDirection);
  for (const fact of existingFacts) {
    const priorHash = fact.evidence?.bindings?.visualSelectionRef?.hash;
    if (priorHash && priorHash !== directionHash) fail("UNIFIED_XHS_DESIGN_VISUAL_DIRECTION_CONFLICT", "Candidate already has immutable evidence for another visual direction", 409);
  }
  const plan = refreshSkillExecutionPlan(orchestrationRun.executionPlan, {
    enableXhsIntegratedPageDesign: true,
    xhsDesignBindingsReady: true,
    featureFlags: { xhsIntegratedPageDesignSkill: true }
  });
  plan.updatedAt = orchestrationRun.executionPlan.updatedAt || orchestrationRun.executionPlan.createdAt || context.snapshot.createdAt;
  const expectedPlanHash = stableHash(plan);
  const sharedContentMaster = clone(context.snapshot.orchestrationSnapshot.sharedContentMaster);
  if (!sharedContentMaster?.id || stableHash(sharedContentMaster) !== context.snapshot.sharedContentMasterRef?.hash) fail("UNIFIED_XHS_DESIGN_SHARED_MASTER_HASH_MISMATCH");
  const platformRun = clone(orchestrationRun.platformRunRef);
  platformRun.sharedContentMasterRef = { id: sharedContentMaster.id, hash: stableHash(sharedContentMaster) };
  candidate.id = currentCandidateRef.id;
  candidate.platformRunRef = { id: platformRun.id, hash: stableHash(platformRun) };
  candidate.xhsPostPackageRef = { id: xhsPostPackage.id || xhsPostPackage.data?.id || `${candidate.id}:xhs-post-package`, hash: stableHash(xhsPostPackage) };
  const providerAuthority = featureFlags.unifiedContentXhsProviderAuthorityV1 === true
    ? buildUnifiedContentXhsProviderAuthority({ stylePackId: visualDirection.stylePackId })
    : null;
  const runtimeInput = runtimeInputFor({
    snapshot: context.snapshot,
    candidate,
    xhsPostPackage,
    visualDirection,
    providerCapabilityOverride: providerAuthority ? clone(providerAuthority.capabilitySnapshot.capabilities) : null
  });
  const bindings = buildXhsDesignRuntimeBindings({ runtimeInput, sharedContentMaster, platformRun, candidate });
  const evidence = evidenceWithTruthfulNextGate(runPlannedXhsDesignRuntime({
    runtimeInput,
    sharedContentMaster,
    platformRun,
    candidate,
    bindings,
    skillExecutionPlan: plan,
    expectedPlanHash,
    featureFlags: { xhsIntegratedPageDesignSkill: true },
    providerPlanningInput: null
  }));
  const appended = appendUnifiedContentArtifact(store, {
    workspaceId: context.workspaceId,
    companyId: context.companyId,
    accountId: context.accountId,
    projectId: context.projectId,
    platform: "xiaohongshu",
    candidateId: currentCandidateRef.id,
    operation: "xhs_design_evidence",
    evidence,
    idempotencyKey: text(input.idempotencyKey, "UNIFIED_XHS_DESIGN_IDEMPOTENCY_KEY_REQUIRED")
  }, {
    now,
    featureFlags,
    authoritativeXhsDesignBindings: { platformRunRef: bindings.platformRunRef, candidateRef: bindings.candidateRef, productCandidateRef: currentCandidateRef }
  });
  return {
    schemaVersion: "1.0",
    contract: "UnifiedXhsDesignStageResult@1.0",
    created: appended.created,
    evidence: clone(evidence),
    artifactFact: clone(appended.facts[0]),
    artifactState: clone(appended.artifactState),
    nextGate: evidence.nextGate,
    planningReadiness: {
      integratedPageExecutionPlanPresent: Boolean(evidence.outputs.integratedPageExecutionPlan),
      readyForHumanProviderExecutionApproval: evidence.outputs.integratedPageExecutionPlan?.execution?.status === "ready_for_isolated_provider_execution",
      missingAuthorityInputs: evidence.outputs.integratedPageExecutionPlan ? [] : ["provider_review_decision_ref", "provider_capability_snapshot_ref", "provider_registry_snapshot_ref", "provider_cost_confirmation_ref"]
    },
    providerPlanningOptions: providerAuthority ? {
      mode: "isolated_experimental",
      authoritySnapshotRef: { id: providerAuthority.id, hash: providerAuthority.snapshotHash },
      stylePackId: providerAuthority.supportedStylePackId,
      directionCandidates: clone(providerAuthority.directionCandidates),
      productionVerified: false,
      providerApprovalEligible: false
    } : null,
    claims: { providerTextCalls: 0, providerImageCalls: 0, providerCalls: 0, platformCalls: 0, externalCalls: 0, networkCalls: 0, databaseWrites: appended.created ? 1 : 0, pageRevisionRefs: [], visualReviewPerformed: false, selectionAuthority: false, deliveryBundleCreated: false, publicationPerformed: false }
  };
}
