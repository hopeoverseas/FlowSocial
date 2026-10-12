const list = (value) => Array.isArray(value) ? value.filter(Boolean) : [];
const text = (value) => typeof value === "string" ? value.trim() : "";

export const XHS_PAGE_TEMPLATES = Object.freeze({
  cover: { label: "封面", layoutType: "cover_hero", capacity: 42, objective: "用一句明确承诺建立阅读预期" },
  pain_list: { label: "痛点清单", layoutType: "pain_list", capacity: 108, objective: "列出目标读者能够立即识别的核心痛点" },
  concept_definition: { label: "概念定义", layoutType: "concept_definition", capacity: 150, objective: "解释核心概念及其串联对象" },
  process_flow: { label: "流程链路", layoutType: "process_flow", capacity: 120, objective: "按顺序展示从策略到复盘的完整链路" },
  permission_matrix: { label: "权限矩阵", layoutType: "permission_matrix", capacity: 140, objective: "区分资料可用范围和授权边界" },
  gate_mechanism: { label: "门禁机制", layoutType: "gate_mechanism", capacity: 140, objective: "展示来源、质量和人工确认门禁" },
  value_summary: { label: "价值总结", layoutType: "value_summary", capacity: 130, objective: "总结可执行方法和业务价值" },
  action_cta: { label: "行动引导", layoutType: "action_cta", capacity: 90, objective: "给出清晰、克制且可执行的下一步" }
});

const FIXED_EIGHT_ROLES = ["cover", "pain_list", "concept_definition", "process_flow", "permission_matrix", "gate_mechanism", "value_summary", "action_cta"];

function layerText(layer) {
  if (typeof layer === "string") return text(layer);
  return text(layer?.text || layer?.content || layer?.value || layer?.title || layer?.body);
}

export function adaptTextLayers(page = {}) {
  const layers = list(page.text_layers || page.textLayers);
  const headlineKinds = ["headline", "title", "heading", "主标题", "标题"];
  const explicitHeadlineLayer = layers.find((layer) => headlineKinds.includes(text(layer?.type || layer?.role || layer?.kind).toLowerCase()) && layerText(layer));
  // The model's legacy package sometimes copied the article title into every
  // page.headline while still returning the correct per-page title in
  // text_layers. The structured layer is the more specific source of truth.
  let headline = layerText(explicitHeadlineLayer) || text(page.headline);
  const bodyItems = list(page.body_items || page.bodyItems).map((item) => typeof item === "string" ? text(item) : layerText(item)).filter(Boolean);
  let supportingText = text(page.supporting_text || page.supportingText);
  for (const layer of layers) {
    const kind = text(layer?.type || layer?.role || layer?.kind).toLowerCase();
    const value = layerText(layer);
    if (layer === explicitHeadlineLayer) continue;
    if (["list", "items", "bullets", "body_items", "列表"].includes(kind) && Array.isArray(layer?.items)) {
      bodyItems.push(...layer.items.map(layerText).filter(Boolean));
      continue;
    }
    if (!value) continue;
    if (!headline && headlineKinds.includes(kind)) headline = value;
    else if (["body", "supporting", "description", "copy", "正文", "说明"].includes(kind)) bodyItems.push(value);
    else if (!headline) headline = value;
    else bodyItems.push(value);
  }
  if (!bodyItems.length && supportingText) {
    const split = supportingText.split(/\n|[；;]|(?:\s*[→➜]\s*)/).map((item) => item.replace(/^[•·\-\d.、\s]+/, "").trim()).filter(Boolean);
    if (split.length > 1) bodyItems.push(...split);
  }
  if (!supportingText && bodyItems.length) supportingText = bodyItems.join("；");
  return { headline, bodyItems: [...new Set(bodyItems)], supportingText, textLayers: structuredClone(layers) };
}

function roleForPage(page, index, count) {
  // The eight-page Xiaohongshu contract has a deliberate narrative order.
  // Model-provided role labels are advisory: accepting them verbatim allowed
  // duplicate covers/summaries and silently dropped definition or gate pages.
  if (count === FIXED_EIGHT_ROLES.length) return FIXED_EIGHT_ROLES[index];
  const value = `${page.page_role || page.pageRole || ""} ${page.headline || ""}`.toLowerCase();
  if (index === 0 || /cover|封面/.test(value)) return "cover";
  if (/痛点|问题|pain/.test(value)) return "pain_list";
  if (/定义|概念|definition/.test(value)) return "concept_definition";
  if (/流程|链路|步骤|flow|process/.test(value)) return "process_flow";
  if (/权限|分级|permission|matrix/.test(value)) return "permission_matrix";
  if (/门禁|审核|确认|gate/.test(value)) return "gate_mechanism";
  if (/行动|咨询|联系|cta/.test(value) || index === count - 1) return "action_cta";
  if (/价值|总结|方法|summary/.test(value)) return "value_summary";
  return index === count - 2 ? "value_summary" : "concept_definition";
}

