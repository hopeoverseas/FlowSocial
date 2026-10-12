import { readFrontendSource, readFrontendSourceSync } from "./helpers/frontend-source.mjs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { renderContentDelivery, createDeliveryZip, renderHtmlToPngWithMeasurements } from "../../artifact-engine.mjs";
import { confirmXhsVisualStoryboard, createXhsVisualStoryboard, XHS_PAGE_TEMPLATES } from "../../content-agent/xhs-visual-storyboard.mjs";
import {
  adaptLegacyRenderQualityReadOnly,
  contrastRatio,
  DETERMINISTIC_PRESETS,
  evaluateDeterministicPageQuality,
  requireDeterministicPageQuality,
  validateDeterministicPageQualityReport,
  verifyDeterministicPageQualityArtifacts
} from "../../content-agent/visual-review-engine.mjs";
import { featureFlags } from "../../feature-flags.mjs";

const fixturePath = resolve("apps/flowsocial/scripts/fixtures/xhs-deterministic-visual-quality/cases.json");
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
const byId = new Map(fixture.cases.map((item) => [item.id, item]));
let assertions = 0;
const equal = (actual, expected, message) => { assert.deepEqual(actual, expected, message); assertions += 1; };
const ok = (value, message) => { assert.ok(value, message); assertions += 1; };
const rejects = async (fn, pattern) => { await assert.rejects(fn, pattern); assertions += 1; };

function inputFor(item, overrides = {}) {
  const canvas = overrides.canvas || item.canvas || fixture.canvas;
  const safeArea = overrides.safeArea || fixture.safeArea;
  const background = item.id === "dark" ? "#142c24" : "#ffffff";
  const foreground = item.id === "dark" ? "#ffffff" : "#18352d";
  const layer = (role, bounds, extra = {}) => ({ role, text: role, bounds, scrollWidth: bounds.width, clientWidth: bounds.width, scrollHeight: bounds.height, clientHeight: bounds.height, foreground, background, overflow: false, insideSafeArea: true, intersectsSubject: false, ...extra });
  const domMeasurements = overrides.domMeasurements || {
    canvas: { x: 0, y: 0, width: canvas.width, height: canvas.height, scrollWidth: canvas.width, clientWidth: canvas.width, scrollHeight: canvas.height, clientHeight: canvas.height }, safeArea, subjectBounds: overrides.subjectBounds || null,
    layers: [layer("title", { x: 112, y: 245, width: 856, height: 120 }), layer("body", { x: 112, y: 470, width: 856, height: 600 }), layer("number_card", { x: 130, y: 520, width: 80, height: 80 }), layer("footer", { x: 112, y: 1310, width: 856, height: 48 })]
  };
  return {
    page: { headline: "确定性中文叠字", bodyItems: item.body ? [item.body] : ["先定主题", "再列要点", "最后校对"] },
    contentTaskId: "offline_quality", contentVersion: 1, pageId: item.id,
    canvas, safeArea,
    backgroundRegions: item.backgroundRegions || [], cropDetected: item.cropDetected === true,
    renderSource: item.renderSource || "deterministic_layout", featureFlagEnabled: true,
    domMeasurements, outputPng: { path: `artifacts/${item.id}.png`, bytes: 1024, sha256: "a".repeat(64) },
    createdAt: "2026-08-03T00:00:00.000Z", ...overrides, canvas, safeArea, domMeasurements
  };
}

const normal = evaluateDeterministicPageQuality(inputFor(byId.get("normal")));
equal(normal.deliveryEligibility, "eligible");
equal(normal.preset.textTone, "dark_text");
equal(normal.evidence.layers.map((item) => item.role), ["title", "body", "number_card", "footer"]);
ok(normal.evidence.layers.every((item) => item.contrastRatio >= item.threshold), "normal local contrast must pass per layer");
equal(normal.evidence.networkCalls, 0); equal(normal.evidence.providerCalls, 0); equal(normal.evidence.costCredits, 0); equal(normal.evidence.activeDatabaseWrites, 0);

const bright = evaluateDeterministicPageQuality(inputFor(byId.get("bright")));
equal(bright.preset.textTone, "dark_text");
const dark = evaluateDeterministicPageQuality(inputFor(byId.get("dark")));
equal(dark.preset.textTone, "light_text");
const split = evaluateDeterministicPageQuality(inputFor(byId.get("split")));
equal(split.preset.cardFill, "light_card", "split background must use a finite local card preset");
ok(split.evidence.layers.every((item) => item.background === "#ffffff"), "split background must be evaluated locally under the card");
ok(contrastRatio("#18352d", "#ffffff") > 4.5);

