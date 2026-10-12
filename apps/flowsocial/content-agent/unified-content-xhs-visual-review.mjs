import { createHash } from "node:crypto";
import { stableHash } from "../image-providers/xhs-integrated-page/canonical.mjs";
import { readPngDimensions } from "../image-providers/xhs-integrated-page/png-normalizer.mjs";
import { loadSkillDefinition } from "../skill-runtime.mjs";
import { validateXhsPageRevisionFact } from "./xhs-page-artifact-facts.mjs";
import { resolveUnifiedContentXhsProviderPlanFacts } from "./unified-content-xhs-provider-plan-store.mjs";
import { resolveUnifiedContentAuthority } from "./unified-content-authority-resolver.mjs";

const HASH = /^[a-f0-9]{64}$/;
const clone = (value) => value == null ? value : structuredClone(value);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function fail(code, message = code, statusCode = 409, details = null) { throw Object.assign(new Error(message), { code, statusCode, details }); }
function exact(value, keys, code) {
  if (!value || typeof value !== "object" || Array.isArray(value) || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort())) fail(code, code, 400, { allowedFields: [...keys].sort() });
  return value;
}
function text(value, code) { if (typeof value !== "string" || !value.trim()) fail(code, code, 400); return value.trim(); }
function ref(value, code) { exact(value, ["id", "hash"], code); if (!HASH.test(value.hash || "")) fail(code, code, 400); return clone(value); }
function sameRef(a, b) { return Boolean(a && b && a.id === b.id && a.hash === b.hash); }
function assertRef(a, b, code) { if (!sameRef(a, b)) fail(code, code, 409, { expected: b, actual: a || null }); }
function factRef(fact) { return { id: fact.id, hash: fact.factHash || fact.revisionHash }; }
function hashed(base) { return { ...base, factHash: stableHash(base) }; }
function validateFact(fact, contract, code) { if (fact?.contract !== contract || !HASH.test(fact.factHash || "")) fail(code); const base = clone(fact); delete base.factHash; if (stableHash(base) !== fact.factHash) fail(code); return fact; }

function context(store, input, featureFlags) {
  const candidateRef = ref(input.candidateRef, "UNIFIED_XHS_VISUAL_REVIEW_CANDIDATE_REF_INVALID");
  const resolved = resolveUnifiedContentAuthority(store, { ...input, platform: "xiaohongshu", candidateRef }, {
    atomicProductEnabled: featureFlags.unifiedContentAtomicProductV1 === true,
    codes: {
      workspaceRequired: "UNIFIED_XHS_VISUAL_REVIEW_WORKSPACE_REQUIRED", companyRequired: "UNIFIED_XHS_VISUAL_REVIEW_COMPANY_REQUIRED",
      accountRequired: "UNIFIED_XHS_VISUAL_REVIEW_ACCOUNT_REQUIRED", projectRequired: "UNIFIED_XHS_VISUAL_REVIEW_PROJECT_REQUIRED",
      companyNotFound: "UNIFIED_XHS_VISUAL_REVIEW_OWNERSHIP_MISMATCH", workspaceMismatch: "UNIFIED_XHS_VISUAL_REVIEW_OWNERSHIP_MISMATCH",
      accountOwnershipMismatch: "UNIFIED_XHS_VISUAL_REVIEW_OWNERSHIP_MISMATCH", accountWorkspaceMismatch: "UNIFIED_XHS_VISUAL_REVIEW_OWNERSHIP_MISMATCH",
      projectNotFound: "UNIFIED_XHS_VISUAL_REVIEW_PROJECT_SNAPSHOT_MISMATCH", projectOwnershipMismatch: "UNIFIED_XHS_VISUAL_REVIEW_PROJECT_SNAPSHOT_MISMATCH",
      projectAccountMismatch: "UNIFIED_XHS_VISUAL_REVIEW_RUN_OWNERSHIP_MISMATCH", snapshotHashMismatch: "UNIFIED_XHS_VISUAL_REVIEW_PROJECT_SNAPSHOT_MISMATCH",
      candidateMismatch: "UNIFIED_XHS_VISUAL_REVIEW_CANDIDATE_REF_MISMATCH"
    }
  });
  assertRef(ref(input.platformRunRef, "UNIFIED_XHS_VISUAL_REVIEW_RUN_REF_INVALID"), resolved.platformRunRef, "UNIFIED_XHS_VISUAL_REVIEW_RUN_REF_MISMATCH");
  assertRef(candidateRef, resolved.candidateRef, "UNIFIED_XHS_VISUAL_REVIEW_CANDIDATE_REF_MISMATCH");
  return resolved.authorityKind === "legacy_snapshot_v1"
    ? { ...resolved, snapshot: resolved.payload.snapshot, platform: resolved.payload.platformSnapshot, projectRef: resolved.executionProjectRef, runRef: resolved.platformRunRef }
    : { ...resolved, projectRef: resolved.executionProjectRef, runRef: resolved.platformRunRef };
}

function materializedBinding(ctx) {
  return ctx.authorityKind === "atomic_v2" ? { materializedContentProjectRef: clone(ctx.materializedProjectRef) } : {};
}
function sameMaterialized(fact, ctx) { return ctx.authorityKind !== "atomic_v2" || sameRef(fact.materializedContentProjectRef, ctx.materializedProjectRef); }

