import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { adaptAuthoritativeWechatImagePlanOutput, hashWechatArtifactValue } from "./wechat-image-plan-adapter.mjs";
import { hashUnifiedContent } from "./unified-content-contracts.mjs";
import { validateUnifiedContentAuthorityResolution } from "./unified-content-authority-resolver.mjs";
import {
  appendWechatFormatArtifactFact,
  appendWechatImagePlanArtifactFact,
  appendWechatQualityGateFact,
  appendWechatResourceResolutionAttempts,
  appendWechatWholeArticleQualityFact,
  createWechatArtifactFactStore,
  evaluateWechatPreUploadArtifactState
} from "./wechat-artifact-facts.mjs";

const GATES = ["format", "mobile", "ocr", "fact", "license", "visual"];
const EXTENSION = /^\.[a-z0-9]{1,8}$/i;
const clone = (value) => structuredClone(value);
const clean = (value) => String(value ?? "").trim();

function fail(code, details = null) {
  throw Object.assign(new Error(code), { code, statusCode: 409, details });
}

function portable(value) {
  return String(value).replace(/\\/g, "/");
}

function safeRelativePath(value) {
  const path = portable(clean(value));
  if (!path || isAbsolute(path) || /^[a-z]:/i.test(path) || path.split("/").some((part) => !part || part === "..")) fail("WECHAT_PREUPLOAD_PATH_INVALID", value);
  return path;
}

function bytesOf(value, code) {
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === "string") return Buffer.from(value, "utf8");
  fail(code);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function mediaTypeForPath(path) {
  const extension = clean(path).toLowerCase().match(/\.[a-z0-9]+$/)?.[0];
  const mediaType = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp" }[extension];
  if (!mediaType) fail("WECHAT_PREUPLOAD_RESOURCE_MEDIA_TYPE_UNSUPPORTED", path);
  return mediaType;
}

function factRef(fact) {
  return { id: fact.id, hash: fact.factHash };
}

function sameRef(left, right) {
  return Boolean(left && right && left.id === right.id && left.hash === right.hash);
}

