import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { runContentSkill } from "./skill-runner.mjs";

const list = (value) => Array.isArray(value) ? value.filter(Boolean) : [];
const REPORT_CONTRACT = "DeterministicPageQualityReport@1.0";
const EXACT_CANVAS = Object.freeze({ width: 1080, height: 1440 });
const REPORT_KEYS = ["blockers", "canvasStatus", "capacityStatus", "contentTaskId", "contentVersion", "contract", "contrastStatus", "createdAt", "deliveryEligibility", "evidence", "featureFlagEnabled", "overflowStatus", "pageId", "preset", "renderSource", "reportHash", "reportId", "safeAreaStatus", "schemaVersion", "source", "subjectOcclusionStatus"].sort();
const EVIDENCE_KEYS = ["activeDatabaseWrites", "backgroundAsset", "canvas", "capacity", "costCredits", "domMeasurementSummary", "layers", "localBackgroundRegions", "networkCalls", "outputPng", "providerCalls", "safeArea", "subjectBounds"].sort();
const PRESET_KEYS = ["cardFill", "cardColor", "density", "overlay", "overlayColor", "textColor", "textTone"].sort();
const OUTPUT_KEYS = ["bytes", "path", "sha256"].sort();
const BACKGROUND_ASSET_KEYS = ["assetId", "colorEvidenceStatus", "declaredSha256", "integrityStatus", "path", "sha256"].sort();
const DOM_SUMMARY_KEYS = ["canvas", "layers", "safeArea", "subjectBounds"].sort();
const DOM_CANVAS_KEYS = ["clientHeight", "clientWidth", "height", "scrollHeight", "scrollWidth", "width", "x", "y"].sort();
const DOM_LAYER_KEYS = ["background", "bounds", "clientHeight", "clientWidth", "foreground", "insideSafeArea", "intersectsSubject", "overflow", "role", "scrollHeight", "scrollWidth", "text"].sort();
const LOCAL_REGION_KEYS = ["backgroundAssetSha256", "color", "role", "source"].sort();
const RECT_KEYS = ["height", "width", "x", "y"].sort();
const CANVAS_EVIDENCE_KEYS = ["cropDetected", "height", "width"].sort();
const NEW_STATUS = ["passed", "blocked"];
const STATUS_KEYS = ["canvasStatus", "contrastStatus", "overflowStatus", "safeAreaStatus", "subjectOcclusionStatus", "capacityStatus"];

export const DETERMINISTIC_CANVAS = EXACT_CANVAS;
export const DETERMINISTIC_SAFE_AREA = Object.freeze({ x: 72, y: 72, width: 936, height: 1296 });
export const DETERMINISTIC_PRESETS = Object.freeze([
  { textTone: "dark_text", textColor: "#18352d", overlay: "none", overlayColor: null, cardFill: "none", cardColor: null, density: "comfortable" },
  { textTone: "light_text", textColor: "#ffffff", overlay: "none", overlayColor: null, cardFill: "none", cardColor: null, density: "comfortable" },
  { textTone: "dark_text", textColor: "#18352d", overlay: "none", overlayColor: null, cardFill: "light_card", cardColor: "#ffffff", density: "comfortable" },
  { textTone: "light_text", textColor: "#ffffff", overlay: "none", overlayColor: null, cardFill: "dark_card", cardColor: "#18352d", density: "comfortable" },
  { textTone: "dark_text", textColor: "#18352d", overlay: "light_scrim", overlayColor: "#ffffffcc", cardFill: "none", cardColor: null, density: "comfortable" },
  { textTone: "light_text", textColor: "#ffffff", overlay: "dark_scrim", overlayColor: "#10231dcc", cardFill: "none", cardColor: null, density: "comfortable" },
  { textTone: "dark_text", textColor: "#18352d", overlay: "none", overlayColor: null, cardFill: "light_card", cardColor: "#ffffff", density: "compact" },
  { textTone: "light_text", textColor: "#ffffff", overlay: "none", overlayColor: null, cardFill: "dark_card", cardColor: "#18352d", density: "compact" }
]);

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function hash(value) { return createHash("sha256").update(typeof value === "string" ? value : stableStringify(value)).digest("hex"); }
function exactKeys(value, keys, label) { assert.deepEqual(Object.keys(value).sort(), keys, `${label} fields must be exact`); }
function reportHash(value) { const copy = structuredClone(value); delete copy.reportHash; return hash(copy); }
function rect(value = {}) { return { x: Number(value.x), y: Number(value.y), width: Number(value.width), height: Number(value.height) }; }
function validRect(value) { return value && [value.x, value.y, value.width, value.height].every(Number.isFinite) && value.width >= 0 && value.height >= 0; }
function contains(outer, inner) { return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height; }
function intersects(a, b) { return Boolean(a && b && a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y); }

