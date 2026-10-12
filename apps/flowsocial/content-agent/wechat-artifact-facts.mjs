import { createHash } from "node:crypto";
import { hashWechatArtifactValue } from "./wechat-image-plan-adapter.mjs";

const HASH = /^[a-f0-9]{64}$/;
const GATES = new Set(["format", "mobile", "ocr", "fact", "license", "visual"]);
const clone = (value) => structuredClone(value);
const clean = (value) => String(value ?? "").trim();

function fail(code, details = null) {
  throw Object.assign(new Error(code), { code, statusCode: 409, details });
}

function requireRef(value, scope) {
  if (!value || typeof value !== "object" || Object.keys(value).sort().join(",") !== "hash,id" || !clean(value.id) || !HASH.test(value.hash || "")) fail("WECHAT_ARTIFACT_REF_INVALID", scope);
  return clone(value);
}

function sameRef(left, right) {
  return Boolean(left && right && left.id === right.id && left.hash === right.hash);
}

function safeRelativePath(value) {
  const path = clean(value).replace(/\\/g, "/");
  return path && !path.startsWith("/") && !/^[a-z]:/i.test(path) && !path.split("/").includes("..") && !path.split("/").some((part) => !part) ? path : null;
}

function factRef(fact) {
  return { id: fact.id, hash: fact.factHash };
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

function requireHashedFact(fact, contract) {
  if (fact?.contract !== contract || !HASH.test(fact.factHash || "")) fail("WECHAT_ARTIFACT_FACT_INVALID", contract);
  const base = clone(fact); delete base.factHash;
  if (hashWechatArtifactValue(base) !== fact.factHash) fail("WECHAT_ARTIFACT_FACT_HASH_MISMATCH", contract);
  return fact;
}

function bindingRefs(plan) {
  if (!plan?.bindings) fail("WECHAT_ARTIFACT_PLAN_BINDINGS_REQUIRED");
  return {
    contentProjectRef: requireRef(plan.bindings.contentProjectRef, "contentProjectRef"),
    ...(plan.bindings.materializedContentProjectRef == null ? {} : { materializedContentProjectRef: requireRef(plan.bindings.materializedContentProjectRef, "materializedContentProjectRef") }),
    platformRunRef: requireRef(plan.bindings.platformRunRef, "platformRunRef"),
    candidateRef: requireRef(plan.bindings.candidateRef, "candidateRef"),
    articleRef: requireRef(plan.bindings.articleRef, "articleRef"),
    imagePlanOutputFactRef: requireRef(plan.bindings.imagePlanOutputFactRef, "imagePlanOutputFactRef"),
    imagePlanRef: { id: plan.planId, hash: plan.planHash }
  };
}

function factBase(contract, id, bindings, at) {
  const recordedAt = clean(at);
  if (!recordedAt || Number.isNaN(Date.parse(recordedAt))) fail("WECHAT_ARTIFACT_RECORDED_AT_INVALID");
  return { schemaVersion: "1.0", contract, id, ...clone(bindings), recordedAt };
}

function appendFact(store, collection, fact, idempotencyKey) {
  if (!store || typeof store !== "object") fail("WECHAT_ARTIFACT_STORE_REQUIRED");
  store[collection] ||= [];
  if (!Array.isArray(store[collection])) fail("WECHAT_ARTIFACT_STORE_COLLECTION_INVALID", collection);
  const key = clean(idempotencyKey);
  if (!key) fail("WECHAT_ARTIFACT_IDEMPOTENCY_KEY_REQUIRED", collection);
  const base = { ...fact, idempotencyKey: key };
  const factHash = hashWechatArtifactValue(base);
  const existing = store[collection].find((item) => item.idempotencyKey === key);
  if (existing) {
    if (existing.factHash !== factHash) fail("WECHAT_ARTIFACT_IDEMPOTENCY_CONFLICT", { collection, idempotencyKey: key });
    return clone(existing);
  }
  const persisted = deepFreeze({ ...base, factHash });
  store[collection].push(persisted);
  return clone(persisted);
}

function requirePlanFact(planFact) {
  return requireHashedFact(planFact, "WechatImagePlanArtifactFact@1.0");
}

function assertBindings(actual, expected) {
  for (const key of ["contentProjectRef", "materializedContentProjectRef", "platformRunRef", "candidateRef", "articleRef", "imagePlanOutputFactRef", "imagePlanRef"]) {
    if (actual[key] == null && expected[key] == null) continue;
    if (!sameRef(actual[key], expected[key])) fail("WECHAT_ARTIFACT_BINDING_MISMATCH", {
      key, factContract: actual?.contract || null, factId: actual?.id || null,
      actual: clone(actual[key]), expected: clone(expected[key])
    });
  }
}

export function createWechatArtifactFactStore() {
  return { schemaVersion: "1.0", planFacts: [], resourceAttempts: [], formatFacts: [], qualityFacts: [], wholeArticleQualityFacts: [], lifecycleFacts: [] };
}

export function appendWechatImagePlanArtifactFact(store, { canonicalPlan, idempotencyKey, recordedAt }) {
  if (canonicalPlan?.contract !== "WechatCanonicalImagePlan@1.0") fail("WECHAT_ARTIFACT_CANONICAL_PLAN_REQUIRED");
  const basePlan = clone(canonicalPlan); delete basePlan.planHash;
  if (hashWechatArtifactValue(basePlan) !== canonicalPlan.planHash) fail("WECHAT_ARTIFACT_PLAN_HASH_MISMATCH");
  const bindings = bindingRefs(canonicalPlan);
  const base = factBase("WechatImagePlanArtifactFact@1.0", `wechat-plan:${canonicalPlan.planId}:${canonicalPlan.planHash.slice(0, 16)}`, bindings, recordedAt);
  const existing = (store.planFacts || []).find((fact) => fact.id === base.id);
  if (existing) {
    requireHashedFact(existing, "WechatImagePlanArtifactFact@1.0");
    if (hashWechatArtifactValue(existing.canonicalPlan) !== hashWechatArtifactValue(canonicalPlan)) fail("UNIFIED_ARTIFACT_WECHAT_FACT_ID_CONFLICT", base.id);
    return existing;
  }
  return appendFact(store, "planFacts", {
    ...base,
    platform: "wechat",
    canonicalPlan: clone(canonicalPlan),
    declaredResourceCount: canonicalPlan.resourceRequirements.length,
    noImage: canonicalPlan.resourceRequirements.length === 0
  }, idempotencyKey);
}

function resourceBlockers(declaration, evidence, bindings) {
  const blockers = [];
  let artifactRef = null;
  let bytes = null;
  let sha256 = null;
  let relativePath = null;
  if (!evidence) return { blockers: [`${declaration.strategy}_evidence_missing`], artifactRef, bytes, sha256, relativePath };
  if (evidence.assetId !== declaration.assetId) blockers.push("asset_id_mismatch");
  if (declaration.strategy === "authorized_asset") {
    try { requireRef(evidence.registryRecordRef, "authorized.registryRecordRef"); } catch { blockers.push("authorized_asset_registry_ref_invalid"); }
    if (evidence.status !== "approved") blockers.push("authorized_asset_not_approved");
    if (!clean(evidence.license?.id) || evidence.license?.allowsPublication !== true) blockers.push("authorized_asset_license_invalid");
    if (!clean(evidence.source?.ref) || !HASH.test(evidence.source?.sha256 || "")) blockers.push("authorized_asset_source_invalid");
    if (!HASH.test(evidence.actualSha256 || "") || evidence.actualSha256 !== evidence.source?.sha256) blockers.push("authorized_asset_source_sha_mismatch");
  } else if (declaration.strategy === "html_chart") {
    if (evidence.deterministic !== true || !evidence.definition || !HASH.test(evidence.definitionHash || "") || hashWechatArtifactValue(evidence.definition) !== evidence.definitionHash) blockers.push("html_chart_definition_invalid");
    if (!sameRef(evidence.articleRef, bindings.articleRef)) blockers.push("html_chart_article_mismatch");
    if (evidence.status !== "succeeded") blockers.push("html_chart_artifact_missing");
  } else if (declaration.strategy === "generated_raster") {
    try { requireRef(evidence.providerAttemptRef, "generated.providerAttemptRef"); } catch { blockers.push("generated_raster_attempt_ref_invalid"); }
    if (evidence.status !== "succeeded" || !Number.isInteger(evidence.attempt) || evidence.attempt < 1) blockers.push("generated_raster_successful_attempt_missing");
    if (!sameRef(evidence.candidateRef, bindings.candidateRef)) blockers.push("generated_raster_candidate_mismatch");
    if (!sameRef(evidence.articleRef, bindings.articleRef)) blockers.push("generated_raster_article_mismatch");
  }
  if (evidence.artifactRef) {
    try { artifactRef = requireRef(evidence.artifactRef, "resource.artifactRef"); } catch { blockers.push("resource_artifact_ref_invalid"); }
  } else blockers.push("resource_artifact_ref_missing");
  if (!Number.isInteger(evidence.bytes) || evidence.bytes < 1) blockers.push("resource_bytes_invalid"); else bytes = evidence.bytes;
  if (!HASH.test(evidence.actualSha256 || "")) blockers.push("resource_sha_invalid"); else sha256 = evidence.actualSha256;
  relativePath = safeRelativePath(evidence.relativePath);
  if (!relativePath || !relativePath.startsWith("assets/")) blockers.push("resource_relative_path_invalid");
  return { blockers: [...new Set(blockers)], artifactRef, bytes, sha256, relativePath };
}

/** Append one immutable attempt per declared resource. A retry uses a new key. */
export function appendWechatResourceResolutionAttempts(store, { planFact, evidenceByAssetId = {}, attempt, idempotencyKeyPrefix, recordedAt }) {
  requirePlanFact(planFact);
  if (!Number.isInteger(attempt) || attempt < 1) fail("WECHAT_ARTIFACT_ATTEMPT_INVALID");
  const plan = planFact.canonicalPlan;
  const bindings = bindingRefs(plan);
  assertBindings(planFact, bindings);
  const results = [];
  for (const declaration of plan.declarations.filter((item) => item.strategy !== "no_image")) {
    const evidence = evidenceByAssetId[declaration.assetId] || null;
    const resolved = resourceBlockers(declaration, evidence, bindings);
    const base = factBase("WechatResourceResolutionAttempt@1.0", `wechat-resource:${plan.planId}:${declaration.slotId}:attempt-${attempt}`, bindings, recordedAt);
    results.push(appendFact(store, "resourceAttempts", {
      ...base,
      planFactRef: factRef(planFact),
      slotId: declaration.slotId,
      role: declaration.role,
      strategy: declaration.strategy,
      assetId: declaration.assetId,
      attempt,
      status: resolved.blockers.length ? "blocked" : "succeeded",
      blockers: resolved.blockers,
      artifactRef: resolved.artifactRef,
      relativePath: resolved.relativePath,
      bytes: resolved.bytes,
      sha256: resolved.sha256,
      evidenceHash: evidence ? hashWechatArtifactValue(evidence) : null
    }, `${idempotencyKeyPrefix}:${declaration.slotId}:attempt-${attempt}`));
  }
  return results;
}

function matchingSuccessfulAttempts(planFact, resourceAttempts) {
  const plan = planFact.canonicalPlan;
  const bindings = bindingRefs(plan);
  const successes = [];
  const blockers = [];
  for (const declaration of plan.declarations.filter((item) => item.strategy !== "no_image")) {
    const candidates = resourceAttempts.filter((fact) => fact.slotId === declaration.slotId && fact.status === "succeeded");
    for (const candidate of candidates) {
      requireHashedFact(candidate, "WechatResourceResolutionAttempt@1.0");
      assertBindings(candidate, bindings);
    }
    const latest = candidates.sort((left, right) => right.attempt - left.attempt)[0];
    if (!latest) blockers.push({ code: "resource_successful_attempt_missing", slotId: declaration.slotId });
    else successes.push(latest);
  }
  return { successes, blockers };
}

export function appendWechatFormatArtifactFact(store, { planFact, resourceAttempts = store?.resourceAttempts || [], html, resourceRefs = [], idempotencyKey, recordedAt }) {
  requirePlanFact(planFact);
  const bindings = bindingRefs(planFact.canonicalPlan);
  assertBindings(planFact, bindings);
  const resolution = matchingSuccessfulAttempts(planFact, resourceAttempts);
  const actualResourceRefs = resolution.successes.map(factRef);
  if (resourceRefs.length && (resourceRefs.length !== actualResourceRefs.length || resourceRefs.some((ref, index) => !sameRef(ref, actualResourceRefs[index])))) fail("WECHAT_ARTIFACT_FORMAT_RESOURCE_REF_MISMATCH");
  const data = Buffer.from(String(html ?? ""), "utf8");
  const blockers = [...resolution.blockers];
  if (!data.length) blockers.push({ code: "format_html_empty" });
  const allImageRefs = [...String(html ?? "").matchAll(/\bsrc=["']([^"']+)["']/gi)].map((match) => match[1]);
  const localRefs = allImageRefs.filter((value) => safeRelativePath(value));
  if (allImageRefs.length !== localRefs.length) blockers.push({ code: "format_nonlocal_resource_reference_forbidden" });
  const expectedPaths = resolution.successes.map((fact) => fact.relativePath).sort();
  if (localRefs.length !== actualResourceRefs.length || JSON.stringify([...localRefs].sort()) !== JSON.stringify(expectedPaths)) blockers.push({ code: "format_resource_reference_mismatch", expected: expectedPaths, actual: [...localRefs].sort() });
  const base = factBase("WechatPreUploadFormatArtifactFact@1.0", `wechat-format:${planFact.imagePlanRef.id}:${createHash("sha256").update(data).digest("hex").slice(0, 16)}`, bindings, recordedAt);
  const existing = (store.formatFacts || []).find((fact) => fact.id === base.id);
  if (existing) {
    requireHashedFact(existing, "WechatPreUploadFormatArtifactFact@1.0");
    if (existing.htmlSha256 !== createHash("sha256").update(data).digest("hex")) fail("UNIFIED_ARTIFACT_WECHAT_FACT_ID_CONFLICT", base.id);
    return existing;
  }
  return appendFact(store, "formatFacts", {
    ...base,
    planFactRef: factRef(planFact),
    semantics: "pre_upload_template_not_wechat_final",
    status: blockers.length ? "blocked" : "succeeded",
    blockers,
    htmlSha256: createHash("sha256").update(data).digest("hex"),
    htmlBytes: data.length,
    resourceAttemptRefs: actualResourceRefs,
    localResourcePaths: localRefs,
    platformUploadPerformed: false,
    platformPublicationPerformed: false
  }, idempotencyKey);
}

export function appendWechatQualityGateFact(store, { planFact, formatFact, gate, status, evidenceRefs = [], details = null, idempotencyKey, recordedAt }) {
  requirePlanFact(planFact);
  if (!GATES.has(gate)) fail("WECHAT_ARTIFACT_GATE_INVALID", gate);
  if (!["passed", "failed", "not_applicable"].includes(status)) fail("WECHAT_ARTIFACT_GATE_STATUS_INVALID", status);
  if (gate === "mobile" && status === "not_applicable") fail("WECHAT_ARTIFACT_MOBILE_GATE_REQUIRED");
  const bindings = bindingRefs(planFact.canonicalPlan);
  requireHashedFact(formatFact, "WechatPreUploadFormatArtifactFact@1.0");
  assertBindings(formatFact, bindings);
  const refs = evidenceRefs.map((ref, index) => requireRef(ref, `evidenceRefs[${index}]`));
  const base = factBase("WechatArtifactQualityGateFact@1.0", `wechat-gate:${formatFact.id}:${gate}`, bindings, recordedAt);
  const existing = (store.qualityFacts || []).find((fact) => fact.id === base.id);
  if (existing) {
    requireHashedFact(existing, "WechatArtifactQualityGateFact@1.0");
    if (existing.status !== status || hashWechatArtifactValue(existing.evidenceRefs || []) !== hashWechatArtifactValue(refs)) fail("UNIFIED_ARTIFACT_WECHAT_FACT_ID_CONFLICT", base.id);
    return existing;
  }
  return appendFact(store, "qualityFacts", { ...base, planFactRef: factRef(planFact), formatFactRef: factRef(formatFact), gate, status, evidenceRefs: refs, details: clone(details) }, idempotencyKey);
}

function exactRefSet(refs, expected) {
  return Array.isArray(refs) && refs.length === expected.length
    && refs.every((ref, index) => sameRef(ref, expected[index]));
}

function resourceSetHash(facts) {
  return hashWechatArtifactValue(facts.map((fact) => ({ ref: factRef(fact), assetId: fact.assetId, relativePath: fact.relativePath, bytes: fact.bytes, sha256: fact.sha256 })));
}

function wholeArticleBlockers(evidence, resourceCount) {
  const blockers = [];
  const content = evidence?.content;
  for (const check of ["sectionContinuity", "informationDensity", "cta", "sourceDisclaimer"]) {
    if (content?.[check]?.status !== "passed") blockers.push(`whole_article_${check}_not_passed`);
  }
  for (const check of ["imageNecessity", "imageRedundancy", "imageComplementarity"]) {
    const acceptable = content?.[check]?.status === "passed" || (resourceCount === 0 && content?.[check]?.status === "not_applicable");
    if (!acceptable) blockers.push(`whole_article_${check}_not_passed`);
  }
  const viewports = evidence?.mobile?.viewports;
  for (const width of [320, 375, 390, 430]) {
    const matches = Array.isArray(viewports) ? viewports.filter((item) => item?.width === width) : [];
    const item = matches[0];
    let refValid = true;
    try { requireRef(item?.evidenceRef, `mobile.${width}.evidenceRef`); } catch { refValid = false; }
    if (matches.length !== 1 || item?.rendered !== true || item?.readable !== true || item?.horizontalOverflow !== false
      || item?.styleLoss !== false || !Array.isArray(item?.brokenImages) || item.brokenImages.length !== 0 || !refValid
      || (width === 390 && item?.fullPage !== true)) blockers.push(`whole_article_mobile_${width}_not_passed`);
  }
  const paste = evidence?.paste;
  let pasteRefsValid = true;
  for (const [name, value] of [["copyArtifactRef", paste?.copyArtifactRef], ["htmlArtifactRef", paste?.htmlArtifactRef], ["replacementManifestRef", paste?.replacementManifestRef], ["pasteEvidenceRef", paste?.pasteEvidenceRef]]) {
    try { requireRef(value, `paste.${name}`); } catch { pasteRefsValid = false; }
  }
  if (paste?.semantics !== "pre_upload_template_not_wechat_final" || paste?.rendered !== true || paste?.readable !== true
    || paste?.horizontalOverflow !== false || paste?.styleLoss !== false || !Array.isArray(paste?.brokenImages)
    || paste.brokenImages.length !== 0 || !Array.isArray(paste?.localResourcePaths) || !pasteRefsValid) blockers.push("whole_article_paste_not_passed");
  return [...new Set(blockers)];
}

/** Append a fail-closed whole-article assessment bound to the exact pre-upload inputs. */
export function appendWechatWholeArticleQualityFact(store, {
  planFact, formatFact, resourceAttempts = store?.resourceAttempts || [], preUploadRef, evidence,
  idempotencyKey, recordedAt
}) {
  requirePlanFact(planFact);
  requireHashedFact(formatFact, "WechatPreUploadFormatArtifactFact@1.0");
  const bindings = bindingRefs(planFact.canonicalPlan);
  assertBindings(formatFact, bindings);
  if (!sameRef(formatFact.planFactRef, factRef(planFact))) fail("WECHAT_WHOLE_ARTICLE_PLAN_FACT_MISMATCH");
  const expectedResourceRefs = formatFact.resourceAttemptRefs || [];
  const resources = expectedResourceRefs.map((ref) => {
    const fact = resourceAttempts.find((item) => sameRef(factRef(item), ref));
    if (!fact) fail("WECHAT_WHOLE_ARTICLE_RESOURCE_FACT_MISSING", ref);
    requireHashedFact(fact, "WechatResourceResolutionAttempt@1.0");
    assertBindings(fact, bindings);
    return fact;
  });
  const uploadRef = requireRef(preUploadRef, "preUploadRef");
  const suppliedBindings = evidence?.bindings || {};
  const expected = {
    articleRef: bindings.articleRef,
    imagePlanRef: bindings.imagePlanRef,
    imagePlanOutputFactRef: bindings.imagePlanOutputFactRef,
    planFactRef: factRef(planFact),
    formatFactRef: factRef(formatFact),
    preUploadRef: uploadRef
  };
  const bindingBlockers = Object.entries(expected).filter(([key, ref]) => !sameRef(suppliedBindings[key], ref)).map(([key]) => `whole_article_${key}_stale`);
  const exactResourceSetHash = resourceSetHash(resources);
  if (suppliedBindings.resourceSetHash !== exactResourceSetHash || !exactRefSet(suppliedBindings.resourceAttemptRefs, expectedResourceRefs)) bindingBlockers.push("whole_article_resources_stale");
  if (evidence?.paste?.htmlArtifactRef && !sameRef(evidence.paste.htmlArtifactRef, { id: formatFact.id, hash: formatFact.htmlSha256 })) bindingBlockers.push("whole_article_paste_html_mismatch");
  if (evidence?.paste?.localResourcePaths && JSON.stringify(evidence.paste.localResourcePaths) !== JSON.stringify(formatFact.localResourcePaths)) bindingBlockers.push("whole_article_paste_resources_mismatch");
  const blockers = [...new Set([...bindingBlockers, ...wholeArticleBlockers(evidence, resources.length)])];
  const base = factBase("WechatWholeArticleQualityFact@1.0", `wechat-whole-article:${formatFact.id}:${uploadRef.hash.slice(0, 16)}`, bindings, recordedAt);
  return appendFact(store, "wholeArticleQualityFacts", {
    ...base,
    planFactRef: factRef(planFact), formatFactRef: factRef(formatFact), resourceAttemptRefs: clone(expectedResourceRefs),
    resourceSetHash: exactResourceSetHash, preUploadRef: uploadRef, evidence: clone(evidence || null), evidenceHash: hashWechatArtifactValue(evidence || null),
    status: blockers.length ? "failed" : "passed", blockers, gateActivated: true,
    platformUploadPerformed: false, publicationPerformed: false
  }, idempotencyKey);
}

export function evaluateWechatPreUploadArtifactState({ planFact, formatFact, qualityFacts = [], wholeArticleQualityFacts = [], resourceAttempts = [], preUploadRef = null, wholeArticleGateEnabled = false, humanReviewStatus = "not_reviewed" }) {
  requirePlanFact(planFact);
  const bindings = bindingRefs(planFact.canonicalPlan);
  const blockers = [];
  if (!formatFact || formatFact.status !== "succeeded") blockers.push("format_not_succeeded");
  else {
    requireHashedFact(formatFact, "WechatPreUploadFormatArtifactFact@1.0");
    assertBindings(formatFact, bindings);
  }
  const resourceCount = planFact.canonicalPlan.resourceRequirements.length;
  const required = ["format", "mobile", "ocr", "fact", "license", "visual"];
  for (const gate of required) {
    const matches = qualityFacts.filter((fact) => sameRef(fact.formatFactRef, factRef(formatFact || { id: "missing", factHash: "" })) && fact.gate === gate);
    const latest = matches.at(-1);
    if (latest) requireHashedFact(latest, "WechatArtifactQualityGateFact@1.0");
    const acceptable = latest?.status === "passed" || (resourceCount === 0 && ["ocr", "fact", "license"].includes(gate) && latest?.status === "not_applicable");
    if (!acceptable) blockers.push(`${gate}_gate_not_passed`);
  }
  const gateActivated = wholeArticleGateEnabled === true || wholeArticleQualityFacts.length > 0;
  let wholeArticleQualityFact = null;
  if (gateActivated) {
    const matches = wholeArticleQualityFacts.filter((fact) => sameRef(fact.formatFactRef, formatFact ? factRef(formatFact) : null));
    wholeArticleQualityFact = matches.at(-1) || null;
    if (wholeArticleQualityFact) requireHashedFact(wholeArticleQualityFact, "WechatWholeArticleQualityFact@1.0");
    const latestResources = matchingSuccessfulAttempts(planFact, resourceAttempts).successes;
    const currentResourceRefs = latestResources.map(factRef);
    const current = wholeArticleQualityFact?.status === "passed"
      && sameRef(wholeArticleQualityFact.planFactRef, factRef(planFact))
      && sameRef(wholeArticleQualityFact.preUploadRef, preUploadRef)
      && exactRefSet(wholeArticleQualityFact.resourceAttemptRefs, currentResourceRefs)
      && wholeArticleQualityFact.resourceSetHash === resourceSetHash(latestResources);
    if (!current) blockers.push(wholeArticleQualityFact ? "whole_article_quality_stale_or_failed" : "whole_article_quality_fact_required");
  }
  if (humanReviewStatus !== "approved") blockers.push("human_review_not_approved");
  return {
    schemaVersion: "1.0",
    contract: "WechatPreUploadArtifactState@1.0",
    ...bindings,
    status: formatFact?.status !== "succeeded" ? "pre_upload_resource_required" : blockers.length ? "pre_upload_review_required" : "pre_upload_ready",
    blockers,
    wholeArticleGate: { activated: gateActivated, status: !gateActivated ? "legacy_not_activated" : wholeArticleQualityFact?.status === "passed" && !blockers.includes("whole_article_quality_stale_or_failed") ? "passed" : "blocked", factRef: wholeArticleQualityFact ? factRef(wholeArticleQualityFact) : null },
    finalBundleAuthority: false,
    uploadPerformed: false,
    draftCreated: false,
    publicationPerformed: false
  };
}

function appendLifecycle(store, { planFact, predecessorRef, evidenceRef, kind, semantics, html, idempotencyKey, recordedAt }) {
  requirePlanFact(planFact);
  const bindings = bindingRefs(planFact.canonicalPlan);
  const evidence = requireRef(evidenceRef, "lifecycle.evidenceRef");
  const predecessor = requireRef(predecessorRef, "lifecycle.predecessorRef");
  const htmlData = html == null ? null : Buffer.from(String(html), "utf8");
  if (kind === "post_upload" && /\bsrc=["'](?:assets\/|\.\.?\/|file:|data:)/i.test(String(html))) fail("WECHAT_ARTIFACT_POST_UPLOAD_LOCAL_REF_FORBIDDEN");
  const base = factBase(`Wechat${kind.split("_").map((part) => part[0].toUpperCase() + part.slice(1)).join("")}ArtifactFact@1.0`, `wechat-${kind}:${evidence.id}`, bindings, recordedAt);
  return appendFact(store, "lifecycleFacts", { ...base, kind, semantics, predecessorRef: predecessor, evidenceRef: evidence, htmlSha256: htmlData ? createHash("sha256").update(htmlData).digest("hex") : null, finalBundleAuthority: false }, idempotencyKey);
}

export function appendWechatPostUploadArtifactFact(store, input) {
  if (!(store?.formatFacts || []).some((fact) => {
    requireHashedFact(fact, "WechatPreUploadFormatArtifactFact@1.0");
    return sameRef(factRef(fact), input.predecessorRef) && fact.status === "succeeded";
  })) fail("WECHAT_ARTIFACT_POST_UPLOAD_PRE_UPLOAD_REQUIRED");
  return appendLifecycle(store, { ...input, kind: "post_upload", semantics: "wechat_resources_uploaded_content_not_published" });
}

export function appendWechatDraftArtifactFact(store, input) {
  if (!(store?.lifecycleFacts || []).some((fact) => {
    requireHashedFact(fact, "WechatPostUploadArtifactFact@1.0");
    return fact.kind === "post_upload" && sameRef(factRef(fact), input.predecessorRef);
  })) fail("WECHAT_ARTIFACT_DRAFT_POST_UPLOAD_REQUIRED");
  return appendLifecycle(store, { ...input, kind: "draft", semantics: "wechat_draft_created_not_published" });
}

export function appendWechatPublicationArtifactFact(store, input) {
  if (!(store?.lifecycleFacts || []).some((fact) => {
    const expected = fact.kind === "post_upload" ? "WechatPostUploadArtifactFact@1.0" : fact.kind === "draft" ? "WechatDraftArtifactFact@1.0" : "WechatPublicationArtifactFact@1.0";
    requireHashedFact(fact, expected);
    return fact.kind === "draft" && sameRef(factRef(fact), input.predecessorRef);
  })) fail("WECHAT_ARTIFACT_PUBLICATION_DRAFT_REQUIRED");
  return appendLifecycle(store, { ...input, kind: "publication", semantics: "external_publication_evidence_record_only" });
}

export function adaptLegacyWechatArtifactReadOnly(input) {
  const before = hashWechatArtifactValue(input);
  const base = {
    schemaVersion: "1.0",
    contract: "LegacyWechatArtifactProjection@1.0",
    legacyInputHash: before,
    authority: false,
    finalBundleAuthority: false,
    blockers: ["legacy_project_binding_unproven", "legacy_skill_output_fact_unproven", "legacy_user_selection_unproven", "legacy_publication_unproven"]
  };
  const result = Object.freeze({ ...base, projectionHash: hashWechatArtifactValue(base) });
  if (hashWechatArtifactValue(input) !== before) fail("WECHAT_LEGACY_ARTIFACT_MUTATED");
  return result;
}