function requireAtomicWechatAuthority(input) {
  for (const forbidden of ["planOutput", "candidate", "imagePlanOutputFact", "bindings", "article", "contentMaster", "canonicalPlan", "imagePlanAuthority"]) {
    if (Object.hasOwn(input || {}, forbidden)) fail("WECHAT_PREUPLOAD_CALLER_AUTHORITY_FORBIDDEN", forbidden);
  }
  const resolution = clone(input?.authorityResolution);
  validateUnifiedContentAuthorityResolution(resolution);
  if (resolution.authorityKind !== "atomic_wechat_v1" || resolution.platform !== "wechat") fail("WECHAT_PREUPLOAD_ATOMIC_WECHAT_AUTHORITY_REQUIRED");
  const { commit, article: articleComponent, canonicalImagePlan: imagePlanComponent, skillFacts } = resolution.payload;
  const revisionExecution = resolution.payload.revisionExecution;
  const articleSkill = skillFacts?.article;
  const imagePlanSkill = skillFacts?.imagePlan;
  const articleOutputFact = articleSkill?.outputFact;
  const outputFact = imagePlanSkill?.outputFact;
  if (articleSkill?.capability !== "write-wechat-article" || articleOutputFact?.capability !== "write-wechat-article") fail("WECHAT_PREUPLOAD_ARTICLE_OUTPUT_FACT_REQUIRED");
  if (outputFact?.contract !== "UnifiedSkillOutputFact@1.0" || outputFact.capability !== "plan-wechat-images") fail("WECHAT_PREUPLOAD_OUTPUT_FACT_REQUIRED");
  for (const fact of [articleOutputFact, outputFact]) {
    const base = clone(fact); delete base.factHash;
    if (hashUnifiedContent(base) !== fact.factHash || hashUnifiedContent(fact.runtimeOutput) !== fact.outputHash) fail("WECHAT_PREUPLOAD_OUTPUT_FACT_HASH_MISMATCH");
  }
  if (outputFact.status !== "completed" || outputFact.executionMode !== "real" || outputFact.productionEligibleOutput !== true
    || outputFact.runtimeOutput?.status !== "success" || outputFact.runtimeOutput?.blocked_reasons?.length) fail("WECHAT_PREUPLOAD_OUTPUT_FACT_NOT_PRODUCTION_ELIGIBLE");
  if (articleOutputFact.status !== "completed" || articleOutputFact.executionMode !== "real" || articleOutputFact.productionEligibleOutput !== true
    || articleOutputFact.runtimeOutput?.status !== "success" || articleOutputFact.runtimeOutput?.blocked_reasons?.length) fail("WECHAT_PREUPLOAD_ARTICLE_OUTPUT_FACT_NOT_PRODUCTION_ELIGIBLE");
  const articleRef = { id: articleComponent.id, hash: articleComponent.componentHash };
  const outputFactRef = { id: outputFact.id, hash: outputFact.factHash };
  if ((!revisionExecution && (!sameRef(articleComponent.sourceOutputFactRef, { id: articleOutputFact.id, hash: articleOutputFact.factHash })
    || !sameRef(imagePlanComponent.sourceOutputFactRef, outputFactRef)))
    || !sameRef(imagePlanComponent.articleRef, articleRef)
    || !sameRef(resolution.candidateRef, articleRef)) fail("WECHAT_PREUPLOAD_COMMIT_COMPONENT_CLOSURE_INVALID");
  const bindings = {
    contentProjectRef: clone(resolution.executionProjectRef), materializedContentProjectRef: clone(resolution.materializedProjectRef),
    platformRunRef: clone(resolution.platformRunRef), candidateRef: clone(resolution.candidateRef), articleRef,
    imagePlanOutputFactRef: outputFactRef
  };
  const article = clone(articleComponent.article);
  const contentMaster = clone(commit.authorityInputs.sharedContentMaster);
  const authorizedAssets = clone(commit.authorityInputs.platformBrief?.brief?.authorized_assets
    || commit.authorityInputs.platformBrief?.authorized_assets || []);
  if (revisionExecution) {
    const canonicalPlan = clone(imagePlanComponent.canonicalPlan);
    if (!sameRef(canonicalPlan.bindings?.candidateRef, articleRef) || !sameRef(canonicalPlan.bindings?.articleRef, articleRef)) {
      fail("WECHAT_PREUPLOAD_REVISION_PLAN_BINDING_INVALID");
    }
    return { resolution, canonicalPlan, article, bindings, articleOutputFact: clone(articleOutputFact), imagePlanOutputFact: clone(outputFact) };
  }
  const unboundCanonical = adaptAuthoritativeWechatImagePlanOutput(outputFact.runtimeOutput, {
    article, contentMaster, authorizedAssets
  });
  if (unboundCanonical.planHash !== imagePlanComponent.canonicalPlan?.planHash
    || hashUnifiedContent(unboundCanonical) !== hashUnifiedContent(outputFact.verifiedDomainOutput)
    || hashUnifiedContent(unboundCanonical) !== hashUnifiedContent(imagePlanComponent.canonicalPlan)) fail("WECHAT_PREUPLOAD_CANONICAL_PLAN_HASH_MISMATCH");
  const canonicalPlan = adaptAuthoritativeWechatImagePlanOutput(outputFact.runtimeOutput, {
    bindings,
    requireBindings: true,
    article, contentMaster, authorizedAssets
  });
  return { resolution, canonicalPlan, article, bindings, articleOutputFact: clone(articleOutputFact), imagePlanOutputFact: clone(outputFact) };
}

