import { stableHash } from "../image-providers/xhs-integrated-page/canonical.mjs";
import { normalizePngCandidate, readPngDimensions, sha256Bytes } from "../image-providers/xhs-integrated-page/png-normalizer.mjs";
import {
  makeBlocker, validateIntegratedVisualPageSpec, validatePageCandidate, validatePageFactCheck, validatePageTextCheck, validateXhsIntegratedVisualReview,
  VERTICAL_CONTRACTS, withHash
} from "../image-providers/xhs-integrated-page/vertical-contracts.mjs";

const clone = (value) => structuredClone(value);
const sorted = (value) => [...new Set((value || []).map(String))].sort();
const same = (left, right) => JSON.stringify(sorted(left)) === JSON.stringify(sorted(right));
const normalizeText = (value) => String(value || "").replace(/\s+/g, "").trim();
const reference = (value, hashField) => ({ id: value.id, hash: value[hashField] });

export function projectXhsPostPackageReadOnly(input) {
  const before = stableHash(input); const source = clone(input); const pages = source.pages || source.deck?.pages || [];
  const blockers = [];
  if (!source || !pages.length) blockers.push(makeBlocker("XHS_POST_PACKAGE_PAGES_MISSING", source?.id || "legacy", "旧包缺少可投影页面"));
  const contentTaskId = source.contentTaskId || source.content_task_id || source.id;
  const contentVersion = Number(source.contentVersion || source.content_version || source.version || 1);
  const truths = pages.map((page, index) => {
    const pageId = page.pageId || page.page_id || `P${index + 1}`; const headline = page.headline || (index === 0 ? source.post_copy?.recommended_title : null);
    const truthBase = {
      schemaVersion: "1.0", contract: "PageContentTruth@1.0", id: `truth:${contentTaskId}:v${contentVersion}:${pageId}`, contentTaskId, contentVersion, pageId,
      pageRole: page.pageRole || page.page_role || "content", headline: String(headline || ""), supportingText: Array.isArray(page.supportingText) ? page.supportingText : page.supporting_text ? [page.supporting_text] : [],
      labels: clone(page.labels || page.bodyItems || page.body_items || []), cta: page.cta || null, factIds: clone(page.factIds || page.fact_ids || []), protectedTerms: clone(page.protectedTerms || page.protected_terms || []),
      productNames: clone(page.productNames || page.product_names || []), properNouns: clone(page.properNouns || page.proper_nouns || []), numbers: clone(page.numbers || []), forbiddenClaims: clone(page.forbiddenClaims || page.forbidden_claims || [])
    };
    return { ...truthBase, truthHash: stableHash(truthBase) };
  });
  if (truths.some((truth) => !truth.headline)) blockers.push(makeBlocker("PAGE_CONTENT_TRUTH_INCOMPLETE", contentTaskId || "legacy", "页面标题真值缺失"));
  if (stableHash(input) !== before) throw new Error("XHS_POST_PACKAGE_ADAPTER_MUTATED_INPUT");
  return { source: "xhs_post_package_read_only_adapter", contentTaskId, contentVersion, truths, blockers, sourceHash: before };
}

export function createIntegratedVisualPageSpec({ truth, compositionGoal, informationHierarchy, brandDnaRef, referenceAssetIds = [], styleConstraints = [], protectedRegions = [], generationMode = "integrated_page_generation", sourceRefs = [], id }) {
  const base = {
    schemaVersion: "1.0", contract: VERTICAL_CONTRACTS.pageSpec, id, contentTaskId: truth.contentTaskId, contentVersion: truth.contentVersion, pageId: truth.pageId, pageRole: truth.pageRole,
    canvas: { width: 1080, height: 1440 }, contentTruthRef: truth.id, contentTruthHash: truth.truthHash, compositionGoal, informationHierarchy: clone(informationHierarchy), brandDnaRef: clone(brandDnaRef),
    referenceAssetIds: clone(referenceAssetIds), styleConstraints: clone(styleConstraints), protectedRegions: clone(protectedRegions),
    normalizationPolicy: { allowedModes: ["none", "fit_pad", "fit_crop", "resample"], padBackgroundStrategies: ["solid_brand_neutral_light", "solid_brand_neutral_dark"], nonUniformStretchAllowed: false, protectedRegionCropAllowed: false },
    generationMode, sourceRefs: clone(sourceRefs), blockers: []
  };
  const spec = withHash(base, "specHash"); validateIntegratedVisualPageSpec(spec); return spec;
}

