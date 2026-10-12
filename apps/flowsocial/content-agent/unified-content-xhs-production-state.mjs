import { resolveUnifiedContentAuthority } from "./unified-content-authority-resolver.mjs";
import { getUnifiedContentArtifactState } from "./unified-content-artifact-store.mjs";
import { listUnifiedContentReviewState } from "./content-review-store.mjs";
import { buildUnifiedContentXhsProviderAuthority } from "./unified-content-xhs-provider-authority.mjs";
import { normalizeXhsPresentationText } from "../skills/design-xhs-integrated-pages/scripts/runtime-compiler.mjs";
import { stableHash } from "../image-providers/xhs-integrated-page/canonical.mjs";

const CONTRACT = "UnifiedXhsProductionState@1.0";
const clone = (value) => value == null ? value : structuredClone(value);
const ref = (value, hashField = "factHash") => value?.id && value?.[hashField] ? { id: value.id, hash: value[hashField] } : null;
const anyRef = (value) => ref(value) || ref(value, "deliveryHash") || ref(value, "promotionHash");
const latest = (items = []) => items.length ? items[items.length - 1] : null;
const sameRef = (left, right) => Boolean(left && right && left.id === right.id && left.hash === right.hash);

function scoped(items, authority, fields = []) {
  return (items || []).filter((item) => fields.every((field) => {
    const [key, refKey] = field;
    const expected = authority[refKey || key];
    // Legacy snapshot facts predate the atomic materialized-project binding.
    // They remain valid when all legacy authority refs match; requiring a
    // field that did not exist would make the state machine falsely regress.
    if (key === "materializedContentProjectRef" && authority.authorityKind !== "atomic_v2" && !item[key]) return true;
    return !expected || (item[key]?.id === expected.id && (!expected.hash || item[key]?.hash === expected.hash));
  }));
}