function requireLegacyPlanAuthority(input) {
  if (Object.hasOwn(input || {}, "planOutput")) fail("WECHAT_PREUPLOAD_NAKED_PLAN_OUTPUT_FORBIDDEN");
  const candidate = input?.candidate;
  const outputFact = input?.imagePlanOutputFact;
  const planAuthority = candidate?.imagePlanAuthority;
  if (!candidate || !planAuthority || planAuthority.contract !== "WechatImagePlanAuthority@1.0") fail("WECHAT_PREUPLOAD_PLAN_AUTHORITY_REQUIRED");
  if (!sameRef(candidate.candidateRef, planAuthority.candidateRef)) fail("WECHAT_PREUPLOAD_CANDIDATE_AUTHORITY_MISMATCH");
  if (outputFact?.contract !== "UnifiedSkillOutputFact@1.0" || outputFact.capability !== "plan-wechat-images") fail("WECHAT_PREUPLOAD_OUTPUT_FACT_REQUIRED");
  const outputFactBase = clone(outputFact); delete outputFactBase.factHash;
  if (hashUnifiedContent(outputFactBase) !== outputFact.factHash || hashUnifiedContent(outputFact.runtimeOutput) !== outputFact.outputHash) fail("WECHAT_PREUPLOAD_OUTPUT_FACT_HASH_MISMATCH");
  if (!sameRef({ id: outputFact.id, hash: outputFact.factHash }, planAuthority.imagePlanOutputFactRef)
    || !sameRef({ id: outputFact.id, hash: outputFact.outputHash }, planAuthority.imagePlanOutputRef)
    || !sameRef(outputFact.executionRecordRef, planAuthority.executionRecordRef)) fail("WECHAT_PREUPLOAD_OUTPUT_FACT_BINDING_MISMATCH");
  if (outputFact.status !== "completed" || outputFact.executionMode !== "real" || outputFact.productionEligibleOutput !== true
    || outputFact.runtimeOutput?.status !== "success" || outputFact.runtimeOutput?.blocked_reasons?.length) fail("WECHAT_PREUPLOAD_OUTPUT_FACT_NOT_PRODUCTION_ELIGIBLE");
  if (!sameRef(planAuthority.articleOutputFactRef, input.bindings?.articleRef)
    || !sameRef(planAuthority.imagePlanOutputFactRef, input.bindings?.imagePlanOutputFactRef)
    || !sameRef(candidate.candidateRef, input.bindings?.candidateRef)
    || !sameRef(candidate.platformRunRef, input.bindings?.platformRunRef)) fail("WECHAT_PREUPLOAD_AUTHORITY_BINDINGS_MISMATCH");
  const unboundCanonical = adaptAuthoritativeWechatImagePlanOutput(outputFact.runtimeOutput, {
    article: input.article, contentMaster: input.contentMaster, authorizedAssets: input.authorizedAssets || []
  });
  if (unboundCanonical.planHash !== planAuthority.canonicalPlanHash) fail("WECHAT_PREUPLOAD_CANONICAL_PLAN_HASH_MISMATCH");
  return {
    resolution: null, legacyCandidate: clone(candidate), article: clone(input.article),
    canonicalPlan: adaptAuthoritativeWechatImagePlanOutput(outputFact.runtimeOutput, {
      bindings: input.bindings, requireBindings: true, article: input.article,
      contentMaster: input.contentMaster, authorizedAssets: input.authorizedAssets || []
    })
  };
}

function requireStoredFact(fact, contract) {
  if (fact?.contract !== contract || !/^[a-f0-9]{64}$/.test(fact.factHash || "")) fail("WECHAT_PREUPLOAD_STORED_FACT_INVALID", contract);
  const base = clone(fact);
  delete base.factHash;
  if (hashWechatArtifactValue(base) !== fact.factHash) fail("WECHAT_PREUPLOAD_STORED_FACT_HASH_MISMATCH", contract);
  return clone(fact);
}

/** A confined filesystem sink for real local pre-upload bytes. */
export function createFilesystemWechatPreuploadArtifactSink(root) {
  const rootPath = resolve(clean(root));
  if (!clean(root)) fail("WECHAT_PREUPLOAD_SINK_ROOT_REQUIRED");
  const target = (path) => {
    const relativePath = safeRelativePath(path);
    const absolutePath = resolve(rootPath, relativePath);
    if (absolutePath !== rootPath && !absolutePath.startsWith(`${rootPath}\\`) && !absolutePath.startsWith(`${rootPath}/`)) fail("WECHAT_PREUPLOAD_SINK_ESCAPE", relativePath);
    return { relativePath, absolutePath };
  };
  return {
    kind: "local_filesystem",
    async write(path, bytes) {
      const file = target(path);
      await mkdir(dirname(file.absolutePath), { recursive: true });
      await writeFile(file.absolutePath, bytesOf(bytes, "WECHAT_PREUPLOAD_SINK_BYTES_REQUIRED"));
      return file.relativePath;
    },
    async read(path) {
      return readFile(target(path).absolutePath);
    }
  };
}

