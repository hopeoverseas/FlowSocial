import assert from "node:assert/strict";
import { hashUnifiedContent, withUnifiedContentHash } from "../../content-agent/unified-content-contracts.mjs";
import { createUserSelectionGate, reviewContentSet, validateUserSelectionGate } from "../../content-agent/content-set-review.mjs";

const H = (value) => hashUnifiedContent(value);
const ref = (id) => ({ id, hash: H(id) });
const master = { schemaVersion: "1.0", contract: "SharedContentMasterRef@1.0", id: "master:1", hash: H("master"), authorityContract: "ContentMaster@2.0", authorityType: "shared_content_master" };

function run(platform) {
  return {
    schemaVersion: "1.0", contract: "PlatformRunRef@1.0", id: `run:${platform}`, hash: H(`run:${platform}`), platform,
    accountId: `account:${platform}`, sharedContentMasterRef: master, platformBriefRef: ref(`brief:${platform}`), outlineRef: ref(`outline:${platform}`),
    writerInvocationRef: ref(`writer:${platform}`), candidateRefs: [ref(`candidate:${platform}`)], finalVersionRef: null
  };
}

const xhsRun = run("xiaohongshu"); const wechatRun = run("wechat");
const project = withUnifiedContentHash({ schemaVersion: "1.0", contract: "ContentProject@1.0", id: "project:1", companyId: "company:1", contentOpportunityRef: ref("opportunity:1"), activeStrategySnapshotRef: ref("strategy:1"), sharedContentMasterRef: master, platformRuns: [xhsRun, wechatRun], state: "candidate_ready", createdAt: "2026-08-05T10:00:00.000Z", projectHash: "" }, "projectHash");
const item = (id, order, overrides = {}) => ({ id, order, purpose: id, necessity: "required", continuityFromPrevious: true, visualStyleHash: H("style:1"), copyVisualRelationship: "complementary", informationDensity: 0.55, clickValue: 1, conversionValue: 1, ...overrides });
const xhsCandidate = { platform: "xiaohongshu", candidateRef: xhsRun.candidateRefs[0], titleRef: ref("xhs:title:1"), bodyVersionRef: ref("xhs:body:1"), pageRevisionRefs: [ref("page:1:r1"), ref("page:2:r1")], articleRef: null, imagePlanRef: null, items: [item("page:1", 1), item("page:2", 2)] };
const wechatCandidate = { platform: "wechat", candidateRef: wechatRun.candidateRefs[0], titleRef: ref("wechat:title:1"), bodyVersionRef: ref("wechat:body:1"), pageRevisionRefs: [], articleRef: ref("wechat:article:1"), imagePlanRef: ref("wechat:image-plan:1"), items: [item("section:1", 1), item("section:2", 2)] };
const machineGate = (candidate) => ({ status: "passed", ref: ref(`machine:${candidate.platform}`), candidateRef: candidate.candidateRef });
const review = (candidate, platformRun, id = `review:${candidate.platform}`) => reviewContentSet({ id, contentProject: project, platformRun, candidateSet: candidate, machineGate: machineGate(candidate), reviewedAt: "2026-08-05T10:10:00.000Z" });
const userEvent = (id, action = "selected") => ({ id, action, actorId: "user:1", actorType: "user", occurredAt: "2026-08-05T10:20:00.000Z" });

const xhsReview = review(xhsCandidate, xhsRun);
assert.equal(xhsReview.status, "passed");
assert.equal(xhsReview.dimensions.length, 6);

const redundant = structuredClone(xhsCandidate); redundant.items[1].necessity = "redundant";
const redundantReview = review(redundant, xhsRun, "review:redundant");
assert.equal(redundantReview.status, "changes_required"); assert.equal(redundantReview.targetRecoveryStage, "outline");

const styleDrift = structuredClone(xhsCandidate); styleDrift.items[1].visualStyleHash = H("style:jump");
assert.equal(review(styleDrift, xhsRun, "review:style").findings.some((item) => item.code === "SET_VISUAL_STYLE_DRIFT"), true);

const brokenSequence = structuredClone(xhsCandidate); brokenSequence.items[1].continuityFromPrevious = false;
assert.equal(review(brokenSequence, xhsRun, "review:sequence").findings.some((item) => item.code === "SET_SEQUENCE_DISCONTINUITY"), true);

const notSelected = createUserSelectionGate({ id: "gate:not-selected", contentProject: project, platformRun: xhsRun, candidateSet: xhsCandidate, editorialReview: xhsReview, event: userEvent("event:not-selected", "not_selected") });
assert.equal(notSelected.userSelection, null); assert.equal(notSelected.publishReady, false); assert.equal(notSelected.nextState, "editorial_reviewed");

const xhsSelection = createUserSelectionGate({ id: "gate:xhs", contentProject: project, platformRun: xhsRun, candidateSet: xhsCandidate, editorialReview: xhsReview, event: userEvent("event:xhs") });
assert.deepEqual(xhsSelection.userSelection.pageRevisionRefs, xhsCandidate.pageRevisionRefs);
assert.equal(xhsSelection.nextState, "user_selected"); assert.equal(xhsSelection.publishReady, false);

const wechatReview = review(wechatCandidate, wechatRun);
const wechatSelection = createUserSelectionGate({ id: "gate:wechat", contentProject: project, platformRun: wechatRun, candidateSet: wechatCandidate, editorialReview: wechatReview, event: userEvent("event:wechat") });
assert.deepEqual(wechatSelection.selectionEvent.selection.articleRef, wechatCandidate.articleRef);
assert.deepEqual(wechatSelection.selectionEvent.selection.imagePlanRef, wechatCandidate.imagePlanRef);
assert.deepEqual(wechatSelection.userSelection.finalTitleRef, wechatCandidate.titleRef);
assert.deepEqual(wechatSelection.userSelection.finalBodyVersionRef, wechatCandidate.bodyVersionRef);

assert.throws(() => createUserSelectionGate({ id: "gate:implicit", contentProject: project, platformRun: xhsRun, candidateSet: xhsCandidate, editorialReview: xhsReview, event: { ...userEvent("event:implicit"), actorType: "machine" } }), /EXPLICIT_USER_EVENT_REQUIRED/);
assert.throws(() => createUserSelectionGate({ id: "gate:cross", contentProject: project, platformRun: wechatRun, candidateSet: xhsCandidate, editorialReview: xhsReview, event: userEvent("event:cross") }), /CANDIDATE_PLATFORM_MISMATCH/);

const staleReview = structuredClone(xhsReview); staleReview.reviewHash = H("stale");
assert.throws(() => validateUserSelectionGate(xhsSelection, { contentProject: project, platformRun: xhsRun, candidateSet: xhsCandidate, editorialReview: staleReview }), /STALE_REVIEW/);

console.log("content set review self-test passed");
