import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { stableHash } from "../image-providers/xhs-integrated-page/canonical.mjs";

export const XHS_PUBLISH_COMPLETE_CONTRACT = "XhsPublishCompleteEvidence@1.0";
export const INTERNAL_VISIBLE_TOKENS = Object.freeze([
  "evidence", "problem", "method", "summary", "cta", "cover", "page role",
  "page_id", "pageid", "archetype", "pattern"
]);

const nonEmpty = (value) => typeof value === "string" && value.trim().length > 0;
const unique = (items) => [...new Set(items)];
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const AUTHORITATIVE_SOURCE = Object.freeze({
  workItem: "FS-V1-WECHAT-CONTENT-12",
  commit: "3ff733378bb03cb0e6550b9ca1a843847c49acaf",
  originPath: "apps/flowsocial/scripts/fixtures/wechat-illustrated-delivery/source-article.md",
  contentSha256: "5d6dcf577df3536f3467c3c3804ed4dc0481faef8dcc184db5ccc266ccef605f"
});

export function validateXhsSourceRegistrySnapshot(snapshot, { originBytes = null } = {}) {
  const blockers = [];
  const authority = snapshot?.authority;
  if (snapshot?.schemaVersion !== "1.0" || snapshot?.contract !== "XhsPublishSourceRegistrySnapshot@1.0" || !nonEmpty(snapshot?.id)) blockers.push("SOURCE_REGISTRY_CONTRACT_INVALID");
  for (const key of ["workItem", "commit", "originPath", "contentSha256"]) if (authority?.[key] !== AUTHORITATIVE_SOURCE[key]) blockers.push(`SOURCE_AUTHORITY_NOT_ALLOWLISTED:${key}`);
  const expectedUri = `git-object://${AUTHORITATIVE_SOURCE.commit}/${AUTHORITATIVE_SOURCE.originPath}`;
  if (authority?.originUri !== expectedUri) blockers.push("SOURCE_ORIGIN_URI_INVALID");
  if (authority?.authorization !== "project-owned-authorized-content-task") blockers.push("SOURCE_AUTHORIZATION_INVALID");
  if (authority?.visibility !== "publishable") blockers.push("SOURCE_UNPUBLISHABLE");
  if (authority?.privacy !== "public") blockers.push("SOURCE_PRIVATE");
  if (!authority?.allowedPlatforms?.includes("xiaohongshu")) blockers.push("SOURCE_PLATFORM_NOT_ALLOWED");
  if (originBytes && sha256(originBytes) !== authority?.contentSha256) blockers.push("SOURCE_ORIGIN_CONTENT_HASH_MISMATCH");
  if (!Array.isArray(snapshot?.sources) || !snapshot.sources.length) blockers.push("SOURCE_REGISTRY_EMPTY");
  const ids = new Set();
  for (const source of snapshot?.sources || []) {
    if (!nonEmpty(source.id) || ids.has(source.id)) blockers.push(`SOURCE_ID_INVALID_OR_DUPLICATE:${source.id || "missing"}`);
    ids.add(source.id);
    if (!["authorized-task-content-source", "authorized-editorial-derivation"].includes(source.type)) blockers.push(`SOURCE_TYPE_INVALID:${source.id}`);
    if (source.originUri !== expectedUri || source.contentSha256 !== authority?.contentSha256) blockers.push(`SOURCE_ORIGIN_BINDING_INVALID:${source.id}`);
    if (!source.claimBindings || Object.keys(source.claimBindings).length === 0 || Object.values(source.claimBindings).some((hash) => !/^[a-f0-9]{64}$/.test(hash))) blockers.push(`SOURCE_CLAIM_BINDINGS_INVALID:${source.id}`);
  }
  return { status: blockers.length ? "blocked" : "passed", blockers, snapshotHash: stableHash(snapshot), sourceCount: snapshot?.sources?.length || 0 };
}

