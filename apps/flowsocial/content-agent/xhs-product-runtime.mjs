import { join, resolve } from "node:path";
import { createXhsFileAssetReader, createXhsFileAssetWriter, createXhsFileByteSink, createXhsKieBase64UploadTransport, createXhsKieProviderTransport } from "./xhs-kie-production-adapter.mjs";

// Product-mode wiring is deliberately inert until the operator has configured
// Kie. Domain-level Prompt/cost approval, execution approval, per-page call
// limits and no-automatic-retry rules remain authoritative at execution time.
export function createXhsProductRuntimeDependencies({ productMode, providerConfig = {}, dataRoot, fetchImpl = fetch } = {}) {
  if (productMode !== "local-package") return {};
  const assetRoot = resolve(join(dataRoot, "xhs-integrated-page-assets"));
  const localAssets = {
    // Reading and writing already-generated local assets is part of the local
    // package runtime. It must remain available when no paid Provider key is
    // configured; only network execution depends on Kie credentials.
    xhsAssetReader: createXhsFileAssetReader({ isolatedDataDir: assetRoot }),
    xhsAssetWriter: createXhsFileAssetWriter({ isolatedDataDir: assetRoot })
  };
  const baseUrl = String(providerConfig.KIE_BASE_URL || "").trim();
  const apiKey = String(providerConfig.KIE_API_KEY || "").trim();
  if (!baseUrl || !apiKey) return localAssets;
  return {
    ...localAssets,
    xhsProviderTransport: createXhsKieProviderTransport({ baseUrl, apiKey, fetchImpl, measureCredits: true }),
    xhsProviderByteSink: createXhsFileByteSink({ isolatedDataDir: assetRoot }),
    xhsReferenceUploadTransport: createXhsKieBase64UploadTransport({ apiKey, fetchImpl }),
    xhsProviderTransportContext: {
      mode: "local_product_human_gated",
      networked: true,
      executionId: "frontend-product",
      isolatedDataDir: assetRoot
    }
  };
}