function imageSpecFor(task, pageId) {
  return list(task.currentContent?.image_specs).find((item) => item.page_id === pageId) || null;
}

function visualDefaults(template, page, adapted) {
  const subjectByRole = {
    cover: "贯穿策略、内容、发布与复盘的统一内容任务",
    pain_list: "三个相互独立但彼此关联的业务痛点",
    concept_definition: "中心概念及其连接的关键对象",
    process_flow: "从左到右或从上到下的阶段链路",
    permission_matrix: "四级资料权限与可用范围",
    gate_mechanism: "来源、质量与人工确认三道门禁",
    value_summary: "可执行步骤与最终业务价值",
    action_cta: "咨询入口与低门槛下一步"
  };
  const compositionByRole = {
    cover: "大标题占据上半部，核心视觉位于中下部，底部保留品牌与页码",
    pain_list: "三张纵向编号卡形成清晰扫描路径，每项保持等权",
    concept_definition: "中心定义卡连接外围对象，主次层级清晰",
    process_flow: "阶段节点按阅读顺序连接，时间节点使用强调色",
    permission_matrix: "四行权限表格，状态色只承担分级含义",
    gate_mechanism: "三道门禁并列，每道门禁包含输入、判断和结果",
    value_summary: "四步方法形成递进列表，右下角放置价值总结",
    action_cta: "行动指令居中，两个联系入口在下方并列"
  };
  return {
    visualDescription: text(page.visual_description || page.visualDescription || page.visual_direction) || `${template.label}信息页：以${subjectByRole[page.pageRole]}为主体，使用清晰的信息层级呈现“${adapted.headline}”，中文文字全部由确定性排版层叠加。`,
    visualSubject: text(page.visual_subject || page.visualSubject) || subjectByRole[page.pageRole],
    composition: text(page.composition) || compositionByRole[page.pageRole],
    palette: text(page.palette) || "深墨绿、米白与珊瑚强调色，保持企业编辑感和足够对比度"
  };
}

export function createXhsVisualStoryboard(task) {
  if (!task || task.platform !== "xiaohongshu") throw Object.assign(new Error("XhsVisualStoryboard only supports Xiaohongshu"), { statusCode: 400 });
  const sourcePages = list(task.currentContent?.deck?.pages);
  const createdAt = new Date().toISOString();
  const pages = sourcePages.map((source, index) => {
    const adapted = adaptTextLayers(source);
    const pageRole = roleForPage({ ...source, headline: adapted.headline }, index, sourcePages.length);
    const template = XHS_PAGE_TEMPLATES[pageRole];
    const pageId = source.page_id || source.pageId || `P${index + 1}`;
    const spec = imageSpecFor(task, pageId);
    const renderStrategy = text(source.render_strategy || source.renderStrategy) || (spec ? "generated_raster" : "html_css");
    const visual = visualDefaults(template, { ...source, pageRole }, adapted);
    const rawPrompt = text(spec?.prompt);
    const imagePrompt = renderStrategy === "generated_raster" ? [rawPrompt, `Purpose: ${text(source.content_objective || source.contentObjective) || template.objective}`, `Scene and subject: ${visual.visualSubject}`, "Medium: polished editorial illustration or photography without embedded typography", `Composition: ${visual.composition}`, "Light: controlled soft editorial lighting", `Color and material: ${visual.palette}`, "Keep a clear Chinese typography safe area for deterministic overlay", "Respect the account brand style and avoid third-party brand marks", "no text, no logo, no watermark"].filter(Boolean).join(". ") : rawPrompt;
    return {
      pageId,
      pageNumber: index + 1,
      pageRole,
      roleLabel: template.label,
      contentObjective: text(source.content_objective || source.contentObjective) || template.objective,
      headline: adapted.headline || (index === 0 ? text(task.currentContent?.post_copy?.recommended_title || task.ideaTitle) : ""),
      bodyItems: adapted.bodyItems,
      supportingText: adapted.supportingText,
      textLayers: adapted.textLayers,
      layoutType: text(source.layout_type || source.layoutType) || template.layoutType,
      ...visual,
      renderStrategy,
      imagePrompt,
      imageNegativePrompt: text(spec?.negative_prompt) || list(spec?.prohibitions).join(", "),
      factIds: list(source.fact_ids || source.factIds),
      interpretationIds: list(source.interpretation_ids || source.interpretationIds),
      qualityBackgroundRegions: structuredClone(list(source.quality_background_regions || source.qualityBackgroundRegions)),
      qualitySubjectBounds: structuredClone(source.quality_subject_bounds || source.qualitySubjectBounds || null),
      qualitySafeArea: structuredClone(source.quality_safe_area || source.qualitySafeArea || null),
      qualityLayers: structuredClone(list(source.quality_layers || source.qualityLayers)),
      qualityCropDetected: source.quality_crop_detected === true || source.qualityCropDetected === true,
      sourcePageId: pageId
    };
  });
  return {
    kind: "XhsVisualStoryboard",
    schemaVersion: "1.0",
    id: `xhs_storyboard_${task.id}_v${task.version}`,
    contentTaskId: task.id,
    contentVersion: task.version,
    storyboardVersion: 1,
    status: "visual_storyboard_ready",
    pages,
    confirmation: null,
    createdAt,
    updatedAt: createdAt
  };
}

