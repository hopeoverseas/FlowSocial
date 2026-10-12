import { createHash, randomUUID } from "node:crypto";

const list = (value) => Array.isArray(value) ? value.filter(Boolean) : [];
const text = (value) => typeof value === "string" ? value.trim() : "";
const now = () => new Date().toISOString();
const HASH = /^[a-f0-9]{64}$/;
const DESIGN_DNA_MEDIA_DIRECTIONS = new Set(["editorial_photography", "isometric_illustration"]);

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function designDnaFail(code, message) {
  throw Object.assign(new Error(message || code), { statusCode: 409, code });
}

export function createDesignDnaSnapshotRef(snapshot) {
  if (!snapshot?.id) designDnaFail("DESIGN_DNA_SNAPSHOT_REF_INVALID", "Design DNA snapshot 缺少 ID");
  return { id: snapshot.id, hash: createHash("sha256").update(canonical(snapshot)).digest("hex") };
}

export const XHS_VISUAL_MODES = Object.freeze(["all_ai_backgrounds", "smart_hybrid", "deterministic_only"]);
export const XHS_VISUAL_REJECTION_REASONS = Object.freeze([
  "text_or_gibberish",
  "logo_or_watermark",
  "semantic_mismatch",
  "style_mismatch",
  "unsafe_text_area"
]);

const NO_TEXT_NEGATIVE_PROMPT = "no text, no letters, no words, no numbers, no glyphs, no logo, no watermark; preserve the planned safe area; brand-neutral";
const promptRiskPatterns = Object.freeze([
  ["title_or_heading", /(?:\btitle\b|\bheadline\b|\bheading\b|标题|大标题|小标题)/iu],
  ["body_or_caption", /(?:\bbody(?:\s+copy)?\b|\bcaption\b|\bcopy\b|正文|文案|说明文字)/iu],
  ["text_or_glyph", /(?:\btext\b|\bletters?\b|\bwords?\b|\btypography\b|\bglyphs?\b|文字|字母|字体|排版文字)/iu],
  ["label_or_tag", /(?:\blabels?\b|\btags?\b|标签|标注)/iu],
  ["table_or_card", /(?:\btables?\b|\bcards?\b|表格|卡片文字|信息卡)/iu],
  ["input_output", /(?:\binputs?\b|\boutputs?\b|输入|输出|结果框)/iu],
  ["contact_or_button", /(?:\bcontacts?\b|\bbuttons?\b|\bcall[\s-]?to[\s-]?action\b|联系方式|联系入口|按钮|行动按钮)/iu],
  ["interface_or_screen", /(?:\bui\b|\binterface\b|\bdashboard\b|\bscreens?\b|\bapp\b|界面|仪表盘|屏幕|截图)/iu],
  ["document_or_signage", /(?:\bdocuments?\b|\breports?\b|\bposters?\b|\bsignage\b|\bbanners?\b|文档|报告|海报|标牌|横幅)/iu]
]);

const roleDirection = Object.freeze({
  cover: { metaphor: "一条贯通多个运营节点的发光主线", subject: "a continuous sculptural ribbon connecting several matte geometric nodes", perspective: "slightly elevated frontal view", lighting: "soft restrained side light", safe: "large calm negative space across the upper-left quadrant" },
  pain_list: { metaphor: "三个彼此断开的工作岛屿", subject: "three separated work islands made from stone, paper and frosted glass", perspective: "elevated three-quarter view", lighting: "soft studio light with clear separation", safe: "clean negative space surrounding each island" },
  concept_definition: { metaphor: "中心枢纽连接多个可信对象", subject: "one central ceramic hub linked to several distinct physical objects", perspective: "symmetrical frontal view", lighting: "focused center light with gentle falloff", safe: "quiet negative space above the hub and between connections" },
  process_flow: { metaphor: "一条从策略流向复盘的可见路径", subject: "a winding physical pathway passing through four distinct architectural thresholds", perspective: "wide shallow perspective", lighting: "directional light progressing along the path", safe: "continuous uncluttered negative space through the upper-middle area" },
  permission_matrix: { metaphor: "四层透明材质形成清晰权限边界", subject: "four nested translucent enclosures with visibly different material opacity", perspective: "straight-on layered view", lighting: "even studio light revealing material boundaries", safe: "quiet negative space along the right side of every layer" },
  gate_mechanism: { metaphor: "三道依次开启的质量闸门", subject: "three sequential sculptural gates aligned in deep space", perspective: "deep frontal perspective", lighting: "a narrow beam passing through each gate", safe: "uncluttered negative space above and to the left of each gate" },
  value_summary: { metaphor: "四块积木搭成稳定增长结构", subject: "four interlocking stone and glass blocks forming a stable ascending structure", perspective: "forty-five degree elevated view", lighting: "warm high-quality soft light", safe: "broad quiet negative space at the upper-right and lower edge" },
  action_cta: { metaphor: "一扇开放入口与明确的下一步路径", subject: "an open architectural portal leading toward a softly illuminated path", perspective: "calm frontal view", lighting: "warm focused light beyond the portal", safe: "large low-detail negative space in the center and lower third" }
});
const fixedEightRoles = Object.freeze(Object.keys(roleDirection));

