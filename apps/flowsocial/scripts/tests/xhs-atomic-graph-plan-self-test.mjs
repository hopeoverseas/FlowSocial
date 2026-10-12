import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { featureFlags } from "../../feature-flags.mjs";
import { hashUnifiedContent } from "../../content-agent/unified-content-contracts.mjs";
import {
  buildSkillExecutionPlan,
  buildUnifiedPlatformSkillExecutionPlan,
  refreshSkillExecutionPlan,
  resolveSkillExecutionPlanGraphMode
} from "../../content-agent/skill-execution-plan.mjs";

const CREATED_AT = "2026-08-06T00:00:00.000Z";
const FLAGS_ON = Object.freeze({ unifiedContentXhsAtomicGraphV1: true });
const FLAGS_OFF = Object.freeze({ unifiedContentXhsAtomicGraphV1: false });
const baseInput = Object.freeze({ platform: "xiaohongshu", createdAt: CREATED_AT });
const byteSha = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const LEGACY_BYTE_SHA = Object.freeze({
  xiaohongshu: "63428324281cf99d56a21d352c9a30763ea035755348c9ef98427cb909ae4b20",
  wechat: "854e0db29c8a063b66856d454dc267bc3c18427de13d6cebd301b8157572cbe6",
  unifiedXiaohongshu: "bff675826c9619175708b9e6dd471ea00f04c5ca82fc625150ee3553b8d64c51",
  unifiedWechat: "77ad57a300599c439290e30c05037b39487fdc87a2fd762ae65c57b89b909fa4"
});

const priorEnv = process.env.UNIFIED_CONTENT_XHS_ATOMIC_GRAPH_V1;
delete process.env.UNIFIED_CONTENT_XHS_ATOMIC_GRAPH_V1;
assert.equal(featureFlags().unifiedContentXhsAtomicGraphV1, false, "atomic graph flag must default false");
process.env.UNIFIED_CONTENT_XHS_ATOMIC_GRAPH_V1 = "true";
assert.equal(featureFlags().unifiedContentXhsAtomicGraphV1, true, "server environment may explicitly enable the flag");
if (priorEnv == null) delete process.env.UNIFIED_CONTENT_XHS_ATOMIC_GRAPH_V1;
else process.env.UNIFIED_CONTENT_XHS_ATOMIC_GRAPH_V1 = priorEnv;

const legacy = buildSkillExecutionPlan(baseInput);
const explicitOff = buildSkillExecutionPlan({ ...baseInput, serverFeatureFlags: FLAGS_OFF });
const callerOptionAttempt = buildSkillExecutionPlan({ ...baseInput, options: { featureFlags: FLAGS_ON } });
assert.deepEqual(explicitOff, legacy, "explicit server flag off must preserve the old plan exactly");
assert.deepEqual(callerOptionAttempt, legacy, "request-shaped options.featureFlags must not enable the atomic graph");
assert.equal(JSON.stringify(explicitOff), JSON.stringify(legacy), "flag-off JSON must be byte-for-byte unchanged");
assert.equal(hashUnifiedContent(explicitOff), hashUnifiedContent(legacy), "flag-off plan hash must be unchanged");
assert.equal(resolveSkillExecutionPlanGraphMode(legacy), "monolithic_v2");
assert.equal(legacy.schemaVersion, "1.2");
assert.equal(byteSha(legacy), LEGACY_BYTE_SHA.xiaohongshu, "flag-off XHS bytes must equal the base-commit golden fingerprint");
assert.equal(Object.hasOwn(legacy, "graphMode"), false, "legacy bytes must not gain a graphMode field");
assert.equal(legacy.steps.filter((step) => step.capability === "write-xhs-content").length, 1);
assert.deepEqual(legacy.steps.find((step) => step.capability === "write-xhs-content").retry, { maxAttempts: 2 });

