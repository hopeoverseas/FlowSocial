import { hashUnifiedContent } from "./unified-content-contracts.mjs";
import { stableHash } from "../image-providers/xhs-integrated-page/canonical.mjs";
import {
  validateUnifiedAtomicContentCommit,
  validateUnifiedAtomicContentCommitV2
} from "./unified-atomic-content-commit-store.mjs";
import { validateUnifiedAtomicWechatContentCommit } from "./unified-atomic-wechat-commit.mjs";

const CONTRACT = "UnifiedAtomicContentProductProjection@1.0";
const HASH = /^[a-f0-9]{64}$/;
const ROOT_KEYS = Object.freeze([
  "schemaVersion", "contract", "id", "companyId", "accountId", "commitRef", "refs", "materializedContentProject",
  "xiaohongshu", "wechatState", "wechat", "artifactState", "selected", "promoted", "deliveryReady", "published",
  "blockers", "reviewState", "projectionHash"
]);
const REVIEW_STATE_KEYS = Object.freeze([
  "artifactApproved", "editorialReviewPassed", "selected", "stale", "artifactReviewFactRef", "editorialReviewFactRef", "selectionFactRef"
]);
const REF_KEYS = Object.freeze([
  "contentProjectIdentityRef", "materializedContentProjectRef", "platformRunRef", "candidateRef", "assemblyFactRef",
  "assemblyOutputRef", "usageBindingRef", "postCopyRef", "finalTitleBindingRef", "carouselPlanRef", "visualAssetPlanRef"
]);
const XHS_KEYS = Object.freeze([
  "state", "platform", "accountId", "platformRunRef", "candidateRef", "title", "postCopy", "finalTitleBinding", "carouselPlan",
  "visualAssetPlan", "artifactState", "selected", "promoted", "deliveryReady", "published", "blockers"
]);

function fail(code, fieldPaths = []) {
  throw Object.assign(new Error(code), { code, statusCode: 409, details: { fieldPaths: [...new Set(fieldPaths)] } });
}