export function createPageCandidate({ id, spec, compilerTrace, capabilityEvaluation, sourceBuffer, sourceRelativePath, providerStatus = "succeeded" }) {
  validateIntegratedVisualPageSpec(spec); const dimensions = readPngDimensions(sourceBuffer); const sourceAsset = { relativePath: sourceRelativePath, sha256: sha256Bytes(sourceBuffer), bytes: sourceBuffer.length, dimensions };
  const base = {
    schemaVersion: "1.0", contract: VERTICAL_CONTRACTS.candidate, id, contentTaskId: spec.contentTaskId, contentVersion: spec.contentVersion, pageId: spec.pageId,
    specRef: reference(spec, "specHash"), compilerTraceRef: { id: compilerTrace.id, hash: compilerTrace.traceHash }, capabilityEvaluationRef: { id: capabilityEvaluation.evaluationId || capabilityEvaluation.id, hash: capabilityEvaluation.evaluationHash || capabilityEvaluation.hash },
    generationMode: spec.generationMode, lifecycle: "experimental", sourceAsset, providerStatus, providerNativeDimensions: dimensions, providerNativeDimensionStatus: dimensions.width === 1080 && dimensions.height === 1440 ? "passed" : "failed",
    normalizationStatus: "pending", finalCanvasStatus: "pending", textStatus: "pending", factStatus: "pending", visualStatus: "pending", selectionStatus: "not_selected", costStatus: "historical_observation", blockers: []
  };
  const candidate = withHash(base, "candidateHash"); validatePageCandidate(candidate); return candidate;
}

function updateCandidate(candidate, changes) { const base = { ...clone(candidate), ...clone(changes) }; delete base.candidateHash; const next = withHash(base, "candidateHash"); validatePageCandidate(next); return next; }

export function normalizePageCandidate({ candidate, sourceBuffer, mode, outputRelativePath, protectedRegions = [], backgroundStrategy = null, createdAt, declaredSourceSha256 = null }) {
  validatePageCandidate(candidate);
  const normalized = normalizePngCandidate({ id: `normalization:${candidate.id}`, candidateRef: reference(candidate, "candidateHash"), sourceBuffer, sourceRelativePath: candidate.sourceAsset.relativePath, declaredSourceSha256: declaredSourceSha256 || candidate.sourceAsset.sha256, outputRelativePath, mode, protectedRegions, backgroundStrategy, createdAt });
  const candidateNext = updateCandidate(candidate, { providerNativeDimensionStatus: normalized.providerNativeDimensionStatus, normalizationStatus: normalized.record.status === "succeeded" ? "succeeded" : "blocked", finalCanvasStatus: normalized.finalCanvasStatus, blockers: [...candidate.blockers, ...normalized.record.blockers] });
  return { ...normalized, candidate: candidateNext };
}

function expectedText(truth) { return { headline: truth.headline, numbers: sorted(truth.numbers), productNames: sorted(truth.productNames), properNouns: sorted([...truth.properNouns, ...truth.protectedTerms]), cta: truth.cta }; }
export function evaluatePageText({ candidate, truth, observation, createdAt }) {
  validatePageCandidate(candidate); const expected = expectedText(truth); const observed = {
    headline: String(observation.headline || ""), numbers: sorted(observation.numbers), productNames: sorted(observation.productNames), properNouns: sorted(observation.properNouns), cta: observation.cta ?? null,
    extraText: sorted(observation.extraText), pseudoText: observation.pseudoText === true, confidence: Number(observation.confidence)
  };
  const matches = { headline: normalizeText(observed.headline) === normalizeText(expected.headline), numbers: same(observed.numbers, expected.numbers), productNames: same(observed.productNames, expected.productNames), properNouns: same(observed.properNouns, expected.properNouns), cta: normalizeText(observed.cta) === normalizeText(expected.cta), noExtraText: observed.extraText.length === 0, noPseudoText: !observed.pseudoText, confidence: observed.confidence >= 0.85 };
  const blockers = [];
  if (!matches.headline) blockers.push(makeBlocker("OCR_HEADLINE_MISMATCH", candidate.pageId, "标题漏字或错字"));
  if (!matches.numbers) blockers.push(makeBlocker("OCR_NUMBER_MISMATCH", candidate.pageId, "数字与真值不一致或存在额外数字"));
  if (!matches.productNames) blockers.push(makeBlocker("OCR_PRODUCT_NAME_MISMATCH", candidate.pageId, "英文产品名不一致"));
  if (!matches.properNouns) blockers.push(makeBlocker("OCR_PROPER_NOUN_MISMATCH", candidate.pageId, "中文专有名词不一致"));
  if (!matches.cta) blockers.push(makeBlocker("OCR_CTA_MISMATCH", candidate.pageId, "CTA 不一致"));
  if (!matches.noPseudoText) blockers.push(makeBlocker("OCR_PSEUDO_TEXT", candidate.pageId, "检测到伪文字"));
  if (!matches.noExtraText && observed.extraText.some((item) => /\d/.test(item))) blockers.push(makeBlocker("OCR_EXTRA_NUMBER", candidate.pageId, "出现真值外数字"));
  const status = blockers.length ? "failed" : !matches.confidence || !matches.noExtraText ? "review_required" : "passed";
  const base = { schemaVersion: "1.0", contract: VERTICAL_CONTRACTS.textCheck, id: `text-check:${candidate.id}`, candidateRef: reference(candidate, "candidateHash"), contentTruthRef: { id: truth.id, hash: truth.truthHash }, evaluationMode: "offline_fixture_assertion", expected, observed, matches, status, blockers, createdAt };
  const check = withHash(base, "checkHash"); validatePageTextCheck(check); return { check, candidate: updateCandidate(candidate, { textStatus: status, blockers: [...candidate.blockers, ...blockers] }) };
}

