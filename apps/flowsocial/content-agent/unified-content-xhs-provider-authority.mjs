import { featureFlags } from "../feature-flags.mjs";
import { getPublicProviderConfig } from "../provider-config.mjs";
import { createProviderCapabilitySnapshot } from "../image-providers/xhs-integrated-page/capabilities.mjs";
import { stableHash } from "../image-providers/xhs-integrated-page/canonical.mjs";
import { validateProviderCapabilitySnapshot, validateVisualAssetRegistrySnapshot } from "../image-providers/xhs-integrated-page/contracts.mjs";
import { buildVisualAssetRegistrySnapshot } from "../image-providers/xhs-integrated-page/registry.mjs";
import { validateDirectionCandidates } from "../image-providers/xhs-integrated-page/review-state-machine.mjs";
import { loadLibraries, validateLibraryDocument } from "../skills/design-xhs-integrated-pages/scripts/validate-library.mjs";

export const UNIFIED_XHS_PROVIDER_AUTHORITY_CONTRACT = "UnifiedXhsProviderAuthoritySnapshot@1.0";
const AUTHORITY_VERSION = "1.0";
const AUTHORITY_FLAG = "unifiedContentXhsProviderAuthorityV1";
const clone = (value) => structuredClone(value);

function exact(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label}:OBJECT_REQUIRED`);
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort())) throw new Error(`${label}:FIELDS`);
}

function ref(id, value) {
  return { id, hash: stableHash(value) };
}

function validateLibraries(libraries) {
  exact(libraries, ["archetypes", "styles", "patterns"], "UnifiedXhsProviderAuthority.libraries");
  validateLibraryDocument(libraries.archetypes, "PageArchetypeLibrary", 6);
  validateLibraryDocument(libraries.styles, "VisualStylePackLibrary", 3);
  validateLibraryDocument(libraries.patterns, "PagePromptPatternLibrary", 15);
  return libraries;
}

function providerProfileFromServerConfig() {
  const image = getPublicProviderConfig().image;
  const provider = String(image.provider || "").trim().toLowerCase();
  const model = String(image.model || "").trim();
  const supportedModels = new Set(["gpt-image-2-text-to-image", "seedream/4.5-text-to-image"]);
  if (provider !== "kie.ai" || !supportedModels.has(model)) throw new Error("UNIFIED_XHS_PROVIDER_AUTHORITY_CONFIG_UNSUPPORTED");
  const seedream = model === "seedream/4.5-text-to-image";
  return {
    provider,
    model,
    adapter: { id: seedream ? "kie-jobs-seedream45" : "kie-jobs-image2", version: AUTHORITY_VERSION, projectionKey: seedream ? "seedream45.text-to-image.v1" : "image2.text-to-image.v1" },
    lifecycle: "experimental",
    createEndpoint: "/api/v1/jobs/createTask",
    requestFields: ["model", "input.prompt", "input.aspect_ratio", "input.resolution"],
    inputDefaults: { aspect_ratio: "3:4", resolution: "1K" },
    nativeOutputDimensions: { width: 1086, height: 1448 },
    normalization: { mode: "resample", target: { width: 1080, height: 1440 }, nonUniformStretchAllowed: false, protectedRegionCropAllowed: false },
    estimatedCostPerCandidate: 6,
    currency: "credits"
  };
}

function serverConfigRef() {
  const image = getPublicProviderConfig().image;
  const value = {
    provider: String(image.provider || "").trim().toLowerCase(),
    model: String(image.model || "").trim(),
    quality: String(image.quality || "").trim()
  };
  return ref("provider-config:image:experimental:v1", value);
}

function libraryRefs(libraries) {
  return [libraries.archetypes, libraries.styles, libraries.patterns]
    .map((document) => ref(`skill-library:${document.library}:${document.schemaVersion}`, document))
    .sort((left, right) => left.id.localeCompare(right.id));
}

const DIRECTION_VARIANTS = Object.freeze([
  {
    key: "narrative-anchor",
    compositionModel: "单一叙事锚点配合非对称辅助信息区",
    hierarchyStrategy: "先突出核心承诺再逐层展开依据",
    imageRole: "图像只承担语义锚点且不得替代逐字内容"
  },
  {
    key: "modular-sequence",
    compositionModel: "模块化序列配合稳定阅读主轴",
    hierarchyStrategy: "按顺序组织浏览路径并归组辅助细节",
    imageRole: "图像只引导结构且保留全部精确文字"
  }
]);

function directionCandidatesFor(stylePackId, capabilitySnapshot) {
  return DIRECTION_VARIANTS.map((variant, index) => ({
    id: `server-direction:${stylePackId}:${variant.key}:v1`,
    stylePackId,
    archetypePlan: {
      compatibleStylePackId: stylePackId,
      variant: variant.key,
      pageStrategy: index === 0 ? "role-led-archetype-selection" : "sequence-led-archetype-selection"
    },
    compositionModel: variant.compositionModel,
    hierarchyStrategy: variant.hierarchyStrategy,
    imageRole: variant.imageRole,
    palette: [`style-pack:${stylePackId}`, index === 0 ? "high-contrast-anchor" : "balanced-modules"],
    source: `server_controlled_experimental_catalog@${AUTHORITY_VERSION}`,
    license: "flowsocial_original_offline_compilation",
    risks: ["offline capability only", "requires human prompt review before isolated provider approval"],
    capabilityStatus: {
      snapshotRef: { id: capabilitySnapshot.id, hash: capabilitySnapshot.snapshotHash },
      status: "compatible_for_isolated_planning",
      blockers: []
    }
  }));
}

function rawSnapshot(stylePackId) {
  if (typeof stylePackId !== "string" || !stylePackId.trim()) throw new Error("UNIFIED_XHS_PROVIDER_AUTHORITY_STYLE_REQUIRED");
  const normalizedStylePackId = stylePackId.trim();
  const libraries = validateLibraries(loadLibraries());
  const style = libraries.styles.entries.find((entry) => entry.id === normalizedStylePackId && entry.status === "experimental");
  if (!style) throw new Error(`UNIFIED_XHS_PROVIDER_AUTHORITY_STYLE_UNSUPPORTED:${normalizedStylePackId}`);

  const providerProfile = providerProfileFromServerConfig();
  const providerProfileRef = ref(`experimental-provider-profile:${providerProfile.provider}:${providerProfile.model}:v1`, providerProfile);
  const capabilitySnapshot = createProviderCapabilitySnapshot({
    id: `provider-capability:${providerProfileRef.hash.slice(0, 20)}:v1`,
    capabilities: {
      integratedChineseTypography: true,
      referenceImages: false,
      exactDimensions: false,
      supportedDimensions: [clone(providerProfile.nativeOutputDimensions)],
      maxCandidateCount: 1,
      maskEditing: false,
      preserveRegions: false,
      seedControl: false,
      asyncJobs: true
    }
  });
  const registrySnapshot = buildVisualAssetRegistrySnapshot({
    id: `visual-asset-registry:${stableHash(libraryRefs(libraries)).slice(0, 20)}:v1`,
    libraries,
    referenceAssets: []
  });
  const directionCandidates = directionCandidatesFor(normalizedStylePackId, capabilitySnapshot);
  const directionValidation = validateDirectionCandidates(directionCandidates);
  if (directionValidation.blockers.length) throw new Error(`UNIFIED_XHS_PROVIDER_AUTHORITY_DIRECTIONS_INVALID:${directionValidation.blockers.map((item) => item.code).join(",")}`);
  const compilerOptions = { canvas: { width: 1080, height: 1440 }, candidateCount: 1, requestedFeatures: { mask: null, preserveRegions: [], seed: null } };
  const compilerPolicy = {
    schemaVersion: "1.0",
    contract: "UnifiedXhsExperimentalCompilerPolicy@1.0",
    id: "xhs-experimental-compiler-policy:v1",
    mode: "isolated_experimental",
    options: compilerOptions,
    providerExecutionAllowed: false
  };
  compilerPolicy.policyHash = stableHash(compilerPolicy);
  const refs = directionValidation.candidateRefs;
  const base = {
    schemaVersion: "1.0",
    contract: UNIFIED_XHS_PROVIDER_AUTHORITY_CONTRACT,
    id: `xhs-provider-authority:${normalizedStylePackId}:${providerProfileRef.hash.slice(0, 16)}:v1`,
    mode: "isolated_experimental",
    source: { kind: "server_controlled_experimental_catalog", version: AUTHORITY_VERSION, providerConfigRef: serverConfigRef() },
    productionVerified: false,
    supportedStylePackId: normalizedStylePackId,
    providerProfile,
    providerProfileRef,
    capabilitySnapshot,
    capabilitySnapshotRef: { id: capabilitySnapshot.id, hash: capabilitySnapshot.snapshotHash },
    registrySnapshot,
    registrySnapshotRef: { id: registrySnapshot.id, hash: registrySnapshot.snapshotHash },
    libraries,
    libraryRefs: libraryRefs(libraries),
    directionCandidates,
    directionCandidateRefs: refs,
    directionCandidateSetHash: directionValidation.candidateSetHash,
    structuralEvidenceHash: directionValidation.structuralEvidenceHash,
    compilerPolicy,
    compilerPolicyRef: { id: compilerPolicy.id, hash: compilerPolicy.policyHash },
    requiredFeatureFlag: { name: AUTHORITY_FLAG, enabledByDefault: false },
    claims: { providerCalls: 0, networkCalls: 0, databaseWrites: 0, productionEligible: false }
  };
  return { ...base, snapshotHash: stableHash(base) };
}

export function validateUnifiedContentXhsProviderAuthoritySnapshot(snapshot) {
  exact(snapshot, [
    "schemaVersion", "contract", "id", "mode", "source", "productionVerified", "supportedStylePackId",
    "providerProfile", "providerProfileRef", "capabilitySnapshot", "capabilitySnapshotRef", "registrySnapshot",
    "registrySnapshotRef", "libraries", "libraryRefs", "directionCandidates", "directionCandidateRefs",
    "directionCandidateSetHash", "structuralEvidenceHash", "compilerPolicy", "compilerPolicyRef",
    "requiredFeatureFlag", "claims", "snapshotHash"
  ], UNIFIED_XHS_PROVIDER_AUTHORITY_CONTRACT);
  if (snapshot.schemaVersion !== "1.0" || snapshot.contract !== UNIFIED_XHS_PROVIDER_AUTHORITY_CONTRACT || snapshot.mode !== "isolated_experimental" || snapshot.productionVerified !== false) {
    throw new Error("UNIFIED_XHS_PROVIDER_AUTHORITY_BOUNDARY_INVALID");
  }
  validateProviderCapabilitySnapshot(snapshot.capabilitySnapshot);
  validateVisualAssetRegistrySnapshot(snapshot.registrySnapshot);
  const directionValidation = validateDirectionCandidates(snapshot.directionCandidates);
  if (directionValidation.blockers.length) throw new Error("UNIFIED_XHS_PROVIDER_AUTHORITY_DIRECTIONS_INVALID");
  if (snapshot.providerProfile.lifecycle !== "experimental"
    || snapshot.capabilitySnapshot.source !== "offline_fixture"
    || snapshot.capabilitySnapshot.productionVerified !== false
    || snapshot.registrySnapshot.entries.some((entry) => entry.status === "approved")
    || snapshot.compilerPolicy.providerExecutionAllowed !== false
    || Object.values(snapshot.claims).some((value) => value !== 0 && value !== false)) {
    throw new Error("UNIFIED_XHS_PROVIDER_AUTHORITY_PRODUCTION_CLAIM_FORBIDDEN");
  }
  const expected = rawSnapshot(snapshot.supportedStylePackId);
  if (stableHash(snapshot) !== stableHash(expected) || snapshot.snapshotHash !== expected.snapshotHash) throw new Error("UNIFIED_XHS_PROVIDER_AUTHORITY_TAMPERED");
  return true;
}

export function buildUnifiedContentXhsProviderAuthority(input = {}) {
  exact(input, ["stylePackId"], "buildUnifiedContentXhsProviderAuthority.input");
  if (featureFlags()[AUTHORITY_FLAG] !== true) throw new Error("UNIFIED_XHS_PROVIDER_AUTHORITY_DISABLED");
  const snapshot = rawSnapshot(input.stylePackId);
  validateUnifiedContentXhsProviderAuthoritySnapshot(snapshot);
  return clone(snapshot);
}

export function providerPlanningAuthorityFromSnapshot(snapshot) {
  validateUnifiedContentXhsProviderAuthoritySnapshot(snapshot);
  return {
    capabilitySnapshot: clone(snapshot.capabilitySnapshot),
    registrySnapshot: clone(snapshot.registrySnapshot),
    libraries: clone(snapshot.libraries),
    directionCandidates: clone(snapshot.directionCandidates),
    providerProfile: clone(snapshot.providerProfile),
    compilerOptions: clone(snapshot.compilerPolicy.options)
  };
}