function collections(store) {
  store.unifiedContentXhsVisualReviewApprovalFacts ||= [];
  store.unifiedContentXhsVisualReviewApprovalIdempotencyFacts ||= [];
  store.unifiedContentXhsVisualReviewInvocationFacts ||= [];
  store.unifiedContentXhsVisualReviewFacts ||= [];
  store.unifiedContentXhsVisualReviewCheckpointFacts ||= [];
  store.unifiedContentXhsVisualReviewExecutionIdempotencyFacts ||= [];
  return { approvals: store.unifiedContentXhsVisualReviewApprovalFacts, approvalIdem: store.unifiedContentXhsVisualReviewApprovalIdempotencyFacts, invocations: store.unifiedContentXhsVisualReviewInvocationFacts, reviews: store.unifiedContentXhsVisualReviewFacts, checkpoints: store.unifiedContentXhsVisualReviewCheckpointFacts, executionIdem: store.unifiedContentXhsVisualReviewExecutionIdempotencyFacts };
}

function authority(store, ctx, input) {
  const providerPlanFactRef = ref(input.providerPlanFactRef, "UNIFIED_XHS_VISUAL_REVIEW_PLAN_FACT_REF_INVALID");
  const resolved = resolveUnifiedContentXhsProviderPlanFacts(store, providerPlanFactRef);
  const planFact = resolved.plan;
  assertRef(planFact.contentProjectRef, ctx.projectRef, "UNIFIED_XHS_VISUAL_REVIEW_PLAN_PROJECT_MISMATCH");
  if (ctx.authorityKind === "atomic_v2") assertRef(planFact.materializedContentProjectRef, ctx.materializedProjectRef, "UNIFIED_XHS_VISUAL_REVIEW_PLAN_MATERIALIZED_PROJECT_MISMATCH");
  assertRef(planFact.platformRunRef, ctx.runRef, "UNIFIED_XHS_VISUAL_REVIEW_PLAN_RUN_MISMATCH");
  assertRef(planFact.candidateRef, ctx.candidateRef, "UNIFIED_XHS_VISUAL_REVIEW_PLAN_CANDIDATE_MISMATCH");
  assertRef(ref(input.designEvidenceRef, "UNIFIED_XHS_VISUAL_REVIEW_DESIGN_REF_INVALID"), planFact.designEvidenceRef, "UNIFIED_XHS_VISUAL_REVIEW_DESIGN_REF_MISMATCH");
  assertRef(ref(input.planRef, "UNIFIED_XHS_VISUAL_REVIEW_PLAN_REF_INVALID"), { id: planFact.plan.id, hash: planFact.plan.planHash }, "UNIFIED_XHS_VISUAL_REVIEW_PLAN_REF_MISMATCH");
  const currentPlan = (store.unifiedContentXhsProviderPlanFacts || []).filter((fact) => sameRef(fact.contentProjectRef, ctx.projectRef) && sameMaterialized(fact, ctx) && sameRef(fact.platformRunRef, ctx.runRef) && sameRef(fact.candidateRef, ctx.candidateRef)).at(-1);
  if (!currentPlan || !sameRef(factRef(currentPlan), providerPlanFactRef)) fail("UNIFIED_XHS_VISUAL_REVIEW_PLAN_STALE");
  const attempts = (store.unifiedContentXhsProviderAttemptFacts || []).filter((fact) => sameRef(fact.contentProjectRef, ctx.projectRef) && sameMaterialized(fact, ctx) && sameRef(fact.platformRunRef, ctx.runRef) && sameRef(fact.candidateRef, ctx.candidateRef) && sameRef(fact.designEvidenceRef, planFact.designEvidenceRef) && sameRef(fact.planRef, input.planRef));
  const revisions = (store.unifiedContentXhsPageRevisionFacts || []).filter((fact) => sameRef(fact.contentProjectRef, ctx.projectRef) && sameMaterialized(fact, ctx) && sameRef(fact.platformRunRef, ctx.runRef) && sameRef(fact.candidateRef, ctx.candidateRef) && sameRef(fact.designEvidenceRef, planFact.designEvidenceRef) && sameRef(fact.planRef, input.planRef)).map((fact) => (validateXhsPageRevisionFact(fact), fact));
  const latest = new Map(); for (const revision of revisions) latest.set(revision.pageId, revision);
  const expected = planFact.plan.pages.map((page) => page.pageId);
  if (latest.size !== expected.length || expected.some((pageId) => !latest.has(pageId)) || [...latest.keys()].some((pageId) => !expected.includes(pageId))) fail("UNIFIED_XHS_VISUAL_REVIEW_PAGE_SET_INCOMPLETE", "Every current plan page requires one current revision", 409, { expected, actual: [...latest.keys()] });
  const orderedRevisions = expected.map((pageId) => latest.get(pageId));
  const redo = (store.unifiedContentArtifactReviewActions || []).find((fact) => fact.action === "request_page_redo" && orderedRevisions.some((revision) => sameRef(fact.payload?.pageRevisionRef, factRef(revision))));
  if (redo) fail("UNIFIED_XHS_VISUAL_REVIEW_REDO_PENDING");
  const providerCheckpoint = (store.unifiedContentXhsProviderExecutionCheckpointFacts || []).find((fact) => fact.requiresReconciliation === true && sameRef(fact.contentProjectRef, ctx.projectRef) && sameMaterialized(fact, ctx) && sameRef(fact.platformRunRef, ctx.runRef) && sameRef(fact.candidateRef, ctx.candidateRef) && sameRef(fact.providerPlanFactRef, providerPlanFactRef));
  if (providerCheckpoint) fail("UNIFIED_XHS_VISUAL_REVIEW_PROVIDER_CHECKPOINT_UNRECONCILED");
  return { planFact, orderedRevisions, attempts, revisionSetHash: stableHash(orderedRevisions.map(factRef)) };
}