function normalizePrompt(value) {
  return text(value).toLowerCase().replace(/[\s,.;:，。；：\-_/]+/g, "");
}

function textualDesignSignals(value) {
  const source = text(value);
  const collect = (terms) => terms.filter((term) => source.toLowerCase().includes(term.toLowerCase()));
  const hex = source.match(/#[0-9a-f]{6}\b/gi) || [];
  return {
    colors: [...new Set([...hex, ...collect(["深绿", "墨绿", "暖白", "米白", "珊瑚红", "红色", "蓝色", "黑色", "白色", "金色", "灰色"])])],
    fontPreferences: collect(["无衬线", "衬线", "宋体", "黑体", "粗体", "细体"]),
    layoutPreferences: collect(["大留白", "留白", "信息卡片", "网格", "居中", "左对齐", "杂志版式", "编辑版式"]),
    materials: collect(["纸张", "磨砂玻璃", "玻璃", "金属", "木质", "布料", "胶片", "颗粒"]),
    forbiddenMotifs: collect(["霓虹", "科技光", "赛博朋克", "复杂 UI", "伪文字", "水印", "Logo"])
  };
}

function selectMediaDirection(designDnaSnapshot) {
  const requested = text(designDnaSnapshot?.photographyOrIllustrationDirection).toLowerCase();
  if (/(illustration|插画|等距)/i.test(requested) && !/(photograph|摄影)/i.test(requested)) return "isometric_illustration";
  return "editorial_photography";
}

function builtInStylePreset(mediaDirection) {
  return mediaDirection === "isometric_illustration"
    ? { id: "flowsocial_isometric_studio_v1", label: "FlowSocial 内置等距插画预设", camera: "consistent isometric camera at thirty degrees", material: "matte paper, frosted glass and fine brushed metal", lighting: "soft studio illumination from the upper-left", palette: "deep forest green, warm ivory and a restrained coral accent", finish: "precise tactile miniature-world rendering" }
    : { id: "flowsocial_editorial_studio_v1", label: "FlowSocial 内置编辑摄影预设", camera: "consistent fifty millimeter lens with a slightly elevated frontal angle", material: "matte paper, frosted glass, stone and fine brushed metal", lighting: "soft directional studio daylight from the upper-left", palette: "deep forest green, warm ivory and a restrained coral accent", finish: "premium editorial still-life photography" };
}

export function inspectNoTextVisualPrompt(prompt) {
  const source = text(prompt);
  const risks = promptRiskPatterns.filter(([, pattern]) => pattern.test(source)).map(([code]) => code);
  return { passed: Boolean(source) && risks.length === 0, risks };
}

export function projectVisualDirectionCompatibility(task, set = task?.visualDirectionSet) {
  if (!set) return null;
  const pages = list(set.pages);
  const roles = new Set(pages.map((page) => page.pageRole));
  const missingRoles = fixedEightRoles.filter((role) => !roles.has(role));
  const storyboardBlockers = list(task?.visualStoryboard?.validation?.blockers).filter((item) => ["eight_role_coverage", "role_template_match", "template_capacity"].includes(item));
  const issues = [
    ...(set.schemaVersion === "1.1" ? [] : ["legacy_direction_schema"]),
    ...(pages.length === 8 ? [] : ["eight_page_capacity_missing"]),
    ...missingRoles.map((role) => `missing_role:${role}`),
    ...storyboardBlockers.map((blocker) => `storyboard:${blocker}`),
    ...(["editorial_photography", "isometric_illustration"].includes(set.mediaDirection) ? [] : ["single_media_direction_missing"])
  ];
  return {
    schemaVersion: "1.0",
    projectedAtRead: true,
    historicalSnapshotMutated: false,
    compatible: issues.length === 0,
    issues,
    action: issues.length ? "regenerate_visual_direction_for_current_content_version" : null,
    note: issues.length
      ? "旧视觉任务保留原快照；请通过视觉导演入口为当前内容版本重新生成兼容方案，无需手工修改数据库。"
      : "当前视觉任务已符合新版质量合同。"
  };
}

function directionPrompt({ page, mediaDirection, stylePreset, palette, materials }) {
  const role = roleDirection[page.pageRole] || roleDirection.concept_definition;
  return [
    mediaDirection === "isometric_illustration" ? "sophisticated isometric editorial illustration" : "premium editorial still-life photography",
    role.subject,
    stylePreset.camera,
    `${role.perspective}, ${role.safe}`,
    stylePreset.lighting,
    `materials limited to ${materials.join(", ") || stylePreset.material}`,
    `palette limited to ${palette.join(", ") || stylePreset.palette}`,
    stylePreset.finish,
    "low-detail calm surfaces and generous negative space"
  ].join(". ");
}

export function createDesignDnaSnapshot({ accountId, sourceFiles = [], authorizedFileIds = [], styleInput = {}, providerCapabilities = {} }) {
  const approved = new Set(list(authorizedFileIds));
  const sources = list(sourceFiles).map((file) => ({
    fileId: file.id,
    name: file.name,
    kind: file.kind,
    parseStatus: file.parseStatus,
    parseMode: file.parseMode,
    description: text(file.description),
    tags: list(file.tags),
    extractedSummary:
      approved.has(file.id) && ["ready", "visual_ready"].includes(file.parseStatus)
        ? text(file.extractedTextSummary).slice(0, 600)
        : "",
    externalUseApproved: approved.has(file.id)
  }));
  const approvedSources = sources.filter((item) => item.externalUseApproved && ["ready", "visual_ready"].includes(item.parseStatus));
  const textualEvidence = approvedSources.flatMap((item) => [item.description, ...item.tags, item.extractedSummary]).filter(Boolean);
  const approvedTextSummary = text(styleInput.approvedTextSummary || [styleInput.description, ...textualEvidence].filter(Boolean).join("；")).slice(0, 1600);
  const signals = textualDesignSignals(approvedTextSummary);
  const createdAt = now();
  return {
    kind: "DesignDNA",
    schemaVersion: "1.0",
    id: `design_dna_${accountId}_${randomUUID().slice(0, 8)}`,
    accountId,
    version: Number(styleInput.version || 1),
    status: "ready_for_confirmation",
    colors: list(styleInput.colors).length ? list(styleInput.colors) : signals.colors,
    fontPreferences: list(styleInput.fontPreferences).length ? list(styleInput.fontPreferences) : signals.fontPreferences,
    layoutPreferences: list(styleInput.layoutPreferences).length ? list(styleInput.layoutPreferences) : signals.layoutPreferences,
    materials: list(styleInput.materials).length ? list(styleInput.materials) : signals.materials,
    photographyOrIllustrationDirection: text(styleInput.photographyOrIllustrationDirection || styleInput.description),
    forbiddenMotifs: list(styleInput.forbiddenMotifs).length ? list(styleInput.forbiddenMotifs) : signals.forbiddenMotifs,
    referenceNotes: text(styleInput.referenceNotes || textualEvidence.join("；")),
    approvedTextSummary,
    sources,
    authorization: {
      approvedFileIds: approvedSources.map((item) => item.fileId),
      excludedFileIds: sources.filter((item) => !approvedSources.some((approvedItem) => approvedItem.fileId === item.fileId)).map((item) => item.fileId),
      providerReferenceImageSupported: providerCapabilities.referenceImages === true,
      referenceImagesTransmitted: false,
      externalInputMode: "approved_text_summary_only",
      disclosure: providerCapabilities.referenceImages === true
        ? "当前工作流仍只发送已批准的文字化 Design DNA；原文件不会自动发送。"
        : "当前图片 Provider 不支持参考图输入，只使用用户批准的文字化 Design DNA；原文件未发送给 Provider。"
    },
    confirmation: null,
    createdAt,
    updatedAt: createdAt
  };
}

function authoredRuleList(value, field) {
  const values = list(value).map(text).filter(Boolean);
  if (!values.length || new Set(values).size !== values.length) designDnaFail("DESIGN_DNA_RULES_INCOMPLETE", `Design DNA ${field} 必须提供非空且不重复的规则`);
  return values;
}

export function createAuthoredDesignDnaSnapshot({
  accountId,
  version,
  styleRules,
  sourceFiles = [],
  authorizedFileIds = [],
  mode = "approved_sources",
  userAuthoredRulesAuthorized = false,
  providerCapabilities = {}
}) {
  if (!text(accountId)) designDnaFail("DESIGN_DNA_ACCOUNT_NOT_FOUND", "Design DNA 必须绑定真实社媒账号");
  const rules = styleRules && typeof styleRules === "object" && !Array.isArray(styleRules) ? styleRules : {};
  const normalized = {
    colors: authoredRuleList(rules.colors, "colors"),
    fontPreferences: authoredRuleList(rules.fontPreferences, "fontPreferences"),
    layoutPreferences: authoredRuleList(rules.layoutPreferences, "layoutPreferences"),
    materials: authoredRuleList(rules.materials, "materials"),
    photographyOrIllustrationDirection: text(rules.photographyOrIllustrationDirection),
    forbiddenMotifs: authoredRuleList(rules.forbiddenMotifs, "forbiddenMotifs"),
    referenceNotes: text(rules.referenceNotes)
  };
  if (!DESIGN_DNA_MEDIA_DIRECTIONS.has(normalized.photographyOrIllustrationDirection)) {
    designDnaFail("DESIGN_DNA_MEDIA_DIRECTION_INVALID", "Design DNA 必须选择单一摄影或插画方向");
  }
  if (!Number.isInteger(Number(version)) || Number(version) < 1) designDnaFail("DESIGN_DNA_VERSION_INVALID", "Design DNA version 无效");
  const files = list(sourceFiles);
  const approved = new Set(list(authorizedFileIds).map(text));
  if (approved.size !== list(authorizedFileIds).length) designDnaFail("DESIGN_DNA_SOURCE_AUTHORIZATION_INVALID", "来源授权不能重复");
  if (mode === "user_authored") {
    if (userAuthoredRulesAuthorized !== true) designDnaFail("DESIGN_DNA_USER_AUTHORIZATION_REQUIRED", "纯用户原创规则需要显式授权");
    if (files.length || approved.size) designDnaFail("DESIGN_DNA_USER_AUTHORED_SOURCES_FORBIDDEN", "纯用户原创基线不得携带文件来源");
  } else if (mode === "approved_sources") {
    if (!approved.size) designDnaFail("DESIGN_DNA_APPROVED_SOURCE_REQUIRED", "基于资料的 Design DNA 至少需要一个明确授权来源");
    for (const id of approved) {
      const file = files.find((item) => item.id === id);
      if (!file) designDnaFail("DESIGN_DNA_SOURCE_ACCOUNT_MISMATCH", "来源不属于当前账号");
      if (!["ready", "visual_ready"].includes(file.parseStatus)) designDnaFail("DESIGN_DNA_SOURCE_NOT_READY", "尚未准备好的来源不能进入 Design DNA 摘要");
    }
  } else {
    designDnaFail("DESIGN_DNA_AUTHORING_MODE_INVALID", "Design DNA authoring mode 无效");
  }
  const approvedSourceSummary = mode === "approved_sources"
    ? files.filter((item) => approved.has(item.id) && ["ready", "visual_ready"].includes(item.parseStatus))
      .flatMap((item) => [text(item.description), ...list(item.tags).map(text), text(item.extractedTextSummary)]).filter(Boolean).join("；")
    : "";
  const structuredSummary = [
    `色彩：${normalized.colors.join("、")}`,
    `字体：${normalized.fontPreferences.join("、")}`,
    `版式：${normalized.layoutPreferences.join("、")}`,
    `材质：${normalized.materials.join("、")}`,
    `媒介：${normalized.photographyOrIllustrationDirection}`,
    `禁用：${normalized.forbiddenMotifs.join("、")}`,
    normalized.referenceNotes ? `补充：${normalized.referenceNotes}` : "",
    approvedSourceSummary ? `已授权来源摘要：${approvedSourceSummary}` : ""
  ].filter(Boolean).join("；");
  const snapshot = createDesignDnaSnapshot({
    accountId,
    sourceFiles: mode === "user_authored" ? [] : files,
    authorizedFileIds: mode === "user_authored" ? [] : [...approved],
    styleInput: { ...normalized, approvedTextSummary: structuredSummary, version: Number(version) },
    providerCapabilities
  });
  snapshot.authorization = {
    ...snapshot.authorization,
    externalInputMode: mode === "user_authored" ? "user_authored_style_rules" : "approved_text_summary_only",
    referenceImagesTransmitted: false,
    brandReplicationClaimed: false,
    userAuthoredRulesAuthorized: mode === "user_authored",
    disclosure: mode === "user_authored"
      ? "本基线仅使用用户明确创作并授权的结构化视觉规则；没有文件来源，不发送原文件，也不声称品牌视觉复刻。"
      : "本基线只使用逐项授权来源的文字摘要与用户结构化规则；原文件不会发送给图片 Provider，也不声称品牌视觉复刻。"
  };
  return snapshot;
}

export function confirmDesignDnaSnapshot(snapshot, { confirmedBy = "workspace_user", note = "" } = {}) {
  if (snapshot?.status === "confirmed") designDnaFail("DESIGN_DNA_ALREADY_CONFIRMED", "Design DNA snapshot 已确认，不得重写历史确认");
  if (snapshot?.status !== "ready_for_confirmation") designDnaFail("DESIGN_DNA_SNAPSHOT_NOT_READY", "Design DNA snapshot 尚未进入待确认状态");
  if (!snapshot?.approvedTextSummary && !snapshot?.sources?.some((item) => item.externalUseApproved)) {
    throw Object.assign(new Error("Design DNA 缺少可审阅的视觉摘要或已授权资料"), { statusCode: 409, code: "DESIGN_DNA_INCOMPLETE" });
  }
  return {
    ...snapshot,
    status: "confirmed",
    confirmation: { decision: "confirmed", confirmedBy, note: text(note), confirmedAt: now() },
    updatedAt: now()
  };
}

/** Pure exact-confirm gate. The caller persists the returned replacement atomically. */
export function confirmExactDesignDnaSnapshot({ account, snapshots, snapshotRef, confirmedBy = "workspace_user", note = "" }) {
  if (!account?.id || account.accountType === "company") designDnaFail("DESIGN_DNA_ACCOUNT_NOT_FOUND", "Design DNA 必须绑定真实社媒账号");
  if (!snapshotRef || typeof snapshotRef !== "object") designDnaFail("DESIGN_DNA_SNAPSHOT_REF_REQUIRED", "确认请求必须包含刚审阅的 snapshotRef");
  if (Object.keys(snapshotRef).sort().join(",") !== "hash,id" || !text(snapshotRef.id) || !HASH.test(snapshotRef.hash || "")) {
    designDnaFail("DESIGN_DNA_SNAPSHOT_REF_INVALID", "snapshotRef 必须只包含有效的 id 和 hash");
  }
  const all = list(snapshots);
  const index = all.findIndex((item) => item.id === snapshotRef.id);
  if (index < 0) designDnaFail("DESIGN_DNA_SNAPSHOT_NOT_FOUND", "Design DNA snapshot 不存在");
  const snapshot = all[index];
  if (snapshot.accountId !== account.id) designDnaFail("DESIGN_DNA_SNAPSHOT_ACCOUNT_MISMATCH", "Design DNA snapshot 不属于当前账号");
  if (snapshot.status === "confirmed") designDnaFail("DESIGN_DNA_ALREADY_CONFIRMED", "Design DNA snapshot 已确认，不得重复确认");
  if (snapshot.status !== "ready_for_confirmation") designDnaFail("DESIGN_DNA_SNAPSHOT_NOT_READY", "Design DNA snapshot 尚未进入待确认状态");
  if (account.visualStyle?.designDnaSnapshotId !== snapshot.id || Number(account.visualStyle?.designDnaVersion) !== Number(snapshot.version)) {
    designDnaFail("DESIGN_DNA_SNAPSHOT_POINTER_STALE", "账号当前 Design DNA 指针已变化，请重新审阅");
  }
  const latest = all.filter((item) => item.accountId === account.id).at(-1) || null;
  if (!latest || latest.id !== snapshot.id) designDnaFail("DESIGN_DNA_SNAPSHOT_STALE", "存在更新的 Design DNA snapshot，请重新审阅最新版本");
  if (createDesignDnaSnapshotRef(snapshot).hash !== snapshotRef.hash) designDnaFail("DESIGN_DNA_SNAPSHOT_HASH_MISMATCH", "Design DNA snapshot 内容已变化，请重新审阅");
  const confirmed = confirmDesignDnaSnapshot(snapshot, { confirmedBy, note });
  return { index, confirmed, snapshotRef: createDesignDnaSnapshotRef(confirmed) };
}

export function createVisualDirectionSet(task, { mode = "all_ai_backgrounds", providerConfig = {}, designDnaSnapshot = null, candidateCount = 1 } = {}) {
  if (!task?.visualStoryboard?.pages?.length) throw Object.assign(new Error("请先建立逐页视觉分镜"), { statusCode: 409, code: "XHS_STORYBOARD_REQUIRED" });
  const selectedMode = XHS_VISUAL_MODES.includes(mode) ? mode : "all_ai_backgrounds";
  const count = Math.min(3, Math.max(1, Number(candidateCount) || 1));
  const imageConfig = providerConfig.image || providerConfig;
  const styleBrief = text(task.accountStyleSnapshot?.description || designDnaSnapshot?.approvedTextSummary || "专业、克制、具备企业编辑感的社媒视觉");
  const mediaDirection = selectMediaDirection(designDnaSnapshot);
  const stylePreset = builtInStylePreset(mediaDirection);
  const palette = list(designDnaSnapshot?.colors).length ? designDnaSnapshot.colors : ["deep forest green", "warm ivory", "restrained coral accent"];
  const materials = list(designDnaSnapshot?.materials).length ? designDnaSnapshot.materials : ["matte paper", "frosted glass", "fine brushed metal"];
  const sharedStyleAnchor = `${mediaDirection}; ${stylePreset.camera}; ${stylePreset.lighting}; ${materials.join(", ")}; ${palette.join(", ")}; generous calm negative space; ${stylePreset.finish}`;
  const pages = task.visualStoryboard.pages.map((page) => {
    const generated = selectedMode === "all_ai_backgrounds" || selectedMode === "smart_hybrid" && page.renderStrategy === "generated_raster";
    const role = roleDirection[page.pageRole] || roleDirection.concept_definition;
    const base = {
      pageId: page.pageId,
      pageRole: page.pageRole,
      roleLabel: page.roleLabel || page.pageRole,
      contentObjective: page.contentObjective,
      visualSubject: page.visualSubject,
      metaphor: role.metaphor,
      composition: page.composition,
      cameraOrPerspective: role.perspective,
      lighting: role.lighting,
      colorUse: page.palette,
      textSafeArea: role.safe,
      renderStrategy: generated ? "generated_raster" : "html_css",
      fallback: null
    };
    return {
      ...base,
      negativePrompt: NO_TEXT_NEGATIVE_PROMPT,
      prompt: generated ? directionPrompt({ page, mediaDirection, stylePreset, palette, materials }) : ""
    };
  });
  const createdAt = now();
  const set = {
    kind: "VisualDirectionSet",
    schemaVersion: "1.1",
    id: `visual_direction_${task.id}_v${task.version}_${randomUUID().slice(0, 6)}`,
    contentTaskId: task.id,
    contentVersion: task.version,
    directionVersion: Number(task.visualDirectionSet?.directionVersion || 0) + 1,
    status: "visual_direction_ready",
    mode: selectedMode,
    styleBrief,
    mood: text(task.accountStyleSnapshot?.mood || "专业、可信、克制"),
    palette,
    materials,
    mediaDirection,
    photographyOrIllustrationDirection: mediaDirection,
    stylePreset: {
      ...stylePreset,
      source: designDnaSnapshot?.status === "confirmed" ? "approved_design_dna_projection" : "built_in_stable_preset",
      brandReplicationClaimed: false
    },
    typographySafeZones: "每页按照角色保留独立中文标题与正文安全区，图片模型不生成任何文字",
    sharedStyleAnchor,
    forbiddenMotifs: list(designDnaSnapshot?.forbiddenMotifs).length ? designDnaSnapshot.forbiddenMotifs : ["伪文字", "水印", "第三方 Logo", "复杂 UI 截图"],
    designDnaSnapshotId: designDnaSnapshot?.status === "confirmed" ? designDnaSnapshot.id : null,
    designDnaUsage: designDnaSnapshot?.status === "confirmed"
      ? { ...designDnaSnapshot.authorization, mediaProjectionOnly: true }
      : { externalInputMode: "built_in_stable_preset", referenceImagesTransmitted: false, mediaProjectionOnly: false, disclosure: `本次未使用已确认的 Design DNA，使用${stylePreset.label}；不声称复刻品牌视觉。` },
    provider: text(imageConfig.provider),
    model: text(imageConfig.model),
    quality: text(imageConfig.quality),
    providerCapabilities: { textToImage: true, referenceImages: imageConfig.capabilities?.referenceImages === true },
    candidateCount: count,
    estimatedCalls: pages.filter((page) => page.renderStrategy === "generated_raster").length * count,
    pages,
    confirmation: null,
    createdAt,
    updatedAt: createdAt
  };
  applyVisualDirectionToStoryboard(task, set);
  task.visualDirectionSet = set;
  task.visualWorkflowState = "visual_direction_ready";
  return set;
}

export function applyVisualDirectionToStoryboard(task, set = task.visualDirectionSet) {
  if (!set || !task.visualStoryboard) return task.visualStoryboard;
  const byPage = new Map(set.pages.map((page) => [page.pageId, page]));
  task.visualStoryboard = {
    ...task.visualStoryboard,
    status: "visual_storyboard_ready",
    confirmation: null,
    pages: task.visualStoryboard.pages.map((page) => {
      const direction = byPage.get(page.pageId);
      return direction ? { ...page, renderStrategy: direction.renderStrategy, imagePrompt: direction.prompt, imageNegativePrompt: direction.negativePrompt } : page;
    }),
    updatedAt: now()
  };
  return task.visualStoryboard;
}

export function validateVisualDirectionSet(set, { requireConfirmation = false } = {}) {
  const pages = list(set?.pages);
  const generated = pages.filter((page) => page.renderStrategy === "generated_raster");
  const prompts = generated.map((page) => normalizePrompt(page.prompt));
  const promptInspections = generated.map((page) => ({ pageId: page.pageId, ...inspectNoTextVisualPrompt(page.prompt) }));
  const expectedCalls = generated.length * Number(set?.candidateCount || 0);
  const checks = [
    { check: "visual_mode_supported", result: XHS_VISUAL_MODES.includes(set?.mode) ? "pass" : "fail" },
    { check: "provider_model_quality_visible", result: text(set?.provider) && text(set?.model) && text(set?.quality) ? "pass" : "fail" },
    { check: "candidate_count_1_to_3", result: Number(set?.candidateCount) >= 1 && Number(set?.candidateCount) <= 3 ? "pass" : "fail" },
    { check: "estimated_calls_exact", result: Number(set?.estimatedCalls) === expectedCalls ? "pass" : "fail", detail: { expectedCalls, actual: set?.estimatedCalls } },
    { check: "all_ai_pages_planned", result: set?.mode !== "all_ai_backgrounds" || pages.length >= 6 && pages.every((page) => page.renderStrategy === "generated_raster" || page.renderStrategy === "html_css" && page.fallback?.confirmedAt) ? "pass" : "fail" },
    { check: "page_direction_complete", result: pages.every((page) => text(page.contentObjective) && text(page.visualSubject) && text(page.metaphor) && text(page.composition) && text(page.cameraOrPerspective) && text(page.lighting) && text(page.colorUse) && text(page.textSafeArea)) ? "pass" : "fail" },
    { check: "prompts_unique", result: new Set(prompts).size === prompts.length ? "pass" : "fail" },
    { check: "single_media_direction", result: ["editorial_photography", "isometric_illustration"].includes(set?.mediaDirection) && !/\bor\b|或|混合/iu.test(text(set?.photographyOrIllustrationDirection)) ? "pass" : "fail" },
    { check: "stable_style_anchors", result: Boolean(set?.stylePreset?.id && set?.stylePreset?.camera && set?.stylePreset?.lighting && set?.stylePreset?.palette && set?.sharedStyleAnchor) ? "pass" : "fail" },
    { check: "no_text_prompt_contract", result: promptInspections.every((item) => item.passed) && generated.every((page) => text(page.negativePrompt) === NO_TEXT_NEGATIVE_PROMPT) ? "pass" : "fail", detail: promptInspections.filter((item) => !item.passed) },
    { check: "direction_human_confirmed", result: !requireConfirmation || set?.status === "visual_direction_confirmed" && set?.confirmation?.decision === "confirmed" ? "pass" : "fail" }
  ];
  const blockers = checks.filter((item) => item.result === "fail").map((item) => item.check);
  return { schemaVersion: "1.0", status: blockers.length ? "needs_review" : "passed", checks, blockers };
}

export function confirmVisualDirectionSet(task, approval = {}) {
  const set = task.visualDirectionSet;
  const validation = validateVisualDirectionSet(set);
  const approvedFields = ["provider", "model", "quality", "candidateCount", "estimatedCalls"];
  const missing = approvedFields.filter((field) => approval[field] == null);
  const mismatch = approvedFields.filter((field) => approval[field] != null && String(approval[field]) !== String(set?.[field]));
  if (validation.status !== "passed" || missing.length || mismatch.length) {
    throw Object.assign(new Error(`视觉导演方案不能确认：${[...validation.blockers, ...missing.map((item) => `approval_${item}_missing`), ...mismatch.map((item) => `approval_${item}_mismatch`)].join("、")}`), { statusCode: 409, code: "XHS_VISUAL_DIRECTION_INVALID" });
  }
  const confirmedAt = now();
  task.visualDirectionSet = {
    ...set,
    status: "visual_direction_confirmed",
    confirmation: {
      decision: "confirmed",
      confirmedBy: approval.confirmedBy || "workspace_user",
      confirmedAt,
      provider: set.provider,
      model: set.model,
      quality: set.quality,
      candidateCount: set.candidateCount,
      estimatedCalls: set.estimatedCalls
    },
    updatedAt: confirmedAt
  };
  task.visualWorkflowState = "visual_direction_confirmed";
  return task.visualDirectionSet;
}

export function requireConfirmedVisualDirection(task) {
  if (!task.visualDirectionSet) return null;
  const validation = validateVisualDirectionSet(task.visualDirectionSet, { requireConfirmation: true });
  if (validation.status !== "passed" || task.visualDirectionSet.contentVersion !== task.version) {
    throw Object.assign(new Error("请先确认当前版本的视觉导演方案、Provider、模型质量、候选数和预计调用量"), { statusCode: 409, code: "XHS_VISUAL_DIRECTION_CONFIRMATION_REQUIRED", details: validation.checks.filter((item) => item.result === "fail") });
  }
  return task.visualDirectionSet;
}

export function getVisualCandidates(task) {
  if (Array.isArray(task.visualCandidates)) return task.visualCandidates.filter((item) => item.version === task.version).map((item) => {
    if (item.providerStatus && item.qualityStatus) return item;
    const providerStatus = item.providerStatus || item.status || "pending";
    return {
      ...item,
      status: providerStatus,
      providerStatus,
      qualityStatus: providerStatus === "succeeded" ? "pending_review" : "pending_review",
      rejectionReasons: list(item.rejectionReasons),
      selected: false,
      compatibilitySource: item.compatibilitySource || "pre_quality_gate_candidate",
      compatibilityProjection: {
        schemaVersion: "1.0",
        projectedAtRead: true,
        sourceStatus: item.status || null,
        note: "历史候选未记录独立质量审核，兼容读取为 Provider 状态保留、质量待人工复核；原快照未改写。"
      }
    };
  });
  return list(task.generatedAssets).filter((item) => item.version === task.version && item.pageId).map((item, index) => ({
    candidateId: item.candidateId || item.id || `legacy_candidate_${index + 1}`,
    pageId: item.pageId,
    candidateIndex: 1,
    provider: item.provider || "legacy",
    model: item.model || null,
    quality: item.quality || null,
    prompt: item.prompt || "",
    status: item.status,
    providerStatus: item.status || "pending",
    qualityStatus: "pending_review",
    rejectionReasons: [],
    path: item.relativePath || null,
    relativePath: item.relativePath || null,
    selected: false,
    error: item.error || null,
    version: item.version,
    compatibilitySource: "legacy_single_asset",
    compatibilityProjection: {
      schemaVersion: "1.0",
      projectedAtRead: true,
      sourceStatus: item.status || null,
      note: "旧单资产兼容投影为质量待人工复核；未改写历史资产。"
    }
  }));
}

export function selectVisualCandidate(task, { pageId, candidateId, selectedBy = "workspace_user" }) {
  return reviewVisualCandidate(task, { pageId, candidateId, decision: "approve", reviewedBy: selectedBy });
}

export function reviewVisualCandidate(task, { pageId, candidateId, decision, rejectionReasons = [], reviewedBy = "workspace_user", note = "" }) {
  const candidates = getVisualCandidates(task);
  const target = candidates.find((item) => item.pageId === pageId && item.candidateId === candidateId);
  if (!target || target.providerStatus !== "succeeded" || !target.relativePath) throw Object.assign(new Error("只能审核当前页 Provider 已成功返回的候选图"), { statusCode: 409, code: "XHS_CANDIDATE_NOT_READY" });
  if (!["approve", "reject"].includes(decision)) throw Object.assign(new Error("候选质量决定必须是 approve 或 reject"), { statusCode: 400, code: "XHS_CANDIDATE_DECISION_INVALID" });
  const reasons = [...new Set(list(rejectionReasons).map(text))];
  if (decision === "reject" && (!reasons.length || reasons.some((reason) => !XHS_VISUAL_REJECTION_REASONS.includes(reason)))) {
    throw Object.assign(new Error(`拒绝候选必须选择有效原因：${XHS_VISUAL_REJECTION_REASONS.join("、")}`), { statusCode: 400, code: "XHS_CANDIDATE_REJECTION_REASON_REQUIRED" });
  }
  const reviewedAt = now();
  task.visualCandidates = candidates.map((item) => {
    if (item.pageId !== pageId) return item;
    if (item.candidateId === candidateId) {
      return {
        ...item,
        qualityStatus: decision === "approve" ? "approved" : "rejected",
        rejectionReasons: decision === "reject" ? reasons : [],
        qualityReview: { decision, reviewedBy, reviewedAt, note: text(note) },
        selected: decision === "approve",
        selectedBy: decision === "approve" ? reviewedBy : null,
        selectedAt: decision === "approve" ? reviewedAt : null
      };
    }
    return decision === "approve" && item.qualityStatus === "approved"
      ? { ...item, qualityStatus: "pending_review", rejectionReasons: [], qualityReview: null, selected: false, selectedBy: null, selectedAt: null }
      : { ...item, selected: false };
  });
  task.visualWorkflowState = "candidate_selection";
  return task.visualCandidates.filter((item) => item.pageId === pageId);
}

export function fallbackVisualPage(task, { pageId, reason, confirmedBy = "workspace_user" }) {
  if (!text(reason)) throw Object.assign(new Error("单页回退必须填写明确原因"), { statusCode: 400, code: "XHS_FALLBACK_REASON_REQUIRED" });
  const page = task.visualDirectionSet?.pages?.find((item) => item.pageId === pageId);
  if (!page) throw Object.assign(new Error("视觉导演方案中不存在该页面"), { statusCode: 404, code: "XHS_VISUAL_PAGE_NOT_FOUND" });
  const fallback = { mode: "deterministic_only", reason: text(reason), confirmedBy, confirmedAt: now() };
  const pages = task.visualDirectionSet.pages.map((item) => item.pageId === pageId ? { ...item, renderStrategy: "html_css", fallback } : item);
  const estimatedCalls = pages.filter((item) => item.renderStrategy === "generated_raster").length * task.visualDirectionSet.candidateCount;
  task.visualDirectionSet = {
    ...task.visualDirectionSet,
    pages,
    estimatedCalls,
    confirmation: task.visualDirectionSet.confirmation
      ? { ...task.visualDirectionSet.confirmation, originallyApprovedEstimatedCalls: task.visualDirectionSet.confirmation.estimatedCalls, estimatedCalls, fallbackConfirmedAt: fallback.confirmedAt }
      : null,
    updatedAt: now()
  };
  task.visualStoryboard = { ...task.visualStoryboard, pages: task.visualStoryboard.pages.map((item) => item.pageId === pageId ? { ...item, renderStrategy: "html_css" } : item), updatedAt: now() };
  task.visualCandidates = getVisualCandidates(task).map((item) => item.pageId === pageId ? { ...item, selected: false } : item);
  task.visualWorkflowState = "candidate_selection";
  return { pageId, fallback };
}

export function visualCandidateSummary(task) {
  const set = task.visualDirectionSet;
  const candidates = getVisualCandidates(task);
  const generatedPages = list(set?.pages).filter((page) => page.renderStrategy === "generated_raster");
  const approved = candidates.filter((item) => item.selected && item.providerStatus === "succeeded" && item.qualityStatus === "approved");
  const fallbacks = list(set?.pages).filter((page) => page.fallback);
  const actualCalls = candidates.filter((item) => !item.compatibilitySource).reduce((sum, item) => sum + Number(item.attempt || 1), 0);
  const actualPaidCalls = candidates.filter((item) => item.billableCall === true).reduce((sum, item) => sum + Number(item.attempt || 1), 0);
  return {
    provider: set?.provider || null,
    model: set?.model || null,
    quality: set?.quality || null,
    estimatedCalls: set?.estimatedCalls || 0,
    actualCalls,
    actualProviderCalls: actualCalls,
    actualPaidCalls,
    paidCallAccounting: "confirmed_live_success_only",
    providerSucceeded: candidates.filter((item) => item.providerStatus === "succeeded").length,
    providerFailed: candidates.filter((item) => item.providerStatus === "failed").length,
    qualityApproved: candidates.filter((item) => item.qualityStatus === "approved").length,
    qualityPendingReview: candidates.filter((item) => item.providerStatus === "succeeded" && item.qualityStatus === "pending_review").length,
    qualityRejected: candidates.filter((item) => item.qualityStatus === "rejected").length,
    succeeded: candidates.filter((item) => item.providerStatus === "succeeded").length,
    failed: candidates.filter((item) => item.providerStatus === "failed").length,
    selected: approved.length,
    fallback: fallbacks.length,
    generatedPages: generatedPages.length,
    ready: generatedPages.every((page) => approved.some((item) => item.pageId === page.pageId))
  };
}

export function requireVisualCandidatesReady(task) {
  if (!task.visualDirectionSet) return null;
  requireConfirmedVisualDirection(task);
  const summary = visualCandidateSummary(task);
  if (!summary.ready) throw Object.assign(new Error("仍有页面缺少人工批准的候选底图；Provider 成功不等于质量通过，请逐页批准、拒绝或显式回退"), { statusCode: 409, code: "XHS_CANDIDATE_QUALITY_APPROVAL_REQUIRED", details: summary });
  return summary;
}