function refsFor(store, authority) {
  const fields = [["contentProjectRef", "executionProjectRef"], ["materializedContentProjectRef", "materializedProjectRef"], ["platformRunRef"], ["candidateRef"]];
  const result = {};
  const collections = {
    design: "unifiedContentXhsDesignFacts",
    providerPlan: "unifiedContentXhsProviderPlanFacts",
    providerApproval: "unifiedContentXhsProviderExecutionApprovalFacts",
    providerAttempts: "unifiedContentXhsProviderAttemptFacts",
    providerCheckpoints: "unifiedContentXhsProviderExecutionCheckpointFacts",
    visualApproval: "unifiedContentXhsVisualReviewApprovalFacts",
    visualReview: "unifiedContentXhsVisualReviewFacts",
    visualCheckpoints: "unifiedContentXhsVisualReviewCheckpointFacts",
    humanVisualConfirmations: "unifiedContentXhsHumanVisualConfirmationFacts",
    lightRevisionExecutions: "unifiedContentXhsLightRevisionExecutions",
    lightRevisionCompletions: "unifiedContentXhsLightRevisionCompletions",
    lightRevisionCheckpoints: "unifiedContentXhsLightRevisionCheckpoints",
    lightRevisionResolutions: "unifiedContentXhsLightRevisionReconciliationResolutions",
    deliveries: "unifiedAtomicXhsDeliveries"
  };
  for (const [name, collection] of Object.entries(collections)) {
    result[name] = latest(scoped(store[collection], authority, fields));
  }
  const providerPlanFactRef = ref(result.providerPlan);
  const providerPlanRef = result.providerPlan?.plan ? { id: result.providerPlan.plan.id, hash: result.providerPlan.plan.planHash } : null;
  result.providerApproval = latest(scoped(store.unifiedContentXhsProviderExecutionApprovalFacts, authority, fields).filter((item) => sameRef(item.providerPlanFactRef, providerPlanFactRef)));
  const planAttempts = scoped(store.unifiedContentXhsProviderAttemptFacts, authority, fields)
    .filter((item) => sameRef(item.planRef, providerPlanRef));
  const approvalAttempts = planAttempts.filter((item) => sameRef(item.approvalRef, result.providerApproval?.runtimeApprovalRef));
  result.providerAttempts = latest(approvalAttempts);
  result.providerApprovalExhausted = Boolean(result.providerApproval)
    && approvalAttempts.length >= Number(result.providerApproval?.limits?.maxProviderCalls || 0);
  result.providerCheckpoints = latest(scoped(store.unifiedContentXhsProviderExecutionCheckpointFacts, authority, fields).filter((item) => sameRef(item.providerPlanFactRef, providerPlanFactRef)));
  result.visualApproval = latest(scoped(store.unifiedContentXhsVisualReviewApprovalFacts, authority, fields).filter((item) => sameRef(item.planRef, providerPlanRef)));
  result.visualReview = latest(scoped(store.unifiedContentXhsVisualReviewFacts, authority, fields).filter((item) => sameRef(item.planRef, providerPlanRef)));
  result.visualCheckpoints = latest(scoped(store.unifiedContentXhsVisualReviewCheckpointFacts, authority, fields).filter((item) => sameRef(item.planRef, providerPlanRef)));
  const pageIds = result.providerPlan?.plan?.pages?.map((page) => page.pageId).filter(Boolean) || [];
  // A budget re-approval creates a new immutable provider plan, but it does
  // not invalidate already-successful pages from the same design evidence.
  // Aggregate page heads across plan generations so a recovered run can
  // complete the set without regenerating paid pages.
  const revisions = scoped(store.unifiedContentXhsPageRevisionFacts, authority, fields);
  const heads = pageIds.map((pageId) => revisions.filter((item) => item.pageId === pageId).sort((left, right) => left.revision - right.revision).at(-1)).filter(Boolean);
  result.providerMissingPageIds = pageIds.filter((pageId) => !heads.some((item) => item.pageId === pageId));
  result.nextProviderAttempt = Math.max(0, ...planAttempts.map((item) => Number(item.attempt || 0))) + 1;
  const revisionRefs = heads.map((item) => ref(item, "revisionHash"));
  result.currentRevisionSetHash = heads.length === pageIds.length && pageIds.length ? stableHash(revisionRefs) : null;
  result.humanVisualConfirmation = latest(scoped(store.unifiedContentXhsHumanVisualConfirmationFacts, authority, fields).filter((item) =>
    sameRef(item.providerPlanFactRef, ref(result.providerPlan))
    && item.revisionSetHash === result.currentRevisionSetHash
    && stableHash(item.pageRevisionRefs || []) === stableHash(revisionRefs)
  ));
  const lightExecutions = scoped(store.unifiedContentXhsLightRevisionExecutions, authority, fields);
  const lightCompletions = scoped(store.unifiedContentXhsLightRevisionCompletions, authority, fields);
  const lightCheckpoints = scoped(store.unifiedContentXhsLightRevisionCheckpoints, authority, fields);
  const lightResolutions = scoped(store.unifiedContentXhsLightRevisionReconciliationResolutions, authority, fields);
  const unresolvedLightCheckpoints = lightCheckpoints.filter((checkpoint) => checkpoint.requiresReconciliation === true && !lightResolutions.some((resolution) => sameRef(resolution.checkpointFactRef, ref(checkpoint))));
  result.lightRevisionCheckpoints = latest(unresolvedLightCheckpoints);
  result.lightPendingExecution = lightExecutions.findLast((execution) => execution.status === "provider_task_created"
    && !lightCompletions.some((completion) => sameRef(completion.executionFactRef, ref(execution)))
    && !unresolvedLightCheckpoints.some((checkpoint) => sameRef(checkpoint.executionFactRef, ref(execution)) || (sameRef(checkpoint.planFactRef, execution.planFactRef) && sameRef(checkpoint.approvalFactRef, execution.approvalFactRef)))) || null;
  return result;
}

function scopedAtomicRecord(item, authority) {
  // Final-delivery records created before the 2026-08-24 recovery did not
  // persist `platform`. Their contract is unambiguously XHS and the exact
  // project/run/candidate refs still provide the authority boundary.
  if (!item || (item.platform && item.platform !== "xiaohongshu")
    || (!item.platform && item.contract !== "AtomicXhsFinalDeliveryRecord@1.0")) return false;
  return scoped([item], authority, [["contentProjectRef", "executionProjectRef"], ["platformRunRef"], ["candidateRef"]]).length === 1;
}