function skillBundle() {
  const definition = loadSkillDefinition("review-xhs-visuals");
  return { name: definition.name, version: definition.version, manifestVersion: definition.manifestVersion, bundleHash: definition.bundleHash, referenceBundle: definition.referenceBundle.map((item) => ({ path: item.path, sha256: sha256(item.content) })), instructions: definition.instructions, contractText: definition.contract, fullReferenceBundle: definition.referenceBundle.map(clone) };
}

function providerAuthority(value) {
  if (!value || value.capability !== "multimodal_vision" || !text(value.provider, "UNIFIED_XHS_VISUAL_REVIEW_PROVIDER_AUTHORITY_INVALID") || !text(value.model, "UNIFIED_XHS_VISUAL_REVIEW_MODEL_AUTHORITY_INVALID") || !Number.isFinite(value.estimatedCost) || value.estimatedCost < 0 || !text(value.currency, "UNIFIED_XHS_VISUAL_REVIEW_CURRENCY_AUTHORITY_INVALID")) fail("UNIFIED_XHS_VISUAL_REVIEW_PROVIDER_AUTHORITY_INVALID", "Server-controlled multimodal authority required", 503);
  return { capability: "multimodal_vision", provider: value.provider, model: value.model, estimatedCost: value.estimatedCost, currency: value.currency };
}

export function appendUnifiedContentXhsVisualReviewApproval(store, input, { featureFlags = {}, provider = null, now = new Date().toISOString() } = {}) {
  exact(input, ["workspaceId", "companyId", "accountId", "projectId", "productSnapshotHash", "platformRunRef", "candidateRef", "designEvidenceRef", "providerPlanFactRef", "planRef", "maxCredits", "approvedBy", "approvedAt", "idempotencyKey"], "UNIFIED_XHS_VISUAL_REVIEW_APPROVAL_CALLER_AUTHORITY_FORBIDDEN");
  if (featureFlags.unifiedContentXhsVisualReviewApprovalV1 !== true) fail("UNIFIED_XHS_VISUAL_REVIEW_APPROVAL_DISABLED", "Visual review approval disabled", 404);
  const ctx = context(store, input, featureFlags); const bound = authority(store, ctx, input); const configured = providerAuthority(provider); const skill = skillBundle();
  if (!Number.isFinite(input.maxCredits) || input.maxCredits <= 0 || configured.estimatedCost > input.maxCredits) fail("UNIFIED_XHS_VISUAL_REVIEW_BUDGET_INVALID", "Approved credits do not cover one review call", 400);
  const approvedBy = text(input.approvedBy, "UNIFIED_XHS_VISUAL_REVIEW_APPROVER_REQUIRED"); const approvedAt = new Date(text(input.approvedAt, "UNIFIED_XHS_VISUAL_REVIEW_APPROVED_AT_REQUIRED")).toISOString();
  if (approvedAt !== input.approvedAt) fail("UNIFIED_XHS_VISUAL_REVIEW_APPROVED_AT_INVALID", "approvedAt must be canonical UTC", 400);
  const idempotencyKey = text(input.idempotencyKey, "UNIFIED_XHS_VISUAL_REVIEW_APPROVAL_IDEMPOTENCY_REQUIRED");
  const request = { workspaceId: ctx.workspaceId, companyId: ctx.companyId, accountId: ctx.accountId, contentProjectRef: ctx.projectRef, ...materializedBinding(ctx), platformRunRef: ctx.runRef, candidateRef: ctx.candidateRef, designEvidenceRef: bound.planFact.designEvidenceRef, providerPlanFactRef: factRef(bound.planFact), planRef: input.planRef, pageRevisionRefs: bound.orderedRevisions.map(factRef), revisionSetHash: bound.revisionSetHash, skill: { name: skill.name, version: skill.version, bundleHash: skill.bundleHash, referenceBundle: skill.referenceBundle }, provider: configured, limits: { maxProviderCalls: 1, maxAttempts: 1, automaticRetries: 0, maxCredits: input.maxCredits, currency: configured.currency }, approvedBy, approvedAt };
  const requestHash = stableHash(request); const facts = collections(store); const prior = facts.approvalIdem.find((fact) => fact.idempotencyKey === idempotencyKey);
  if (prior) { validateFact(prior, "UnifiedXhsVisualReviewApprovalIdempotencyFact@1.0", "UNIFIED_XHS_VISUAL_REVIEW_APPROVAL_IDEMPOTENCY_INVALID"); if (prior.requestHash !== requestHash) fail("UNIFIED_XHS_VISUAL_REVIEW_APPROVAL_IDEMPOTENCY_CONFLICT"); const approvalFact = facts.approvals.find((fact) => sameRef(factRef(fact), prior.approvalFactRef)); return { created: false, approvalFact: clone(approvalFact), claims: { providerCalls: 0, networkCalls: 0 } }; }
  const base = { schemaVersion: "1.0", contract: "UnifiedXhsVisualReviewApprovalFact@1.0", id: `xhs-visual-review-approval:${requestHash.slice(0, 24)}`, ...request, idempotencyKey, requestHash, status: "approved", recordedAt: new Date(now).toISOString() };
  const approvalFact = hashed(base); const idem = hashed({ schemaVersion: "1.0", contract: "UnifiedXhsVisualReviewApprovalIdempotencyFact@1.0", id: `xhs-visual-review-approval-idempotency:${stableHash({ idempotencyKey, requestHash }).slice(0, 24)}`, idempotencyKey, requestHash, approvalFactRef: factRef(approvalFact), recordedAt: base.recordedAt });
  facts.approvals.push(approvalFact); facts.approvalIdem.push(idem); return { created: true, approvalFact: clone(approvalFact), claims: { providerCalls: 0, networkCalls: 0 } };
}

