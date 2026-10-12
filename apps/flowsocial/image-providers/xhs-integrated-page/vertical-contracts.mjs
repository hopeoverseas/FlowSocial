import { stableHash } from "./canonical.mjs";

export const VERTICAL_CONTRACTS = Object.freeze({
  pageSpec: "IntegratedVisualPageSpec@1.0",
  candidate: "PageCandidate@1.0",
  normalization: "PageNormalizationRecord@1.0",
  textCheck: "PageTextCheck@1.0",
  factCheck: "PageFactCheck@1.0",
  visualReview: "XhsIntegratedVisualReview@1.0",
  revision: "PageAssetRevision@1.0",
  snapshot: "XhsVisualSetSnapshot@1.0",
  event: "XhsVisualDeliveryEvent@1.0",
  manifest: "FlowSocialDeliveryManifest@3.0"
});

const HASH = /^[a-f0-9]{64}$/;
const object = (value, label) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label}:OBJECT_REQUIRED`);
};
export function exactKeys(value, keys, label) {
  object(value, label);
  const actual = Object.keys(value).sort(); const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label}:FIELDS:${actual.join(",")}`);
}
const string = (value, label) => { if (typeof value !== "string" || !value) throw new Error(`${label}:STRING_REQUIRED`); };
const text = (value, label) => { if (typeof value !== "string") throw new Error(`${label}:TEXT_REQUIRED`); };
const integer = (value, label, min = 0) => { if (!Number.isInteger(value) || value < min) throw new Error(`${label}:INTEGER_REQUIRED`); };
const array = (value, label) => { if (!Array.isArray(value)) throw new Error(`${label}:ARRAY_REQUIRED`); };
const boolean = (value, label) => { if (typeof value !== "boolean") throw new Error(`${label}:BOOLEAN_REQUIRED`); };
const strings = (value, label) => { array(value, label); value.forEach((item) => string(item, `${label}.item`)); };
const hash = (value, label) => { if (!HASH.test(value || "")) throw new Error(`${label}:HASH_REQUIRED`); };
const enumValue = (value, values, label) => { if (!values.includes(value)) throw new Error(`${label}:ENUM:${value}`); };
const ref = (value, label) => { exactKeys(value, ["id", "hash"], label); string(value.id, `${label}.id`); hash(value.hash, `${label}.hash`); };
const dimensions = (value, label) => { exactKeys(value, ["width", "height"], label); integer(value.width, `${label}.width`, 1); integer(value.height, `${label}.height`, 1); };
const rectangle = (value, fields, label) => { exactKeys(value, fields, label); fields.forEach((field) => integer(value[field], `${label}.${field}`, 0)); };
const asset = (value, label) => { exactKeys(value, ["relativePath", "sha256", "bytes", "dimensions"], label); string(value.relativePath, `${label}.relativePath`); hash(value.sha256, `${label}.sha256`); integer(value.bytes, `${label}.bytes`, 1); dimensions(value.dimensions, `${label}.dimensions`); };
const blocker = (value) => { exactKeys(value, ["code", "scope", "detail", "fallback"], "blocker"); string(value.code, "blocker.code"); string(value.scope, "blocker.scope"); string(value.detail, "blocker.detail"); if (value.fallback !== "deterministic_layout") throw new Error("blocker:FALLBACK"); };
const blockers = (value) => { array(value, "blockers"); value.forEach(blocker); };
const hashed = (value, field, label) => { hash(value[field], `${label}.${field}`); const copy = structuredClone(value); delete copy[field]; if (stableHash(copy) !== value[field]) throw new Error(`${label}:HASH_MISMATCH`); };
export const withHash = (value, field) => { const copy = structuredClone(value); delete copy[field]; return { ...copy, [field]: stableHash(copy) }; };

