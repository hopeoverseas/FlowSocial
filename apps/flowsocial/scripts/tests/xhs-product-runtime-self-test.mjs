import assert from "node:assert/strict";
import { resolve } from "node:path";
import { createXhsProductRuntimeDependencies } from "../../content-agent/xhs-product-runtime.mjs";

const dataRoot = resolve("apps/flowsocial/.tmp/xhs-product-runtime-self-test");
assert.deepEqual(createXhsProductRuntimeDependencies({ productMode: "default", providerConfig: {}, dataRoot }), {});
const localOnly = createXhsProductRuntimeDependencies({ productMode: "local-package", providerConfig: { KIE_BASE_URL: "https://api.kie.ai" }, dataRoot });
assert.equal(typeof localOnly.xhsAssetReader, "function");
assert.equal(typeof localOnly.xhsAssetWriter, "function");
assert.equal(localOnly.xhsProviderTransport, undefined, "paid Provider execution must remain unavailable without an API key");

const runtime = createXhsProductRuntimeDependencies({
  productMode: "local-package",
  providerConfig: { KIE_BASE_URL: "https://api.kie.ai", KIE_API_KEY: "test-only" },
  dataRoot,
  fetchImpl: async () => { throw new Error("network must not be called while wiring runtime"); }
});
assert.equal(typeof runtime.xhsProviderTransport, "function");
assert.equal(typeof runtime.xhsProviderByteSink, "function");
assert.equal(runtime.xhsProviderTransportContext.mode, "local_product_human_gated");
assert.equal(runtime.xhsProviderTransportContext.networked, true);
assert.equal(runtime.xhsProviderTransportContext.executionId, "frontend-product");
assert.match(runtime.xhsProviderTransportContext.isolatedDataDir, /xhs-integrated-page-assets$/);

console.log("xhs-product-runtime-self-test: ok");
