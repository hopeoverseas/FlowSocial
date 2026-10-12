import { hashUnifiedContent } from "./unified-content-contracts.mjs";
import {
  createUnifiedAtomicContentCommitStore,
  validateUnifiedAtomicContentCommit,
  validateUnifiedAtomicContentCommitV2
} from "./unified-atomic-content-commit-store.mjs";
import { validateUnifiedAtomicWechatContentCommit } from "./unified-atomic-wechat-commit.mjs";
import {
  projectUnifiedAtomicContentCommit,
  validateUnifiedAtomicContentProductProjection
} from "./unified-atomic-product-projection.mjs";
import { runUnifiedAtomicWechatCommitOrchestration } from "./unified-content-orchestrator.mjs";
import { createUnifiedSkillActivityExecutor } from "./unified-skill-activity-executor.mjs";
import { createUnifiedSkillEvidenceCompiler } from "./unified-skill-evidence-compiler.mjs";
import {
  validateContentMasterSemanticSpine,
  validateContentOutlineSemanticMapping,
  validateContentStructureIntent
} from "./unified-skill-output-contracts.mjs";

const CONTRACT = "UnifiedAtomicMultiplatformProduct@1.0";
const ARTIFACT_PROJECTION_CONTRACT = "UnifiedAtomicMultiplatformArtifactProjection@1.0";
const HASH = /^[a-f0-9]{64}$/;
const PLATFORMS = Object.freeze(["xiaohongshu", "wechat"]);
const SHARED_ROLES = Object.freeze([
  "contentOpportunityRef", "activeStrategySnapshotRef", "sharedContentMasterRef", "mechanismDecisionRef", "sourcePlanRef"
]);
const ROOT_KEYS = Object.freeze(["schemaVersion", "contract", "id", "companyId", "productIdentityRef", "sharedAuthorityRefs",
  "platformMaterializedProjectRefs", "platforms", "commitRefs", "blockers", "aggregateHash"]);
const WECHAT_KEYS = Object.freeze(["state", "platform", "accountId", "commitRef", "materializedContentProjectRef", "platformRunRef",
  "articleRef", "articleReviewRef", "imagePlanRef", "article", "articleReview", "canonicalImagePlan", "artifactAuthority",
  "humanReviewAuthority", "selectionAuthority", "promotionAuthority", "deliveryAuthority", "publicationAuthority", "blockers"]);

function fail(code, paths = []) {
  throw Object.assign(new Error(code), { code, statusCode: 409, details: { fieldPaths: [...new Set(paths)] } });
}