export function projectUnifiedXhsPreGenerationReview(authority, promptSet = null) {
  const postCopy = authority?.payload?.components?.postCopy || null;
  const carouselPlan = authority?.payload?.components?.carouselPlan || null;
  const brandConstraint = (promptSet?.visualStyleSelection?.constraints || []).find((item) => /^品牌色(?:锚点)?[:：]/.test(String(item || ""))) || "";
  const brandColor = String(brandConstraint).match(/#[0-9a-f]{6}\b/i)?.[0]?.toUpperCase() || null;
  return {
    brandColorUsage: brandColor
      ? `本次只把 ${brandColor} 作为少量品牌识别色；背景、主辅色和画面氛围由内容决定。`
      : "本次没有设置品牌色锚点；系统将完全根据内容决定配色。",
    creativePrinciple: "系统根据每页主题选择视觉媒介、材质、构图和配色，不套固定封面、信息卡或视觉识别手册模板。",
    copy: postCopy ? {
      title: postCopy.recommendedTitle || authority?.payload?.components?.finalTitleBinding?.title || "",
      opening: postCopy.opening || "",
      bodySections: (postCopy.bodySections || []).map((item) => ({
        heading: item.heading || item.title || "",
        text: item.text || ""
      })),
      ending: postCopy.ending || "",
      hashtags: clone(postCopy.hashtags || []),
      cta: postCopy.cta || ""
    } : null,
    pages: (carouselPlan?.pages || []).map((page, index) => ({
      pageId: page.pageId || `P${index + 1}`,
      page: page.page || index + 1,
      role: page.role || "",
      textLayers: (page.textLayers || page.text_layers || []).map((layer) => ({ type: layer.type || "", text: normalizeXhsPresentationText(layer.text || "") }))
    })),
    prompts: (promptSet?.pagePromptSpecs || []).map((page) => ({
      pageId: page.pageId,
      requiredText: clone((page.promptBlocks?.verbatimText || []).map(normalizeXhsPresentationText)),
      composition: clone(page.promptBlocks?.composition || []),
      creativeConcept: clone(page.promptBlocks?.style || []),
      style: clone(page.promptBlocks?.style || []),
      avoid: clone(page.promptBlocks?.negativeConstraints || [])
    }))
  };
}

function stateFromFacts(facts, artifactState, reviewState, store, authority, { lightRevisionEnabled = false, localPackageOnly = false } = {}) {
  const design = facts.design;
  const plan = facts.providerPlan;
  const approval = facts.providerApproval;
  const attempt = facts.providerAttempts;
  const checkpoint = facts.providerCheckpoints;
  const visualApproval = facts.visualApproval;
  const visualReview = facts.visualReview;
  const visualCheckpoint = facts.visualCheckpoints;
  const humanVisualConfirmation = facts.humanVisualConfirmation;
  const lightRevisionCheckpoint = facts.lightRevisionCheckpoints;
  const lightPendingExecution = facts.lightPendingExecution;
  const delivery = Array.isArray(facts.deliveries) ? latest(facts.deliveries) : facts.deliveries || null;
  let providerOptions = null;
  const promptSet = design?.evidence?.outputs?.skillInvocation?.promptSet;
  const promptSetHash = design?.evidence?.outputs?.skillInvocation?.promptSetHash || design?.evidence?.outputs?.promptSetHash || null;
  // This is an additive, customer-safe projection of already-persisted facts.
  // It deliberately excludes hashes, Provider request bodies and the raw VI
  // extraction. Historical candidates remain immutable.
  const preGenerationReview = projectUnifiedXhsPreGenerationReview(authority, promptSet);
  if (design && promptSet) {
    try {
      const snapshot = buildUnifiedContentXhsProviderAuthority({ stylePackId: promptSet.visualStyleSelection?.stylePackId });
      providerOptions = { authoritySnapshotRef: { id: snapshot.id, hash: snapshot.snapshotHash }, directionCandidates: clone(snapshot.directionCandidates), promptSetRef: { id: promptSet.id, hash: promptSetHash } };
    } catch { providerOptions = { promptSetRef: promptSetHash ? { id: promptSet.id, hash: promptSetHash } : null, directionCandidates: [] }; }
  }
  const blockers = [];
  let status = "ready";
  let nextAllowedAction = "start_design";
  if (!design) { status = "design_required"; nextAllowedAction = "design"; blockers.push("design_required"); }
  else if (!plan) { status = "provider_plan_required"; nextAllowedAction = "provider_plan"; blockers.push("provider_plan_required"); }
  else if (!approval || (facts.providerApprovalExhausted && !facts.currentRevisionSetHash)) { status = "provider_execution_approval_required"; nextAllowedAction = "approve_provider_execution"; blockers.push(facts.providerApprovalExhausted ? "provider_execution_reapproval_required" : "provider_execution_approval_required"); }
  else if (!attempt) { status = "provider_execution_required"; nextAllowedAction = "execute_provider"; blockers.push("provider_execution_required"); }
  else if (checkpoint?.requiresReconciliation === true) { status = "provider_result_unknown"; nextAllowedAction = "reconcile_provider_result"; blockers.push("provider_result_unknown_reconciliation_required"); }
  else if (lightRevisionEnabled && lightRevisionCheckpoint?.requiresReconciliation === true) { status = "light_revision_result_unknown"; nextAllowedAction = "reconcile_light_revision_result"; blockers.push("light_revision_result_unknown_reconciliation_required"); }
  else if (lightRevisionEnabled && lightPendingExecution) { status = "light_revision_processing"; nextAllowedAction = "continue_light_revision_task"; }
  else if (lightRevisionEnabled && !facts.currentRevisionSetHash) { status = "provider_execution_required"; nextAllowedAction = "execute_provider"; blockers.push("provider_execution_required"); }
  else if (lightRevisionEnabled && !humanVisualConfirmation) { status = "human_visual_confirmation_required"; nextAllowedAction = "confirm_human_visual_set"; blockers.push("human_visual_confirmation_required"); }
  else if (!lightRevisionEnabled && !visualApproval) { status = "visual_review_approval_required"; nextAllowedAction = "approve_visual_review"; blockers.push("visual_review_approval_required"); }
  else if (!lightRevisionEnabled && !visualReview) { status = "visual_review_required"; nextAllowedAction = "execute_visual_review"; blockers.push("visual_review_required"); }
  else if (!lightRevisionEnabled && visualCheckpoint?.requiresReconciliation === true) { status = "visual_review_unknown"; nextAllowedAction = "reconcile_visual_review"; blockers.push("visual_review_unknown_reconciliation_required"); }
  else if (!artifactState?.selectable) { status = "artifact_review_required"; nextAllowedAction = "review_artifacts"; blockers.push(...(artifactState?.blockers || ["artifact_review_required"])); }
  else if (!reviewState?.selectionFacts?.some((item) => item.status === "selected")) { status = "selection_required"; nextAllowedAction = "select_exact_version"; blockers.push("user_selection_required"); }
  else {
    const promotion = (store.contentPromotions || []).find((item) => item.contract === "AtomicXhsPromotionRecord@1.0" && scopedAtomicRecord(item, authority));
    const delivery = (store.unifiedAtomicXhsDeliveries || []).find((item) => scopedAtomicRecord(item, authority));
    if (!promotion) { status = "promotion_required"; nextAllowedAction = "preview_promotion"; blockers.push("promotion_required"); }
    else if (!delivery) { status = "final_delivery_required"; nextAllowedAction = "create_final_delivery"; blockers.push("final_delivery_required"); }
    else if (localPackageOnly) { status = "local_delivery_complete"; nextAllowedAction = null; }
    else { status = "publication_confirmation_required"; nextAllowedAction = "confirm_publication"; blockers.push("publication_confirmation_required"); }
  }
  const factRef = (fact) => fact ? ref(fact) : null;
  const promotion = (store.contentPromotions || []).find((item) => item.contract === "AtomicXhsPromotionRecord@1.0" && scopedAtomicRecord(item, authority)) || null;
  return {
    schemaVersion: "1.0", contract: CONTRACT, platform: "xiaohongshu", status, nextAllowedAction,
    authority: { workspaceId: authority.workspaceId, companyId: authority.companyId, accountId: authority.accountId, projectRef: clone(authority.executionProjectRef), platformRunRef: clone(authority.platformRunRef), candidateRef: clone(authority.candidateRef), productAuthorityHash: authority.productAuthorityHash },
    refs: { designFactRef: factRef(design), designEvidenceRef: design?.evidence ? { id: design.evidence.id, hash: design.evidence.evidenceHash } : null, providerPlanFactRef: factRef(plan), providerExecutionApprovalFactRef: factRef(approval), providerAttemptRef: attempt ? ref(attempt, "attemptHash") : null, providerCheckpointRef: factRef(checkpoint), visualReviewApprovalFactRef: factRef(visualApproval), visualReviewFactRef: factRef(visualReview), visualReviewCheckpointRef: factRef(visualCheckpoint), humanVisualConfirmationFactRef: factRef(humanVisualConfirmation), lightRevisionExecutionFactRef: factRef(lightPendingExecution), lightRevisionCheckpointFactRef: factRef(lightRevisionCheckpoint), currentRevisionSetHash: facts.currentRevisionSetHash || null, deliveryFactRef: anyRef(delivery), artifactStateHash: artifactState?.artifactStateHash || null, artifactReviewFactRef: artifactState?.reviewDecisionRef || null, selectionFactRef: reviewState?.currentSelectionFactRef || (() => { const selected = latest((reviewState?.selectionFacts || []).filter((item) => item.status === "selected")); return selected ? ref(selected) : null; })() },
    providerPlanOptions: providerOptions,
    preGenerationReview,
    providerExecutionOptions: plan ? { providerPlanFactRef: factRef(plan), planRef: plan.plan ? { id: plan.plan.id, hash: plan.plan.planHash } : null, pageIds: Array.isArray(facts.providerMissingPageIds) ? clone(facts.providerMissingPageIds) : plan.plan?.pages?.map((item) => item.pageId) || [], nextAttempt: facts.nextProviderAttempt || 1, remainingCalls: approval && !facts.providerApprovalExhausted ? Math.max(0, Number(approval.limits?.maxProviderCalls || 0) - (facts.providerAttempts ? 1 : 0)) : 0 } : null,
    promotion: clone(promotion),
    stages: { design: Boolean(design), providerPlan: Boolean(plan), providerExecutionApproval: Boolean(approval), providerExecution: Boolean(attempt), visualReviewApproval: lightRevisionEnabled ? null : Boolean(visualApproval), visualReview: lightRevisionEnabled ? null : Boolean(visualReview), humanVisualConfirmation: lightRevisionEnabled ? Boolean(humanVisualConfirmation) : null, artifactReview: artifactState?.status || "locked", selection: reviewState?.selectionFacts?.some((item) => item.status === "selected") === true },
    blockers: [...new Set(blockers)],
    claims: { providerCalls: 0, networkCalls: 0, retries: 0, publicationPerformed: false, selectionAuthority: reviewState?.selectionFacts?.some((item) => item.status === "selected") === true }
  };
}

export function getUnifiedContentXhsProductionState(store, input, { featureFlags = {} } = {}) {
  let authority;
  try {
    authority = resolveUnifiedContentAuthority(store, { ...input, platform: "xiaohongshu" }, { atomicProductEnabled: featureFlags.unifiedContentAtomicProductV1 === true, codes: { candidateNotFound: "UNIFIED_XHS_AUTHORITY_REQUIRED" } });
  } catch (error) {
    return { schemaVersion: "1.0", contract: CONTRACT, platform: "xiaohongshu", status: "authority_required", nextAllowedAction: "select_authority", authority: null, refs: {}, stages: {}, blockers: [error.code || "UNIFIED_XHS_AUTHORITY_REQUIRED"], claims: { providerCalls: 0, networkCalls: 0, retries: 0, publicationPerformed: false, selectionAuthority: false } };
  }
  const scopedInput = { ...input, ...authority, projectId: authority.projectId, platform: "xiaohongshu", candidateId: authority.candidateRef.id };
  let artifactState = null; let reviewState = null;
  try { artifactState = getUnifiedContentArtifactState(store, scopedInput, { featureFlags }); } catch (error) { artifactState = { status: "locked", blockers: [error.code || "ARTIFACT_STATE_UNAVAILABLE"] }; }
  try { reviewState = listUnifiedContentReviewState(store, scopedInput, { featureFlags }); } catch (error) { reviewState = { selectionFacts: [], blockers: [error.code || "REVIEW_STATE_UNAVAILABLE"] }; }
  return stateFromFacts(refsFor(store, authority), artifactState, reviewState, store, authority, {
    lightRevisionEnabled: featureFlags.unifiedContentXhsLightRevisionV1 === true && featureFlags.unifiedContentXhsHumanVisualConfirmationV1 === true,
    localPackageOnly: featureFlags.localPackageDeliveryV1 === true && featureFlags.platformPublishingV1 !== true
  });
}
