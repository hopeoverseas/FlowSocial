import { readFrontendSource, readFrontendSourceSync } from "./helpers/frontend-source.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { runInNewContext } from "node:vm";

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

const reviewStateRequests = [];
const apiContext = {
  window: { __FLOW_API_BASE__: "/api/v1", dispatchEvent: () => {} },
  location: { search: "", protocol: "http:" },
  fetch: async (url) => {
    reviewStateRequests.push(String(url));
    return { ok: true, status: 200, json: async () => ({ reviewFacts: [], selectionFacts: [] }) };
  },
  URLSearchParams,
  FormData,
  CustomEvent: class CustomEvent { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } },
  queueMicrotask,
  setTimeout,
  clearTimeout,
  console
};
runInNewContext(apiClient, apiContext, { filename: "api-client.js" });
for (const candidateId of ["browser_qa_xhs_ready", "browser_qa_xhs_alternative"]) {
  await apiContext.window.FlowAPI.getUnifiedContentReviewState("browser_qa_project", "xiaohongshu", {
    workspaceId: "workspace_browser_qa",
    companyId: "company_browser_qa",
    accountId: "account_browser_qa_xhs",
    candidateId
  });
}
assert.equal(reviewStateRequests.length, 2, "each explicit candidate must perform one review-state read");
assert.deepEqual(reviewStateRequests.map((requestUrl) => {
  const url = new URL(requestUrl, "http://flowsocial.test");
  return {
    candidateId: url.searchParams.get("candidateId"),
    workspaceId: url.searchParams.get("workspaceId"),
    companyId: url.searchParams.get("companyId"),
    accountId: url.searchParams.get("accountId")
  };
}), [
  { candidateId: "browser_qa_xhs_ready", workspaceId: "workspace_browser_qa", companyId: "company_browser_qa", accountId: "account_browser_qa_xhs" },
  { candidateId: "browser_qa_xhs_alternative", workspaceId: "workspace_browser_qa", companyId: "company_browser_qa", accountId: "account_browser_qa_xhs" }
]);

const requiredDomIds = [
  "unifiedArtifactReviewNav", "unifiedArtifactReviewView", "unifiedArtifactProject",
  "unifiedArtifactPlatform", "unifiedArtifactCandidate", "unifiedArtifactReferences",
  "unifiedArtifactStatusGrid", "unifiedArtifactMaterial", "unifiedArtifactReviewer",
  "unifiedArtifactReason", "unifiedCreateContentReview", "unifiedSelectionConfirm",
  "unifiedConfirmSelection", "unifiedWechatPreUploadPreview"
];
for (const id of requiredDomIds) assert.match(`${html}\n${app}`, new RegExp(`id=(?:\\\\?["'])${id}(?:\\\\?["'])`), `missing DOM id ${id}`);

assert.match(html, /data-feature-flag="UNIFIED_CONTENT_ARTIFACTS_V1"/);
assert.match(html, /id="unifiedArtifactReviewNav"[^>]*hidden/);
assert.match(html, /id="unifiedArtifactReviewView"[^>]*hidden/);
assert.match(app, /id=\\?"unifiedWechatPreUploadPreview\\?"[^>]*sandbox=\\?"\\?"/);
assert.match(`${html}\n${app}`, /满意后再生成本地内容包，不会自动上传或发布/);
assert.match(html, /Provider、下载、批准或选择都不是发布/);
assert.equal((html.match(/data-status-kind=/g) || []).length, 5, "five authority categories must stay visibly separate");

const start = app.indexOf("// UNIFIED_ARTIFACT_REVIEW_WORKBENCH_START");
const end = app.indexOf("// UNIFIED_ARTIFACT_REVIEW_WORKBENCH_END");
assert.ok(start >= 0 && end > start, "workbench source markers missing");
const workbench = app.slice(start, end);

const gateStart = app.indexOf("// UNIFIED_ARTIFACT_FEATURE_GATE_START");
const gateEnd = app.indexOf("// UNIFIED_ARTIFACT_FEATURE_GATE_END");
assert.ok(gateStart >= 0 && gateEnd > gateStart, "feature gate source markers missing");
const gateSource = app.slice(gateStart, gateEnd);
const { resolveGate, applyVisibility } = new Function(`${gateSource}; return { resolveGate: resolveUnifiedArtifactFeatureGate, applyVisibility: applyUnifiedArtifactFeatureVisibility };`)();