function object(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function exact(value, keys) {
  return object(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function text(value) {
  return typeof value === "string" && Boolean(value.trim());
}

function ref(value) {
  return exact(value, ["id", "hash"]) && text(value.id) && HASH.test(value.hash || "");
}

function sameRef(left, right) {
  return ref(left) && ref(right) && left.id === right.id && left.hash === right.hash;
}

function clone(value) {
  try { return structuredClone(value); }
  catch { fail("UNIFIED_ATOMIC_PRODUCT_PROJECTION_INVALID", ["$"]); }
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

function withoutHash(value) {
  const copy = clone(value);
  delete copy.projectionHash;
  delete copy.reviewState;
  copy.artifactState = "visual_artifacts_required";
  copy.selected = false;
  copy.promoted = false;
  copy.deliveryReady = false;
  copy.published = false;
  copy.blockers = ["visual_artifacts_required", "wechat_not_materialized", "user_selection_required", "promotion_required"];
  copy.xiaohongshu.artifactState = "visual_artifacts_required";
  copy.xiaohongshu.selected = false;
  copy.xiaohongshu.promoted = false;
  copy.xiaohongshu.deliveryReady = false;
  copy.xiaohongshu.published = false;
  copy.xiaohongshu.blockers = ["visual_artifacts_required", "user_selection_required", "promotion_required"];
  return copy;
}

function nullableRef(value) {
  return value === null || ref(value);
}

function component(commit, role) {
  const matches = commit.materializedComponents.filter((item) => item.role === role);
  if (matches.length !== 1) fail("UNIFIED_ATOMIC_PRODUCT_PROJECTION_COMPONENT_REQUIRED", [`$.materializedComponents.${role}`]);
  return matches[0].component;
}

function commitRef(commit) {
  return { id: commit.id, hash: commit.commitHash };
}

function candidateRef(commit) {
  return { id: commit.candidate.id, hash: commit.candidate.candidateHash };
}

function declaredRef(value, hashField) {
  return { id: value?.id, hash: value?.[hashField] };
}

function selfHashValid(value, hashField) {
  if (!object(value) || !text(value.id) || !HASH.test(value[hashField] || "")) return false;
  const copy = clone(value);
  delete copy[hashField];
  return hashUnifiedContent(copy) === value[hashField];
}

export function validateUnifiedAtomicContentProductProjection(value) {
  if (!exact(value, ROOT_KEYS)) fail("UNIFIED_ATOMIC_PRODUCT_PROJECTION_INVALID", ["$"]);
  if (value.schemaVersion !== "1.0" || value.contract !== CONTRACT || !text(value.id) || !text(value.companyId) || !text(value.accountId)) {
    fail("UNIFIED_ATOMIC_PRODUCT_PROJECTION_INVALID", ["$.schemaVersion", "$.contract", "$.id", "$.companyId", "$.accountId"]);
  }
  if (!ref(value.commitRef) || !exact(value.refs, REF_KEYS) || REF_KEYS.some((key) => !ref(value.refs[key]))) {
    fail("UNIFIED_ATOMIC_PRODUCT_PROJECTION_REFS_INVALID", ["$.commitRef", "$.refs"]);
  }
  const xhs = value.xiaohongshu;
  if (!exact(xhs, XHS_KEYS) || xhs.state !== "materialized" || xhs.platform !== "xiaohongshu" || xhs.accountId !== value.accountId
    || !sameRef(xhs.platformRunRef, value.refs.platformRunRef) || !sameRef(xhs.candidateRef, value.refs.candidateRef)
    || !text(xhs.title) || !selfHashValid(xhs.postCopy, "componentHash") || !selfHashValid(xhs.finalTitleBinding, "bindingHash")
    || !selfHashValid(xhs.carouselPlan, "componentHash") || !selfHashValid(xhs.visualAssetPlan, "componentHash")
    || xhs.title !== xhs.finalTitleBinding.title
    || !sameRef(declaredRef(xhs.postCopy, "componentHash"), value.refs.postCopyRef)
    || !sameRef(declaredRef(xhs.finalTitleBinding, "bindingHash"), value.refs.finalTitleBindingRef)
    || !sameRef(declaredRef(xhs.carouselPlan, "componentHash"), value.refs.carouselPlanRef)
    || !sameRef(declaredRef(xhs.visualAssetPlan, "componentHash"), value.refs.visualAssetPlanRef)
    || !["visual_artifacts_required", "selected", "promoted", "delivery_ready", "published"].includes(xhs.artifactState)
    || typeof xhs.selected !== "boolean" || typeof xhs.promoted !== "boolean" || typeof xhs.deliveryReady !== "boolean"
    || typeof xhs.published !== "boolean" || (xhs.published && !xhs.deliveryReady) || (xhs.deliveryReady && !xhs.promoted) || (xhs.promoted && !xhs.selected) || !Array.isArray(xhs.blockers)) {
    fail("UNIFIED_ATOMIC_PRODUCT_PROJECTION_XHS_INVALID", ["$.xiaohongshu"]);
  }
  if (value.wechatState !== "not_materialized" || !exact(value.wechat, ["state", "blocker"])
    || value.wechat.state !== "not_materialized" || value.wechat.blocker !== "wechat_not_materialized") {
    fail("UNIFIED_ATOMIC_PRODUCT_PROJECTION_WECHAT_INVALID", ["$.wechatState", "$.wechat"]);
  }
  if (!object(value.materializedContentProject) || value.materializedContentProject.id !== value.refs.materializedContentProjectRef.id
    || value.materializedContentProject.projectHash !== value.refs.materializedContentProjectRef.hash) {
    fail("UNIFIED_ATOMIC_PRODUCT_PROJECTION_PROJECT_INVALID", ["$.materializedContentProject"]);
  }
  if (!["visual_artifacts_required", "selected", "promoted", "delivery_ready", "published"].includes(value.artifactState)
    || typeof value.selected !== "boolean" || typeof value.promoted !== "boolean" || typeof value.deliveryReady !== "boolean"
    || typeof value.published !== "boolean" || (value.published && !value.deliveryReady) || (value.deliveryReady && !value.promoted) || (value.promoted && !value.selected)
    || value.artifactState !== xhs.artifactState || value.selected !== xhs.selected || value.promoted !== xhs.promoted
    || value.deliveryReady !== xhs.deliveryReady || value.published !== xhs.published
    || !Array.isArray(value.blockers) || !value.blockers.includes("wechat_not_materialized")) {
    fail("UNIFIED_ATOMIC_PRODUCT_PROJECTION_STATE_INVALID", ["$.artifactState", "$.blockers"]);
  }
  if (!exact(value.reviewState, REVIEW_STATE_KEYS)
    || ["artifactApproved", "editorialReviewPassed", "selected", "stale"].some((key) => typeof value.reviewState[key] !== "boolean")
    || !nullableRef(value.reviewState.artifactReviewFactRef) || !nullableRef(value.reviewState.editorialReviewFactRef)
    || !nullableRef(value.reviewState.selectionFactRef)) {
    fail("UNIFIED_ATOMIC_PRODUCT_PROJECTION_REVIEW_STATE_INVALID", ["$.reviewState"]);
  }
  if (!HASH.test(value.projectionHash || "") || hashUnifiedContent(withoutHash(value)) !== value.projectionHash) {
    fail("UNIFIED_ATOMIC_PRODUCT_PROJECTION_HASH_MISMATCH", ["$.projectionHash"]);
  }
  return value;
}

export function projectUnifiedAtomicContentCommit(commitInput) {
  const commit = deepFreeze(clone(commitInput));
  try { validateUnifiedAtomicContentCommitV2(commit); }
  catch { fail("UNIFIED_ATOMIC_PRODUCT_PROJECTION_COMMIT_INVALID", ["$.commit"]); }
  const postCopy = component(commit, "postCopy");
  const finalTitle = component(commit, "finalTitleBinding");
  const carouselPlan = component(commit, "carouselPlan");
  const visualAssetPlan = component(commit, "visualAssetPlan");
  const blockers = ["visual_artifacts_required", "wechat_not_materialized", "user_selection_required", "promotion_required"];
  const refs = {
    contentProjectIdentityRef: { id: commit.contentProjectIdentity.id, hash: commit.contentProjectIdentity.identityHash },
    materializedContentProjectRef: clone(commit.materializedContentProjectRef),
    platformRunRef: clone(commit.platformRunRef),
    candidateRef: candidateRef(commit),
    assemblyFactRef: { id: commit.assemblyFact.id, hash: commit.assemblyFact.factHash },
    assemblyOutputRef: { id: commit.assemblyOutput.id, hash: commit.assemblyOutput.packageHash },
    usageBindingRef: { id: commit.usageBinding.id, hash: commit.usageBinding.bindingHash },
    postCopyRef: declaredRef(postCopy, "componentHash"), finalTitleBindingRef: declaredRef(finalTitle, "bindingHash"),
    carouselPlanRef: declaredRef(carouselPlan, "componentHash"), visualAssetPlanRef: declaredRef(visualAssetPlan, "componentHash")
  };
  const draft = {
    schemaVersion: "1.0", contract: CONTRACT, id: commit.materializedContentProjectRef.id,
    companyId: commit.companyId, accountId: commit.accountId, commitRef: commitRef(commit), refs,
    materializedContentProject: clone(commit.contentProject),
    xiaohongshu: {
      state: "materialized", platform: "xiaohongshu", accountId: commit.accountId,
      platformRunRef: clone(commit.platformRunRef), candidateRef: candidateRef(commit), title: finalTitle.title,
      postCopy: clone(postCopy), finalTitleBinding: clone(finalTitle), carouselPlan: clone(carouselPlan), visualAssetPlan: clone(visualAssetPlan),
      artifactState: "visual_artifacts_required", selected: false, promoted: false, deliveryReady: false, published: false,
      blockers: ["visual_artifacts_required", "user_selection_required", "promotion_required"]
    },
    wechatState: "not_materialized", wechat: { state: "not_materialized", blocker: "wechat_not_materialized" },
    artifactState: "visual_artifacts_required", selected: false, promoted: false, deliveryReady: false, published: false,
    blockers,
    reviewState: { artifactApproved: false, editorialReviewPassed: false, selected: false, stale: false, artifactReviewFactRef: null, editorialReviewFactRef: null, selectionFactRef: null }
  };
  const authorityDraft = clone(draft); delete authorityDraft.reviewState;
  const projection = deepFreeze({ ...draft, projectionHash: hashUnifiedContent(authorityDraft) });
  validateUnifiedAtomicContentProductProjection(projection);
  return projection;
}

function storedFactRef(value) {
  return { id: value.id, hash: value.factHash };
}

function sameStoredScope(value, projection) {
  return (!value?.companyId || value.companyId === projection.companyId)
    && (!value?.accountId || value.accountId === projection.accountId)
    && (!value?.platform || value.platform === "xiaohongshu")
    && sameRef(value?.contentProjectRef, projection.refs.contentProjectIdentityRef)
    && sameRef(value.materializedContentProjectRef, projection.refs.materializedContentProjectRef)
    && sameRef(value.platformRunRef, projection.refs.platformRunRef) && sameRef(value.candidateRef, projection.refs.candidateRef);
}

function validStoredFact(value, contract) {
  if (value?.contract !== contract || !ref({ id: value?.id, hash: value?.factHash })) return false;
  const copy = clone(value); delete copy.factHash;
  return hashUnifiedContent(copy) === value.factHash;
}

function validStableStoredFact(value, contract) {
  if (value?.contract !== contract || !ref({ id: value?.id, hash: value?.factHash })) return false;
  const copy = clone(value); delete copy.factHash;
  return stableHash(copy) === value.factHash;
}

function latestPageRevisionRefs(store, projection) {
  const byPage = new Map();
  for (const fact of store.unifiedContentXhsPageRevisionFacts || []) {
    if (sameStoredScope(fact, projection) && text(fact.pageId) && ref({ id: fact.id, hash: fact.revisionHash })) byPage.set(fact.pageId, { id: fact.id, hash: fact.revisionHash });
  }
  return [...byPage.values()];
}

function sameRefSet(left, right) {
  return Array.isArray(left) && Array.isArray(right) && left.length === right.length
    && left.every((item) => right.some((other) => sameRef(item, other)));
}

function projectStoredHumanReviewState(store, projection) {
  const reviews = (store.unifiedContentReviews || []).filter((item) => validStoredFact(item, "UnifiedAtomicXhsContentReviewFact@1.0") && sameStoredScope(item, projection));
  const selections = (store.unifiedContentSelections || []).filter((item) => validStoredFact(item, "UnifiedAtomicXhsSelectionFact@1.0") && sameStoredScope(item, projection));
  const latestReview = reviews.at(-1) || null;
  const currentRevisions = latestPageRevisionRefs(store, projection);
  const actions = (store.unifiedContentArtifactReviewActions || []).filter((item) => sameStoredScope(item, projection) && validStoredFact(item, "UnifiedArtifactReviewActionFact@1.0"));
  const visualReviews = (store.unifiedContentXhsVisualReviewFacts || []).filter((item) => sameStoredScope(item, projection) && validStableStoredFact(item, "UnifiedXhsVisualReviewFact@1.0"));
  const reviewCurrent = Boolean(latestReview && latestReview.state === "editorial_review_passed"
    && sameRefSet(latestReview.pageRevisionRefs, currentRevisions)
    && latestReview.artifactActionSetHash === hashUnifiedContent(actions.map(storedFactRef))
    && sameRef(latestReview.visualReviewFactRef, visualReviews.length ? storedFactRef(visualReviews.at(-1)) : null));
  const latestSelection = selections.at(-1) || null;
  const selectionCurrent = Boolean(reviewCurrent && latestSelection
    && sameRef(latestSelection.reviewFactRef, storedFactRef(latestReview))
    && latestSelection.artifactStateHash === latestReview.artifactStateHash
    && latestSelection.artifactActionSetHash === latestReview.artifactActionSetHash
    && sameRefSet(latestSelection.pageRevisionRefs, latestReview.pageRevisionRefs));
  return {
    artifactApproved: reviewCurrent,
    editorialReviewPassed: reviewCurrent,
    selected: selectionCurrent && latestSelection.status === "selected",
    stale: Boolean((reviews.length && !reviewCurrent) || (selections.length && !selectionCurrent)),
    artifactReviewFactRef: reviewCurrent ? clone(latestReview.artifactReviewActionRef) : null,
    editorialReviewFactRef: reviewCurrent ? storedFactRef(latestReview) : null,
    selectionFactRef: selectionCurrent ? storedFactRef(latestSelection) : null
  };
}

function withStoredHumanReviewState(store, projection) {
  const reviewState = projectStoredHumanReviewState(store, projection);
  const promotions = (store.contentPromotions || []).filter((item) => {
    if (item?.contract !== "AtomicXhsPromotionRecord@1.0" || item.platformPublicationPerformed !== false
      || !sameStoredScope(item, projection) || !sameRef(item.selectionRef, reviewState.selectionFactRef)) return false;
    const copy = clone(item); delete copy.promotionHash;
    return ref({ id: item.id, hash: item.promotionHash }) && hashUnifiedContent(copy) === item.promotionHash;
  });
  const promotion = promotions.at(-1) || null;
  const version = promotion ? (store.contentVersions || []).find((item) => {
    if (item?.contract !== "AtomicXhsImmutableContentVersion@1.0"
      || !sameRef({ id: item.id, hash: item.versionHash }, promotion.promotedVersionRef)
      || !sameStoredScope(item, projection)) return false;
    const copy = clone(item); delete copy.versionHash;
    return hashUnifiedContent(copy) === item.versionHash;
  }) : null;
  const deliveries = (store.unifiedAtomicXhsDeliveries || []).filter((item) => {
    if (item?.contract !== "AtomicXhsFinalDeliveryRecord@1.0" || item.deliveryReady !== true || item.platformPublicationPerformed !== false
      || !promotion || !version || !sameStoredScope(item, projection)
      || !sameRef(item.promotionRef, { id: promotion.id, hash: promotion.promotionHash })
      || !sameRef(item.promotedVersionRef, promotion.promotedVersionRef)) return false;
    const copy = clone(item); delete copy.deliveryHash;
    return ref({ id: item.id, hash: item.deliveryHash }) && hashUnifiedContent(copy) === item.deliveryHash;
  });
  const promoted = Boolean(reviewState.selected && promotion && version);
  const deliveryReady = Boolean(promoted && deliveries.length);
  const delivery = deliveryReady ? deliveries.at(-1) : null;
  const publications = (store.unifiedAtomicManualPublications || []).filter((item) => {
    if (item?.contract !== "ControlledManualPublication@1.0" || item.schemaVersion !== "1.0" || item.immutable !== true
      || item.actorType !== "user" || item.method !== "manual_platform_observation"
      || item.claims?.platformApiPublicationPerformed !== false || item.claims?.humanPublicationConfirmed !== true
      || !delivery || !sameStoredScope(item, projection)
      || !sameRef(item.promotionRef, { id: promotion.id, hash: promotion.promotionHash })
      || !sameRef(item.promotedVersionRef, promotion.promotedVersionRef)
      || !sameRef(item.deliveryRef, { id: delivery.id, hash: delivery.deliveryHash })
      || !sameRef(item.manifestRef, delivery.manifestRef)) return false;
    const copy = clone(item); delete copy.factHash;
    return ref({ id: item.id, hash: item.factHash }) && hashUnifiedContent(copy) === item.factHash;
  });
  const published = Boolean(deliveryReady && publications.length);
  const artifactState = published ? "published" : deliveryReady ? "delivery_ready" : promoted ? "promoted" : reviewState.selected ? "selected" : "visual_artifacts_required";
  const xhsBlockers = [
    ...(!reviewState.selected ? ["user_selection_required"] : []),
    ...(!promoted ? ["promotion_required"] : []),
    ...(promoted && !deliveryReady ? ["final_delivery_required"] : [])
  ];
  const value = deepFreeze({
    ...clone(projection), artifactState, selected: reviewState.selected, promoted, deliveryReady, published,
    blockers: [...xhsBlockers, "wechat_not_materialized"], reviewState,
    xiaohongshu: { ...clone(projection.xiaohongshu), artifactState, selected: reviewState.selected, promoted, deliveryReady, published, blockers: xhsBlockers }
  });
  validateUnifiedAtomicContentProductProjection(value);
  return value;
}

function validatedMaterializedCommits(store) {
  const values = store?.unifiedAtomicContentCommits;
  if (values === undefined) return [];
  if (!Array.isArray(values)) fail("UNIFIED_ATOMIC_PRODUCT_COMMIT_STORE_INVALID", ["store.unifiedAtomicContentCommits"]);
  for (let index = 0; index < values.length; index += 1) {
    const item = values[index];
    try {
      if (item?.schemaVersion === "2.0" && item?.contract === "UnifiedAtomicContentCommit@2.0") validateUnifiedAtomicContentCommitV2(item);
      else if (item?.schemaVersion === "1.0" && item?.contract === "UnifiedAtomicWechatContentCommit@1.0") validateUnifiedAtomicWechatContentCommit(item);
      else validateUnifiedAtomicContentCommit(item);
    } catch {
      fail("UNIFIED_ATOMIC_PRODUCT_COMMIT_STORE_INVALID", [`store.unifiedAtomicContentCommits[${index}]`]);
    }
  }
  return values.filter((item) => item.schemaVersion === "2.0" && item.contract === "UnifiedAtomicContentCommit@2.0");
}

function legacyIdentities(store) {
  const projects = store?.unifiedContentProjects;
  if (projects === undefined) return new Set();
  if (!Array.isArray(projects)) fail("UNIFIED_ATOMIC_PRODUCT_LEGACY_STORE_INVALID", ["store.unifiedContentProjects"]);
  return new Set(projects.flatMap((item) => [item?.id, item?.contentProject?.id]).filter(text));
}

function assertNoProjectionCollisions(store, projections) {
  const legacy = legacyIdentities(store);
  const seen = new Set();
  for (const projection of projections) {
    if (seen.has(projection.id) || legacy.has(projection.id)) fail("UNIFIED_ATOMIC_PRODUCT_ID_COLLISION", ["$.id"]);
    seen.add(projection.id);
  }
}

export function assertUnifiedAtomicProductProjectionAppendable(store, projection) {
  validateUnifiedAtomicContentProductProjection(projection);
  const legacy = legacyIdentities(store);
  if (legacy.has(projection.id)) fail("UNIFIED_ATOMIC_PRODUCT_ID_COLLISION", ["$.id"]);
  const existing = validatedMaterializedCommits(store).map(projectUnifiedAtomicContentCommit);
  assertNoProjectionCollisions(store, existing);
  const identityMatches = existing.filter((item) => item.id === projection.id);
  if (identityMatches.length > 1) fail("UNIFIED_ATOMIC_PRODUCT_ID_COLLISION", ["$.id"]);
  if (identityMatches.length === 1 && (!sameRef(identityMatches[0].commitRef, projection.commitRef)
    || identityMatches[0].projectionHash !== projection.projectionHash)) {
    fail("UNIFIED_ATOMIC_PRODUCT_ID_COLLISION", ["$.id", "$.commitRef"]);
  }
  return projection;
}

export function listUnifiedAtomicContentProductProjections(store, filters = {}) {
  const projections = validatedMaterializedCommits(store).map(projectUnifiedAtomicContentCommit);
  assertNoProjectionCollisions(store, projections);
  return deepFreeze(projections.filter((item) => (!filters.companyId || item.companyId === filters.companyId)
    && (!filters.accountId || item.accountId === filters.accountId)).map((item) => clone(withStoredHumanReviewState(store, item))));
}

export function getUnifiedAtomicContentProductProjection(store, id) {
  if (!text(id)) return null;
  const projections = validatedMaterializedCommits(store).map(projectUnifiedAtomicContentCommit);
  assertNoProjectionCollisions(store, projections);
  const matches = projections.filter((item) => item.id === id || item.commitRef.id === id || item.commitRef.hash === id || item.refs.candidateRef.id === id || item.refs.candidateRef.hash === id);
  if (matches.length > 1) fail("UNIFIED_ATOMIC_PRODUCT_ID_COLLISION", ["id"]);
  return matches.length === 1 ? withStoredHumanReviewState(store, matches[0]) : null;
}