export function evaluatePageFacts({ candidate, truth, observedFactIds = [], extraClaims = [], createdAt }) {
  validatePageCandidate(candidate); const expectedFactIds = sorted(truth.factIds); const observed = sorted(observedFactIds); const blockers = [];
  if (!same(expectedFactIds, observed)) blockers.push(makeBlocker("FACT_REFERENCE_MISMATCH", candidate.pageId, "图片事实引用与页面真值不一致"));
  if (extraClaims.length) blockers.push(makeBlocker("FACT_EXTRA_CLAIM", candidate.pageId, "图片新增了内容真值之外的事实"));
  const status = blockers.length ? "failed" : "passed"; const base = { schemaVersion: "1.0", contract: VERTICAL_CONTRACTS.factCheck, id: `fact-check:${candidate.id}`, candidateRef: reference(candidate, "candidateHash"), contentTruthRef: { id: truth.id, hash: truth.truthHash }, evaluationMode: "offline_fixture_assertion", expectedFactIds, observedFactIds: observed, extraClaims: clone(extraClaims), status, blockers, createdAt };
  const check = withHash(base, "checkHash"); validatePageFactCheck(check); return { check, candidate: updateCandidate(candidate, { factStatus: status, blockers: [...candidate.blockers, ...blockers] }) };
}

export function evaluateIntegratedVisual({ candidate, assertion, createdAt }) {
  validatePageCandidate(candidate); const dimensions = ["hierarchyStatus", "semanticStatus", "brandingStatus", "watermarkLogoStatus", "crossPageStatus"]; const blockers = [];
  for (const key of dimensions) if (assertion[key] === "failed") blockers.push(makeBlocker(`VISUAL_${key.replace(/Status$/, "").toUpperCase()}_FAILED`, candidate.pageId, `${key} 离线断言失败`));
  const overallStatus = blockers.length ? "failed" : dimensions.some((key) => assertion[key] === "review_required" || assertion[key] === "not_checked") ? "review_required" : "passed";
  const base = { schemaVersion: "1.0", contract: VERTICAL_CONTRACTS.visualReview, id: `visual-review:${candidate.id}`, candidateRef: reference(candidate, "candidateHash"), evaluationMode: "offline_fixture_assertion", ...Object.fromEntries(dimensions.map((key) => [key, assertion[key]])), overallStatus, observations: clone(assertion.observations || []), blockers, createdAt };
  const review = withHash(base, "reviewHash"); validateXhsIntegratedVisualReview(review); return { review, candidate: updateCandidate(candidate, { visualStatus: overallStatus, blockers: [...candidate.blockers, ...blockers] }) };
}

export function assertCandidateSelectable(candidate) {
  validatePageCandidate(candidate); const blockers = [...candidate.blockers];
  if (candidate.finalCanvasStatus !== "passed") blockers.push(makeBlocker("FINAL_CANVAS_BLOCKED", candidate.pageId, "最终画布未通过"));
  if (candidate.textStatus !== "passed") blockers.push(makeBlocker("TEXT_GATE_BLOCKED", candidate.pageId, `textStatus=${candidate.textStatus}`));
  if (candidate.factStatus !== "passed") blockers.push(makeBlocker("FACT_GATE_BLOCKED", candidate.pageId, `factStatus=${candidate.factStatus}`));
  if (candidate.visualStatus !== "passed") blockers.push(makeBlocker("VISUAL_GATE_BLOCKED", candidate.pageId, `visualStatus=${candidate.visualStatus}`));
  if (blockers.length) throw Object.assign(new Error(`PAGE_CANDIDATE_NOT_SELECTABLE:${candidate.pageId}`), { code: "PAGE_CANDIDATE_NOT_SELECTABLE", blockers }); return candidate;
}

export function runOfflinePagePipeline(input) {
  if (input.flags?.xhsIntegratedPageOfflinePipeline !== true || input.flags?.xhsIntegratedPageOcrGate !== true) throw new Error("XHS_INTEGRATED_PAGE_OFFLINE_FLAGS_DISABLED");
  const candidate = createPageCandidate(input); const normalized = normalizePageCandidate({ candidate, ...input.normalization, sourceBuffer: input.sourceBuffer });
  const text = evaluatePageText({ candidate: normalized.candidate, truth: input.truth, observation: input.textObservation, createdAt: input.createdAt });
  const facts = evaluatePageFacts({ candidate: text.candidate, truth: input.truth, observedFactIds: input.observedFactIds, extraClaims: input.extraClaims, createdAt: input.createdAt });
  const visual = evaluateIntegratedVisual({ candidate: facts.candidate, assertion: input.visualAssertion, createdAt: input.createdAt });
  return { candidate: visual.candidate, normalization: normalized.record, sourceBytes: input.sourceBuffer, normalizedBytes: normalized.outputBuffer, textCheck: text.check, factCheck: facts.check, visualReview: visual.review, counters: { networkCalls: 0, providerCalls: 0, costCredits: 0, activeDatabaseWrites: 0, approvedPromotions: 0 } };
}