async function exerciseFeatureGate(runtimeStatus) {
  let runtimeCalls = 0;
  let projectListCalls = 0;
  const nav = { hidden: true };
  const view = { hidden: true };
  const state = { enabled: false };
  const result = await resolveGate({
    getRuntimeStatus: async () => { runtimeCalls += 1; return runtimeStatus; },
    listProjects: async () => { projectListCalls += 1; return { items: [{ id: "project_fixture" }] }; }
  });
  applyVisibility({ enabled: result.enabled, nav, view, workbench: state });
  return { runtimeCalls, projectListCalls, navHidden: nav.hidden, viewHidden: view.hidden, enabled: state.enabled };
}

assert.deepEqual(await exerciseFeatureGate({ featureFlags: { unifiedContentArtifactsV1: false } }), {
  runtimeCalls: 1, projectListCalls: 0, navHidden: true, viewHidden: true, enabled: false
});
assert.deepEqual(await exerciseFeatureGate({ featureFlags: {} }), {
  runtimeCalls: 1, projectListCalls: 0, navHidden: true, viewHidden: true, enabled: false
});
assert.deepEqual(await exerciseFeatureGate({ featureFlags: { unifiedContentArtifactsV1: true } }), {
  runtimeCalls: 1, projectListCalls: 1, navHidden: false, viewHidden: false, enabled: true
});
let failedListCalls = 0;
const failedGate = await resolveGate({
  getRuntimeStatus: async () => { throw new Error("health unavailable"); },
  listProjects: async () => { failedListCalls += 1; return { items: [] }; }
});
const failedNav = { hidden: true };
const failedView = { hidden: true };
const failedState = { enabled: false };
applyVisibility({ enabled: failedGate.enabled, nav: failedNav, view: failedView, workbench: failedState });
assert.deepEqual({ failedListCalls, navHidden: failedNav.hidden, viewHidden: failedView.hidden, enabled: failedState.enabled }, {
  failedListCalls: 0, navHidden: true, viewHidden: true, enabled: false
});

const presentationStart = app.indexOf("// UNIFIED_XHS_ARTIFACT_PRESENTATION_START");
const presentationEnd = app.indexOf("// UNIFIED_XHS_ARTIFACT_PRESENTATION_END");
assert.ok(presentationStart >= 0 && presentationEnd > presentationStart, "XHS artifact presentation source markers missing");
const presentationSource = app.slice(presentationStart, presentationEnd);
const visualReviewStart = app.indexOf("// UNIFIED_XHS_VISUAL_REVIEW_PRESENTATION_START");
const visualReviewEnd = app.indexOf("// UNIFIED_XHS_VISUAL_REVIEW_PRESENTATION_END");
assert.ok(visualReviewStart >= 0 && visualReviewEnd > visualReviewStart, "XHS visual-review presentation source markers missing");
const visualReviewSource = app.slice(visualReviewStart, visualReviewEnd);
const artifactWorkbenchFixture = { artifactReview: { actionStates: [], actionFacts: [] } };
const { previewPath, pageMetadata, renderXhs } = new Function("asArray", "unifiedArtifactWorkbench", "escapeHtml", "unifiedRefLabel", `${visualReviewSource}; ${presentationSource}; return { previewPath: unifiedPreviewPath, pageMetadata: unifiedPageMetadata, renderXhs: renderUnifiedXhsMaterial };`)(
  (value) => Array.isArray(value) ? value : value == null ? [] : [value],
  artifactWorkbenchFixture,
  (value = "") => String(value).replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]),
  (ref) => ref?.id ? `${ref.id}${ref.hash ? ` · ${String(ref.hash).slice(0, 12)}…` : ""}` : "—"
);
const browserFixturePage = {
  pageId: "P1",
  order: 1,
  revisionRef: { id: "xhs-page-revision:browser_qa_xhs_ready:P1:r1", hash: "d6bdb5ad39401606a06fa24ff1c3c95b30bbd20055fbb69225c649c460fe8bc6" },
  revision: {
    contract: "XhsPageArtifactRevisionFact@1.0",
    normalizedAsset: {
      relativePath: "xhs/normalized/browser_qa_xhs_ready/P1/a1.png",
      sha256: "8862ad94abd27bb4e1264535545dbdb651f0ee3323a0a520170285f2b527034f",
      bytes: 8317,
      dimensions: { width: 1080, height: 1440 }
    }
  },
  excluded: false
};
assert.equal(previewPath(browserFixturePage), "/xhs/normalized/browser_qa_xhs_ready/P1/a1.png");
assert.deepEqual(pageMetadata(browserFixturePage), {
  sha: "8862ad94abd27bb4e1264535545dbdb651f0ee3323a0a520170285f2b527034f",
  bytes: 8317,
  width: 1080,
  height: 1440
});
const renderedBrowserFixturePage = renderXhs({ pages: [browserFixturePage] }, { reviewable: true });
assert.match(renderedBrowserFixturePage, /src="\/xhs\/normalized\/browser_qa_xhs_ready\/P1\/a1\.png"/);
assert.match(renderedBrowserFixturePage, /8862ad94abd27bb4e1264535545dbdb651f0ee3323a0a520170285f2b527034f/);
assert.match(renderedBrowserFixturePage, />8317</);
assert.match(renderedBrowserFixturePage, /1080 × 1440/);
assert.equal(previewPath({ revision: { normalizedAsset: { relativePath: "//outside.example/asset.png" } } }), "");
assert.equal(previewPath({ revision: { normalizedAsset: { relativePath: "xhs/../secret.png" } } }), "");

