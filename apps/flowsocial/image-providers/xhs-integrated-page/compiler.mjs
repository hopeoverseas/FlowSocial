import { stableHash } from "./canonical.mjs";
import {
  CONTRACTS,
  assertExactKeys,
  validateCompiledPageGenerationRequest,
  validatePromptReviewDecision,
  validateProviderCapabilitySnapshot,
  validateProviderCompilationTrace,
  validateVisualAssetRegistrySnapshot
} from "./contracts.mjs";
import { validateDirectionCandidates } from "./review-state-machine.mjs";

const blocker = (code, scope, detail) => ({ code, scope, detail, fallback: "deterministic_layout" });
const truthText = (truth) => [truth.headline, ...truth.supportingText, ...truth.labels, truth.cta].filter(Boolean);
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function expectedPromptBlocks(pageSpec, promptSet, libraries) {
  const archetype = libraries.archetypes.entries.find((item) => item.id === pageSpec.pageArchetypeId);
  const style = libraries.styles.entries.find((item) => item.id === (pageSpec.stylePackId || promptSet.visualStyleSelection.stylePackId));
  const patterns = pageSpec.promptPatternIds.map((id) => libraries.patterns.entries.find((item) => item.id === id));
  if (!archetype || !style || patterns.some((item) => !item)) throw new Error("COMPILER_REGISTRY_DEFINITION_MISSING");
  return {
    verbatimText: truthText(pageSpec.contentTruth),
    composition: [archetype.layoutRules.join("；"), ...patterns.map((item) => item.instruction)],
    style: [style.tokens.medium, style.tokens.composition],
    negativeConstraints: [...pageSpec.contentTruth.forbiddenClaims, ...style.tokens.avoid]
  };
}

function add(blockers, code, scope, detail) {
  addBlocker(blockers, blocker(code, scope, detail));
}

function addBlocker(blockers, item) {
  if (!blockers.some((existing) => existing.code === item.code && existing.scope === item.scope && existing.detail === item.detail)) blockers.push(structuredClone(item));
}