export function updateXhsVisualStoryboard(task, input = {}) {
  const current = task.visualStoryboard?.contentVersion === task.version ? task.visualStoryboard : createXhsVisualStoryboard(task);
  const supplied = new Map(list(input.pages).map((page) => [page.pageId, page]));
  const pages = current.pages.map((page) => {
    const next = supplied.get(page.pageId);
    if (!next) return page;
    const has = (key) => Object.prototype.hasOwnProperty.call(next, key);
    const nextText = (key, fallback) => has(key) ? text(next[key]) : fallback;
    const nextList = (key, fallback) => has(key) ? list(next[key]).map((item) => text(item)).filter(Boolean) : fallback;
    return {
      ...page,
      contentObjective: nextText("contentObjective", page.contentObjective),
      headline: nextText("headline", page.headline),
      bodyItems: nextList("bodyItems", page.bodyItems),
      supportingText: nextText("supportingText", page.supportingText),
      layoutType: nextText("layoutType", page.layoutType),
      visualDescription: nextText("visualDescription", page.visualDescription),
      visualSubject: nextText("visualSubject", page.visualSubject),
      composition: nextText("composition", page.composition),
      palette: nextText("palette", page.palette),
      renderStrategy: ["html_css", "generated_raster", "authorized_asset"].includes(next.renderStrategy) ? next.renderStrategy : page.renderStrategy,
      imagePrompt: nextText("imagePrompt", page.imagePrompt),
      imageNegativePrompt: nextText("imageNegativePrompt", page.imageNegativePrompt)
    };
  });
  task.visualStoryboard = { ...current, storyboardVersion: Number(current.storyboardVersion || 1) + 1, status: "visual_storyboard_ready", pages, confirmation: null, updatedAt: new Date().toISOString() };
  task.visualWorkflowState = "visual_storyboard_ready";
  return task.visualStoryboard;
}

function normalized(value) {
  return text(value).toLowerCase().replace(/[\s，。！？、；：,.!?;:()（）【】\[\]-]+/g, "");
}

export function validateXhsVisualStoryboard(storyboard, { requireConfirmation = false } = {}) {
  const pages = list(storyboard?.pages);
  const checks = [];
  const headlines = pages.map((page) => normalized(page.headline)).filter(Boolean);
  const duplicates = [...new Set(headlines.filter((value, index) => headlines.indexOf(value) !== index))];
  const missingBody = pages.filter((page) => page.pageRole !== "cover" && !list(page.bodyItems).length && !text(page.supportingText)).map((page) => page.pageId);
  const capacityOverflow = pages.filter((page) => {
    const capacity = XHS_PAGE_TEMPLATES[page.pageRole]?.capacity || 120;
    const body = list(page.bodyItems);
    // supportingText is commonly the serialized form of bodyItems. Counting
    // both made valid cards fail capacity even though the renderer only shows
    // one copy of that content.
    const renderedBody = body.length ? body.join("") : text(page.supportingText);
    return `${page.headline || ""}${renderedBody}`.length > capacity;
  }).map((page) => page.pageId);
  const incompleteVisual = pages.filter((page) => !text(page.contentObjective) || !text(page.visualDescription) || !text(page.visualSubject) || !text(page.composition) || !text(page.palette) || !text(page.layoutType)).map((page) => page.pageId);
  const incompleteRaster = pages.filter((page) => {
    if (page.renderStrategy !== "generated_raster") return false;
    const prompt = `${page.imagePrompt || ""} ${page.imageNegativePrompt || ""}`;
    return text(page.imagePrompt).length < 120 || !/(safe\s*area|安全区|文字留白)/i.test(prompt) || !/(brand|品牌)/i.test(prompt) || !/no\s*text/i.test(prompt) || !/no\s*logo/i.test(prompt) || !/no\s*watermark/i.test(prompt);
  }).map((page) => page.pageId);
  const expectedRoles = pages.length === 8 ? FIXED_EIGHT_ROLES : [];
  const missingRoles = expectedRoles.filter((role) => !pages.some((page) => page.pageRole === role));
  const mismatchedLayouts = pages.filter((page) => XHS_PAGE_TEMPLATES[page.pageRole]?.layoutType !== page.layoutType).map((page) => page.pageId);
  const layoutCount = new Set(pages.map((page) => page.layoutType).filter(Boolean)).size;
  checks.push(
    { check: "page_count_6_to_10", result: pages.length >= 6 && pages.length <= 10 ? "pass" : "fail", detail: { pageCount: pages.length } },
    { check: "independent_content_objectives", result: pages.every((page) => text(page.contentObjective)) ? "pass" : "fail" },
    { check: "non_cover_headline_and_body", result: pages.every((page) => text(page.headline)) && !missingBody.length ? "pass" : "fail", detail: { missingBody } },
    { check: "no_duplicate_headlines", result: duplicates.length ? "fail" : "pass", detail: { duplicates } },
    { check: "eight_role_coverage", result: missingRoles.length ? "fail" : "pass", detail: { missingRoles } },
    { check: "role_template_match", result: mismatchedLayouts.length ? "fail" : "pass", detail: { mismatchedLayouts } },
    { check: "layout_diversity", result: pages.length !== 8 || layoutCount >= 4 ? "pass" : "fail", detail: { layoutCount, minimum: pages.length === 8 ? 4 : null } },
    { check: "template_capacity", result: capacityOverflow.length ? "fail" : "pass", detail: { capacityOverflow } },
    { check: "visual_description_complete", result: incompleteVisual.length ? "fail" : "pass", detail: { incompleteVisual } },
    { check: "generated_raster_prompt_complete", result: incompleteRaster.length ? "fail" : "pass", detail: { incompleteRaster } },
    { check: "storyboard_human_confirmed", result: !requireConfirmation || storyboard?.status === "visual_storyboard_confirmed" && storyboard?.confirmation?.decision === "confirmed" ? "pass" : "fail" }
  );
  const blockers = checks.filter((item) => item.result === "fail").map((item) => item.check);
  return { schemaVersion: "1.0", status: blockers.length ? "needs_review" : "passed", checks, blockers };
}