function reviewInput(store, ctx, bound) {
  const designFact = (store.unifiedContentXhsDesignFacts || []).find((fact) => sameRef(factRef(fact), bound.planFact.designFactRef));
  const designDna = designFact?.evidence?.outputs?.skillInvocation?.promptSet?.visualStyleSelection;
  if (!designDna || typeof designDna !== "object" || !Object.keys(designDna).length) fail("UNIFIED_XHS_VISUAL_REVIEW_DESIGN_DNA_REQUIRED", "Authoritative design projection is required", 409);
  if (ctx.authorityKind === "atomic_v2") {
    const componentFacts = ctx.payload.componentFacts;
    const packageRef = { id: ctx.payload.assemblyOutput.id, hash: ctx.payload.assemblyOutput.packageHash };
    return {
      schemaVersion: "1.0", contract: "UnifiedXhsVisualReviewInput@1.0", contentProjectRef: ctx.projectRef,
      materializedContentProjectRef: clone(ctx.materializedProjectRef), platformRunRef: ctx.runRef, candidateRef: ctx.candidateRef,
      designEvidenceRef: bound.planFact.designEvidenceRef, providerPlanFactRef: factRef(bound.planFact), planRef: { id: bound.planFact.plan.id, hash: bound.planFact.plan.planHash },
      revisionSetHash: bound.revisionSetHash, pageRevisionRefs: bound.orderedRevisions.map(factRef),
      sourceRefs: {
        writerOutputFactRef: factRef(componentFacts.postCopy), writerOutputHash: ctx.payload.components.postCopy.componentHash,
        contentMasterOutputFactRef: { id: ctx.payload.commitRef.id, hash: ctx.payload.commitRef.hash }, contentMasterRef: clone(ctx.payload.contentProject.sharedContentMasterRef),
        intentProfileRef: { id: ctx.payload.candidate.id, hash: ctx.payload.candidate.candidateHash }, designDnaRef: { id: `${designFact.id}:design-projection`, hash: stableHash(designDna) },
        materializedPackageRef: packageRef
      },
      xhs_post_package: { package: clone(ctx.payload.assemblyOutput), components: clone(ctx.payload.components) },
      content_master: { authorityRef: clone(ctx.payload.contentProject.sharedContentMasterRef), materializedInReviewInput: false },
      content_intent_profile: { authority: "atomic_candidate_v3", candidate: clone(ctx.payload.candidate) },
      design_dna: clone(designDna), current_version: bound.revisionSetHash
    };
  }
  const writer = (ctx.snapshot.skillOutputFacts || []).find((fact) => fact.capability === "write-xhs-content");
  const masterFact = (ctx.snapshot.skillOutputFacts || []).find((fact) => fact.capability === "build-content-master");
  const master = ctx.snapshot.orchestrationSnapshot?.sharedContentMaster;
  const orchestrationRun = ctx.snapshot.orchestrationSnapshot?.platformRuns?.find((item) => item.platform === "xiaohongshu" && item.accountId === ctx.accountId);
  const intent = ctx.platform.platformBrief?.contentIntentProfile || ctx.platform.platformBrief?.intentProfile
    || ctx.snapshot.orchestrationSnapshot?.platformBriefs?.xiaohongshu?.contentIntentProfile
    || orchestrationRun?.platformBrief?.contentIntentProfile || orchestrationRun?.platformBrief?.brief
    || ctx.snapshot.orchestrationInput?.project?.platformInputs?.xiaohongshu || ctx.snapshot.projectInput?.platformInputs?.xiaohongshu;
  if (!writer?.runtimeOutput || !HASH.test(writer.outputHash || "") || stableHash(writer.runtimeOutput) !== writer.outputHash) fail("UNIFIED_XHS_VISUAL_REVIEW_WRITER_OUTPUT_REQUIRED", "Authoritative XHS writer output is required", 409);
  if (!master?.contentMaster || !masterFact || !HASH.test(master.sourceOutputHash || "") || master.sourceOutputHash !== masterFact.outputHash) fail("UNIFIED_XHS_VISUAL_REVIEW_CONTENT_MASTER_REQUIRED", "Authoritative ContentMaster is required", 409);
  if (!intent || typeof intent !== "object" || !Object.keys(intent).length) fail("UNIFIED_XHS_VISUAL_REVIEW_INTENT_PROFILE_REQUIRED", "Authoritative intent profile is required", 409, { snapshotKeys: Object.keys(ctx.snapshot), orchestrationKeys: Object.keys(ctx.snapshot.orchestrationSnapshot || {}), platformKeys: Object.keys(ctx.platform) });
  return { schemaVersion: "1.0", contract: "UnifiedXhsVisualReviewInput@1.0", contentProjectRef: ctx.projectRef, platformRunRef: ctx.runRef, candidateRef: ctx.candidateRef, designEvidenceRef: bound.planFact.designEvidenceRef, providerPlanFactRef: factRef(bound.planFact), planRef: { id: bound.planFact.plan.id, hash: bound.planFact.plan.planHash }, revisionSetHash: bound.revisionSetHash, pageRevisionRefs: bound.orderedRevisions.map(factRef), sourceRefs: { writerOutputFactRef: factRef(writer), writerOutputHash: writer.outputHash, contentMasterOutputFactRef: factRef(masterFact), contentMasterRef: { id: master.id, hash: master.sourceOutputHash }, intentProfileRef: orchestrationRun?.platformBriefRef ? clone(orchestrationRun.platformBriefRef) : { id: `${ctx.runRef.id}:intent-profile`, hash: stableHash(intent) }, designDnaRef: { id: `${designFact.id}:design-projection`, hash: stableHash(designDna) } }, xhs_post_package: clone(writer.runtimeOutput), content_master: clone(master.contentMaster), content_intent_profile: clone(intent), design_dna: clone(designDna), current_version: bound.revisionSetHash };
}