function rgba(color) {
  const match = String(color || "").match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i);
  assert.ok(match, `unsupported deterministic color: ${color}`);
  const hex = match[1];
  return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16), a: match[2] ? parseInt(match[2], 16) / 255 : 1 };
}

function blend(top, bottom) {
  const a = top.a;
  const channel = (key) => Math.round(top[key] * a + bottom[key] * (1 - a));
  return { r: channel("r"), g: channel("g"), b: channel("b"), a: 1 };
}

function colorHex(color) { return `#${[color.r, color.g, color.b].map((value) => value.toString(16).padStart(2, "0")).join("")}`; }
function luminance(color) {
  const convert = (value) => { const unit = value / 255; return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * convert(color.r) + 0.7152 * convert(color.g) + 0.0722 * convert(color.b);
}
export function contrastRatio(foreground, background) {
  const a = luminance(rgba(foreground)); const b = luminance(rgba(background));
  return Number(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2));
}

function applyPresetBackground(color, preset) {
  let result = rgba(color);
  if (preset.overlayColor) result = blend(rgba(preset.overlayColor), result);
  if (preset.cardColor) result = rgba(preset.cardColor);
  return colorHex(result);
}

function defaultLayers(page = {}) {
  const body = list(page.bodyItems || page.body_items).join("；") || String(page.supportingText || page.supporting_text || "");
  return [
    { role: "title", text: String(page.headline || ""), bounds: { x: 112, y: 245, width: 856, height: 190 }, threshold: 3 },
    { role: "body", text: body, bounds: { x: 260, y: 500, width: 708, height: 690 }, threshold: 4.5 },
    { role: "number_card", text: list(page.bodyItems || page.body_items).map((_, index) => String(index + 1).padStart(2, "0")).join(" "), bounds: { x: 112, y: 500, width: 120, height: 180 }, threshold: 3 },
    { role: "footer", text: String(page.footer || "FlowSocial 内容工作台"), bounds: { x: 112, y: 1310, width: 856, height: 48 }, threshold: 4.5 }
  ];
}

function capacities(page, density) {
  const body = list(page.bodyItems || page.body_items).join("") || String(page.supportingText || page.supporting_text || "");
  const cards = list(page.bodyItems || page.body_items);
  const limits = density === "compact" ? { title: 54, body: 180, numberCard: 36, footer: 60 } : { title: 42, body: 130, numberCard: 28, footer: 50 };
  const values = { title: String(page.headline || "").length, body: body.length, numberCard: Math.max(0, ...cards.map((item) => String(item).length)), footer: String(page.footer || "FlowSocial 内容工作台").length };
  return { density, limits, values, passed: values.title <= limits.title && values.body <= limits.body && values.numberCard <= limits.numberCard && values.footer <= limits.footer };
}

