import { createHash } from "node:crypto";

const escapePointer = (value) => String(value).replace(/~/g, "~0").replace(/\//g, "~1");
const unescapePointer = (value) => String(value).replace(/~1/g, "/").replace(/~0/g, "~");

function isObject(value) {
  return value && typeof value === "object";
}

function diff(before, after, path = "") {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  if (!isObject(before) || !isObject(after) || Array.isArray(before) !== Array.isArray(after)) {
    return [{ op: before === undefined ? "add" : after === undefined ? "remove" : "replace", path: path || "/", value: structuredClone(after) }];
  }
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  return [...keys].flatMap((key) => diff(before?.[key], after?.[key], `${path}/${escapePointer(key)}`));
}

function setAtPointer(target, pointer, value, op) {
  if (pointer === "/") return structuredClone(value);
  const parts = pointer.split("/").slice(1).map(unescapePointer);
  const leaf = parts.pop();
  let current = target;
  for (const part of parts) {
    if (!isObject(current[part])) current[part] = {};
    current = current[part];
  }
  if (op === "remove") {
    if (Array.isArray(current)) current.splice(Number(leaf), 1);
    else delete current[leaf];
  } else current[leaf] = structuredClone(value);
  return target;
}

function getAtPointer(target, pointer) {
  if (pointer === "/") return target;
  return pointer.split("/").slice(1).map(unescapePointer).reduce((current, part) => current?.[part], target);
}

function isWithin(path, prefixes) {
  return prefixes.some((prefix) => prefix === "/" || path === prefix || path.startsWith(`${prefix}/`));
}

function normalizedPageId(value) {
  const match = String(value || "").trim().match(/^p?(\d+)$/i);
  return match ? `P${Number(match[1])}` : null;
}

export function projectXhsPageTargets(content = {}, instruction = "") {
  const pages = Array.isArray(content?.deck?.pages) ? content.deck.pages : [];
  const requested = new Set();
  const input = String(instruction || "");
  for (const match of input.matchAll(/第\s*(\d+)\s*页/gu)) requested.add(`P${Number(match[1])}`);
  for (const match of input.matchAll(/\bP\s*(\d+)\b/giu)) requested.add(`P${Number(match[1])}`);
  return pages.map((page, index) => {
    const pageId = normalizedPageId(page?.page_id || page?.pageId) || `P${index + 1}`;
    return {
      page_id: pageId,
      page_number: index + 1,
      json_pointer: `/deck/pages/${index}`,
      editable_fields: ["headline", "supporting_text", "text_layers", "fact_ids", "interpretation_ids"],
      current: {
        headline: page?.headline || "",
        supporting_text: page?.supporting_text || "",
        text_layers: structuredClone(page?.text_layers || []),
        fact_ids: structuredClone(page?.fact_ids || []),
        interpretation_ids: structuredClone(page?.interpretation_ids || [])
      },
      targeted: requested.has(pageId)
    };
  }).filter((page) => page.targeted);
}

export function allowedXhsPageProjectionPrefixes(projection = []) {
  return (Array.isArray(projection) ? projection : []).flatMap((page) => (Array.isArray(page?.editable_fields) ? page.editable_fields : [])
    .map((field) => `${page.json_pointer}/${escapePointer(field)}`));
}

function canonicalizeXhsPagePointer(path, pages) {
  const match = String(path || "").match(/^\/deck\/pages\/(?:by-id\/|page_id=)?([^/]+)(\/.*)?$/i);
  if (!match) return path;
  const token = unescapePointer(match[1]);
  if (/^\d+$/.test(token)) return path;
  const pageId = normalizedPageId(token);
  if (!pageId) return path;
  const index = pages.findIndex((page, pageIndex) => (normalizedPageId(page?.page_id || page?.pageId) || `P${pageIndex + 1}`) === pageId);
  return index < 0 ? path : `/deck/pages/${index}${match[2] || ""}`;
}

export function canonicalizeXhsPageOperations(content = {}, operations = []) {
  const pages = Array.isArray(content?.deck?.pages) ? content.deck.pages : [];
  return (Array.isArray(operations) ? operations : []).map((operation) => ({
    ...operation,
    path: canonicalizeXhsPagePointer(operation?.path, pages)
  }));
}

function claimText(page = {}) {
  const layers = Array.isArray(page.text_layers) ? page.text_layers : [];
  const layerText = layers.flatMap((layer) => {
    if (typeof layer === "string") return [layer];
    if (Array.isArray(layer?.items)) return layer.items.map((item) => typeof item === "string" ? item : item?.text || item?.content || "");
    return [layer?.text || layer?.content || layer?.value || ""];
  });
  return [page.headline, page.supporting_text, ...layerText].filter(Boolean).join("。 ");
}

function riskyClaimFragments(value) {
  const structuralNumber = /^(?:第\s*)?\d+\s*(?:页|步|点|阶段|部分|条)$/;
  const risky = /(?:案例|客户|工厂|转化率|询盘|营收|销售额|响应时间|提升|增长|降低|缩短|减少|节省|翻倍|效果|成效|结果|保证|必然|一定|彻底|完全|零风险|100\s*%|\d+(?:\.\d+)?\s*(?:%|倍|万|元|天|小时|分钟|家|人次))/i;
  return String(value || "").split(/[。！？!?；;\n]+/).map((item) => item.trim()).filter((item) => item && !structuralNumber.test(item) && risky.test(item));
}

function semanticUnits(value) {
  const normalized = String(value || "").toLowerCase().replace(/[\s，。！？、；：,.!?;:()（）【】\[\]“”'"\-]/g, "").replace(/(?:案例|客户|企业|公司|工厂|通过|使用|实现|结果|效果|成效|提升|增长|降低|缩短|减少|节省|保证|一定|完全)/g, "");
  const units = new Set();
  for (let index = 0; index < normalized.length - 1; index += 1) units.add(normalized.slice(index, index + 2));
  return units;
}

function semanticallySupports(claim, fact) {
  const claimNormalized = String(claim || "").replace(/\s+/g, "");
  const factNormalized = String(fact || "").replace(/\s+/g, "");
  if (claimNormalized.length >= 6 && factNormalized.includes(claimNormalized)) return true;
  const claimUnits = semanticUnits(claim);
  const factUnits = semanticUnits(fact);
  if (!claimUnits.size || !factUnits.size) return false;
  const shared = [...claimUnits].filter((unit) => factUnits.has(unit)).length;
  return shared >= 2 && shared / claimUnits.size >= 0.18;
}

export function evaluateXhsPageFactClaims(content = {}, contentMaster = {}) {
  const facts = new Map((Array.isArray(contentMaster?.confirmed_facts) ? contentMaster.confirmed_facts : []).map((fact) => [fact.fact_id, fact]));
  const pages = Array.isArray(content?.deck?.pages) ? content.deck.pages : [];
  const failures = [];
  for (const [index, page] of pages.entries()) {
    const pageId = normalizedPageId(page?.page_id || page?.pageId) || `P${index + 1}`;
    const fragments = riskyClaimFragments(claimText(page));
    if (!fragments.length) continue;
    const factIds = Array.isArray(page?.fact_ids) ? page.fact_ids : [];
    const matchedFacts = factIds.map((id) => facts.get(id)).filter(Boolean);
    for (const fragment of fragments) {
      if (!matchedFacts.some((fact) => semanticallySupports(fragment, fact.fact))) {
        failures.push({ pageId, claimFingerprint: contentFingerprint(fragment).slice(0, 16), claimLength: fragment.length, factIds: structuredClone(factIds), reason: matchedFacts.length ? "FACT_SEMANTIC_MISMATCH" : "FACT_EVIDENCE_MISSING" });
      }
    }
  }
  return { schemaVersion: "1.0", status: failures.length ? "blocked" : "passed", failures };
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

function normalizedStringSet(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()))].sort();
}

function renderedLayerText(layer) {
  if (typeof layer === "string") return layer.trim();
  if (!layer || typeof layer !== "object") return "";
  const value = [layer.text, layer.content, layer.value, layer.title, layer.body].find((item) => typeof item === "string" && item.trim());
  return value?.trim() || "";
}

function textLayerSnapshot(layer) {
  if (typeof layer === "string") return { kind: null, text: layer.trim(), items: [] };
  if (!layer || typeof layer !== "object") return { kind: null, text: "", items: [] };
  const kindValue = [layer.type, layer.role, layer.kind].find((value) => typeof value === "string" && value.trim());
  const kind = kindValue ? kindValue.trim().toLowerCase() : null;
  const items = (Array.isArray(layer.items) ? layer.items : []).map((item) => textLayerSnapshot(item));
  return {
    kind,
    text: renderedLayerText(layer),
    items
  };
}

function xhsPageCopy(page = {}) {
  return {
    page_id: page.page_id || null,
    headline: page.headline || "",
    supporting_text: page.supporting_text || "",
    text_layers: (Array.isArray(page.text_layers) ? page.text_layers : []).map((layer) => textLayerSnapshot(layer)),
    fact_ids: normalizedStringSet(page.fact_ids),
    interpretation_ids: normalizedStringSet(page.interpretation_ids)
  };
}

function xhsBody(content = {}) {
  const copy = content.post_copy || {};
  return {
    recommended_title: copy.recommended_title || "",
    opening: copy.opening || "",
    body_sections: copy.body_sections || [],
    ending: copy.ending || "",
    cta: copy.cta || "",
    hashtags: copy.hashtags || [],
    deck_page_copy: (content.deck?.pages || []).map((page) => xhsPageCopy(page))
  };
}

function wechatBody(content = {}) {
  return {
    recommended_title: content.recommended_title || "",
    abstract: content.abstract || "",
    opening: content.opening || "",
    article_markdown: content.article_markdown || "",
    cta: content.cta || ""
  };
}

export function contentBodySnapshot(platform, content = {}) {
  return platform === "xiaohongshu" ? xhsBody(content) : wechatBody(content);
}

export function contentFingerprint(value) {
  return createHash("sha256").update(JSON.stringify(stableValue(value))).digest("hex");
}

export function contentBodyLength(platform, content = {}) {
  const body = contentBodySnapshot(platform, content);
  if (platform === "xiaohongshu") {
    const copy = body;
    const postCopyText = {
      recommended_title: copy.recommended_title,
      opening: copy.opening,
      body_sections: copy.body_sections,
      ending: copy.ending,
      cta: copy.cta,
      hashtags: copy.hashtags
    };
    const stringLength = (value) => typeof value === "string" ? value.length : Array.isArray(value) ? value.reduce((sum, item) => sum + stringLength(item), 0) : value && typeof value === "object" ? Object.values(value).reduce((sum, item) => sum + stringLength(item), 0) : 0;
    const layerTextLength = (layer) => String(layer?.text || "").length + (Array.isArray(layer?.items) ? layer.items.reduce((sum, item) => sum + layerTextLength(item), 0) : 0);
    const pageTextLength = copy.deck_page_copy.reduce((sum, page) => sum
      + String(page.headline || "").length
      + String(page.supporting_text || "").length
      + page.text_layers.reduce((layerSum, layer) => layerSum + layerTextLength(layer), 0), 0);
    return stringLength(postCopyText) + pageTextLength;
  }
  return JSON.stringify(body).replace(/[\[\]{}",:]/g, "").length;
}

export function describeContentChange(platform, before, after) {
  const operations = diff(before, after);
  const beforeBody = contentBodySnapshot(platform, before);
  const afterBody = contentBodySnapshot(platform, after);
  const beforeFingerprint = contentFingerprint(beforeBody);
  const afterFingerprint = contentFingerprint(afterBody);
  return {
    contentChanged: operations.length > 0,
    bodyChanged: beforeFingerprint !== afterFingerprint,
    beforeFingerprint,
    afterFingerprint,
    beforeBodyLength: contentBodyLength(platform, before),
    afterBodyLength: contentBodyLength(platform, after),
    bodyLengthDelta: contentBodyLength(platform, after) - contentBodyLength(platform, before),
    changedPaths: operations.map((item) => item.path)
  };
}

export function isExpansionInstruction(instruction = "") {
  return /(内容太少|太短|扩写|展开|写长|更详细|增加.{0,6}(内容|细节|例子|篇幅))/i.test(String(instruction));
}

export function validateRevisionChange(platform, instruction, before, after) {
  const change = describeContentChange(platform, before, after);
  const visualOnlyInstruction = /图片|封面|配图|视觉|image_spec|visual/i.test(String(instruction || ""));
  if (!change.contentChanged || (!change.bodyChanged && !visualOnlyInstruction)) return { accepted: false, code: "REVISION_NO_CONTENT_CHANGE", change };
  if (isExpansionInstruction(instruction) && (!change.bodyChanged || change.bodyLengthDelta <= 0)) {
    return { accepted: false, code: "REVISION_EXPANSION_NOT_APPLIED", change };
  }
  return { accepted: true, code: null, change };
}

export function allowedPatchPrefixes(platform, requestClass) {
  if (requestClass === "purpose_or_promotion" || requestClass === "claim") return ["/"];
  if (requestClass === "image_spec") return platform === "wechat" ? ["/image_plan"] : ["/image_specs", "/deck/pages"];
  if (requestClass === "page_text") return ["/deck/pages"];
  if (requestClass === "copy") return platform === "wechat"
    ? ["/recommended_title", "/title_candidates", "/abstract", "/opening", "/article_markdown", "/pull_quotes", "/key_takeaways", "/share_summary", "/share_reason", "/cta"]
    : ["/post_copy"];
  return [];
}

export function applyValidatedPatch(before, proposed, { allowedPrefixes, lockedPrefixes = [] }) {
  const proposedOperations = diff(before, proposed);
  const blockedOperations = proposedOperations.filter((operation) => !isWithin(operation.path, allowedPrefixes) || isWithin(operation.path, lockedPrefixes));
  const appliedOperations = proposedOperations.filter((operation) => !blockedOperations.includes(operation));
  let content = structuredClone(before);
  for (const operation of appliedOperations) content = setAtPointer(content, operation.path, operation.value, operation.op);
  return {
    schemaVersion: "1.0",
    status: blockedOperations.length ? "scoped" : "valid",
    content,
    operations: appliedOperations,
    blockedOperations,
    allowedPrefixes,
    lockedPrefixes
  };
}

export function applyValidatedOperations(before, proposedOperations, { allowedPrefixes, lockedPrefixes = [] }) {
  const operations = canonicalizeXhsPageOperations(before, proposedOperations);
  const invalidOperations = operations.filter((operation) => !["test", "replace", "add", "remove"].includes(operation?.op) || typeof operation?.path !== "string" || !operation.path.startsWith("/"));
  const failedTests = operations.filter((operation) => operation.op === "test" && JSON.stringify(getAtPointer(before, operation.path)) !== JSON.stringify(operation.value));
  if (invalidOperations.length || failedTests.length) {
    return { schemaVersion: "1.0", status: "invalid", content: structuredClone(before), operations: [], blockedOperations: [...invalidOperations, ...failedTests], failedTests, allowedPrefixes, lockedPrefixes };
  }
  const mutations = operations.filter((operation) => operation.op !== "test");
  const blockedOperations = mutations.filter((operation) => !isWithin(operation.path, allowedPrefixes) || isWithin(operation.path, lockedPrefixes));
  const appliedOperations = mutations.filter((operation) => !blockedOperations.includes(operation));
  let content = structuredClone(before);
  for (const operation of appliedOperations) content = setAtPointer(content, operation.path, operation.value, operation.op);
  return {
    schemaVersion: "1.0",
    status: blockedOperations.length ? "scoped" : "valid",
    content,
    operations: appliedOperations,
    blockedOperations,
    failedTests: [],
    allowedPrefixes,
    lockedPrefixes
  };
}