const lowContrastInput = inputFor(byId.get("dark"), { allowedPresetIndexes: [0] }); lowContrastInput.domMeasurements.layers.forEach((layer) => { layer.foreground = "#18352d"; });
const lowContrast = evaluateDeterministicPageQuality(lowContrastInput);
equal(lowContrast.contrastStatus, "blocked");
ok(lowContrast.blockers.includes("LOW_LOCAL_CONTRAST"));

const dense = evaluateDeterministicPageQuality(inputFor(byId.get("dense")));
equal(dense.capacityStatus, "blocked"); ok(dense.blockers.includes("INFORMATION_CAPACITY_EXCEEDED"));
const cropped = evaluateDeterministicPageQuality(inputFor(byId.get("cropped")));
equal(cropped.canvasStatus, "blocked"); ok(cropped.blockers.includes("CANVAS_CROPPED"));
const tamperedSize = evaluateDeterministicPageQuality(inputFor(byId.get("tampered-size")));
equal(tamperedSize.canvasStatus, "blocked"); ok(tamperedSize.blockers.includes("CANVAS_NOT_EXACT_1080X1440"));
const approximate = evaluateDeterministicPageQuality(inputFor(byId.get("normal"), { canvas: { width: 896, height: 1200 } }));
equal(approximate.canvasStatus, "blocked", "approximate 3:4 must not pass exact canvas");

const overflowInput = inputFor(byId.get("normal")); overflowInput.domMeasurements.layers[0].overflow = true;
const overflow = evaluateDeterministicPageQuality(overflowInput);
equal(overflow.overflowStatus, "blocked"); ok(overflow.blockers.includes("TEXT_OVERFLOW"));
const unsafeInput = inputFor(byId.get("normal")); unsafeInput.domMeasurements.layers[0].bounds.x = 10; unsafeInput.domMeasurements.layers[0].insideSafeArea = false;
const unsafe = evaluateDeterministicPageQuality(unsafeInput);
equal(unsafe.safeAreaStatus, "blocked"); ok(unsafe.blockers.includes("SAFE_AREA_VIOLATION"));
const occludedInput = inputFor(byId.get("normal"), { subjectBounds: { x: 100, y: 240, width: 900, height: 220 } }); occludedInput.domMeasurements.layers[0].intersectsSubject = true;
const occluded = evaluateDeterministicPageQuality(occludedInput);
equal(occluded.subjectOcclusionStatus, "blocked"); ok(occluded.blockers.includes("SUBJECT_OCCLUSION"));
await rejects(async () => requireDeterministicPageQuality(occluded), /质量门禁未通过/);

const generatedWithoutEvidence = evaluateDeterministicPageQuality(inputFor(byId.get("normal"), { renderSource: "selected_ai_candidate", subjectBounds: null, backgroundRegions: [] }));
equal(generatedWithoutEvidence.preset.cardFill, "light_card", "unverified asset colors must use an opaque deterministic card");
const fallback = evaluateDeterministicPageQuality(inputFor(byId.get("explicit-fallback")));
equal(fallback.renderSource, "explicit_deterministic_fallback"); equal(fallback.evidence.providerCalls, 0); equal(fallback.deliveryEligibility, "eligible");

const flagOff = evaluateDeterministicPageQuality(inputFor(byId.get("normal"), { featureFlagEnabled: false }));
equal(flagOff.deliveryEligibility, "waiting_human_confirmation");
delete process.env.XHS_DETERMINISTIC_VISUAL_QUALITY_GATE;
equal(featureFlags().xhsDeterministicVisualQualityGate, false, "Feature Flag must default false");
ok(DETERMINISTIC_PRESETS.every((item) => ["dark_text", "light_text"].includes(item.textTone) && ["none", "light_scrim", "dark_scrim"].includes(item.overlay) && ["none", "light_card", "dark_card"].includes(item.cardFill) && ["comfortable", "compact"].includes(item.density)), "preset registry must be finite");

const legacyInput = structuredClone(byId.get("legacy-adapter").legacy);
const legacyBefore = JSON.stringify(legacyInput);
const legacy = adaptLegacyRenderQualityReadOnly(legacyInput);
equal(JSON.stringify(legacyInput), legacyBefore, "legacy adapter must be read only");
equal(legacy.canvasStatus, "legacy_quality_unknown"); equal(legacy.deliveryEligibility, "legacy_quality_unknown");

const tamperedReport = structuredClone(normal); tamperedReport.contrastStatus = "blocked";
assert.throws(() => validateDeterministicPageQualityReport(tamperedReport)); assertions += 1;
const unknownField = structuredClone(normal); unknownField.manualOverride = true;
assert.throws(() => validateDeterministicPageQualityReport(unknownField), /fields must be exact/); assertions += 1;