function localContrast(layers, regions, preset) {
  return layers.map((layer) => {
    const local = preset.cardColor ? [preset.cardColor] : regions.filter((region) => intersects(layer.bounds, region)).map((region) => applyPresetBackground(region.color, preset));
    if (!local.length) return { ...layer, foreground: preset.textColor, localBackground: null, contrastRatio: 0, passed: false };
    const ratios = local.map((color) => ({ color, ratio: contrastRatio(preset.textColor, color) })).sort((a, b) => a.ratio - b.ratio);
    return { ...layer, foreground: preset.textColor, localBackground: ratios[0].color, contrastRatio: ratios[0].ratio, passed: ratios[0].ratio >= layer.threshold };
  });
}

export function selectDeterministicPreset(input = {}) {
  const page = input.page || {};
  const layers = list(input.layers).length ? input.layers.map((layer) => ({ ...layer, bounds: rect(layer.bounds) })) : defaultLayers(page);
  const regions = list(input.backgroundRegions).map((region) => ({ ...rect(region), color: region.color }));
  const allowed = Array.isArray(input.allowedPresetIndexes) && input.allowedPresetIndexes.length ? input.allowedPresetIndexes : DETERMINISTIC_PRESETS.map((_, index) => index);
  for (const index of allowed) {
    const preset = DETERMINISTIC_PRESETS[index];
    if (!preset) continue;
    const layerEvidence = localContrast(layers, regions, preset);
    const capacity = capacities(page, preset.density);
    if (layerEvidence.every((layer) => layer.passed) && capacity.passed) return { preset: structuredClone(preset), layers: layerEvidence, capacity };
  }
  const preset = structuredClone(DETERMINISTIC_PRESETS[allowed.find((index) => DETERMINISTIC_PRESETS[index]) ?? 0]);
  return { preset, layers: localContrast(layers, regions, preset), capacity: capacities(page, preset.density) };
}

