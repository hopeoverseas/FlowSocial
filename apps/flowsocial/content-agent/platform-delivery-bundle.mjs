import { createHash } from "node:crypto";

const HASH = /^[a-f0-9]{64}$/;
const PLATFORMS = new Set(["xiaohongshu", "wechat"]);

const clone = (value) => structuredClone(value);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const bytesOf = (value) => Buffer.isBuffer(value) ? Buffer.from(value) : value instanceof Uint8Array ? Buffer.from(value) : Buffer.from(String(value), "utf8");
const text = (value) => String(value ?? "").replace(/\r\n?/g, "\n");

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function stableHash(value) {
  return sha256(canonical(value));
}

function fail(code, detail = "") {
  throw Object.assign(new Error(`${code}${detail ? `: ${detail}` : ""}`), { code });
}

function requireText(value, scope) {
  if (typeof value !== "string" || !value.trim()) fail("PLATFORM_DELIVERY_TEXT_REQUIRED", scope);
  return value.trim();
}

function requireRef(value, scope) {
  if (!value || typeof value !== "object" || Object.keys(value).sort().join(",") !== "hash,id" || !requireText(value.id, `${scope}.id`) || !HASH.test(value.hash || "")) fail("PLATFORM_DELIVERY_REF_INVALID", scope);
  return value;
}

function sameRef(left, right) {
  return Boolean(left && right && left.id === right.id && left.hash === right.hash);
}

function safeFileName(value, scope) {
  const file = requireText(value, scope).replace(/\\/g, "/");
  if (file.startsWith("/") || /^[a-z]:/i.test(file) || file.split("/").includes("..") || file.split("/").some((part) => !part)) fail("PLATFORM_DELIVERY_FILE_NAME_INVALID", file);
  return file;
}

function makeFile(path, content, kind, bindings = {}) {
  const data = bytesOf(content);
  if (!data.length) fail("PLATFORM_DELIVERY_EMPTY_FILE", path);
  return {
    path: safeFileName(path, "file.path"),
    kind,
    bytes: data.length,
    sha256: sha256(data),
    bindings: clone(bindings),
    content: typeof content === "string" ? text(content) : data
  };
}

function publicFile(file) {
  const { content: _content, ...descriptor } = file;
  return descriptor;
}

function statusRecord(input, name, allowed) {
  if (!input || typeof input !== "object" || !allowed.includes(input.status)) fail("PLATFORM_DELIVERY_STATUS_INVALID", name);
  if (input.ref != null) requireRef(input.ref, `${name}.ref`);
  return { status: input.status, ref: input.ref ? clone(input.ref) : null };
}

function lifecycle(input) {
  const machineReview = statusRecord(input.machineReview, "machineReview", ["not_run", "failed", "passed"]);
  const editorialReview = statusRecord(input.editorialReview, "editorialReview", ["not_reviewed", "changes_requested", "passed"]);
  const userSelection = statusRecord(input.userSelection, "userSelection", ["not_selected", "selected"]);
  const promotion = statusRecord(input.promotion, "promotion", ["not_promoted", "promoted"]);
  const publication = statusRecord(input.publication, "publication", ["not_published", "publication_pending", "published"]);
  const blockers = [];
  if (machineReview.status !== "passed") blockers.push("machine_review_not_passed");
  if (editorialReview.status !== "passed") blockers.push("editorial_review_not_passed");
  if (userSelection.status !== "selected") blockers.push("user_not_selected");
  if (promotion.status !== "promoted") blockers.push("version_not_promoted");
  const deliveryReady = blockers.length === 0;
  if (promotion.status === "promoted" && !promotion.ref) fail("PLATFORM_DELIVERY_PROMOTION_REF_REQUIRED");
  if (publication.status === "published" && (!publication.ref || !deliveryReady)) fail("PLATFORM_DELIVERY_PUBLICATION_EVIDENCE_REQUIRED");
  return { machineReview, editorialReview, userSelection, promotion, publication, deliveryReady, blockers };
}

function validateCommon(input, platform) {
  if (input?.schemaVersion !== "1.0" || input?.platform !== platform || !PLATFORMS.has(platform)) fail("PLATFORM_DELIVERY_INPUT_VERSION");
  const platformVersionRef = clone(requireRef(input.platformVersionRef, "platformVersionRef"));
  const states = lifecycle(input.states || {});
  if (states.promotion.status === "promoted" && !sameRef(input.promotedVersionRef, platformVersionRef)) fail("PLATFORM_DELIVERY_PROMOTED_VERSION_MISMATCH");
  if (states.promotion.status !== "promoted" && input.promotedVersionRef != null) fail("PLATFORM_DELIVERY_UNPROMOTED_VERSION_REF_FORBIDDEN");
  const provider = input.providerEvidence == null ? null : { ...clone(input.providerEvidence), lifecycleAuthority: false };
  const lifecycleRefs = input.lifecycleRefs == null ? null : clone(input.lifecycleRefs);
  return { platformVersionRef, states, provider, lifecycleRefs, resourceUploadPerformed: input.resourceUploadPerformed === true };
}