function validateOutput(output, orderedRevisions) {
  exact(output, ["status", "data", "warnings", "blocked_reasons"], "UNIFIED_XHS_VISUAL_REVIEW_OUTPUT_FIELDS_INVALID");
  if (!["success", "failed", "needs_review"].includes(output.status) || !Array.isArray(output.warnings) || !Array.isArray(output.blocked_reasons) || [...output.warnings, ...output.blocked_reasons].some((item) => typeof item !== "string")) fail("UNIFIED_XHS_VISUAL_REVIEW_OUTPUT_INVALID");
  exact(output.data, ["decision", "page_findings", "deck_findings", "passed_checks", "rerun_stages"], "UNIFIED_XHS_VISUAL_REVIEW_OUTPUT_DATA_FIELDS_INVALID");
  if (!["pass", "revise", "block"].includes(output.data.decision) || !Array.isArray(output.data.page_findings) || !Array.isArray(output.data.deck_findings) || !Array.isArray(output.data.passed_checks) || !Array.isArray(output.data.rerun_stages) || output.data.passed_checks.some((item) => typeof item !== "string")) fail("UNIFIED_XHS_VISUAL_REVIEW_OUTPUT_INVALID");
  const allowedReruns = new Set(["write-xhs-content.visual_plan", "write-xhs-content.image_specs", "image_executor", "Renderer"]);
  if (output.data.rerun_stages.some((stage) => !allowedReruns.has(stage))) fail("UNIFIED_XHS_VISUAL_REVIEW_RERUN_STAGE_FORBIDDEN");
  const findings = output.data.page_findings.map((finding) => {
    exact(finding, ["finding_id", "page", "element", "severity", "issue", "evidence", "patch"], "UNIFIED_XHS_VISUAL_REVIEW_PAGE_FINDING_FIELDS_INVALID");
    if (!finding || !Number.isInteger(finding.page) || finding.page < 1 || finding.page > orderedRevisions.length || !["suggestion", "warning", "blocker"].includes(finding.severity)) fail("UNIFIED_XHS_VISUAL_REVIEW_PAGE_FINDING_INVALID");
    if (!["headline", "body", "image", "layout", "footer", "deck"].includes(finding.element) || !text(finding.finding_id, "UNIFIED_XHS_VISUAL_REVIEW_FINDING_ID_REQUIRED") || !text(finding.issue, "UNIFIED_XHS_VISUAL_REVIEW_FINDING_ISSUE_REQUIRED") || !text(finding.evidence, "UNIFIED_XHS_VISUAL_REVIEW_FINDING_EVIDENCE_REQUIRED")) fail("UNIFIED_XHS_VISUAL_REVIEW_PAGE_FINDING_INVALID");
    if (finding.patch != null) { exact(finding.patch, ["target", "operation", "value"], "UNIFIED_XHS_VISUAL_REVIEW_PATCH_FIELDS_INVALID"); text(finding.patch.target, "UNIFIED_XHS_VISUAL_REVIEW_PATCH_TARGET_REQUIRED"); text(finding.patch.operation, "UNIFIED_XHS_VISUAL_REVIEW_PATCH_OPERATION_REQUIRED"); }
    return { ...clone(finding), pageId: orderedRevisions[finding.page - 1].pageId, pageRevisionRef: factRef(orderedRevisions[finding.page - 1]) };
  });
  for (const finding of output.data.deck_findings) {
    exact(finding, ["finding_id", "severity", "issue", "evidence", "patch"], "UNIFIED_XHS_VISUAL_REVIEW_DECK_FINDING_FIELDS_INVALID");
    if (!["suggestion", "warning", "blocker"].includes(finding.severity) || !text(finding.finding_id, "UNIFIED_XHS_VISUAL_REVIEW_FINDING_ID_REQUIRED") || !text(finding.issue, "UNIFIED_XHS_VISUAL_REVIEW_FINDING_ISSUE_REQUIRED") || !text(finding.evidence, "UNIFIED_XHS_VISUAL_REVIEW_FINDING_EVIDENCE_REQUIRED")) fail("UNIFIED_XHS_VISUAL_REVIEW_DECK_FINDING_INVALID");
    if (finding.patch != null) exact(finding.patch, ["target", "operation", "value"], "UNIFIED_XHS_VISUAL_REVIEW_PATCH_FIELDS_INVALID");
  }
  if (output.data.decision === "pass" && (output.status !== "success" || findings.some((finding) => finding.severity === "blocker"))) fail("UNIFIED_XHS_VISUAL_REVIEW_PASS_INVALID");
  return { output: clone(output), normalizedFindings: findings };
}

