import {
  UNIFIED_CONTENT_CONTRACTS,
  hashUnifiedContent,
  validateContentProject,
  validatePlatformRunRef,
  validateUserSelection,
  withUnifiedContentHash
} from "./unified-content-contracts.mjs";

export const CONTENT_SET_REVIEW_CONTRACTS = Object.freeze({
  editorialSetReview: "EditorialSetReview@1.0",
  userSelectionEvent: "UserSelectionEvent@1.0",
  userSelectionGate: "UserSelectionGate@1.0"
});

export const CONTENT_SET_REVIEW_DIMENSIONS = Object.freeze([
  "page_necessity",
  "sequence_continuity",
  "visual_consistency",
  "copy_visual_complementarity",
  "information_density",
  "click_conversion_value"
]);

const PLATFORMS = new Set(["xiaohongshu", "wechat"]);
const HASH = /^[a-f0-9]{64}$/;

function fail(code, detail = "") {
  throw Object.assign(new Error(`${code}${detail ? `: ${detail}` : ""}`), { code });
}

function text(value, code) {
  if (typeof value !== "string" || !value.trim()) fail(code);
}

function hash(value, code) {
  if (typeof value !== "string" || !HASH.test(value)) fail(code);
}

function ref(value, code) {
  if (!value || Object.keys(value).sort().join(",") !== "hash,id") fail(`${code}:FIELDS`);
  text(value.id, `${code}:ID`);
  hash(value.hash, `${code}:HASH`);
}