function requireSink(sink) {
  if (!sink || typeof sink.write !== "function" || typeof sink.read !== "function") fail("WECHAT_PREUPLOAD_ARTIFACT_SINK_REQUIRED");
  return sink;
}

async function persistAndVerify(sink, relativePath, bytes) {
  const path = safeRelativePath(relativePath);
  const payload = bytesOf(bytes, "WECHAT_PREUPLOAD_BYTES_REQUIRED");
  await sink.write(path, payload);
  const persisted = bytesOf(await sink.read(path), "WECHAT_PREUPLOAD_PERSISTED_BYTES_REQUIRED");
  if (!persisted.equals(payload)) fail("WECHAT_PREUPLOAD_PERSISTED_BYTES_MISMATCH", path);
  return { path, bytes: persisted.length, sha256: sha256(persisted), payload: persisted };
}

function resourcePath(declaration, result) {
  if (result?.relativePath) {
    const supplied = safeRelativePath(result.relativePath);
    if (!supplied.startsWith("assets/")) fail("WECHAT_PREUPLOAD_RESOURCE_PATH_INVALID", supplied);
    return supplied;
  }
  const extension = clean(result?.extension || ".png").toLowerCase();
  if (!EXTENSION.test(extension)) fail("WECHAT_PREUPLOAD_RESOURCE_EXTENSION_INVALID", extension);
  return `assets/${declaration.assetId}${extension}`;
}

function artifactRef(declaration, persisted) {
  const id = `wechat-preupload:${declaration.assetId}:${persisted.sha256.slice(0, 16)}`;
  return { id, hash: hashWechatArtifactValue({ id, relativePath: persisted.path, bytes: persisted.bytes, sha256: persisted.sha256 }) };
}

function successfulEvidence(declaration, result, persisted, bindings, attempt) {
  return {
    ...clone(result?.evidence || {}),
    assetId: declaration.assetId,
    status: declaration.strategy === "authorized_asset" ? "approved" : "succeeded",
    attempt,
    candidateRef: clone(bindings.candidateRef),
    articleRef: clone(bindings.articleRef),
    actualSha256: persisted.sha256,
    bytes: persisted.bytes,
    relativePath: persisted.path,
    artifactRef: artifactRef(declaration, persisted)
  };
}

function failedEvidence(declaration, error) {
  return {
    assetId: declaration.assetId,
    status: "failed",
    error: { code: error?.code || "WECHAT_PREUPLOAD_RESOURCE_RESOLUTION_FAILED", message: clean(error?.message) || "resource resolution failed" }
  };
}

/**
 * Produces only local pre-upload artifacts and append-only facts. Provider/resource
 * work, formatting and each quality gate are explicit injected capabilities.
 */