function executionIdem(facts, idempotencyKey, requestHash, result, recordedAt) { facts.executionIdem.push(hashed({ schemaVersion: "1.0", contract: "UnifiedXhsVisualReviewExecutionIdempotencyFact@1.0", id: `xhs-visual-review-execution-idempotency:${requestHash.slice(0, 24)}`, idempotencyKey, requestHash, result: clone(result), recordedAt })); }

export async function executeUnifiedContentXhsVisualReview(store, input, { featureFlags = {}, provider = null, assetReader = null, multimodalTransport = null, transportContext = { mode: "unconfigured", networked: false }, now = () => new Date().toISOString() } = {}) {
  exact(input, ["workspaceId", "companyId", "accountId", "projectId", "productSnapshotHash", "platformRunRef", "candidateRef", "designEvidenceRef", "providerPlanFactRef", "planRef", "approvalFactRef", "idempotencyKey"], "UNIFIED_XHS_VISUAL_REVIEW_EXECUTION_CALLER_AUTHORITY_FORBIDDEN");
  if (featureFlags.unifiedContentXhsVisualReviewV1 !== true) fail("UNIFIED_XHS_VISUAL_REVIEW_DISABLED", "Visual review disabled", 404);
  if (typeof assetReader !== "function") fail("UNIFIED_XHS_VISUAL_REVIEW_ASSET_READER_REQUIRED", "Asset reader not configured", 503);
  if (typeof multimodalTransport !== "function") fail("UNIFIED_XHS_VISUAL_REVIEW_MULTIMODAL_TRANSPORT_REQUIRED", "Multimodal transport not configured", 503);
  if (typeof transportContext?.networked !== "boolean") fail("UNIFIED_XHS_VISUAL_REVIEW_TRANSPORT_CONTEXT_INVALID", "networked declaration required", 503);
  const configured = providerAuthority(provider); const ctx = context(store, input, featureFlags); const bound = authority(store, ctx, input); const facts = collections(store);
  const approvalRef = ref(input.approvalFactRef, "UNIFIED_XHS_VISUAL_REVIEW_APPROVAL_REF_INVALID"); const approval = facts.approvals.map((fact) => validateFact(fact, "UnifiedXhsVisualReviewApprovalFact@1.0", "UNIFIED_XHS_VISUAL_REVIEW_APPROVAL_FACT_INVALID")).find((fact) => sameRef(factRef(fact), approvalRef));
  if (!approval) fail("UNIFIED_XHS_VISUAL_REVIEW_APPROVAL_NOT_FOUND", "Visual review approval not found", 404);
  for (const [actual, expected, code] of [[approval.contentProjectRef, ctx.projectRef, "PROJECT"], [approval.platformRunRef, ctx.runRef, "RUN"], [approval.candidateRef, ctx.candidateRef, "CANDIDATE"], [approval.providerPlanFactRef, factRef(bound.planFact), "PLAN_FACT"]]) assertRef(actual, expected, `UNIFIED_XHS_VISUAL_REVIEW_APPROVAL_${code}_MISMATCH`);
  if (ctx.authorityKind === "atomic_v2") assertRef(approval.materializedContentProjectRef, ctx.materializedProjectRef, "UNIFIED_XHS_VISUAL_REVIEW_APPROVAL_MATERIALIZED_PROJECT_MISMATCH");
  if (approval.revisionSetHash !== bound.revisionSetHash || stableHash(approval.pageRevisionRefs) !== stableHash(bound.orderedRevisions.map(factRef))) fail("UNIFIED_XHS_VISUAL_REVIEW_APPROVAL_STALE");
  if (stableHash(approval.provider) !== stableHash(configured)) fail("UNIFIED_XHS_VISUAL_REVIEW_PROVIDER_AUTHORITY_CHANGED");
  const idempotencyKey = text(input.idempotencyKey, "UNIFIED_XHS_VISUAL_REVIEW_EXECUTION_IDEMPOTENCY_REQUIRED"); const requestHash = stableHash({ approvalFactRef: approvalRef, revisionSetHash: bound.revisionSetHash, idempotencyKey });
  const prior = facts.executionIdem.find((fact) => fact.idempotencyKey === idempotencyKey);
  if (prior) { validateFact(prior, "UnifiedXhsVisualReviewExecutionIdempotencyFact@1.0", "UNIFIED_XHS_VISUAL_REVIEW_EXECUTION_IDEMPOTENCY_INVALID"); if (prior.requestHash !== requestHash) fail("UNIFIED_XHS_VISUAL_REVIEW_EXECUTION_IDEMPOTENCY_CONFLICT"); return { ...clone(prior.result), created: false, claims: { ...prior.result.claims, providerCalls: 0, networkCalls: 0 } }; }
  if (facts.invocations.some((fact) => sameRef(fact.approvalFactRef, approvalRef))) fail("UNIFIED_XHS_VISUAL_REVIEW_APPROVAL_ALREADY_USED");
  const checkpoint = facts.checkpoints.map((fact) => validateFact(fact, "UnifiedXhsVisualReviewCheckpointFact@1.0", "UNIFIED_XHS_VISUAL_REVIEW_CHECKPOINT_INVALID")).find((fact) => fact.requiresReconciliation && sameRef(fact.contentProjectRef, ctx.projectRef) && sameMaterialized(fact, ctx) && sameRef(fact.platformRunRef, ctx.runRef) && sameRef(fact.candidateRef, ctx.candidateRef) && sameRef(fact.planRef, input.planRef) && fact.revisionSetHash === bound.revisionSetHash);
  if (checkpoint) fail("UNIFIED_XHS_VISUAL_REVIEW_CHECKPOINT_UNRECONCILED", "Visual review checkpoint requires reconciliation", 409, { checkpointFactRef: factRef(checkpoint) });
  const attachments = [];
  for (const revision of bound.orderedRevisions) {
    const read = await assetReader(clone(revision.normalizedAsset), { pageId: revision.pageId, pageRevisionRef: factRef(revision), workspaceId: ctx.workspaceId, projectId: ctx.projectId });
    const bytes = Buffer.isBuffer(read) ? read : read?.bytes; const mediaType = Buffer.isBuffer(read) ? "image/png" : read?.mediaType;
    if (!Buffer.isBuffer(bytes) || mediaType !== "image/png" || bytes.length !== revision.normalizedAsset.bytes || sha256(bytes) !== revision.normalizedAsset.sha256) fail("UNIFIED_XHS_VISUAL_REVIEW_ASSET_MISMATCH", "Page asset bytes do not match revision", 409, { pageId: revision.pageId });
    let dimensions; try { dimensions = readPngDimensions(bytes); } catch { fail("UNIFIED_XHS_VISUAL_REVIEW_ASSET_INVALID_PNG", "Page asset is not a valid PNG", 409, { pageId: revision.pageId }); }
    if (dimensions.width !== 1080 || dimensions.height !== 1440) fail("UNIFIED_XHS_VISUAL_REVIEW_ASSET_DIMENSIONS_INVALID", "Page asset must be 1080x1440", 409, { pageId: revision.pageId });
    attachments.push({ pageId: revision.pageId, pageRevisionRef: factRef(revision), mediaType, bytes: Buffer.from(bytes), sha256: revision.normalizedAsset.sha256, byteLength: bytes.length, dimensions });
  }
  const canonicalInput = reviewInput(store, ctx, bound); const skill = skillBundle();
  if (skill.bundleHash !== approval.skill.bundleHash || stableHash(skill.referenceBundle) !== stableHash(approval.skill.referenceBundle)) fail("UNIFIED_XHS_VISUAL_REVIEW_SKILL_BUNDLE_STALE");
  const attachmentManifest = attachments.map(({ bytes, ...entry }) => entry); const inputHash = stableHash(canonicalInput); const attachmentHash = stableHash(attachmentManifest);
  const request = { schemaVersion: "1.0", contract: "UnifiedXhsVisualReviewMultimodalRequest@1.0", skill: { name: skill.name, version: skill.version, manifestVersion: skill.manifestVersion, bundleHash: skill.bundleHash, referenceBundle: skill.fullReferenceBundle }, expectedContract: "XhsVisualReview@1.0", input: canonicalInput, attachments };
  let response; let thrown = null; try { response = await multimodalTransport(request, { provider: configured.provider, model: configured.model, capability: configured.capability, approvalFactRef: approvalRef, maxProviderCalls: 1, maxCredits: approval.limits.maxCredits, transportContext: clone(transportContext) }); } catch (error) { thrown = error; }
  const providerState = response || thrown || {}; const recordedAt = new Date(now()).toISOString(); const costKnown = Number.isFinite(Number(providerState.cost)) && Number(providerState.cost) >= 0; const overLimit = costKnown && Number(providerState.cost) > approval.limits.maxCredits; const ambiguous = overLimit || (providerState.paidTaskCreated === true && (!costKnown || providerState.providerState === "unknown" || providerState.usageStatus === "unknown")); const providerMismatch = Boolean(response && (response.provider !== configured.provider || response.model !== configured.model));
  const invocationBase = { schemaVersion: "1.0", contract: "UnifiedXhsVisualReviewInvocationFact@1.0", id: `xhs-visual-review-invocation:${stableHash({ approvalRef, requestHash }).slice(0, 24)}`, workspaceId: ctx.workspaceId, companyId: ctx.companyId, accountId: ctx.accountId, contentProjectRef: ctx.projectRef, ...materializedBinding(ctx), platformRunRef: ctx.runRef, candidateRef: ctx.candidateRef, designEvidenceRef: input.designEvidenceRef, providerPlanFactRef: input.providerPlanFactRef, planRef: input.planRef, approvalFactRef: approvalRef, pageRevisionRefs: bound.orderedRevisions.map(factRef), revisionSetHash: bound.revisionSetHash, skill: { name: skill.name, version: skill.version, bundleHash: skill.bundleHash, referenceBundle: skill.referenceBundle }, hashes: { inputHash, attachmentHash, executionPlanHash: stableHash({ approvalFactRef: approvalRef, maxProviderCalls: 1, maxAttempts: 1, automaticRetries: 0 }), outputHash: response?.output ? stableHash(response.output) : null }, provider: configured.provider, model: configured.model, pixelInputConsumed: response?.pixelInputConsumed === true, providerCalls: 1, networkCalls: transportContext.networked ? 1 : 0, attempts: 1, automaticRetries: 0, credits: costKnown ? Number(providerState.cost) : null, productionEligible: false, ...(ctx.authorityKind === "atomic_v2" ? { humanReviewAuthority: false, selectionAuthority: false } : {}), status: ambiguous ? "checkpoint_required" : thrown || response?.status !== "succeeded" || providerMismatch ? "failed" : "completed", error: providerMismatch ? { code: "MULTIMODAL_PROVIDER_AUTHORITY_MISMATCH", message: "Provider response does not match server authority" } : thrown ? { code: thrown.code || "MULTIMODAL_TRANSPORT_FAILED", message: thrown.message } : response?.error || null, requestHash, idempotencyKey, recordedAt };
  let invocationFact = hashed(invocationBase); facts.invocations.push(invocationFact);
  if (ambiguous) {
    const checkpointFact = hashed({ schemaVersion: "1.0", contract: "UnifiedXhsVisualReviewCheckpointFact@1.0", id: `xhs-visual-review-checkpoint:${invocationFact.factHash.slice(0, 24)}`, workspaceId: ctx.workspaceId, companyId: ctx.companyId, accountId: ctx.accountId, contentProjectRef: ctx.projectRef, ...materializedBinding(ctx), platformRunRef: ctx.runRef, candidateRef: ctx.candidateRef, planRef: input.planRef, revisionSetHash: bound.revisionSetHash, invocationFactRef: factRef(invocationFact), requiresReconciliation: true, ...(ctx.authorityKind === "atomic_v2" ? { humanReviewAuthority: false, selectionAuthority: false } : {}), status: overLimit ? "actual_cost_exceeded_approval" : "unknown_paid_or_provider_state", providerCheckpoint: clone(providerState.checkpoint || null), recordedAt }); facts.checkpoints.push(checkpointFact);
    const result = { created: true, status: "checkpoint_required", invocationFact: clone(invocationFact), checkpointFact: clone(checkpointFact), reviewFact: null, claims: { providerCalls: 1, networkCalls: invocationFact.networkCalls, credits: null, automaticRetries: 0, humanReviewOpened: false, selectionPerformed: false, publicationPerformed: false } }; executionIdem(facts, idempotencyKey, requestHash, result, recordedAt); return result;
  }
  if (thrown || response?.status !== "succeeded" || providerMismatch) { const result = { created: true, status: "failed", invocationFact: clone(invocationFact), checkpointFact: null, reviewFact: null, claims: { providerCalls: 1, networkCalls: invocationFact.networkCalls, credits: invocationFact.credits, automaticRetries: 0, humanReviewOpened: false, selectionPerformed: false, publicationPerformed: false } }; executionIdem(facts, idempotencyKey, requestHash, result, recordedAt); return result; }
  let validated;
  try { validated = validateOutput(response.output, bound.orderedRevisions); } catch (error) {
    invocationFact = hashed({ ...invocationBase, status: "failed_output_contract", productionEligible: false, error: { code: error.code || "UNIFIED_XHS_VISUAL_REVIEW_OUTPUT_INVALID", message: error.message } }); facts.invocations[facts.invocations.length - 1] = invocationFact;
    const result = { created: true, status: "failed_output_contract", invocationFact: clone(invocationFact), checkpointFact: null, reviewFact: null, claims: { providerCalls: 1, networkCalls: invocationFact.networkCalls, credits: invocationFact.credits, automaticRetries: 0, humanReviewOpened: false, selectionPerformed: false, publicationPerformed: false } }; executionIdem(facts, idempotencyKey, requestHash, result, recordedAt); return result;
  }
  const trustedPixelReview = response.pixelInputConsumed === true && response.mode !== "metadata_only" && response.productionResult === true;
  const productionEligible = trustedPixelReview && validated.output.status === "success" && validated.output.data.decision === "pass";
  invocationFact = hashed({ ...invocationBase, pixelInputConsumed: response.pixelInputConsumed === true, productionEligible: trustedPixelReview, status: trustedPixelReview ? "completed" : "metadata_only_non_production" }); facts.invocations[facts.invocations.length - 1] = invocationFact;
  const reviewBase = { schemaVersion: "1.0", contract: "UnifiedXhsVisualReviewFact@1.0", id: `xhs-visual-review:${invocationFact.factHash.slice(0, 24)}`, workspaceId: ctx.workspaceId, companyId: ctx.companyId, accountId: ctx.accountId, contentProjectRef: ctx.projectRef, ...materializedBinding(ctx), platformRunRef: ctx.runRef, candidateRef: ctx.candidateRef, designEvidenceRef: input.designEvidenceRef, providerPlanFactRef: input.providerPlanFactRef, planRef: input.planRef, approvalFactRef: approvalRef, invocationFactRef: factRef(invocationFact), pageRevisionRefs: bound.orderedRevisions.map(factRef), revisionSetHash: bound.revisionSetHash, output: validated.output, normalizedPageFindings: validated.normalizedFindings, decision: validated.output.data.decision, productionEligible, humanReviewAuthority: false, selectionAuthority: false, publicationPerformed: false, status: productionEligible ? "skill_passed" : response.pixelInputConsumed !== true || response.mode === "metadata_only" ? "metadata_only_non_production" : validated.output.data.decision === "pass" ? "non_production_result" : validated.output.data.decision === "revise" ? "redo_required" : "blocked", recordedAt };
  const reviewFact = hashed(reviewBase); facts.reviews.push(reviewFact); const result = { created: true, status: reviewFact.status, invocationFact: clone(invocationFact), checkpointFact: null, reviewFact: clone(reviewFact), claims: { providerCalls: 1, networkCalls: invocationFact.networkCalls, credits: invocationFact.credits, automaticRetries: 0, humanReviewOpened: productionEligible, selectionPerformed: false, publicationPerformed: false } }; executionIdem(facts, idempotencyKey, requestHash, result, recordedAt); return result;
}
