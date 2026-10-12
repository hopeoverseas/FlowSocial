import { readFrontendSource, readFrontendSourceSync } from "./helpers/frontend-source.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  LOCAL_PRODUCT_CAPABILITIES,
  LOCAL_PRODUCT_FLAG_DEFAULTS,
  LOCAL_PRODUCT_POLICY_VERSION,
  buildProductCapabilityPolicyReport
} from "../../product-capability-policy.mjs";
import { featureFlags } from "../../feature-flags.mjs";
import { applyLocalProductMode } from "../maintenance/product-mode-flags.mjs";

const names = LOCAL_PRODUCT_CAPABILITIES.map((item) => item.env);
assert.equal(new Set(names).size, names.length, "capability policy must not contain duplicate flags");
assert.equal(Object.keys(LOCAL_PRODUCT_FLAG_DEFAULTS).length, names.length);
assert.equal(LOCAL_PRODUCT_POLICY_VERSION, "5.0");

const env = {};
applyLocalProductMode(env);
const report = buildProductCapabilityPolicyReport(env);
assert.equal(report.mode, "local-package");
assert.equal(report.baselineReady, true);
assert.equal(report.externalEffectsClosed, true);
assert.deepEqual(report.deviations, []);
assert.deepEqual(report.unsafeDeviations, []);
assert.ok(report.counts.baseline > 0 && report.counts.controlled > 0 && report.counts.externalEffect > 0 && report.counts.experimental > 0);
assert.ok(report.capabilities.filter((item) => item.tier === "controlled").every((item) => item.effectiveState === "enabled"));
assert.ok(report.capabilities.filter((item) => ["external_effect", "experimental"].includes(item.tier)).every((item) => item.effectiveState === "disabled"));

const projectedFlags = Object.fromEntries(LOCAL_PRODUCT_CAPABILITIES.map((item) => [item.featureKey, env[item.env] === "1"]));
const alignedReport = buildProductCapabilityPolicyReport(env, projectedFlags);
assert.equal(alignedReport.runtimeFlagsAligned, true);
assert.deepEqual(alignedReport.runtimeMismatches, []);
assert.equal(new Set(LOCAL_PRODUCT_CAPABILITIES.map((item) => item.featureKey)).size, LOCAL_PRODUCT_CAPABILITIES.length, "policy feature keys must be unique");

for (const requiredClosedFlag of [
  "PLATFORM_PUBLISHING_V1",
  "UNIFIED_CONTENT_ATOMIC_WECHAT_PROMOTION_UPLOAD_DELIVERY_V1",
  "ATOMIC_WECHAT_DRAFT_CREATION_V1",
  "SKILL_AUTO_PROMOTION_V1",
  "XHS_INTEGRATED_PAGE_DIRECT_DELIVERY"
]) assert.equal(LOCAL_PRODUCT_FLAG_DEFAULTS[requiredClosedFlag], "0", `${requiredClosedFlag} must be explicitly closed`);

const overridden = { ...env, PLATFORM_PUBLISHING_V1: "1" };
const overriddenReport = buildProductCapabilityPolicyReport(overridden);
assert.equal(overriddenReport.externalEffectsClosed, false);
assert.deepEqual(overriddenReport.unsafeDeviations.map((item) => item.env), ["PLATFORM_PUBLISHING_V1"]);

const missingBaseline = { ...env, UNIFIED_CONTENT_PRODUCTION_V1: "0" };
const missingBaselineReport = buildProductCapabilityPolicyReport(missingBaseline);
assert.equal(missingBaselineReport.baselineReady, false);
assert.deepEqual(missingBaselineReport.missingBaseline.map((item) => item.env), ["UNIFIED_CONTENT_PRODUCTION_V1"]);

const priorPromotionEnv = Object.fromEntries(["CONTENT_PROMOTION_V1", "LOCAL_CONTENT_PROMOTION_V1", "LOCAL_PACKAGE_DELIVERY_V1"].map((name) => [name, process.env[name]]));
process.env.CONTENT_PROMOTION_V1 = "1";
delete process.env.LOCAL_CONTENT_PROMOTION_V1;
delete process.env.LOCAL_PACKAGE_DELIVERY_V1;
assert.equal(featureFlags().contentPromotionV1, true);
assert.equal(featureFlags().localContentPromotionV1, false, "legacy promotion must not open local immutable promotion");
assert.equal(featureFlags().localPackageDeliveryV1, false, "legacy promotion must not open local package delivery");
for (const [name, value] of Object.entries(priorPromotionEnv)) value == null ? delete process.env[name] : process.env[name] = value;

const [serverSource, systemRoutesSource, modeSource, startSource, appSource, cssSource, manifestSource] = await Promise.all([
  readFile(new URL("../../server.mjs", import.meta.url), "utf8"),
  readFile(new URL("../../http/system-routes.mjs", import.meta.url), "utf8"),
  readFile(new URL("../maintenance/product-mode-flags.mjs", import.meta.url), "utf8"),
  readFile(new URL("../maintenance/start-server.mjs", import.meta.url), "utf8"),
  readFrontendSource(),
  readFile(new URL("../../styles.css", import.meta.url), "utf8"),
  readFile(new URL("../../skills/skill-manifest.json", import.meta.url), "utf8")
]);
assert.match(serverSource, /buildProductCapabilityPolicyReport: \(flags\) => buildProductCapabilityPolicyReport\(process\.env, flags\)/);
assert.match(systemRoutesSource, /productCapabilityPolicy: runtime\.buildProductCapabilityPolicyReport\(flags\)/);
assert.match(modeSource, /LOCAL_PRODUCT_FLAG_DEFAULTS/);
assert.doesNotMatch(modeSource, /UNIFIED_CONTENT_PRODUCTION_V1:\s*"1"/, "maintenance launcher must not duplicate the root policy map");
assert.match(startSource, /productCapabilityPolicy\.missingBaseline/);
assert.match(startSource, /productCapabilityPolicy\.unsafeDeviations/);
assert.match(appSource, /renderProductCapabilityPolicy\(status\.productCapabilityPolicy, status\.skillRuntime\)/);
assert.match(appSource, /promotionEnabled: runtimeStatus\?\.featureFlags\?\.localContentPromotionV1 === true/);
assert.doesNotMatch(appSource, /localContentPromotionV1 \?\? runtimeStatus\?\.featureFlags\?\.contentPromotionV1/);
assert.match(cssSource, /\.product-capability-summary/);

const skillManifest = JSON.parse(manifestSource);
assert.equal(skillManifest.product_profile, "local-package");
const atomicSkills = skillManifest.p1.filter((item) => ["write-xhs-post-copy", "plan-xhs-carousel", "plan-xhs-visual-assets", "design-xhs-integrated-pages"].includes(item.capability));
assert.equal(atomicSkills.length, 4);
assert.ok(atomicSkills.every((item) => item.product_tier === "baseline" && item.product_profiles.includes("local-package") && item.feature_flag));
const policyFeatureKeys = new Set(LOCAL_PRODUCT_CAPABILITIES.map((item) => item.featureKey));
assert.ok(atomicSkills.every((item) => policyFeatureKeys.has(item.feature_flag)));

console.log("phase4-product-capability-policy-self-test: ok");