export function validateIntegratedVisualPageSpec(value) {
  exactKeys(value, ["schemaVersion", "contract", "id", "contentTaskId", "contentVersion", "pageId", "pageRole", "canvas", "contentTruthRef", "contentTruthHash", "compositionGoal", "informationHierarchy", "brandDnaRef", "referenceAssetIds", "styleConstraints", "protectedRegions", "normalizationPolicy", "generationMode", "sourceRefs", "blockers", "specHash"], VERTICAL_CONTRACTS.pageSpec);
  if (value.schemaVersion !== "1.0" || value.contract !== VERTICAL_CONTRACTS.pageSpec) throw new Error("IntegratedVisualPageSpec:VERSION");
  for (const key of ["id", "contentTaskId", "pageId", "pageRole", "contentTruthRef", "compositionGoal"]) string(value[key], `pageSpec.${key}`);
  integer(value.contentVersion, "pageSpec.contentVersion", 1); dimensions(value.canvas, "pageSpec.canvas");
  if (value.canvas.width !== 1080 || value.canvas.height !== 1440) throw new Error("IntegratedVisualPageSpec:CANVAS");
  hash(value.contentTruthHash, "pageSpec.contentTruthHash");
  for (const key of ["informationHierarchy", "referenceAssetIds", "styleConstraints", "protectedRegions", "sourceRefs", "blockers"]) array(value[key], `pageSpec.${key}`);
  exactKeys(value.brandDnaRef, ["id", "hash"], "pageSpec.brandDnaRef"); ref(value.brandDnaRef, "pageSpec.brandDnaRef");
  exactKeys(value.normalizationPolicy, ["allowedModes", "padBackgroundStrategies", "nonUniformStretchAllowed", "protectedRegionCropAllowed"], "normalizationPolicy");
  if (value.normalizationPolicy.nonUniformStretchAllowed !== false || value.normalizationPolicy.protectedRegionCropAllowed !== false) throw new Error("IntegratedVisualPageSpec:UNSAFE_NORMALIZATION_POLICY");
  enumValue(value.generationMode, ["integrated_page_generation", "deterministic_layout"], "pageSpec.generationMode"); blockers(value.blockers); hashed(value, "specHash", "IntegratedVisualPageSpec"); return value;
}

export function validatePageCandidate(value) {
  exactKeys(value, ["schemaVersion", "contract", "id", "contentTaskId", "contentVersion", "pageId", "specRef", "compilerTraceRef", "capabilityEvaluationRef", "generationMode", "lifecycle", "sourceAsset", "providerStatus", "providerNativeDimensions", "providerNativeDimensionStatus", "normalizationStatus", "finalCanvasStatus", "textStatus", "factStatus", "visualStatus", "selectionStatus", "costStatus", "blockers", "candidateHash"], VERTICAL_CONTRACTS.candidate);
  if (value.schemaVersion !== "1.0" || value.contract !== VERTICAL_CONTRACTS.candidate) throw new Error("PageCandidate:VERSION");
  for (const key of ["id", "contentTaskId", "pageId"]) string(value[key], `candidate.${key}`); integer(value.contentVersion, "candidate.contentVersion", 1);
  for (const key of ["specRef", "compilerTraceRef", "capabilityEvaluationRef"]) ref(value[key], `candidate.${key}`);
  enumValue(value.generationMode, ["integrated_page_generation", "deterministic_layout"], "candidate.generationMode");
  if (value.lifecycle !== "experimental") throw new Error("PageCandidate:APPROVED_FORBIDDEN");
  asset(value.sourceAsset, "candidate.sourceAsset"); dimensions(value.providerNativeDimensions, "candidate.providerNativeDimensions");
  enumValue(value.providerStatus, ["succeeded", "failed", "legacy_unknown"], "candidate.providerStatus");
  enumValue(value.providerNativeDimensionStatus, ["passed", "failed", "legacy_quality_unknown"], "candidate.providerNativeDimensionStatus");
  enumValue(value.normalizationStatus, ["pending", "succeeded", "blocked", "not_required"], "candidate.normalizationStatus");
  enumValue(value.finalCanvasStatus, ["pending", "passed", "blocked", "legacy_quality_unknown"], "candidate.finalCanvasStatus");
  enumValue(value.textStatus, ["pending", "passed", "failed", "review_required", "legacy_quality_unknown"], "candidate.textStatus");
  enumValue(value.factStatus, ["pending", "passed", "failed", "legacy_quality_unknown"], "candidate.factStatus");
  enumValue(value.visualStatus, ["pending", "passed", "failed", "review_required", "legacy_quality_unknown"], "candidate.visualStatus");
  enumValue(value.selectionStatus, ["not_selected", "selected", "rejected", "legacy_unknown"], "candidate.selectionStatus");
  enumValue(value.costStatus, ["not_incurred", "historical_observation", "unknown"], "candidate.costStatus");
  blockers(value.blockers);
  if (value.normalizationStatus === "succeeded" && value.finalCanvasStatus !== "passed") throw new Error("PageCandidate:NORMALIZATION_STATUS_INCONSISTENT");
  if (value.selectionStatus === "selected" && (value.finalCanvasStatus !== "passed" || value.textStatus !== "passed" || value.factStatus !== "passed" || value.visualStatus !== "passed" || value.blockers.length)) throw new Error("PageCandidate:SELECTION_GATE_BYPASS");
  hashed(value, "candidateHash", "PageCandidate"); return value;
}