export function validateDeterministicPageQualityReport(value) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  exactKeys(value, REPORT_KEYS, "report");
  assert.equal(value.schemaVersion, "1.0"); assert.equal(value.contract, REPORT_CONTRACT);
  for (const key of ["reportId", "createdAt", "source", "contentTaskId", "pageId", "renderSource"]) assert.ok(typeof value[key] === "string" && value[key]);
  assert.ok(Number.isInteger(value.contentVersion) && value.contentVersion >= 0);
  assert.equal(typeof value.featureFlagEnabled, "boolean");
  assert.ok(Array.isArray(value.blockers) && value.blockers.every((item) => typeof item === "string"));
  exactKeys(value.evidence, EVIDENCE_KEYS, "evidence");
  exactKeys(value.preset, PRESET_KEYS, "preset");
  exactKeys(value.evidence.canvas, CANVAS_EVIDENCE_KEYS, "canvas evidence");
  exactKeys(value.evidence.safeArea, RECT_KEYS, "safeArea evidence");
  if (value.evidence.subjectBounds) exactKeys(value.evidence.subjectBounds, RECT_KEYS, "subjectBounds evidence");
  if (value.source === "legacy_read_only_adapter") {
    for (const key of STATUS_KEYS) assert.equal(value[key], "legacy_quality_unknown");
    assert.equal(value.deliveryEligibility, "legacy_quality_unknown");
  } else {
    exactKeys(value.evidence.outputPng, OUTPUT_KEYS, "outputPng");
    assert.ok(value.evidence.outputPng.path && Number.isInteger(value.evidence.outputPng.bytes) && value.evidence.outputPng.bytes > 0);
    assert.match(value.evidence.outputPng.sha256, /^[0-9a-f]{64}$/);
    exactKeys(value.evidence.domMeasurementSummary, DOM_SUMMARY_KEYS, "domMeasurementSummary");
    exactKeys(value.evidence.domMeasurementSummary.canvas, DOM_CANVAS_KEYS, "dom canvas");
    exactKeys(value.evidence.domMeasurementSummary.safeArea, RECT_KEYS, "dom safeArea");
    if (value.evidence.domMeasurementSummary.subjectBounds) exactKeys(value.evidence.domMeasurementSummary.subjectBounds, RECT_KEYS, "dom subjectBounds");
    assert.deepEqual(value.evidence.domMeasurementSummary.safeArea, value.evidence.safeArea, "DOM and report safe areas must agree");
    assert.deepEqual(value.evidence.domMeasurementSummary.subjectBounds, value.evidence.subjectBounds, "DOM and report subject bounds must agree");
    assert.ok(Array.isArray(value.evidence.domMeasurementSummary.layers) && value.evidence.domMeasurementSummary.layers.length >= 3);
    for (const layer of value.evidence.domMeasurementSummary.layers) {
      exactKeys(layer, DOM_LAYER_KEYS, `dom layer ${layer.role}`);
      exactKeys(layer.bounds, RECT_KEYS, `${layer.role} bounds`);
      assert.equal(layer.insideSafeArea, contains(value.evidence.domMeasurementSummary.safeArea, layer.bounds), `${layer.role} safe-area relation mismatch`);
      assert.equal(layer.intersectsSubject, intersects(value.evidence.domMeasurementSummary.subjectBounds, layer.bounds), `${layer.role} subject relation mismatch`);
    }
    if (value.evidence.backgroundAsset) {
      exactKeys(value.evidence.backgroundAsset, BACKGROUND_ASSET_KEYS, "backgroundAsset");
      assert.match(value.evidence.backgroundAsset.sha256, /^[0-9a-f]{64}$/);
      if (value.evidence.backgroundAsset.declaredSha256) assert.match(value.evidence.backgroundAsset.declaredSha256, /^[0-9a-f]{64}$/);
      assert.ok(["verified", "mismatch"].includes(value.evidence.backgroundAsset.integrityStatus));
      assert.ok(["opaque_card_isolated", "unverified"].includes(value.evidence.backgroundAsset.colorEvidenceStatus));
      assert.ok(value.evidence.backgroundAsset.path);
    }
    for (const region of value.evidence.localBackgroundRegions) {
      exactKeys(region, LOCAL_REGION_KEYS, "localBackgroundRegion");
      if (value.evidence.backgroundAsset) assert.equal(region.backgroundAssetSha256, value.evidence.backgroundAsset.sha256);
    }
    for (const key of STATUS_KEYS) assert.ok(NEW_STATUS.includes(value[key]), `${key} invalid`);
    assert.ok(["blocked", "waiting_human_confirmation", "eligible"].includes(value.deliveryEligibility));
    const blocked = STATUS_KEYS.some((key) => value[key] === "blocked");
    assert.equal(value.blockers.length > 0, blocked, "blockers and statuses must agree");
    assert.equal(value.deliveryEligibility, blocked ? "blocked" : value.featureFlagEnabled ? "eligible" : "waiting_human_confirmation");
  }
  assert.equal(value.evidence.networkCalls, 0); assert.equal(value.evidence.providerCalls, 0); assert.equal(value.evidence.costCredits, 0); assert.equal(value.evidence.activeDatabaseWrites, 0);
  assert.equal(value.reportHash, reportHash(value));
  return value;
}

