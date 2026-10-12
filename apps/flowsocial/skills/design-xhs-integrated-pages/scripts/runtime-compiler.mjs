import { stableHash } from "../../../image-providers/xhs-integrated-page/canonical.mjs";

const RUNTIME_INPUT = "DesignXhsIntegratedPagesRuntimeInput@1.0";
const blocker = (code, detail, pageId = null) => ({ code, pageId, detail, fallback: "deterministic_layout" });

function exact(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label}:OBJECT_REQUIRED`);
  const actual = Object.keys(value).sort();
  if (JSON.stringify(actual) !== JSON.stringify([...keys].sort())) throw new Error(`${label}:FIELDS:${actual.join(",")}`);
}

function unique(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()))];
}

export function normalizeXhsPresentationText(value) {
  const raw = String(value || "").trim();
  const method = raw.match(/^METHOD\s*(\d+)\s*\/\s*(\d+)\s*[·:：\-]\s*(.+)$/i);
  if (method) return `第${method[1]}步 · ${method[3].trim()}`;
  const marker = raw.match(/^(?:HOOK|JUDGE|ACTION)\s*[·:：\-]\s*(.+)$/i);
  return marker ? marker[1].trim() : raw;
}

export function describeXhsBrandColor(value) {
  const match = String(value || "").trim().match(/^#?([0-9a-f]{6})$/i);
  if (!match) return null;
  const number = Number.parseInt(match[1], 16);
  const red = (number >> 16) & 255;
  const green = (number >> 8) & 255;
  const blue = number & 255;
  const max = Math.max(red, green, blue) / 255;
  const min = Math.min(red, green, blue) / 255;
  const lightness = (max + min) / 2;
  const delta = max - min;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  let hue = 0;
  if (delta !== 0) {
    if (max === red / 255) hue = 60 * (((green - blue) / 255 / delta) % 6);
    else if (max === green / 255) hue = 60 * (((blue - red) / 255 / delta) + 2);
    else hue = 60 * (((red - green) / 255 / delta) + 4);
  }
  if (hue < 0) hue += 360;
  const family = saturation < 0.12
    ? (lightness > 0.82 ? "柔和白色" : lightness < 0.2 ? "深墨色" : "中性灰色")
    : hue < 15 || hue >= 345 ? "暖红色"
      : hue < 45 ? "橙红色"
        : hue < 70 ? "金黄色"
          : hue < 165 ? "绿色"
            : hue < 205 ? "青色"
              : hue < 255 ? "蓝色"
                : hue < 290 ? "蓝紫色"
                  : hue < 345 ? "紫红色"
                    : "暖红色";
  const intensity = saturation > 0.72 ? "高饱和" : saturation < 0.28 ? "低饱和" : "适中饱和";
  const brightness = lightness < 0.28 ? "深" : lightness > 0.72 ? "浅" : "";
  return `${intensity}${brightness}${family}`;
}

function itemTexts(value) {
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (!value || typeof value !== "object") return [];
  const direct = [value.text, value.content, value.value, value.title, value.body].filter((item) => typeof item === "string" && item.trim());
  const nested = Array.isArray(value.items) ? value.items.flatMap(itemTexts) : [];
  return unique([...direct, ...nested]);
}

function layerTexts(layer) {
  return unique([...(typeof layer?.text === "string" ? [layer.text] : []), ...(Array.isArray(layer?.items) ? layer.items.flatMap(itemTexts) : [])].map(normalizeXhsPresentationText));
}

export function truthText(truth) {
  return unique([truth.headline, ...truth.supportingText, ...truth.labels, truth.cta]);
}

export function validateRuntimeInput(value) {
  exact(value, ["schemaVersion", "contract", "id", "xhsPostPackage", "contentVersion", "designDna", "authorizedAssets", "providerCapability", "pageDensity", "visualSelection"], RUNTIME_INPUT);
  if (value.schemaVersion !== "1.0" || value.contract !== RUNTIME_INPUT || typeof value.id !== "string" || !value.id) throw new Error("RUNTIME_INPUT_IDENTITY_INVALID");
  if (!Number.isInteger(value.contentVersion) || value.contentVersion < 1) throw new Error("RUNTIME_INPUT_CONTENT_VERSION_INVALID");
  exact(value.designDna, ["snapshotId", "palette", "typographyRoles", "constraints"], "runtimeInput.designDna");
  if (!value.designDna.snapshotId || !Array.isArray(value.designDna.palette) || !Array.isArray(value.designDna.typographyRoles) || !Array.isArray(value.designDna.constraints)) throw new Error("RUNTIME_INPUT_DESIGN_DNA_INVALID");
  if (!Array.isArray(value.authorizedAssets) || !value.providerCapability || typeof value.providerCapability !== "object") throw new Error("RUNTIME_INPUT_CAPABILITY_OR_ASSETS_INVALID");
  exact(value.visualSelection, ["stylePackId", "reason", "pages"], "runtimeInput.visualSelection");
  if (!value.visualSelection.stylePackId || !value.visualSelection.reason || !Array.isArray(value.visualSelection.pages)) throw new Error("RUNTIME_INPUT_VISUAL_SELECTION_INVALID");
  const selectedPageIds = new Set();
  for (const page of value.visualSelection.pages) {
    exact(page, ["pageId", "archetypeId", "patternIds", "referenceAssetIds", "verbatimTextOverride", "stylePackId"], "runtimeInput.visualSelection.page");
    if (!page.pageId || !page.archetypeId || !Array.isArray(page.patternIds) || !Array.isArray(page.referenceAssetIds)) throw new Error("RUNTIME_INPUT_PAGE_SELECTION_INVALID");
    if (selectedPageIds.has(page.pageId)) throw new Error(`VISUAL_SELECTION_PAGE_ID_DUPLICATE:${page.pageId}`);
    selectedPageIds.add(page.pageId);
  }
  if (!value.pageDensity || typeof value.pageDensity !== "object" || Array.isArray(value.pageDensity)) throw new Error("RUNTIME_INPUT_PAGE_DENSITY_INVALID");
  return true;
}

export function projectXhsPostPackage(packageValue, contentVersion) {
  const pages = packageValue?.data?.deck?.pages;
  if (packageValue?.status !== "success" || packageValue?.data?.platform !== "xiaohongshu") throw new Error("INPUT_TRUTH_INCOMPLETE:package status or platform");
  if (!Array.isArray(pages) || pages.length < 2) throw new Error("INPUT_TRUTH_INCOMPLETE:data.deck.pages requires multiple pages");
  const pageNumbers = new Set();
  return pages.map((page) => {
    if (!Number.isInteger(page.page) || !page.role || !Array.isArray(page.text_layers) || page.text_layers.length === 0) throw new Error("INPUT_TRUTH_INCOMPLETE:page identity or text_layers");
    if (pageNumbers.has(page.page)) throw new Error(`PACKAGE_PAGE_ID_DUPLICATE:P${page.page}:PAGE_NUMBER:${page.page}`);
    pageNumbers.add(page.page);
    for (const layer of page.text_layers) if (layerTexts(layer).length === 0) throw new Error(`INPUT_TRUTH_INCOMPLETE:P${page.page}:text_or_items`);
    const headlineLayers = page.text_layers.filter((layer) => layer.type === "headline");
    const headline = unique(headlineLayers.flatMap(layerTexts)).join("\n");
    if (page.role === "cover" && !headline) throw new Error(`INPUT_TRUTH_INCOMPLETE:P${page.page}:headline`);
    const ctaLayerText = unique(page.text_layers.filter((layer) => layer.type === "cta").flatMap(layerTexts));
    const frozenCta = packageValue.data.post_copy?.cta || null;
    if (page.role === "cta" && frozenCta && ctaLayerText.some((text) => text !== frozenCta)) throw new Error(`CTA_TEXT_MISMATCH:P${page.page}`);
    const cta = page.role === "cta" ? frozenCta || ctaLayerText[0] || null : null;
    const labels = unique(page.text_layers.filter((layer) => layer.type === "label").flatMap(layerTexts));
    const supportingText = unique(page.text_layers
      .filter((layer) => !["headline", "label", "cta"].includes(layer.type))
      .flatMap(layerTexts))
      .filter((text) => text !== cta && text !== headline);
    const allText = truthText({ headline, supportingText, labels, cta }).join(" ");
    const protectedTerms = allText.match(/(?:[A-Za-z][A-Za-z0-9.@+-]*|\d+(?:\.\d+)?%?|[\u4e00-\u9fff]{2,}(?:系统|平台|产品|服务|智能体))/g) || [];
    return {
      schemaVersion: "1.0",
      pageId: `P${page.page}`,
      contentVersion,
      pageRole: page.role,
      headline,
      supportingText,
      labels,
      cta,
      factIds: [...(page.fact_ids || [])],
      interpretationIds: [...(page.interpretation_ids || [])],
      protectedTerms: unique(protectedTerms),
      forbiddenClaims: [...(page.must_avoid || [])]
    };
  });
}

function assetEligibility(asset) {
  if (!asset || asset.status !== "approved") return blocker("UNAUTHORIZED_REFERENCE_ASSET", "资产未授权或未批准");
  if (!asset.license?.id || asset.license.allowsGenerationReference !== true) return blocker("SOURCE_LICENSE_INELIGIBLE", "许可证未明确允许生成参考");
  return null;
}

export function validatePagePromptSpec(value, { strictExpectedTextHash = false } = {}) {
  const legacyFields = ["schemaVersion", "id", "pageId", "contentTruth", "pageArchetypeId", "visualStyleSelectionRef", "promptPatternIds", "promptBlocks", "referenceAssetIds", "expectedTextHash", "fallback"];
  const auxiliaryFields = [...legacyFields, "stylePackId", "semanticAuxiliaryStyle"];
  const fields = Object.keys(value || {}).sort();
  const legacy = JSON.stringify(fields) === JSON.stringify(legacyFields.sort());
  const auxiliary = JSON.stringify(fields) === JSON.stringify(auxiliaryFields.sort());
  if (!legacy && !auxiliary) throw new Error(`PagePromptSpec:FIELDS:${fields.join(",")}`);
  exact(value.promptBlocks, ["verbatimText", "composition", "style", "negativeConstraints"], "PagePromptSpec.promptBlocks");
  if ((legacy && value.schemaVersion !== "1.0") || (auxiliary && value.schemaVersion !== "1.1") || value.pageId !== value.contentTruth?.pageId) throw new Error("PAGE_PROMPT_SPEC_IDENTITY_INVALID");
  if (auxiliary) {
    exact(value.semanticAuxiliaryStyle, ["adapter", "primaryStylePackId", "auxiliaryStylePackId", "requiredPageRole", "designDnaPreserved", "antiTemplateConstraintsPreserved"], "PagePromptSpec.semanticAuxiliaryStyle");
    if (value.semanticAuxiliaryStyle.adapter !== "semantic_auxiliary_style@1.0" || value.semanticAuxiliaryStyle.primaryStylePackId !== "editorial-metaphor" || value.semanticAuxiliaryStyle.auxiliaryStylePackId !== value.stylePackId || value.semanticAuxiliaryStyle.requiredPageRole !== "method" || value.semanticAuxiliaryStyle.designDnaPreserved !== true || value.semanticAuxiliaryStyle.antiTemplateConstraintsPreserved !== true || value.pageId !== "P6" || value.contentTruth.pageRole !== "method" || value.stylePackId !== "friendly-handdrawn-tech") throw new Error("PAGE_PROMPT_SPEC_AUXILIARY_ADAPTER_INVALID");
  }
  if (JSON.stringify(value.promptBlocks.verbatimText) !== JSON.stringify(truthText(value.contentTruth))) throw new Error("PAGE_PROMPT_SPEC_VERBATIM_TEXT_MISMATCH");
  if (!/^[a-f0-9]{64}$/.test(value.expectedTextHash || "")) throw new Error("PAGE_PROMPT_SPEC_EXPECTED_TEXT_HASH_INVALID");
  if (strictExpectedTextHash && value.expectedTextHash !== stableHash(value.promptBlocks.verbatimText)) throw new Error("PAGE_PROMPT_SPEC_EXPECTED_TEXT_HASH_MISMATCH");
  return true;
}

// Compatibility adapter for the 05N semantic method page. It is deliberately
// narrow: it permits a single auxiliary medium while retaining the primary
// editorial direction, Design DNA, typography roles, and all anti-template
// constraints. It is not a general per-page style-routing escape hatch.
function isSemanticAuxiliaryStyle({ selectedStyle, choice, truth, styleMap }) {
  const auxiliary = styleMap.get(choice?.stylePackId);
  return selectedStyle.id === "editorial-metaphor" && auxiliary?.id === "friendly-handdrawn-tech" && truth.pageId === "P6" && truth.pageRole === "method";
}

function resolvePageStyle({ selectedStyle, choice, truth, styleMap }) {
  if (!choice.stylePackId || choice.stylePackId === selectedStyle.id) return selectedStyle;
  const auxiliary = styleMap.get(choice.stylePackId);
  if (isSemanticAuxiliaryStyle({ selectedStyle, choice, truth, styleMap })) return auxiliary;
  return selectedStyle;
}

export function validateVisualStyleSelection(value) {
  exact(value, ["schemaVersion", "id", "stylePackId", "stylePackVersion", "source", "status", "designDnaSnapshotId", "selectionReason", "appliesToPageIds", "constraints", "fallbackStylePackId", "visualSelectionGate", "productionEligible"], "VisualStyleSelection");
  if (value.schemaVersion !== "1.0" || value.status !== "experimental" || value.productionEligible !== false || value.visualSelectionGate?.status !== "pending_user_review") throw new Error("VISUAL_STYLE_SELECTION_BOUNDARY_INVALID");
  return true;
}

export function validatePromptSetSchema(value, { strictExpectedTextHash = false } = {}) {
  exact(value, ["schemaVersion", "contract", "id", "status", "sourcePackage", "visualStyleSelection", "pagePromptSpecs", "crossPageRules", "visualSelectionGate", "productionEligible", "blockers", "trace"], "XhsIntegratedPagePromptSet");
  if (value.schemaVersion !== "1.0" || value.contract !== "XhsIntegratedPagePromptSet@1.0" || !["draft", "blocked"].includes(value.status)) throw new Error("PROMPT_SET_IDENTITY_INVALID");
  validateVisualStyleSelection(value.visualStyleSelection);
  value.pagePromptSpecs.forEach((page) => validatePagePromptSpec(page, { strictExpectedTextHash }));
  if (value.status !== (value.blockers.length ? "blocked" : "draft") || value.productionEligible !== false || value.visualSelectionGate?.status !== "pending_user_review") throw new Error("PROMPT_SET_STATUS_INVALID");
  if (value.trace.networkCalls !== 0 || value.trace.providerCalls !== 0 || value.trace.databaseWrites !== 0) throw new Error("PROMPT_SET_OFFLINE_BOUNDARY");
  return true;
}

export function compileRuntimeInput(runtimeInput, libraries) {
  validateRuntimeInput(runtimeInput);
  const inputBefore = JSON.stringify(runtimeInput.xhsPostPackage);
  const truths = projectXhsPostPackage(runtimeInput.xhsPostPackage, runtimeInput.contentVersion);
  if (JSON.stringify(runtimeInput.xhsPostPackage) !== inputBefore) throw new Error("RUNTIME_INPUT_MUTATED");
  const archetypeMap = new Map(libraries.archetypes.entries.map((item) => [item.id, item]));
  const styleMap = new Map(libraries.styles.entries.map((item) => [item.id, item]));
  const patternMap = new Map(libraries.patterns.entries.map((item) => [item.id, item]));
  const selectedStyle = styleMap.get(runtimeInput.visualSelection.stylePackId);
  if (!selectedStyle) throw new Error(`STYLE_PACK_NOT_FOUND:${runtimeInput.visualSelection.stylePackId}`);
  const truthIds = new Set(truths.map((truth) => truth.pageId));
  for (const choice of runtimeInput.visualSelection.pages) if (!truthIds.has(choice.pageId)) throw new Error(`VISUAL_SELECTION_PAGE_UNKNOWN:${choice.pageId}`);
  const choiceIds = new Set(runtimeInput.visualSelection.pages.map((choice) => choice.pageId));
  for (const truth of truths) if (!choiceIds.has(truth.pageId)) throw new Error(`VISUAL_SELECTION_PAGE_MISSING:${truth.pageId}`);
  const blockers = [];
  for (const truth of truths) {
    const density = runtimeInput.pageDensity[truth.pageId];
    if (!density) throw new Error(`PAGE_DENSITY_MISSING:${truth.pageId}`);
    const choice = runtimeInput.visualSelection.pages.find((item) => item.pageId === truth.pageId);
    const pageStyle = resolvePageStyle({ selectedStyle, choice, truth, styleMap });
    if (Array.isArray(pageStyle.applicability?.pageRoles) && !pageStyle.applicability.pageRoles.includes(truth.pageRole)) throw new Error(`STYLE_PACK_PAGE_ROLE_UNSUPPORTED:${truth.pageId}:${pageStyle.id}:${truth.pageRole}`);
    if (Array.isArray(pageStyle.applicability?.density) && !pageStyle.applicability.density.includes(density)) throw new Error(`STYLE_PACK_DENSITY_UNSUPPORTED:${truth.pageId}:${pageStyle.id}:${density}`);
  }
  const pagePromptSpecs = truths.map((truth) => {
    const choice = runtimeInput.visualSelection.pages.find((item) => item.pageId === truth.pageId);
    if (!choice) throw new Error(`PAGE_SELECTION_MISSING:${truth.pageId}`);
    const archetype = archetypeMap.get(choice.archetypeId);
    if (!archetype) throw new Error(`ARCHETYPE_NOT_FOUND:${choice.archetypeId}`);
    const density = runtimeInput.pageDensity[truth.pageId];
    const pageStyle = resolvePageStyle({ selectedStyle, choice, truth, styleMap });
    if (Array.isArray(archetype.applicability?.pageRoles) && !archetype.applicability.pageRoles.includes(truth.pageRole)) throw new Error(`ARCHETYPE_PAGE_ROLE_UNSUPPORTED:${truth.pageId}:${archetype.id}:${truth.pageRole}`);
    if (Array.isArray(archetype.applicability?.density) && !archetype.applicability.density.includes(density)) throw new Error(`ARCHETYPE_DENSITY_UNSUPPORTED:${truth.pageId}:${archetype.id}:${density}`);
    const patterns = choice.patternIds.map((id) => patternMap.get(id));
    if (patterns.some((item) => !item)) throw new Error(`PATTERN_NOT_FOUND:${truth.pageId}`);
    for (const pattern of patterns) if (Array.isArray(pattern.applicability?.archetypes) && !pattern.applicability.archetypes.includes(archetype.id)) throw new Error(`PROMPT_PATTERN_ARCHETYPE_UNSUPPORTED:${truth.pageId}:${pattern.id}:${archetype.id}`);
    const expectedText = truthText(truth);
    if (choice.verbatimTextOverride && JSON.stringify(unique(choice.verbatimTextOverride)) !== JSON.stringify(expectedText)) blockers.push(blocker("FACT_TEXT_MISMATCH", "选择请求试图改写冻结真值", truth.pageId));
    for (const assetId of choice.referenceAssetIds) {
      const issue = assetEligibility(runtimeInput.authorizedAssets.find((item) => item.assetId === assetId));
      if (issue) blockers.push({ ...issue, pageId: truth.pageId });
    }
    if (runtimeInput.pageDensity[truth.pageId] === "high" && runtimeInput.providerCapability.exactDimensions !== true) blockers.push(blocker("DETERMINISTIC_FALLBACK_REQUIRED", "高密度页面缺少精确尺寸能力", truth.pageId));
    if (runtimeInput.providerCapability.integratedChineseTypography !== true) blockers.push(blocker("DETERMINISTIC_FALLBACK_REQUIRED", "Provider 未证明整页中文能力", truth.pageId));
    if (choice.stylePackId && choice.stylePackId !== runtimeInput.visualSelection.stylePackId && !isSemanticAuxiliaryStyle({ selectedStyle, choice, truth, styleMap })) blockers.push(blocker("CROSS_PAGE_STYLE_DRIFT", "页面覆盖了整套 Style Pack", truth.pageId));
    return {
      schemaVersion: "1.0",
      id: `page-prompt:${runtimeInput.id}:${truth.pageId}:v1`,
      pageId: truth.pageId,
      contentTruth: truth,
      pageArchetypeId: archetype.id,
      ...(pageStyle.id !== selectedStyle.id ? {
        schemaVersion: "1.1",
        stylePackId: pageStyle.id,
        semanticAuxiliaryStyle: {
          adapter: "semantic_auxiliary_style@1.0",
          primaryStylePackId: selectedStyle.id,
          auxiliaryStylePackId: pageStyle.id,
          requiredPageRole: "method",
          designDnaPreserved: true,
          antiTemplateConstraintsPreserved: true
        }
      } : {}),
      visualStyleSelectionRef: pageStyle.id !== selectedStyle.id ? `style-selection:${runtimeInput.id}:${pageStyle.id}:v1` : `style-selection:${runtimeInput.id}:v1`,
      promptPatternIds: patterns.map((item) => item.id),
      promptBlocks: {
        verbatimText: expectedText,
        composition: [archetype.layoutRules.join("；"), ...patterns.map((item) => item.instruction)],
        style: [(pageStyle || selectedStyle).tokens.medium, (pageStyle || selectedStyle).tokens.composition],
        negativeConstraints: [...truth.forbiddenClaims, ...(pageStyle || selectedStyle).tokens.avoid]
      },
      referenceAssetIds: [...choice.referenceAssetIds],
      expectedTextHash: stableHash(expectedText),
      fallback: { mode: "none", reasons: [] }
    };
  });
  for (const spec of pagePromptSpecs) {
    const reasons = unique(blockers.filter((item) => item.pageId === null || item.pageId === spec.pageId).map((item) => item.code));
    spec.fallback = { mode: reasons.length ? "deterministic_layout" : "none", reasons };
  }
  const gate = { status: "pending_user_review", selectedBy: null, selectedAt: null };
  const result = {
    schemaVersion: "1.0",
    contract: "XhsIntegratedPagePromptSet@1.0",
    id: `prompt-set:${runtimeInput.id}:v1`,
    status: blockers.length ? "blocked" : "draft",
    sourcePackage: { contract: "XhsPostPackage@2.0", contentVersion: runtimeInput.contentVersion, readOnly: true },
    visualStyleSelection: {
      schemaVersion: "1.0",
      id: `style-selection:${runtimeInput.id}:v1`,
      stylePackId: selectedStyle.id,
      stylePackVersion: selectedStyle.schemaVersion,
      source: selectedStyle.source,
      status: selectedStyle.status,
      designDnaSnapshotId: runtimeInput.designDna.snapshotId,
      selectionReason: runtimeInput.visualSelection.reason,
      appliesToPageIds: truths.map((item) => item.pageId),
      // Uploaded VI material is an identity reference, not a page template.
      // Only its first valid colour becomes a lightweight brand anchor; font,
      // layout, material and manual examples stay outside image prompting.
      constraints: describeXhsBrandColor(runtimeInput.designDna.palette.find((item) => /^#[0-9a-f]{6}$/i.test(String(item || "").trim())))
        ? [`品牌识别强调色：${describeXhsBrandColor(runtimeInput.designDna.palette.find((item) => /^#[0-9a-f]{6}$/i.test(String(item || "").trim())))}`]
        : [],
      fallbackStylePackId: "structured-infographic",
      visualSelectionGate: gate,
      productionEligible: false
    },
    pagePromptSpecs,
    crossPageRules: { singleStylePack: true, stablePalette: true, stableTypographyRoles: true, repetitionLimit: 2 },
    visualSelectionGate: gate,
    productionEligible: false,
    blockers,
    trace: { libraryVersion: "1.0", networkCalls: 0, providerCalls: 0, databaseWrites: 0 }
  };
  validatePromptSetSchema(result, { strictExpectedTextHash: true });
  return result;
}

export function adaptEvaluationCase(sample) {
  if (!sample || typeof sample !== "object" || !sample.id || !sample.input || !sample.selection) throw new Error("EVALUATION_CASE_ENVELOPE_INVALID");
  return {
    schemaVersion: "1.0",
    contract: RUNTIME_INPUT,
    id: sample.id,
    xhsPostPackage: sample.input.xhsPostPackage,
    contentVersion: sample.input.contentVersion,
    designDna: sample.input.designDna,
    authorizedAssets: sample.input.authorizedAssets || [],
    providerCapability: sample.input.providerCapabilities,
    pageDensity: sample.input.pageDensity || {},
    visualSelection: {
      stylePackId: sample.selection.stylePackId,
      reason: sample.selection.reason,
      pages: sample.selection.pages.map((page) => ({
        pageId: page.pageId,
        archetypeId: page.archetypeId,
        patternIds: [...page.patternIds],
        referenceAssetIds: [...(page.referenceAssetIds || [])],
        verbatimTextOverride: page.verbatimTextOverride ? [...page.verbatimTextOverride] : null,
        stylePackId: page.stylePackId || null
      }))
    }
  };
}

export { RUNTIME_INPUT };