export function validatePageNormalizationRecord(value) {
  exactKeys(value, ["schemaVersion", "contract", "id", "candidateRef", "mode", "status", "inputAsset", "outputAsset", "inputDimensions", "outputDimensions", "scale", "crop", "pad", "protectedRegionCheck", "backgroundStrategy", "blockers", "createdAt", "recordHash"], VERTICAL_CONTRACTS.normalization);
  if (value.schemaVersion !== "1.0" || value.contract !== VERTICAL_CONTRACTS.normalization) throw new Error("PageNormalizationRecord:VERSION");
  string(value.id, "normalization.id"); ref(value.candidateRef, "normalization.candidateRef"); enumValue(value.mode, ["none", "fit_pad", "fit_crop", "resample"], "normalization.mode"); enumValue(value.status, ["succeeded", "blocked"], "normalization.status");
  asset(value.inputAsset, "normalization.inputAsset"); if (value.outputAsset) asset(value.outputAsset, "normalization.outputAsset");
  dimensions(value.inputDimensions, "normalization.inputDimensions"); dimensions(value.outputDimensions, "normalization.outputDimensions");
  exactKeys(value.scale, ["x", "y", "uniform"], "normalization.scale"); if (!Number.isFinite(value.scale.x) || !Number.isFinite(value.scale.y) || value.scale.x <= 0 || value.scale.y <= 0) throw new Error("PageNormalizationRecord:SCALE_INVALID");
  if (value.crop !== null) rectangle(value.crop, ["x", "y", "width", "height"], "normalization.crop");
  if (value.pad !== null) rectangle(value.pad, ["left", "top", "right", "bottom"], "normalization.pad");
  if ((value.mode === "fit_crop") !== (value.crop !== null) || (value.mode === "fit_pad") !== (value.pad !== null)) throw new Error("PageNormalizationRecord:MODE_GEOMETRY_MISMATCH");
  const derived = value.mode === "none" ? { x: 1, y: 1 } : value.mode === "fit_crop" ? { x: value.outputDimensions.width / value.crop.width, y: value.outputDimensions.height / value.crop.height } : value.mode === "fit_pad" ? { x: (value.outputDimensions.width - value.pad.left - value.pad.right) / value.inputDimensions.width, y: (value.outputDimensions.height - value.pad.top - value.pad.bottom) / value.inputDimensions.height } : { x: value.outputDimensions.width / value.inputDimensions.width, y: value.outputDimensions.height / value.inputDimensions.height };
  if (Math.abs(value.scale.x - derived.x) > 1e-12 || Math.abs(value.scale.y - derived.y) > 1e-12) throw new Error("PageNormalizationRecord:PIXEL_GEOMETRY_MISMATCH");
  const scaleEqual = Math.abs(derived.x - derived.y) <= Number.EPSILON * Math.max(1, Math.abs(derived.x), Math.abs(derived.y)) * 4; if (value.scale.uniform !== scaleEqual) throw new Error("PageNormalizationRecord:UNIFORM_FLAG_MISMATCH");
  if (!scaleEqual && (value.status !== "blocked" || !value.blockers.some((item) => ["NON_UNIFORM_PIXEL_GEOMETRY", "RESAMPLE_ASPECT_RATIO_MISMATCH"].includes(item.code)))) throw new Error("PageNormalizationRecord:NON_UNIFORM_STRETCH");
  exactKeys(value.protectedRegionCheck, ["status", "regionsHash"], "normalization.protectedRegionCheck"); hash(value.protectedRegionCheck.regionsHash, "normalization.regionsHash");
  enumValue(value.protectedRegionCheck.status, ["passed", "failed"], "normalization.protectedRegionCheck.status");
  if (value.backgroundStrategy !== null) enumValue(value.backgroundStrategy, ["solid_brand_neutral_light", "solid_brand_neutral_dark"], "normalization.backgroundStrategy");
  string(value.createdAt, "normalization.createdAt"); blockers(value.blockers); if (value.status === "succeeded" && (value.blockers.length || !value.outputAsset || value.outputDimensions.width !== 1080 || value.outputDimensions.height !== 1440)) throw new Error("PageNormalizationRecord:FINAL_CANVAS");
  if (value.status === "blocked" && value.outputAsset !== null) throw new Error("PageNormalizationRecord:BLOCKED_OUTPUT_FORBIDDEN"); hashed(value, "recordHash", "PageNormalizationRecord"); return value;
}