export function evaluateDeterministicPageQuality(input = {}) {
  const page = input.page || {};
  const canvas = { width: Number(input.canvas?.width), height: Number(input.canvas?.height), cropDetected: input.cropDetected === true };
  const safeArea = rect(input.safeArea || DETERMINISTIC_SAFE_AREA);
  const subjectBounds = input.subjectBounds ? rect(input.subjectBounds) : null;
  const regions = list(input.backgroundRegions).map((region) => ({ ...rect(region), color: region.color }));
  const renderSource = input.renderSource || "deterministic_layout";
  const selected = selectDeterministicPreset({ page, layers: input.layers, backgroundRegions: regions, allowedPresetIndexes: input.allowedPresetIndexes });
  const dom = input.domMeasurements;
  assert.ok(dom && typeof dom === "object", "final DOM measurements are required");
  const outputPng = { path: String(input.outputPng?.path || ""), bytes: Number(input.outputPng?.bytes), sha256: String(input.outputPng?.sha256 || "") };
  const backgroundAsset = input.backgroundAsset ? {
    assetId: String(input.backgroundAsset.assetId || "background"), path: String(input.backgroundAsset.path || ""),
    sha256: String(input.backgroundAsset.sha256 || ""), declaredSha256: input.backgroundAsset.declaredSha256 ? String(input.backgroundAsset.declaredSha256) : null,
    integrityStatus: input.backgroundAsset.declaredSha256 && input.backgroundAsset.declaredSha256 !== input.backgroundAsset.sha256 ? "mismatch" : "verified",
    colorEvidenceStatus: selected.preset.cardColor ? "opaque_card_isolated" : "unverified"
  } : null;
  const domLayers = list(dom.layers).map((layer) => {
    const bounds = rect(layer.bounds);
    const foreground = String(layer.foreground || selected.preset.textColor);
    const background = String(layer.background || "");
    let ratio = 0;
    try { ratio = background ? contrastRatio(foreground, background) : 0; } catch { ratio = 0; }
    const threshold = layer.role === "title" || layer.role === "number_card" ? 3 : 4.5;
    return { ...layer, bounds, foreground, background, insideSafeArea: contains(safeArea, bounds), intersectsSubject: intersects(subjectBounds, bounds), threshold, contrastRatio: ratio, passed: ratio >= threshold };
  });
  const blockers = [];
  const exactCanvas = canvas.width === EXACT_CANVAS.width && canvas.height === EXACT_CANVAS.height;
  if (!exactCanvas) blockers.push("CANVAS_NOT_EXACT_1080X1440");
  if (canvas.cropDetected) blockers.push("CANVAS_CROPPED");
  if (domLayers.some((layer) => layer.overflow || !contains({ x: 0, y: 0, width: canvas.width, height: canvas.height }, layer.bounds))) blockers.push("TEXT_OVERFLOW");
  if (domLayers.some((layer) => !layer.insideSafeArea)) blockers.push("SAFE_AREA_VIOLATION");
  if (domLayers.some((layer) => !layer.passed)) blockers.push("LOW_LOCAL_CONTRAST");
  if (!selected.capacity.passed) blockers.push("INFORMATION_CAPACITY_EXCEEDED");
  if (domLayers.some((layer) => layer.intersectsSubject)) blockers.push("SUBJECT_OCCLUSION");
  if (backgroundAsset?.integrityStatus === "mismatch") blockers.push("BACKGROUND_ASSET_SHA256_MISMATCH");
  if (backgroundAsset && backgroundAsset.colorEvidenceStatus === "unverified") blockers.push("BACKGROUND_COLOR_EVIDENCE_UNVERIFIED");
  const uniqueBlockers = [...new Set(blockers)];
  const domLayerSummary = domLayers.map(({ threshold, contrastRatio: measuredContrastRatio, passed, ...layer }) => layer);
  const status = (codes) => codes.some((code) => uniqueBlockers.includes(code)) ? "blocked" : "passed";
  const createdAt = input.createdAt || new Date().toISOString();
  const value = {
    schemaVersion: "1.0", contract: REPORT_CONTRACT,
    reportId: `dq_${hash(`${input.contentTaskId || "offline"}:${input.contentVersion || 0}:${input.pageId || page.pageId || page.page_id || "page"}:${createdAt}`).slice(0, 20)}`,
    createdAt, source: "deterministic_renderer", contentTaskId: String(input.contentTaskId || "offline"), contentVersion: Number(input.contentVersion || 0),
    pageId: String(input.pageId || page.pageId || page.page_id || "page"), renderSource,
    canvasStatus: status(["CANVAS_NOT_EXACT_1080X1440", "CANVAS_CROPPED"]),
    contrastStatus: status(["LOW_LOCAL_CONTRAST", "BACKGROUND_ASSET_SHA256_MISMATCH", "BACKGROUND_COLOR_EVIDENCE_UNVERIFIED"]),
    overflowStatus: status(["TEXT_OVERFLOW", "CANVAS_CROPPED"]), safeAreaStatus: status(["SAFE_AREA_VIOLATION"]),
    subjectOcclusionStatus: status(["SUBJECT_OCCLUSION"]), capacityStatus: status(["INFORMATION_CAPACITY_EXCEEDED"]),
    deliveryEligibility: uniqueBlockers.length ? "blocked" : input.featureFlagEnabled === true ? "eligible" : "waiting_human_confirmation",
    featureFlagEnabled: input.featureFlagEnabled === true, preset: selected.preset,
    evidence: {
      canvas, capacity: selected.capacity, layers: domLayers,
      localBackgroundRegions: domLayers.map((layer) => ({ role: layer.role, color: layer.background, source: selected.preset.cardColor ? "opaque_card" : "measured_dom_background", backgroundAssetSha256: backgroundAsset?.sha256 || null })),
      outputPng, backgroundAsset,
      domMeasurementSummary: { canvas: structuredClone(dom.canvas), layers: domLayerSummary, safeArea: structuredClone(safeArea), subjectBounds: subjectBounds ? structuredClone(subjectBounds) : null },
      networkCalls: 0, providerCalls: 0, costCredits: 0, activeDatabaseWrites: 0, safeArea, subjectBounds
    },
    blockers: uniqueBlockers, reportHash: ""
  };
  value.reportHash = reportHash(value);
  return validateDeterministicPageQualityReport(value);
}