function copyTextFile(name, value, label, bindings) {
  return makeFile(name, `${requireText(value, label)}\n`, "user_text", bindings);
}

function manifestFor({ platform, platformVersionRef, states, provider, lifecycleRefs, files, deliverySemantics, resourceRequirements, resourceUploadPerformed = false }) {
  const base = {
    schemaVersion: "1.0",
    contract: "PlatformDeliveryBundleManifest@1.0",
    platform,
    platformVersionRef,
    deliverySemantics,
    states,
    ...(lifecycleRefs ? { lifecycleRefs } : {}),
    providerEvidence: provider,
    resourceRequirements,
    files: files.map(publicFile),
    claims: {
      deterministicOfflineAdapter: !resourceUploadPerformed,
      productionDatabaseWrite: false,
      platformUploadPerformed: resourceUploadPerformed,
      platformPublicationPerformed: false,
      deliveryReady: states.deliveryReady,
      published: states.publication.status === "published"
    }
  };
  return { ...base, manifestHash: stableHash(base) };
}

function finishBundle(manifest, files) {
  const manifestFile = makeFile("manifest.json", `${JSON.stringify(manifest, null, 2)}\n`, "manifest", { platformVersionRef: manifest.platformVersionRef });
  const allFiles = [...files, manifestFile];
  const bundleBase = {
    schemaVersion: "1.0",
    contract: "PlatformDeliveryBundle@1.0",
    platform: manifest.platform,
    platformVersionRef: manifest.platformVersionRef,
    manifestRef: { id: `manifest:${manifest.platformVersionRef.id}`, hash: manifest.manifestHash },
    files: allFiles.map(publicFile)
  };
  return { ...bundleBase, bundleHash: stableHash(bundleBase), manifest, files: allFiles };
}

function assertUniquePaths(files) {
  const paths = new Set();
  for (const file of files) {
    if (paths.has(file.path)) fail("PLATFORM_DELIVERY_DUPLICATE_FILE", file.path);
    paths.add(file.path);
  }
}

export function buildXiaohongshuPlatformDeliveryBundle(input) {
  const common = validateCommon(input, "xiaohongshu");
  const selection = input.selection || {};
  if (!Array.isArray(selection.pageRevisionRefs) || !selection.pageRevisionRefs.length) fail("XHS_DELIVERY_PAGE_SELECTION_REQUIRED");
  selection.pageRevisionRefs.forEach((item, index) => requireRef(item, `selection.pageRevisionRefs[${index}]`));
  const pages = Array.isArray(input.pages) ? input.pages : [];
  if (pages.length !== selection.pageRevisionRefs.length) fail("XHS_DELIVERY_SELECTED_PAGE_COUNT_MISMATCH");
  const files = [
    copyTextFile("copy/title.txt", input.copy?.title, "copy.title", { platformVersionRef: common.platformVersionRef }),
    copyTextFile("copy/body.txt", input.copy?.body, "copy.body", { platformVersionRef: common.platformVersionRef }),
    copyTextFile("copy/tags.txt", (input.copy?.tags || []).map((tag) => tag.startsWith("#") ? tag : `#${tag}`).join(" "), "copy.tags", { platformVersionRef: common.platformVersionRef }),
    makeFile("copy/pinned-comment.txt", `${text(input.copy?.pinnedComment)}\n`, "user_text", { platformVersionRef: common.platformVersionRef })
  ];
  const seenPages = new Set();
  pages.forEach((page, index) => {
    requireText(page.pageId, `pages[${index}].pageId`);
    if (seenPages.has(page.pageId)) fail("XHS_DELIVERY_DUPLICATE_PAGE", page.pageId);
    seenPages.add(page.pageId);
    const selectedRef = selection.pageRevisionRefs[index];
    if (!sameRef(page.revisionRef, selectedRef)) fail("XHS_DELIVERY_REVISION_SELECTION_MISMATCH", page.pageId);
    requireRef(page.revisionRef, `pages[${index}].revisionRef`);
    const fileName = safeFileName(page.fileName || `${String(index + 1).padStart(2, "0")}_${page.pageId}.png`, `pages[${index}].fileName`);
    if (fileName.includes("/")) fail("XHS_DELIVERY_PAGE_FILE_MUST_BE_FLAT", fileName);
    files.push(makeFile(`images/${fileName}`, page.bytes, "selected_page_image", { platformVersionRef: common.platformVersionRef, pageId: page.pageId, revisionRef: page.revisionRef }));
  });
  assertUniquePaths(files);
  const manifest = manifestFor({ ...common, platform: "xiaohongshu", files, deliverySemantics: "offline_user_ready_files_not_platform_publication", resourceRequirements: [] });
  return finishBundle(manifest, files);
}

