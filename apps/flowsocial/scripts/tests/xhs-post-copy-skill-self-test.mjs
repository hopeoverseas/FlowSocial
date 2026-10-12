import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { createXhsPostCopy } from "../../content-agent/xhs-content-components.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, "../..");
const skillRoot = path.join(appRoot, "skills/write-xhs-post-copy");
const [skill, contract, openaiYaml] = await Promise.all([
  readFile(path.join(skillRoot, "SKILL.md"), "utf8"),
  readFile(path.join(skillRoot, "references/contract.md"), "utf8"),
  readFile(path.join(skillRoot, "agents/openai.yaml"), "utf8")
]);

const markerKeys = (name) => {
  const match = contract.match(new RegExp(`^${name}: ([^\\r\\n]+)$`, "m"));
  assert.ok(match, `missing contract marker ${name}`);
  return match[1].split(",");
};

const ENVELOPE_KEYS = markerKeys("XHS_POST_COPY_ENVELOPE_ROOT_KEYS_EXACT");
const DATA_KEYS = markerKeys("XHS_POST_COPY_CREATIVE_DATA_KEYS_EXACT");
const ENGAGEMENT_KEYS = markerKeys("XHS_ENGAGEMENT_STRATEGY_KEYS_EXACT");
const TITLE_KEYS = markerKeys("XHS_TITLE_CANDIDATE_KEYS_EXACT");
const SECTION_KEYS = markerKeys("XHS_BODY_SECTION_KEYS_EXACT");
const PROMOTION_KEYS = markerKeys("XHS_PROMOTION_USE_KEYS_EXACT");

const exactObject = (value, keys, field) => {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), `${field} must be an object`);
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), `${field} must have exact keys`);
};

const nonempty = (value, field) => assert.ok(typeof value === "string" && value.trim(), `${field} must be nonempty`);
const strings = (value, field, { min = 0, max = Infinity } = {}) => {
  assert.ok(Array.isArray(value), `${field} must be an array`);
  assert.ok(value.length >= min && value.length <= max, `${field} length out of range`);
  for (const item of value) nonempty(item, `${field}[]`);
  assert.equal(new Set(value).size, value.length, `${field} must be unique`);
};

const ROLE_MAP = new Map([
  ["hook", "scene"], ["problem", "problem"], ["diagnosis", "conclusion"],
  ["evidence", "evidence"], ["method", "method"], ["example", "evidence"],
  ["action", "summary"], ["boundary", "warning"]
]);

function validateCreativeData(value) {
  exactObject(value, DATA_KEYS, "data");
  assert.equal(value.schemaVersion, "1.0");
  assert.equal(value.contract, "XhsPostCopyCreativeOutput@1.0");
  nonempty(value.contentPromise, "contentPromise");

  exactObject(value.engagementStrategy, ENGAGEMENT_KEYS, "engagementStrategy");
  assert.equal(value.engagementStrategy.mode, "auto");
  assert.ok(["save", "share", "comment", "follow", "consult", "try", "buy", "register", "none"].includes(value.engagementStrategy.primaryAction));
  nonempty(value.engagementStrategy.reason, "engagementStrategy.reason");
  assert.ok(["body", "ending", "pinned_comment", "card", "none"].includes(value.engagementStrategy.ctaPlacement));
  assert.equal(typeof value.engagementStrategy.ctaText, "string");

  assert.ok(Array.isArray(value.titleCandidates));
  assert.ok(value.titleCandidates.length >= 3 && value.titleCandidates.length <= 5);
  for (const [index, candidate] of value.titleCandidates.entries()) {
    exactObject(candidate, TITLE_KEYS, `titleCandidates[${index}]`);
    nonempty(candidate.title, `titleCandidates[${index}].title`);
    assert.ok(["result", "problem", "contrast", "checklist", "question"].includes(candidate.hookType));
    strings(candidate.claimIds, `titleCandidates[${index}].claimIds`);
    assert.ok(["low", "medium", "high"].includes(candidate.risk));
  }
  nonempty(value.recommendedTitle, "recommendedTitle");
  assert.ok(value.titleCandidates.some(({ title }) => title === value.recommendedTitle));
  nonempty(value.opening, "opening");

  assert.ok(Array.isArray(value.bodySections) && value.bodySections.length > 0);
  for (const [index, section] of value.bodySections.entries()) {
    exactObject(section, SECTION_KEYS, `bodySections[${index}]`);
    nonempty(section.sectionId, `bodySections[${index}].sectionId`);
    assert.ok(ROLE_MAP.has(section.outlineRole));
    assert.equal(section.role, ROLE_MAP.get(section.outlineRole));
    nonempty(section.text, `bodySections[${index}].text`);
    strings(section.claimIds, `bodySections[${index}].claimIds`);
    strings(section.knowledgeAssetIds, `bodySections[${index}].knowledgeAssetIds`);
  }
  assert.equal(new Set(value.bodySections.map(({ sectionId }) => sectionId)).size, value.bodySections.length);
  nonempty(value.ending, "ending");
  assert.equal(typeof value.pinnedComment, "string");
  strings(value.hashtags, "hashtags", { min: 3, max: 8 });
  assert.equal(typeof value.cta, "string");

  exactObject(value.promotionUse, PROMOTION_KEYS, "promotionUse");
  assert.ok(["none", "soft", "focused"].includes(value.promotionUse.mode));
  strings(value.promotionUse.itemIds, "promotionUse.itemIds");
  assert.equal(typeof value.promotionUse.disclosure, "string");
  if (value.promotionUse.mode === "none") {
    assert.deepEqual(value.promotionUse.itemIds, []);
    assert.equal(value.promotionUse.disclosure, "");
  }
  return value;
}