const bindingRoot = await mkdtemp(join(tmpdir(), "flowsocial-xhs-quality-binding-"));
try {
  const outputBytes = Buffer.from("offline-final-png-evidence");
  const backgroundBytes = Buffer.from("offline-background-version-one");
  const outputPath = "output/page.png"; const backgroundPath = "assets/background.bin";
  await mkdir(join(bindingRoot, "output"), { recursive: true }); await mkdir(join(bindingRoot, "assets"), { recursive: true });
  await writeFile(join(bindingRoot, outputPath), outputBytes); await writeFile(join(bindingRoot, backgroundPath), backgroundBytes);
  const digest = (value) => createHash("sha256").update(value).digest("hex");
  const boundInput = inputFor(byId.get("normal"), { allowedPresetIndexes: [2], outputPng: { path: outputPath, bytes: outputBytes.length, sha256: digest(outputBytes) }, backgroundAsset: { assetId: "bg_fixed", path: backgroundPath, sha256: digest(backgroundBytes), declaredSha256: digest(backgroundBytes) } });
  const boundReport = evaluateDeterministicPageQuality(boundInput);
  const declaredColorEvidence = JSON.stringify(boundReport.evidence.localBackgroundRegions);
  await verifyDeterministicPageQualityArtifacts(boundReport, { root: bindingRoot }); assertions += 1;
  await writeFile(join(bindingRoot, backgroundPath), Buffer.from("offline-background-version-two"));
  equal(JSON.stringify(boundReport.evidence.localBackgroundRegions), declaredColorEvidence, "declared local colors stay unchanged while background bytes are replaced");
  await rejects(async () => verifyDeterministicPageQualityArtifacts(boundReport, { root: bindingRoot }), /文件内容已变化/);
  await writeFile(join(bindingRoot, backgroundPath), backgroundBytes); await writeFile(join(bindingRoot, outputPath), Buffer.from("replaced-output"));
  await rejects(async () => verifyDeterministicPageQualityArtifacts(boundReport, { root: bindingRoot }), /文件内容已变化/);
} finally { await rm(bindingRoot, { recursive: true, force: true }); }

const roles = ["cover", "pain_list", "concept_definition", "process_flow", "permission_matrix", "gate_mechanism", "value_summary", "action_cta"];
const task = {
  id: "offline_deterministic_e2e", version: 1, platform: "xiaohongshu", ideaTitle: "确定性视觉质量",
  currentContent: {
    post_copy: { recommended_title: "确定性视觉质量" }, image_specs: [],
    deck: { pages: roles.map((role, index) => {
      const replay = fixture.fixedOfflineReplay[`P${index + 1}`];
      return ({ page_id: `P${index + 1}`, page_role: role, layout_type: XHS_PAGE_TEMPLATES[role].layoutType,
      headline: replay?.headline || `${index + 1}号确定性页面`, body_items: replay?.bodyItems || (index === 0 ? [] : ["固定中文真值", "局部对比度", "安全区门禁"]),
      supporting_text: index === 0 ? "精确画布" : "固定中文真值；局部对比度；安全区门禁",
      render_strategy: "html_css"
    }); }) }
  },
  accountStyleSnapshot: { name: "FlowSocial 离线样例" }, generatedAssets: []
};
task.visualStoryboard = createXhsVisualStoryboard(task);
confirmXhsVisualStoryboard(task, { confirmedBy: "offline-self-test" });