const wechatLegacy = buildSkillExecutionPlan({ platform: "wechat", createdAt: CREATED_AT });
const wechatWithAtomicServerFlag = buildSkillExecutionPlan({ platform: "wechat", createdAt: CREATED_AT, serverFeatureFlags: FLAGS_ON });
assert.deepEqual(wechatWithAtomicServerFlag, wechatLegacy, "XHS atomic server flag must not affect WeChat plans");
assert.equal(wechatLegacy.schemaVersion, "1.2");
assert.equal(byteSha(wechatLegacy), LEGACY_BYTE_SHA.wechat, "flag-off WeChat bytes must equal the base-commit golden fingerprint");

const atomic = buildSkillExecutionPlan({ ...baseInput, serverFeatureFlags: FLAGS_ON });
assert.equal(atomic.schemaVersion, "2.0", "atomic graph additions require a new plan schema");
assert.equal(atomic.graphMode, "atomic_v4");
assert.equal(resolveSkillExecutionPlanGraphMode(atomic), "atomic_v4");
assert.equal(atomic.authorityFamily, "xhs_atomic_components_v4");
assert.equal(atomic.policy.monolithicFallbackAuthorized, false);
assert.equal(atomic.policy.atomicProviderMaxAttempts, 1);
assert.equal(atomic.policy.atomicAutomaticRetries, 0);
const exactAtomicIds = [
  "source_analysis", "pattern_review", "content_master", "outline", "outline_confirmation",
  "xhs_post_copy", "naturalization", "title", "title_consistency", "xhs_final_title_binding",
  "xhs_carousel", "xhs_visual_assets", "xhs_traceability", "xhs_preflight", "xhs_package",
  "schema_and_reference", "visual_design", "visual_provider_approval", "image_provider", "render",
  "visual_review", "visual_selection", "revision"
];
assert.deepEqual(atomic.steps.map((step) => step.id), exactAtomicIds, "atomic_v4 DAG step order must be exact");
assert.equal(atomic.steps.some((step) => step.capability === "write-xhs-content" || step.id === "platform_writer"), false);
for (const capability of ["write-xhs-post-copy", "plan-xhs-carousel", "plan-xhs-visual-assets"]) {
  const matches = atomic.steps.filter((step) => step.capability === capability);
  assert.equal(matches.length, 1, `${capability} must occur exactly once`);
  assert.deepEqual(matches[0].retry, { maxAttempts: 1, automaticRetries: 0 });
  assert.equal(matches[0].fallbackPolicy, "forbidden");
  assert.equal(matches[0].productionEligibleOutput, false);
}
assert.deepEqual(atomic.steps.find((step) => step.id === "xhs_post_copy").dependsOn, ["outline_confirmation"]);
assert.deepEqual(atomic.steps.find((step) => step.id === "title").dependsOn, ["xhs_post_copy"]);
assert.deepEqual(atomic.steps.find((step) => step.id === "xhs_final_title_binding").dependsOn, ["title_consistency"]);
assert.deepEqual(atomic.steps.find((step) => step.id === "xhs_carousel").dependsOn, ["xhs_final_title_binding"]);
assert.deepEqual(atomic.steps.find((step) => step.id === "xhs_visual_assets").dependsOn, ["xhs_carousel"]);
assert.deepEqual(atomic.steps.find((step) => step.id === "xhs_package").dependsOn, ["xhs_preflight"]);
assert.deepEqual(atomic.steps.find((step) => step.id === "schema_and_reference").dependsOn, ["xhs_package"]);
const skippedNaturalization = atomic.steps.find((step) => step.id === "naturalization");
assert.equal(skippedNaturalization.enabled, false);
assert.equal(skippedNaturalization.state, "skipped");
assert.equal(skippedNaturalization.invocationMode, "audit_only");