function validateEnvelope(value) {
  exactObject(value, ENVELOPE_KEYS, "output");
  assert.ok(["success", "needs_review", "blocked"].includes(value.status), "invalid status");
  strings(value.warnings, "warnings");
  strings(value.blocked_reasons, "blocked_reasons");
  if (value.status === "success") {
    validateCreativeData(value.data);
    assert.deepEqual(value.blocked_reasons, [], "success cannot be blocked");
  } else {
    assert.equal(value.data, null, "non-success data must be null");
    assert.ok(value.blocked_reasons.length > 0, "non-success must explain blocking reason");
    if (value.status === "needs_review") assert.ok(value.warnings.length > 0, "needs_review must include a warning");
  }
  return value;
}

const validData = {
  schemaVersion: "1.0",
  contract: "XhsPostCopyCreativeOutput@1.0",
  contentPromise: "帮助目标读者完成一个明确动作",
  engagementStrategy: {
    mode: "auto",
    primaryAction: "save",
    reason: "步骤型内容适合保存后执行",
    ctaPlacement: "ending",
    ctaText: "先收藏，再按步骤完成。"
  },
  titleCandidates: [
    { title: "按这三步完成目标", hookType: "result", claimIds: ["fact-1"], risk: "low" },
    { title: "总卡住？先检查这三步", hookType: "problem", claimIds: [], risk: "low" },
    { title: "一份可执行的三步清单", hookType: "checklist", claimIds: [], risk: "low" }
  ],
  recommendedTitle: "按这三步完成目标",
  opening: "先把目标拆成三个可执行步骤。",
  bodySections: [
    {
      sectionId: "section-1",
      outlineRole: "hook",
      role: "scene",
      text: "从最常见的卡点开始。",
      claimIds: ["fact-1"],
      knowledgeAssetIds: ["knowledge-1"]
    }
  ],
  ending: "今天先完成第一步。",
  pinnedComment: "",
  hashtags: ["行动清单", "实用方法", "效率提升"],
  cta: "收藏后开始执行。",
  promotionUse: { mode: "none", itemIds: [], disclosure: "" }
};

const valid = { status: "success", data: validData, warnings: [], blocked_reasons: [] };
validateEnvelope(valid);
validateEnvelope({ status: "needs_review", data: null, warnings: ["需要人工确认内容边界"], blocked_reasons: ["内容边界尚未确认"] });
validateEnvelope({ status: "blocked", data: null, warnings: [], blocked_reasons: ["输入权威互相冲突"] });

const mustFail = (mutate, label) => {
  const value = structuredClone(valid);
  mutate(value);
  assert.throws(() => validateEnvelope(value), label);
};

mustFail((value) => { delete value.status; }, "missing envelope field");
mustFail((value) => { value.extra = true; }, "extra envelope field");
assert.throws(() => validateEnvelope(null), "null envelope");
assert.throws(() => validateEnvelope("copy"), "primitive envelope");
mustFail((value) => { value.status = null; }, "null status");
mustFail((value) => { value.status = 1; }, "primitive invalid status");
mustFail((value) => { value.warnings = null; }, "null warnings");
mustFail((value) => { value.warnings = "warning"; }, "primitive warnings");
mustFail((value) => { value.blocked_reasons = null; }, "null blocked_reasons");
mustFail((value) => { value.blocked_reasons = "blocked"; }, "primitive blocked_reasons");

mustFail((value) => { delete value.data.opening; }, "missing data field");
mustFail((value) => { value.data.visualPlan = {}; }, "extra data field");
mustFail((value) => { value.data = null; }, "null success data");
mustFail((value) => { value.data = "copy"; }, "primitive success data");