const checkTruth = (value, label) => { exactKeys(value, ["headline", "numbers", "productNames", "properNouns", "cta"], label); string(value.headline, `${label}.headline`); for (const key of ["numbers", "productNames", "properNouns"]) array(value[key], `${label}.${key}`); if (value.cta !== null) string(value.cta, `${label}.cta`); };
export function validatePageTextCheck(value) {
  exactKeys(value, ["schemaVersion", "contract", "id", "candidateRef", "contentTruthRef", "evaluationMode", "expected", "observed", "matches", "status", "blockers", "createdAt", "checkHash"], VERTICAL_CONTRACTS.textCheck);
  if (value.schemaVersion !== "1.0" || value.contract !== VERTICAL_CONTRACTS.textCheck || value.evaluationMode !== "offline_fixture_assertion") throw new Error("PageTextCheck:BOUNDARY");
  string(value.id, "textCheck.id"); ref(value.candidateRef, "textCheck.candidateRef"); ref(value.contentTruthRef, "textCheck.contentTruthRef"); checkTruth(value.expected, "textCheck.expected");
  exactKeys(value.observed, ["headline", "numbers", "productNames", "properNouns", "cta", "extraText", "pseudoText", "confidence"], "textCheck.observed");
  exactKeys(value.matches, ["headline", "numbers", "productNames", "properNouns", "cta", "noExtraText", "noPseudoText", "confidence"], "textCheck.matches");
  text(value.observed.headline, "textCheck.observed.headline"); for (const key of ["numbers", "productNames", "properNouns", "extraText"]) strings(value.observed[key], `textCheck.observed.${key}`); if (value.observed.cta !== null) text(value.observed.cta, "textCheck.observed.cta"); boolean(value.observed.pseudoText, "textCheck.observed.pseudoText"); if (!Number.isFinite(value.observed.confidence) || value.observed.confidence < 0 || value.observed.confidence > 1) throw new Error("PageTextCheck:CONFIDENCE");
  Object.entries(value.matches).forEach(([key, item]) => boolean(item, `textCheck.matches.${key}`));
  enumValue(value.status, ["passed", "failed", "review_required", "blocked"], "textCheck.status"); string(value.createdAt, "textCheck.createdAt"); blockers(value.blockers); if (value.status === "passed" && (value.blockers.length || Object.values(value.matches).some((item) => !item))) throw new Error("PageTextCheck:PASS_INCONSISTENT"); hashed(value, "checkHash", "PageTextCheck"); return value;
}

export function validatePageFactCheck(value) {
  exactKeys(value, ["schemaVersion", "contract", "id", "candidateRef", "contentTruthRef", "evaluationMode", "expectedFactIds", "observedFactIds", "extraClaims", "status", "blockers", "createdAt", "checkHash"], VERTICAL_CONTRACTS.factCheck);
  if (value.schemaVersion !== "1.0" || value.contract !== VERTICAL_CONTRACTS.factCheck || value.evaluationMode !== "offline_fixture_assertion") throw new Error("PageFactCheck:BOUNDARY");
  string(value.id, "factCheck.id"); ref(value.candidateRef, "factCheck.candidateRef"); ref(value.contentTruthRef, "factCheck.contentTruthRef"); for (const key of ["expectedFactIds", "observedFactIds", "extraClaims"]) strings(value[key], `factCheck.${key}`);
  enumValue(value.status, ["passed", "failed", "blocked"], "factCheck.status"); string(value.createdAt, "factCheck.createdAt"); blockers(value.blockers); if (value.status === "passed" && (value.blockers.length || JSON.stringify([...value.expectedFactIds].sort()) !== JSON.stringify([...value.observedFactIds].sort()) || value.extraClaims.length)) throw new Error("PageFactCheck:PASS_INCONSISTENT"); hashed(value, "checkHash", "PageFactCheck"); return value;
}