export function adaptLegacyRenderQualityReadOnly(input = {}) {
  const before = stableStringify(input); const copy = structuredClone(input);
  const createdAt = new Date().toISOString();
  const preset = structuredClone(DETERMINISTIC_PRESETS[0]);
  const value = {
    schemaVersion: "1.0", contract: REPORT_CONTRACT, reportId: `dq_legacy_${hash(copy).slice(0, 16)}`, createdAt,
    source: "legacy_read_only_adapter", contentTaskId: String(copy.contentTaskId || "legacy"), contentVersion: Number(copy.version || 0), pageId: String(copy.pageId || "legacy_page"), renderSource: "legacy_render",
    canvasStatus: "legacy_quality_unknown", contrastStatus: "legacy_quality_unknown", overflowStatus: "legacy_quality_unknown", safeAreaStatus: "legacy_quality_unknown", subjectOcclusionStatus: "legacy_quality_unknown", capacityStatus: "legacy_quality_unknown", deliveryEligibility: "legacy_quality_unknown",
    featureFlagEnabled: false, preset,
    evidence: { canvas: { width: Number(copy.width || 0), height: Number(copy.height || 0), cropDetected: false }, capacity: null, layers: [], localBackgroundRegions: [], outputPng: null, backgroundAsset: null, domMeasurementSummary: null, networkCalls: 0, providerCalls: 0, costCredits: 0, activeDatabaseWrites: 0, safeArea: structuredClone(DETERMINISTIC_SAFE_AREA), subjectBounds: null },
    blockers: [], reportHash: ""
  };
  value.reportHash = reportHash(value);
  assert.equal(stableStringify(input), before, "legacy adapter mutated historical input");
  return validateDeterministicPageQualityReport(value);
}

export function requireDeterministicPageQuality(report) {
  validateDeterministicPageQualityReport(report);
  if (report.source !== "deterministic_renderer" || report.blockers.length || report.deliveryEligibility === "blocked") {
    throw Object.assign(new Error(`确定性页面质量门禁未通过：${report.blockers.join("、") || report.deliveryEligibility}`), { statusCode: 409, code: "XHS_DETERMINISTIC_QUALITY_BLOCKED", details: report.blockers });
  }
  return report;
}

