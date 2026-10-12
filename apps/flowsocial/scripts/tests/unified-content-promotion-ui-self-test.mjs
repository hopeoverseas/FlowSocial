import { readFrontendSource, readFrontendSourceSync } from "./helpers/frontend-source.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..", "..");
const [html, app, css, apiClient] = await Promise.all([
  readFile(join(appRoot, "index.html"), "utf8"),
  readFrontendSource(),
  readFile(join(appRoot, "styles.css"), "utf8"),
  readFile(join(appRoot, "api-client.js"), "utf8")
]);

const syntax = spawnSync(process.execPath, ["--check", join(appRoot, "app.js")], { encoding: "utf8" });
assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout);

for (const id of [
  "unifiedPromotionPanel", "unifiedPromotionBlockers", "unifiedPreviewPromotion",
  "unifiedPromotionPreviewState", "unifiedPromotionBindings", "unifiedPromotionConfirm",
  "unifiedConfirmPromotion", "unifiedPromotionResult", "unifiedArtifactPromotionDetail"
]) assert.match(html, new RegExp(`id="${id}"`), `missing Promotion DOM ${id}`);

const workbenchStart = app.indexOf("// UNIFIED_ARTIFACT_REVIEW_WORKBENCH_START");
const workbenchEnd = app.indexOf("// UNIFIED_ARTIFACT_REVIEW_WORKBENCH_END");
const promotionStart = app.indexOf("// UNIFIED_CONTENT_PROMOTION_UI_START");
const promotionEnd = app.indexOf("// UNIFIED_CONTENT_PROMOTION_UI_END");
assert.ok(workbenchStart >= 0 && workbenchEnd > workbenchStart);
assert.ok(promotionStart > workbenchStart && promotionEnd > promotionStart);
const workbench = app.slice(workbenchStart, workbenchEnd);
const promotionUi = app.slice(promotionStart, promotionEnd);

assert.match(promotionUi, /FlowAPI\.previewSavedContentPromotion\b/);
assert.match(promotionUi, /FlowAPI\.confirmSavedContentPromotion\b/);
assert.match(apiClient, /previewSavedContentPromotion:/);
assert.match(apiClient, /confirmSavedContentPromotion:/);
assert.doesNotMatch(promotionUi, /FlowAPI\.(?:previewContentPromotion|confirmContentPromotion|recordContentPublication|updateContentPublication|generateContentAssets|deliverContent|downloadContentPackage)\b/);
assert.doesNotMatch(promotionUi, /currentContentTask\b|ContentPromotionRequest@1\.0|request\s*:/, "UI must not rebuild a PromotionRequest or use legacy task authority");
assert.match(promotionUi, /selectionId:\s*selection\.id/);
assert.match(promotionUi, /previewToken:\s*preview\.previewToken/);
assert.match(promotionUi, /idempotencyKey:\s*unifiedArtifactWorkbench\.promotionIdempotencyKey/);
assert.match(promotionUi, /promotionIdempotencyKey = unifiedIdempotencyKey\("promotion"\)/);
assert.match(promotionUi, /Confirm 结果未知/);
assert.match(promotionUi, /请用同一幂等键重试/);
assert.match(workbench, /FlowAPI\.getContentVersions\b/);
assert.match(workbench, /FlowAPI\.getContentPromotions\b/);
assert.match(workbench, /unifiedSameRef\(item\.candidateVersionRef, candidateRef\)/);
assert.match(workbench, /unifiedSameRef\(item\.promotedVersionRef, \{ id: contentVersion\.id, hash: contentVersion\.versionHash \}\)/);
assert.match(promotionUi, /window\.confirm\(summary\)/);
assert.match(promotionUi, /unifiedPromotionConfirm/);
assert.match(promotionUi, /writesPerformed !== false/);
assert.match(promotionUi, /platformPublicationPerformed !== false/);
assert.match(promotionUi, /Publication：未登记/);
assert.match(`${html}\n${app}`, /Preview 不写数据/);
assert.match(html, /Promotion 与 Publication 始终分开/);
assert.match(css, /\.unified-content-promotion-step/);

const featureGateSource = app.slice(
  app.indexOf("// UNIFIED_ARTIFACT_FEATURE_GATE_START"),
  app.indexOf("// UNIFIED_ARTIFACT_FEATURE_GATE_END")
);
const resolveGate = new Function(`${featureGateSource}; return resolveUnifiedArtifactFeatureGate;`)();
let listCalls = 0;
const flagOff = await resolveGate({
  getRuntimeStatus: async () => ({ featureFlags: { unifiedContentArtifactsV1: true, contentPromotionV1: false } }),
  listProjects: async () => { listCalls += 1; return { items: [] }; }
});
assert.equal(flagOff.enabled, true);
assert.equal(flagOff.promotionEnabled, false);
assert.equal(listCalls, 1, "review UI stays available while Promotion controls fail closed");
const flagOn = await resolveGate({
  getRuntimeStatus: async () => ({ featureFlags: { unifiedContentArtifactsV1: true, localContentPromotionV1: true, contentPromotionV1: false } }),
  listProjects: async () => ({ items: [] })
});
assert.equal(flagOn.promotionEnabled, true);
const legacyOnly = await resolveGate({
  getRuntimeStatus: async () => ({ featureFlags: { unifiedContentArtifactsV1: true, contentPromotionV1: true } }),
  listProjects: async () => ({ items: [] })
});
assert.equal(legacyOnly.promotionEnabled, false, "legacy promotion must not open current local controls");

const eligibilitySource = promotionUi.slice(0, promotionUi.indexOf("function renderUnifiedPromotionPanel"));
const eligibility = new Function("unifiedArtifactWorkbench", `${eligibilitySource}; return unifiedPromotionEligibility;`)({ promotionEnabled: true, promotionHistoryStatus: "loaded", promotionResult: null });
const artifactState = { artifactStateHash: "state-1" };
const review = { id: "review-1", state: "editorial_review_passed" };
const selection = { id: "selection-1", status: "selected", reviewFactRef: { id: "review-1" }, artifactStateHash: "state-1" };
assert.deepEqual(eligibility({ latestReview: review, latestSelection: selection, reviewStale: false, selectionStale: false, artifactState }), { eligible: true, blockers: [] });
assert.equal(eligibility({ latestReview: review, latestSelection: selection, reviewStale: false, selectionStale: true, artifactState }).eligible, false);

assert.ok((workbench.match(/clearUnifiedPromotionState\(/g) || []).length >= 5, "scope/state/review/selection paths must clear old preview");
assert.match(workbench, /clearUnifiedPromotionState\("项目已变化/);
assert.match(workbench, /clearUnifiedPromotionState\("平台已变化/);
assert.match(workbench, /clearUnifiedPromotionState\("candidate 已变化/);
assert.match(workbench, /clearUnifiedPromotionState\("候选状态已刷新/);

console.log(JSON.stringify({
  status: "unified-content-promotion-ui-self-test passed",
  savedSelectionOnly: true,
  previewReadOnlyClaimRequired: true,
  nativeSecondConfirmation: true,
  previewClearedOnBindingChanges: true,
  featureFlags: { artifactRequired: true, promotionFailClosed: true },
  publicationWrites: 0,
  providerCalls: 0,
  platformCalls: 0
}, null, 2));