export function validateXhsIntegratedVisualReview(value) {
  exactKeys(value, ["schemaVersion", "contract", "id", "candidateRef", "evaluationMode", "hierarchyStatus", "semanticStatus", "brandingStatus", "watermarkLogoStatus", "crossPageStatus", "overallStatus", "observations", "blockers", "createdAt", "reviewHash"], VERTICAL_CONTRACTS.visualReview);
  if (value.schemaVersion !== "1.0" || value.contract !== VERTICAL_CONTRACTS.visualReview || value.evaluationMode !== "offline_fixture_assertion") throw new Error("XhsIntegratedVisualReview:BOUNDARY");
  string(value.id, "visualReview.id"); ref(value.candidateRef, "visualReview.candidateRef"); const values = ["passed", "failed", "review_required", "not_checked"]; const statusFields = ["hierarchyStatus", "semanticStatus", "brandingStatus", "watermarkLogoStatus", "crossPageStatus"];
  for (const key of statusFields) enumValue(value[key], values, `visualReview.${key}`);
  enumValue(value.overallStatus, ["passed", "failed", "review_required"], "visualReview.overallStatus"); strings(value.observations, "visualReview.observations"); string(value.createdAt, "visualReview.createdAt"); blockers(value.blockers); if (value.overallStatus === "passed" && (value.blockers.length || statusFields.some((key) => value[key] !== "passed"))) throw new Error("XhsIntegratedVisualReview:PASS_INCONSISTENT"); hashed(value, "reviewHash", "XhsIntegratedVisualReview"); return value;
}

export function validatePageAssetRevision(value) {
  exactKeys(value, ["schemaVersion", "contract", "id", "contentTaskId", "contentVersion", "pageId", "revision", "parentRevisionId", "operation", "generationMode", "sourceCandidateRef", "sourceRevisionRef", "asset", "normalizationRef", "gateRefs", "selectedBy", "selectedAt", "createdAt", "revisionHash"], VERTICAL_CONTRACTS.revision);
  if (value.schemaVersion !== "1.0" || value.contract !== VERTICAL_CONTRACTS.revision) throw new Error("PageAssetRevision:VERSION");
  for (const key of ["id", "contentTaskId", "pageId", "selectedBy", "selectedAt", "createdAt"]) string(value[key], `revision.${key}`); integer(value.contentVersion, "revision.contentVersion", 1); integer(value.revision, "revision.revision", 1);
  if (value.parentRevisionId !== null) string(value.parentRevisionId, "revision.parentRevisionId"); enumValue(value.operation, ["select", "page_restore", "set_restore"], "revision.operation"); enumValue(value.generationMode, ["integrated_page_generation", "deterministic_layout"], "revision.generationMode");
  if (value.sourceCandidateRef) ref(value.sourceCandidateRef, "revision.sourceCandidateRef"); if (value.sourceRevisionRef) ref(value.sourceRevisionRef, "revision.sourceRevisionRef"); asset(value.asset, "revision.asset"); ref(value.normalizationRef, "revision.normalizationRef");
  exactKeys(value.gateRefs, ["text", "fact", "visual"], "revision.gateRefs"); for (const item of Object.values(value.gateRefs)) ref(item, "revision.gateRef"); hashed(value, "revisionHash", "PageAssetRevision"); return value;
}

export function validateRevisionNormalizationBinding(revision, normalization) {
  validatePageAssetRevision(revision); validatePageNormalizationRecord(normalization);
  const assetFields = (value) => ({ relativePath: value.relativePath, sha256: value.sha256, bytes: value.bytes, dimensions: value.dimensions });
  if (revision.normalizationRef.id !== normalization.id || revision.normalizationRef.hash !== normalization.recordHash || !normalization.outputAsset || stableHash(assetFields(revision.asset)) !== stableHash(assetFields(normalization.outputAsset))) throw new Error("REVISION_NORMALIZATION_ASSET_MISMATCH");
  return { status: "passed", revisionRef: { id: revision.id, hash: revision.revisionHash }, normalizationRef: { id: normalization.id, hash: normalization.recordHash } };
}