const atomicAudit = buildSkillExecutionPlan({ ...baseInput, serverFeatureFlags: FLAGS_ON, options: { naturalizationMode: "audit_only" } });
const plannedNaturalization = atomicAudit.steps.find((step) => step.id === "naturalization");
assert.equal(plannedNaturalization.enabled, true);
assert.equal(plannedNaturalization.invocationMode, "audit_only");
assert.deepEqual(atomicAudit.steps.find((step) => step.id === "title").dependsOn, ["naturalization"]);
for (const mode of ["rewrite_copy_only", "rewrite", "full_rewrite"]) {
  assert.throws(
    () => buildSkillExecutionPlan({ ...baseInput, serverFeatureFlags: FLAGS_ON, options: { naturalizationMode: mode } }),
    (error) => error.code === "XHS_ATOMIC_NATURALIZATION_REWRITE_FORBIDDEN" && error.details?.fieldPaths?.[0] === "options.naturalizationMode"
  );
}
assert.throws(
  () => refreshSkillExecutionPlan(atomic, { naturalizationMode: "rewrite_copy_only" }),
  (error) => error.code === "XHS_ATOMIC_NATURALIZATION_REWRITE_FORBIDDEN" && error.details?.fieldPaths?.[0] === "conditions.naturalizationMode"
);
const refreshedAudit = refreshSkillExecutionPlan(atomic, { naturalizationMode: "audit_only" });
assert.equal(refreshedAudit.steps.find((step) => step.id === "naturalization").invocationMode, "audit_only");
assert.deepEqual(refreshedAudit.steps.find((step) => step.id === "title").dependsOn, ["naturalization"]);
const refreshedSkipped = refreshSkillExecutionPlan(refreshedAudit, { naturalizationMode: null, enableNaturalization: false });
assert.deepEqual(refreshedSkipped.steps.find((step) => step.id === "title").dependsOn, ["xhs_post_copy"]);

const tamperedMixed = structuredClone(atomic);
tamperedMixed.steps.push(structuredClone(legacy.steps.find((step) => step.capability === "write-xhs-content")));
assert.throws(() => refreshSkillExecutionPlan(tamperedMixed), (error) => error.code === "XHS_GRAPH_AUTHORITY_FAMILY_MIXED");

const masterRef = { id: "shared-master-fixture", hash: "a".repeat(64) };
const unifiedAtomic = buildUnifiedPlatformSkillExecutionPlan({ ...baseInput, sharedContentMasterRef: masterRef, serverFeatureFlags: FLAGS_ON });
assert.equal(unifiedAtomic.schemaVersion, "2.0", "unified atomic builder must preserve the atomic plan schema");
assert.equal(unifiedAtomic.graphMode, "atomic_v4");
assert.equal(unifiedAtomic.steps.some((step) => step.id === "content_master"), false);
assert.equal(unifiedAtomic.steps.some((step) => step.id === "shared_content_master"), true);
assert.deepEqual(unifiedAtomic.steps.find((step) => step.id === "outline").dependsOn, ["shared_content_master"]);
assert.equal(hashUnifiedContent(unifiedAtomic), hashUnifiedContent(structuredClone(unifiedAtomic)), "atomic plan hash must be deterministic once graphMode is selected");
const unifiedLegacyXhs = buildUnifiedPlatformSkillExecutionPlan({ ...baseInput, sharedContentMasterRef: masterRef });
const unifiedLegacyWechat = buildUnifiedPlatformSkillExecutionPlan({ platform: "wechat", createdAt: CREATED_AT, sharedContentMasterRef: masterRef });
assert.equal(unifiedLegacyXhs.schemaVersion, "1.1");
assert.equal(unifiedLegacyWechat.schemaVersion, "1.1");
assert.equal(byteSha(unifiedLegacyXhs), LEGACY_BYTE_SHA.unifiedXiaohongshu, "flag-off unified XHS bytes must equal base");
assert.equal(byteSha(unifiedLegacyWechat), LEGACY_BYTE_SHA.unifiedWechat, "flag-off unified WeChat bytes must equal base");

console.log("xhs atomic graph plan self-test passed");