const clone = (value) => value == null ? value : structuredClone(value);
const object = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
const exact = (value, keys) => object(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const text = (value) => typeof value === "string" && Boolean(value.trim());
const ref = (value) => object(value) && Object.keys(value).length === 2 && text(value.id) && HASH.test(value.hash || "");
const sameRef = (left, right) => ref(left) && ref(right) && left.id === right.id && left.hash === right.hash;
const scopedPlatforms = (value) => PLATFORMS.includes(value?.targetPlatform) ? [value.targetPlatform] : [...PLATFORMS];
const outlineKey = (platform) => platform === "wechat" ? "wechatOutline" : "xiaohongshuOutline";
const exactPlatformRefs = (value, platforms) => exact(value, platforms) && platforms.every((platform) => ref(value[platform]));

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

function authorityRef(binding, role) {
  return binding?.refs?.find((item) => item.role === role)?.ref || null;
}

function xhsAuthorityRef(commit, role) {
  if (role === "contentOpportunityRef") return commit.contentProjectIdentity.contentOpportunityRef;
  if (role === "activeStrategySnapshotRef") return commit.contentProjectIdentity.activeStrategySnapshotRef;
  if (role === "sharedContentMasterRef") return commit.usageBinding.sharedContentMasterRef;
  if (role === "mechanismDecisionRef") return commit.usageBinding.decisionRef;
  if (role === "sourcePlanRef") return commit.usageBinding.sourcePlanRef;
  return authorityRef(commit.graph.authorityBinding, role);
}

function wechatAuthorityRef(commit, role) {
  if (role === "contentOpportunityRef") return commit.contentProjectIdentity.contentOpportunityRef;
  if (role === "activeStrategySnapshotRef") return commit.contentProjectIdentity.activeStrategySnapshotRef;
  return authorityRef(commit.authorityBinding, role);
}

function validatedCommits(store) {
  const values = store?.unifiedAtomicContentCommits;
  if (values === undefined) return [];
  if (!Array.isArray(values)) fail("UNIFIED_ATOMIC_MULTIPLATFORM_COMMIT_STORE_INVALID", ["$.unifiedAtomicContentCommits"]);
  return values.map((item, index) => {
    try {
      if (item?.contract === "UnifiedAtomicContentCommit@2.0" && item.schemaVersion === "2.0") validateUnifiedAtomicContentCommitV2(item);
      else if (item?.contract === "UnifiedAtomicContentCommit@1.0" && item.schemaVersion === "1.0") validateUnifiedAtomicContentCommit(item);
      else if (item?.contract === "UnifiedAtomicWechatContentCommit@1.0" && item.schemaVersion === "1.0") validateUnifiedAtomicWechatContentCommit(item);
      else fail("UNIFIED_ATOMIC_MULTIPLATFORM_COMMIT_TYPE_INVALID");
    } catch {
      fail("UNIFIED_ATOMIC_MULTIPLATFORM_COMMIT_STORE_INVALID", [`$.unifiedAtomicContentCommits[${index}]`]);
    }
    return item;
  });
}

function currentWechatCommits(store, commits) {
  const wechat = commits.filter((item) => item.contract === "UnifiedAtomicWechatContentCommit@1.0");
  const facts = Array.isArray(store?.unifiedAtomicWechatCommitSupersessionFacts)
    ? store.unifiedAtomicWechatCommitSupersessionFacts : [];
  const predecessors = new Set();
  const successors = new Set();
  for (const fact of facts) {
    if (fact?.contract !== "UnifiedAtomicWechatCommitSupersessionFact@1.0") fail("UNIFIED_ATOMIC_WECHAT_SUPERSESSION_FACT_INVALID");
    const copy = clone(fact); delete copy.factHash;
    if (!ref(fact.predecessorRef) || !ref(fact.successorRef) || !text(fact.reason)
      || !fact.actor?.type || !fact.actor?.id || !text(fact.recordedAt) || !HASH.test(fact.factHash || "")
      || hashUnifiedContent(copy) !== fact.factHash) fail("UNIFIED_ATOMIC_WECHAT_SUPERSESSION_FACT_INVALID");
    const predecessor = wechat.find((item) => sameRef(commitRef(item), fact.predecessorRef));
    const successor = wechat.find((item) => sameRef(commitRef(item), fact.successorRef));
    if (!predecessor || !successor || !sameRef(predecessor.contentProjectRef, successor.contentProjectRef)) {
      fail("UNIFIED_ATOMIC_WECHAT_SUPERSESSION_CLOSURE_INVALID");
    }
    if (predecessors.has(predecessor.id) || successors.has(successor.id) || predecessor.id === successor.id) {
      fail("UNIFIED_ATOMIC_WECHAT_SUPERSESSION_BRANCH_INVALID");
    }
    predecessors.add(predecessor.id);
    successors.add(successor.id);
  }
  return wechat.filter((item) => !predecessors.has(item.id));
}

function assertSharedAuthority(xhs, wechat) {
  if (!sameRef({ id: xhs.contentProjectIdentity.id, hash: xhs.contentProjectIdentity.identityHash }, wechat.contentProjectRef)
    || xhs.companyId !== wechat.companyId) {
    fail("UNIFIED_ATOMIC_MULTIPLATFORM_PROJECT_IDENTITY_MISMATCH", ["$.contentProjectRef"]);
  }
  const mismatches = SHARED_ROLES.filter((role) => !sameRef(xhsAuthorityRef(xhs, role), wechatAuthorityRef(wechat, role)));
  if (mismatches.length) {
    const error = Object.assign(new Error("UNIFIED_ATOMIC_MULTIPLATFORM_SHARED_AUTHORITY_MISMATCH"), {
      code: "UNIFIED_ATOMIC_MULTIPLATFORM_SHARED_AUTHORITY_MISMATCH", statusCode: 409,
      details: { fieldPaths: mismatches.map((role) => `$.sharedAuthorityRefs.${role}`),
        expected: Object.fromEntries(mismatches.map((role) => [role, clone(xhsAuthorityRef(xhs, role))])),
        actual: Object.fromEntries(mismatches.map((role) => [role, clone(wechatAuthorityRef(wechat, role))])) }
    });
    throw error;
  }
}

function commitRef(commit) {
  return { id: commit.id, hash: commit.commitHash };
}

function componentRef(component) {
  return { id: component.id, hash: component.componentHash };
}

function materializedWechatValue(wechat) {
  return {
    state: "materialized", platform: "wechat", accountId: wechat.accountId,
    commitRef: commitRef(wechat), materializedContentProjectRef: clone(wechat.materializedContentProjectRef),
    platformRunRef: clone(wechat.platformRunRef), articleRef: componentRef(wechat.materializedComponents.article),
    articleReviewRef: componentRef(wechat.materializedComponents.articleReview), imagePlanRef: componentRef(wechat.materializedComponents.imagePlan),
    article: clone(wechat.materializedComponents.article), articleReview: clone(wechat.materializedComponents.articleReview),
    canonicalImagePlan: clone(wechat.materializedComponents.imagePlan), artifactAuthority: false, humanReviewAuthority: false,
    selectionAuthority: false, promotionAuthority: false, deliveryAuthority: false, publicationAuthority: false,
    blockers: ["wechat_artifact_required", "wechat_human_review_required", "wechat_selection_required", "wechat_promotion_required"]
  };
}

function buildAggregate(xhs, wechat = null) {
  validateUnifiedAtomicContentCommitV2(xhs);
  const xhsProjection = projectUnifiedAtomicContentCommit(xhs);
  validateUnifiedAtomicContentProductProjection(xhsProjection);
  if (wechat) {
    validateUnifiedAtomicWechatContentCommit(wechat);
    assertSharedAuthority(xhs, wechat);
  }
  const sharedAuthorityRefs = Object.fromEntries(SHARED_ROLES.map((role) => [role, clone(xhsAuthorityRef(xhs, role))]));
  const wechatValue = wechat ? materializedWechatValue(wechat) : { state: "not_materialized", blocker: "wechat_not_materialized" };
  const draft = {
    schemaVersion: "1.0", contract: CONTRACT, id: xhs.contentProjectIdentity.id, companyId: xhs.companyId,
    productIdentityRef: { id: xhs.contentProjectIdentity.id, hash: xhs.contentProjectIdentity.identityHash },
    sharedAuthorityRefs, platformMaterializedProjectRefs: {
      xiaohongshu: clone(xhs.materializedContentProjectRef), wechat: wechat ? clone(wechat.materializedContentProjectRef) : null
    },
    platforms: { xiaohongshu: clone(xhsProjection), wechat: wechatValue },
    commitRefs: { xiaohongshu: commitRef(xhs), wechat: wechat ? commitRef(wechat) : null },
    blockers: wechat ? clone(wechatValue.blockers) : ["wechat_not_materialized"]
  };
  return deepFreeze({ ...draft, aggregateHash: hashUnifiedContent(draft) });
}

function buildStandaloneWechatAggregate(wechat) {
  validateUnifiedAtomicWechatContentCommit(wechat);
  const sharedAuthorityRefs = Object.fromEntries(SHARED_ROLES.map((role) => [role, clone(wechatAuthorityRef(wechat, role))]));
  const wechatValue = materializedWechatValue(wechat);
  const draft = {
    schemaVersion: "1.0", contract: CONTRACT, id: wechat.contentProjectRef.id, companyId: wechat.companyId,
    productIdentityRef: clone(wechat.contentProjectRef), sharedAuthorityRefs,
    platformMaterializedProjectRefs: { xiaohongshu: null, wechat: clone(wechat.materializedContentProjectRef) },
    platforms: { xiaohongshu: { state: "not_materialized", blocker: "xiaohongshu_not_materialized" }, wechat: wechatValue },
    commitRefs: { xiaohongshu: null, wechat: commitRef(wechat) }, blockers: clone(wechatValue.blockers)
  };
  return deepFreeze({ ...draft, aggregateHash: hashUnifiedContent(draft) });
}

export function validateUnifiedAtomicMultiplatformProduct(value) {
  if (!exact(value, ROOT_KEYS) || value.schemaVersion !== "1.0" || value.contract !== CONTRACT || !text(value.id)
    || !text(value.companyId) || !ref(value.productIdentityRef) || value.productIdentityRef.id !== value.id
    || !exact(value.sharedAuthorityRefs, SHARED_ROLES) || SHARED_ROLES.some((role) => !ref(value.sharedAuthorityRefs[role]))
    || !exact(value.platformMaterializedProjectRefs, ["xiaohongshu", "wechat"])
    || !(value.platformMaterializedProjectRefs.xiaohongshu === null || ref(value.platformMaterializedProjectRefs.xiaohongshu))
    || !(value.platformMaterializedProjectRefs.wechat === null || ref(value.platformMaterializedProjectRefs.wechat))
    || !exact(value.platforms, ["xiaohongshu", "wechat"]) || !exact(value.commitRefs, ["xiaohongshu", "wechat"])
    || !(value.commitRefs.xiaohongshu === null || ref(value.commitRefs.xiaohongshu))
    || !(value.commitRefs.wechat === null || ref(value.commitRefs.wechat)) || !Array.isArray(value.blockers)
    || !HASH.test(value.aggregateHash || "")) fail("UNIFIED_ATOMIC_MULTIPLATFORM_PRODUCT_INVALID", ["$"]);
  if (value.platforms.xiaohongshu?.state === "not_materialized") {
    if (!exact(value.platforms.xiaohongshu, ["state", "blocker"])
      || value.platforms.xiaohongshu.blocker !== "xiaohongshu_not_materialized"
      || value.commitRefs.xiaohongshu !== null || value.platformMaterializedProjectRefs.xiaohongshu !== null) {
      fail("UNIFIED_ATOMIC_MULTIPLATFORM_XHS_STATE_INVALID", ["$.platforms.xiaohongshu"]);
    }
  } else {
    if (!ref(value.commitRefs.xiaohongshu) || !ref(value.platformMaterializedProjectRefs.xiaohongshu)) {
      fail("UNIFIED_ATOMIC_MULTIPLATFORM_XHS_STATE_INVALID", ["$.platforms.xiaohongshu"]);
    }
    validateUnifiedAtomicContentProductProjection(value.platforms.xiaohongshu);
  }
  if (value.platforms.wechat?.state === "not_materialized") {
    if (!exact(value.platforms.wechat, ["state", "blocker"])) fail("UNIFIED_ATOMIC_MULTIPLATFORM_WECHAT_STATE_INVALID", ["$.platforms.wechat"]);
    if (value.commitRefs.wechat !== null || value.platformMaterializedProjectRefs.wechat !== null
      || value.platforms.wechat.blocker !== "wechat_not_materialized") fail("UNIFIED_ATOMIC_MULTIPLATFORM_WECHAT_STATE_INVALID", ["$.platforms.wechat"]);
  } else if (value.platforms.wechat?.state === "materialized") {
    const wechat = value.platforms.wechat;
    if (!exact(wechat, WECHAT_KEYS) || wechat.platform !== "wechat" || !text(wechat.accountId) || !sameRef(wechat.commitRef, value.commitRefs.wechat)
      || !sameRef(wechat.materializedContentProjectRef, value.platformMaterializedProjectRefs.wechat)
      || !ref(wechat.platformRunRef) || !ref(wechat.articleRef) || !ref(wechat.articleReviewRef) || !ref(wechat.imagePlanRef)
      || wechat.artifactAuthority !== false || wechat.humanReviewAuthority !== false || wechat.selectionAuthority !== false
      || wechat.promotionAuthority !== false || wechat.deliveryAuthority !== false || wechat.publicationAuthority !== false) {
      fail("UNIFIED_ATOMIC_MULTIPLATFORM_WECHAT_STATE_INVALID", ["$.platforms.wechat"]);
    }
    const articleRef = componentRef(wechat.article);
    const reviewRef = componentRef(wechat.articleReview);
    const imagePlanRef = componentRef(wechat.canonicalImagePlan);
    const selfHash = (component) => {
      const copy = clone(component); delete copy.componentHash;
      return HASH.test(component?.componentHash || "") && hashUnifiedContent(copy) === component.componentHash;
    };
    if (!selfHash(wechat.article) || !selfHash(wechat.articleReview) || !selfHash(wechat.canonicalImagePlan)
      || !sameRef(articleRef, wechat.articleRef) || !sameRef(reviewRef, wechat.articleReviewRef) || !sameRef(imagePlanRef, wechat.imagePlanRef)
      || !sameRef(wechat.articleReview.articleRef, articleRef)
      || !sameRef(wechat.canonicalImagePlan.articleRef, articleRef) || !sameRef(wechat.canonicalImagePlan.articleReviewRef, reviewRef)
      || JSON.stringify(wechat.blockers) !== JSON.stringify(["wechat_artifact_required", "wechat_human_review_required", "wechat_selection_required", "wechat_promotion_required"])) {
      fail("UNIFIED_ATOMIC_MULTIPLATFORM_WECHAT_COMPONENT_CLOSURE_INVALID", ["$.platforms.wechat"]);
    }
  } else fail("UNIFIED_ATOMIC_MULTIPLATFORM_WECHAT_STATE_INVALID", ["$.platforms.wechat.state"]);
  const copy = clone(value); delete copy.aggregateHash;
  if (hashUnifiedContent(copy) !== value.aggregateHash) fail("UNIFIED_ATOMIC_MULTIPLATFORM_PRODUCT_HASH_MISMATCH", ["$.aggregateHash"]);
  return value;
}

function aggregates(store) {
  const commits = validatedCommits(store);
  const xhs = commits.filter((item) => item.contract === "UnifiedAtomicContentCommit@2.0");
  const wechat = currentWechatCommits(store, commits);
  const legacyIds = new Set((store?.unifiedContentProjects || []).flatMap((item) => [item?.id, item?.contentProject?.id]).filter(text));
  const seen = new Set();
  const values = xhs.map((item) => {
    const identityRef = { id: item.contentProjectIdentity.id, hash: item.contentProjectIdentity.identityHash };
    if (seen.has(identityRef.id) || legacyIds.has(identityRef.id)) fail("UNIFIED_ATOMIC_MULTIPLATFORM_ID_COLLISION", ["$.id"]);
    seen.add(identityRef.id);
    const matches = wechat.filter((candidate) => sameRef(candidate.contentProjectRef, identityRef));
    if (matches.length > 1) fail("UNIFIED_ATOMIC_MULTIPLATFORM_WECHAT_COMMIT_AMBIGUOUS", ["$.commitRefs.wechat"]);
    const value = buildAggregate(item, matches[0] || null);
    validateUnifiedAtomicMultiplatformProduct(value);
    return value;
  });
  for (const item of wechat) {
    if (xhs.some((candidate) => sameRef(item.contentProjectRef, { id: candidate.contentProjectIdentity.id, hash: candidate.contentProjectIdentity.identityHash }))) continue;
    if (seen.has(item.contentProjectRef.id) || legacyIds.has(item.contentProjectRef.id)) fail("UNIFIED_ATOMIC_MULTIPLATFORM_ID_COLLISION", ["$.id"]);
    const value = buildStandaloneWechatAggregate(item);
    validateUnifiedAtomicMultiplatformProduct(value);
    seen.add(item.contentProjectRef.id);
    values.push(value);
  }
  return values;
}

export function listUnifiedAtomicMultiplatformProducts(store, filters = {}) {
  return deepFreeze(aggregates(store).filter((item) => (!filters.companyId || item.companyId === filters.companyId)
    && (!filters.accountId || Object.values(item.platforms).some((platform) => platform?.accountId === filters.accountId))).map(clone));
}

export function getUnifiedAtomicMultiplatformProduct(store, id) {
  if (!text(id)) return null;
  const matches = aggregates(store).filter((item) => item.id === id || item.productIdentityRef.hash === id
    || Object.values(item.commitRefs).some((itemRef) => itemRef && (itemRef.id === id || itemRef.hash === id)));
  if (matches.length > 1) fail("UNIFIED_ATOMIC_MULTIPLATFORM_ID_COLLISION", ["id"]);
  return matches.length === 1 ? deepFreeze(clone(matches[0])) : null;
}

export function projectUnifiedAtomicWechatPreuploadArtifact(product, artifactState) {
  validateUnifiedAtomicMultiplatformProduct(product);
  const wechat = product.platforms.wechat;
  if (wechat?.state !== "materialized" || artifactState?.contract !== "UnifiedContentArtifactState@1.0"
    || artifactState.authorityKind !== "atomic_wechat_v1" || artifactState.platform !== "wechat"
    || !sameRef(artifactState.contentProjectRef, product.productIdentityRef)
    || !sameRef(artifactState.materializedContentProjectRef, product.platformMaterializedProjectRefs.wechat)
    || !sameRef(artifactState.platformRunRef, wechat.platformRunRef) || !sameRef(artifactState.candidateRef, wechat.articleRef)
    || !HASH.test(artifactState.artifactStateHash || "") || artifactState.finalBundleAuthority !== false
    || artifactState.publicationPerformed !== false) fail("UNIFIED_ATOMIC_WECHAT_ARTIFACT_PROJECTION_STATE_INVALID", ["$.artifactState"]);
  const artifactReady = artifactState.reviewable === true && artifactState.status === "pre_upload_review_required"
    && artifactState.blockers.includes("human_review_not_approved") && artifactState.stages?.preUpload;
  if (!artifactReady) fail("UNIFIED_ATOMIC_WECHAT_ARTIFACT_PROJECTION_NOT_READY", ["$.artifactState.status"]);
  const draft = {
    schemaVersion: "1.0", contract: ARTIFACT_PROJECTION_CONTRACT, id: product.id, companyId: product.companyId,
    baseProductRef: { id: product.id, hash: product.aggregateHash }, baseProduct: clone(product),
    platforms: {
      xiaohongshu: clone(product.platforms.xiaohongshu),
      wechat: {
        ...clone(wechat), artifactAuthority: true, artifactStateRef: { id: `wechat-artifact-state:${artifactState.artifactStateHash.slice(0, 24)}`, hash: artifactState.artifactStateHash },
        artifactState: clone(artifactState), blockers: ["wechat_human_review_required", "wechat_selection_required", "wechat_promotion_required"]
      }
    },
    blockers: ["wechat_human_review_required", "wechat_selection_required", "wechat_promotion_required"]
  };
  return deepFreeze({ ...draft, projectionHash: hashUnifiedContent(draft) });
}

export function validateUnifiedAtomicMultiplatformArtifactProjection(value) {
  if (!exact(value, ["schemaVersion", "contract", "id", "companyId", "baseProductRef", "baseProduct", "platforms", "blockers", "projectionHash"])
    || value.schemaVersion !== "1.0" || value.contract !== ARTIFACT_PROJECTION_CONTRACT || !ref(value.baseProductRef)
    || !HASH.test(value.projectionHash || "") || !exact(value.platforms, ["xiaohongshu", "wechat"])) fail("UNIFIED_ATOMIC_WECHAT_ARTIFACT_PROJECTION_INVALID", ["$"]);
  validateUnifiedAtomicMultiplatformProduct(value.baseProduct);
  const expected = projectUnifiedAtomicWechatPreuploadArtifact(value.baseProduct, value.platforms.wechat?.artifactState);
  if (hashUnifiedContent(expected) !== hashUnifiedContent(value)) fail("UNIFIED_ATOMIC_WECHAT_ARTIFACT_PROJECTION_CLOSURE_INVALID", ["$"]);
  return value;
}

export async function appendUnifiedAtomicWechatMaterialization(store, input, dependencies = {}) {
  if (dependencies.featureFlags?.unifiedContentAtomicWechatProductV1 !== true) fail("UNIFIED_ATOMIC_WECHAT_PRODUCT_DISABLED");
  const existing = validatedCommits(store).filter((item) => item.contract === "UnifiedAtomicWechatContentCommit@1.0"
    && item.idempotencyKey === input?.idempotencyKey);
  if (existing.length > 1) fail("UNIFIED_ATOMIC_MULTIPLATFORM_WECHAT_COMMIT_AMBIGUOUS", ["$.idempotencyKey"]);
  if (existing.length === 1) {
    const commit = existing[0];
    const identityDraft = {
      id: input?.project?.id, companyId: input?.project?.companyId,
      contentOpportunityRef: clone(input?.project?.contentOpportunityRef), activeStrategySnapshotRef: clone(input?.project?.activeStrategySnapshotRef)
    };
    const planHash = hashUnifiedContent(input?.executionPlan);
    const invocationPlanHashes = Object.values(commit.skillFacts).map((item) => item.invocation.planHash);
    const expectedProjectInput = { id: identityDraft.id, companyId: identityDraft.companyId, accountId: input?.project?.accountId,
      contentOpportunityRef: clone(identityDraft.contentOpportunityRef), activeStrategySnapshotRef: clone(identityDraft.activeStrategySnapshotRef) };
    const actualProjectInput = { id: commit.contentProjectIdentity.id, companyId: commit.companyId, accountId: commit.accountId,
      contentOpportunityRef: clone(commit.contentProjectIdentity.contentOpportunityRef), activeStrategySnapshotRef: clone(commit.contentProjectIdentity.activeStrategySnapshotRef) };
    const sourcePlanAuthorityRef = authorityRef(commit.authorityBinding, "sourcePlanRef");
    const writerContextAuthorityRef = authorityRef(commit.authorityBinding, "writerContextRef");
    const exactReplay = commit.id === input?.commitId && hashUnifiedContent(actualProjectInput) === hashUnifiedContent(expectedProjectInput)
      && commit.contentProjectIdentity.identityHash === hashUnifiedContent(identityDraft)
      && commit.contentProject.createdAt === input?.createdAt
      && hashUnifiedContent(commit.authorityInputs) === hashUnifiedContent(input?.authorityInputs)
      && sameRef(sourcePlanAuthorityRef, input?.sourcePlanRef)
      && writerContextAuthorityRef?.id === input?.writerContextRefId
      && writerContextAuthorityRef?.hash === input?.authorityInputs?.writerContext?.writerContextHash
      && invocationPlanHashes.length === 3 && invocationPlanHashes.every((value) => value === planHash);
    if (!exactReplay) fail("UNIFIED_ATOMIC_CONTENT_COMMIT_IDEMPOTENCY_CONFLICT", ["$.idempotencyKey"]);
    return deepFreeze({ created: false, commit: clone(commit), product: getUnifiedAtomicMultiplatformProduct(store, commit.contentProjectRef.id) });
  }
  const evidenceCompiler = createUnifiedSkillEvidenceCompiler();
  const executor = createUnifiedSkillActivityExecutor({
    evidenceCompiler, generateText: dependencies.generateText, liveExecution: dependencies.liveExecution === true
  });
  const result = await runUnifiedAtomicWechatCommitOrchestration(clone(input), {
    executeSkillStep: (request) => executor({ ...request, capability: request.step.capability }),
    getControlledOutputFact: ({ step }) => evidenceCompiler.resolveUniqueOutputFact({ capability: step.capability, platform: "wechat" }),
    resolveStepCheckpoint: dependencies.resolveStepCheckpoint,
    persistStepCheckpoint: dependencies.persistStepCheckpoint
  });
  const commit = result.commit;
  validateUnifiedAtomicWechatContentCommit(commit);
  const prospective = clone(store);
  createUnifiedAtomicContentCommitStore(prospective).append(commit);
  const aggregate = getUnifiedAtomicMultiplatformProduct(prospective, commit.contentProjectRef.id);
  const standaloneAllowed = dependencies.allowStandaloneWechat === true;
  if ((!aggregate || aggregate.platforms.wechat.state !== "materialized") && !standaloneAllowed) fail("UNIFIED_ATOMIC_MULTIPLATFORM_WECHAT_AGGREGATION_FAILED");
  const before = Array.isArray(store.unifiedAtomicContentCommits) ? store.unifiedAtomicContentCommits.length : 0;
  const stored = createUnifiedAtomicContentCommitStore(store).append(commit);
  const after = store.unifiedAtomicContentCommits.length;
  return deepFreeze({ created: after > before, commit: stored, product: getUnifiedAtomicMultiplatformProduct(store, commit.contentProjectRef.id) });
}

const STAGED_BOOTSTRAP_CONTRACT = "UnifiedStagedAtomicDualBootstrap@1.0";
const STAGED_BOOTSTRAP_FACT_CONTRACT = "UnifiedStagedAtomicDualBootstrapFact@1.0";
const OUTLINE_REVIEW_DECISION_CONTRACT = "OutlineReviewDecision@1.0";
const BOOTSTRAP_COLLECTION = "unifiedStagedAtomicDualBootstraps";
const RECONCILIATION_RECEIPT_CONTRACT = "PlanningSuccessorReconciliationReceipt@1.0";
const RECONCILIATION_RECEIPT_COLLECTION = "planningSuccessorReconciliationReceipts";
const CALLER_AUTHORITY_FIELDS = Object.freeze([
  "contentMaster", "sharedContentMaster", "brief", "platformBrief", "outline", "confirmedOutline",
  "writerContext", "sourcePlan", "commit", "commits", "outputFact", "outputFacts", "authorityInputs"
]);

function bootstrapFail(code, paths = []) {
  throw Object.assign(new Error(code), { code, statusCode: code.endsWith("_NOT_FOUND") ? 404 : 409, details: { fieldPaths: paths } });
}

function bootstrapCollection(store) {
  const values = store?.[BOOTSTRAP_COLLECTION];
  if (values === undefined) return [];
  if (!Array.isArray(values)) bootstrapFail("UNIFIED_STAGED_ATOMIC_BOOTSTRAP_STORE_INVALID", [`$.${BOOTSTRAP_COLLECTION}`]);
  return values;
}

function reconciliationReceiptCollection(store) {
  const values = store?.[RECONCILIATION_RECEIPT_COLLECTION];
  if (values === undefined) return [];
  if (!Array.isArray(values)) bootstrapFail("UNIFIED_STAGED_ATOMIC_RECONCILIATION_RECEIPT_STORE_INVALID", [`$.${RECONCILIATION_RECEIPT_COLLECTION}`]);
  return values;
}

function canonicalTime(value) {
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

function assertBootstrapFlag(dependencies) {
  if (dependencies.featureFlags?.unifiedContentStagedAtomicDualBootstrapV1 !== true) {
    bootstrapFail("UNIFIED_STAGED_ATOMIC_DUAL_BOOTSTRAP_DISABLED");
  }
}

function assertNoCallerAuthority(value, path = "$", seen = new Set()) {
  if (!object(value) || seen.has(value)) return;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    if (CALLER_AUTHORITY_FIELDS.includes(key)) bootstrapFail("UNIFIED_STAGED_ATOMIC_CALLER_AUTHORITY_FORBIDDEN", [`${path}.${key}`]);
    if (object(child)) assertNoCallerAuthority(child, `${path}.${key}`, seen);
    if (Array.isArray(child)) child.forEach((item, index) => assertNoCallerAuthority(item, `${path}.${key}[${index}]`, seen));
  }
}

function validateCreateRequest(input) {
  assertNoCallerAuthority(input);
  const requiredKeys = ["requestId", "idempotencyKey", "companyId", "projectId", "topicIntent", "activeStrategySnapshotRef", "prerequisiteRef", "accounts", "authorizationSourceRefs"];
  const allowedKeys = [...requiredKeys, "supersedesBootstrapRef", "structureIntent", "targetPlatform"];
  if (!object(input) || !requiredKeys.every((key) => Object.hasOwn(input, key))
    || Object.keys(input).some((key) => !allowedKeys.includes(key))
    || !text(input.requestId) || !text(input.idempotencyKey) || !text(input.companyId) || !text(input.projectId)
    || !object(input.topicIntent) || !ref(input.activeStrategySnapshotRef) || !ref(input.prerequisiteRef)
    || !exact(input.accounts, ["xiaohongshu", "wechat"]) || !ref(input.accounts.xiaohongshu) || !ref(input.accounts.wechat)
    || !Array.isArray(input.authorizationSourceRefs) || !input.authorizationSourceRefs.length || input.authorizationSourceRefs.some((item) => !ref(item))
    || (Object.hasOwn(input, "targetPlatform") && !PLATFORMS.includes(input.targetPlatform))
    || (Object.hasOwn(input, "supersedesBootstrapRef") && !ref(input.supersedesBootstrapRef))) {
    bootstrapFail("UNIFIED_STAGED_ATOMIC_BOOTSTRAP_CREATE_INVALID", ["$"]);
  }
  if (input.structureIntent) validateContentStructureIntent(input.structureIntent);
}

function resolveSupersededBootstrap(values, recordOrInput) {
  const supersedesRef = recordOrInput.supersedesBootstrapRef;
  if (supersedesRef == null) return null;
  if (!ref(supersedesRef)) bootstrapFail("UNIFIED_STAGED_ATOMIC_SUPERSEDES_BOOTSTRAP_INVALID", ["$.supersedesBootstrapRef"]);
  const matches = values.filter((item) => sameRef(item?.bootstrapFact?.bootstrapRef, supersedesRef));
  if (matches.length !== 1) bootstrapFail("UNIFIED_STAGED_ATOMIC_SUPERSEDED_BOOTSTRAP_NOT_FOUND", ["$.supersedesBootstrapRef"]);
  const superseded = validateStoredBootstrap(matches[0]);
  const confirmedXhsPromotion = String(recordOrInput.idempotencyKey || "").startsWith("xhs-outline-promotion:");
  if (superseded.id === recordOrInput.id || superseded.companyId !== recordOrInput.companyId
    || superseded.projectId !== recordOrInput.projectId
    || (!confirmedXhsPromotion && superseded.state !== "rejected")
    || (confirmedXhsPromotion && !["rejected", "confirmed"].includes(superseded.state))) {
    bootstrapFail("UNIFIED_STAGED_ATOMIC_SUPERSEDES_BOOTSTRAP_STATE_INVALID", ["$.supersedesBootstrapRef"]);
  }
  return superseded;
}

function requestAuthorityRefs(input) {
  return deepFreeze({
    activeStrategySnapshotRef: clone(input.activeStrategySnapshotRef), prerequisiteRef: clone(input.prerequisiteRef),
    accountRefs: clone(input.accounts), authorizationSourceRefs: clone(input.authorizationSourceRefs),
    ...(input.structureIntent ? { structureIntentRef: { id: input.structureIntent.id, hash: input.structureIntent.intentHash } } : {})
  });
}

function publicBootstrap(record) {
  const platforms = scopedPlatforms(record);
  return deepFreeze({
    schemaVersion: record.schemaVersion, contract: record.contract, id: record.id, requestId: record.requestId,
    idempotencyKey: record.idempotencyKey, companyId: record.companyId, projectId: record.projectId, state: record.state,
    authorityRefs: clone(record.authorityRefs), bootstrapFact: clone(record.bootstrapFact),
    structureIntent: clone(record.structureIntent || null),
    targetPlatform: record.targetPlatform || null,
    supersedesBootstrapRef: clone(record.supersedesBootstrapRef || null), reviewDecision: clone(record.reviewDecision || null),
    outlines: Object.fromEntries(platforms.map((platform) => [platform, clone(record.planning.outputs[outlineKey(platform)])])),
    outlineRefs: clone(record.outlineRefs), confirmation: clone(record.confirmation), commitRefs: clone(record.commitRefs),
    createdAt: record.createdAt, completedAt: record.completedAt || null
  });
}

export function getUnifiedStagedAtomicDualBootstrap(store, id) {
  if (!text(id)) bootstrapFail("UNIFIED_STAGED_ATOMIC_BOOTSTRAP_NOT_FOUND", ["$.id"]);
  const values = bootstrapCollection(store);
  const matches = values.filter((item) => item?.id === id);
  if (matches.length !== 1) bootstrapFail(matches.length ? "UNIFIED_STAGED_ATOMIC_BOOTSTRAP_AMBIGUOUS" : "UNIFIED_STAGED_ATOMIC_BOOTSTRAP_NOT_FOUND", ["$.id"]);
  return publicBootstrap(validateStoredBootstrap(matches[0], values));
}

export function listUnifiedStagedAtomicDualBootstraps(store, filters = {}) {
  if (!object(filters) || Object.keys(filters).some((key) => !["companyId", "projectId", "state"].includes(key))) {
    bootstrapFail("UNIFIED_STAGED_ATOMIC_BOOTSTRAP_LIST_INVALID", ["$"]);
  }
  const values = bootstrapCollection(store);
  return deepFreeze({
    items: values
      .filter((item) => !filters.companyId || item?.companyId === filters.companyId)
      .filter((item) => !filters.projectId || item?.projectId === filters.projectId)
      .filter((item) => !filters.state || item?.state === filters.state)
      .map((item) => publicBootstrap(validateStoredBootstrap(item, values)))
  });
}

function refList(values, hashField) {
  return values.map((item) => ({ id: item.id, hash: item[hashField] }));
}

function sameRefList(left, right) {
  return Array.isArray(left) && Array.isArray(right) && left.length === right.length
    && left.every((item, index) => sameRef(item, right[index]));
}

function validatePlanningInvocation(invocation) {
  if (!object(invocation) || !text(invocation.id) || !HASH.test(invocation.executionRecordHash || "") || !HASH.test(invocation.invocationHash || "")
    || hashUnifiedContent(invocation.executionRecord) !== invocation.executionRecordHash) {
    bootstrapFail("UNIFIED_STAGED_ATOMIC_PLANNING_INVOCATION_INVALID", ["$.planning.invocations"]);
  }
  const base = clone(invocation); delete base.executionRecordHash; delete base.invocationHash;
  if (hashUnifiedContent(base) !== invocation.invocationHash) bootstrapFail("UNIFIED_STAGED_ATOMIC_PLANNING_INVOCATION_HASH_MISMATCH", ["$.planning.invocations"]);
  return invocation;
}

function validatePlanningOutputFact(fact, invocations) {
  if (!object(fact) || fact.contract !== "UnifiedSkillOutputFact@1.0" || !text(fact.id) || !HASH.test(fact.factHash || "")
    || !HASH.test(fact.outputHash || "") || hashUnifiedContent(fact.runtimeOutput) !== fact.outputHash) {
    bootstrapFail("UNIFIED_STAGED_ATOMIC_PLANNING_OUTPUT_FACT_INVALID", ["$.planning.outputFacts"]);
  }
  const base = clone(fact); delete base.factHash;
  if (hashUnifiedContent(base) !== fact.factHash) bootstrapFail("UNIFIED_STAGED_ATOMIC_PLANNING_OUTPUT_FACT_HASH_MISMATCH", ["$.planning.outputFacts"]);
  const invocation = invocations.find((item) => item.id === fact.invocationRef?.id);
  if (!invocation || !sameRef(fact.invocationRef, { id: invocation.id, hash: invocation.invocationHash })) {
    bootstrapFail("UNIFIED_STAGED_ATOMIC_PLANNING_OUTPUT_INVOCATION_MISMATCH", ["$.planning.outputFacts.invocationRef"]);
  }
  return fact;
}

function formalPlanningOutput(outputFacts, platform, capability) {
  const matches = outputFacts.filter((item) => item.platform === platform && item.capability === capability);
  const value = matches[0]?.verifiedDomainOutput || matches[0]?.runtimeOutput?.data;
  if (matches.length !== 1 || !object(value)) {
    bootstrapFail("UNIFIED_STAGED_ATOMIC_FORMAL_PLANNING_OUTPUT_REQUIRED", ["$.planning.outputFacts"]);
  }
  return value;
}

function normalizedFormalMaster(value) {
  const atomic = clone(value?.contentMaster || value);
  if (!object(atomic)) return null;
  delete atomic.platform;
  return atomic.id && atomic.contract ? atomic : { schemaVersion: "3.0", contract: "ContentMaster@3.0", id: atomic.content_master_id, ...atomic };
}

function validateStoredBootstrap(record, values = null) {
  const platforms = scopedPlatforms(record);
  if (!object(record) || record.schemaVersion !== "1.0" || record.contract !== STAGED_BOOTSTRAP_CONTRACT || !text(record.id)
    || !text(record.idempotencyKey) || !text(record.projectId) || !object(record._serverAuthority) || !object(record.planning)
    || (record.targetPlatform != null && !PLATFORMS.includes(record.targetPlatform))
    || !exactPlatformRefs(record.outlineRefs, platforms)
    || !HASH.test(record.bootstrapFact?.factHash || "") || !HASH.test(record.bootstrapFact?.authorityHash || "") || !HASH.test(record.bootstrapFact?.planningHash || "")
    || hashUnifiedContent(record._serverAuthority) !== record.bootstrapFact.authorityHash
    || hashUnifiedContent(record._serverAuthority.bindingRefs) !== hashUnifiedContent(record.authorityRefs)
    || !Array.isArray(record.planning?.invocations) || !Array.isArray(record.planning?.outputFacts)
    || !object(record.planning?.outputs) || !object(record.planning?.serverPlanning)) {
    bootstrapFail("UNIFIED_STAGED_ATOMIC_BOOTSTRAP_STORE_INVALID", ["$"]);
  }
  record.planning.invocations.forEach(validatePlanningInvocation);
  record.planning.outputFacts.forEach((fact) => validatePlanningOutputFact(fact, record.planning.invocations));
  if (!sameRefList(record.bootstrapFact.invocationRefs, refList(record.planning.invocations, "invocationHash"))
    || !sameRefList(record.bootstrapFact.outputFactRefs, refList(record.planning.outputFacts, "factHash"))) {
    bootstrapFail("UNIFIED_STAGED_ATOMIC_BOOTSTRAP_EVIDENCE_REF_MISMATCH", ["$.bootstrapFact"]);
  }
  const serverPlanningBase = clone(record.planning.serverPlanning); delete serverPlanningBase.planningHash;
  if (!HASH.test(record.planning.serverPlanning.planningHash || "")
    || hashUnifiedContent(serverPlanningBase) !== record.planning.serverPlanning.planningHash) {
    bootstrapFail("UNIFIED_STAGED_ATOMIC_SERVER_PLANNING_HASH_MISMATCH", ["$.planning.serverPlanning.planningHash"]);
  }
  const planningBase = {
    serverPlanning: clone(record.planning.serverPlanning), outputs: clone(record.planning.outputs),
    invocations: clone(record.planning.invocations), outputFacts: clone(record.planning.outputFacts)
  };
  if (hashUnifiedContent(planningBase) !== record.bootstrapFact.planningHash) {
    bootstrapFail("UNIFIED_STAGED_ATOMIC_PLANNING_HASH_MISMATCH", ["$.bootstrapFact.planningHash"]);
  }
  const formalMaster = normalizedFormalMaster(formalPlanningOutput(record.planning.outputFacts, "shared", "build-content-master"));
  platforms.forEach((platform) => formalPlanningOutput(record.planning.outputFacts, platform, "generate-content-outline"));
  const serverRuns = Object.fromEntries(platforms.map((platform) => [platform, record.planning.serverPlanning.platformRuns.find((item) => item.platform === platform)]));
  if (record.planning.serverPlanning.platformRuns.length !== platforms.length || platforms.some((platform) => !serverRuns[platform])) {
    bootstrapFail("UNIFIED_STAGED_ATOMIC_PLATFORM_SCOPE_MISMATCH", ["$.planning.serverPlanning.platformRuns"]);
  }
  const sharedRecord = record.planning.serverPlanning.sharedSkillRecords?.find((item) => item.capability === "build-content-master");
  const outlineRecords = Object.fromEntries(platforms.map((platform) => [platform, serverRuns[platform]?.skillRecords?.find((item) => item.stepId === "outline")]));
  if (record.structureIntent != null) {
    const structureIntent = validateContentStructureIntent(record.structureIntent);
    const expectedStructureIntentRef = { id: structureIntent.id, hash: structureIntent.intentHash };
    if (!sameRef(record.authorityRefs.structureIntentRef, expectedStructureIntentRef)) {
      bootstrapFail("UNIFIED_STAGED_ATOMIC_STRUCTURE_INTENT_AUTHORITY_MISMATCH", ["$.authorityRefs.structureIntentRef"]);
    }
    validateContentMasterSemanticSpine(record.planning.outputs.sharedContentMaster, structureIntent);
    platforms.forEach((platform) => validateContentOutlineSemanticMapping(record.planning.outputs[outlineKey(platform)], record.planning.outputs.sharedContentMaster));
  } else if (record.authorityRefs.structureIntentRef != null) {
    bootstrapFail("UNIFIED_STAGED_ATOMIC_STRUCTURE_INTENT_AUTHORITY_MISMATCH", ["$.authorityRefs.structureIntentRef"]);
  }
  if (hashUnifiedContent(record.planning.outputs.sharedContentMaster) !== hashUnifiedContent(formalMaster)
    || hashUnifiedContent(record.planning.outputs.sharedContentMaster) !== hashUnifiedContent(record.planning.serverPlanning.sharedContentMaster)
    || sharedRecord?.outputHash !== hashUnifiedContent(record.planning.outputs.sharedContentMaster)
    || platforms.some((platform) => hashUnifiedContent(record.planning.outputs[outlineKey(platform)]) !== hashUnifiedContent(serverRuns[platform]?.outline)
      || outlineRecords[platform]?.outputHash !== hashUnifiedContent(record.planning.outputs[outlineKey(platform)])
      || hashUnifiedContent(record.planning.outputs[outlineKey(platform)]) !== record.outlineRefs[platform].hash)) {
    bootstrapFail("UNIFIED_STAGED_ATOMIC_PLANNING_OUTPUT_CLOSURE_INVALID", ["$.planning.outputs"]);
  }
  const authorityOutline = record._serverAuthority?.orchestrationInput?.project?.platformInputs?.xiaohongshu?.confirmedOutline;
  const authorityOutlineRef = record._serverAuthority?.orchestrationInput?.project?.platformInputs?.xiaohongshu?.confirmedOutlineRef;
  if (authorityOutline != null && platforms.includes("xiaohongshu") && (hashUnifiedContent(authorityOutline) !== record.outlineRefs.xiaohongshu.hash
    || !sameRef(authorityOutlineRef, record.outlineRefs.xiaohongshu))) {
    bootstrapFail("UNIFIED_STAGED_ATOMIC_AUTHORITY_OUTLINE_CLOSURE_INVALID", ["$._serverAuthority.orchestrationInput.project.platformInputs.xiaohongshu"]);
  }
  const factBase = clone(record.bootstrapFact); delete factBase.factHash;
  if (hashUnifiedContent(factBase) !== record.bootstrapFact.factHash) bootstrapFail("UNIFIED_STAGED_ATOMIC_BOOTSTRAP_FACT_HASH_MISMATCH", ["$.bootstrapFact.factHash"]);
  const expectedBootstrapRef = { id: record.id, hash: hashUnifiedContent({ requestId: record.requestId, idempotencyKey: record.idempotencyKey }) };
  if (!sameRef(record.bootstrapFact.bootstrapRef, expectedBootstrapRef)) {
    bootstrapFail("UNIFIED_STAGED_ATOMIC_BOOTSTRAP_REF_INVALID", ["$.bootstrapFact.bootstrapRef"]);
  }
  if (record.supersedesBootstrapRef != null && !ref(record.supersedesBootstrapRef)) {
    bootstrapFail("UNIFIED_STAGED_ATOMIC_SUPERSEDES_BOOTSTRAP_INVALID", ["$.supersedesBootstrapRef"]);
  }
  if (record.supersedesBootstrapRef != null
    ? !sameRef(record.bootstrapFact.supersedesBootstrapRef, record.supersedesBootstrapRef)
    : Object.hasOwn(record.bootstrapFact, "supersedesBootstrapRef") && record.bootstrapFact.supersedesBootstrapRef !== null) {
    bootstrapFail("UNIFIED_STAGED_ATOMIC_SUPERSEDES_BOOTSTRAP_CLOSURE_INVALID", ["$.bootstrapFact.supersedesBootstrapRef"]);
  }
  if (values && record.supersedesBootstrapRef != null) resolveSupersededBootstrap(values, record);
  if (!["awaiting_outline_confirmation", "rejected", "confirmed", "completed"].includes(record.state)) bootstrapFail("UNIFIED_STAGED_ATOMIC_BOOTSTRAP_STATE_INVALID", ["$.state"]);
  if (record.state === "awaiting_outline_confirmation") {
    if (record.confirmation !== null || record.commitRefs !== null || record.materializationFact != null || record.reviewDecision != null) bootstrapFail("UNIFIED_STAGED_ATOMIC_BOOTSTRAP_STATE_INVALID", ["$.state"]);
  } else if (record.state === "rejected") {
    const decisionBase = clone(record.reviewDecision); delete decisionBase?.decisionHash;
    if (!object(record.reviewDecision) || record.reviewDecision.schemaVersion !== "1.0"
      || record.reviewDecision.contract !== OUTLINE_REVIEW_DECISION_CONTRACT || record.reviewDecision.id !== `outline-review-decision:${record.id}`
      || !exact(record.reviewDecision.actor, ["type", "id"]) || record.reviewDecision.actor.type !== "user"
      || !text(record.reviewDecision.actor.id) || !canonicalTime(record.reviewDecision.decidedAt)
      || !text(record.reviewDecision.reasonCode) || !text(record.reviewDecision.explanation)
      || !exactPlatformRefs(record.reviewDecision.outlineRefs, platforms)
      || platforms.some((platform) => !sameRef(record.reviewDecision.outlineRefs[platform], record.outlineRefs[platform]))
      || !sameRef(record.reviewDecision.rejectedBootstrapRef, record.bootstrapFact.bootstrapRef)
      || !HASH.test(record.reviewDecision.decisionHash || "")
      || hashUnifiedContent(decisionBase) !== record.reviewDecision.decisionHash
      || record.confirmation !== null || record.commitRefs !== null || record.materializationFact != null || record.completedAt != null) {
      bootstrapFail("UNIFIED_STAGED_ATOMIC_OUTLINE_REJECTION_CLOSURE_INVALID", ["$.reviewDecision"]);
    }
  } else {
    const confirmationBase = clone(record.confirmation); delete confirmationBase?.confirmationHash;
    if (!object(record.confirmation) || record.confirmation.actor?.type !== "user" || !text(record.confirmation.actor?.id)
      || !canonicalTime(record.confirmation.confirmedAt) || !HASH.test(record.confirmation.confirmationHash || "")
      || hashUnifiedContent(confirmationBase) !== record.confirmation.confirmationHash
      || !exactPlatformRefs(record.confirmation.outlineRefs, platforms)
      || platforms.some((platform) => !sameRef(record.confirmation.outlineRefs[platform], record.outlineRefs[platform]))) {
      bootstrapFail("UNIFIED_STAGED_ATOMIC_CONFIRMATION_CLOSURE_INVALID", ["$.confirmation"]);
    }
    if (record.state === "confirmed" && (record.commitRefs !== null || record.materializationFact != null)) bootstrapFail("UNIFIED_STAGED_ATOMIC_BOOTSTRAP_STATE_INVALID", ["$.state"]);
  }
  if (record.state === "completed") {
    if (record.targetPlatform) bootstrapFail("UNIFIED_STAGED_ATOMIC_SCOPED_GLOBAL_COMPLETION_FORBIDDEN", ["$.state"]);
    const materializationBase = clone(record.materializationFact); delete materializationBase?.factHash;
    const compatibleProductIds = new Set([record.projectId, `${record.projectId}:revision:${record.id}`]);
    if (!exact(record.commitRefs, ["xiaohongshu", "wechat"]) || !ref(record.commitRefs.xiaohongshu) || !ref(record.commitRefs.wechat)
      || !HASH.test(record.materializationFact?.factHash || "")
      || hashUnifiedContent(materializationBase) !== record.materializationFact.factHash
      || !compatibleProductIds.has(record.materializationFact.productRef?.id)
      || !sameRef(record.materializationFact.commitRefs?.xiaohongshu, record.commitRefs.xiaohongshu)
      || !sameRef(record.materializationFact.commitRefs?.wechat, record.commitRefs.wechat)
      || record.completedAt !== record.materializationFact.completedAt || !canonicalTime(record.completedAt)) {
      bootstrapFail("UNIFIED_STAGED_ATOMIC_MATERIALIZATION_FACT_INVALID", ["$.materializationFact"]);
    }
  }
  return record;
}

function storedAuthorityMatchesRef(value, expectedRef) {
  if (!object(value) || !ref(expectedRef)) return false;
  const ids = [value.id, value.snapshotId, value.requestId, value.idempotencyKey, value.content_master_id].filter(Boolean);
  const hashes = [
    value.hash, value.snapshotHash, value.decisionHash, value.opportunityHash, value.semanticHash,
    value.planHash, value.intentHash, value.factHash, hashUnifiedContent(value)
  ].filter(Boolean);
  return ids.includes(expectedRef.id) && hashes.includes(expectedRef.hash);
}

function resolveUniqueTargetAuthority(store, expectedRef, collectionNames = null) {
  const names = collectionNames || Object.keys(store || {}).filter((key) => Array.isArray(store[key]));
  const matches = names.flatMap((name) => (Array.isArray(store?.[name]) ? store[name] : []))
    .filter((item) => storedAuthorityMatchesRef(item, expectedRef));
  if (matches.length !== 1) {
    bootstrapFail("UNIFIED_STAGED_ATOMIC_RECONCILIATION_TARGET_AUTHORITY_REQUIRED", ["$.authorityRefs"]);
  }
  return matches[0];
}

function validateTargetAuthorityClosure(store, record, dependencies) {
  if (typeof dependencies.resolveTargetAuthority !== "function") {
    bootstrapFail("UNIFIED_STAGED_ATOMIC_RECONCILIATION_DOMAIN_AUTHORITY_RESOLVER_REQUIRED", ["$.authorityRefs"]);
  }
  const resolved = dependencies.resolveTargetAuthority(store, clone(record));
  if (!object(resolved) || hashUnifiedContent(resolved) !== record.bootstrapFact.authorityHash
    || hashUnifiedContent(resolved.bindingRefs) !== hashUnifiedContent(record.authorityRefs)) {
    bootstrapFail("UNIFIED_STAGED_ATOMIC_RECONCILIATION_TARGET_AUTHORITY_MISMATCH", ["$.authorityRefs"]);
  }
  return resolved;
}

function validateReconciliationReceipt(receipt, record = null) {
  const base = clone(receipt); delete base?.receiptHash;
  if (!object(receipt) || receipt.schemaVersion !== "1.0" || receipt.contract !== RECONCILIATION_RECEIPT_CONTRACT
    || !text(receipt.id) || !ref(receipt.sourceBootstrapRef) || !ref(receipt.targetBootstrapRef)
    || !sameRef(receipt.sourceBootstrapRef, receipt.targetBootstrapRef) || !HASH.test(receipt.sourceStoreHash || "")
    || !(typeof receipt.sourceRevision === "string" || Number.isSafeInteger(receipt.sourceRevision))
    || !exact(receipt.operator, ["type", "id"]) || receipt.operator.type !== "operator" || !text(receipt.operator.id)
    || !canonicalTime(receipt.reconciledAt) || !HASH.test(receipt.authorityHash || "") || !HASH.test(receipt.receiptHash || "")
    || hashUnifiedContent(base) !== receipt.receiptHash
    || (record && (!sameRef(receipt.targetBootstrapRef, record.bootstrapFact.bootstrapRef)
      || receipt.authorityHash !== record.bootstrapFact.authorityHash))) {
    bootstrapFail("UNIFIED_STAGED_ATOMIC_RECONCILIATION_RECEIPT_INVALID", ["$.reconciliationReceipt"]);
  }
  return receipt;
}

export function reconcileIsolatedPlanningSuccessor(targetStore, sourceStore, input, dependencies = {}) {
  if (!object(targetStore) || !object(sourceStore) || !exact(input, ["bootstrapId", "sourceRevision", "sourceStoreHash", "operator", "apply"])
    || !text(input.bootstrapId) || !HASH.test(input.sourceStoreHash || "")
    || !(typeof input.sourceRevision === "string" || Number.isSafeInteger(input.sourceRevision))
    || !exact(input.operator, ["type", "id"]) || input.operator.type !== "operator" || !text(input.operator.id)
    || typeof input.apply !== "boolean") {
    bootstrapFail("UNIFIED_STAGED_ATOMIC_RECONCILIATION_INPUT_INVALID", ["$"]);
  }
  const sourceValues = bootstrapCollection(sourceStore);
  const sourceMatches = sourceValues.filter((item) => item?.id === input.bootstrapId);
  if (sourceMatches.length !== 1) {
    bootstrapFail(sourceMatches.length ? "UNIFIED_STAGED_ATOMIC_RECONCILIATION_SOURCE_AMBIGUOUS" : "UNIFIED_STAGED_ATOMIC_BOOTSTRAP_NOT_FOUND", ["$.bootstrapId"]);
  }
  const sourceRecord = validateStoredBootstrap(sourceMatches[0], sourceValues);
  if (sourceRecord.state !== "awaiting_outline_confirmation" || sourceRecord.confirmation !== null
    || sourceRecord.reviewDecision != null || sourceRecord.commitRefs !== null
    || sourceRecord.materializationFact != null || sourceRecord.completedAt != null) {
    bootstrapFail("UNIFIED_STAGED_ATOMIC_RECONCILIATION_SOURCE_STATE_INVALID", ["$.state"]);
  }
  validateTargetAuthorityClosure(targetStore, sourceRecord, dependencies);
  const targetValues = bootstrapCollection(targetStore);
  const identityMatches = targetValues.filter((item) => item?.id === sourceRecord.id
    || item?.requestId === sourceRecord.requestId || item?.idempotencyKey === sourceRecord.idempotencyKey
    || sameRef(item?.bootstrapFact?.bootstrapRef, sourceRecord.bootstrapFact.bootstrapRef));
  const receipts = reconciliationReceiptCollection(targetStore);
  if (identityMatches.length) {
    if (identityMatches.length !== 1 || hashUnifiedContent(identityMatches[0]) !== hashUnifiedContent(sourceRecord)) {
      bootstrapFail("UNIFIED_STAGED_ATOMIC_RECONCILIATION_TARGET_CONFLICT", ["$.bootstrapId"]);
    }
    const receiptMatches = receipts.filter((item) => sameRef(item?.targetBootstrapRef, sourceRecord.bootstrapFact.bootstrapRef));
    if (receiptMatches.length !== 1) bootstrapFail("UNIFIED_STAGED_ATOMIC_RECONCILIATION_RECEIPT_AMBIGUOUS", ["$.reconciliationReceipt"]);
    const receipt = validateReconciliationReceipt(receiptMatches[0], sourceRecord);
    if (receipt.sourceStoreHash !== input.sourceStoreHash || receipt.sourceRevision !== input.sourceRevision) {
      bootstrapFail("UNIFIED_STAGED_ATOMIC_RECONCILIATION_RECEIPT_CONFLICT", ["$.reconciliationReceipt"]);
    }
    return deepFreeze({ applied: false, idempotent: true, bootstrap: publicBootstrap(sourceRecord), receipt: clone(receipt) });
  }
  if (receipts.some((item) => item?.id === `planning-successor-reconciliation:${sourceRecord.id}`
    || sameRef(item?.targetBootstrapRef, sourceRecord.bootstrapFact.bootstrapRef))) {
    bootstrapFail("UNIFIED_STAGED_ATOMIC_RECONCILIATION_RECEIPT_CONFLICT", ["$.reconciliationReceipt"]);
  }
  const reconciledAt = dependencies.now?.() || new Date().toISOString();
  if (!canonicalTime(reconciledAt)) bootstrapFail("UNIFIED_STAGED_ATOMIC_TIME_INVALID", ["$.reconciledAt"]);
  const receiptBase = {
    schemaVersion: "1.0", contract: RECONCILIATION_RECEIPT_CONTRACT,
    id: `planning-successor-reconciliation:${sourceRecord.id}`,
    sourceBootstrapRef: clone(sourceRecord.bootstrapFact.bootstrapRef), targetBootstrapRef: clone(sourceRecord.bootstrapFact.bootstrapRef),
    sourceRevision: input.sourceRevision, sourceStoreHash: input.sourceStoreHash,
    authorityHash: sourceRecord.bootstrapFact.authorityHash, operator: clone(input.operator), reconciledAt
  };
  const receipt = validateReconciliationReceipt({ ...receiptBase, receiptHash: hashUnifiedContent(receiptBase) }, sourceRecord);
  if (input.apply) {
    targetStore[BOOTSTRAP_COLLECTION] = [...targetValues.map(clone), clone(sourceRecord)];
    targetStore[RECONCILIATION_RECEIPT_COLLECTION] = [...receipts.map(clone), clone(receipt)];
  }
  return deepFreeze({ applied: input.apply, idempotent: false, bootstrap: publicBootstrap(sourceRecord), receipt: clone(receipt) });
}

export async function createUnifiedStagedAtomicDualBootstrap(store, input, dependencies = {}) {
  assertBootstrapFlag(dependencies);
  validateCreateRequest(input);
  const existing = bootstrapCollection(store).filter((item) => item.idempotencyKey === input.idempotencyKey || item.requestId === input.requestId);
  if (existing.length > 1) bootstrapFail("UNIFIED_STAGED_ATOMIC_BOOTSTRAP_AMBIGUOUS");
  if (existing.length === 1) {
    const record = validateStoredBootstrap(existing[0], bootstrapCollection(store));
    const expectedHash = hashUnifiedContent(input);
    if (record.createRequestHash !== expectedHash) bootstrapFail("UNIFIED_STAGED_ATOMIC_BOOTSTRAP_IDEMPOTENCY_CONFLICT", ["$.idempotencyKey"]);
    return { created: false, bootstrap: publicBootstrap(record) };
  }
  if (typeof dependencies.planBootstrap !== "function") {
    bootstrapFail("UNIFIED_STAGED_ATOMIC_SERVER_DEPENDENCIES_REQUIRED");
  }
  const superseded = resolveSupersededBootstrap(bootstrapCollection(store), input);
  if (superseded && (superseded.targetPlatform || null) !== (input.targetPlatform || null)) {
    bootstrapFail("UNIFIED_STAGED_ATOMIC_SUPERSEDED_PLATFORM_SCOPE_MISMATCH", ["$.supersedesBootstrapRef"]);
  }
  const authorityRefs = requestAuthorityRefs(input);
  const planned = await dependencies.planBootstrap(clone(input));
  const authority = planned?.authority;
  if (!object(authority) || hashUnifiedContent(authority.bindingRefs) !== hashUnifiedContent(authorityRefs)) {
    bootstrapFail("UNIFIED_STAGED_ATOMIC_AUTHORITY_RESOLUTION_MISMATCH", ["$.authorityRefs"]);
  }
  const authorityHash = hashUnifiedContent(authority);
  const bootstrapId = `staged-atomic-bootstrap-${hashUnifiedContent({ companyId: input.companyId, projectId: input.projectId, idempotencyKey: input.idempotencyKey }).slice(0, 32)}`;
  const platforms = scopedPlatforms(input);
  if (planned?.planning?.contract !== "UnifiedStagedContentPlanningResult@1.0" || !Array.isArray(planned.actualInvocations)
    || !Array.isArray(planned.outputFacts) || planned.actualInvocations.length !== planned.outputFacts.length) {
    bootstrapFail("UNIFIED_STAGED_ATOMIC_FORMAL_PLANNING_EVIDENCE_REQUIRED");
  }
  const platformRuns = Object.fromEntries(platforms.map((platform) => [platform, planned.planning.platformRuns.find((item) => item.platform === platform)]));
  if (!object(planned.planning.sharedContentMaster) || planned.planning.platformRuns.length !== platforms.length
    || platforms.some((platform) => !object(platformRuns[platform]?.outline))) {
    bootstrapFail("UNIFIED_STAGED_ATOMIC_PLANNING_OUTPUT_INVALID");
  }
  const outputs = {
    sharedContentMaster: clone(planned.planning.sharedContentMaster),
    ...Object.fromEntries(platforms.map((platform) => [outlineKey(platform), clone(platformRuns[platform].outline)]))
  };
  const invocations = clone(planned.actualInvocations);
  const outputFacts = clone(planned.outputFacts);
  const planningBase = { serverPlanning: clone(planned.planning), outputs: clone(outputs), invocations: clone(invocations), outputFacts: clone(outputFacts) };
  const planningHash = hashUnifiedContent(planningBase);
  const outlineRefs = Object.fromEntries(platforms.map((platform) => {
    const outline = outputs[outlineKey(platform)];
    return [platform, { id: outline.outline_id || outline.id, hash: hashUnifiedContent(outline) }];
  }));
  const createdAt = dependencies.now?.() || new Date().toISOString();
  if (!canonicalTime(createdAt)) bootstrapFail("UNIFIED_STAGED_ATOMIC_TIME_INVALID", ["$.createdAt"]);
  const factBase = {
    schemaVersion: "1.0", contract: STAGED_BOOTSTRAP_FACT_CONTRACT, id: `bootstrap-fact:${bootstrapId}`,
    bootstrapRef: { id: bootstrapId, hash: hashUnifiedContent({ requestId: input.requestId, idempotencyKey: input.idempotencyKey }) },
    authorityHash, planningHash, invocationRefs: invocations.map((item) => ({ id: item.id, hash: item.invocationHash })),
    outputFactRefs: outputFacts.map((item) => ({ id: item.id, hash: item.factHash })),
    supersedesBootstrapRef: clone(superseded?.bootstrapFact.bootstrapRef || null), createdAt
  };
  const record = deepFreeze({
    schemaVersion: "1.0", contract: STAGED_BOOTSTRAP_CONTRACT, id: bootstrapId, requestId: input.requestId,
    idempotencyKey: input.idempotencyKey, createRequestHash: hashUnifiedContent(input), companyId: input.companyId, projectId: input.projectId,
    ...(input.targetPlatform ? { targetPlatform: input.targetPlatform } : {}),
    supersedesBootstrapRef: clone(superseded?.bootstrapFact.bootstrapRef || null),
    topicIntent: clone(input.topicIntent), structureIntent: clone(input.structureIntent || null), authorityRefs, _serverAuthority: deepFreeze(clone(authority)),
    planning: { invocations, outputFacts, outputs, serverPlanning: clone(planned.planning) }, outlineRefs, state: "awaiting_outline_confirmation",
    confirmation: null, reviewDecision: null, commitRefs: null, bootstrapFact: { ...factBase, factHash: hashUnifiedContent(factBase) }, createdAt, completedAt: null
  });
  validateStoredBootstrap(record);
  store[BOOTSTRAP_COLLECTION] = [...bootstrapCollection(store).map(clone), clone(record)];
  return { created: true, bootstrap: publicBootstrap(record) };
}

export function confirmUnifiedStagedAtomicDualBootstrap(store, id, input, dependencies = {}) {
  assertBootstrapFlag(dependencies);
  assertNoCallerAuthority(input);
  if (!exact(input, ["actor", "confirmedAt", "outlineRefs"]) || !exact(input.actor, ["type", "id"])
    || input.actor.type !== "user" || !text(input.actor.id) || !canonicalTime(input.confirmedAt) || !object(input.outlineRefs)) {
    bootstrapFail("UNIFIED_STAGED_ATOMIC_OUTLINE_CONFIRMATION_INVALID", ["$"]);
  }
  const values = bootstrapCollection(store);
  const index = values.findIndex((item) => item.id === id);
  if (index < 0) bootstrapFail("UNIFIED_STAGED_ATOMIC_BOOTSTRAP_NOT_FOUND", ["$.id"]);
  const record = validateStoredBootstrap(values[index], values);
  const platforms = scopedPlatforms(record);
  if (!exactPlatformRefs(input.outlineRefs, platforms)) bootstrapFail("UNIFIED_STAGED_ATOMIC_OUTLINE_CONFIRMATION_INVALID", ["$.outlineRefs"]);
  if (record.state === "rejected") bootstrapFail("UNIFIED_STAGED_ATOMIC_BOOTSTRAP_REJECTED", ["$.state"]);
  if (platforms.some((platform) => !sameRef(record.outlineRefs[platform], input.outlineRefs[platform]))) {
    bootstrapFail("UNIFIED_STAGED_ATOMIC_OUTLINE_CONFIRMATION_STALE", ["$.outlineRefs"]);
  }
  const confirmation = deepFreeze({ actor: clone(input.actor), confirmedAt: input.confirmedAt, outlineRefs: clone(input.outlineRefs), confirmationHash: hashUnifiedContent(input) });
  if (record.confirmation) {
    if (hashUnifiedContent(record.confirmation) !== hashUnifiedContent(confirmation)) bootstrapFail("UNIFIED_STAGED_ATOMIC_OUTLINE_CONFIRMATION_CONFLICT");
    return { changed: false, bootstrap: publicBootstrap(record) };
  }
  if (record.state !== "awaiting_outline_confirmation") bootstrapFail("UNIFIED_STAGED_ATOMIC_OUTLINE_CONFIRMATION_STATE_INVALID");
  const updated = { ...clone(record), state: "confirmed", confirmation };
  store[BOOTSTRAP_COLLECTION] = values.map((item, itemIndex) => itemIndex === index ? updated : clone(item));
  return { changed: true, bootstrap: publicBootstrap(updated) };
}

/** Promote a verified offline XHS outline into a new planning successor.
 * This deliberately never calls a Provider and leaves the predecessor immutable.
 */
export function promoteConfirmedXhsOutlineSuccessor(store, input, dependencies = {}) {
  assertBootstrapFlag(dependencies);
  const authoritySafeInput = clone(input);
  delete authoritySafeInput.candidate;
  assertNoCallerAuthority(authoritySafeInput);
  if (!object(input) || !text(input.bootstrapId) || !object(input.candidate)
    || !exact(input.actor, ["type", "id"]) || input.actor.type !== "user" || !text(input.actor.id)
    || !canonicalTime(input.confirmedAt) || input.sourceRevision == null) {
    bootstrapFail("UNIFIED_STAGED_ATOMIC_XHS_PROMOTION_INPUT_INVALID", ["$"]);
  }
  const values = bootstrapCollection(store);
  const matches = values.filter((item) => item?.id === input.bootstrapId);
  if (matches.length !== 1) bootstrapFail("UNIFIED_STAGED_ATOMIC_BOOTSTRAP_NOT_FOUND", ["$.bootstrapId"]);
  const predecessor = validateStoredBootstrap(matches[0], values);
  if (predecessor.state !== "confirmed") bootstrapFail("UNIFIED_STAGED_ATOMIC_XHS_PROMOTION_PREDECESSOR_STATE_INVALID", ["$.bootstrapId"]);
  const candidate = clone(input.candidate);
  const outline = candidate.outline;
  if (candidate.candidateType !== "XHSOutlineReviewCandidate" || candidate.reviewStatus !== "awaiting_user_review"
    || candidate.bootstrapId !== predecessor.id || candidate.sourceRevision !== input.sourceRevision
    || !sameRef(candidate.sourceOutlineRef, predecessor.outlineRefs.xiaohongshu)
    || candidate.sourceMasterRef?.id !== predecessor.planning.outputs.sharedContentMaster?.id
    || candidate.sourceMasterRef?.hash !== hashUnifiedContent(predecessor.planning.outputs.sharedContentMaster)
    || !object(outline) || outline.platform !== "xiaohongshu" || outline.confirmation_required !== true
    || !text(outline.outline_id) || !Array.isArray(outline.sections) || outline.sections.length !== 6
    || candidate.outlineHash !== hashUnifiedContent(outline)) {
    bootstrapFail("UNIFIED_STAGED_ATOMIC_XHS_PROMOTION_CANDIDATE_STALE", ["$.candidate"]);
  }
  const successorId = `staged-atomic-bootstrap-${hashUnifiedContent({ predecessor: predecessor.id, candidate: candidate.outlineHash }).slice(0, 32)}`;
  const idem = `xhs-outline-promotion:${predecessor.id}:${candidate.outlineHash}`;
  const prior = values.filter((item) => item.id === successorId || item.idempotencyKey === idem);
  if (prior.length > 1) bootstrapFail("UNIFIED_STAGED_ATOMIC_XHS_PROMOTION_AMBIGUOUS");
  if (prior.length === 1) return { created: false, bootstrap: publicBootstrap(validateStoredBootstrap(prior[0], values)) };
  const planning = clone(predecessor.planning);
  const authority = clone(predecessor._serverAuthority);
  const xhsPlatformInput = authority?.orchestrationInput?.project?.platformInputs?.xiaohongshu;
  if (!object(authority?.orchestrationInput) || !object(authority.orchestrationInput.project)
    || !object(xhsPlatformInput)) {
    bootstrapFail("UNIFIED_STAGED_ATOMIC_XHS_PROMOTION_AUTHORITY_INVALID", ["$._serverAuthority.orchestrationInput.project.platformInputs.xiaohongshu"]);
  }
  authority.orchestrationInput.project.platformInputs.xiaohongshu = {
    ...xhsPlatformInput,
    confirmedOutline: clone(outline),
    confirmedOutlineRef: { id: outline.outline_id, hash: hashUnifiedContent(outline) }
  };
  planning.outputs.xiaohongshuOutline = outline;
  const run = planning.serverPlanning.platformRuns.find((item) => item.platform === "xiaohongshu");
  if (!run) bootstrapFail("UNIFIED_STAGED_ATOMIC_XHS_PROMOTION_PLANNING_INVALID");
  run.outline = clone(outline);
  const outlineRecord = run.skillRecords?.find((item) => item.stepId === "outline");
  if (outlineRecord) outlineRecord.outputHash = hashUnifiedContent(outline);
  const fact = planning.outputFacts.find((item) => item.platform === "xiaohongshu" && item.capability === "generate-content-outline");
  if (!fact) bootstrapFail("UNIFIED_STAGED_ATOMIC_XHS_PROMOTION_OUTPUT_FACT_MISSING");
  fact.runtimeOutput = clone(outline); fact.verifiedDomainOutput = clone(outline); fact.outputHash = hashUnifiedContent(fact.runtimeOutput);
  const factBase = clone(fact); delete factBase.factHash; fact.factHash = hashUnifiedContent(factBase);
  const serverPlanningBase = clone(planning.serverPlanning); delete serverPlanningBase.planningHash; planning.serverPlanning.planningHash = hashUnifiedContent(serverPlanningBase);
  const planningBase = { serverPlanning: planning.serverPlanning, outputs: planning.outputs, invocations: planning.invocations, outputFacts: planning.outputFacts };
  const createdAt = dependencies.now?.() || new Date().toISOString();
  if (!canonicalTime(createdAt)) bootstrapFail("UNIFIED_STAGED_ATOMIC_TIME_INVALID", ["$.createdAt"]);
  const outlineRefs = predecessor.targetPlatform === "xiaohongshu"
    ? { xiaohongshu: { id: outline.outline_id, hash: hashUnifiedContent(outline) } }
    : { xiaohongshu: { id: outline.outline_id, hash: hashUnifiedContent(outline) }, wechat: clone(predecessor.outlineRefs.wechat) };
  const supersedes = predecessor.bootstrapFact.bootstrapRef;
  const factBaseBootstrap = { ...clone(predecessor.bootstrapFact), id: `bootstrap-fact:${successorId}`, bootstrapRef: { id: successorId, hash: hashUnifiedContent({ requestId: `${predecessor.requestId}:xhs-promotion`, idempotencyKey: idem }) }, authorityHash: hashUnifiedContent(authority), planningHash: hashUnifiedContent(planningBase), invocationRefs: planning.invocations.map((item) => ({ id: item.id, hash: item.invocationHash })), outputFactRefs: planning.outputFacts.map((item) => ({ id: item.id, hash: item.factHash })), supersedesBootstrapRef: clone(supersedes), createdAt };
  delete factBaseBootstrap.factHash;
  const record = { ...clone(predecessor), id: successorId, requestId: `${predecessor.requestId}:xhs-promotion`, idempotencyKey: idem, createRequestHash: hashUnifiedContent({ bootstrapId: predecessor.id, candidateHash: candidate.outlineHash }), supersedesBootstrapRef: clone(supersedes), _serverAuthority: authority, planning, outlineRefs, state: "awaiting_outline_confirmation", confirmation: null, reviewDecision: null, commitRefs: null, bootstrapFact: { ...factBaseBootstrap, factHash: hashUnifiedContent(factBaseBootstrap) }, createdAt, completedAt: null };
  validateStoredBootstrap(record);
  store[BOOTSTRAP_COLLECTION] = [...values.map(clone), clone(record)];
  return { created: true, bootstrap: publicBootstrap(record) };
}

export function rejectUnifiedStagedAtomicDualBootstrap(store, id, input, dependencies = {}) {
  assertBootstrapFlag(dependencies);
  assertNoCallerAuthority(input);
  if (!exact(input, ["actor", "decidedAt", "outlineRefs", "reasonCode", "explanation"])
    || !exact(input.actor, ["type", "id"]) || input.actor.type !== "user" || !text(input.actor.id)
    || !canonicalTime(input.decidedAt) || !object(input.outlineRefs)
    || !text(input.reasonCode) || !text(input.explanation)) {
    bootstrapFail("UNIFIED_STAGED_ATOMIC_OUTLINE_REJECTION_INVALID", ["$"]);
  }
  const values = bootstrapCollection(store);
  const index = values.findIndex((item) => item.id === id);
  if (index < 0) bootstrapFail("UNIFIED_STAGED_ATOMIC_BOOTSTRAP_NOT_FOUND", ["$.id"]);
  const record = validateStoredBootstrap(values[index], values);
  const platforms = scopedPlatforms(record);
  if (!exactPlatformRefs(input.outlineRefs, platforms)) bootstrapFail("UNIFIED_STAGED_ATOMIC_OUTLINE_REJECTION_INVALID", ["$.outlineRefs"]);
  const decisionBase = {
    schemaVersion: "1.0", contract: OUTLINE_REVIEW_DECISION_CONTRACT, id: `outline-review-decision:${record.id}`,
    actor: clone(input.actor), decidedAt: input.decidedAt, outlineRefs: clone(input.outlineRefs),
    reasonCode: input.reasonCode, explanation: input.explanation,
    rejectedBootstrapRef: clone(record.bootstrapFact.bootstrapRef)
  };
  const reviewDecision = deepFreeze({ ...decisionBase, decisionHash: hashUnifiedContent(decisionBase) });
  if (record.state === "rejected") {
    if (record.reviewDecision?.decisionHash !== reviewDecision.decisionHash) bootstrapFail("UNIFIED_STAGED_ATOMIC_OUTLINE_REJECTION_CONFLICT");
    return { changed: false, bootstrap: publicBootstrap(record) };
  }
  if (record.state !== "awaiting_outline_confirmation") bootstrapFail("UNIFIED_STAGED_ATOMIC_OUTLINE_REJECTION_STATE_INVALID", ["$.state"]);
  if (platforms.some((platform) => !sameRef(record.outlineRefs[platform], input.outlineRefs[platform]))) {
    bootstrapFail("UNIFIED_STAGED_ATOMIC_OUTLINE_REJECTION_STALE", ["$.outlineRefs"]);
  }
  const updated = { ...clone(record), state: "rejected", reviewDecision };
  validateStoredBootstrap(updated, values);
  store[BOOTSTRAP_COLLECTION] = values.map((item, itemIndex) => itemIndex === index ? updated : clone(item));
  return { changed: true, bootstrap: publicBootstrap(updated) };
}

export async function resumeUnifiedStagedAtomicDualBootstrap(store, id, input = {}, dependencies = {}) {
  assertBootstrapFlag(dependencies);
  assertNoCallerAuthority(input);
  if (!exact(input, ["idempotencyKey"]) || !text(input.idempotencyKey)) bootstrapFail("UNIFIED_STAGED_ATOMIC_RESUME_INVALID", ["$"]);
  const values = bootstrapCollection(store);
  const index = values.findIndex((item) => item.id === id);
  if (index < 0) bootstrapFail("UNIFIED_STAGED_ATOMIC_BOOTSTRAP_NOT_FOUND", ["$.id"]);
  const record = validateStoredBootstrap(values[index], values);
  if (record.targetPlatform) bootstrapFail("UNIFIED_STAGED_ATOMIC_SCOPED_USE_PLATFORM_RESUME", ["$.targetPlatform"]);
  if (record.state === "rejected") bootstrapFail("UNIFIED_STAGED_ATOMIC_BOOTSTRAP_REJECTED", ["$.state"]);
  if (record.idempotencyKey !== input.idempotencyKey) bootstrapFail("UNIFIED_STAGED_ATOMIC_BOOTSTRAP_IDEMPOTENCY_CONFLICT", ["$.idempotencyKey"]);
  if (record.state === "completed") {
    const productId = record.materializationFact?.productRef?.id || record.projectId;
    const product = getUnifiedAtomicMultiplatformProduct(store, productId);
    if (!product || !sameRef(product.commitRefs.xiaohongshu, record.commitRefs.xiaohongshu) || !sameRef(product.commitRefs.wechat, record.commitRefs.wechat)) {
      bootstrapFail("UNIFIED_STAGED_ATOMIC_COMPLETED_STATE_INVALID");
    }
    return { created: false, bootstrap: publicBootstrap(record), product };
  }
  if (record.state !== "confirmed" || !record.confirmation
    || !sameRef(record.outlineRefs.xiaohongshu, record.confirmation.outlineRefs.xiaohongshu)
    || !sameRef(record.outlineRefs.wechat, record.confirmation.outlineRefs.wechat)) {
    bootstrapFail("UNIFIED_STAGED_ATOMIC_OUTLINES_NOT_CONFIRMED");
  }
  if (typeof dependencies.materializeBootstrapCommits !== "function") bootstrapFail("UNIFIED_STAGED_ATOMIC_SERVER_DEPENDENCIES_REQUIRED");
  const generated = await dependencies.materializeBootstrapCommits({
    bootstrapId: record.id, projectId: record.projectId, companyId: record.companyId, createdAt: record.createdAt,
    authority: clone(record._serverAuthority), authorityRefs: clone(record.authorityRefs), topicIntent: clone(record.topicIntent),
    planning: clone(record.planning.serverPlanning), sharedContentMaster: clone(record.planning.outputs.sharedContentMaster),
    outlines: { xiaohongshu: clone(record.planning.outputs.xiaohongshuOutline), wechat: clone(record.planning.outputs.wechatOutline) },
    confirmation: clone(record.confirmation)
  });
  const xhsCommit = clone(generated?.xiaohongshuCommit);
  const wechatCommit = clone(generated?.wechatCommit);
  validateUnifiedAtomicContentCommitV2(xhsCommit);
  validateUnifiedAtomicWechatContentCommit(wechatCommit);
  if (xhsCommit.companyId !== record.companyId || wechatCommit.companyId !== record.companyId
    || xhsCommit.accountId !== record.authorityRefs.accountRefs.xiaohongshu.id
    || wechatCommit.accountId !== record.authorityRefs.accountRefs.wechat.id) {
    bootstrapFail("UNIFIED_STAGED_ATOMIC_CROSS_ACCOUNT_COMMIT_FORBIDDEN", ["$.commit.accountId"]);
  }
  const prospective = clone(store);
  const prospectiveCommitStore = createUnifiedAtomicContentCommitStore(prospective);
  prospectiveCommitStore.append(xhsCommit);
  prospectiveCommitStore.append(wechatCommit);
  const product = getUnifiedAtomicMultiplatformProduct(prospective, xhsCommit.contentProjectIdentity.id);
  if (!product || product.platforms.wechat.state !== "materialized") bootstrapFail("UNIFIED_STAGED_ATOMIC_DUAL_AGGREGATION_FAILED");
  const completedAt = dependencies.now?.() || new Date().toISOString();
  if (!canonicalTime(completedAt)) bootstrapFail("UNIFIED_STAGED_ATOMIC_TIME_INVALID", ["$.completedAt"]);
  const materializationBase = {
    schemaVersion: "1.0", contract: "UnifiedStagedAtomicDualMaterializationFact@1.0",
    id: `staged-materialization:${record.id}`, productRef: { id: product.id, hash: product.aggregateHash },
    commitRefs: clone(product.commitRefs), completedAt
  };
  const updated = {
    ...clone(record), state: "completed", commitRefs: clone(product.commitRefs), completedAt,
    materializationFact: { ...materializationBase, factHash: hashUnifiedContent(materializationBase) }
  };
  prospective[BOOTSTRAP_COLLECTION] = prospective[BOOTSTRAP_COLLECTION].map((item, itemIndex) => itemIndex === index ? updated : item);
  // No validation below this point can throw: publish both collections as one in-memory transaction,
  // after which the Server performs its single durable persist.
  store.unifiedAtomicContentCommits = clone(prospective.unifiedAtomicContentCommits);
  store[BOOTSTRAP_COLLECTION] = clone(prospective[BOOTSTRAP_COLLECTION]);
  return { created: true, bootstrap: publicBootstrap(updated), product: deepFreeze(clone(product)) };
}

export async function resumeUnifiedStagedAtomicPlatform(store, id, platform, input = {}, dependencies = {}) {
  if (!["xiaohongshu", "wechat"].includes(platform)) fail("UNIFIED_STAGED_ATOMIC_PLATFORM_INVALID");
  if (!exact(input, ["idempotencyKey"]) || !text(input.idempotencyKey)) fail("UNIFIED_STAGED_ATOMIC_RESUME_INVALID", ["$"]);
  const values = bootstrapCollection(store);
  const index = values.findIndex((item) => item.id === id);
  if (index < 0) fail("UNIFIED_STAGED_ATOMIC_BOOTSTRAP_NOT_FOUND", ["$.id"]);
  const record = validateStoredBootstrap(values[index], values);
  if (record.targetPlatform && record.targetPlatform !== platform) fail("UNIFIED_STAGED_ATOMIC_PLATFORM_SCOPE_MISMATCH", ["$.platform"]);
  if (record.idempotencyKey !== input.idempotencyKey) fail("UNIFIED_STAGED_ATOMIC_BOOTSTRAP_IDEMPOTENCY_CONFLICT", ["$.idempotencyKey"]);
  const confirmation = (store.unifiedContentPlatformOutlineConfirmations || [])
    .find((fact) => fact.bootstrapId === id && fact.platform === platform
      && sameRef(fact.outlineRef, record.outlineRefs?.[platform]));
  if (!confirmation && record.state !== "confirmed") fail("UNIFIED_STAGED_ATOMIC_PLATFORM_OUTLINE_NOT_CONFIRMED", ["$.platform"]);
  store.unifiedPlatformProductionRuns ||= [];
  const runId = `platform-production-run:${id}:${platform}`;
  const prior = store.unifiedPlatformProductionRuns.find((run) => run.id === runId);
  if (prior?.state === "completed") return { created: false, run: clone(prior), commit: clone(prior.commit) };
  if (typeof dependencies.materializePlatformCommit !== "function") fail("UNIFIED_STAGED_ATOMIC_SERVER_DEPENDENCIES_REQUIRED");
  const generated = await dependencies.materializePlatformCommit({
    bootstrapId: id, projectId: record.projectId, companyId: record.companyId, createdAt: record.createdAt,
    authority: clone(record._serverAuthority), authorityRefs: clone(record.authorityRefs), topicIntent: clone(record.topicIntent),
    planning: clone(record.planning.serverPlanning), sharedContentMaster: clone(record.planning.outputs.sharedContentMaster),
    outlines: { [platform]: clone(record.planning.outputs[platform === "wechat" ? "wechatOutline" : "xiaohongshuOutline"]) },
    confirmation: clone(confirmation || record.confirmation), platform
  });
  const commit = clone(platform === "wechat" ? generated?.wechatCommit : generated?.xiaohongshuCommit);
  if (!commit) fail("UNIFIED_STAGED_ATOMIC_PLATFORM_COMMIT_MISSING");
  if (platform === "wechat") validateUnifiedAtomicWechatContentCommit(commit);
  else validateUnifiedAtomicContentCommitV2(commit);
  const run = deepFreeze({
    schemaVersion: "1.0", contract: "UnifiedPlatformProductionRun@1.0", id: runId,
    bootstrapId: id, projectId: record.projectId, companyId: record.companyId, platform,
    idempotencyKey: input.idempotencyKey, state: "completed", commitRef: commitRef(commit),
    commit, completedAt: new Date().toISOString()
  });
  const commitStore = createUnifiedAtomicContentCommitStore(store);
  commitStore.append(commit);
  store.unifiedPlatformProductionRuns = [...store.unifiedPlatformProductionRuns.filter((item) => item.id !== runId), clone(run)];
  return { created: true, run: clone(run), commit: clone(commit) };
}