export function validateXhsVisualSetSnapshot(value) {
  exactKeys(value, ["schemaVersion", "contract", "id", "contentTaskId", "contentVersion", "revision", "parentSnapshotId", "operation", "pages", "createdBy", "createdAt", "blockers", "snapshotHash"], VERTICAL_CONTRACTS.snapshot);
  if (value.schemaVersion !== "1.0" || value.contract !== VERTICAL_CONTRACTS.snapshot) throw new Error("XhsVisualSetSnapshot:VERSION");
  for (const key of ["id", "contentTaskId", "createdBy", "createdAt"]) string(value[key], `snapshot.${key}`); integer(value.contentVersion, "snapshot.contentVersion", 1); integer(value.revision, "snapshot.revision", 1); if (value.parentSnapshotId !== null) string(value.parentSnapshotId, "snapshot.parentSnapshotId"); enumValue(value.operation, ["freeze", "set_restore"], "snapshot.operation");
  array(value.pages, "snapshot.pages"); const ids = new Set(); for (const page of value.pages) { exactKeys(page, ["pageId", "revisionRef", "source", "gateSummary"], "snapshot.page"); string(page.pageId, "snapshot.pageId"); if (ids.has(page.pageId)) throw new Error("XhsVisualSetSnapshot:DUPLICATE_PAGE"); ids.add(page.pageId); ref(page.revisionRef, "snapshot.revisionRef"); enumValue(page.source, ["normalized_integrated", "deterministic_layout"], "snapshot.source"); exactKeys(page.gateSummary, ["text", "fact", "visual", "finalCanvas"], "snapshot.gateSummary"); if (Object.values(page.gateSummary).some((status) => status !== "passed")) throw new Error("XhsVisualSetSnapshot:GATE_BLOCKED"); }
  blockers(value.blockers); hashed(value, "snapshotHash", "XhsVisualSetSnapshot"); return value;
}

export function validateXhsVisualDeliveryEvent(value) {
  exactKeys(value, ["schemaVersion", "contract", "id", "sequence", "idempotencyKey", "type", "aggregateRef", "actor", "at", "payload", "previousEventHash", "eventHash"], VERTICAL_CONTRACTS.event);
  if (value.schemaVersion !== "1.0" || value.contract !== VERTICAL_CONTRACTS.event) throw new Error("XhsVisualDeliveryEvent:VERSION");
  for (const key of ["id", "idempotencyKey", "actor", "at"]) string(value[key], `event.${key}`); integer(value.sequence, "event.sequence", 1); enumValue(value.type, ["candidate_selected", "candidate_rejected", "page_restored", "set_restored", "package_prepared", "download_recorded", "delivery_marked"], "event.type"); ref(value.aggregateRef, "event.aggregateRef"); object(value.payload, "event.payload");
  const payloadFields = { candidate_selected: ["candidateRef", "revisionRef", "selectionStatus"], candidate_rejected: ["candidateRef", "reasonCodes", "selectionStatus"], page_restored: ["sourceRevisionRef", "previousRevisionRef", "revisionRef"], set_restored: ["sourceSnapshotRef", "previousSnapshotRef", "snapshotRef"], package_prepared: ["manifestRef", "downloadStatus", "platformDeliveryStatus", "userSelectionChanged"], download_recorded: ["packagePrepared", "downloadStatus", "platformDeliveryStatus", "userSelectionChanged"], delivery_marked: ["platformDeliveryStatus", "packageStatus", "downloadStatusIndependent", "userSelectionChanged"] };
  exactKeys(value.payload, payloadFields[value.type], `event.payload.${value.type}`);
  for (const [key, item] of Object.entries(value.payload)) { if (key.endsWith("Ref")) ref(item, `event.payload.${key}`); if (["userSelectionChanged", "packagePrepared", "downloadStatusIndependent"].includes(key)) boolean(item, `event.payload.${key}`); }
  if (value.type === "candidate_rejected") strings(value.payload.reasonCodes, "event.payload.reasonCodes");
  if (value.payload.selectionStatus !== undefined) enumValue(value.payload.selectionStatus, ["selected", "rejected"], "event.payload.selectionStatus");
  if (value.payload.downloadStatus !== undefined) enumValue(value.payload.downloadStatus, ["not_downloaded", "downloaded"], "event.payload.downloadStatus");
  if (value.payload.platformDeliveryStatus !== undefined) enumValue(value.payload.platformDeliveryStatus, ["not_delivered", "delivered"], "event.payload.platformDeliveryStatus");
  if (value.payload.packageStatus !== undefined) enumValue(value.payload.packageStatus, ["prepared", "blocked"], "event.payload.packageStatus");
  if (value.previousEventHash !== null) hash(value.previousEventHash, "event.previousEventHash"); hashed(value, "eventHash", "XhsVisualDeliveryEvent"); return value;
}

