import { stableHash } from "./canonical.mjs";
import { compilePageGenerationRequest } from "./compiler.mjs";
import {
  validatePromptReviewDecision,
  validateProviderCapabilitySnapshot,
  validateProviderCompilationTrace,
  validateVisualAssetRegistrySnapshot
} from "./contracts.mjs";
import { validateDesignSkillInvocation } from "../../skills/design-xhs-integrated-pages/scripts/invoke-skill.mjs";
import { describeXhsBrandColor, normalizeXhsPresentationText } from "../../skills/design-xhs-integrated-pages/scripts/runtime-compiler.mjs";

export const EXECUTION_PLAN_CONTRACT = "IntegratedPageExecutionPlan@1.0";
export const ELIGIBILITY_CONTRACT = "IntegratedPageEligibilityDecision@1.0";
const HASH = /^[a-f0-9]{64}$/;
const blocker = (code, scope, detail) => ({ code, scope, detail, fallback: "deterministic_layout" });
const REQUEST_PROJECTIONS = Object.freeze({
  "image2.text-to-image.v1": {
    requestFields: ["model", "input.prompt", "input.aspect_ratio", "input.resolution"],
    referenceInputField: null
  },
  // Seedream 4.5 uses the same frozen text-to-image request projection as
  // the legacy image2 adapter.  Keep the adapter identity explicit while
  // allowing the configured provider model to pass contract validation.
  "seedream45.text-to-image.v1": {
    requestFields: ["model", "input.prompt", "input.aspect_ratio", "input.resolution"],
    referenceInputField: null
  },
  "nano-banana-2.v1": {
    requestFields: ["model", "input.prompt", "input.image_input", "input.aspect_ratio", "input.resolution", "input.output_format"],
    referenceInputField: "image_input"
  }
});

