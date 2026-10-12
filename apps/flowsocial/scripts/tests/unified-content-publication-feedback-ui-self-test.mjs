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
  "unifiedPublicationPanel", "unifiedPublicationBlockers", "unifiedPublicationPublishedAt",
  "unifiedPublicationContentId", "unifiedPublicationUrl", "unifiedPublicationManualConfirm",
  "unifiedRecordPublication", "unifiedPublicationResult", "unifiedFeedbackPanel",
  "unifiedFeedbackWindow", "unifiedFeedbackCutoffAt", "unifiedFeedbackPlatformMetrics",
  "unifiedFeedbackQualitative", "unifiedRecordFeedback", "unifiedFeedbackResult"
]) assert.match(html, new RegExp(`id="${id}"`), `missing Publication/feedback DOM ${id}`);

assert.match(html, /不会调用微信、小红书或 Provider 发布 API/);
assert.match(html, /我确认已在当前平台人工完成发布/);
assert.match(html, /实际发布时间/);
assert.match(html, /72h/);
assert.match(html, /7d/);
assert.match(html, /final/);

const start = app.indexOf("// UNIFIED_CONTENT_PUBLICATION_FEEDBACK_UI_START");
const end = app.indexOf("// UNIFIED_CONTENT_PUBLICATION_FEEDBACK_UI_END");
assert.ok(start >= 0 && end > start);
const ui = app.slice(start, end);
const promotionPublicationLabelSource = ui.slice(
  ui.indexOf("function unifiedPromotionPublicationLabel"),
  ui.indexOf("function unifiedPublicationEligibility")
);
const promotionPublicationLabel = new Function(`${promotionPublicationLabelSource}; return unifiedPromotionPublicationLabel;`)();
assert.equal(promotionPublicationLabel(null), "Publication：未登记");
assert.equal(promotionPublicationLabel({ id: "publication_exact_1" }), "人工 Publication：publication_exact_1 已登记（非平台 API 发布）");
assert.match(app, /unifiedPromotionPublicationLabel\(unifiedArtifactWorkbench\.publicationResult\)/);
assert.doesNotMatch(app.slice(app.indexOf("function renderUnifiedPromotionPanel"), app.indexOf("async function previewUnifiedCurrentPromotion")), /<span>Publication：未登记<\/span>/);
assert.match(ui, /\{ recordContentPublication \} = window\.FlowAPI/);
assert.match(ui, /\{ recordPublicationMetrics \} = window\.FlowAPI/);
assert.match(app, /FlowAPI\.getContentPublications\b/);
assert.match(apiClient, /recordContentPublication:/);
assert.match(apiClient, /recordPublicationMetrics:/);
assert.match(apiClient, /getContentPublications:/);
assert.match(ui, /promotionId:\s*promotion\.id/);
assert.match(ui, /promotedVersionRef:\s*promotion\.promotedVersionRef/);
assert.match(ui, /idempotencyKey:\s*unifiedArtifactWorkbench\.publicationIdempotencyKey/);
assert.match(ui, /promotionStatus !== "promoted_exact_version"/);
assert.match(app, /unifiedSameRef\(item\.promotionRecordRef, \{ id: promotion\.id, hash: promotion\.promotionHash \}\)/);
assert.match(app, /unifiedSameRef\(item\.promotedVersionRef, promotion\.promotedVersionRef\)/);
assert.match(app, /item\.companyId === scope\.companyId/);
assert.match(app, /item\.platform === unifiedArtifactWorkbench\.platform/);
assert.match(ui, /平台内容 ID 与可验证平台 URL 至少填写一项/);
assert.match(ui, /当前平台的可验证 HTTPS 地址/);
assert.match(ui, /实际发布时间不能是未来时间/);
assert.match(ui, /登记结果未知/);
assert.match(ui, /同一幂等键安全重试/);
assert.match(ui, /反馈必须绑定当前精确 Publication/);
assert.match(ui, /measurementWindow/);
assert.match(ui, /cutoffAt/);
assert.match(ui, /userFeedback/);
assert.match(ui, /revision/);
assert.doesNotMatch(ui, /previewSavedContentPromotion|confirmSavedContentPromotion|deliverContent|downloadContentPackage|generateContentAssets/);
assert.match(css, /\.unified-content-publication-step/);
assert.match(css, /\.unified-content-feedback-step/);

console.log(JSON.stringify({
  status: "unified-content-publication-feedback-ui-self-test passed",
  exactPromotionBindingRequired: true,
  manualPublicationDisclosure: true,
  stablePublicationIdempotency: true,
  refreshRecoveryExactScope: true,
  feedbackWindows: ["72h", "7d", "final"],
  feedbackRevisionVisible: true,
  refreshedPromotionCardPublicationProjection: true,
  providerCalls: 0,
  platformCalls: 0
}, null, 2));
