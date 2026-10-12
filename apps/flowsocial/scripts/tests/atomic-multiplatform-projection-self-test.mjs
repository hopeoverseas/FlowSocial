import assert from "node:assert/strict";
import { featureFlags } from "../../feature-flags.mjs";
import {
  getUnifiedAtomicMultiplatformProduct,
  listUnifiedAtomicMultiplatformProducts,
  validateUnifiedAtomicMultiplatformProduct
} from "../../content-agent/unified-atomic-multiplatform-product.mjs";
import { resolveUnifiedContentAuthority } from "../../content-agent/unified-content-authority-resolver.mjs";

const previous = process.env.UNIFIED_CONTENT_ATOMIC_WECHAT_PRODUCT_V1;
try {
  delete process.env.UNIFIED_CONTENT_ATOMIC_WECHAT_PRODUCT_V1;
  assert.equal(featureFlags().unifiedContentAtomicWechatProductV1, false, "WeChat atomic product must be default-off");
  process.env.UNIFIED_CONTENT_ATOMIC_WECHAT_PRODUCT_V1 = "1";
  assert.equal(featureFlags().unifiedContentAtomicWechatProductV1, true);
} finally {
  if (previous === undefined) delete process.env.UNIFIED_CONTENT_ATOMIC_WECHAT_PRODUCT_V1;
  else process.env.UNIFIED_CONTENT_ATOMIC_WECHAT_PRODUCT_V1 = previous;
}

assert.deepEqual(listUnifiedAtomicMultiplatformProducts({}), []);
assert.equal(getUnifiedAtomicMultiplatformProduct({}, "missing"), null);
assert.throws(() => validateUnifiedAtomicMultiplatformProduct({}), (error) => error.code === "UNIFIED_ATOMIC_MULTIPLATFORM_PRODUCT_INVALID");
assert.throws(() => listUnifiedAtomicMultiplatformProducts({ unifiedAtomicContentCommits: [{}] }),
  (error) => error.code === "UNIFIED_ATOMIC_MULTIPLATFORM_COMMIT_STORE_INVALID");
assert.throws(() => resolveUnifiedContentAuthority({}, {}, { atomicProductEnabled: false, atomicWechatProductEnabled: true }),
  (error) => error.code === "UNIFIED_ATOMIC_WECHAT_PRODUCT_REQUIRES_ATOMIC_PRODUCT");

console.log(JSON.stringify({
  status: "atomic-multiplatform-projection-self-test passed",
  integrationCoverage: "unified-content-product-api-self-test",
  realProviderCalls: 0, externalApiCalls: 0, activeDatabaseWrites: 0, browserCalls: 0, imageGenerationCalls: 0, platformWrites: 0
}, null, 2));
