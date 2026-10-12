import { stableHash } from "../image-providers/xhs-integrated-page/canonical.mjs";
import sharp from "sharp";
import { materializeProviderExecutionRequest } from "../image-providers/xhs-integrated-page/execution-plan.mjs";
import { normalizePngCandidate, readPngDimensions, sha256Bytes } from "../image-providers/xhs-integrated-page/png-normalizer.mjs";
import { validateXhsDesignRuntimeEvidence } from "./xhs-design-runtime-adapter.mjs";
import {
  createXhsPageRevisionFact, createXhsProviderAttemptFact, sameXhsArtifactRef,
  validateXhsArtifactFactAppendOnly, validateXhsProviderApproval, validateXhsProviderBudget
} from "./xhs-page-artifact-facts.mjs";
import { compactXhsAssetPaths } from "./xhs-asset-paths.mjs";

const clone = (value) => structuredClone(value);

function fail(code) {
  throw Object.assign(new Error(code), { code });
}

function ref(id, hash) {
  return { id, hash };
}

function assertRef(actual, expected, code) {
  if (!sameXhsArtifactRef(actual, expected)) fail(code);
}

function validateExecutionBindings({ designEvidence, providerPlanFact = null, contentProjectRef, platformRunRef, candidateRef, budget, approval }) {
  validateXhsDesignRuntimeEvidence(designEvidence);
  validateXhsProviderBudget(budget);
  validateXhsProviderApproval(approval);
  if (providerPlanFact) {
    if (providerPlanFact.contract !== "UnifiedXhsProviderPlanFact@1.0" || providerPlanFact.factHash !== stableHash(Object.fromEntries(Object.entries(providerPlanFact).filter(([key]) => key !== "factHash")))) fail("XHS_PAGE_ARTIFACT_PROVIDER_PLAN_FACT_INVALID");
    assertRef(providerPlanFact.contentProjectRef, contentProjectRef, "XHS_PAGE_ARTIFACT_PROJECT_PLAN_FACT_MISMATCH");
    assertRef(providerPlanFact.platformRunRef, platformRunRef, "XHS_PAGE_ARTIFACT_RUN_PLAN_FACT_MISMATCH");
    assertRef(providerPlanFact.candidateRef, candidateRef, "XHS_PAGE_ARTIFACT_CANDIDATE_PLAN_FACT_MISMATCH");
  }
  const plan = providerPlanFact?.plan || designEvidence.outputs?.integratedPageExecutionPlan;
  if (!plan || plan.execution?.status !== "ready_for_isolated_provider_execution") fail("XHS_PAGE_ARTIFACT_PLAN_NOT_READY");
  const expectedEvidenceRef = ref(designEvidence.id, designEvidence.evidenceHash);
  if (providerPlanFact) {
    assertRef(providerPlanFact.designEvidenceRef, expectedEvidenceRef, "XHS_PAGE_ARTIFACT_EVIDENCE_PLAN_FACT_MISMATCH");
    if (providerPlanFact.promptSetRef?.hash !== designEvidence.outputs?.skillInvocation?.promptSetHash
      || plan.skillBinding?.invocationHash !== designEvidence.outputs?.skillInvocation?.invocationHash) fail("XHS_PAGE_ARTIFACT_PROMPT_PLAN_FACT_MISMATCH");
  } else if (designEvidence.hashes?.providerExecutionPlanHash !== plan.planHash) fail("XHS_PAGE_ARTIFACT_PLAN_HASH_MISMATCH");
  const expectedPlanRef = ref(plan.id, plan.planHash);
  const expectedProviderRef = ref(`${plan.provider.id}:${plan.provider.model}`, stableHash(plan.provider));
  const expectedBudgetRef = ref("xhs-provider-budget", budget.budgetHash);
  if (!providerPlanFact) {
    assertRef(designEvidence.bindings.platformRunRef, platformRunRef, "XHS_PAGE_ARTIFACT_RUN_EVIDENCE_MISMATCH");
    assertRef(designEvidence.bindings.candidateRef, candidateRef, "XHS_PAGE_ARTIFACT_CANDIDATE_EVIDENCE_MISMATCH");
  }
  assertRef(approval.contentProjectRef, contentProjectRef, "XHS_PAGE_ARTIFACT_PROJECT_APPROVAL_MISMATCH");
  assertRef(approval.platformRunRef, platformRunRef, "XHS_PAGE_ARTIFACT_RUN_APPROVAL_MISMATCH");
  assertRef(approval.candidateRef, candidateRef, "XHS_PAGE_ARTIFACT_CANDIDATE_APPROVAL_MISMATCH");
  assertRef(approval.designEvidenceRef, expectedEvidenceRef, "XHS_PAGE_ARTIFACT_EVIDENCE_APPROVAL_MISMATCH");
  assertRef(approval.planRef, expectedPlanRef, "XHS_PAGE_ARTIFACT_PLAN_APPROVAL_MISMATCH");
  assertRef(approval.providerRef, expectedProviderRef, "XHS_PAGE_ARTIFACT_PROVIDER_APPROVAL_MISMATCH");
  assertRef(approval.budgetRef, expectedBudgetRef, "XHS_PAGE_ARTIFACT_BUDGET_APPROVAL_MISMATCH");
  if (budget.currency !== plan.cost.currency || budget.maxTotal > plan.cost.approvedMaxTotal) fail("XHS_PAGE_ARTIFACT_BUDGET_PLAN_MISMATCH");
  return { plan, expectedEvidenceRef, expectedPlanRef, expectedProviderRef, expectedBudgetRef, expectedProviderPlanFactRef: providerPlanFact ? ref(providerPlanFact.id, providerPlanFact.factHash) : null };
}