const root = await mkdtemp(join(tmpdir(), "flowsocial-xhs-quality-"));
let networkCalls = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { networkCalls += 1; throw new Error("offline E2E attempted network access"); };
try {
  const delivery = await renderContentDelivery(task, { root });
  equal(networkCalls, 0, "offline E2E must make zero network calls");
  equal(delivery.rendered.length, 8); equal(delivery.validation.status, "waiting_human_confirmation");
  equal(delivery.deterministicPageQualityReports.length, 8);
  ok(delivery.deterministicPageQualityReports.every((report) => report.canvasStatus === "passed" && report.contrastStatus === "passed" && report.overflowStatus === "passed" && report.safeAreaStatus === "passed" && report.subjectOcclusionStatus === "passed" && report.capacityStatus === "passed"));
  ok(delivery.deterministicPageQualityReports.every((report) => report.deliveryEligibility === "waiting_human_confirmation"));
  ok(delivery.rendered.every((item) => item.width === 1080 && item.height === 1440));
  ok(delivery.deterministicPageQualityReports.every((report) => /^[0-9a-f]{64}$/.test(report.evidence.outputPng.sha256) && report.evidence.domMeasurementSummary.layers.every((layer) => layer.bounds && Number.isFinite(layer.scrollHeight))));
  for (const pageId of ["P2", "P3", "P4", "P7"]) {
    ok(fixture.fixedOfflineReplay[pageId], `${pageId} replay fixture must be frozen`);
    const replay = delivery.deterministicPageQualityReports.find((report) => report.pageId === pageId);
    ok(replay && replay.overflowStatus === "passed" && replay.safeAreaStatus === "passed", `${pageId} fixed offline replay must pass real DOM geometry`);
  }
  ok(delivery.manifestPath && await readFile(join(root, delivery.manifestPath), "utf8"));
  await rejects(async () => createDeliveryZip(task, { root }), /等待人工确认/);
  equal(task.visualQualityConfirmation, undefined);

  const blockedTask = structuredClone(task);
  blockedTask.id = "offline_deterministic_blocked";
  blockedTask.visualStoryboard.contentTaskId = blockedTask.id;
  blockedTask.visualStoryboard.pages[0].qualityCropDetected = true;
  blockedTask.delivery = null;
  blockedTask.deterministicPageQualityReports = [];
  blockedTask.visualQualityConfirmation = { version: 1, decision: "approved", pixelAndSemanticReviewed: true };
  const blockedRoot = await mkdtemp(join(tmpdir(), "flowsocial-xhs-quality-blocked-"));
  try {
    const blockedDelivery = await renderContentDelivery(blockedTask, { root: blockedRoot });
    equal(blockedDelivery.validation.status, "needs_review");
    equal(blockedDelivery.manifestPath, null, "hard-blocked page must not write a new Manifest");
    await rejects(async () => readFile(join(blockedRoot, "artifacts", blockedTask.id, "v1", "manifest.json")), /ENOENT/);
    await rejects(async () => createDeliveryZip(blockedTask, { root: blockedRoot }), /质量门禁未通过/);
  } finally {
    await rm(blockedRoot, { recursive: true, force: true });
  }

  const domBlockedRoot = await mkdtemp(join(tmpdir(), "flowsocial-xhs-quality-dom-blocked-"));
  try {
    const items = Array.from({ length: 130 }, (_, index) => `<li>短项${index + 1}</li>`).join("");
    const negativeHtml = `<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}html,body{margin:0;width:1080px;height:1440px;overflow:hidden;background:#fff;color:#18352d}.copy{position:absolute;left:112px;top:245px;width:856px;height:1045px;background:#fff}h1{height:80px;overflow:hidden;font-size:58px}.content{height:300px;overflow:hidden;font-size:28px}.number{width:120px;height:60px;overflow:hidden;font-size:28px}.footer{position:absolute;left:112px;top:1315px;width:220px;height:35px;overflow:hidden;background:#fff;font-size:24px;white-space:nowrap}</style></head><body><main class="copy"><h1 data-quality-role="title">${"超长标题换行".repeat(120)}</h1><section class="content" data-quality-role="body"><ul>${items}</ul></section><div class="number" data-quality-role="number_card">${"卡片内容溢出".repeat(80)}</div></main><footer class="footer" data-quality-role="footer"><span>${"页脚裁切".repeat(80)}</span></footer></body></html>`;
    const htmlPath = join(domBlockedRoot, "negative.html"); const pngPath = join(domBlockedRoot, "negative.png"); await writeFile(htmlPath, negativeHtml);
    const measured = await renderHtmlToPngWithMeasurements(htmlPath, pngPath, { safeArea: fixture.safeArea, subjectBounds: null });
    const domReport = evaluateDeterministicPageQuality({ ...inputFor(byId.get("normal")), page: { headline: "超长标题换行".repeat(120), bodyItems: Array.from({ length: 130 }, (_, index) => `短项${index + 1}`) }, pageId: "DOM_NEGATIVE", allowedPresetIndexes: [2], domMeasurements: measured.domMeasurements, outputPng: { path: "negative.png", bytes: measured.bytes, sha256: measured.sha256 } });
    ok(domReport.blockers.includes("TEXT_OVERFLOW"), "real DOM overflow must hard-block");
    for (const role of ["title", "body", "number_card", "footer"]) ok(domReport.evidence.domMeasurementSummary.layers.find((layer) => layer.role === role)?.overflow, `${role} actual DOM overflow must be measured`);
    ok(domReport.blockers.includes("INFORMATION_CAPACITY_EXCEEDED"), "130 short list items must also exceed deterministic capacity");
  } finally { await rm(domBlockedRoot, { recursive: true, force: true }); }
} finally {
  globalThis.fetch = originalFetch;
  await rm(root, { recursive: true, force: true });
}

const appSource = await readFrontendSource();
for (const label of ["canvasStatus", "contrastStatus", "overflowStatus", "safeAreaStatus", "subjectOcclusionStatus", "capacityStatus", "deliveryEligibility"]) ok(appSource.includes(label), `UI must display ${label}`);
const serverSource = await readFile(resolve("apps/flowsocial/server.mjs"), "utf8");
ok(serverSource.includes("verifyDeterministicPageQualityArtifacts"), "server confirmation must re-verify bound artifacts");

process.stdout.write(`xhs deterministic visual quality self-test passed (${assertions} assertions, 8-page offline E2E, 0 network, 0 Provider, 0 credits, 0 active database writes)\n`);