export function loadXhsSourceRegistrySnapshot(path, { gitCwd = process.cwd(), verifyOrigin = true } = {}) {
  const bytes = readFileSync(path);
  const snapshot = JSON.parse(bytes.toString("utf8").replace(/^\uFEFF/, ""));
  let originBytes = null;
  if (verifyOrigin) {
    const origin = spawnSync("git", ["show", `${snapshot.authority?.commit}:${snapshot.authority?.originPath}`], { cwd: gitCwd, encoding: null, windowsHide: true, maxBuffer: 10 * 1024 * 1024 });
    if (origin.status !== 0) throw new Error("SOURCE_AUTHORITY_GIT_OBJECT_UNAVAILABLE");
    originBytes = origin.stdout;
  }
  const validation = validateXhsSourceRegistrySnapshot(snapshot, { originBytes });
  return { snapshot, bytes, sha256: sha256(bytes), validation };
}

function visibleTexts(packageValue) {
  const data = packageValue.data;
  return [
    ...data.post_copy.title_candidates.map((item) => item.title),
    data.post_copy.recommended_title,
    data.post_copy.opening,
    ...data.post_copy.body_sections.map((item) => item.text),
    data.post_copy.ending,
    data.post_copy.pinned_comment,
    ...data.post_copy.hashtags,
    data.post_copy.cta,
    ...data.deck.pages.flatMap((page) => page.text_layers.map((layer) => layer.text))
  ].filter(nonEmpty);
}

function normalizedTerms(value) {
  return unique(String(value).replace(/[，。！？；：、“”‘’（）《》｜|\n\r\s]/g, "").split("").filter(Boolean));
}

function similarity(left, right) {
  const a = new Set(normalizedTerms(left));
  const b = new Set(normalizedTerms(right));
  const intersection = [...a].filter((item) => b.has(item)).length;
  const union = new Set([...a, ...b]).size;
  return union ? intersection / union : 0;
}

export function scanInternalVisibleTokens(texts) {
  const joined = texts.join("\n");
  const tokens = INTERNAL_VISIBLE_TOKENS.filter((token) => new RegExp(`(^|[^a-z])${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`, "i").test(joined));
  if (/\bP\d+\b/i.test(joined)) tokens.push("P<page-number>");
  return unique(tokens);
}