export function validateFlowSocialDeliveryManifest(value) {
  exactKeys(value, ["schemaVersion", "contract", "id", "source", "legacyRef", "contentTaskId", "contentVersion", "snapshotRef", "pages", "packageStatus", "downloadStatus", "platformDeliveryStatus", "userSelectionStatus", "eventsRef", "createdAt", "blockers", "manifestHash"], VERTICAL_CONTRACTS.manifest);
  if (value.schemaVersion !== "3.0" || value.contract !== VERTICAL_CONTRACTS.manifest) throw new Error("FlowSocialDeliveryManifest:VERSION");
  for (const key of ["id", "source", "contentTaskId", "createdAt"]) string(value[key], `manifest.${key}`); integer(value.contentVersion, "manifest.contentVersion", 1); if (value.legacyRef) ref(value.legacyRef, "manifest.legacyRef"); if (value.snapshotRef) ref(value.snapshotRef, "manifest.snapshotRef");
  array(value.pages, "manifest.pages"); const pageIds = new Set(); for (const page of value.pages) { exactKeys(page, ["pageId", "revisionRef", "source", "sourceSha256", "normalizedSha256", "gateSummary"], "manifest.page"); string(page.pageId, "manifest.pageId"); if (pageIds.has(page.pageId)) throw new Error("FlowSocialDeliveryManifest:DUPLICATE_PAGE"); pageIds.add(page.pageId); if (page.revisionRef) ref(page.revisionRef, "manifest.page.revisionRef"); enumValue(page.source, ["normalized_integrated", "deterministic_layout", "legacy_manifest"], "manifest.page.source"); hash(page.sourceSha256, "manifest.page.sourceSha256"); if (page.normalizedSha256 !== null) hash(page.normalizedSha256, "manifest.page.normalizedSha256"); exactKeys(page.gateSummary, ["text", "fact", "visual", "finalCanvas"], "manifest.page.gateSummary"); for (const status of Object.values(page.gateSummary)) enumValue(status, ["passed", "legacy_quality_unknown"], "manifest.page.gateSummary.status"); }
  enumValue(value.packageStatus, ["blocked", "prepared", "legacy_unknown"], "manifest.packageStatus"); enumValue(value.downloadStatus, ["not_downloaded", "downloaded", "legacy_unknown"], "manifest.downloadStatus"); enumValue(value.platformDeliveryStatus, ["not_delivered", "delivered", "legacy_unknown"], "manifest.platformDeliveryStatus"); enumValue(value.userSelectionStatus, ["selected", "not_selected", "legacy_unknown"], "manifest.userSelectionStatus");
  array(value.eventsRef, "manifest.eventsRef"); value.eventsRef.forEach((item) => ref(item, "manifest.eventRef")); blockers(value.blockers); if (value.packageStatus === "prepared" && (value.userSelectionStatus !== "selected" || value.blockers.length || !value.snapshotRef || value.pages.some((page) => Object.values(page.gateSummary).some((status) => status !== "passed")))) throw new Error("FlowSocialDeliveryManifest:PREPARED_INCONSISTENT"); if (value.userSelectionStatus === "selected" && !value.eventsRef.length) throw new Error("FlowSocialDeliveryManifest:SELECTION_EVIDENCE_REQUIRED"); hashed(value, "manifestHash", "FlowSocialDeliveryManifest"); return value;
}

export function makeBlocker(code, scope, detail) { return { code, scope, detail, fallback: "deterministic_layout" }; }