export async function verifyDeterministicPageQualityArtifacts(report, { root }) {
  requireDeterministicPageQuality(report);
  const rootPath = resolve(root);
  const readBoundFile = async (entry, code) => {
    const path = resolve(rootPath, entry.path);
    if (path !== rootPath && !path.startsWith(`${rootPath}${sep}`)) throw Object.assign(new Error("质量证据路径越界"), { statusCode: 409, code });
    const buffer = await readFile(path);
    const fileHash = createHash("sha256").update(buffer).digest("hex");
    if (fileHash !== entry.sha256 || (entry.bytes && buffer.length !== entry.bytes)) throw Object.assign(new Error("质量证据绑定的文件内容已变化"), { statusCode: 409, code });
  };
  await readBoundFile(report.evidence.outputPng, "XHS_OUTPUT_PNG_HASH_MISMATCH");
  if (report.evidence.backgroundAsset) await readBoundFile(report.evidence.backgroundAsset, "XHS_BACKGROUND_ASSET_HASH_MISMATCH");
  return report;
}

export async function reviewRenderedXhsTask(task, { root, generateText, planStep = null }) {
  if (!task || task.platform !== "xiaohongshu") throw Object.assign(new Error("Visual review only supports Xiaohongshu tasks"), { statusCode: 400 });
  const rendered = list(task.delivery?.rendered).filter((item) => item.status === "succeeded" && item.pngPath);
  if (!task.delivery?.renderedAt || !rendered.length) {
    return {
      status: "pending_render",
      data: { decision: "pending", page_findings: [], deck_findings: [], passed_checks: [], rerun_stages: [] },
      warnings: ["Render the current Xiaohongshu version before visual review."],
      blocked_reasons: [],
      skillTrace: null
    };
  }
  const input = {
    rendered_pages: rendered.map((item) => ({ ...item, absolute_path: resolve(root, item.pngPath) })),
    xhs_post_package: task.currentContent,
    content_intent_profile: task.contentIntentProfile,
    content_master: task.contentMaster,
    design_dna: task.accountStyleSnapshot || {},
    current_version: task.version,
    render_log: task.delivery.validation || null
  };
  const failedChecks = list(task.delivery?.validation?.checks).filter((item) => item.result === "fail");
  const fallback = {
    status: failedChecks.length ? "needs_review" : "success",
    data: {
      decision: failedChecks.length ? "revise" : "pass",
      page_findings: [],
      deck_findings: failedChecks.map((item, index) => ({ finding_id: `XVF${index + 1}`, severity: "warning", issue: item.check, evidence: item.detail || "renderer_validation", patch: null })),
      passed_checks: list(task.delivery?.validation?.checks).filter((item) => item.result === "pass").map((item) => item.check),
      rerun_stages: failedChecks.length ? ["Renderer"] : []
    },
    warnings: ["Fallback review validates renderer metadata only; pixel-level review requires a multimodal provider."],
    blocked_reasons: []
  };
  const result = await runContentSkill({
    capability: "review-xhs-visuals",
    platform: "xiaohongshu",
    input,
    generateText,
    fallback,
    expectedContract: "XhsVisualReview@1.0",
    task: "review_xhs_visuals",
    planStep
  });
  const automated = result?.data || fallback;
  return {
    ...automated,
    status: "waiting_human_confirmation",
    data: { ...(automated.data || {}), automated_decision: automated.data?.decision || "pending", decision: "pending_human_confirmation" },
    warnings: [...list(automated.warnings), "当前模型调用未读取真实像素或图片语义；渲染结果必须由用户人工确认。"],
    humanConfirmationRequired: true,
    skillTrace: result.skillTrace,
    executionRecord: result.executionRecord,
    providerMode: result.mode || "unknown"
  };
}
