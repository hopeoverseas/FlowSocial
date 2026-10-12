import assert from "node:assert/strict";
import { adaptWechatImagePlanOutput, hashWechatArtifactValue } from "../../content-agent/wechat-image-plan-adapter.mjs";
import {
  appendWechatFormatArtifactFact,
  appendWechatImagePlanArtifactFact,
  appendWechatQualityGateFact,
  appendWechatWholeArticleQualityFact,
  createWechatArtifactFactStore,
  evaluateWechatPreUploadArtifactState
} from "../../content-agent/wechat-artifact-facts.mjs";

const hash = (label) => hashWechatArtifactValue({ label });
const ref = (id) => ({ id, hash: hash(id) });
const factRef = (fact) => ({ id: fact.id, hash: fact.factHash });
const at = "2026-08-06T10:00:00.000Z";
const bindings = { contentProjectRef: ref("project"), platformRunRef: ref("run"), candidateRef: ref("candidate"), articleRef: ref("article"), imagePlanOutputFactRef: ref("plan-output") };

function fixture() {
  const store = createWechatArtifactFactStore();
  const canonicalPlan = adaptWechatImagePlanOutput({ plan_id: "whole-article-no-image", cover: { strategy: "no_image" }, slots: [] }, { bindings });
  const planFact = appendWechatImagePlanArtifactFact(store, { canonicalPlan, idempotencyKey: "plan", recordedAt: at });
  const html = "<section><h1>完整文章</h1><h2>问题</h2><p>有信息的段落。</p><h2>方法</h2><p>连续且可读。</p><p>行动建议与来源说明。</p></section>";
  const formatFact = appendWechatFormatArtifactFact(store, { planFact, html, idempotencyKey: "format", recordedAt: at });
  const qualityFacts = ["format", "mobile", "ocr", "fact", "license", "visual"].map((gate) => appendWechatQualityGateFact(store, {
    planFact, formatFact, gate, status: ["ocr", "fact", "license"].includes(gate) ? "not_applicable" : "passed",
    evidenceRefs: [ref(`six-${gate}`)], idempotencyKey: `six-${gate}`, recordedAt: at
  }));
  const preUploadRef = ref("preupload-payload");
  return { store, canonicalPlan, planFact, formatFact, qualityFacts, resourceAttempts: store.resourceAttempts, preUploadRef };
}

function goodEvidence(value) {
  const { canonicalPlan, planFact, formatFact, preUploadRef } = value;
  return {
    bindings: {
      articleRef: canonicalPlan.bindings.articleRef, imagePlanRef: { id: canonicalPlan.planId, hash: canonicalPlan.planHash }, imagePlanOutputFactRef: canonicalPlan.bindings.imagePlanOutputFactRef,
      planFactRef: factRef(planFact), formatFactRef: factRef(formatFact), preUploadRef,
      resourceAttemptRefs: [], resourceSetHash: hashWechatArtifactValue([])
    },
    content: {
      sectionContinuity: { status: "passed" }, informationDensity: { status: "passed" },
      imageNecessity: { status: "not_applicable" }, imageRedundancy: { status: "not_applicable" }, imageComplementarity: { status: "not_applicable" },
      cta: { status: "passed" }, sourceDisclaimer: { status: "passed" }
    },
    mobile: { viewports: [320, 375, 390, 430].map((width) => ({ width, rendered: true, readable: true, horizontalOverflow: false, styleLoss: false, brokenImages: [], fullPage: width === 390, evidenceRef: ref(`viewport-${width}`) })) },
    paste: {
      semantics: "pre_upload_template_not_wechat_final", rendered: true, readable: true, horizontalOverflow: false, styleLoss: false, brokenImages: [],
      copyArtifactRef: ref("copy-file"), htmlArtifactRef: { id: formatFact.id, hash: formatFact.htmlSha256 }, replacementManifestRef: ref("replacement-manifest"), pasteEvidenceRef: ref("paste-render"), localResourcePaths: []
    }
  };
}