for (const method of [
  "getRuntimeStatus", "listUnifiedContentProjects", "getUnifiedContentProject", "getUnifiedContentArtifactReview",
  "getUnifiedContentReviewState", "appendUnifiedContentArtifactReviewAction",
  "createUnifiedContentReview", "createUnifiedContentSelection",
  "previewSavedContentPromotion", "confirmSavedContentPromotion"
]) assert.match(workbench, new RegExp(`FlowAPI\\.${method}\\b`), `missing API method ${method}`);

for (const forbidden of [
  "confirmContentPromotion",
  "recordContentPublication", "updateContentPublication", "generateContentAssets",
  "deliverContent"
]) assert.doesNotMatch(workbench, new RegExp(`FlowAPI\\.${forbidden}\\b`), `forbidden write action ${forbidden}`);
assert.match(workbench, /FlowAPI\.downloadContentPackage\b/, "approved local-only package delivery remains available after exact selection");

assert.doesNotMatch(workbench, /currentContentTask\b/, "legacy ContentTask state must not authorize the unified workbench");
assert.match(workbench, /window\.FlowAPI\.mode !== "live"/);
assert.match(workbench, /unifiedArtifactWorkbench\.enabled = false/);
assert.match(workbench, /selectable === true/);
assert.match(workbench, /reviewable !== true/);
assert.match(workbench, /artifactStateHash/);
assert.match(workbench, /page_redo_pending/);
assert.match(workbench, /window\.confirm\(summary\)/, "selection must require a second explicit confirmation");
assert.match(workbench, /previewArtifact\?\.semantics === "pre_upload_template_not_wechat_final"/);
assert.match(workbench, /<iframe class="unified-wechat-preview"[^>]+sandbox=""[^>]+srcdoc=/);
assert.doesNotMatch(workbench, /fact\.html|fact\.preUploadHtml|fact\.artifact\?\.html/, "historical audit facts without a product preview artifact must fail closed");
assert.match(workbench, /action: "confirm_selection"/);
assert.match(workbench, /请选择候选/);
assert.doesNotMatch(workbench, /candidateRefs\s*\?\.\s*\[0\]|candidateRefs\s*\[0\]/, "candidate must never default to the first item");

for (const action of ["exclude_page", "restore_page", "reorder_pages", "request_page_redo", "approve_set", "reject_set", "approve_preupload", "reject_preupload"])
  assert.match(workbench, new RegExp(action), `missing review action ${action}`);

assert.match(css, /\.unified-artifact-layout/);
assert.match(css, /\.unified-wechat-preview/);
assert.match(apiClient, /getUnifiedContentArtifactReview:/);
assert.match(apiClient, /appendUnifiedContentArtifactReviewAction:/);

console.log(JSON.stringify({
  status: "unified-content-artifact-review-ui-self-test passed",
  domContracts: requiredDomIds.length,
  authorityCategories: 5,
  explicitCandidateSelection: true,
  reviewStateCandidateForwarding: reviewStateRequests.length,
  xhsBrowserFixturePresentation: { preview: true, sha: true, bytes: true, dimensions: true },
  featureGateBehavior: { false: "hidden", missing: "hidden", failure: "hidden", true: "visible" },
  sandboxedWechatPreview: true,
  publicationWrites: 0,
  savedPromotionUi: true,
  providerCalls: 0,
  platformCalls: 0
}, null, 2));
