import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const tests = [
  "product-mode-flags-self-test.mjs",
  "public-seed-bootstrap-self-test.mjs",
  "http-security-boundaries-self-test.mjs",
  "phase4-product-capability-policy-self-test.mjs",
  "phase5-refactor-guardrails-self-test.mjs",
  "phase5-server-domain-routes-self-test.mjs",
  "phase6-legacy-content-run-retirement-self-test.mjs",
  "phase7-content-run-removal-self-test.mjs",
  "unified-content-promotion-ui-self-test.mjs",
  "skill-runtime-product-workflows-self-test.mjs",
  "content-production-studio-ui-self-test.mjs",
  "initial-account-hydration-ui-self-test.mjs",
  "responsive-layout-contract-self-test.mjs",
  "app-foundation-self-test.mjs",
  "content-chain-authority-self-test.mjs",
  "phase3-content-chain-cutover-self-test.mjs",
  "unified-xhs-preparation-routes-self-test.mjs",
  "unified-content-product-api-self-test.mjs",
  "atomic-review-queue-cutover-self-test.mjs",
  "strategy-feedback-cycle-self-test.mjs",
  "topic-adjustment-session-self-test.mjs",
  "unified-platform-outline-confirmation-self-test.mjs",
  "unified-default-dual-composition-self-test.mjs",
  "planning-attempt-receipt-self-test.mjs",
  "planning-attempt-receipt-composition-self-test.mjs",
  "planning-provider-recovery-self-test.mjs",
  "outline-review-recovery-self-test.mjs",
  "xhs-product-runtime-self-test.mjs",
  "xhs-compact-asset-path-self-test.mjs",
  "xhs-kie-production-adapter-self-test.mjs",
  "xhs-integrated-product-cutover-ui-self-test.mjs",
  "xhs-pre-generation-review-self-test.mjs",
  "xhs-skill-style-selection-ui-self-test.mjs",
  "xhs-light-revision-self-test.mjs",
  "xhs-local-package-self-test.mjs",
  "atomic-xhs-promotion-delivery-self-test.mjs",
  "unified-content-artifact-api-self-test.mjs",
  "unified-wechat-production-control-self-test.mjs",
  "wechat-image-plan-adapter-self-test.mjs",
  "wechat-generated-raster-runtime-self-test.mjs",
  "wechat-local-illustration-runtime-self-test.mjs",
  "wechat-creative-draft-compiler-self-test.mjs",
  "wechat-illustrated-delivery-self-test.mjs",
  "atomic-wechat-human-selection-self-test.mjs",
  "atomic-wechat-promotion-upload-delivery-self-test.mjs"
];

for (const test of tests) {
  process.stdout.write(`\n[product-test] ${test}\n`);
  const result = spawnSync(process.execPath, [`scripts/tests/${test}`], { cwd: root, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`\nproduct-tests: ok (${tests.length} tests)`);