function refIdentity(value, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${code}:OBJECT`);
  text(value.id, `${code}:ID`);
  hash(value.hash, `${code}:HASH`);
}

function sameRef(left, right) {
  return Boolean(left && right && left.id === right.id && left.hash === right.hash);
}

function clone(value) {
  return structuredClone(value);
}

function iso(value, code) {
  text(value, code);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) || Number.isNaN(Date.parse(value))) fail(code);
}

function projectRef(project) {
  return { id: project.id, hash: project.projectHash };
}

function runRef(run) {
  return { id: run.id, hash: run.hash };
}

function reviewRef(review) {
  return { id: review.id, hash: review.reviewHash };
}

function assertProjectRun(contentProject, platformRun) {
  validateContentProject(contentProject);
  validatePlatformRunRef(platformRun);
  const boundRun = contentProject.platformRuns.find((item) => sameRef(runRef(item), runRef(platformRun)));
  if (!boundRun) fail("CONTENT_SET_REVIEW:RUN_NOT_IN_PROJECT");
  if (!sameRef(contentProject.sharedContentMasterRef, platformRun.sharedContentMasterRef)) fail("CONTENT_SET_REVIEW:MASTER_MISMATCH");
}

function assertCandidate(candidateSet, platformRun) {
  if (!candidateSet || typeof candidateSet !== "object" || Array.isArray(candidateSet)) fail("CONTENT_SET_REVIEW:CANDIDATE_OBJECT");
  if (!PLATFORMS.has(candidateSet.platform) || candidateSet.platform !== platformRun.platform) fail("CONTENT_SET_REVIEW:CANDIDATE_PLATFORM_MISMATCH");
  ref(candidateSet.candidateRef, "CONTENT_SET_REVIEW:CANDIDATE_REF");
  if (!platformRun.candidateRefs.some((item) => sameRef(item, candidateSet.candidateRef))) fail("CONTENT_SET_REVIEW:CANDIDATE_NOT_IN_RUN");
  ref(candidateSet.titleRef, "CONTENT_SET_REVIEW:TITLE_REF");
  ref(candidateSet.bodyVersionRef, "CONTENT_SET_REVIEW:BODY_REF");
  if (!Array.isArray(candidateSet.pageRevisionRefs)) fail("CONTENT_SET_REVIEW:PAGE_REFS_ARRAY");
  candidateSet.pageRevisionRefs.forEach((item) => ref(item, "CONTENT_SET_REVIEW:PAGE_REF"));
  if (!Array.isArray(candidateSet.items) || !candidateSet.items.length) fail("CONTENT_SET_REVIEW:ITEMS_REQUIRED");
  if (candidateSet.platform === "xiaohongshu" && !candidateSet.pageRevisionRefs.length) fail("CONTENT_SET_REVIEW:XHS_PAGE_REFS_REQUIRED");
  if (candidateSet.platform === "wechat") {
    ref(candidateSet.articleRef, "CONTENT_SET_REVIEW:ARTICLE_REF");
    ref(candidateSet.imagePlanRef, "CONTENT_SET_REVIEW:IMAGE_PLAN_REF");
  }
}

function dimension(id, passed, evidence, findingCode, recoveryStage) {
  return {
    id,
    status: passed ? "passed" : "failed",
    evidence,
    findingCode: passed ? null : findingCode,
    recoveryStage: passed ? null : recoveryStage
  };
}

function evaluateDimensions(candidateSet) {
  const items = candidateSet.items;
  const purposes = items.map((item) => item.purpose).filter(Boolean);
  const duplicatePurposes = [...new Set(purposes.filter((purpose, index) => purposes.indexOf(purpose) !== index))].sort();
  const redundantIds = items.filter((item) => item.necessity === "redundant" || item.necessary === false).map((item) => item.id).sort();
  const necessity = dimension("page_necessity", !redundantIds.length && !duplicatePurposes.length, { redundantIds, duplicatePurposes }, "SET_REDUNDANT_ITEM", "outline");

  const ordered = [...items].sort((left, right) => left.order - right.order);
  const sequenceBreakIds = ordered.filter((item, index) => !Number.isInteger(item.order) || item.order !== index + 1 || (index > 0 && item.continuityFromPrevious !== true)).map((item) => item.id).sort();
  const sequence = dimension("sequence_continuity", !sequenceBreakIds.length, { orderedIds: ordered.map((item) => item.id), sequenceBreakIds }, "SET_SEQUENCE_DISCONTINUITY", "outline");

  const styles = [...new Set(items.map((item) => item.visualStyleHash).filter(Boolean))].sort();
  const styleMissingIds = items.filter((item) => !item.visualStyleHash).map((item) => item.id).sort();
  const visual = dimension("visual_consistency", styles.length === 1 && !styleMissingIds.length, { visualStyleHashes: styles, styleMissingIds }, "SET_VISUAL_STYLE_DRIFT", "review_render");

  const complementarityFailures = items.filter((item) => item.copyVisualRelationship !== "complementary").map((item) => item.id).sort();
  const complementarity = dimension("copy_visual_complementarity", !complementarityFailures.length, { failedItemIds: complementarityFailures }, "SET_COPY_VISUAL_DISCONNECTED", "writer");

  const densityFailures = items.filter((item) => typeof item.informationDensity !== "number" || item.informationDensity < 0.2 || item.informationDensity > 0.85).map((item) => item.id).sort();
  const density = dimension("information_density", !densityFailures.length, { acceptedRange: [0.2, 0.85], failedItemIds: densityFailures }, "SET_INFORMATION_DENSITY_INVALID", "writer");

  const clickTotal = items.reduce((sum, item) => sum + (Number.isFinite(item.clickValue) ? item.clickValue : 0), 0);
  const conversionTotal = items.reduce((sum, item) => sum + (Number.isFinite(item.conversionValue) ? item.conversionValue : 0), 0);
  const value = dimension("click_conversion_value", clickTotal > 0 && conversionTotal > 0, { clickValue: clickTotal, conversionValue: conversionTotal }, "SET_CONVERSION_VALUE_MISSING", "writer");
  return [necessity, sequence, visual, complementarity, density, value];
}

export function validateEditorialSetReview(review, bindings = {}) {
  if (!review || review.contract !== CONTENT_SET_REVIEW_CONTRACTS.editorialSetReview || review.schemaVersion !== "1.0") fail("EditorialSetReview:VERSION");
  for (const item of [review.contentProjectRef, review.platformRunRef, review.candidateRef, review.machineGateRef]) ref(item, "EditorialSetReview:REF");
  refIdentity(review.sharedContentMasterRef, "EditorialSetReview:MASTER_REF");
  if (!PLATFORMS.has(review.platform)) fail("EditorialSetReview:PLATFORM");
  if (!Array.isArray(review.dimensions) || review.dimensions.map((item) => item.id).join(",") !== CONTENT_SET_REVIEW_DIMENSIONS.join(",")) fail("EditorialSetReview:DIMENSIONS");
  const failed = review.dimensions.filter((item) => item.status !== "passed");
  if ((failed.length === 0) !== (review.status === "passed")) fail("EditorialSetReview:STATUS_INCONSISTENT");
  if (review.status === "passed" && review.targetRecoveryStage !== null) fail("EditorialSetReview:RECOVERY_INCONSISTENT");
  if (review.status === "changes_required" && !review.targetRecoveryStage) fail("EditorialSetReview:RECOVERY_REQUIRED");
  iso(review.reviewedAt, "EditorialSetReview:REVIEWED_AT");
  hash(review.reviewHash, "EditorialSetReview:HASH");
  const unhashed = clone(review); delete unhashed.reviewHash;
  if (hashUnifiedContent(unhashed) !== review.reviewHash) fail("EditorialSetReview:HASH_MISMATCH");
  if (bindings.contentProject && !sameRef(review.contentProjectRef, projectRef(bindings.contentProject))) fail("EditorialSetReview:PROJECT_MISMATCH");
  if (bindings.platformRun && !sameRef(review.platformRunRef, runRef(bindings.platformRun))) fail("EditorialSetReview:RUN_MISMATCH");
  if (bindings.candidateSet && !sameRef(review.candidateRef, bindings.candidateSet.candidateRef)) fail("EditorialSetReview:CANDIDATE_MISMATCH");
  return review;
}

export function reviewContentSet({ id, contentProject, platformRun, candidateSet, machineGate, reviewedAt }) {
  text(id, "EditorialSetReview:ID");
  assertProjectRun(contentProject, platformRun);
  assertCandidate(candidateSet, platformRun);
  if (!machineGate || machineGate.status !== "passed") fail("EditorialSetReview:MACHINE_GATE_REQUIRED");
  ref(machineGate.ref, "EditorialSetReview:MACHINE_GATE_REF");
  if (!sameRef(machineGate.candidateRef, candidateSet.candidateRef)) fail("EditorialSetReview:MACHINE_GATE_CANDIDATE_MISMATCH");
  const dimensions = evaluateDimensions(candidateSet);
  const failed = dimensions.filter((item) => item.status === "failed");
  const review = withUnifiedContentHash({
    schemaVersion: "1.0",
    contract: CONTENT_SET_REVIEW_CONTRACTS.editorialSetReview,
    id,
    platform: platformRun.platform,
    contentProjectRef: projectRef(contentProject),
    platformRunRef: runRef(platformRun),
    sharedContentMasterRef: clone(contentProject.sharedContentMasterRef),
    candidateRef: clone(candidateSet.candidateRef),
    machineGateRef: clone(machineGate.ref),
    dimensions,
    findings: failed.map((item) => ({ code: item.findingCode, dimension: item.id, evidence: clone(item.evidence) })),
    status: failed.length ? "changes_required" : "passed",
    targetRecoveryStage: failed.length ? failed[0].recoveryStage : null,
    reviewedAt,
    reviewHash: ""
  }, "reviewHash");
  return validateEditorialSetReview(review, { contentProject, platformRun, candidateSet });
}

export const createEditorialSetReview = reviewContentSet;

function selectionPayload(candidateSet) {
  return {
    finalTitleRef: clone(candidateSet.titleRef),
    finalBodyVersionRef: clone(candidateSet.bodyVersionRef),
    pageRevisionRefs: clone(candidateSet.pageRevisionRefs),
    articleRef: candidateSet.platform === "wechat" ? clone(candidateSet.articleRef) : null,
    imagePlanRef: candidateSet.platform === "wechat" ? clone(candidateSet.imagePlanRef) : null
  };
}

export function validateUserSelectionGate(gate, bindings = {}) {
  if (!gate || gate.schemaVersion !== "1.0" || gate.contract !== CONTENT_SET_REVIEW_CONTRACTS.userSelectionGate) fail("UserSelectionGate:VERSION");
  if (!PLATFORMS.has(gate.platform)) fail("UserSelectionGate:PLATFORM");
  for (const item of [gate.contentProjectRef, gate.platformRunRef, gate.candidateRef, gate.editorialReviewRef, gate.selectionEventRef]) ref(item, "UserSelectionGate:REF");
  refIdentity(gate.sharedContentMasterRef, "UserSelectionGate:MASTER_REF");
  if (!gate.selectionEvent || gate.selectionEvent.contract !== CONTENT_SET_REVIEW_CONTRACTS.userSelectionEvent) fail("UserSelectionGate:EVENT_REQUIRED");
  if (gate.selectionEvent.schemaVersion !== "1.0" || gate.selectionEvent.actorType !== "user") fail("UserSelectionGate:EXPLICIT_USER_EVENT_REQUIRED");
  iso(gate.selectionEvent.occurredAt, "UserSelectionGate:EVENT_AT");
  if (gate.selectionEvent.platform !== gate.platform || gate.selectionEvent.action !== gate.status) fail("UserSelectionGate:EVENT_STATUS_MISMATCH");
  if (!sameRef(gate.selectionEvent.contentProjectRef, gate.contentProjectRef)) fail("UserSelectionGate:EVENT_PROJECT_MISMATCH");
  if (!sameRef(gate.selectionEvent.platformRunRef, gate.platformRunRef)) fail("UserSelectionGate:EVENT_RUN_MISMATCH");
  if (!sameRef(gate.selectionEvent.sharedContentMasterRef, gate.sharedContentMasterRef)) fail("UserSelectionGate:EVENT_MASTER_MISMATCH");
  if (!sameRef(gate.selectionEvent.candidateRef, gate.candidateRef)) fail("UserSelectionGate:EVENT_CANDIDATE_MISMATCH");
  if (!sameRef(gate.selectionEvent.editorialReviewRef, gate.editorialReviewRef)) fail("UserSelectionGate:EVENT_REVIEW_MISMATCH");
  hash(gate.selectionEvent.eventHash, "UserSelectionGate:EVENT_HASH");
  const eventCopy = clone(gate.selectionEvent); delete eventCopy.eventHash;
  if (hashUnifiedContent(eventCopy) !== gate.selectionEvent.eventHash || !sameRef(gate.selectionEventRef, { id: gate.selectionEvent.id, hash: gate.selectionEvent.eventHash })) fail("UserSelectionGate:EVENT_HASH_MISMATCH");
  if (!["selected", "not_selected"].includes(gate.status)) fail("UserSelectionGate:STATUS");
  if (gate.status === "not_selected") {
    if (gate.userSelection !== null || gate.publishReady !== false || gate.nextState !== "editorial_reviewed") fail("UserSelectionGate:NOT_SELECTED_FINAL_FORBIDDEN");
  } else {
    validateUserSelection(gate.userSelection);
    if (gate.publishReady !== false || gate.nextState !== "user_selected") fail("UserSelectionGate:SELECTION_STATE_INCONSISTENT");
    if (!sameRef(gate.userSelection.platformRunRef, gate.platformRunRef)) fail("UserSelectionGate:USER_SELECTION_RUN_MISMATCH");
  }
  hash(gate.gateHash, "UserSelectionGate:HASH");
  const copy = clone(gate); delete copy.gateHash;
  if (hashUnifiedContent(copy) !== gate.gateHash) fail("UserSelectionGate:HASH_MISMATCH");
  if (bindings.contentProject && !sameRef(gate.contentProjectRef, projectRef(bindings.contentProject))) fail("UserSelectionGate:PROJECT_MISMATCH");
  if (bindings.platformRun && !sameRef(gate.platformRunRef, runRef(bindings.platformRun))) fail("UserSelectionGate:RUN_MISMATCH");
  if (bindings.candidateSet && !sameRef(gate.candidateRef, bindings.candidateSet.candidateRef)) fail("UserSelectionGate:CANDIDATE_MISMATCH");
  if (bindings.candidateSet && gate.status === "selected") {
    const expected = selectionPayload(bindings.candidateSet);
    if (hashUnifiedContent(gate.selectionEvent.selection) !== hashUnifiedContent(expected)) fail("UserSelectionGate:SELECTED_VERSION_MISMATCH");
  }
  if (bindings.editorialReview && !sameRef(gate.editorialReviewRef, reviewRef(bindings.editorialReview))) fail("UserSelectionGate:STALE_REVIEW");
  return gate;
}

export function createUserSelectionGate({ id, contentProject, platformRun, candidateSet, editorialReview, event }) {
  text(id, "UserSelectionGate:ID");
  assertProjectRun(contentProject, platformRun);
  assertCandidate(candidateSet, platformRun);
  validateEditorialSetReview(editorialReview, { contentProject, platformRun, candidateSet });
  if (!event || event.actorType !== "user") fail("UserSelectionGate:EXPLICIT_USER_EVENT_REQUIRED");
  text(event.id, "UserSelectionGate:EVENT_ID"); text(event.actorId, "UserSelectionGate:ACTOR_ID"); iso(event.occurredAt, "UserSelectionGate:EVENT_AT");
  const action = event.action === "confirm_selection" ? "selected" : event.action;
  if (!["selected", "not_selected"].includes(action)) fail("UserSelectionGate:EVENT_ACTION");
  if (action === "selected" && editorialReview.status !== "passed") fail("UserSelectionGate:EDITORIAL_REVIEW_REQUIRED");
  const selected = action === "selected" ? selectionPayload(candidateSet) : { finalTitleRef: null, finalBodyVersionRef: null, pageRevisionRefs: [], articleRef: null, imagePlanRef: null };
  const selectionEvent = withUnifiedContentHash({
    schemaVersion: "1.0",
    contract: CONTENT_SET_REVIEW_CONTRACTS.userSelectionEvent,
    id: event.id,
    action,
    actorId: event.actorId,
    actorType: "user",
    occurredAt: event.occurredAt,
    platform: platformRun.platform,
    contentProjectRef: projectRef(contentProject),
    platformRunRef: runRef(platformRun),
    sharedContentMasterRef: clone(contentProject.sharedContentMasterRef),
    candidateRef: clone(candidateSet.candidateRef),
    editorialReviewRef: reviewRef(editorialReview),
    selection: selected,
    eventHash: ""
  }, "eventHash");
  const selectionEventRef = { id: selectionEvent.id, hash: selectionEvent.eventHash };
  let userSelection = null;
  if (action === "selected") {
    userSelection = withUnifiedContentHash({
      schemaVersion: "1.0",
      contract: UNIFIED_CONTENT_CONTRACTS.userSelection,
      id: `user_selection:${id}`,
      platform: platformRun.platform,
      platformRunRef: runRef(platformRun),
      selectedBy: event.actorId,
      selectedByType: "user",
      finalTitleRef: selected.finalTitleRef,
      finalBodyVersionRef: selected.finalBodyVersionRef,
      pageRevisionRefs: selected.pageRevisionRefs,
      selectionEventRefs: [selectionEventRef],
      confirmation: "explicit_user_confirmed",
      confirmedAt: event.occurredAt,
      selectionHash: ""
    }, "selectionHash");
    validateUserSelection(userSelection);
  }
  const gate = withUnifiedContentHash({
    schemaVersion: "1.0",
    contract: CONTENT_SET_REVIEW_CONTRACTS.userSelectionGate,
    id,
    platform: platformRun.platform,
    contentProjectRef: projectRef(contentProject),
    platformRunRef: runRef(platformRun),
    sharedContentMasterRef: clone(contentProject.sharedContentMasterRef),
    candidateRef: clone(candidateSet.candidateRef),
    editorialReviewRef: reviewRef(editorialReview),
    selectionEventRef,
    selectionEvent,
    status: action,
    userSelection,
    publishReady: false,
    nextState: action === "selected" ? "user_selected" : "editorial_reviewed",
    gateHash: ""
  }, "gateHash");
  return validateUserSelectionGate(gate, { contentProject, platformRun, candidateSet, editorialReview });
}