export function confirmXhsVisualStoryboard(task, { confirmedBy = "workspace_user", note = "" } = {}) {
  const storyboard = task.visualStoryboard?.contentVersion === task.version ? task.visualStoryboard : createXhsVisualStoryboard(task);
  const validation = validateXhsVisualStoryboard(storyboard);
  if (validation.status !== "passed") {
    const error = new Error(`视觉分镜仍有阻断项：${validation.blockers.join("、")}`);
    error.statusCode = 409;
    error.code = "XHS_STORYBOARD_INVALID";
    error.details = validation.checks.filter((item) => item.result === "fail");
    throw error;
  }
  const confirmedAt = new Date().toISOString();
  task.visualStoryboard = { ...storyboard, status: "visual_storyboard_confirmed", confirmation: { decision: "confirmed", confirmedBy, confirmedAt, note: text(note), storyboardVersion: storyboard.storyboardVersion }, updatedAt: confirmedAt };
  task.visualWorkflowState = "visual_storyboard_confirmed";
  return task.visualStoryboard;
}

export function requireConfirmedXhsStoryboard(task) {
  if (task.platform !== "xiaohongshu") return null;
  const storyboard = task.visualStoryboard;
  const validation = validateXhsVisualStoryboard(storyboard, { requireConfirmation: true });
  if (validation.status !== "passed" || storyboard?.contentVersion !== task.version) {
    const error = new Error("请先审阅并确认当前版本的卡片分镜与视觉说明");
    error.statusCode = 409;
    error.code = "XHS_STORYBOARD_CONFIRMATION_REQUIRED";
    error.details = validation.checks.filter((item) => item.result === "fail");
    throw error;
  }
  return storyboard;
}

export function storyboardRenderPages(task) {
  const storyboard = requireConfirmedXhsStoryboard(task);
  return storyboard.pages.map((page) => ({
    page_id: page.pageId,
    page_number: page.pageNumber,
    page_role: page.pageRole,
    content_objective: page.contentObjective,
    headline: page.headline,
    body_items: page.bodyItems,
    supporting_text: page.supportingText,
    text_layers: page.textLayers,
    layout_type: page.layoutType,
    visual_description: page.visualDescription,
    visual_subject: page.visualSubject,
    composition: page.composition,
    palette: page.palette,
    render_strategy: page.renderStrategy,
    image_prompt: page.imagePrompt,
    quality_background_regions: page.qualityBackgroundRegions,
    quality_subject_bounds: page.qualitySubjectBounds,
    quality_safe_area: page.qualitySafeArea,
    quality_layers: page.qualityLayers,
    quality_crop_detected: page.qualityCropDetected,
    fact_ids: page.factIds,
    interpretation_ids: page.interpretationIds
  }));
}