export function compilePageGenerationRequest({ promptSet, pageId, reviewDecision, capabilitySnapshot, registrySnapshot, libraries, directionCandidates, options }) {
  validatePromptReviewDecision(reviewDecision);
  validateProviderCapabilitySnapshot(capabilitySnapshot);
  validateVisualAssetRegistrySnapshot(registrySnapshot);
  assertExactKeys(options, ["canvas", "candidateCount", "requestedFeatures"], "compilerOptions");
  assertExactKeys(options.canvas, ["width", "height"], "compilerCanvas");
  assertExactKeys(options.requestedFeatures, ["mask", "preserveRegions", "seed"], "compilerRequestedFeatures");
  const pageSpec = promptSet.pagePromptSpecs.find((item) => item.pageId === pageId);
  if (!pageSpec) throw new Error(`PAGE_PROMPT_SPEC_NOT_FOUND:${pageId}`);
  const blockers = [];
  const expectedBlocks = expectedPromptBlocks(pageSpec, promptSet, libraries);
  const directionValidation = validateDirectionCandidates(directionCandidates);
  const reviewedDirection = reviewDecision.visualDirectionSelection;
  const selectedDirection = directionCandidates.find((item) => item.id === reviewedDirection.selectedDirectionRef?.id);
  const selectedDirectionRef = selectedDirection ? { id: selectedDirection.id, hash: stableHash(selectedDirection) } : null;

  reviewDecision.blockers.forEach((item) => addBlocker(blockers, item));
  directionValidation.blockers.forEach((item) => addBlocker(blockers, item));

  if (promptSet.status !== "draft" || promptSet.blockers.length) add(blockers, "INPUT_PROMPT_SET_BLOCKED", pageId, "输入 Prompt Set 未处于无 blocker 的 draft");
  if (reviewDecision.promptSetRef.hash !== stableHash(promptSet)) add(blockers, "PROMPT_REVIEW_INPUT_MISMATCH", pageId, "审阅对象与冻结 Prompt Set 不一致");
  if (reviewDecision.overallStatus !== "awaiting_cost_confirmation" || reviewDecision.blockers.length > 0) add(blockers, "REVIEW_DECISION_NOT_COMPILABLE", reviewDecision.id, `overallStatus=${reviewDecision.overallStatus}`);
  if (reviewDecision.visualDirectionSelection.status !== "selected") add(blockers, "VISUAL_DIRECTION_NOT_SELECTED", pageId, "视觉方向尚未选择");
  if (reviewDecision.promptReview.status !== "approved") add(blockers, "PROMPT_REVIEW_NOT_APPROVED", pageId, "Prompt 尚未批准");
  if (reviewDecision.costConfirmation.status !== "pending") add(blockers, "COST_CONFIRMATION_INVALID", pageId, "本任务费用状态必须保持 pending");
  if (directionValidation.candidateSetHash !== reviewedDirection.candidateSetHash) add(blockers, "DIRECTION_CANDIDATE_SET_MISMATCH", reviewDecision.id, "传入候选集合与审阅冻结集合不一致");
  if (directionValidation.structuralEvidenceHash !== reviewedDirection.structuralEvidenceHash) add(blockers, "DIRECTION_STRUCTURAL_EVIDENCE_MISMATCH", reviewDecision.id, "传入候选结构证据与审阅版本不一致");
  if (!selectedDirectionRef || selectedDirectionRef.hash !== reviewedDirection.selectedDirectionRef?.hash) add(blockers, "SELECTED_DIRECTION_HASH_MISMATCH", reviewDecision.id, "选中候选内容或引用与审阅版本不一致");
  if (!selectedDirection || selectedDirection.stylePackId !== promptSet.visualStyleSelection.stylePackId) add(blockers, "DIRECTION_PROMPT_MISMATCH", pageId, "所选方向与冻结 Style Pack 不一致");

  if (!same(pageSpec.promptBlocks.verbatimText, expectedBlocks.verbatimText) || pageSpec.expectedTextHash !== stableHash(expectedBlocks.verbatimText)) {
    add(blockers, "FACT_TEXT_MISMATCH", pageId, "Prompt 文字或 expectedTextHash 改写冻结真值");
  }
  if (!same(pageSpec.promptBlocks.composition, expectedBlocks.composition) || !same(pageSpec.promptBlocks.style, expectedBlocks.style) || !same(pageSpec.promptBlocks.negativeConstraints, expectedBlocks.negativeConstraints)) {
    add(blockers, "PROMPT_CONTENT_INJECTION", pageId, "Prompt 包含 Registry 定义之外的内容");
  }

  const capabilities = capabilitySnapshot.capabilities;
  if (capabilities.integratedChineseTypography !== true) add(blockers, "MISSING_CAPABILITY", pageId, "缺少 integratedChineseTypography");
  if (pageSpec.referenceAssetIds.length && capabilities.referenceImages !== true) add(blockers, "MISSING_CAPABILITY", pageId, "缺少 referenceImages");
  const dimensionsSupported = capabilities.exactDimensions === true && capabilities.supportedDimensions.some((item) => item.width === options.canvas.width && item.height === options.canvas.height);
  if (!dimensionsSupported) add(blockers, "UNSUPPORTED_DIMENSIONS", pageId, `${options.canvas.width}x${options.canvas.height} 不受支持`);
  if (!Number.isInteger(options.candidateCount) || options.candidateCount < 1 || options.candidateCount > 3 || options.candidateCount > capabilities.maxCandidateCount) {
    add(blockers, "CANDIDATE_COUNT_OUT_OF_RANGE", pageId, `candidateCount=${options.candidateCount}`);
  }
  if (options.requestedFeatures.mask !== null || options.requestedFeatures.preserveRegions.length > 0) {
    add(blockers, "MASK_OR_PRESERVE_REGION_OUT_OF_SCOPE", pageId, "Mask 与锁区不在本任务范围内");
  }
  if (options.requestedFeatures.seed !== null && capabilities.seedControl !== true) add(blockers, "MISSING_CAPABILITY", pageId, "缺少 seedControl");

  const referenceAssets = [];
  for (const assetId of pageSpec.referenceAssetIds) {
    const entry = registrySnapshot.entries.find((item) => item.id === assetId && item.assetType === "reference_asset");
    if (!entry || entry.authorization?.status !== "authorized_for_offline_compilation" || entry.license.allowsOfflineCompilation !== true || entry.license.allowsGenerationReference !== true) {
      add(blockers, "UNAUTHORIZED_REFERENCE_ASSET", pageId, `资产 ${assetId} 未授权或许可证不允许引用`);
    } else referenceAssets.push({ assetId, registryEntryHash: entry.entryHash });
  }

  const inputSeed = {
    promptSetHash: stableHash(promptSet),
    pageSpecHash: stableHash(pageSpec),
    reviewDecisionHash: reviewDecision.decisionHash,
    capabilitySnapshotHash: capabilitySnapshot.snapshotHash,
    registrySnapshotHash: registrySnapshot.snapshotHash,
    directionCandidateSetHash: directionValidation.candidateSetHash,
    directionStructuralEvidenceHash: directionValidation.structuralEvidenceHash,
    options,
    blockers
  };
  const requestBase = {
    schemaVersion: "1.0",
    contract: CONTRACTS.compiledPageGenerationRequest,
    id: `compiled-page:${pageId}:${stableHash(inputSeed).slice(0, 16)}`,
    promptSetRef: { id: promptSet.id, hash: inputSeed.promptSetHash },
    pagePromptSpecRef: { id: pageSpec.id, hash: inputSeed.pageSpecHash },
    reviewDecisionRef: { id: reviewDecision.id, hash: reviewDecision.decisionHash },
    capabilitySnapshotRef: { id: capabilitySnapshot.id, hash: capabilitySnapshot.snapshotHash },
    registrySnapshotRef: { id: registrySnapshot.id, hash: registrySnapshot.snapshotHash },
    canvas: { ...options.canvas },
    candidateCount: options.candidateCount,
    prompt: structuredClone(pageSpec.promptBlocks),
    referenceAssets,
    requestedFeatures: structuredClone(options.requestedFeatures),
    expectedTextHash: pageSpec.expectedTextHash,
    execution: {
      status: blockers.length ? "blocked" : "awaiting_cost_confirmation",
      provider: null,
      retries: 0,
      networkCalls: 0,
      providerCalls: 0,
      cost: 0,
      databaseWrites: 0
    },
    blockers
  };
  const request = { ...requestBase, compiledHash: stableHash(requestBase) };
  validateCompiledPageGenerationRequest(request);

  const traceBase = {
    schemaVersion: "1.0",
    contract: CONTRACTS.providerCompilationTrace,
    id: `trace:${request.id}`,
    compiledRequestRef: { id: request.id, hash: request.compiledHash },
    inputContracts: [
      { contract: "XhsIntegratedPagePromptSet@1.0", id: promptSet.id, schemaVersion: promptSet.schemaVersion, hash: inputSeed.promptSetHash },
      { contract: "VisualStyleSelection@1.0", id: promptSet.visualStyleSelection.id, schemaVersion: promptSet.visualStyleSelection.schemaVersion, hash: stableHash(promptSet.visualStyleSelection) },
      { contract: CONTRACTS.promptReviewDecision, id: reviewDecision.id, schemaVersion: reviewDecision.schemaVersion, hash: reviewDecision.decisionHash }
    ],
    registrySnapshotRef: registrySnapshot.id,
    registrySnapshotHash: registrySnapshot.snapshotHash,
    capabilitySnapshotRef: capabilitySnapshot.id,
    capabilitySnapshotHash: capabilitySnapshot.snapshotHash,
    visualDirectionVerification: {
      candidateSetHash: directionValidation.candidateSetHash,
      reviewedCandidateSetHash: reviewedDirection.candidateSetHash,
      structuralEvidenceHash: directionValidation.structuralEvidenceHash,
      reviewedStructuralEvidenceHash: reviewedDirection.structuralEvidenceHash,
      selectedDirectionRef,
      reviewedSelectedDirectionRef: reviewedDirection.selectedDirectionRef
    },
    decisions: [
      { field: "prompt", sourceRef: pageSpec.id, action: "verbatim_projection", valueHash: stableHash(request.prompt) },
      { field: "canvas", sourceRef: capabilitySnapshot.id, action: "capability_check", valueHash: stableHash(request.canvas) },
      { field: "candidateCount", sourceRef: capabilitySnapshot.id, action: "bounded_projection", valueHash: stableHash(request.candidateCount) },
      { field: "referenceAssets", sourceRef: registrySnapshot.id, action: "authorization_check", valueHash: stableHash(request.referenceAssets) },
      { field: "visualDirection.candidateSet", sourceRef: reviewDecision.id, action: "frozen_set_verification", valueHash: directionValidation.candidateSetHash },
      { field: "visualDirection.structuralEvidence", sourceRef: reviewDecision.id, action: "structural_verification", valueHash: directionValidation.structuralEvidenceHash },
      { field: "visualDirection.selectedCandidate", sourceRef: selectedDirection?.id || reviewDecision.id, action: "selected_hash_verification", valueHash: stableHash(selectedDirectionRef) },
      { field: "visualDirection.source", sourceRef: selectedDirection?.id || reviewDecision.id, action: "source_verification", valueHash: stableHash(selectedDirection?.source ?? null) },
      { field: "visualDirection.license", sourceRef: selectedDirection?.id || reviewDecision.id, action: "license_verification", valueHash: stableHash(selectedDirection?.license ?? null) },
      { field: "visualDirection.risks", sourceRef: selectedDirection?.id || reviewDecision.id, action: "risk_verification", valueHash: stableHash(selectedDirection?.risks ?? null) },
      { field: "visualDirection.capabilityStatus", sourceRef: selectedDirection?.id || reviewDecision.id, action: "capability_status_verification", valueHash: stableHash(selectedDirection?.capabilityStatus ?? null) },
      { field: "provider", sourceRef: "offline-boundary", action: "left_unbound", valueHash: stableHash(null) },
      { field: "costConfirmation", sourceRef: reviewDecision.id, action: "kept_pending", valueHash: stableHash("pending") }
    ],
    blockers: structuredClone(blockers),
    compiledHash: request.compiledHash,
    counters: { networkCalls: 0, providerCalls: 0, retries: 0, cost: 0, databaseWrites: 0 }
  };
  const trace = { ...traceBase, traceHash: stableHash(traceBase) };
  validateProviderCompilationTrace(trace, request);
  return { request, trace };
}