export async function runWechatPreuploadArtifactRuntime(input, dependencies) {
  const authority = input?.authorityResolution ? requireAtomicWechatAuthority(input) : requireLegacyPlanAuthority(input);
  const sink = requireSink(dependencies?.artifactSink);
  const store = input?.store || createWechatArtifactFactStore();
  const lifecycleCount = Array.isArray(store.lifecycleFacts) ? store.lifecycleFacts.length : 0;
  const attempt = input?.attempt;
  if (!Number.isInteger(attempt) || attempt < 1) fail("WECHAT_PREUPLOAD_ATTEMPT_INVALID");
  const key = clean(input?.idempotencyKeyPrefix);
  if (!key) fail("WECHAT_PREUPLOAD_IDEMPOTENCY_PREFIX_REQUIRED");
  const recordedAt = clean(input?.recordedAt);
  const canonicalPlan = authority.canonicalPlan;
  const article = authority.article;
  const planFact = appendWechatImagePlanArtifactFact(store, { canonicalPlan, idempotencyKey: `${key}:plan`, recordedAt });
  const evidenceByAssetId = {};
  const resourceErrors = [];
  const resolverCalls = { authorized_asset: 0, html_chart: 0, generated_raster: 0 };

  const declarations = canonicalPlan.declarations.filter((item) => item.strategy !== "no_image");
  const existingAttempts = declarations.map((declaration) => store.resourceAttempts?.find((fact) => fact.idempotencyKey === `${key}:resources:${declaration.slotId}:attempt-${attempt}`)).filter(Boolean);
  if (existingAttempts.length && existingAttempts.length !== declarations.length) fail("WECHAT_PREUPLOAD_PARTIAL_ATTEMPT_REPLAY_FORBIDDEN");
  let resourceAttempts;
  if (existingAttempts.length === declarations.length && declarations.length) {
    resourceAttempts = existingAttempts.map((fact) => requireStoredFact(fact, "WechatResourceResolutionAttempt@1.0"));
  } else {
    for (const declaration of declarations) {
      const resolver = dependencies?.resourceResolvers?.[declaration.strategy];
      try {
        if (typeof resolver !== "function") fail("WECHAT_PREUPLOAD_RESOURCE_RESOLVER_REQUIRED", declaration.strategy);
        resolverCalls[declaration.strategy] += 1;
        const result = await resolver({ declaration: clone(declaration), canonicalPlan: clone(canonicalPlan), planFact: clone(planFact), attempt, article: clone(article) });
        const payload = bytesOf(result?.bytes, "WECHAT_PREUPLOAD_RESOURCE_BYTES_REQUIRED");
        if (!payload.length) fail("WECHAT_PREUPLOAD_RESOURCE_BYTES_EMPTY", declaration.assetId);
        const persisted = await persistAndVerify(sink, resourcePath(declaration, result), payload);
        evidenceByAssetId[declaration.assetId] = successfulEvidence(declaration, result, persisted, canonicalPlan.bindings, attempt);
      } catch (error) {
        evidenceByAssetId[declaration.assetId] = failedEvidence(declaration, error);
        resourceErrors.push({ assetId: declaration.assetId, strategy: declaration.strategy, code: error?.code || "WECHAT_PREUPLOAD_RESOURCE_RESOLUTION_FAILED" });
      }
    }
    resourceAttempts = appendWechatResourceResolutionAttempts(store, {
      planFact,
      evidenceByAssetId,
      attempt,
      idempotencyKeyPrefix: `${key}:resources`,
      recordedAt
    });
  }
  const resourcesReady = resourceAttempts.every((fact) => fact.status === "succeeded");
  let formatFact = null;
  let htmlPath = null;
  let html = null;
  const runtimeErrors = [...resourceErrors];

  if (resourcesReady) {
    const existingFormat = store.formatFacts?.find((fact) => fact.idempotencyKey === `${key}:format`) || null;
    if (existingFormat) {
      formatFact = requireStoredFact(existingFormat, "WechatPreUploadFormatArtifactFact@1.0");
      if (formatFact.status === "succeeded") {
        htmlPath = "wechat-preupload.html";
        const persisted = bytesOf(await sink.read(htmlPath), "WECHAT_PREUPLOAD_PERSISTED_HTML_REQUIRED");
        if (persisted.length !== formatFact.htmlBytes || sha256(persisted) !== formatFact.htmlSha256) fail("WECHAT_PREUPLOAD_REPLAY_HTML_MISMATCH");
        html = persisted.toString("utf8");
        if (!Buffer.from(html, "utf8").equals(persisted)) fail("WECHAT_PREUPLOAD_HTML_NOT_UTF8");
      }
    } else {
      try {
        if (typeof dependencies?.formatHtml !== "function") fail("WECHAT_PREUPLOAD_FORMATTER_REQUIRED");
        const formatted = await dependencies.formatHtml({
          article: clone(article),
          canonicalPlan: clone(canonicalPlan),
          planFact: clone(planFact),
          resources: resourceAttempts.map((fact) => ({ assetId: fact.assetId, slotId: fact.slotId, role: fact.role, relativePath: fact.relativePath, sha256: fact.sha256, bytes: fact.bytes, attemptRef: factRef(fact) }))
        });
        const htmlBytes = bytesOf(formatted?.bytes ?? formatted?.html ?? formatted, "WECHAT_PREUPLOAD_HTML_BYTES_REQUIRED");
        const persisted = await persistAndVerify(sink, "wechat-preupload.html", htmlBytes);
        htmlPath = persisted.path;
        html = persisted.payload.toString("utf8");
        if (!Buffer.from(html, "utf8").equals(persisted.payload)) fail("WECHAT_PREUPLOAD_HTML_NOT_UTF8");
        formatFact = appendWechatFormatArtifactFact(store, { planFact, resourceAttempts: store.resourceAttempts, html, resourceRefs: resourceAttempts.map(factRef), idempotencyKey: `${key}:format`, recordedAt });
      } catch (error) {
        runtimeErrors.push({ stage: "format", code: error?.code || "WECHAT_PREUPLOAD_FORMAT_FAILED" });
        formatFact = appendWechatFormatArtifactFact(store, { planFact, resourceAttempts: store.resourceAttempts, html: "", resourceRefs: resourceAttempts.map(factRef), idempotencyKey: `${key}:format`, recordedAt });
      }
    }
  }

  const qualityFacts = [];
  if (formatFact?.status === "succeeded") {
    for (const gate of GATES) {
      let result;
      const existingQuality = store.qualityFacts?.find((fact) => fact.idempotencyKey === `${key}:quality:${gate}`) || null;
      if (existingQuality) {
        qualityFacts.push(requireStoredFact(existingQuality, "WechatArtifactQualityGateFact@1.0"));
        continue;
      }
      try {
        const evaluator = dependencies?.qualityGates?.[gate];
        if (typeof evaluator !== "function") fail("WECHAT_PREUPLOAD_QUALITY_GATE_REQUIRED", gate);
        result = await evaluator({ gate, article: clone(article), canonicalPlan: clone(canonicalPlan), planFact: clone(planFact), formatFact: clone(formatFact), html, htmlPath, resourceAttempts: clone(resourceAttempts) });
      } catch (error) {
        result = { status: "failed", evidenceRefs: [], details: { code: error?.code || "WECHAT_PREUPLOAD_QUALITY_GATE_FAILED" } };
        runtimeErrors.push({ stage: `quality:${gate}`, code: result.details.code });
      }
      qualityFacts.push(appendWechatQualityGateFact(store, {
        planFact,
        formatFact,
        gate,
        status: result?.status,
        evidenceRefs: result?.evidenceRefs || [],
        details: result?.details || null,
        idempotencyKey: `${key}:quality:${gate}`,
        recordedAt
      }));
    }
  }

  if ((store.lifecycleFacts?.length || 0) !== lifecycleCount) fail("WECHAT_PREUPLOAD_LIFECYCLE_FACT_FORBIDDEN");
  let reviewPayload = null;
  if (formatFact?.status === "succeeded") {
    const resources = [];
    for (const fact of resourceAttempts.filter((item) => item.status === "succeeded")) {
      const payload = bytesOf(await sink.read(fact.relativePath), "WECHAT_PREUPLOAD_REVIEW_RESOURCE_REQUIRED");
      if (payload.length !== fact.bytes || sha256(payload) !== fact.sha256) fail("WECHAT_PREUPLOAD_REVIEW_RESOURCE_MISMATCH", fact.assetId);
      resources.push({
        attemptRef: factRef(fact), assetId: fact.assetId, relativePath: fact.relativePath,
        mediaType: mediaTypeForPath(fact.relativePath), encoding: "base64", content: payload.toString("base64"),
        bytes: payload.length, sha256: sha256(payload)
      });
    }
    const payloadBase = {
      schemaVersion: "1.0", contract: "WechatPreUploadReviewPayload@1.0", semantics: "pre_upload_template_not_wechat_final",
      contentProjectRef: clone(canonicalPlan.bindings.contentProjectRef), platformRunRef: clone(canonicalPlan.bindings.platformRunRef),
      candidateRef: clone(canonicalPlan.bindings.candidateRef), formatFactRef: factRef(formatFact),
      html: { relativePath: htmlPath, encoding: "utf8", content: html, bytes: formatFact.htmlBytes, sha256: formatFact.htmlSha256 },
      resources
    };
    reviewPayload = { ...payloadBase, payloadHash: hashWechatArtifactValue(payloadBase) };
  }
  const wholeArticleGateEnabled = input?.wholeArticleGateEnabled === true || (store.wholeArticleQualityFacts?.length || 0) > 0;
  let wholeArticleQualityFact = null;
  if (wholeArticleGateEnabled && formatFact?.status === "succeeded" && reviewPayload) {
    const preUploadRef = { id: `wechat-preupload-payload:${reviewPayload.payloadHash.slice(0, 24)}`, hash: reviewPayload.payloadHash };
    const existing = store.wholeArticleQualityFacts?.find((fact) => fact.idempotencyKey === `${key}:whole-article-quality`) || null;
    if (existing) {
      wholeArticleQualityFact = requireStoredFact(existing, "WechatWholeArticleQualityFact@1.0");
    } else {
      let evidence = null;
      try {
        if (typeof dependencies?.wholeArticleQualityGate !== "function") fail("WECHAT_PREUPLOAD_WHOLE_ARTICLE_GATE_REQUIRED");
        evidence = await dependencies.wholeArticleQualityGate({
          article: clone(article), canonicalPlan: clone(canonicalPlan), planFact: clone(planFact), formatFact: clone(formatFact),
          html, htmlPath, resourceAttempts: clone(resourceAttempts), reviewPayload: clone(reviewPayload), preUploadRef: clone(preUploadRef), artifactSink: sink
        });
      } catch (error) {
        runtimeErrors.push({ stage: "whole_article_quality", code: error?.code || "WECHAT_PREUPLOAD_WHOLE_ARTICLE_GATE_FAILED" });
      }
      wholeArticleQualityFact = appendWechatWholeArticleQualityFact(store, {
        planFact, formatFact, resourceAttempts: store.resourceAttempts, preUploadRef, evidence,
        idempotencyKey: `${key}:whole-article-quality`, recordedAt
      });
    }
  }
  const preUploadRef = reviewPayload ? { id: `wechat-preupload-payload:${reviewPayload.payloadHash.slice(0, 24)}`, hash: reviewPayload.payloadHash } : null;
  const wholeArticleQualityFacts = store.wholeArticleQualityFacts || [];
  const state = evaluateWechatPreUploadArtifactState({ planFact, formatFact, qualityFacts, wholeArticleQualityFacts, resourceAttempts: store.resourceAttempts || [], preUploadRef, wholeArticleGateEnabled, humanReviewStatus: "not_reviewed" });
  const candidateProjection = {
    candidateRef: clone(authority.resolution?.candidateRef || authority.legacyCandidate.candidateRef),
    ...(authority.resolution ? {
      authorityKind: "atomic_wechat_v1", commitRef: clone(authority.resolution.payload.commitRef),
      materializedContentProjectRef: clone(authority.resolution.materializedProjectRef)
    } : { imagePlanAuthority: clone(authority.legacyCandidate.imagePlanAuthority) }),
    preuploadArtifactState: state,
    planFactRef: factRef(planFact),
    resourceAttemptRefs: resourceAttempts.map(factRef),
    formatFactRef: formatFact ? factRef(formatFact) : null,
    qualityGateFactRefs: qualityFacts.map(factRef),
    semantics: "pre_upload_template_not_wechat_final",
    platformUploadPerformed: false,
    draftCreated: false,
    publicationPerformed: false
  };
  return {
    schemaVersion: "1.0",
    contract: "WechatPreUploadArtifactRuntimeResult@1.0",
    semantics: "pre_upload_template_not_wechat_final",
    store,
    canonicalPlan,
    planFact,
    resourceAttempts,
    formatFact,
    qualityFacts,
    wholeArticleQualityFact,
    wholeArticleQualityFacts,
    wholeArticleGateEnabled,
    state,
    candidateProjection,
    files: { html: htmlPath, assets: resourceAttempts.filter((fact) => fact.status === "succeeded").map((fact) => fact.relativePath) },
    htmlArtifact: formatFact?.status === "succeeded" ? { semantics: "pre_upload_template_not_wechat_final", relativePath: htmlPath, bytes: formatFact.htmlBytes, sha256: formatFact.htmlSha256, formatFactRef: factRef(formatFact) } : null,
    reviewPayload,
    resolverCalls,
    errors: runtimeErrors,
    selectable: false,
    finalBundleAuthority: false,
    platformUploadPerformed: false,
    draftCreated: false,
    publicationPerformed: false
  };
}