for (const invalid of [
  { status: "success", data: structuredClone(validData), warnings: [], blocked_reasons: ["not ready"] },
  { status: "needs_review", data: structuredClone(validData), warnings: ["review"], blocked_reasons: ["not ready"] },
  { status: "needs_review", data: null, warnings: [], blocked_reasons: ["not ready"] },
  { status: "needs_review", data: null, warnings: ["review"], blocked_reasons: [] },
  { status: "blocked", data: structuredClone(validData), warnings: [], blocked_reasons: ["conflict"] },
  { status: "blocked", data: null, warnings: [], blocked_reasons: [] }
]) {
  assert.throws(() => validateEnvelope(invalid), `invalid ${invalid.status} semantics`);
}

for (const [field, keys] of [
  ["engagementStrategy", ENGAGEMENT_KEYS],
  ["promotionUse", PROMOTION_KEYS]
]) {
  mustFail((value) => { delete value.data[field][keys[0]]; }, `missing ${field} field`);
  mustFail((value) => { value.data[field].extra = true; }, `extra ${field} field`);
  mustFail((value) => { value.data[field] = null; }, `null ${field}`);
  mustFail((value) => { value.data[field] = "invalid"; }, `primitive ${field}`);
}

for (const [field, keys] of [
  ["titleCandidates", TITLE_KEYS],
  ["bodySections", SECTION_KEYS]
]) {
  mustFail((value) => { delete value.data[field][0][keys[0]]; }, `missing ${field} item field`);
  mustFail((value) => { value.data[field][0].extra = true; }, `extra ${field} item field`);
  mustFail((value) => { value.data[field][0] = null; }, `null ${field} item`);
  mustFail((value) => { value.data[field][0] = "invalid"; }, `primitive ${field} item`);
}

const systemAuthorityBinding = {
  companyId: "company-1",
  accountId: "account-1",
  activeStrategySnapshotRef: { id: "strategy-1", hash: "1".repeat(64) },
  contentOpportunityRef: { id: "opportunity-1", hash: "2".repeat(64) },
  mechanismDecisionRef: { id: "mechanism-1", hash: "3".repeat(64) },
  contentProjectRef: { id: "project-1", hash: "4".repeat(64) },
  platformRunRef: { id: "run-1", hash: "5".repeat(64) },
  sharedContentMasterRef: { id: "content-master-1", hash: "6".repeat(64) },
  platformBriefRef: { id: "brief-1", hash: "7".repeat(64) },
  confirmedOutlineRef: { id: "outline-1", hash: "8".repeat(64) },
  writerContextRef: { id: "writer-context-1", hash: "9".repeat(64) },
  designDnaRef: { id: "design-dna-1", hash: "a".repeat(64) }
};
const assembleSuccess = (envelope) => {
  validateEnvelope(envelope);
  assert.equal(envelope.status, "success", "Adapter rejects non-success output");
  const { schemaVersion, contract, ...creativeFields } = envelope.data;
  assert.equal(schemaVersion, "1.0");
  assert.equal(contract, "XhsPostCopyCreativeOutput@1.0");
  return createXhsPostCopy({
    schemaVersion: "1.0",
    contract: "XhsPostCopy@1.0",
    id: "xhs-post-copy-1",
    authorityBinding: systemAuthorityBinding,
    ...creativeFields
  });
};
const { schemaVersion: creativeSchema, contract: creativeContract } = valid.data;
assert.equal(creativeSchema, "1.0");
assert.equal(creativeContract, "XhsPostCopyCreativeOutput@1.0");
const component = assembleSuccess(valid);
assert.equal(component.contract, "XhsPostCopy@1.0");
assert.match(component.componentHash, /^[a-f0-9]{64}$/);
assert.ok(Object.isFrozen(component));
assert.equal(component.opening, valid.data.opening);
assert.throws(() => assembleSuccess({ status: "needs_review", data: null, warnings: ["review"], blocked_reasons: ["not ready"] }), /Adapter rejects non-success/);
assert.throws(() => assembleSuccess({ status: "blocked", data: null, warnings: [], blocked_reasons: ["conflict"] }), /Adapter rejects non-success/);
for (const forbidden of ["carousel", "deck", "visualPlan", "imageSpec", "finalTitleBinding", "preflight", "trace", "publishStatus"]) {
  assert.equal(Object.hasOwn(component, forbidden), false, `${forbidden} must not enter XhsPostCopy`);
}

assert.match(skill, /ContentMaster/);
assert.match(skill, /confirmedOutline/);
assert.match(skill, /mechanismDecision/);
assert.match(skill, /promotionPolicy/);
assert.match(skill, /不得从公众号正文改写/);
assert.match(skill, /generate-platform-titles/);
assert.match(skill, /不规划 carousel page/);
assert.match(contract, /Provider 不得输出 `id`/);
assert.match(contract, /status=success/);
assert.match(contract, /needs_review/);
assert.match(contract, /blocked/);
assert.match(contract, /不得由 Adapter 组装、补值、改写或重试性修补/);
assert.match(openaiYaml, /display_name: "Write XHS Post Copy"/);
assert.match(openaiYaml, /\$write-xhs-post-copy/);

console.log("xhs-post-copy skill self-test passed");