export function validateXhsPublishCompletePackage(packageValue, { sourceRegistry = null } = {}) {
  const blockers = [];
  const data = packageValue?.data;
  if (packageValue?.status !== "success" || data?.platform !== "xiaohongshu") blockers.push("PACKAGE_IDENTITY_INVALID");
  const copy = data?.post_copy;
  if (!copy || !Array.isArray(copy.title_candidates) || copy.title_candidates.length < 3 || copy.title_candidates.length > 8) blockers.push("TITLE_CANDIDATE_COUNT_INVALID");
  if (!nonEmpty(copy?.recommended_title) || !copy?.title_candidates?.some((item) => item.title === copy.recommended_title)) blockers.push("RECOMMENDED_TITLE_NOT_CANDIDATE");
  if (!nonEmpty(copy?.opening) || !Array.isArray(copy?.body_sections) || copy.body_sections.length < 3 || !copy.body_sections.every((item) => nonEmpty(item.text))) blockers.push("PUBLISH_BODY_INCOMPLETE");
  if (!Array.isArray(copy?.hashtags) || copy.hashtags.length < 3 || copy.hashtags.length > 8 || !copy.hashtags.every((item) => /^#[^#\s]+$/.test(item))) blockers.push("HASHTAGS_INVALID");
  if (!nonEmpty(copy?.pinned_comment) || !nonEmpty(copy?.cta)) blockers.push("PINNED_COMMENT_OR_CTA_MISSING");

  const pages = data?.deck?.pages;
  if (!Array.isArray(pages) || pages.length < 6 || pages.length > 8) blockers.push("CONTENT_DRIVEN_PAGE_COUNT_INVALID");
  if (Array.isArray(pages)) {
    if (stableHash(pages.map((page) => page.page)) !== stableHash(Array.from({ length: pages.length }, (_, index) => index + 1))) blockers.push("PAGE_SEQUENCE_INVALID");
    if (pages.filter((page) => page.role === "cover").length !== 1 || pages.filter((page) => page.role === "cta").length !== 1) blockers.push("COVER_OR_CTA_COUNT_INVALID");
    if (!pages.every((page) => nonEmpty(page.reader_question) && nonEmpty(page.takeaway) && Array.isArray(page.text_layers) && page.text_layers.length > 0)) blockers.push("PAGE_INFORMATION_CONTRACT_INCOMPLETE");
    if (unique(pages.map((page) => page.reader_question)).length !== pages.length || unique(pages.map((page) => page.takeaway)).length !== pages.length) blockers.push("PAGE_QUESTION_OR_TAKEAWAY_REPEATED");
    for (let index = 1; index < pages.length; index += 1) {
      const prior = pages[index - 1].text_layers.map((layer) => layer.text).join(" ");
      const current = pages[index].text_layers.map((layer) => layer.text).join(" ");
      if (similarity(prior, current) > 0.72) blockers.push(`ADJACENT_PAGE_SEMANTIC_REPETITION:P${index}:P${index + 1}`);
    }
    const ctaTexts = pages.flatMap((page) => page.text_layers.filter((layer) => layer.type === "cta").map((layer) => layer.text));
    if (ctaTexts.length !== 1 || ctaTexts[0] !== copy?.cta) blockers.push("SINGLE_CTA_BINDING_INVALID");
  }

  const claims = data?.traceability?.claims;
  const claimMap = new Map((claims || []).map((item) => [item.claim_id, item]));
  if (!Array.isArray(claims) || !claims.length || claims.some((item) => !nonEmpty(item.claim_id) || !Array.isArray(item.source_refs) || !item.source_refs.every(nonEmpty))) blockers.push("CLAIM_SOURCE_REGISTRY_INVALID");
  const refs = [
    ...(copy?.title_candidates || []).flatMap((item) => item.claim_ids || []),
    ...(copy?.body_sections || []).flatMap((item) => item.claim_ids || []),
    ...(pages || []).flatMap((page) => [...(page.fact_ids || []), ...(page.interpretation_ids || [])])
  ];
  for (const id of unique(refs)) if (!claimMap.has(id)) blockers.push(`CLAIM_REFERENCE_MISSING:${id}`);
  const sourceValidation = sourceRegistry ? validateXhsSourceRegistrySnapshot(sourceRegistry) : { status: "blocked", blockers: ["SOURCE_REGISTRY_REQUIRED"] };
  blockers.push(...sourceValidation.blockers);
  const sourceMap = new Map((sourceRegistry?.sources || []).map((item) => [item.id, item]));
  for (const claim of claims || []) {
    for (const sourceRef of claim.source_refs || []) {
      const source = sourceMap.get(sourceRef);
      if (!source) blockers.push(`CLAIM_SOURCE_MISSING:${claim.claim_id}:${sourceRef}`);
      else if (source.claimBindings?.[claim.claim_id] !== sha256(Buffer.from(claim.text, "utf8"))) blockers.push(`CLAIM_SOURCE_HASH_MISMATCH:${claim.claim_id}:${sourceRef}`);
    }
  }

  const leaked = scanInternalVisibleTokens(visibleTexts(packageValue));
  if (leaked.length) blockers.push(`INTERNAL_ROLE_TOKEN_LEAK:${leaked.join("|")}`);
  const body = [copy?.opening, ...(copy?.body_sections || []).map((item) => item.text), copy?.ending].filter(Boolean).join("");
  const deck = (pages || []).flatMap((page) => page.text_layers.map((layer) => layer.text)).join("");
  if (similarity(body, deck) > 0.68) blockers.push("BODY_DECK_NOT_COMPLEMENTARY");

  return {
    schemaVersion: "1.0",
    contract: XHS_PUBLISH_COMPLETE_CONTRACT,
    status: blockers.length ? "blocked" : "passed",
    checks: {
      titleCandidates: copy?.title_candidates?.length || 0,
      hashtags: copy?.hashtags?.length || 0,
      pages: pages?.length || 0,
      uniqueReaderQuestions: pages ? unique(pages.map((page) => page.reader_question)).length : 0,
      uniqueTakeaways: pages ? unique(pages.map((page) => page.takeaway)).length : 0,
      bodyDeckSimilarity: Number(similarity(body, deck).toFixed(4)),
      internalVisibleTokens: leaked,
      sourceBoundClaims: claims?.length || 0,
      sourceRegistryHash: sourceRegistry ? stableHash(sourceRegistry) : null,
      singleCta: copy?.cta || null
    },
    blockers,
    packageHash: stableHash(packageValue)
  };
}

export function build05ORuntimeInput(packageValue, { contentVersion = 4, sourceRegistry = null } = {}) {
  const quality = validateXhsPublishCompletePackage(packageValue, { sourceRegistry });
  if (quality.status !== "passed") throw new Error(`XHS_PUBLISH_PACKAGE_BLOCKED:${quality.blockers.join("|")}`);
  const pages = packageValue.data.deck.pages;
  const selections = {
    1: ["cover.promise", ["pattern.hierarchy.promise-focus", "pattern.hierarchy.thumbnail-legibility"]],
    2: ["explanation.concept-map", ["pattern.map.layered-system", "pattern.density.progressive-disclosure"]],
    3: ["list.key-points", ["pattern.list.equal-cards", "pattern.density.progressive-disclosure"]],
    4: ["list.key-points", ["pattern.list.equal-cards", "pattern.density.progressive-disclosure"]],
    5: ["list.key-points", ["pattern.list.equal-cards", "pattern.density.progressive-disclosure"]],
    6: ["list.key-points", ["pattern.list.equal-cards", "pattern.density.progressive-disclosure"]],
    7: ["summary.cta", ["pattern.cta.single-action", "pattern.hierarchy.thumbnail-legibility"]]
  };
  return {
    schemaVersion: "1.0",
    contract: "DesignXhsIntegratedPagesRuntimeInput@1.0",
    id: `05o-publish-complete-${quality.packageHash.slice(0, 16)}`,
    xhsPostPackage: structuredClone(packageValue),
    contentVersion,
    designDna: {
      snapshotId: "design-dna:05o:editorial-metaphor-v1",
      palette: ["酒红", "暖白纸张", "炭黑"],
      typographyRoles: ["主标题", "正文", "行动提示"],
      constraints: ["纸面编辑设计与单一隐喻", "逐字保留中文真值", "禁止网页、界面、仪表盘、组件库和卡片模板感", "不得让矩形信息卡成为主构图", "内部路由语义不得显示"]
    },
    authorizedAssets: [],
    providerCapability: { integratedChineseTypography: true, exactDimensions: false, referenceImages: false },
    pageDensity: Object.fromEntries(pages.map((page) => [`P${page.page}`, page.page === 1 || page.page === 7 ? "low" : "medium"])),
    visualSelection: {
      stylePackId: "editorial-metaphor",
      reason: "用户已确认 editorial-metaphor；七页按内容任务使用同一纸面编辑设计语言",
      pages: pages.map((page) => ({
        pageId: `P${page.page}`,
        archetypeId: selections[page.page][0],
        patternIds: selections[page.page][1],
        referenceAssetIds: [],
        verbatimTextOverride: null,
        stylePackId: page.page === 6 ? "friendly-handdrawn-tech" : null
      }))
    }
  };
}

export function validateObservedPageText({ pageId, expectedTexts, observedTexts, pseudoText = false }) {
  const canonicalVisibleText = (value) => String(value).replace(/\r\n?/g, "\n").replace(/[\t ]+/g, " ").trim();
  const observed = canonicalVisibleText(observedTexts.join("\n"));
  const leaked = scanInternalVisibleTokens(observedTexts);
  const missing = expectedTexts.filter((text) => canonicalVisibleText(text).split("\n").some((line) => !observed.includes(line)));
  const expectedNumbers = new Set(expectedTexts.join("\n").match(/\d+(?:\.\d+)?%?/g) || []);
  const observedNumbers = unique(observedTexts.join("\n").match(/\d+(?:\.\d+)?%?/g) || []);
  const extraNumbers = observedNumbers.filter((item) => !expectedNumbers.has(item));
  const blockers = [
    ...missing.map((text) => `OCR_EXPECTED_TEXT_MISSING:${text}`),
    ...(leaked.length ? [`INTERNAL_ROLE_TOKEN_LEAK:${leaked.join("|")}`] : []),
    ...extraNumbers.map((item) => `OCR_EXTRA_NUMBER:${item}`),
    ...(pseudoText ? ["OCR_PSEUDO_TEXT"] : [])
  ];
  return { pageId, status: blockers.length ? "failed" : "passed", expectedTexts, observedTexts, missing, extraNumbers, internalVisibleTokens: leaked, pseudoText, blockers };
}

export function loadXhsPackage(path) {
  const bytes = readFileSync(path);
  return { packageValue: JSON.parse(bytes.toString("utf8").replace(/^\uFEFF/, "")), bytes, sha256: sha256(bytes) };
}