function exact(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label}:OBJECT_REQUIRED`);
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort())) throw new Error(`${label}:FIELDS:${Object.keys(value).sort().join(",")}`);
}

function hash(value, label) {
  if (!HASH.test(value || "")) throw new Error(`${label}:HASH_REQUIRED`);
}

function validateHashed(value, field, label) {
  hash(value[field], `${label}.${field}`);
  const copy = structuredClone(value);
  delete copy[field];
  if (stableHash(copy) !== value[field]) throw new Error(`${label}:HASH_MISMATCH`);
}

function add(items, item) {
  if (!items.some((existing) => existing.code === item.code && existing.scope === item.scope && existing.detail === item.detail)) items.push(item);
}

function validateProviderProfile(profile) {
  exact(profile, ["provider", "model", "adapter", "lifecycle", "createEndpoint", "requestFields", "inputDefaults", "nativeOutputDimensions", "normalization", "estimatedCostPerCandidate", "currency"], "providerProfile");
  if (typeof profile.provider !== "string" || !profile.provider || typeof profile.model !== "string" || !profile.model || profile.lifecycle !== "experimental") throw new Error("PROVIDER_PROFILE_IDENTITY_INVALID");
  exact(profile.adapter, ["id", "version", "projectionKey"], "providerProfile.adapter");
  if (!profile.adapter.id || !profile.adapter.version || !REQUEST_PROJECTIONS[profile.adapter.projectionKey]) throw new Error("PROVIDER_ADAPTER_IDENTITY_INVALID");
  if (typeof profile.createEndpoint !== "string" || !profile.createEndpoint.startsWith("/")) throw new Error("PROVIDER_PROFILE_ENDPOINT_INVALID");
  if (!Number.isFinite(profile.estimatedCostPerCandidate) || profile.estimatedCostPerCandidate <= 0) throw new Error("PROVIDER_PROFILE_COST_INVALID");
  exact(profile.nativeOutputDimensions, ["width", "height"], "providerProfile.nativeOutputDimensions");
  exact(profile.normalization, ["mode", "target", "nonUniformStretchAllowed", "protectedRegionCropAllowed"], "providerProfile.normalization");
  exact(profile.normalization.target, ["width", "height"], "providerProfile.normalization.target");
  if (profile.normalization.target.width !== 1080 || profile.normalization.target.height !== 1440 || profile.normalization.nonUniformStretchAllowed !== false || profile.normalization.protectedRegionCropAllowed !== false) throw new Error("PROVIDER_PROFILE_NORMALIZATION_UNSAFE");
  if (stableHash(profile.requestFields) !== stableHash(REQUEST_PROJECTIONS[profile.adapter.projectionKey].requestFields)) throw new Error("PROVIDER_PROFILE_REQUEST_FIELDS_INVALID");
}

function validateCostConfirmation(value) {
  exact(value, ["status", "currency", "approvedMaxTotal", "confirmedBy", "confirmedAt", "confirmationHash"], "costConfirmation");
  validateHashed(value, "confirmationHash", "costConfirmation");
  if (!["pending", "confirmed"].includes(value.status)) throw new Error("COST_CONFIRMATION_STATUS_INVALID");
  if (value.status === "confirmed" && (!value.confirmedBy || !value.confirmedAt || !Number.isFinite(value.approvedMaxTotal) || value.approvedMaxTotal <= 0)) throw new Error("COST_CONFIRMATION_EVIDENCE_REQUIRED");
  if (value.status === "pending" && (value.confirmedBy !== null || value.confirmedAt !== null)) throw new Error("COST_CONFIRMATION_AUDIT_FORBIDDEN");
}

function registryBinding(registry, id, type, scope, blockers) {
  const entry = registry.entries.find((item) => item.id === id && item.assetType === type);
  if (!entry) {
    add(blockers, blocker("REGISTRY_ASSET_BINDING_MISSING", scope, `${type}:${id}`));
    return { id, hash: stableHash(null), status: "missing" };
  }
  if (!entry.license?.id || entry.license.allowsOfflineCompilation !== true || !["experimental", "approved"].includes(entry.status)) {
    add(blockers, blocker("SOURCE_LICENSE_INELIGIBLE", scope, `${type}:${id}`));
  }
  return { id, hash: entry.entryHash, status: entry.status };
}

function canReclassifyNativeDimension(profile, capabilitySnapshot) {
  if (!["fit_crop", "fit_pad", "resample"].includes(profile.normalization.mode)) return false;
  if (profile.normalization.nonUniformStretchAllowed || profile.normalization.protectedRegionCropAllowed) return false;
  return capabilitySnapshot.capabilities.supportedDimensions.some((item) => item.width === profile.nativeOutputDimensions.width && item.height === profile.nativeOutputDimensions.height);
}

const INTERNAL_RENDER_TOKENS = Object.freeze([
  "evidence", "problem", "method", "summary", "cta", "cover", "page role",
  "page_id", "pageid", "archetype", "pattern", "headline/body/cta"
]);
const AUDIENCE_SAFE_ASCII_ALLOWLIST = Object.freeze(new Set(["AI", "IP", "B2B", "SaaS", "SOP"]));
const FROZEN_05M_INVOCATION = Object.freeze({
  promptSetId: "prompt-set:05m-v3-p1-p5-p9-7f195f65012e889d:v1",
  promptSetHash: "1d037fd054143eb5da2de8d1469bb90fd70bd4ec90f527f4dbd1d745706a072f",
  invocationHash: "1c39503df93bf8c70631f1470812f07d88e446185596186c316e69add44ae1ed"
});
const INTERNAL_DIRECTION_TRANSLATIONS = Object.freeze(new Map([
  ["single-metaphor-with-balanced-information-zones", "以一个核心隐喻组织画面，并为文字保留均衡清晰的信息区域"],
  ["dominant-concept-then-readable-verbatim-text", "先建立明确主视觉，再保证所有逐字文字清晰可读"],
  ["frame-concept-without-replacing-facts", "图形只辅助理解，不得替代、改写或新增事实"],
  ["stable-grid-and-grouped-information", "使用稳定分区组织同类信息"],
  ["stable-grid-and-grouped-cards", "使用稳定分区组织同类信息"],
  ["headline-then-equal-weight-details", "先突出主标题，再以同等视觉权重展示细节"],
  ["explain-structure", "用图形帮助解释信息结构"],
  ["single-metaphor-with-mirrored-comparison", "以单一隐喻组织左右对照关系"],
  ["dominant-concept-then-balanced-columns", "先突出核心概念，再平衡排列对照内容"],
  ["frame-concept", "用图形框定核心概念"],
  ["annotated-path-with-step-spine", "以带批注的清晰路径组织连续步骤"],
  ["promise-then-sequential-steps", "先说明承诺，再按顺序展示步骤"],
  ["guide-reading-flow", "用图形引导自然阅读顺序"]
]));

export function isFrozen05MInvocation(skillInvocation) {
  return skillInvocation?.promptSet?.id === FROZEN_05M_INVOCATION.promptSetId
    && skillInvocation?.promptSetHash === FROZEN_05M_INVOCATION.promptSetHash
    && skillInvocation?.invocationHash === FROZEN_05M_INVOCATION.invocationHash;
}

function audienceSafeTypographyRoles(value) {
  if (value === true || value === "true") return "主标题、正文、行动提示";
  const roles = String(value || "")
    .split(/[,/]/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .map((item) => ({ headline: "主标题", body: "正文", label: "辅助标签", footer: "页脚", cta: "行动提示" }[item] || "正文"));
  return [...new Set(roles)].join("、") || "主标题、正文、行动提示";
}

function audienceSafePalette(value) {
  if (value === true || value === "true") return "根据本篇主题、情绪和视觉概念生成主辅色；整套保持协调，每页只使用有限色数";
  return String(value || "")
    .replace(/burgundy/gi, "酒红")
    .replace(/charcoal/gi, "炭黑")
    .replace(/paper/gi, "暖白纸张")
    .replace(/cream/gi, "米白")
    .replace(/ink/gi, "墨色");
}

function audienceSafeInstruction(value) {
  const raw = String(value || "");
  const protectedHex = [];
  const withProtectedHex = raw.replace(/#[0-9a-f]{6}\b/gi, (value) => {
    protectedHex.push(value.toUpperCase());
    return `色号占位${protectedHex.length - 1}`;
  });
  const safe = (INTERNAL_DIRECTION_TRANSLATIONS.get(raw) || withProtectedHex)
    // Brand guidelines commonly contain short Latin labels (for example
    // “VI”, “Logo”, or a one-letter color swatch). They are user-facing
    // visual references, not workflow tokens; translate them before the
    // provider prompt safety pass instead of blocking the whole plan.
    .replace(/\bVI\b/gi, "视觉识别")
    .replace(/\bLogo\b/gi, "品牌标志")
    .replace(/editorial-metaphor/gi, "纸面编辑隐喻方向")
    .replace(/friendly-handdrawn-tech/gi, "轻松手绘辅助方向")
    .replace(/semantic_auxiliary_style/gi, "语义辅助样式")
    .replace(/Style Pack/gi, "视觉样式包")
    .replace(/HTML\s*\/\s*CSS/gi, "网页排版")
    .replace(/\bUI\b/gi, "界面")
    .replace(/\bAdapter\b/gi, "兼容映射")
    .replace(/\bDNA\b/gi, "视觉规范")
    .replace(/\bP6\b/gi, "方法页")
    .replace(/headline\/body\/cta/gi, "主标题、正文和行动提示")
    .replace(/\bcta\b/gi, "行动文案")
    .replace(/\b(?:evidence|problem|method|summary|cover)\b/gi, "页面任务")
    .replace(/page[ _-]?(?:role|id)/gi, "页面内部信息")
    .replace(/\b(?:archetype|pattern)\b/gi, "构图规则");
  // Remaining Latin words can be brand-specific labels from an uploaded VI
  // file. Keep the meaning without leaking implementation identifiers into
  // the image prompt; known audience terms (AI/IP/B2B) remain verbatim.
  return safe
    .replace(/[A-Za-z][A-Za-z0-9_-]*/g, (token) => AUDIENCE_SAFE_ASCII_ALLOWLIST.has(token) ? token : "品牌元素")
    .replace(/色号占位(\d+)/g, (_, index) => protectedHex[Number(index)] || "");
}

const VI_DOCUMENT_EXAMPLE = /(?:页眉|页脚|注意事项|目录页|网格坐标|四角锚点|毫米尺寸|编号化条目|横向\s*A4|第\s*\d+\s*页|品牌视觉(?:识别|应用)系统|BRAND\s+(?:VISION|APPLICATION)|中英文双语|英文标准字|英文字体|logo|标识规范页|封面.*模板)/i;
const LEGACY_STYLE_MANDATE = /(?:必须.*纸面编辑|保持纸面编辑|固定(?:使用|采用)?.*(?:酒红|暖白|炭黑)|必须.*单一隐喻)/i;

function productionVisualConstraint(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (/^品牌识别强调色[:：]/.test(raw)) return `${audienceSafeInstruction(raw)}；仅用于少量品牌识别，不强制作为背景、主画面颜色或固定配色模板`;
  if (/^品牌色锚点[:：]/.test(raw)) {
    const description = describeXhsBrandColor(raw.match(/#[0-9a-f]{6}\b/i)?.[0]);
    return description ? `品牌识别强调色：${description}；仅用于少量品牌识别，不强制作为背景、主画面颜色或固定配色模板` : null;
  }
  // Compatibility: old prompt sets can still be opened, but a newly built
  // plan must not revive their full VI palette, typography or manual examples.
  // Historical frozen plans are handled by the read-only branch above.
  if (/^品牌色[:：]/.test(raw)) {
    const firstHex = raw.match(/#[0-9a-f]{6}\b/i)?.[0];
    const description = describeXhsBrandColor(firstHex);
    return description ? `品牌识别强调色：${description}；仅用于少量品牌识别，不强制作为背景、主画面颜色或固定配色模板` : null;
  }
  if (/^字体与文字角色[:：]/.test(raw) || VI_DOCUMENT_EXAMPLE.test(raw)) return null;
  return null;
}

function productionVisualConstraints(values) {
  return [...new Set((values || []).map(productionVisualConstraint).filter(Boolean))];
}

function compileSeriesVisualContract(promptSet) {
  const pages = promptSet.pagePromptSpecs || [];
  const allText = pages.flatMap((page) => [page.contentTruth?.headline, ...(page.contentTruth?.supportingText || [])]).filter(Boolean).join(" ");
  const stepPages = pages.filter((page) => /^第\s*[一二三四五六七八九十\d]+\s*步[：:]/.test(String(page.contentTruth?.headline || "")));
  const palette = /客户|零售|经营|管理|流程|复购|成交|业务/.test(allText)
    ? "暖白或浅米色作为共同底色，炭黑作为主文字色，朱红作为唯一强调色，自然木色仅作中性材质色"
    : /科技|人工智能|数据|系统|模型|自动化/.test(allText)
      ? "冷白或浅灰作为共同底色，深蓝黑作为主文字色，明亮蓝作为唯一强调色，金属灰仅作中性材质色"
      : /自然|健康|生活|情绪|成长/.test(allText)
        ? "柔和米白作为共同底色，深棕或深绿作为主文字色，珊瑚橙作为唯一强调色，自然绿色仅作辅助色"
        : "柔和中性浅色作为共同底色，近黑色作为主文字色，从整篇主题中选择一种强调色并在全套逐页保持相同";
  const medium = stepPages.length >= 3
    ? "连续方法页统一采用同一套编辑摄影语言：真实但克制的桌面或空间场景、可触摸的物件隐喻、相同质感与相同光线方向；不得某页改成手写海报、另一页改成信息图或完全不同的插画体系"
    : "整套先选择一种与主题匹配的主要视觉媒介，封面、正文与总结页都沿用同一材质、光线与图形语言；页面主体可变化，但不得逐页更换视觉体系";
  const stepTypography = stepPages.length >= 3
    ? "所有步骤页面使用完全相同的标题系统：步骤序号统一使用强调色、相同粗黑字体气质、字号与左上位置；步骤名称统一使用近黑色粗体、相同行距、字宽和起始基线；禁止任何步骤页改用书法、手写、衬线或另一种标题颜色"
    : "同级页面的标题使用相同字体气质、颜色角色、字号层级、对齐方式和起始位置；不得逐页自行改变标题系统";
  return [
    `本内容包系列配色：${palette}。这是本组动态选定的配色，不是跨项目固定模板；本组生成期间不得换色。`,
    `本内容包系列媒介：${medium}`,
    `本内容包系列标题：${stepTypography}`,
    "正文页共享相同画布边距、顶部标题安全区、正文项目符号、圆角与阴影强度；重复组件的形状、尺寸和位置保持一致。",
    "封面可以建立更强主视觉，总结页可以改变信息结构，但必须继承本组配色、字体气质、材质和光线；正文连续页的变化仅限于解释本页内容的主体物和场景。"
  ];
}

export function assertAudienceSafeProviderPrompt(prompt, allowedAsciiTokens = []) {
  const allowed = new Set([...AUDIENCE_SAFE_ASCII_ALLOWLIST, ...allowedAsciiTokens].map((token) => String(token || "").trim()).filter(Boolean));
  const lowered = String(prompt || "").toLowerCase();
  const leaked = INTERNAL_RENDER_TOKENS.filter((token) => new RegExp(`(^|[^a-z])${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`, "i").test(lowered));
  if (leaked.length) throw new Error(`INTERNAL_ROLE_TOKEN_LEAK:${leaked.join("|")}`);
  if (/\bP\d+\b/i.test(prompt)) throw new Error("INTERNAL_PAGE_ID_LEAK");
  if (/#[0-9a-f]{6}\b/i.test(prompt)) throw new Error("PROVIDER_PROMPT_RAW_HEX_COLOR_LEAK");
  const asciiInspection = String(prompt || "").replace(/#[0-9a-f]{6}\b/gi, " ");
  const disallowedAscii = [...asciiInspection.matchAll(/[A-Za-z][A-Za-z0-9_-]*/g)].map((item) => item[0]).filter((token) => !allowed.has(token));
  if (disallowedAscii.length) throw new Error(`PROVIDER_PROMPT_ASCII_TOKEN_NOT_ALLOWLISTED:${[...new Set(disallowedAscii)].join("|")}`);
  return true;
}

function promptSections(pageSpec, promptSet, selectedDirection, { historicalFrozen = false } = {}) {
  // Frozen 05M/05N evidence is hash-addressed and consumed read-only. Preserve
  // its historical projection so the safety repair does not rewrite history;
  // every new invocation uses the audience-safe projection below.
  if (historicalFrozen) return {
    pageSemantics: [pageSpec.contentTruth.pageRole, pageSpec.contentTruth.headline, ...pageSpec.contentTruth.supportingText].filter(Boolean),
    visualMedium: [...pageSpec.promptBlocks.style],
    composition: [...pageSpec.promptBlocks.composition, selectedDirection.compositionModel, selectedDirection.hierarchyStrategy, selectedDirection.imageRole],
    materialSpaceLight: [`材质、空间与光影必须服从视觉媒介“${pageSpec.promptBlocks.style[0]}”和构图“${selectedDirection.compositionModel}”，不得用装饰替代页面语义。`],
    crossPageRules: [`整套固定 Style Pack：${promptSet.visualStyleSelection.stylePackId}`, `稳定配色=${promptSet.crossPageRules.stablePalette}; 稳定文字角色=${promptSet.crossPageRules.stableTypographyRoles}; 重复上限=${promptSet.crossPageRules.repetitionLimit}`],
    verbatimText: [...pageSpec.promptBlocks.verbatimText],
    negativeConstraints: [...pageSpec.promptBlocks.negativeConstraints, "禁止增加未冻结事实、英文伪文字、竞品品牌、艺术家、IP 或 1:1 复刻要求"]
  };
  const adaptiveCreative = promptSet.visualStyleSelection.stylePackId === "editorial-metaphor";
  const headline = normalizeXhsPresentationText(pageSpec.contentTruth.headline);
  const customerFacingMedium = adaptiveCreative
    ? [
        `围绕“${audienceSafeInstruction(headline)}”选择一个具体、可辨认的主要视觉主体；主体可以是场景、物件、动作、空间或抽象隐喻，但必须直接解释本页内容`,
        "先确定本页独有的创意概念，再决定摄影感、插画、三维、拼贴、图形或文字主导等媒介；不得沿用上一页的现成模板"
      ]
    : [...pageSpec.promptBlocks.style].map(audienceSafeInstruction);
  const composition = adaptiveCreative
    ? [
        `围绕“${audienceSafeInstruction(headline)}”建立单一视觉叙事和清晰阅读焦点，让文字与主要视觉主体成为同一个构图，而不是把内容塞进通用卡片`,
        "只有当逐字真值明确包含步骤、并列清单、对比或层级关系时，才允许使用对应结构；否则禁止默认使用信息卡、宫格、中心圆节点图、后台面板或通用流程图",
        "保留足够留白和明确文字层级，但版式、主体位置、材质与色彩必须由本页语义决定"
      ]
    : [...pageSpec.promptBlocks.composition, selectedDirection.compositionModel, selectedDirection.hierarchyStrategy, selectedDirection.imageRole].map(audienceSafeInstruction);
  const sourceNegativeConstraints = pageSpec.promptBlocks.negativeConstraints.filter((item) => !LEGACY_STYLE_MANDATE.test(String(item || "")));
  const seriesVisualContract = compileSeriesVisualContract(promptSet);
  return {
    // pageRole is an internal routing enum. It must influence asset selection only;
    // exposing it beside verbatim text makes image providers draw words such as
    // `evidence` or `method` onto customer-facing pages.
    pageSemantics: [pageSpec.contentTruth.headline, ...pageSpec.contentTruth.supportingText].filter(Boolean).map(normalizeXhsPresentationText).map(audienceSafeInstruction),
    visualMedium: customerFacingMedium,
    composition,
    materialSpaceLight: ["材质、空间与光影根据本页内容、情绪和创意概念选择；不继承视觉识别手册示例，也不套固定纸张、摄影、插画或信息卡模板。"],
    crossPageRules: [
      ...seriesVisualContract,
      "整套共享同一创意世界和品牌识别锚点；每页主体与局部构图可随内容变化，但不得套固定信息卡、视觉识别手册或后台界面",
      `稳定配色=${audienceSafePalette(promptSet.crossPageRules.stablePalette)}；稳定文字角色=${audienceSafeTypographyRoles(promptSet.crossPageRules.stableTypographyRoles)}；相同信息不得跨页重复`,
      ...productionVisualConstraints(promptSet.visualStyleSelection.constraints).map((item) => `已确认视觉规范：${item}`),
      "画面语言：所有可见文字必须逐字来自下方真值；除真值原本含有的拉丁字母外，只使用简体中文",
      "环境文字同样受逐字真值约束：道路、路牌、建筑、服装、屏幕、包装、图标和背景纹理不得出现真值之外的汉字、字母、单词、数字或水印；若场景通常带文字，改用无文字物件或纯视觉符号"
    ],
    verbatimText: [...pageSpec.promptBlocks.verbatimText].map(normalizeXhsPresentationText),
    negativeConstraints: [...sourceNegativeConstraints, "禁止增加未冻结事实、英文伪文字、竞品品牌、艺术家、IP 或 1:1 复刻要求", "禁止显示任何内部页型、页码、工作流标签、样式名、结构名或字段名；画面只能出现逐字真值区列出的文字", "禁止照搬视觉手册的页眉、页脚、目录、编号、尺寸标注、品牌系统标题或示例文案", "没有已授权的真实标志图片时，禁止生成任何标志、logo、水印或品牌占位文字"].map(audienceSafeInstruction)
  };
}

function renderPrompt(sections) {
  return [
    ["页面语义", sections.pageSemantics],
    ["视觉媒介", sections.visualMedium],
    ["构图与层级", sections.composition],
    ["材质空间光影", sections.materialSpaceLight],
    ["跨页统一", sections.crossPageRules],
    ["逐字真值", sections.verbatimText],
    ["负面约束", sections.negativeConstraints]
  ].map(([label, values]) => `${label}：\n${values.map((item) => `- ${item}`).join("\n")}`).join("\n\n");
}

function projectProviderRequest(profile, prompt, referenceAssets, { historicalFrozen = false, allowedAsciiTokens = [] } = {}) {
  if (!historicalFrozen) assertAudienceSafeProviderPrompt(prompt, allowedAsciiTokens);
  const input = { prompt, ...structuredClone(profile.inputDefaults) };
  const projection = REQUEST_PROJECTIONS[profile.adapter.projectionKey];
  if (projection.referenceInputField) input[projection.referenceInputField] = referenceAssets.map((item) => `$AUTHORIZED_ASSET:${item.id}:${item.hash}`);
  return {
    endpoint: profile.createEndpoint,
    method: "POST",
    body: { model: profile.model, input },
    requestFields: [...profile.requestFields]
  };
}

function validatePlanPage(page, plan) {
  exact(page, ["pageId", "contentTruthRef", "assetBindings", "legacyCompiler", "promptSections", "providerRequest", "nativeDimensionQualification", "deliveryQualification", "estimatedCost", "blockers", "pageHash"], "executionPlan.page");
  exact(page.assetBindings, ["archetype", "stylePack", "patterns", "referenceAssets"], "executionPlan.page.assetBindings");
  exact(page.legacyCompiler, ["requestRef", "traceRef", "originalBlockerCodes", "reclassifiedBlockerCodes"], "executionPlan.page.legacyCompiler");
  exact(page.providerRequest, ["endpoint", "method", "body", "requestFields"], "executionPlan.page.providerRequest");
  if (page.providerRequest.body.input.prompt !== renderPrompt(page.promptSections)) throw new Error("EXECUTION_PLAN_PROMPT_PROJECTION_MISMATCH");
  if (page.providerRequest.body.model !== plan.provider.model) throw new Error("EXECUTION_PLAN_MODEL_MISMATCH");
  if (page.nativeDimensionQualification.status === "non_exact_normalizable" && page.deliveryQualification.status !== "pending_post_normalization_gates") throw new Error("EXECUTION_PLAN_DIMENSION_STATUS_COLLAPSED");
  validateHashed(page, "pageHash", "executionPlan.page");
}

export function validateIntegratedPageExecutionPlan(value) {
  exact(value, ["schemaVersion", "contract", "id", "mode", "skillBinding", "reviewBinding", "capabilitySnapshotRef", "registrySnapshotRef", "provider", "cost", "pages", "states", "productionEligible", "execution", "inputHash", "planHash"], EXECUTION_PLAN_CONTRACT);
  if (value.schemaVersion !== "1.0" || value.contract !== EXECUTION_PLAN_CONTRACT || value.mode !== "isolated_experimental" || value.productionEligible !== false) throw new Error("EXECUTION_PLAN_BOUNDARY_INVALID");
  exact(value.execution, ["status", "networkCalls", "providerCalls", "retries", "actualCost", "databaseWrites", "featureFlag"], "executionPlan.execution");
  if (Object.entries(value.execution).some(([key, count]) => ["networkCalls", "providerCalls", "retries", "actualCost", "databaseWrites"].includes(key) && count !== 0)) throw new Error("EXECUTION_PLAN_OFFLINE_BOUNDARY");
  value.pages.forEach((page) => validatePlanPage(page, value));
  hash(value.inputHash, "executionPlan.inputHash");
  validateHashed(value, "planHash", EXECUTION_PLAN_CONTRACT);
  return true;
}

export function buildIntegratedPageExecutionPlan(input) {
  exact(input, ["skillInvocation", "reviewDecision", "capabilitySnapshot", "registrySnapshot", "libraries", "directionCandidates", "providerProfile", "compilerOptions", "costConfirmation", "flags"], "buildExecutionPlan.input");
  validateDesignSkillInvocation(input.skillInvocation);
  validatePromptReviewDecision(input.reviewDecision);
  validateProviderCapabilitySnapshot(input.capabilitySnapshot);
  validateVisualAssetRegistrySnapshot(input.registrySnapshot);
  validateProviderProfile(input.providerProfile);
  validateCostConfirmation(input.costConfirmation);
  const { promptSet } = input.skillInvocation;
  const selectedDirection = input.directionCandidates.find((item) => item.id === input.reviewDecision.visualDirectionSelection.selectedDirectionRef?.id);
  const planBlockers = [];
  if (!selectedDirection) add(planBlockers, blocker("VISUAL_DIRECTION_NOT_SELECTED", input.reviewDecision.id, "视觉方向缺失或未冻结"));
  if (input.skillInvocation.promptSetHash !== input.reviewDecision.promptSetRef.hash) add(planBlockers, blocker("PROMPT_REVIEW_INPUT_MISMATCH", input.reviewDecision.id, "Skill 输出与审阅对象不一致"));
  if (input.reviewDecision.promptReview.status !== "approved") add(planBlockers, blocker("PROMPT_REVIEW_NOT_APPROVED", input.reviewDecision.id, "Prompt 尚未审阅通过"));
  if (input.reviewDecision.visualDirectionSelection.status !== "selected") add(planBlockers, blocker("VISUAL_DIRECTION_NOT_SELECTED", input.reviewDecision.id, "视觉方向尚未选择"));
  if (input.costConfirmation.status !== "confirmed") add(planBlockers, blocker("COST_NOT_CONFIRMED", "cost", "费用尚未明确确认"));
  if (input.costConfirmation.currency !== input.providerProfile.currency) add(planBlockers, blocker("COST_CURRENCY_MISMATCH", "cost", "费用确认币种与 Provider Profile 不一致"));
  if (input.flags.xhsIntegratedPageSkillExecutionPlan !== true) add(planBlockers, blocker("FEATURE_FLAG_DISABLED", "xhsIntegratedPageSkillExecutionPlan", "隔离执行计划 Flag 默认关闭"));
  if (input.capabilitySnapshot.capabilities.integratedChineseTypography !== true) add(planBlockers, blocker("MISSING_CAPABILITY", input.capabilitySnapshot.id, "模型未证明整页中文能力"));

  const historicalFrozen = isFrozen05MInvocation(input.skillInvocation);
  const pages = promptSet.pagePromptSpecs.map((pageSpec) => {
    const localBlockers = planBlockers.map((item) => structuredClone(item));
    const invocationBinding = input.skillInvocation.assetBindings.find((item) => item.pageId === pageSpec.pageId);
    const archetype = registryBinding(input.registrySnapshot, pageSpec.pageArchetypeId, "page_archetype", pageSpec.pageId, localBlockers);
    const stylePack = registryBinding(input.registrySnapshot, pageSpec.stylePackId || promptSet.visualStyleSelection.stylePackId, "style_pack", pageSpec.pageId, localBlockers);
    const patterns = pageSpec.promptPatternIds.map((id) => registryBinding(input.registrySnapshot, id, "prompt_pattern", pageSpec.pageId, localBlockers));
    const registrySourceHash = (id) => input.registrySnapshot.entries.find((item) => item.id === id)?.sourceHash;
    if (!invocationBinding
      || invocationBinding.archetype.id !== archetype.id
      || invocationBinding.archetype.hash !== registrySourceHash(archetype.id)
      || invocationBinding.stylePack.id !== stylePack.id
      || invocationBinding.stylePack.hash !== registrySourceHash(stylePack.id)
      || invocationBinding.patterns.length !== patterns.length
      || invocationBinding.patterns.some((item, index) => item.id !== patterns[index].id || item.hash !== registrySourceHash(patterns[index].id))) {
      add(localBlockers, blocker("SKILL_REGISTRY_BINDING_MISMATCH", pageSpec.pageId, "Skill 资产定义与 Registry 快照 hash 不一致"));
    }
    const compiled = compilePageGenerationRequest({
      promptSet,
      pageId: pageSpec.pageId,
      reviewDecision: input.reviewDecision,
      capabilitySnapshot: input.capabilitySnapshot,
      registrySnapshot: input.registrySnapshot,
      libraries: input.libraries,
      directionCandidates: input.directionCandidates,
      options: input.compilerOptions
    });
    validateProviderCompilationTrace(compiled.trace, compiled.request);
    const reclassified = [];
    for (const item of compiled.request.blockers) {
      if (item.code === "UNSUPPORTED_DIMENSIONS" && canReclassifyNativeDimension(input.providerProfile, input.capabilitySnapshot)) reclassified.push(item.code);
      else add(localBlockers, item);
    }
    const referenceAssets = pageSpec.referenceAssetIds.map((id) => registryBinding(input.registrySnapshot, id, "reference_asset", pageSpec.pageId, localBlockers));
    for (const ref of referenceAssets) {
      const entry = input.registrySnapshot.entries.find((item) => item.id === ref.id);
      if (!entry || entry.authorization?.status !== "authorized_for_offline_compilation" || entry.license?.allowsGenerationReference !== true) add(localBlockers, blocker("UNAUTHORIZED_REFERENCE_ASSET", pageSpec.pageId, ref.id));
    }
    if (referenceAssets.length && !REQUEST_PROJECTIONS[input.providerProfile.adapter.projectionKey].referenceInputField) add(localBlockers, blocker("PROVIDER_REFERENCE_FIELD_NOT_EXPOSED", pageSpec.pageId, `${input.providerProfile.adapter.projectionKey} 当前冻结字段不含参考图输入`));
    const sections = promptSections(pageSpec, promptSet, selectedDirection || { compositionModel: "阻断", hierarchyStrategy: "阻断", imageRole: "阻断" }, { historicalFrozen });
    const allowedAsciiTokens = sections.verbatimText.flatMap((item) => [...String(item || "").matchAll(/[A-Za-z][A-Za-z0-9_-]*/g)].map((match) => match[0]));
    const providerRequest = projectProviderRequest(input.providerProfile, renderPrompt(sections), referenceAssets, { historicalFrozen, allowedAsciiTokens });
    const pageBase = {
      pageId: pageSpec.pageId,
      contentTruthRef: { id: `${promptSet.id}:${pageSpec.pageId}:truth`, hash: stableHash(pageSpec.contentTruth) },
      assetBindings: { archetype, stylePack, patterns, referenceAssets },
      legacyCompiler: {
        requestRef: { id: compiled.request.id, hash: compiled.request.compiledHash },
        traceRef: { id: compiled.trace.id, hash: compiled.trace.traceHash },
        originalBlockerCodes: compiled.request.blockers.map((item) => item.code),
        reclassifiedBlockerCodes: reclassified
      },
      promptSections: sections,
      providerRequest,
      nativeDimensionQualification: {
        dimensions: structuredClone(input.providerProfile.nativeOutputDimensions),
        status: input.providerProfile.nativeOutputDimensions.width === 1080 && input.providerProfile.nativeOutputDimensions.height === 1440 ? "exact" : reclassified.length ? "non_exact_normalizable" : "blocked"
      },
      deliveryQualification: {
        target: { width: 1080, height: 1440 },
        status: reclassified.length ? "pending_post_normalization_gates" : "pending_provider_result",
        normalizationMode: input.providerProfile.normalization.mode
      },
      estimatedCost: input.providerProfile.estimatedCostPerCandidate * input.compilerOptions.candidateCount,
      blockers: localBlockers
    };
    return { ...pageBase, pageHash: stableHash(pageBase) };
  });
  const estimatedTotal = pages.reduce((sum, page) => sum + page.estimatedCost, 0);
  if (input.costConfirmation.status === "confirmed" && estimatedTotal > input.costConfirmation.approvedMaxTotal) {
    for (const page of pages) {
      const base = structuredClone(page);
      delete base.pageHash;
      add(base.blockers, blocker("COST_BUDGET_EXCEEDED", "cost", `${estimatedTotal} > ${input.costConfirmation.approvedMaxTotal}`));
      Object.assign(page, base, { pageHash: stableHash(base) });
    }
  }
  const inputHash = stableHash({
    invocationHash: input.skillInvocation.invocationHash,
    reviewDecisionHash: input.reviewDecision.decisionHash,
    capabilitySnapshotHash: input.capabilitySnapshot.snapshotHash,
    registrySnapshotHash: input.registrySnapshot.snapshotHash,
    providerProfile: input.providerProfile,
    compilerOptions: input.compilerOptions,
    costConfirmationHash: input.costConfirmation.confirmationHash,
    featureFlag: input.flags.xhsIntegratedPageSkillExecutionPlan === true
  });
  const allBlockers = pages.flatMap((page) => page.blockers);
  const base = {
    schemaVersion: "1.0",
    contract: EXECUTION_PLAN_CONTRACT,
    id: `integrated-page-plan:${inputHash.slice(0, 16)}`,
    mode: "isolated_experimental",
    skillBinding: {
      name: input.skillInvocation.skill.name,
      version: input.skillInvocation.skill.version,
      definitionHash: input.skillInvocation.skill.definitionHash,
      invocationHash: input.skillInvocation.invocationHash,
      promptSetRef: { id: promptSet.id, hash: input.skillInvocation.promptSetHash },
      libraryRefs: structuredClone(input.skillInvocation.libraryRefs)
    },
    reviewBinding: { id: input.reviewDecision.id, hash: input.reviewDecision.decisionHash },
    capabilitySnapshotRef: { id: input.capabilitySnapshot.id, hash: input.capabilitySnapshot.snapshotHash },
    registrySnapshotRef: { id: input.registrySnapshot.id, hash: input.registrySnapshot.snapshotHash },
    provider: { id: input.providerProfile.provider, model: input.providerProfile.model, adapter: structuredClone(input.providerProfile.adapter), lifecycle: input.providerProfile.lifecycle, createEndpoint: input.providerProfile.createEndpoint, requestFields: [...input.providerProfile.requestFields] },
    cost: { status: input.costConfirmation.status, confirmationHash: input.costConfirmation.confirmationHash, currency: input.providerProfile.currency, estimatedTotal, approvedMaxTotal: input.costConfirmation.approvedMaxTotal },
    pages,
    states: {
      visualDirection: input.reviewDecision.visualDirectionSelection.status,
      promptReview: input.reviewDecision.promptReview.status,
      costConfirmation: input.costConfirmation.status,
      provider: "not_called",
      ocr: "not_run",
      fact: "not_run",
      visual: "not_run",
      userSelection: "not_selected",
      delivery: "not_delivered"
    },
    productionEligible: false,
    execution: {
      status: allBlockers.length ? "blocked" : "ready_for_isolated_provider_execution",
      networkCalls: 0,
      providerCalls: 0,
      retries: 0,
      actualCost: 0,
      databaseWrites: 0,
      featureFlag: "xhsIntegratedPageSkillExecutionPlan"
    },
    inputHash
  };
  const plan = { ...base, planHash: stableHash(base) };
  validateIntegratedPageExecutionPlan(plan);
  return plan;
}

export function materializeProviderExecutionRequest(input) {
  exact(input, ["plan", "pageId", "expectedPlanHash", "skillInvocation"], "materializeProviderExecutionRequest.input");
  validateIntegratedPageExecutionPlan(input.plan);
  validateDesignSkillInvocation(input.skillInvocation);
  if (input.plan.planHash !== input.expectedPlanHash) throw new Error("EXECUTION_PLAN_HASH_MISMATCH");
  if (input.plan.skillBinding.invocationHash !== input.skillInvocation.invocationHash || input.plan.skillBinding.promptSetRef.hash !== input.skillInvocation.promptSetHash) throw new Error("SKILL_INVOCATION_HASH_MISMATCH");
  if (input.plan.execution.status !== "ready_for_isolated_provider_execution") throw new Error("EXECUTION_PLAN_NOT_READY");
  const page = input.plan.pages.find((item) => item.pageId === input.pageId);
  if (!page || page.blockers.length) throw new Error("EXECUTION_PLAN_PAGE_BLOCKED");
  return structuredClone(page.providerRequest);
}

export function createCostConfirmation(input) {
  exact(input, ["status", "currency", "approvedMaxTotal", "confirmedBy", "confirmedAt"], "createCostConfirmation.input");
  const value = structuredClone(input);
  const result = { ...value, confirmationHash: stableHash(value) };
  validateCostConfirmation(result);
  return result;
}

export function decideIntegratedPageEligibility({ plan, pageId, evidence = null }) {
  validateIntegratedPageExecutionPlan(plan);
  const page = plan.pages.find((item) => item.pageId === pageId);
  if (!page) throw new Error(`EXECUTION_PLAN_PAGE_NOT_FOUND:${pageId}`);
  const blockers = page.blockers.map((item) => structuredClone(item));
  const native = evidence?.nativeDimensions || null;
  const nativeStatus = native ? (native.width === 1080 && native.height === 1440 ? "passed" : "failed") : "pending";
  let normalizationStatus = evidence?.normalization?.status || "not_run";
  let finalDeliveryDimensionStatus = "pending";
  if (evidence?.normalization) {
    const n = evidence.normalization;
    if (n.nonUniformStretch === true) add(blockers, blocker("NON_UNIFORM_STRETCH", pageId, "禁止非等比拉伸"));
    if (n.protectedRegionCrop === true) add(blockers, blocker("PROTECTED_REGION_CROP", pageId, "裁切穿过受保护区域"));
    finalDeliveryDimensionStatus = n.status === "succeeded" && n.outputDimensions?.width === 1080 && n.outputDimensions?.height === 1440 && !n.nonUniformStretch && !n.protectedRegionCrop ? "passed" : "blocked";
    if (finalDeliveryDimensionStatus === "blocked") add(blockers, blocker("FINAL_DELIVERY_DIMENSION_BLOCKED", pageId, "最终画布未安全达到 1080x1440"));
  }
  const gates = {
    ocr: evidence?.gates?.ocr || "not_run",
    fact: evidence?.gates?.fact || "not_run",
    visual: evidence?.gates?.visual || "not_run"
  };
  for (const [name, status] of Object.entries(gates)) if (status === "failed") add(blockers, blocker(`${name.toUpperCase()}_GATE_FAILED`, pageId, `${name} Gate 未通过`));
  const providerStatus = evidence?.providerStatus || "not_called";
  const candidateReady = providerStatus === "succeeded" && normalizationStatus === "succeeded" && finalDeliveryDimensionStatus === "passed" && Object.values(gates).every((status) => status === "passed") && blockers.length === 0;
  const base = {
    schemaVersion: "1.0",
    contract: ELIGIBILITY_CONTRACT,
    id: `eligibility:${pageId}:${stableHash({ plan: plan.planHash, evidence }).slice(0, 16)}`,
    planRef: { id: plan.id, hash: plan.planHash },
    pageId,
    providerStatus,
    providerNativeDimensions: native,
    providerNativeDimensionStatus: nativeStatus,
    normalizationStatus,
    finalDeliveryDimensionStatus,
    gates,
    userSelectionStatus: "not_selected",
    deliveryStatus: "not_delivered",
    eligibleStage: candidateReady ? "candidate_selection" : plan.execution.status === "ready_for_isolated_provider_execution" && !evidence ? "provider_execution" : "blocked",
    productionEligible: false,
    blockers
  };
  const decision = { ...base, decisionHash: stableHash(base) };
  validateIntegratedPageEligibilityDecision(decision);
  return decision;
}

export function validateIntegratedPageEligibilityDecision(value) {
  exact(value, ["schemaVersion", "contract", "id", "planRef", "pageId", "providerStatus", "providerNativeDimensions", "providerNativeDimensionStatus", "normalizationStatus", "finalDeliveryDimensionStatus", "gates", "userSelectionStatus", "deliveryStatus", "eligibleStage", "productionEligible", "blockers", "decisionHash"], ELIGIBILITY_CONTRACT);
  if (value.schemaVersion !== "1.0" || value.contract !== ELIGIBILITY_CONTRACT || value.productionEligible !== false) throw new Error("ELIGIBILITY_BOUNDARY_INVALID");
  exact(value.planRef, ["id", "hash"], "eligibility.planRef");
  hash(value.planRef.hash, "eligibility.planRef.hash");
  if (!value.pageId || !["not_called", "succeeded", "failed"].includes(value.providerStatus)) throw new Error("ELIGIBILITY_PROVIDER_STATUS_INVALID");
  if (!["pending", "passed", "failed"].includes(value.providerNativeDimensionStatus)) throw new Error("ELIGIBILITY_NATIVE_DIMENSION_STATUS_INVALID");
  if (!["not_run", "succeeded", "blocked"].includes(value.normalizationStatus)) throw new Error("ELIGIBILITY_NORMALIZATION_STATUS_INVALID");
  if (!["pending", "passed", "blocked"].includes(value.finalDeliveryDimensionStatus)) throw new Error("ELIGIBILITY_FINAL_DIMENSION_STATUS_INVALID");
  exact(value.gates, ["ocr", "fact", "visual"], "eligibility.gates");
  if (Object.values(value.gates).some((status) => !["not_run", "passed", "failed", "review_required"].includes(status))) throw new Error("ELIGIBILITY_GATE_STATUS_INVALID");
  if (!['provider_execution', 'candidate_selection', 'blocked'].includes(value.eligibleStage) || value.userSelectionStatus !== "not_selected" || value.deliveryStatus !== "not_delivered") throw new Error("ELIGIBILITY_STAGE_INVALID");
  if (!Array.isArray(value.blockers) || value.blockers.some((item) => item.fallback !== "deterministic_layout")) throw new Error("ELIGIBILITY_BLOCKERS_INVALID");
  validateHashed(value, "decisionHash", ELIGIBILITY_CONTRACT);
  if (value.eligibleStage === "candidate_selection" && (value.finalDeliveryDimensionStatus !== "passed" || Object.values(value.gates).some((status) => status !== "passed") || value.blockers.length)) throw new Error("ELIGIBILITY_GATE_BYPASS");
  return true;
}