function scopeMatches(fact, refs) {
  return sameXhsArtifactRef(fact.contentProjectRef, refs.contentProjectRef)
    && sameXhsArtifactRef(fact.platformRunRef, refs.platformRunRef)
    && sameXhsArtifactRef(fact.candidateRef, refs.candidateRef)
    && sameXhsArtifactRef(fact.designEvidenceRef, refs.designEvidenceRef)
    && sameXhsArtifactRef(fact.planRef, refs.planRef);
}

function responseError(value) {
  return { code: String(value?.code || "PROVIDER_TRANSPORT_FAILED"), message: String(value?.message || value?.code || "Provider transport failed") };
}

export async function executeApprovedXhsPageArtifacts({
  designEvidence, providerPlanFact = null, approvalFactRef = null, contentProjectRef, platformRunRef, candidateRef, budget, approval,
  transport, retryPolicy = {}, existingAttempts = [], existingRevisions = [],
  targetPageIds = null, idempotencyKey, maxProviderCalls = Number.MAX_SAFE_INTEGER, initialActualCost = null, attemptOffsets = {},
  now = () => new Date().toISOString(), transportContext = { mode: "injected" }
}) {
  if (typeof transport !== "function") fail("XHS_PAGE_ARTIFACT_TRANSPORT_REQUIRED");
  if (typeof idempotencyKey !== "string" || !idempotencyKey.trim()) fail("XHS_PAGE_ARTIFACT_IDEMPOTENCY_KEY_REQUIRED");
  if (!transportContext || typeof transportContext !== "object" || Array.isArray(transportContext) || typeof transportContext.networked !== "boolean") fail("XHS_PAGE_ARTIFACT_TRANSPORT_NETWORKED_REQUIRED");
  if (!Number.isInteger(maxProviderCalls) || maxProviderCalls < 0) fail("XHS_PAGE_ARTIFACT_MAX_PROVIDER_CALLS_INVALID");
  const bound = validateExecutionBindings({ designEvidence, providerPlanFact, contentProjectRef, platformRunRef, candidateRef, budget, approval });
  validateXhsArtifactFactAppendOnly({ attempts: existingAttempts, revisions: existingRevisions });
  const refs = {
    contentProjectRef: clone(contentProjectRef), platformRunRef: clone(platformRunRef), candidateRef: clone(candidateRef),
    designEvidenceRef: bound.expectedEvidenceRef, planRef: bound.expectedPlanRef
  };
  if ([...existingAttempts, ...existingRevisions].some((fact) => !scopeMatches(fact, refs))) fail("XHS_PAGE_ARTIFACT_EXISTING_FACT_SCOPE_MISMATCH");
  const maxAttempts = retryPolicy.maxAttemptsPerPage ?? budget.maxAttemptsPerPage;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > budget.maxAttemptsPerPage) fail("XHS_PAGE_ARTIFACT_RETRY_POLICY_INVALID");
  const retryableCodes = new Set((retryPolicy.retryableCodes || ["PROVIDER_TRANSIENT_FAILURE"]).map(String));
  const stopOnPageFailure = retryPolicy.stopOnPageFailure !== false;
  const attempts = existingAttempts.map(clone);
  const revisions = existingRevisions.map(clone);
  const bytePayloads = [];
  let providerCalls = 0;
  let retries = 0;
  let actualCost = initialActualCost == null ? attempts.reduce((sum, item) => sum + item.cost, 0) : Number(initialActualCost);
  if (!Number.isFinite(actualCost) || actualCost < 0) fail("XHS_PAGE_ARTIFACT_INITIAL_COST_INVALID");
  let stopReason = null;
  const checkpoints = [];
  const approvalRef = ref(`xhs-provider-approval:${approval.approvalHash.slice(0, 20)}`, approval.approvalHash);
  const knownPageIds = new Set(bound.plan.pages.map((page) => page.pageId));
  if (targetPageIds != null && (!Array.isArray(targetPageIds) || new Set(targetPageIds).size !== targetPageIds.length)) fail("XHS_PAGE_ARTIFACT_TARGET_PAGES_INVALID");
  const requestedPageIds = targetPageIds == null ? knownPageIds : new Set(targetPageIds);
  if (requestedPageIds.size === 0 || [...requestedPageIds].some((pageId) => !knownPageIds.has(pageId))) fail("XHS_PAGE_ARTIFACT_TARGET_PAGES_INVALID");
  const executionRequestHash = stableHash({
    idempotencyKey, contentProjectRef, platformRunRef, candidateRef, designEvidenceRef: bound.expectedEvidenceRef,
    planRef: bound.expectedPlanRef, approvalRef, budgetRef: bound.expectedBudgetRef, targetPageIds: [...requestedPageIds].sort(),
    transportNetworked: transportContext.networked, providerPlanFactRef: bound.expectedProviderPlanFactRef, approvalFactRef,
    retryPolicy: { maxAttemptsPerPage: maxAttempts, retryableCodes: [...retryableCodes].sort(), stopOnPageFailure }
  });
  const idempotentAttempts = attempts.filter((item) => item.idempotencyKey === idempotencyKey);
  if (idempotentAttempts.length) {
    if (idempotentAttempts.some((item) => item.executionRequestHash !== executionRequestHash)) fail("XHS_PAGE_ARTIFACT_IDEMPOTENCY_CONFLICT");
    const attemptKeys = new Set(idempotentAttempts.map((item) => `${item.id}:${item.attemptHash}`));
    const idempotentRevisions = revisions.filter((item) => attemptKeys.has(`${item.sourceAttemptRef.id}:${item.sourceAttemptRef.hash}`));
    return {
      schemaVersion: "1.0", contract: "XhsPageArtifactRuntimeResult@1.0", status: idempotentRevisions.length ? "artifact_review_required" : "blocked",
      contentProjectRef: clone(contentProjectRef), platformRunRef: clone(platformRunRef), candidateRef: clone(candidateRef), designEvidenceRef: bound.expectedEvidenceRef, planRef: bound.expectedPlanRef,
      providerPlanFactRef: clone(bound.expectedProviderPlanFactRef), approvalFactRef: clone(approvalFactRef), checkpoints: [],
      attempts: clone(attempts), revisions: clone(revisions), newAttemptRefs: [], newRevisionRefs: [], bytePayloads: [],
      counters: { networkCalls: 0, providerCalls: 0, retries: 0, actualCost, databaseWrites: 0 }, reviewable: idempotentRevisions.length > 0,
      selectable: false, finalBundleAuthority: false, publicationPerformed: false, blockers: ["idempotent_replay"], nextGate: idempotentRevisions.length ? "XhsArtifactEditorialReview" : "NewExecutionIdempotencyKeyRequired", idempotent: true
    };
  }

  for (const page of bound.plan.pages) {
    if (!requestedPageIds.has(page.pageId)) continue;
    if (stopReason) break;
    const pageRef = ref(`${bound.plan.id}:${page.pageId}`, page.pageHash);
    // Attempt IDs are global to a candidate/page, not to a particular plan
    // revision. Include historical attempts from superseded plans so a new
    // budget approval cannot recreate `...:P8:a1` and collide with an older
    // immutable fact.
    const pageAttempts = attempts.filter((item) => item.pageId === page.pageId);
    let nextAttempt = Math.max(Number(attemptOffsets[page.pageId] || 0), ...pageAttempts.map((item) => item.attempt || 0)) + 1;
    const estimatedCallCost = Number(page.estimatedCost || 0);
    let pageSucceeded = false;
    let callsForPage = 0;
    while (!pageSucceeded && callsForPage < maxAttempts) {
      if (providerCalls >= maxProviderCalls) {
        stopReason = "provider_call_limit_reached_before_call";
        break;
      }
      if (actualCost + estimatedCallCost > budget.maxTotal) {
        stopReason = "budget_exhausted_before_call";
        break;
      }
      const request = materializeProviderExecutionRequest({ plan: bound.plan, pageId: page.pageId, expectedPlanHash: bound.plan.planHash, skillInvocation: designEvidence.outputs.skillInvocation });
      const requestHash = stableHash(request);
      let response;
      let thrown = null;
      try {
        response = await transport(clone(request), { pageId: page.pageId, attempt: nextAttempt, planRef: bound.expectedPlanRef, approvalRef: clone(approvalRef), transportContext: clone(transportContext) });
      } catch (error) {
        thrown = error;
      }
      providerCalls += 1;
      callsForPage += 1;
      const recordedAt = new Date(now()).toISOString();
      const common = {
        id: `xhs-provider-attempt:${candidateRef.id}:${designEvidence.evidenceHash.slice(0, 12)}:${page.pageId}:a${nextAttempt}`, ...clone(refs), pageId: page.pageId, pageRef,
        approvalRef, providerRef: bound.expectedProviderRef, budgetRef: bound.expectedBudgetRef,
        attempt: nextAttempt, requestHash, provider: bound.plan.provider.id, model: bound.plan.provider.model,
        transport: { kind: "injected", networked: transportContext.networked, context: clone(transportContext) },
        idempotencyKey, executionRequestHash,
        selectionAuthority: false, finalBundleAuthority: false, publicationPerformed: false, recordedAt
      };
      if (thrown || response?.status !== "succeeded") {
        if (response?.checkpoint) checkpoints.push(clone(response.checkpoint));
        if (response?.paidTaskCreated === true && (response?.costStatus === "unknown" || !Number.isFinite(Number(response?.cost)))) {
          const error = { code: "UNKNOWN_PAID_TASK_COST", message: "Paid provider task cost is unknown; checkpoint reconciliation is required before another call" };
          attempts.push(createXhsProviderAttemptFact({ ...common, status: "failed", taskId: response?.taskId || null, rawAsset: null, normalization: null, cost: 0, error }));
          stopReason = "unknown_paid_task_cost_checkpoint_required";
          break;
        }
        const error = responseError(thrown || response?.error || response);
        const cost = Number(response?.cost || 0);
        actualCost += cost;
        attempts.push(createXhsProviderAttemptFact({ ...common, status: "failed", taskId: response?.taskId || null, rawAsset: null, normalization: null, cost, error }));
        if (!retryableCodes.has(error.code) || callsForPage >= maxAttempts) {
          stopReason = stopOnPageFailure ? `page_failed:${page.pageId}:${error.code}` : null;
          break;
        }
        retries += 1;
        nextAttempt += 1;
        continue;
      }
      const malformedCode = response.provider !== bound.plan.provider.id || response.model !== bound.plan.provider.model || !response.taskId || !Buffer.isBuffer(response.bytes)
        ? "XHS_PAGE_ARTIFACT_PROVIDER_RESPONSE_INVALID"
        : (!Number.isFinite(Number(response.cost || 0)) || Number(response.cost || 0) < 0 ? "XHS_PAGE_ARTIFACT_PROVIDER_COST_INVALID" : null);
      if (malformedCode) {
        const cost = Number.isFinite(Number(response.cost || 0)) && Number(response.cost || 0) >= 0 ? Number(response.cost || 0) : 0;
        actualCost += cost;
        attempts.push(createXhsProviderAttemptFact({ ...common, status: "failed", taskId: response.taskId || null, rawAsset: null, normalization: null, cost, error: { code: malformedCode, message: malformedCode } }));
        if (!retryableCodes.has(malformedCode) || callsForPage >= maxAttempts) {
          stopReason = stopOnPageFailure ? `page_failed:${page.pageId}:${malformedCode}` : null;
          break;
        }
        retries += 1;
        nextAttempt += 1;
        continue;
      }
      const cost = Number(response.cost || 0);
      actualCost += cost;
      let rawDimensions;
      let rawAsset;
      let normalized;
      try {
        // Kie Seedream returns JPEG URLs while the historical artifact
        // contract stores normalized PNGs. Convert at the runtime boundary;
        // never reject a valid provider raster merely because its container
        // is JPEG instead of PNG.
        const providerBytes = Buffer.from(response.bytes);
        const pngBytes = providerBytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          ? providerBytes
          : await sharp(providerBytes, { failOn: "error" }).png().toBuffer();
        rawDimensions = readPngDimensions(pngBytes);
        const compactPaths = compactXhsAssetPaths({ candidateRef, pageId: page.pageId, attempt: nextAttempt, operationKey: executionRequestHash, rawExtension: "bin" });
        rawAsset = { relativePath: compactPaths.raw, sha256: sha256Bytes(providerBytes), bytes: providerBytes.length, dimensions: rawDimensions };
        normalized = normalizePngCandidate({
          id: `xhs-page-normalization:${candidateRef.id}:${page.pageId}:a${nextAttempt}`,
          candidateRef: ref(`${candidateRef.id}:${page.pageId}:a${nextAttempt}`, stableHash({ candidateRef, pageRef, nextAttempt })),
          sourceBuffer: pngBytes, sourceRelativePath: compactPaths.raw,
          outputRelativePath: compactPaths.normalized, mode: page.deliveryQualification.normalizationMode,
          protectedRegions: [], backgroundStrategy: page.deliveryQualification.normalizationMode === "fit_pad" ? "solid_brand_neutral_light" : null, createdAt: recordedAt
        });
      } catch (error) {
        const errorCode = error?.message || "PROVIDER_BYTES_INVALID";
        attempts.push(createXhsProviderAttemptFact({ ...common, status: "failed", taskId: response.taskId, rawAsset: null, normalization: null, cost, error: { code: errorCode, message: errorCode } }));
        if (!retryableCodes.has(errorCode) || callsForPage >= maxAttempts) {
          stopReason = stopOnPageFailure ? `page_failed:${page.pageId}:${errorCode}` : null;
          break;
        }
        retries += 1;
        nextAttempt += 1;
        continue;
      }
      let status = "succeeded";
      let error = null;
      if (actualCost > budget.maxTotal) {
        status = "budget_exceeded";
        error = { code: "PROVIDER_BUDGET_EXCEEDED_AFTER_CALL", message: `${actualCost} > ${budget.maxTotal}` };
      }
      const attempt = createXhsProviderAttemptFact({
        ...common, status, taskId: response.taskId, rawAsset,
        normalization: { status: normalized.record.status, recordHash: normalized.record.recordHash, outputAsset: normalized.record.outputAsset ? clone(normalized.record.outputAsset) : null, blockers: clone(normalized.record.blockers) },
        cost, error
      });
      attempts.push(attempt);
      bytePayloads.push({ attemptRef: ref(attempt.id, attempt.attemptHash), rawBytes: Buffer.from(response.bytes), normalizedBytes: normalized.outputBuffer ? Buffer.from(normalized.outputBuffer) : null });
      if (status === "budget_exceeded") {
        stopReason = "budget_exceeded_after_call";
        break;
      }
      if (normalized.record.status !== "succeeded" || !normalized.outputBuffer) {
        const errorCode = normalized.record.blockers[0]?.code || "NORMALIZATION_BLOCKED";
        if (!retryableCodes.has(errorCode) || callsForPage >= maxAttempts) {
          stopReason = stopOnPageFailure ? `page_failed:${page.pageId}:${errorCode}` : null;
          break;
        }
        retries += 1;
        nextAttempt += 1;
        continue;
      }
      const revision = Math.max(0, ...revisions.filter((item) => item.pageId === page.pageId).map((item) => item.revision)) + 1;
      revisions.push(createXhsPageRevisionFact({
        id: `xhs-page-revision:${candidateRef.id}:${designEvidence.evidenceHash.slice(0, 12)}:${page.pageId}:r${revision}`, ...clone(refs), pageId: page.pageId, pageRef,
        approvalRef, providerRef: bound.expectedProviderRef, budgetRef: bound.expectedBudgetRef,
        idempotencyKey, executionRequestHash,
        revision, sourceAttemptRef: ref(attempt.id, attempt.attemptHash), rawAsset, normalizedAsset: clone(normalized.record.outputAsset), normalizationRef: ref(normalized.record.id, normalized.record.recordHash),
        status: "artifact_review_required", reviewable: true, selectable: false, finalBundleAuthority: false, publicationPerformed: false, createdAt: recordedAt
      }));
      pageSucceeded = true;
    }
    if (!pageSucceeded && !stopReason && stopOnPageFailure) stopReason = `page_failed:${page.pageId}:attempts_exhausted`;
  }
  validateXhsArtifactFactAppendOnly({ attempts, revisions });
  const newAttempts = attempts.slice(existingAttempts.length);
  const newRevisions = revisions.slice(existingRevisions.length);
  return {
    schemaVersion: "1.0", contract: "XhsPageArtifactRuntimeResult@1.0", status: stopReason ? "blocked" : "artifact_review_required",
    contentProjectRef: clone(contentProjectRef), platformRunRef: clone(platformRunRef), candidateRef: clone(candidateRef), designEvidenceRef: bound.expectedEvidenceRef, planRef: bound.expectedPlanRef,
    providerPlanFactRef: clone(bound.expectedProviderPlanFactRef), approvalFactRef: clone(approvalFactRef), checkpoints,
    attempts: clone(attempts), revisions: clone(revisions), newAttemptRefs: newAttempts.map((item) => ref(item.id, item.attemptHash)), newRevisionRefs: newRevisions.map((item) => ref(item.id, item.revisionHash)),
    bytePayloads, counters: { networkCalls: transportContext.networked ? providerCalls : 0, providerCalls, retries, actualCost, databaseWrites: 0 },
    reviewable: newRevisions.length > 0 || revisions.length > 0, selectable: false, finalBundleAuthority: false, publicationPerformed: false,
    blockers: stopReason ? [stopReason] : ["artifact_review_required"], nextGate: "XhsArtifactEditorialReview", idempotent: false
  };
}