function localHtmlRefs(html) {
  return [...String(html).matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)].map((match) => match[1]).filter((value) => !/^(?:https?:|data:|#|mailto:|tel:)/i.test(value));
}

function checklist(requirements) {
  const rows = requirements.map((item, index) => `${index + 1}. ${item.role === "cover" ? "封面" : "正文图片"} \`${item.localPath}\`：${item.action}`).join("\n");
  return `# 公众号资源上传/替换清单\n\n此包中的 \`wechat-upload-template.html\` 是上传前模板，不是可直接发布成品。\n\n${rows || "无待上传资源；模板已自包含。"}\n`;
}

export function buildWechatPlatformDeliveryBundle(input) {
  const common = validateCommon(input, "wechat");
  const template = text(requireText(input.uploadTemplateHtml, "uploadTemplateHtml"));
  const resources = Array.isArray(input.resources) ? input.resources : [];
  const byPath = new Map();
  const files = [
    copyTextFile("copy/title.txt", input.title, "title", { platformVersionRef: common.platformVersionRef }),
    copyTextFile("copy/article.md", input.articleMarkdown, "articleMarkdown", { platformVersionRef: common.platformVersionRef }),
    ...(input.postUploadOnly === true ? [] : [makeFile("wechat-upload-template.html", template, "wechat_pre_upload_template", { platformVersionRef: common.platformVersionRef, publishableAsIs: false })])
  ];
  for (const [index, resource] of resources.entries()) {
    const path = safeFileName(resource.path, `resources[${index}].path`);
    if (!path.startsWith("assets/")) fail("WECHAT_DELIVERY_RESOURCE_PATH_INVALID", path);
    if (byPath.has(path)) fail("WECHAT_DELIVERY_DUPLICATE_RESOURCE", path);
    byPath.set(path, resource);
    files.push(makeFile(path, resource.bytes, "wechat_upload_resource", { platformVersionRef: common.platformVersionRef, assetId: requireText(resource.assetId, `resources[${index}].assetId`), role: resource.role }));
  }
  const refs = [...new Set(localHtmlRefs(template))];
  const missing = refs.filter((path) => !byPath.has(path));
  if (missing.length) fail("WECHAT_DELIVERY_SILENT_EXTERNAL_RESOURCE", missing.join(","));
  const planSteps = input.uploadPlan?.steps || [];
  const requirements = refs.map((path) => {
    const resource = byPath.get(path);
    const step = planSteps.find((item) => item.localPath === path || item.replaceHtmlSrc === path);
    if (!step) fail("WECHAT_DELIVERY_UPLOAD_REQUIREMENT_MISSING", path);
    const role = resource.role || step.role;
    return { assetId: resource.assetId, role, localPath: path, action: role === "cover" ? "上传为永久图片素材，并把 media_id 写入草稿 thumb_media_id" : "先调用 uploadimg，再用返回的微信 HTTPS URL 替换模板 src", resolved: false };
  });
  files.push(makeFile("RESOURCE_UPLOAD_CHECKLIST.md", checklist(requirements), "resource_checklist", { platformVersionRef: common.platformVersionRef }));
  if (input.uploadedFinalHtml != null) {
    const finalHtml = text(requireText(input.uploadedFinalHtml, "uploadedFinalHtml"));
    if (localHtmlRefs(finalHtml).length) fail("WECHAT_DELIVERY_UPLOADED_FINAL_HAS_LOCAL_REFS");
    requireRef(input.uploadEvidenceRef, "uploadEvidenceRef");
    files.push(makeFile("wechat-uploaded-final.html", finalHtml, "wechat_post_upload_final", { platformVersionRef: common.platformVersionRef, uploadEvidenceRef: input.uploadEvidenceRef, platformPublished: false }));
  }
  assertUniquePaths(files);
  const manifest = manifestFor({ ...common, platform: "wechat", files, deliverySemantics: input.uploadedFinalHtml == null ? "wechat_pre_upload_template_requires_resource_upload" : "wechat_post_upload_content_not_platform_publication", resourceRequirements: requirements });
  return finishBundle(manifest, files);
}

export function buildPlatformDeliveryBundle(input) {
  if (input?.platform === "xiaohongshu") return buildXiaohongshuPlatformDeliveryBundle(input);
  if (input?.platform === "wechat") return buildWechatPlatformDeliveryBundle(input);
  fail("PLATFORM_DELIVERY_PLATFORM_INVALID");
}

export function buildAtomicXhsPostPromotionDeliveryBundle(input) {
  if (input?.platform !== "xiaohongshu" || !sameRef(input.platformVersionRef, input.promotedVersionRef)) {
    fail("ATOMIC_XHS_DELIVERY_PROMOTED_VERSION_REQUIRED");
  }
  for (const name of ["editorialReviewRef", "selectionRef", "promotionRef"]) requireRef(input.lifecycleRefs?.[name], `lifecycleRefs.${name}`);
  if (!sameRef(input.states?.editorialReview?.ref, input.lifecycleRefs.editorialReviewRef)
    || !sameRef(input.states?.userSelection?.ref, input.lifecycleRefs.selectionRef)
    || !sameRef(input.states?.promotion?.ref, input.lifecycleRefs.promotionRef)) {
    fail("ATOMIC_XHS_DELIVERY_LIFECYCLE_BINDING_MISMATCH");
  }
  const bundle = buildXiaohongshuPlatformDeliveryBundle(input);
  if (!sameRef(bundle.platformVersionRef, input.promotedVersionRef)
    || !sameRef(bundle.manifest.platformVersionRef, input.promotedVersionRef)
    || bundle.manifest.states.publication.status !== "not_published"
    || bundle.manifest.claims.platformPublicationPerformed !== false) {
    fail("ATOMIC_XHS_DELIVERY_AUTHORITY_INVALID");
  }
  return bundle;
}

export function validatePlatformDeliveryBundle(bundle) {
  if (bundle?.schemaVersion !== "1.0" || bundle?.contract !== "PlatformDeliveryBundle@1.0" || !PLATFORMS.has(bundle.platform)) fail("PLATFORM_DELIVERY_BUNDLE_INVALID");
  requireRef(bundle.platformVersionRef, "bundle.platformVersionRef");
  if (!Array.isArray(bundle.files) || !bundle.files.length) fail("PLATFORM_DELIVERY_BUNDLE_FILES_REQUIRED");
  assertUniquePaths(bundle.files);
  for (const file of bundle.files) {
    safeFileName(file.path, "bundle.file.path");
    if (!Number.isInteger(file.bytes) || file.bytes < 1 || !HASH.test(file.sha256 || "")) fail("PLATFORM_DELIVERY_FILE_DESCRIPTOR_INVALID", file.path);
    if (file.content != null) {
      const bytes = bytesOf(file.content);
      if (bytes.length !== file.bytes || sha256(bytes) !== file.sha256) fail("PLATFORM_DELIVERY_FILE_HASH_MISMATCH", file.path);
    }
  }
  const bundleBase = clone(bundle); delete bundleBase.bundleHash; delete bundleBase.manifest;
  bundleBase.files = bundleBase.files.map(publicFile);
  if (stableHash(bundleBase) !== bundle.bundleHash) fail("PLATFORM_DELIVERY_BUNDLE_HASH_MISMATCH");
  if (bundle.manifest) {
    const manifestBase = clone(bundle.manifest); delete manifestBase.manifestHash;
    if (stableHash(manifestBase) !== bundle.manifest.manifestHash || bundle.manifest.manifestHash !== bundle.manifestRef.hash) fail("PLATFORM_DELIVERY_MANIFEST_HASH_MISMATCH");
    if (!sameRef(bundle.manifest.platformVersionRef, bundle.platformVersionRef)) fail("PLATFORM_DELIVERY_VERSION_BINDING_MISMATCH");
  }
  return bundle;
}

export function adaptLegacyDeliveryBundleReadOnly(input) {
  const originalHash = stableHash(input);
  const projection = {
    schemaVersion: "1.0",
    contract: "LegacyPlatformDeliveryProjection@1.0",
    legacyRef: { id: input?.id || input?.contentTaskId || `legacy:${originalHash.slice(0, 16)}`, hash: originalHash },
    deliverySemantics: "legacy_delivery_semantics",
    deliveryReady: false,
    published: false,
    blockers: ["legacy_exact_platform_version_unproven", "legacy_user_selection_unproven", "legacy_publication_unproven"]
  };
  const deepFreeze = (value) => {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      Object.freeze(value);
      Object.values(value).forEach(deepFreeze);
    }
    return value;
  };
  const result = deepFreeze({ ...projection, projectionHash: stableHash(projection) });
  if (stableHash(input) !== originalHash) fail("PLATFORM_DELIVERY_LEGACY_INPUT_MUTATED");
  return result;
}