function appendWhole(value, evidence, key) {
  return appendWechatWholeArticleQualityFact(value.store, { planFact: value.planFact, formatFact: value.formatFact, preUploadRef: value.preUploadRef, evidence, idempotencyKey: key, recordedAt: at });
}

const good = fixture();
const goodFact = appendWhole(good, goodEvidence(good), "whole-good");
assert.equal(goodFact.status, "passed");
const beforeHuman = evaluateWechatPreUploadArtifactState({ ...good, wholeArticleQualityFacts: good.store.wholeArticleQualityFacts, wholeArticleGateEnabled: true });
assert.deepEqual(beforeHuman.blockers, ["human_review_not_approved"]);
const afterHuman = evaluateWechatPreUploadArtifactState({ ...good, wholeArticleQualityFacts: good.store.wholeArticleQualityFacts, wholeArticleGateEnabled: true, humanReviewStatus: "approved" });
assert.equal(afterHuman.status, "pre_upload_ready");

const stale = evaluateWechatPreUploadArtifactState({ ...good, wholeArticleQualityFacts: good.store.wholeArticleQualityFacts, preUploadRef: ref("changed-preupload"), wholeArticleGateEnabled: false, humanReviewStatus: "approved" });
assert.equal(stale.blockers.includes("whole_article_quality_stale_or_failed"), true, "flag off must not bypass an activated candidate");

const legacy = fixture();
const legacyState = evaluateWechatPreUploadArtifactState({ ...legacy, wholeArticleQualityFacts: [], wholeArticleGateEnabled: false });
assert.deepEqual(legacyState.blockers, ["human_review_not_approved"], "an unactivated legacy candidate remains readable during rollback");
const missing = evaluateWechatPreUploadArtifactState({ ...legacy, wholeArticleQualityFacts: [], wholeArticleGateEnabled: true, humanReviewStatus: "approved" });
assert.deepEqual(missing.blockers, ["whole_article_quality_fact_required"]);

const cases = [
  ["断裂章节", (e) => { e.content.sectionContinuity.status = "failed"; }],
  ["信息稀薄", (e) => { e.content.informationDensity.status = "failed"; }],
  ["CTA 堆叠", (e) => { e.content.cta.status = "failed"; }],
  ["来源免责声明缺失", (e) => { e.content.sourceDisclaimer.status = "failed"; }],
  ["390 非整页", (e) => { e.mobile.viewports.find((item) => item.width === 390).fullPage = false; }],
  ["坏图", (e) => { e.mobile.viewports[0].brokenImages = ["missing.png"]; }],
  ["移动端溢出", (e) => { e.mobile.viewports[1].horizontalOverflow = true; }],
  ["样式丢失", (e) => { e.mobile.viewports[3].styleLoss = true; }],
  ["paste 语义错误", (e) => { e.paste.semantics = "wechat_final"; }],
  ["paste HTML 不一致", (e) => { e.paste.htmlArtifactRef = ref("other-html"); }],
  ["stale article hash", (e) => { e.bindings.articleRef = ref("changed-article"); }]
];
for (const [name, mutate] of cases) {
  const value = fixture();
  const evidence = goodEvidence(value);
  mutate(evidence);
  const fact = appendWhole(value, evidence, `bad-${name}`);
  assert.equal(fact.status, "failed", name);
  const approved = evaluateWechatPreUploadArtifactState({ ...value, wholeArticleQualityFacts: value.store.wholeArticleQualityFacts, wholeArticleGateEnabled: true, humanReviewStatus: "approved" });
  assert.notEqual(approved.status, "pre_upload_ready", `${name}: human approval cannot override blocker`);
}

const absent = fixture();
assert.equal(appendWhole(absent, null, "missing-evidence").status, "failed");

console.log(JSON.stringify({
  status: "wechat-whole-article-quality-self-test passed", goodBadFixtures: cases.length + 2,
  providerCalls: 0, imageProviderCalls: 0, platformCalls: 0, productionDatabaseCalls: 0
}, null, 2));
