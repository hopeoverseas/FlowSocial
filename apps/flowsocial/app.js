const platformContent = {
  xiaohongshu: {
    label: "小红书图文",
    mobile: "图文详情",
    title: "企业为什么需要AI员工，而不是更多AI工具？",
    body: "很多企业的问题不是缺少 AI 工具，而是工具彼此割裂、没人维护。真正有价值的 AI 员工，需要理解企业知识并进入真实业务流程。",
    tags: "#AI智能体 #AI员工 #企业数字化"
  },
  wechat: {
    label: "微信公众号文章",
    mobile: "公众号文章",
    title: "从AI工具到AI员工：企业智能体如何进入真实业务流程",
    body: "单点工具只能完成一次任务，企业智能体则需要连接知识、流程和团队协作。本文从应用场景、实施路径与风险边界三个角度展开。",
    tags: "大卖数智行业观察 · 预计阅读 6 分钟"
  },
  instagram: {
    label: "Instagram Carousel",
    mobile: "Posts",
    title: "Why businesses need AI agents, not more isolated AI tools",
    body: "The real shift is from one-off generation to AI agents that understand company knowledge and execute repeatable workflows.",
    tags: "#AIAgents #BusinessAutomation #EnterpriseAI"
  },
  facebook: {
    label: "Facebook 图文",
    mobile: "Post",
    title: "What changes when AI becomes part of the workflow?",
    body: "AI agents are moving beyond isolated tasks. Here are three practical ways teams can connect knowledge, content operations and human review.",
    tags: "Which workflow would you automate first?"
  },
  douyin: {
    label: "抖音图文/视频",
    mobile: "作品预览",
    title: "公司已经买了很多AI工具，为什么效率还是没提升？",
    body: "前三秒：工具多，不等于工作流自动化。镜头一：信息散落；镜头二：重复操作；镜头三：AI员工连接知识与流程。",
    tags: "#AI智能体 #AI工作流 #企业服务"
  },
  channels: {
    label: "微信视频号",
    mobile: "视频动态",
    title: "企业需要的不是更多AI工具，而是能执行流程的AI员工",
    body: "60 秒观点视频：解释 AI 工具、自动化流程和企业智能体的区别，以及小团队如何开始落地。",
    tags: "关联公众号：企业智能体实施路径"
  }
};

const purposeContent = {
  hotspot_industry_explainer: { label: "热点/行业解读", description: "讲清发生了什么、为什么重要，以及可能带来的影响" },
  knowledge_howto: { label: "知识干货分享", description: "提供方法、步骤、清单、工具或避坑建议" },
  professional_opinion: { label: "专业观点表达", description: "给出有依据的判断、分析和立场" },
  product_service_promotion: { label: "产品/服务推广", description: "介绍产品服务解决的问题、适用场景和价值" },
  case_result_showcase: { label: "案例/成果展示", description: "用真实案例、过程或成果证明专业能力" },
  brand_story: { label: "品牌形象宣传", description: "展示公司理念、团队、故事或品牌动态" },
  interactive_discussion: { label: "互动话题讨论", description: "通过问题、争议或共鸣点吸引用户参与" },
  event_announcement: { label: "活动/信息发布", description: "发布活动、直播、课程、报告、招聘或更新" }
};

const viewMeta = {
  agent: { title: "策略 Agent", breadcrumb: "Agent 实验 / 大卖数智 Demo" },
  today: { title: "今日陪伴", breadcrumb: "运营 Agent / 今日行动" },
  plan: { title: "内容计划", breadcrumb: "运营 Agent / 下一篇内容" },
  "artifact-review": { title: "内容生产", breadcrumb: "内容生产 / 项目" },
  review: { title: "发布与复盘", breadcrumb: "内容学习 / 发布反馈" },
  assets: { title: "资产中心", breadcrumb: "内容记忆 / 四类资产库" },
  settings: { title: "账号与设置", breadcrumb: "账号、视觉与系统能力" },
  opportunities: { title: "热点发掘&选题", breadcrumb: "内容策略 / 业务主题热点库" },
  viral: { title: "爆款拆解", breadcrumb: "创作工具 / 爆款拆解与原创重构" },
  accounts: { title: "账号中心", breadcrumb: "资产与设置 / 账号中心" },
  knowledge: { title: "知识与资产", breadcrumb: "资产与设置 / 知识与内容资产" },
  sources: { title: "来源设置", breadcrumb: "资产与设置 / 来源与供应商" },
  generate: { title: "创建多平台内容", breadcrumb: "内容生成 / 新建内容任务" }
};

const viewAliases = { opportunities: "plan", viral: "assets", generate: "artifact-review", knowledge: "assets" };

const opportunityData = {
  lifestyle: {
    title: "品牌在夏季 Campaign 中更偏爱真实生活感模特",
    summary: "生活方式、美妆与轻户外品牌正在减少标准棚拍，转向更自然、更有日常温度的场景表达。该趋势与 BlueMuse 当前模特资产及夏日品牌片计划高度匹配。"
  },
  casting: {
    title: "AI 选角工具正在改变品牌前期沟通",
    summary: "品牌方正在用结构化模卡与动态视频更快完成初筛。BlueMuse 可以从“AI 提高效率但不能替代人物判断”的角度建立专业观点。"
  },
  video: {
    title: "短视频品牌片开始回归自然光与真实互动",
    summary: "近期案例显示，自然光和真实互动正在替代过度设计的表演。该机会适合用镜头对比、拍摄方法和模特动态表现力展开。"
  },
  summer: {
    title: "夏季户外品牌进入集中选角与拍摄窗口",
    summary: "轻户外、旅行和防晒品类正在集中准备 8 月内容。适合发布档期、人物资产和场景能力，但需要明确活动有效时间。"
  }
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const { escapeHtml, asArray, parseKeywordLines, humanizeDisplayValue } = window.FlowSocialAppFoundation;
let currentPlatform = "xiaohongshu";
let accountsCache = [];
let knowledgeFoldersCache = [];
let knowledgeFilesCache = [];
let currentKnowledgeFolderId = null;
let currentAccountDesignDnaSnapshotRef = null;
let currentAccountDesignDnaSources = [];
let pendingKnowledgeFiles = [];
let currentViralAnalysisId = null;
let currentPatternAnalysisId = null;
let pendingLearningFiles = [];
let currentDirectionId = "direction_ai";
let currentHotspotPool = "global";
let currentTopicCategory = "keyword";
let topicResultsCache = [];
let selectedTopicSelection = null;
let directionsCache = [];
let currentDirectionLibrary = null;
let selectedIdeaSelection = null;
let currentGenerationMode = "idea";
let contentAgentRecommendations = [];
let selectedContentAgentRecommendation = null;
let currentContentWorkflow = null;
let currentContentTaskId = null;
let currentRevisionVersion = 3;
let currentContentTask = null;
let currentPublicationId = null;
let currentContentTrace = null;
let currentPendingRevision = null;
let customImageNames = [];
let customImagePreviews = [];
let currentHotspotPreviewId = null;
let currentSelectedHotspotId = null;
let currentPreviewItems = [];
let selectedKeywordHotspotIds = [];
let selectedGlobalHotspotIds = [];
let hotspotLibraryCache = [];
let editingDirectionId = null;
let agentOverviewCache = null;
let agentModelTurnState = null;
let currentAgentSessionId = null;
let currentAgentStrategyDraft = null;
let currentAgentDraftRevision = null;
let currentAgentRecommendationId = null;
let currentAgentDraftReadiness = null;
let currentAgentEditFieldPath = null;
let currentAgentStrategyDecision = null;
let currentAgentStrategyAccountCatalog = [];
let agentAccountsCache = [];
let currentAgentAccountId = localStorage.getItem("flowsocial.agentAccountId") || "account_damaishuzhi";
let contentPlanningGate = null;

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 1800);
}

const writeKeywordLines = (selector, items = []) => { $(selector).value = (items || []).join("\n"); };

function directionProfileFromForm() {
  const coreKeywords = parseKeywordLines($("#coreKeywordsInput").value);
  const platformKeywords = parseKeywordLines($("#platformKeywordsInput").value);
  const scenarioKeywords = parseKeywordLines($("#scenarioKeywordsInput").value);
  const excludeKeywords = parseKeywordLines($("#excludeKeywordsInput").value);
  return {
    name: $("#directionNameInput").value.trim(), description: $("#directionDescriptionInput").value.trim(),
    coreKeywords, platformKeywords, scenarioKeywords, excludeKeywords,
    searchKeywords: [...new Set([...coreKeywords, ...platformKeywords, ...scenarioKeywords])]
  };
}

function openDirectionDialog(direction = null) {
  editingDirectionId = direction?.id || null;
  $("#directionDialogTitle").textContent = direction ? "编辑关注主题" : "新建关注主题";
  $("#directionNameInput").value = direction?.name || "";
  $("#directionDescriptionInput").value = direction?.description || "";
  writeKeywordLines("#coreKeywordsInput", direction?.coreKeywords || direction?.keywords || []);
  writeKeywordLines("#platformKeywordsInput", direction?.platformKeywords || []);
  writeKeywordLines("#scenarioKeywordsInput", direction?.scenarioKeywords || []);
  writeKeywordLines("#excludeKeywordsInput", direction?.excludeKeywords || []);
  $("#keywordGenerationStatus").textContent = direction ? "可重新生成后再编辑" : "输入主题后生成";
  $("#directionDialog").showModal();
}

function activeHotspotCompanyId() {
  return v2AccountRecord()?.companyId || currentAgentAccountId || "account_damaishuzhi";
}

async function loadHotspotLibrary() {
  const result = await window.FlowAPI.getHotspotLibrary("", "", "active", activeHotspotCompanyId());
  const items = result.items || [];
  hotspotLibraryCache = items;
  $("#hotspotLibraryCount").textContent = `${items.length} 个有效热点`;
  $("#hotspotLibraryTags").innerHTML = (result.groups || []).map((group, index) => `<details class="hotspot-library-group" ${index === 0 ? "open" : ""}><summary>${escapeHtml(group.label)} <span>${group.count} 个</span></summary><div>${(group.items || []).map((item) => `<button class="${selectedKeywordHotspotIds.includes(item.id) || selectedGlobalHotspotIds.includes(item.id) ? "selected" : ""}" data-library-hotspot="${item.id}" data-pool-type="${item.poolType}" data-direction-id="${item.directionId || ""}" title="${escapeHtml(item.summary || "")}"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.relevanceTier || "待复核")} · ${escapeHtml(item.providerMode || item.providerTrace?.mode || "unknown")}</small></button>`).join("") || `<span class="empty-state">暂无热点</span>`}</div></details>`).join("") || `<div class="empty-state">尚未采集热点。</div>`;
  renderSelectedTopicHotspots();
}

function renderSelectedTopicHotspots() {
  const selectedIds = [...selectedKeywordHotspotIds, ...selectedGlobalHotspotIds];
  const selected = selectedIds.map((id) => hotspotLibraryCache.find((item) => item.id === id)).filter(Boolean);
  $("#selectedTopicHotspots span").innerHTML = selected.length
    ? selected.map((item) => `<b>${item.poolType === "global" ? "全网" : "主题"} · ${escapeHtml(item.title)}</b>`).join("")
    : "尚未选择用于生成选题的热点";
}

async function openTopicHotspotPicker() {
  const result = await window.FlowAPI.getHotspotLibrary("", "", "active", currentAgentAccountId || "account_damaishuzhi");
  hotspotLibraryCache = result.items || [];
  const keywordItems = hotspotLibraryCache.filter((item) => item.poolType === "keyword" && item.directionId === currentDirectionId);
  const globalItems = hotspotLibraryCache.filter((item) => item.poolType === "global");
  const fusion = currentTopicCategory === "cross_trend";
  $("#topicPickerEyebrow").textContent = fusion ? "推荐结合选题" : "关键词热点直接生成";
  $("#topicPickerTitle").textContent = fusion ? "分别选择领域热点和全网热点" : "选择当前主题的关键词热点";
  $("#topicPickerDescription").textContent = fusion ? "必须至少选择一条领域热点和一条全网热点；系统只在这些证据之间寻找真实交集。" : "可多选；生成结果只引用所选热点及其证据。";
  const choiceGroup = (title, poolType, items, selectedIds) => `<section class="topic-picker-group"><h3>${title} <span>${items.length}</span></h3>${items.map((item) => `<label><input type="checkbox" data-pool-type="${poolType}" value="${item.id}" ${selectedIds.includes(item.id) ? "checked" : ""}/><span><strong>${escapeHtml(item.title)}</strong><small>热点分 ${item.score ?? "--"} · 相关性 ${item.relevanceScore ?? "--"} · ${item.sourceCount || 0}个来源</small></span></label>`).join("") || `<div class="empty-state">当前分类暂无可用热点</div>`}</section>`;
  $("#topicHotspotChoices").innerHTML = choiceGroup("当前主题关键词热点", "keyword", keywordItems, selectedKeywordHotspotIds) + (fusion ? choiceGroup("无关键词全网热点", "global", globalItems, selectedGlobalHotspotIds) : "");
  $("#topicHotspotDialog").showModal();
}

// Runtime status UI is loaded from ui/runtime-status.js.

window.addEventListener("flow:api-error", (event) => {
  const requestId = event.detail?.requestId ? ` · 请求 ${event.detail.requestId}` : "";
  const status = Number(event.detail?.status || 0);
  const path = String(event.detail?.path || "");
  // Delivery state is intentionally unavailable until the user has selected
  // an exact WeChat version. That 409 is a local workflow state, not a broken
  // backend/configuration signal, so it must not replace the global runtime
  // health banner.
  if (status === 409 && path.includes("/wechat/delivery")) return;
  if (path.includes("/design-dna/analyze")) {
    setRuntimeBanner("notice", "品牌风格识别未完成", `${event.detail?.message || "视觉识别服务暂时不可用"}${requestId}。已上传资料仍然保留，可以直接重新识别。`);
    return;
  }
  const isBusinessPrecondition = status >= 400 && status < 500;
  setRuntimeBanner(
    isBusinessPrecondition ? "notice" : "error",
    isBusinessPrecondition ? "需要完成前置设置" : "真实接口请求失败",
    `${event.detail?.message || "未知错误"}${requestId}`
  );
});

function updatePreview(platform) {
  currentPlatform = platform;
  const content = platformContent[platform];
  $("#previewPlatform").textContent = content.label;
  $("#mobilePlatformName").textContent = content.mobile;
  $("#previewTitle").textContent = content.title;
  $("#previewBody").textContent = content.body;
  $(".preview-tags").textContent = content.tags;
  $("#phoneFrame").dataset.platform = platform;
}

$("#accountSelect")?.addEventListener("change", (event) => {
  const account = accountsCache.find((item) => item.id === event.target.value);
  const scoreRows = $$(".opportunity-card .score-row span");
  if (account && scoreRows[1]) scoreRows[1].textContent = account.name;
  if (account) $("#activeStyleName").textContent = `${account.name} · ${account.visualStyle?.name || "账号视觉系统"}`;
  if (account) {
    const company = accountsCache.find((item) => item.id === account.companyId) || agentAccountsCache.find((item) => item.id === account.companyId);
    $("#generationOwnershipContext").textContent = `当前公司：${account.companyName || company?.name || account.companyId || "待确认"} · 当前账号：${account.name}`;
    loadGenerationKnowledgeAssets();
    v2Workspace.plan = null;
    v2Workspace.cycle = null;
    v2Workspace.rollingPlan = null;
    v2Workspace.accountSelection = null;
    if ($("#v2CycleStart")) $("#v2CycleStart").value = "";
    if ($("#v2PlanPlatform")) {
      $("#v2PlanPlatform").value = "matrix";
      $("#v2PlanPlatform").disabled = true;
    }
    if (document.querySelector('[data-view="plan"]')?.classList.contains("active")) loadV2Plan(true);
    if (unifiedArtifactWorkbench?.enabled) loadUnifiedArtifactReviewProjects({ preserveSelection: false });
    refreshContentPlanningGate(account.companyId).catch((error)=>showToast("策略交接状态检查失败："+error.message));
  }
});

function switchView(view) {
  view = viewAliases[view] || view;
  if (view === "artifact-review" && !unifiedArtifactWorkbench?.enabled) view = "today";
  const meta = viewMeta[view];
  if (!meta) return;
  document.body.dataset.currentView = view;
  $$(".app-view").forEach((section) => section.classList.toggle("active", section.dataset.view === view));
  const strategyView = document.querySelector('[data-view="agent"]');
  if (strategyView) strategyView.hidden = view !== "agent";
  $$(".nav-item[data-view-target]").forEach((button) => button.classList.toggle("active", button.dataset.viewTarget === view));
  $("#pageTitle").textContent = meta.title;
  $("#pageBreadcrumb").textContent = meta.breadcrumb;
  $("#generateActions").style.display = "none";
  if (view === "accounts") loadAccounts();
  if (view === "knowledge") loadKnowledge();
  if (view === "opportunities") loadDirections();
  if (view === "generate") loadGenerationAccounts();
  if (view === "sources") loadSources();
  if (view === "agent") loadAgentWorkspace();
  if (view === "viral") loadContentLearning();
  loadV2View(view);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

const v2Workspace = {
  history: null,
  feedback: null,
  strategyAdjustments: null,
  plan: null,
  cycle: null,
  rollingPlan: null,
  assetTab: "knowledge",
  feedbackTask: null,
  metricImportBatch: null,
  reviewFilter: "all",
  accountSelection: null
};

function v2AccountId() {
  return v2Workspace.accountSelection?.socialAccountId || $("#accountSelect")?.value || currentAgentAccountId || "account_damaishuzhi";
}

function v2AccountRecord() {
  return accountsCache.find((item) => item.id === v2AccountId()) || null;
}

function v2SelectionPayload() {
  const account = v2AccountRecord();
  return account ? { workspaceId: account.workspaceId || "workspace_default", companyId: account.companyId, socialAccountId: account.id, accountId: account.id, selectionSource: v2Workspace.accountSelection?.selectionSource || "user_confirmed" } : {};
}

function renderV2AccountChoice(readiness, message = "多账号矩阵需要先明确本次内容归属") {
  const readyAccounts = asArray(readiness?.accounts).filter((item) => item.ready);
  $("#v2PlanningContext").innerHTML = `<dl><div><dt>本次发布账号</dt><dd>尚未选择</dd></div><div><dt>选择规则</dt><dd>每个统一内容项目只绑定一个具体社媒账号</dd></div></dl>`;
  $("#v2DirectionCards").innerHTML = `<div class="v2-readiness-card"><strong>${escapeHtml(message)}</strong><small>切换只影响当前内容任务，不会修改公司的长期策略或其他账号。</small><label>具体社媒账号<select id="v2PlanAccountChoice"><option value="">请选择账号</option>${readyAccounts.map((item) => `<option value="${escapeHtml(item.socialAccountId)}">${escapeHtml(item.name)} · ${v2PlatformLabel(item.platform)}</option>`).join("")}</select></label></div>`;
}

function v2KnowledgeOwnership() {
  const account = v2AccountRecord();
  return {
    workspaceId: account?.workspaceId || "workspace_default",
    companyId: account?.companyId || currentAgentAccountId || "account_damaishuzhi"
  };
}

const strategyHandoffCopy = {
  start_strategy_diagnosis: ["尚未开始策略诊断", "先完成业务诊断，内容 Agent 暂不会读取对话中的未确认信息。"],
  continue_strategy_diagnosis: ["策略诊断尚未达到最低门槛", "继续补齐当前阻断项后，再确认账号身份和增长打法。"],
  confirm_strategy_decisions: ["业务诊断完成，等待确认账号打法", "这一步只是确认账号身份和增长打法，确认后仍需生成并激活策略草案。"],
  generate_strategy_draft: ["账号打法已确认，尚未生成策略草案", "点击生成策略草案；此时内容 Agent 仍不会接收策略。"],
  regenerate_strategy_draft: ["策略草案已过期", "诊断信息已变化，请重新生成草案后再激活。"],
  activate_strategy_draft: ["策略草案已生成，等待激活", "请审阅草案并确认激活；激活后才会生成内容 Agent 可读取的不可变快照。"],
  resolve_strategy_blockers: ["策略仍有阻断项", "请按草案区域显示的具体原因处理后再激活。"],
  open_content_planning: ["策略已激活，可以交接内容 Agent", "活动策略快照已就绪，内容计划会绑定此快照和对应账号打法。"],
  create_rolling_plan: ["策略已激活，可以交接内容 Agent", "活动策略快照已就绪，可以生成滚动内容计划。"],
  update_strategy_account_decisions: ["活动策略的账号配置不完整", "请返回策略 Agent 补齐账号身份、增长打法或纳入运营的账号。"]
};

function renderStrategyHandoffState(state = null, readiness = null) {
  const action = readiness?.nextAction || state?.nextAction || { type: "continue_strategy_diagnosis", target: "agent", label: "继续策略诊断" };
  const copy = strategyHandoffCopy[action.type] || ["策略尚未完成交接", asArray(readiness?.blockers).map((item) => item.message).join("；") || "请完成策略 Agent 当前步骤。"];
  const ready = ["open_content_planning", "create_rolling_plan"].includes(action.type) && readiness?.ready !== false;
  const panel = $("#agentHandoffStatus");
  if (panel) {
    panel.dataset.state = ready ? "ready" : readiness?.blockers?.length ? "blocked" : "diagnosis";
    $("#agentHandoffTitle").textContent = copy[0];
    $("#agentHandoffDetail").textContent = copy[1];
    const button = $("#agentHandoffAction");
    button.dataset.handoffAction = action.type;
    button.textContent = action.label || (ready ? "进入内容计划" : "继续处理");
  }
  renderStrategyTracks(readiness?.strategySessionState || state, readiness);
}

function renderStrategyTracks(state = null, readiness = null) {
  const active=state?.activeStrategyTrack || readiness?.activeStrategyTrack || null;
  const editing=state?.editingSessionTrack || readiness?.editingSessionTrack || null;
  const activeTitle=$("#agentActiveTrackTitle");
  if(!activeTitle||(!active&&!editing))return;
  activeTitle.textContent=active?.exists ? `策略 v${active.version || "-"} 正在生效` : "尚未激活策略";
  $("#agentActiveTrackDetail").textContent=active?.exists ? "它会继续服务内容计划，直到你确认并激活新版本。" : "内容 Agent 只读取已确认并激活的策略快照。";
  const activeButton=$("#agentUseActiveStrategy");
  activeButton.hidden=!active?.exists;
  const processed=editing?.readiness?.processed ?? state?.readiness?.core?.processed ?? 0;
  const total=editing?.readiness?.total ?? state?.readiness?.core?.total ?? 9;
  $("#agentEditingTrackTitle").textContent=editing ? `新诊断已处理 ${processed}/${total}` : "尚未开始";
  $("#agentEditingTrackDetail").textContent=editing ? `${editing.nextAction?.label || "继续编辑"}；在新版本激活前不会替换上方策略。` : "开始新诊断不会自动停用现有策略。";
}

function setContentPlanningGate(readiness) {
  contentPlanningGate = readiness || null;
  const blocked = Boolean(readiness && !readiness.ready);
  for (const view of ["plan", "runs"]) {
    const button = $(`.nav-item[data-view-target="${view}"]`);
    button?.classList.toggle("handoff-blocked", blocked);
    if (button) button.title = blocked ? `${readiness.nextAction?.label || "先完成策略"}后才能进入` : "";
  }
  renderStrategyHandoffState(readiness?.strategySessionState, readiness);
}

async function refreshContentPlanningGate(companyId = null) {
  const account = v2AccountRecord();
  const resolvedCompanyId = companyId || account?.companyId || (agentAccountsCache.some((item) => item.id === currentAgentAccountId) ? currentAgentAccountId : null);
  if (!resolvedCompanyId || window.FlowAPI.mode !== "live") return null;
  const readiness = await window.FlowAPI.getContentPlanningReadiness(resolvedCompanyId);
  setContentPlanningGate(readiness);
  return readiness;
}

async function navigateToView(view) {
  const canonical = viewAliases[view] || view;
  if (["plan", "runs"].includes(canonical)) {
    try {
      const readiness = await refreshContentPlanningGate();
      if (readiness && !readiness.ready) {
        switchView("agent");
        showToast(`${readiness.nextAction?.label || "完成并激活策略"}后才能进入内容 Agent`);
        return false;
      }
    } catch (error) {
      showToast(`无法核对策略交接状态：${error.message}`);
      return false;
    }
  }
  switchView(canonical);
  return true;
}

function planProjectionForAccount(rollingPlan, socialAccountId) {
  const items = (rollingPlan?.items || []).filter((item) => item.socialAccountId === socialAccountId);
  return {
    inputMode: "rolling_plan",
    rollingPlanId: rollingPlan?.id || null,
    strategySnapshotId: rollingPlan?.strategySnapshotId || null,
    strategySnapshotVersion: rollingPlan?.strategyVersion || null,
    windowDays: rollingPlan?.windowDays || null,
    startsAt: rollingPlan?.startsAt || null,
    endsAt: rollingPlan?.endsAt || null,
    objective: rollingPlan?.objective || null,
    recommendations: items.map((item) => ({
      ...item.recommendation,
      rollingPlanId: rollingPlan.id,
      rollingPlanItemId: item.id,
      sequence: item.sequence,
      planStatus: item.status,
      contentFunction: item.contentFunction,
      contentPillar: item.contentPillar,
      topic: item.topic,
      reason: item.rationale
    }))
  };
}

function compactCycleTopic(slot = {}) {
  const raw = String(slot.topic || "").replace(/\s+/g, " ").trim();
  if (slot.zone === "buffer" || slot.state === "buffer") return raw || "突发选题预留位";
  if (slot.nextCyclePortfolioRef && raw) return raw;
  const sentenceMarks = (raw.match(/[。！？；]/g) || []).length;
  if (raw && raw.length <= 48 && sentenceMarks <= 1) return raw;
  const pillar = String(slot.contentPillarId || slot.contentPillar || "核心业务主题").split(/[。！？；：]/)[0].trim().slice(0, 18) || "核心业务主题";
  return ({
    discovery: `${pillar}最容易忽略的关键问题`,
    authority: `${pillar}怎么做：一套可执行方法`,
    proof: `${pillar}真实案例：如何验证实际效果`,
    solution: `${pillar}应用指南：从问题判断到方案选择`,
    action: `${pillar}下一步行动清单`
  })[slot.contentFunction] || `${pillar}：一个值得验证的内容方向`;
}

function cycleWorkbenchProjection(cycle) {
  return {
    inputMode: "publishing_cycle",
    cycleId: cycle.cycleId,
    cycle,
    strategySnapshotId: cycle.strategySnapshotId,
    strategySnapshotVersion: cycle.strategyVersion,
    windowDays: cycle.cadenceRange?.windowDays,
    objective: cycle.objective,
    recommendations: (cycle.slots || []).map((slot) => {
      const topic = compactCycleTopic(slot);
      return {
        ...slot,
        cycleId: cycle.cycleId,
        cycleSlotId: slot.slotId,
        planStatus: slot.contentRunId ? "in_progress" : slot.zone,
        topic,
        reason: slot.objective,
        contentPillar: slot.contentPillarId || slot.contentPillar,
        generationPayload: { platform: slot.platform, ideaTitle: topic },
        sourcePlan: { mode: slot.requiredEvidenceIds?.length ? "frozen_evidence" : "cycle_slot", rationale: slot.evidenceRequirements || [] }
      };
    })
  };
}

function v2PlatformLabel(platform) {
  return platform === "matrix" ? "账号矩阵（小红书 + 公众号）" : platform === "wechat" ? "公众号" : platform === "xiaohongshu" ? "小红书" : platform || "未设置";
}

const v2GrowthPlaybookLabels = {
  "xhs-company-vertical-cold-start": "小红书企业垂直专业冷启动",
  "xhs-company-hybrid-cold-start": "小红书热点与垂直混合冷启动",
  "xhs-hotspot-experiment": "小红书受控热点实验冷启动",
  "wechat-enterprise-authority": "公众号企业权威与线索经营",
  "wechat-founder-expert-ip": "公众号创始人或专家 IP 经营",
  "wechat-search-asset": "公众号搜索与内容资产经营",
  "wechat-stable-columns": "公众号稳定栏目起号",
  "stable-account-portfolio": "稳定账号内容组合优化"
};

function v2GrowthPlaybookLabel(id) {
  return v2GrowthPlaybookLabels[id] || "已确认的账号打法";
}

function v2CycleNotice(item) {
  const raw = item?.message || item?.description || item?.code || item || "";
  if (item?.code === "PLATFORM_QUOTA_CONFLICT") {
    const requested = Number(item.requestedItems);
    const deliverable = Number(item.deliverableItems);
    if (Number.isFinite(requested) && Number.isFinite(deliverable)) {
      return `本周期建议 ${requested} 条，超过账号当前建议产能 ${deliverable} 条；仍可按排期逐条制作。`;
    }
    return "本周期建议数量超过账号当前建议产能；仍可按排期逐条制作。";
  }
  if (/exceeds the account's currently confirmed platform capability/i.test(String(raw))) return "本周期建议数量超过账号当前建议产能；仍可按排期逐条制作。";
  return String(raw);
}

function v2Date(value) {
  if (!value) return "尚未记录";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "尚未记录" : date.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}

function v2Metric(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : "样本不足";
}

async function loadV2View(view) {
  if (view === "today") await loadV2Today();
  if (view === "plan") await loadV2Plan();
  if (view === "artifact-review") await loadUnifiedArtifactReviewProjects();
  if (view === "review") await loadV2Review();
  if (view === "assets") await loadV2Assets(v2Workspace.assetTab);
  if (view === "settings") await loadV2Settings();
}

async function loadV2Today() {
  const actionList = $("#todayActionList");
  if (!actionList) return;
  const [historyResult, feedbackResult, overviewResult] = await Promise.allSettled([
    window.FlowAPI.getContentHistory(v2AccountId()),
    window.FlowAPI.getContentFeedback({ accountId: v2AccountId() }),
    window.FlowAPI.getAgentOverview(currentAgentAccountId)
  ]);
  v2Workspace.history = historyResult.status === "fulfilled" ? historyResult.value : { items: [], pillarCoverage: [] };
  v2Workspace.feedback = feedbackResult.status === "fulfilled" ? feedbackResult.value : { outcomes: [], learningSignals: [] };
  const overview = overviewResult.status === "fulfilled" ? overviewResult.value : null;
  const items = v2Workspace.history.items || [];
  const outcomes = v2Workspace.feedback.outcomes || [];
  const unpublished = items.filter((item) => !item.publication);
  const withoutMetrics = outcomes.filter((item) => !item.metrics);
  const stage = overview?.strategySnapshot?.payload?.accountStrategy?.growthStage || overview?.strategyDocument?.payload?.accountStrategy?.growthStage || "持续运营阶段";
  $("#todayAgentSummary").textContent = items.length ? `已经沉淀 ${items.length} 篇内容；今天优先处理确认、发布和反馈，而不是盲目增加产量。` : "当前还没有内容历史，建议从第一组方向卡和7天内容节奏开始。";
  $("#todayStrategyName").textContent = overview?.strategySnapshot?.name || overview?.activeStrategySnapshot?.name || "当前活动策略";
  $("#todayStrategyMeta").textContent = `${stage} · ${overview?.strategySnapshot?.version || overview?.activeStrategySnapshot?.version || "活动版本"}`;
  const actions = [
    { kind: "计划", title: items.length ? "补齐本周内容支柱缺口" : "确定第一篇内容方向", detail: "Agent 会结合策略与可用素材推荐，不要求先选择热点或知识库", target: "plan", tone: "green" },
    ...(unpublished.length ? [{ kind: "发布", title: `${unpublished.length} 篇内容尚未记录发布`, detail: "确认是否采用、何时发布，并保留版本归因", target: "review", tone: "coral" }] : []),
    ...(withoutMetrics.length ? [{ kind: "反馈", title: `${withoutMetrics.length} 篇已发布内容等待数据`, detail: "到达观察窗口后一次补录，不需要每天填写", target: "review", tone: "blue" }] : [])
  ].slice(0, 3);
  actionList.innerHTML = actions.map((item, index) => `<button class="daily-action-row" data-jump="${item.target}"><span class="action-number ${item.tone}">${String(index + 1).padStart(2, "0")}</span><div><small>${item.kind}</small><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.detail)}</p></div><b>→</b></button>`).join("");
  $("#todayRhythmMetrics").innerHTML = `<article><strong>${items.length}</strong><span>累计内容</span></article><article><strong>${unpublished.length}</strong><span>待发布</span></article><article><strong>${outcomes.length}</strong><span>已记录发布</span></article>`;
  const coverage = v2Workspace.history.pillarCoverage || [];
  const max = Math.max(1, ...coverage.map((item) => item.count));
  $("#todayPillarCoverage").innerHTML = coverage.length ? coverage.slice(0, 5).map((item) => `<div><span>${escapeHtml(item.pillar)}</span><i><b style="width:${Math.max(12, item.count / max * 100)}%"></b></i><em>${item.count}</em></div>`).join("") : `<div class="empty-state">完成第一批内容后，这里会显示内容支柱覆盖。</div>`;
  $("#todayDecisionQueue").innerHTML = `<div class="empty-state">统一内容项目中的待确认事项会显示在内容生产工作台。</div>`;
  $("#todayFeedbackReminders").innerHTML = withoutMetrics.length ? withoutMetrics.slice(0, 3).map((item) => `<button class="feedback-reminder" data-jump="review"><div><strong>${escapeHtml(item.title || "已发布内容")}</strong><small>${v2PlatformLabel(item.platform)} · ${item.measurementWindow || "等待观察窗口"}</small></div><span>补数据</span></button>`).join("") : `<div class="empty-state">暂无待回填数据。</div>`;
}

async function loadV2Plan(force = false) {
  const container = $("#v2DirectionCards");
  if (!container) return;
  if (!force && v2Workspace.plan?.recommendations?.length) return renderV2Plan(v2Workspace.plan);
  container.innerHTML = `<div class="v2-skeleton">Agent 正在核对策略、历史重复和素材可用性…</div>`;
  try {
    if (!accountsCache.length) await loadGenerationAccounts();
    let account = v2AccountRecord();
    const companyId = account?.companyId;
    if (companyId) {
      const readiness = await window.FlowAPI.getContentPlanningReadiness(companyId);
      setContentPlanningGate(readiness);
      const readyAccounts = asArray(readiness.accounts).filter((item) => item.ready);
      if (!readiness.ready) {
        const reasons = asArray(readiness.blockers).map((item) => item.message).join("；");
        container.innerHTML = `<div class="v2-readiness-card"><strong>当前公司还不能生成内容计划</strong><small>${escapeHtml(reasons || "请先完成并激活新版策略")}</small><button class="btn primary" data-jump="agent">${escapeHtml(readiness.nextAction?.label || "返回策略 Agent 继续处理")}</button></div>`;
        return;
      }
      if (readyAccounts.length === 1 && !v2Workspace.accountSelection) {
        v2Workspace.accountSelection = { socialAccountId: readyAccounts[0].socialAccountId, selectionSource: "single_account_default" };
      } else if (readyAccounts.length > 1 && !v2Workspace.accountSelection?.socialAccountId) {
        const current = readyAccounts.find((item) => item.socialAccountId === account?.id);
        if (current) v2Workspace.accountSelection = { socialAccountId: current.socialAccountId, selectionSource: "user_confirmed" };
        else { renderV2AccountChoice(readiness); return; }
      }
      account = v2AccountRecord();
      if (!readyAccounts.some((item) => item.socialAccountId === account?.id)) {
        renderV2AccountChoice(readiness, "请选择当前活动策略中的社媒账号");
        return;
      }
    }
    if (account?.platform) { $("#v2PlanPlatform").value = "matrix"; $("#v2PlanPlatform").disabled = true; }
    const [cycles, strategyAdjustments] = account?.companyId ? await Promise.all([
      window.FlowAPI.getPublishingCycles({ companyId: account.companyId }),
      window.FlowAPI.getStrategyAdjustments({ companyId: account.companyId, socialAccountId: account.id })
        .catch((error) => ({ candidates: [], decisions: [], bindings: [], loadError: error.message }))
    ]) : [{ items: [], legacyPlans: [] }, { candidates: [], decisions: [], bindings: [] }];
    v2Workspace.strategyAdjustments = strategyAdjustments;
    prepareV2CycleStart(cycles.items || []);
    const cycle = (cycles.items || []).sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)))[0] || null;
    if (cycle) {
      v2Workspace.cycle = cycle;
      v2Workspace.rollingPlan = null;
      v2Workspace.plan = cycleWorkbenchProjection(cycle);
      return renderV2Plan(v2Workspace.plan);
    }
    v2Workspace.cycle = null;
    const existing = { items: cycles.legacyPlans || [] };
    const rollingPlan = (existing.items || []).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0] || null;
    if (rollingPlan) {
      v2Workspace.rollingPlan = rollingPlan;
      v2Workspace.plan = planProjectionForAccount(rollingPlan, v2AccountId());
    } else {
      v2Workspace.rollingPlan = null;
      v2Workspace.plan = {
        inputMode: "schedule_empty",
        recommendations: [],
        strategySnapshotId: contentPlanningGate?.strategySnapshotId || null,
        strategyProfile: contentPlanningGate?.strategyProfile || null
      };
    }
    renderV2Plan(v2Workspace.plan);
  } catch (error) {
    container.innerHTML = `<div class="v2-error"><strong>暂时无法生成方向</strong><p>${escapeHtml(error.message)}</p><button class="btn secondary" id="v2RetryPlan">重新尝试</button></div>`;
  }
}

async function createV2RollingPlan() {
  const container = $("#v2DirectionCards");
  const button = $("#v2RefreshPlan");
  const account = v2AccountRecord();
  if (!account?.companyId) return showToast("请先选择一个具体社媒账号");
  const readiness=await window.FlowAPI.getContentPlanningReadiness(account.companyId);
  setContentPlanningGate(readiness);
  if(!readiness.ready){const reasons=asArray(readiness.blockers).map((item)=>item.message).join("；");if(container)container.innerHTML=`<div class="v2-readiness-card"><strong>内容计划尚未就绪</strong><small>${escapeHtml(reasons)}</small><button class="btn primary" data-jump="agent">去完成新版策略</button></div>`;return showToast(reasons||"请先完成新版策略");}
  const companyAccountIds = readiness.accounts.filter((item)=>item.ready).map((item)=>item.socialAccountId);
  if (button) { button.disabled = true; button.textContent = "正在生成计划…"; }
  if (container) container.innerHTML = `<div class="v2-skeleton">Agent 正在计算账号矩阵分工、内容职能缺口和可用来源…</div>`;
  try {
    v2Workspace.strategyAdjustments = await window.FlowAPI.getStrategyAdjustments({ companyId: account.companyId, socialAccountId: account.id })
      .catch((error) => { throw new Error(`无法读取已审批的策略调整：${error.message}`); });
    const cycleStart = String($("#v2CycleStart")?.value || "").trim();
    if (!cycleStart) throw new Error("请选择新周期开始日期");
    const cycle = await window.FlowAPI.createPublishingCycle({
      companyId: account.companyId,
      socialAccountIds: companyAccountIds,
      cycleStart,
      cycleDays: Number($("#v2PlanWindow")?.value || 7),
      freezeDays: Math.min(7, Number($("#v2PlanWindow")?.value || 7)),
      itemsPerAccount: 3,
      strategyAdjustmentDecisionIds: asArray(v2Workspace.strategyAdjustments?.decisions)
        .filter((item) => item.resolution === "approved_for_next_cycle"
          && !asArray(v2Workspace.strategyAdjustments?.bindings).some((binding) => binding.decisionRef?.id === item.id))
        .map((item) => item.id)
    });
    v2Workspace.cycle = cycle;
    v2Workspace.rollingPlan = null;
    v2Workspace.plan = cycleWorkbenchProjection(cycle);
    renderV2Plan(v2Workspace.plan);
    showToast(`周期草案已准备，共 ${cycle.slots.filter((item) => item.zone !== "buffer").length} 个计划槽位；确认近期承诺区后才能启动`);
  } catch (error) {
    if (container) container.innerHTML = `<div class="v2-error"><strong>周期计划生成失败</strong><p>${escapeHtml(error.message)}</p></div>`;
  } finally {
    if (button) { button.disabled = false; button.textContent = "生成新周期计划"; }
  }
}
async function openUnifiedPlatformProductionEntry(platform = "xiaohongshu", { topic = "", accountId = "", entryId = "", projectId = "" } = {}) {
  const selectedPlatform = platform === "wechat" ? "wechat" : "xiaohongshu";
  unifiedArtifactWorkbench.platformScope = selectedPlatform;
  await loadUnifiedProductionEntryOptions({ refreshBootstrap: false });
  const normalizedTopic = String(topic || "").trim();
  const matches = unifiedArtifactWorkbench.entryOptions.filter((entry) => {
    const topicMatches = normalizedTopic && String(entry.topicIntent?.topic || "").trim() === normalizedTopic;
    const accountMatches = accountId && entry.accounts?.[selectedPlatform]?.id === accountId;
    return topicMatches || accountMatches;
  });
  const selected = entryId
    ? unifiedArtifactWorkbench.entryOptions.find((entry) => entry.id === entryId) || null
    : matches.length === 1 ? matches[0] : null;
  unifiedArtifactWorkbench.selectedEntryOptionId = selected?.id || "";
  unifiedArtifactWorkbench.bootstrap = null;
  unifiedArtifactWorkbench.outlineConfirmations = {};
  unifiedArtifactWorkbench.bootstrapRequest = null;
  const authority = $("#unifiedProductionAuthority");
  if (authority) authority.value = selected?.id || "";
  const projectField = $("#unifiedProductionProjectId");
  if (projectField) projectField.value = selected ? projectId || unifiedProductionProjectId(selected) : "";
  switchView("artifact-review");
  setContentProductionMode("create");
  if (selected && projectField?.value) await refreshUnifiedProductionBootstrap();
  else renderUnifiedProductionEntry();
  const platformName = selectedPlatform === "wechat" ? "公众号" : "小红书";
  showToast(selected
    ? `已打开${platformName}工作区；大纲生成可直接开始`
    : `新建${platformName}任务；请先选择当前平台的权威输入`);
  return { routedToUnifiedProduction: true, selectedEntryOptionId: selected?.id || null };
}

async function openUnifiedXhsProductionEntry(options = {}) {
  return openUnifiedPlatformProductionEntry("xiaohongshu", options);
}

async function launchV2Opportunity(opportunity, userRequest = {}) {
  if (!unifiedArtifactWorkbench?.enabled) throw new Error("统一内容工作台尚未启用");
  if (asArray(userRequest?.userMaterials).length) throw new Error("临时素材需要先录入知识资产，才能作为可追踪引用进入统一内容项目");
  const adopted = await window.FlowAPI.adoptContentOpportunity(opportunity.id, { actor: "workspace_user", userRequest });
  await openUnifiedPlatformProductionEntry(opportunity.platform, {
    entryId: adopted.entry?.id,
    projectId: adopted.projectId,
    topic: opportunity.topic,
    accountId: opportunity.socialAccountId || opportunity.accountId
  });
  await startUnifiedProduction();
  return { routedToUnifiedProduction: true, projectId: adopted.projectId, entry: adopted.entry };
}

async function createV2QuickOpportunity() {
  const topic = $("#v2QuickTopic")?.value.trim();
  const evidence = $("#v2QuickEvidence")?.value.trim();
  const platform = $("#v2QuickPlatform")?.value || "xiaohongshu";
  const currentAccount = v2AccountRecord();
  const account = accountsCache.find((item) => item.platform === platform && (!currentAccount?.companyId || item.companyId === currentAccount.companyId))
    || accountsCache.find((item) => item.platform === platform);
  if (!topic) return showToast("请先输入本篇内容主题");
  if (!account?.companyId) return showToast(`请先配置可用的${v2PlatformLabel(platform)}账号`);
  const button = $("#v2CreateQuickOpportunity");
  if (button) { button.disabled = true; button.textContent = "正在准备…"; }
  try {
    v2Workspace.accountSelection = { socialAccountId: account.id, selectionSource: "user_confirmed" };
    const globalAccountSelect = $("#accountSelect");
    if (globalAccountSelect) globalAccountSelect.value = account.id;
    const opportunity = await window.FlowAPI.createContentOpportunity({ companyId: account.companyId, socialAccountId: account.id, platform: account.platform, sourceType: "user_brief", topic, contentPurposeId: $("#v2QuickPurpose")?.value || "knowledge_howto", preferredSourceMode: "auto" });
    const userMaterials = evidence ? [{ id: `user_material_${Date.now()}`, type: "text", name: "本次临时公开素材", text: evidence, usage: "usable", visibility: "publishable", userConfirmed: true, sourceType: "user_temporary_material" }] : [];
    await launchV2Opportunity(opportunity, { userMaterials });
    showToast("临时主题已进入统一内容任务，并生成了待确认大纲");
  } catch (error) {
    showToast(`创建内容机会失败：${error.message}`);
  } finally {
    if (button) { button.disabled = false; button.textContent = "创建并生成大纲"; }
  }
}

function renderV2Plan(plan) {
  const recommendations = plan.recommendations || [];
  if (plan.inputMode === "publishing_cycle" && plan.cycle) {
    $("#v2DirectionCards")?.classList.add("cycle-workbench");
    return renderCycleWorkbench(plan);
  }
  $("#v2DirectionCards")?.classList.remove("cycle-workbench");
  const legacyReadOnly = plan.inputMode === "rolling_plan";
  const profile = plan.strategyProfile || plan.contentStrategyProfile || {};
  $("#planNavCount").textContent = recommendations.length;
  const account = v2AccountRecord();
  $("#v2PlanningContext").innerHTML = `<dl><div><dt>本次发布账号</dt><dd>${escapeHtml(account?.name || "尚未选择")}</dd></div><div><dt>账号阶段</dt><dd>${escapeHtml(profile.growthStage || "读取活动策略")}</dd></div><div><dt>平台</dt><dd>${v2PlatformLabel($("#v2PlanPlatform").value)}</dd></div><div><dt>选择方式</dt><dd>${v2Workspace.accountSelection?.selectionSource === "single_account_default" ? "单账号默认" : "用户已确认"}</dd></div></dl>`;
  const warnCount = recommendations.filter((item) => item.duplication?.decision === "warn").length;
  const planWindow = plan.windowDays ? `${plan.windowDays} 天` : "单篇推荐";
  $("#v2PlanSummary").innerHTML = `<span>计划任务 <strong>${recommendations.length}</strong></span><span>重复提醒 <strong>${warnCount}</strong></span><span>计划周期 <strong>${escapeHtml(planWindow)}</strong></span><span>输入模式 <strong>${escapeHtml(legacyReadOnly ? "历史滚动计划（只读兼容）" : plan.inputMode || "活动策略")}</strong></span>`;
  if (plan.inputMode === "schedule_empty") {
    $("#v2PlanSummary").innerHTML = `<span>排期任务 <strong>0</strong></span><span>当前状态 <strong>尚未生成</strong></span><span>默认周期 <strong>${escapeHtml($("#v2PlanWindow")?.value || "7")} 天</strong></span>`;
    $("#v2DirectionCards").innerHTML = `<section class="v2-readiness-card schedule-empty-card"><strong>还没有本周期发布排期</strong><small>生成后，每个任务都会带发布日期、目标平台和不同的内容角度；系统不会再把临时推荐当成发布计划。</small><button class="btn primary" type="button" data-create-publishing-cycle>生成本周期排期</button></section>`;
    return;
  }
  const legacyNotice = legacyReadOnly ? `<div class="cycle-confirmation ready"><strong>历史滚动计划 · 只读兼容</strong><span>历史数据已保留，不会被转换或清空；请生成新的周期计划后再启动槽位。</span></div>` : "";
  $("#v2DirectionCards").innerHTML = recommendations.length ? legacyNotice + recommendations.map((item, index) => {
    const payload = item.generationPayload || {};
    const planSource = item.sourcePlan || payload.contentSourcePlan || {};
    const missingRequiredSource = asArray(planSource.sources).find((source) => source.required === true && ["knowledge_base", "strategy_facts", "user_material"].includes(source.type) && !asArray(source.candidateIds).length);
    const unavailable = legacyReadOnly || item.planStatus === "in_progress";
    const statusLabel = legacyReadOnly ? "历史记录" : item.planStatus === "in_progress" ? "已进入创作" : item.planStatus === "blocked" || missingRequiredSource ? "等待补充资料" : item.duplication?.decision === "warn" ? "注意重复" : "可继续";
    const startLabel = legacyReadOnly ? "请生成新周期" : item.planStatus === "in_progress" ? "已开始" : item.planStatus === "blocked" || missingRequiredSource ? "先选择资料" : "采用并生成大纲";
    return `<article class="direction-card-v2"><div class="direction-card-top"><span>${escapeHtml(item.contentFunction || item.contentRole || "内容方向")}</span><em class="${item.planStatus === "blocked" || missingRequiredSource || item.duplication?.decision === "warn" ? "warn" : "safe"}">${statusLabel}</em></div><h2>${escapeHtml(item.topic || payload.ideaTitle || "未命名方向")}</h2><p>${escapeHtml(item.reason || "结合当前策略与内容节奏推荐")}</p><div class="direction-meta-v2"><span>内容支柱<b>${escapeHtml(item.contentPillar || "待确认")}</b></span><span>建议来源<b>${escapeHtml(planSource.mode || "动态组合")}</b></span><span>主要目的<b>${escapeHtml(purposeContent[payload.contentPurposeId]?.label || payload.contentPurposeId || "待确认")}</b></span></div><div class="source-rationale-v2">${(planSource.rationale || []).slice(0, 2).map((reason) => `<span>${escapeHtml(reason)}</span>`).join("") || `<span>Agent 将在创建任务时解析可用来源</span>`}</div>${missingRequiredSource ? `<div class="source-rationale-v2"><span>需要证据：${escapeHtml(missingRequiredSource.role || "可引用知识资料")}</span></div>` : ""}<div class="direction-actions-v2"><button class="btn secondary" data-v2-adjust-direction="${index}" ${legacyReadOnly ? "disabled" : ""}>${legacyReadOnly ? "历史计划仅查看" : "和 Agent 调整"}</button><button class="btn primary" data-v2-start-run="${index}" ${unavailable ? "disabled" : ""}>${startLabel}</button></div></article>`;
  }).join("") : `<div class="empty-state">当前没有满足事实与重复门槛的方向，请补充资料或调整平台。</div>`;
}

function renderCycleWorkbench(plan) {
  const cycle = plan.cycle;
  const slots = plan.recommendations || [];
  const accountMap = new Map(slots.map((slot) => [slot.socialAccountId || slot.accountId, slot]));
  const accounts = [...accountMap.values()];
  const pendingDecisions = (cycle.userDecisions || cycle.userDecisionsRequired || []).filter((item) => item.status !== "confirmed");
  const playbooks = (cycle.playbookVersions || []).map((item) => {
    const account = accountMap.get(item.socialAccountId);
    return {
      accountName: account?.accountName || item.socialAccountId,
      platform: account?.platform,
      label: v2GrowthPlaybookLabel(item.growthPlaybookId),
      version: item.playbookVersion,
      accountId: item.socialAccountId,
      playbookId: item.growthPlaybookId
    };
  });
  const active = cycle.workbenchStatus === "active" && cycle.status === "active";
  const portfolios = cycle.nextCycleContentPortfolios || [];
  const coldStart = portfolios.length > 0 && portfolios.every((item) => item.evidenceWindow?.confidence === "insufficient");
  const planningMode = coldStart ? "冷启动规划" : portfolios.length ? "数据驱动规划" : "策略排期";
  const maturity = portfolios.reduce((sum, item) => sum + Number(item.evidenceWindow?.maturePublicationCount || 0), 0);
  const observedCycles = portfolios.reduce((sum, item) => sum + Number(item.evidenceWindow?.cycleCount || 0), 0);
  $("#planNavCount").textContent = slots.length;
  $("#v2PlanningContext").innerHTML = `<dl>
    <div><dt>本周期目标</dt><dd>${escapeHtml(cycle.objective || slots[0]?.objective || "按已激活策略稳定推进内容")}</dd></div>
    <div><dt>排期范围</dt><dd>${escapeHtml(cycle.cycleStart)} — ${escapeHtml(cycle.cycleEnd)}</dd></div>
    <div><dt>参与账号</dt><dd>${accounts.map((item) => `${escapeHtml(item.accountName || item.socialAccountId || item.accountId)} · ${escapeHtml(v2PlatformLabel(item.platform))}`).join("<br>") || "暂无"}</dd></div>
    <div><dt>当前策略</dt><dd>已确认策略 · 第 ${escapeHtml(cycle.strategyVersion)} 版</dd></div>
    <div><dt>账号打法</dt><dd>${playbooks.map((item) => `${escapeHtml(item.accountName)} · ${escapeHtml(item.label)}（第 ${escapeHtml(item.version)} 版）`).join("<br>") || "暂无"}</dd></div>
  </dl><details class="plan-technical-details"><summary>高级详情</summary><dl><div><dt>策略快照</dt><dd>${escapeHtml(cycle.strategySnapshotId)}</dd></div>${playbooks.map((item) => `<div><dt>${escapeHtml(item.accountId)}</dt><dd>${escapeHtml(item.playbookId)} · v${escapeHtml(item.version)}</dd></div>`).join("")}</dl></details>`;
  const committedCount = slots.filter((item) => item.zone === "committed").length;
  const alternativeCount = slots.filter((item) => item.zone === "draft" || item.zone === "buffer").length;
  $("#v2PlanSummary").innerHTML = `<span>待发布计划 <strong>${committedCount}</strong></span><span>备用方向 <strong>${alternativeCount}</strong></span><span>规划模式 <strong>${escapeHtml(planningMode)}</strong></span><span>排期 <strong>${escapeHtml(cycle.cycleStart)} 至 ${escapeHtml(cycle.cycleEnd)}</strong></span><span>状态 <strong>${active ? "已确认" : "待确认"}</strong></span>`;
  const notices = [
    ...(cycle.assumptions || []).map((item) => `规划假设：${v2CycleNotice(item)}`),
    ...pendingDecisions.map((item) => `待确认：${item.label || item.type || item.decisionId}`)
  ];
  const confirmation = active
    ? `<div class="cycle-confirmation ready"><strong>本周期排期已确认</strong><span>下面的待发布计划可以逐条进入内容生产；备用方向不会自动启动。</span></div>`
    : `<div class="cycle-confirmation"><div><strong>先确认本周期排期</strong><span>确认只会冻结近期排期，不会自动生成内容或发布。</span></div><button class="btn primary" data-cycle-confirm>确认本周期排期</button></div>`;
  const dataReadiness = coldStart
    ? `<div class="cycle-confirmation ready"><div><strong>冷启动规划 · 尚不能进行数据短板修复</strong><span>当前只有 ${maturity} 篇成熟样本、${observedCycles} 个完整周期；本期只按活动策略、历史覆盖和探索比例安排，不宣称由表现数据驱动。</span></div></div>`
    : portfolios.length ? `<div class="cycle-confirmation ready"><div><strong>数据驱动规划</strong><span>已读取 ${maturity} 篇成熟样本和 ${observedCycles} 个完整周期，用于决定延续、修复与探索比例。</span></div></div>` : "";
  const renderZone = (zone, title, description) => {
    const zoneSlots = slots.filter((item) => item.zone === zone);
    return `<section class="cycle-zone cycle-zone-${zone}"><header><div><h2>${title}</h2><p>${description}</p></div><strong>${zoneSlots.length}</strong></header><div class="cycle-slot-grid">${zoneSlots.length ? zoneSlots.map((item) => {
      const index = slots.indexOf(item);
      const isFirstPlatformSlot = zone === "committed" && !zoneSlots.slice(0, zoneSlots.indexOf(item)).some((candidate) => candidate.platform === item.platform);
      const platformLaneHeading = isFirstPlatformSlot
        ? `<div class="cycle-platform-lane-heading" data-platform="${escapeHtml(item.platform)}"><strong>${escapeHtml(v2PlatformLabel(item.platform))}制作计划</strong><span>以下任务只进入${escapeHtml(v2PlatformLabel(item.platform))}工作区</span></div>`
        : "";
      const started = Boolean(item.contentRunId || item.unifiedProjectId);
      const canStart = active && zone === "committed";
      const functionLabel = ({ discovery: "扩大触达", authority: "建立专业信任", proof: "案例证明", solution: "解释解决方案", action: "推动行动" })[item.contentFunction] || "内容任务";
      const rawObjective = item.objective || item.reason;
      const objectiveText = ({ discovery: "让更多目标用户发现这个账号", authority: "用专业方法建立信任", proof: "用真实案例和证据增强可信度", solution: "帮助用户理解问题与解决路径", action: "引导有需求的用户采取下一步行动" })[rawObjective] || rawObjective || "按本周期目标推进";
      const schedule = item.targetWindow?.start || item.scheduledFor || "待排期";
      const platformName = v2PlatformLabel(item.platform);
      const isBuffer = zone === "buffer";
      const productionActions = zone !== "committed" ? "" : item.platform === "wechat"
        ? `<button class="btn primary" data-v2-start-run="${index}" ${canStart ? "" : "disabled"}>${active ? "制作公众号文章" : "确认排期后继续"}</button>`
        : `<button class="btn primary" data-v2-start-xhs="${index}" ${canStart ? "" : "disabled"}>${active ? "制作小红书图文" : "确认排期后继续"}</button>`;
      const productionHint = zone === "committed" ? `<small class="cycle-production-hint">进入${escapeHtml(platformName)}专属工作区；只显示本平台的大纲、内容、审阅和版本。</small>` : "";
      const platformConflicts = (cycle.conflicts || []).filter((conflict) => conflict.socialAccountId === (item.socialAccountId || item.accountId));
      const conflictMarkup = platformConflicts.length ? `<div class="cycle-slot-notices">${platformConflicts.map((conflict) => `<span>${escapeHtml(v2CycleNotice(conflict))}</span>`).join("")}</div>` : "";
      const laneLabel = ({ sustain: "延续有效模式", repair: "修复数据短板", explore: "探索新方向" })[item.learningLane] || "策略计划";
      const duplicateReasons = (item.duplication?.reasons || []).join("；");
      const matchedTopic = item.duplication?.matchedTopic;
      const matchedTopicLabel = matchedTopic && matchedTopic.length > 64 ? `${matchedTopic.slice(0, 64)}…` : matchedTopic;
      const learningMarkup = item.contentLearningInstruction ? `<div class="cycle-slot-notices"><span>${escapeHtml(laneLabel)} · 全新选题与正文</span>${item.crossPlatformReusePolicy ? `<span>同一母题允许跨平台适配；${escapeHtml(platformName)}标题、角度和正文必须独立</span>` : ""}${item.contentLearningInstruction.experiment?.targetMetric ? `<span>验证指标：${escapeHtml(item.contentLearningInstruction.experiment.targetMetric)}</span>` : ""}<span>历史相似度：${Math.round(Number(item.duplication?.score || 0) * 100)}% · ${escapeHtml(item.duplication?.decision || "allow")}</span>${matchedTopicLabel ? `<span title="${escapeHtml(matchedTopic)}">最相近历史内容：${escapeHtml(matchedTopicLabel)}</span>` : ""}${duplicateReasons ? `<span>判断依据：${escapeHtml(duplicateReasons)}</span>` : ""}</div>` : "";
      return `${platformLaneHeading}<article class="cycle-slot-card ${isBuffer ? "cycle-slot-buffer" : ""}" data-platform="${escapeHtml(item.platform)}"><div class="direction-card-top"><span>${escapeHtml(isBuffer ? "容量预留" : functionLabel)}</span><em class="${started ? "safe" : active ? "safe" : "warn"}">${isBuffer ? "尚未绑定选题" : started ? `已采用，点击后自动生成${escapeHtml(platformName)}大纲` : active ? "排期已确认" : "等待确认排期"}</em></div><h3>${escapeHtml(item.topic || "待补充主题")}</h3><p>${escapeHtml(isBuffer ? "为突发主题预留容量；临时需求出现后再进入独立绑定流程。" : objectiveText)}</p>${isBuffer ? "" : learningMarkup}<dl><div><dt>发布账号</dt><dd>${escapeHtml(item.accountName || item.socialAccountId || item.accountId)} · ${escapeHtml(platformName)}</dd></div><div><dt>计划日期</dt><dd>${escapeHtml(schedule)}</dd></div></dl>${isBuffer ? "" : conflictMarkup}${productionHint}<div class="direction-actions-v2"><button class="btn secondary" data-v2-adjust-direction="${index}" ${started || isBuffer ? "disabled" : ""}>${isBuffer ? "等待临时需求" : "与 AI 调整选题"}</button>${productionActions}</div></article>`;
    }).join("") : `<div class="cycle-zone-empty">暂无内容。</div>`}</div></section>`;
  };
  const alternativeSlots = slots.filter((item) => item.zone === "draft" || item.zone === "buffer");
  const alternatives = alternativeSlots.length ? `<details class="cycle-alternatives"><summary><span><strong>备用方向与调整空间</strong><small>共 ${alternativeSlots.length} 条，不会自动进入内容生产</small></span><span>展开</span></summary>${slots.some((item) => item.zone === "draft") ? renderZone("draft", "备选内容", "可以继续调整，确认后再加入正式排期。") : ""}${slots.some((item) => item.zone === "buffer") ? renderZone("buffer", "临时空位", "为突发选题保留，不占用当前发布承诺。") : ""}</details>` : "";
  $("#v2DirectionCards").innerHTML = `${confirmation}${dataReadiness}${notices.length ? `<div class="cycle-notices">${notices.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>` : ""}${renderZone("committed", "待发布计划", "这是本周期已经承诺的内容，确认排期后可逐条进入内容生产。")} ${alternatives}`;
}

async function confirmV2Cycle() {
  const cycle = v2Workspace.cycle;
  if (!cycle) return;
  try {
    const updated = await window.FlowAPI.confirmPublishingCycle(cycle.cycleId, { confirmedBy: "workspace_user", expectedPlanHash: cycle.confirmationPreviewHash || null });
    v2Workspace.cycle = updated;
    v2Workspace.plan = cycleWorkbenchProjection(updated);
    renderV2Plan(v2Workspace.plan);
    showToast("周期已确认，承诺区槽位现在可以逐个启动。");
  } catch (error) {
    showToast(`周期确认失败：${error.message}`);
  }
}

async function adjustV2CycleSlot(index) {
  const slot = v2Workspace.plan?.recommendations?.[index];
  const cycle = v2Workspace.cycle;
  if (!slot || !cycle || slot.contentRunId) return;
  if (slot.zone === "buffer") return showToast("容量预留位不属于现有选题调整，请等待临时需求后再绑定。");
  if (!window.FlowTopicAdjustmentWorkbench) return showToast("选题调整工作台尚未加载，请刷新页面。");
  await window.FlowTopicAdjustmentWorkbench.open({ cycle, slot, onAdopt: async ({ plan }) => {
    v2Workspace.cycle = plan;
    v2Workspace.plan = cycleWorkbenchProjection(plan);
    renderV2Plan(v2Workspace.plan);
    prepareV2CycleStart([cycle], { force: true });
    showToast("已采用新选题；整期计划已回到待确认状态。");
  }});
}

async function startV2Run(index, { productionMode = "platform" } = {}) {
  const recommendation = v2Workspace.plan?.recommendations?.[index];
  if (!recommendation) return;
  const button = $(`[data-v2-start-${productionMode === "xiaohongshu" ? "xhs" : "run"}="${index}"]`);
  const originalButtonText = button?.textContent || "";
  if (button) { button.disabled = true; button.textContent = "正在建立任务…"; }
  try {
    const targetPlatform = productionMode === "xiaohongshu"
      ? "xiaohongshu"
      : recommendation.platform || recommendation.generationPayload?.platform || "wechat";
    if (["xiaohongshu", "wechat"].includes(targetPlatform) && recommendation.cycleId && recommendation.cycleSlotId && unifiedArtifactWorkbench?.enabled) {
      const adopted = await window.FlowAPI.adoptPublishingCycleSlot(recommendation.cycleId, recommendation.cycleSlotId, { actor: "workspace_user" });
      await openUnifiedPlatformProductionEntry(targetPlatform, {
        entryId: adopted.entry?.id,
        projectId: adopted.projectId,
        topic: recommendation.topic || recommendation.generationPayload?.ideaTitle,
        accountId: recommendation.socialAccountId || recommendation.accountId || v2AccountRecord()?.id
      });
      const started = await startUnifiedProduction();
      showToast(started
        ? `${targetPlatform === "wechat" ? "公众号" : "小红书"}工作台已打开，大纲正在生成`
        : `${targetPlatform === "wechat" ? "公众号" : "小红书"}工作台已打开，请查看页面提示`);
      return;
    }
    if (recommendation.rollingPlanId) throw new Error("历史滚动计划只读，请生成新的周期计划后继续");
    const account = accountsCache.find((item) => item.id === (recommendation.socialAccountId || recommendation.accountId || v2AccountRecord()?.id));
    if (!account?.companyId) throw new Error("请先选择具体社媒账号");
    const opportunity = await window.FlowAPI.createContentOpportunity({
      companyId: account.companyId,
      socialAccountId: account.id,
      platform: targetPlatform,
      sourceType: "strategy_recommendation",
      sourceId: recommendation.id,
      topic: recommendation.topic || recommendation.generationPayload?.ideaTitle,
      angle: recommendation.reason || recommendation.generationPayload?.contentTaskBrief?.angle,
      contentPurposeId: recommendation.generationPayload?.contentPurposeId,
      preferredSourceMode: recommendation.sourcePlan?.mode || recommendation.generationPayload?.contentSourcePlan?.mode || "auto"
    });
    await launchV2Opportunity(opportunity);
    showToast("方向已进入统一内容项目，等待你确认双平台大纲");
  } catch (error) {
    showToast(`创建内容任务失败：${error.message}`);
    if (button) { button.disabled = false; button.textContent = originalButtonText; }
  }
}

const v2QueueLabels = { needs_completion: "待完善", ready_to_publish: "待发布", data_quality_issue: "数据需修复", awaiting_72h: "等待72h", ready_for_72h: "可回填72h", awaiting_7d: "等待7d", ready_for_7d: "可回填7d", mature: "已成熟", complete: "已完成" };
const v2MissingFieldLabels = { platformContentId: "平台内容 ID", publishedAt: "实际发布时间", socialAccountId: "发布账号", strategyAttribution: "策略归因", growthPlaybookId: "增长打法归因", cutoffAt: "指标数据截止时间", measurementWindow: "观察窗口" };
const v2NextActionLabels = { repair_required_fields_or_record_a_new_revision_after_due_at: "补齐可核验字段；若数据尚未到期，请到期后新增 revision", record_72h_snapshot: "录入截至 72h 的指标", record_7d_snapshot: "录入截至 7d 的指标", wait_until_due_at: "等待到期后再录入指标", cycle_review_allowed_when_cycle_bound: "内容反馈已成熟；仅已绑定周期的记录可进入周期复盘" };
const v2FeedbackCoreMetrics = { xiaohongshu: ["impressions", "views", "likes", "saves", "comments", "shares", "follows", "leads"], wechat: ["views", "shares", "follows", "leads"] };
const v2FeedbackMetricLabels = { impressions: "曝光", views: "阅读/播放", likes: "点赞", saves: "收藏", comments: "评论", shares: "分享", follows: "新增关注", leads: "咨询/线索", coverClicks: "封面点击", profileVisits: "主页访问", delivered: "送达人数", completions: "读完人数", qualifiedLeads: "有效线索", wonDeals: "成交数" };

function renderV2PublicationQueue() {
  const items = v2Workspace.history?.items || [];
  const rows = v2Workspace.reviewFilter === "all" ? items : items.filter((item) => item.queueStage === v2Workspace.reviewFilter);
  $("#v2PublicationList").innerHTML = rows.length ? rows.map((item) => {
    const timeline = item.publication?.timeline;
    const completedWindows = ["72h", "7d", "final"].filter((window) => timeline?.windows?.[window]?.latestAccepted).join(" → ");
    const missing = (item.publication?.missingFields || []).map((field) => v2MissingFieldLabels[field] || field);
    const dueAt = item.publication?.distance?.dueAt;
    const atomic = item.authority === "unified_atomic";
    const action = atomic
      ? `<button class="btn secondary" data-v2-review-project="${escapeHtml(item.unifiedProjectId)}" data-v2-review-platform="${escapeHtml(item.platform)}">${item.publication ? "打开 Atomic 控制区" : "继续内容生产"}</button>`
      : `<button class="btn secondary" data-v2-review-task="${escapeHtml(item.contentTaskId)}">${unifiedArtifactWorkbench.atomicPublicationCutoverEnabled ? "查看旧记录" : item.queueStage === "data_quality_issue" ? "补齐发布信息" : item.publication ? "打开时间线" : item.queueStage === "ready_to_publish" ? "记录发布" : "查看内容"}</button>`;
    const authorityLabel = atomic ? "Atomic 单一事实源" : unifiedArtifactWorkbench.atomicPublicationCutoverEnabled ? "旧链路只读记录" : "旧链路记录";
    return `<article class="publication-row-v2 ${item.queueStage === "data_quality_issue" ? "has-quality-issue" : ""}" data-queue-stage="${escapeHtml(item.queueStage)}" data-history-authority="${escapeHtml(item.authority || "legacy_content_task")}"><span class="platform-badge-v2">${v2PlatformLabel(item.platform)}</span><div><strong>${escapeHtml(item.title || item.topic || "未命名内容")}</strong><small>${authorityLabel} · ${escapeHtml(v2QueueLabels[item.queueStage] || item.queueStage)} · ${item.publication?.publishedAt ? `发布于 ${v2Date(item.publication.publishedAt)}` : atomic ? "尚未形成 Atomic 发布事实" : "实际发布时间待补齐"}${completedWindows ? ` · 已接受 ${escapeHtml(completedWindows)}` : ""}${dueAt ? ` · 到期 ${v2Date(dueAt)}` : ""}</small>${missing.length ? `<em class="quality-issue-copy">缺失：${escapeHtml(missing.join("、"))}</em>` : ""}</div><div class="publication-metric-mini">${item.publication?.metrics ? `<b>${v2Metric(item.publication.metrics.derivedMetrics?.engagementRate ?? item.publication.metrics.engagementRate)}</b><span>${escapeHtml(item.publication.metrics.measurementWindow || "数据")}</span>` : `<b>—</b><span>等待数据</span>`}</div>${action}</article>`;
  }).join("") : `<div class="empty-state">当前队列没有内容。</div>`;
}

async function loadV2Review() {
  if (!$("#v2PublicationList")) return;
  const account = v2AccountRecord();
  const [history, feedback, strategyAdjustments] = await Promise.all([
    window.FlowAPI.getContentHistory(v2AccountId()),
    window.FlowAPI.getContentFeedback({ accountId: v2AccountId() }),
    window.FlowAPI.getStrategyAdjustments({ companyId: account?.companyId || "", socialAccountId: v2AccountId() })
      .catch((error) => ({ candidates: [], decisions: [], bindings: [], loadError: error.message }))
  ]);
  v2Workspace.history = history; v2Workspace.feedback = feedback; v2Workspace.strategyAdjustments = strategyAdjustments;
  const items = history.items || []; const counts = history.queueCounts || {};
  $("#v2ReviewSummary").innerHTML = `<article><span>待完善/待发布</span><strong>${(counts.needs_completion || 0) + (counts.ready_to_publish || 0)}</strong><small>尚未形成发布记录</small></article><article><span>数据需修复</span><strong>${counts.data_quality_issue || 0}</strong><small>补齐真实发布字段或到期数据</small></article><article><span>等待/可回填</span><strong>${(counts.awaiting_72h || 0) + (counts.ready_for_72h || 0) + (counts.awaiting_7d || 0) + (counts.ready_for_7d || 0)}</strong><small>严格按实际时间和数据截止时间判断</small></article><article><span>已成熟</span><strong>${counts.mature || 0}</strong><small>可进入诊断；周期归因仍需真实绑定</small></article>`;
  $("#v2QueueAll").textContent = items.length;
  $("#v2QueueNeedsCompletion").textContent = counts.needs_completion || 0;
  $("#v2QueueReady").textContent = counts.ready_to_publish || 0;
  $("#v2QueueQuality").textContent = counts.data_quality_issue || 0;
  $("#v2QueueAwaiting72").textContent = counts.awaiting_72h || 0;
  $("#v2QueueReady72").textContent = counts.ready_for_72h || 0;
  $("#v2QueueAwaiting7d").textContent = counts.awaiting_7d || 0;
  $("#v2QueueReady7d").textContent = counts.ready_for_7d || 0;
  $("#v2QueueMature").textContent = counts.mature || 0;
  renderV2PublicationQueue();
  const signals = feedback.learningSignals || [];
  $("#v2LearningSignals").innerHTML = signals.length ? signals.map((signal) => `<article class="learning-signal-v2"><span>${signal.eligibleForPatternReview ? "账号经验候选" : "内容侧观察"}</span><strong>${escapeHtml(signal.contentPillarId || signal.contentFunction || "同类内容")}</strong><p>${signal.sampleSize} 篇可比样本 · ${escapeHtml(signal.measurementWindow)}</p><small>${signal.eligibleForPatternReview ? "可以继续验证并用于内容战术，不会上行修改策略" : "样本不足，仅保留观察"}</small></article>`).join("") : `<div class="empty-state">至少需要同条件的发布数据，Agent 才会形成学习信号。</div>`;
  const diagnoses = feedback.diagnoses || [];
  $("#v2Diagnoses").innerHTML = diagnoses.length ? diagnoses.slice(0, 12).map((item) => `<article class="feedback-insight-card ${item.status}"><div><span>${escapeHtml(item.measurementWindow || "观察")}</span><strong>${escapeHtml(item.funnelStage || "样本积累中")}</strong></div><p>${escapeHtml(item.observation)}</p><small>基线：${escapeHtml(item.baseline?.cohort || "不足")} · ${item.baseline?.sampleSize || 0} 篇 · ${escapeHtml(item.confidence)}</small>${item.nextAction ? `<button class="btn secondary" data-accept-diagnosis="${escapeHtml(item.id)}">采用下一篇实验</button>` : ""}</article>`).join("") : `<div class="empty-state">形成同账号、同平台、同窗口的可比基线后显示诊断。</div>`;
  const cycles = feedback.cycleReviews || [];
  const cycleCards = cycles.map((item) => `<article class="feedback-insight-card"><div><span>${item.eligibleForStrategyReview ? "策略复核候选" : "继续积累"}</span><strong>${escapeHtml(item.growthPlaybookId || "账号内容周期")}</strong></div><p>${escapeHtml(item.interpretation)}</p><small>${item.sampleSize} 篇 · ${item.cycleCount} 个周期 · ${item.businessObservedCount} 篇有业务结果</small>${item.eligibleForStrategyReview ? `<em>只读候选，不会自动修改活动策略</em>` : ""}</article>`).join("");
  const adjustmentCards = renderV2StrategyAdjustmentCards(strategyAdjustments);
  $("#v2CycleReviews").innerHTML = cycleCards + adjustmentCards || `<div class="empty-state">完成 7 日数据、跨周期样本和业务结果后显示。</div>`;
}

async function previewMetricImport() {
  const result = $("#metricImportResult");
  const button = $("#previewMetricImport");
  button.disabled = true; button.textContent = "解析中…";
  try {
    const file = $("#metricImportFile").files?.[0];
    const csvText = file ? await file.text() : $("#metricImportCsv").value.trim();
    const batch = await window.FlowAPI.previewMetricImport({ accountId: v2AccountId(), platform: $("#metricImportPlatform").value, csvText });
    v2Workspace.metricImportBatch = batch;
    result.innerHTML = `<strong>${batch.rowCount} 行已解析</strong><span>精确匹配 ${batch.exactMatchCount} 行；${batch.reviewCount} 行需要确认或创建历史记录。本次只会自动导入精确匹配项。</span>`;
    $("#confirmMetricImport").disabled = batch.exactMatchCount === 0;
  } catch (error) { result.textContent = `预览失败：${error.message}`; }
  button.disabled = false; button.textContent = "预览映射";
}

async function confirmMetricImport() {
  const batch = v2Workspace.metricImportBatch;
  if (!batch) return;
  const button = $("#confirmMetricImport");
  button.disabled = true; button.textContent = "导入中…";
  try {
    const confirmed = await window.FlowAPI.confirmMetricImport(batch.id, { confirmedBy: "workspace_user" });
    const imported = (confirmed.results || []).filter((item) => item.status === "imported").length;
    $("#metricImportResult").innerHTML = `<strong>已导入 ${imported} 行</strong><span>未确认的标题匹配和未匹配内容已跳过，不会发生错误归因。</span>`;
    await loadV2Review();
    showToast("平台数据已进入反馈闭环");
  } catch (error) { $("#metricImportResult").textContent = `导入失败：${error.message}`; }
  button.textContent = "确认导入精确匹配项";
}

async function loadV2Assets(tab = "knowledge") {
  if (!$("#v2AssetLibrary")) return;
  v2Workspace.assetTab = tab;
  $$("#v2AssetTabs button").forEach((button) => button.classList.toggle("active", button.dataset.v2Asset === tab));
  const boundaries = { knowledge: ["可以提供业务事实", "产品、案例、活动和公司资料"], hotspots: ["提供外部事件证据", "保留来源、时效、风险和使用记录"], references: ["不能提供用户业务事实", "保存外部原帖、截图、转录和分析记录"], blueprints: ["只能提供创作机制", "保存审核后的标题、结构、视觉和互动规律"] };
  const boundary = boundaries[tab];
  $("#v2AssetBoundary").innerHTML = `<strong>${boundary[0]}</strong><span>${boundary[1]}</span>`;
  $("#v2AssetLibrary").innerHTML = `<div class="v2-skeleton">加载资产中…</div>`;
  $("#v2KnowledgeAssetManager").hidden = tab !== "knowledge";
  try {
    let items = [];
    if (tab === "knowledge") {
      const ownership = v2KnowledgeOwnership();
      const folders = (await window.FlowAPI.getKnowledgeFolders(ownership.companyId, ownership.workspaceId)).items || [];
      if (!folders.some((item) => item.id === v2Workspace.assetFolderId)) v2Workspace.assetFolderId = folders[0]?.id || null;
      $("#v2KnowledgeFolder").innerHTML = folders.map((folder) => `<option value="${escapeHtml(folder.id)}" ${folder.id === v2Workspace.assetFolderId ? "selected" : ""}>${escapeHtml(folder.name)} · ${folder.fileCount || 0} 个文件</option>`).join("");
      items = v2Workspace.assetFolderId ? (await window.FlowAPI.getKnowledgeFiles(v2Workspace.assetFolderId, "", ownership.companyId, ownership.workspaceId)).items || [] : [];
      $("#v2AssetLibrary").innerHTML = items.length ? items.map((item) => {
        const status = ["ready", "failed", "pending"].includes(item.parseStatus) ? item.parseStatus : "pending";
        const statusText = status === "ready" ? `ready · 可检索 ${item.chunkCount || 0} 段` : status === "failed" ? `failed · ${escapeHtml(item.errorMessage || "解析失败")}` : "pending · 上传或解析中";
        return `<article class="asset-card-v2" data-v2-file-id="${escapeHtml(item.id)}"><div class="asset-type-icon knowledge">${item.kind === "image" ? "图" : item.kind === "sheet" ? "表" : "知"}</div><div><span class="asset-status-v2 ${status}">${statusText}</span><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.description || "未填写内容说明")}</p></div><small>${escapeHtml(item.sizeLabel || "")} · 解析尝试 ${item.parseAttempts || 0} 次</small><div class="asset-file-actions">${status === "failed" ? `<button type="button" data-v2-retry-file="${escapeHtml(item.id)}">重试解析</button>` : ""}<button type="button" data-v2-delete-file="${escapeHtml(item.id)}">删除</button></div></article>`;
      }).join("") : `<div class="asset-empty-v2"><span>知</span><h2>${folders.length ? "当前文件夹还没有资料" : "还没有企业知识文件夹"}</h2><p>${folders.length ? "选择真实文件上传，解析状态会在刷新后保留。" : "先新建文件夹，再上传企业资料。"}</p></div>`;
      return;
    }
    if (tab === "hotspots") items = (await window.FlowAPI.getHotspotLibrary("", "", "active", currentAgentAccountId)).items || [];
    if (tab === "references") items = (await window.FlowAPI.getContentLearningReferences(v2AccountId())).items || [];
    if (tab === "blueprints") items = (await window.FlowAPI.getContentLearningBlueprints(v2AccountId())).items || [];
    $("#v2AssetLibrary").innerHTML = items.length ? items.slice(0, 24).map((item) => `<article class="asset-card-v2"><div class="asset-type-icon ${tab}">${tab === "hotspots" ? "热" : tab === "references" ? "参" : "蓝"}</div><div><span>${escapeHtml(item.status || item.lifecycle || "已沉淀")}</span><h3>${escapeHtml(item.name || item.title || item.familyId || "未命名资产")}</h3><p>${escapeHtml(item.description || item.summary || item.rawText || item.contentArchetype || boundary[1]).slice(0, 100)}</p></div><small>${item.updatedAt ? v2Date(item.updatedAt) : "保留版本记录"}</small></article>`).join("") : `<div class="asset-empty-v2"><span>${tab === "hotspots" ? "热" : tab === "references" ? "参" : "蓝"}</span><h2>还没有${tab === "hotspots" ? "有效热点" : tab === "references" ? "参考内容" : "已批准蓝图"}</h2><p>${boundary[1]}</p></div>`;
  } catch (error) { $("#v2AssetLibrary").innerHTML = `<div class="v2-error"><p>${escapeHtml(error.message)}</p></div>`; }
}

async function loadV2Settings() {
  if (!$("#v2AccountCards")) return;
  const [accounts, integrations, platformIntegrations] = await Promise.allSettled([window.FlowAPI.getAccounts(), window.FlowAPI.getIntegrations(), window.FlowAPI.getPlatformIntegrations()]);
  const accountItems = accounts.status === "fulfilled" ? (accounts.value.items || []).filter((item) => item.accountType === "social") : [];
  const integrationItems = integrations.status === "fulfilled" ? integrations.value.items || integrations.value.integrations || [] : [];
  const wechatConnections = new Map((platformIntegrations.status === "fulfilled" ? platformIntegrations.value.wechat || [] : []).map((item) => [item.accountId, item]));
  const latestWechatRuns = new Map((platformIntegrations.status === "fulfilled" ? platformIntegrations.value.syncRuns || [] : []).filter((item) => item.platform === "wechat").map((item) => [item.accountId, item]));
  const selected = accountItems.find((item) => item.id === v2AccountId()) || accountItems[0];
  const hierarchy = selected?.companyId ? await window.FlowAPI.getStrategyHierarchy(selected.companyId).catch(() => ({ accountSnapshots: [], matrixSnapshots: [] })) : { accountSnapshots: [], matrixSnapshots: [] };
  const activeByAccount = new Map((hierarchy.accountSnapshots || []).filter((item) => item.status === "active").map((item) => [item.socialAccountId, item]));
  const matrixSnapshot = (hierarchy.matrixSnapshots || []).find((item) => item.status === "active");
  const visualStates = new Map((await Promise.all(accountItems.filter((item) => item.platform === "xiaohongshu").map(async (item) => {
    try { return [item.id, await window.FlowAPI.getDesignDna(item.id)]; }
    catch (_) { return [item.id, null]; }
  }))).filter((entry) => entry[1]));
  $("#v2AccountCards").innerHTML = accountItems.length ? accountItems.map((item) => {
    const accountStrategy = activeByAccount.get(item.id);
    const matrixRole = accountStrategy?.payload?.matrixRole || matrixSnapshot?.payload?.accountRoles?.[item.id]?.role || "继承矩阵角色";
    const connection = wechatConnections.get(item.id);
    const latestRun = latestWechatRuns.get(item.id);
    const wechatAction = item.platform === "wechat" ? `<button class="btn secondary" data-v2-wechat="${escapeHtml(item.id)}">${connection?.appSecretConfigured ? "公众号数据已连接" : "连接公众号数据"}</button>` : "";
    const visual = visualStates.get(item.id)?.item;
    const visualStatus = visual?.status === "confirmed" ? "已确认" : visual ? "待确认" : "未设置";
    const visualAction = item.platform === "xiaohongshu" ? `<button class="btn ${visual?.status === "confirmed" ? "secondary" : "primary"}" data-v2-visual="${escapeHtml(item.id)}">小红书视觉规范 · ${visualStatus}</button>` : "";
    const syncMeta = latestRun ? ` · 最近同步 ${latestRun.articleCount || 0} 篇` : "";
    return `<article class="account-card-v2"><span class="account-platform-mark ${escapeHtml(item.platform)}">${v2PlatformLabel(item.platform).slice(0, 1)}</span><div><h3>${escapeHtml(item.name)}</h3><p>${v2PlatformLabel(item.platform)} · 运营主体：${escapeHtml(item.operatorName||item.companyName||"待确认")}</p><small>${accountConfigurationLabel(item)} · ${escapeHtml(decisionSpeakerLabels[item.accountIdentity?.speakerType]||"持续发声者待确认")} · ${accountStrategy ? `账号策略第 ${accountStrategy.version} 版` : "尚未建立独立账号策略"}${syncMeta}</small></div><div class="account-card-actions">${visualAction}${wechatAction}<button class="btn secondary" data-v2-account="${escapeHtml(item.id)}">账号与身份设置</button></div></article>`;
  }).join("") : `<div class="empty-state">尚未配置发布账号。</div>`;
  const defaults = integrationItems.length ? integrationItems : [{ name: "大模型", status: "检查中" }, { name: "热点搜索", status: "检查中" }, { name: "图片生成", status: "检查中" }];
  $("#v2IntegrationCards").innerHTML = defaults.map((item) => `<article><i class="${item.status === "configured" || item.enabled ? "online" : ""}"></i><div><strong>${escapeHtml(item.name || item.provider || item.type)}</strong><small>${escapeHtml(item.status || (item.enabled ? "已连接" : "待配置"))}</small></div></article>`).join("");
}

async function openWechatIntegration(accountId) {
  try {
    const result = await window.FlowAPI.getWechatIntegration(accountId);
    v2Workspace.wechatAccountId = accountId;
    $("#wechatIntegrationTitle").textContent = `连接 ${result.account?.name || "微信公众号"}`;
    $("#wechatAppId").value = result.integration?.appId || "";
    $("#wechatAppSecret").value = "";
    $("#wechatAppSecret").placeholder = result.integration?.appSecretConfigured ? "AppSecret 已保存；不修改请留空" : "请输入 AppSecret";
    $("#wechatSyncDays").value = String(result.integration?.syncDays || 7);
    const latest = result.latestSync;
    $("#wechatIntegrationResult").textContent = latest ? `最近同步：${latest.articleCount || 0} 篇，历史导入 ${latest.importedCount || 0} 篇，匹配现有内容 ${latest.matchedCount || 0} 篇。` : "保存后先测试连接，再同步历史文章与表现数据。";
    $("#wechatIntegrationDialog").showModal();
  } catch (error) { showToast(`公众号连接加载失败：${error.message}`); }
}

async function persistWechatIntegration() {
  const accountId = v2Workspace.wechatAccountId;
  if (!accountId) throw new Error("没有选中公众号账号");
  return window.FlowAPI.saveWechatIntegration(accountId, {
    appId: $("#wechatAppId").value.trim(),
    appSecret: $("#wechatAppSecret").value.trim(),
    syncDays: Number($("#wechatSyncDays").value),
    enabled: true
  });
}

async function saveWechatConnection() {
  const button = $("#saveWechatIntegration"); button.disabled = true; button.textContent = "保存中…";
  try {
    await persistWechatIntegration();
    $("#wechatAppSecret").value = "";
    $("#wechatAppSecret").placeholder = "AppSecret 已保存；不修改请留空";
    $("#wechatIntegrationResult").textContent = "配置已保存在本机服务端。现在可以测试连接。";
    showToast("公众号 API 配置已保存");
    await loadV2Settings();
  } catch (error) { $("#wechatIntegrationResult").textContent = error.message; }
  button.disabled = false; button.textContent = "保存配置";
}

async function testWechatConnection() {
  const button = $("#testWechatIntegration"); button.disabled = true; button.textContent = "连接中…";
  try {
    await persistWechatIntegration();
    const result = await window.FlowAPI.testWechatIntegration(v2Workspace.wechatAccountId);
    $("#wechatAppSecret").value = "";
    $("#wechatAppSecret").placeholder = "AppSecret 已保存；不修改请留空";
    $("#wechatIntegrationResult").textContent = `连接成功 · ${result.latencyMs || 0}ms。可开始同步；微信统计数据通常更新至昨日。`;
  } catch (error) { $("#wechatIntegrationResult").textContent = `连接失败：${error.message}`; }
  button.disabled = false; button.textContent = "测试连接";
}

async function syncWechatConnection() {
  const button = $("#syncWechatIntegration"); button.disabled = true; button.textContent = "同步中…";
  try {
    await persistWechatIntegration();
    const result = await window.FlowAPI.syncWechatIntegration(v2Workspace.wechatAccountId, Number($("#wechatSyncDays").value));
    $("#wechatAppSecret").value = "";
    $("#wechatIntegrationResult").textContent = `同步完成：${result.articleCount || 0} 篇；匹配现有内容 ${result.matchedCount || 0} 篇，历史导入 ${result.importedCount || 0} 篇；账号趋势 ${result.accountSnapshotCount || 0} 天${result.latestFollowerCount !== null ? `，当前关注 ${result.latestFollowerCount}` : ""}${result.warnings?.length ? `，${result.warnings.length} 项接口警告` : ""}。`;
    showToast("公众号数据已进入发布反馈闭环");
    await Promise.all([loadV2Settings(), loadV2Review()]);
  } catch (error) { $("#wechatIntegrationResult").textContent = `同步失败：${error.message}`; }
  button.disabled = false; button.textContent = "同步数据";
}

const v2FeedbackFieldSelectors = { impressions: "#v2FeedbackImpressions", views: "#v2FeedbackViews", likes: "#v2FeedbackLikes", saves: "#v2FeedbackSaves", comments: "#v2FeedbackComments", shares: "#v2FeedbackShares", follows: "#v2FeedbackFollows", leads: "#v2FeedbackLeads", coverClicks: "#v2FeedbackCoverClicks", profileVisits: "#v2FeedbackProfileVisits", delivered: "#v2FeedbackDelivered", completions: "#v2FeedbackCompletions", qualifiedLeads: "#v2FeedbackQualifiedLeads", wonDeals: "#v2FeedbackWonDeals" };

function v2LocalDateTimeValue(value) {
  const date = value ? new Date(value) : null;
  if (!date || !Number.isFinite(date.getTime())) return "";
  const pad = (part) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function v2IsoFromDateTimeInput(selector) {
  const value = $(selector)?.value?.trim();
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("请输入有效的日期和时间");
  return date.toISOString();
}

function renderV2FeedbackQuality(item) {
  const panel = $("#v2FeedbackQuality");
  const publication = item.publication;
  if (!publication) {
    panel.hidden = true;
    panel.innerHTML = "";
    return;
  }
  const missing = (publication.missingFields || []).map((field) => v2MissingFieldLabels[field] || field);
  const issues = publication.qualityIssues || [];
  const dueAt = publication.distance?.dueAt;
  const hasIssue = item.queueStage === "data_quality_issue" || missing.length || issues.length;
  panel.hidden = !hasIssue;
  panel.innerHTML = hasIssue ? `<div><strong>发布数据需要修复</strong><span>${missing.length ? `缺失字段：${escapeHtml(missing.join("、"))}` : "当前快照未通过数据质量门禁"}</span></div><dl><div><dt>到期时间</dt><dd>${dueAt ? v2Date(dueAt) : "待补齐实际发布时间后计算"}</dd></div><div><dt>下一步动作</dt><dd>${escapeHtml(v2NextActionLabels[publication.nextAllowedAction] || publication.nextAllowedAction || "补齐真实字段后重新评估")}</dd></div></dl><button type="button" class="btn secondary" data-focus-publication-repair>补齐发布信息</button>` : "";
}

function v2SnapshotMetric(snapshot, key) {
  if (!snapshot) return null;
  if (Object.hasOwn(snapshot, key)) return snapshot[key];
  if (Object.hasOwn(snapshot.platformMetrics || {}, key)) return snapshot.platformMetrics[key];
  if (Object.hasOwn(snapshot.businessOutcome || {}, key)) return snapshot.businessOutcome[key];
  return null;
}

function v2WindowMetricKeys(item) {
  return [...(v2FeedbackCoreMetrics[item.platform] || []), ...(item.platform === "wechat" ? ["delivered", "completions"] : ["coverClicks", "profileVisits"]), "qualifiedLeads", "wonDeals"];
}

function renderV2FeedbackWindow({ populate = true } = {}) {
  const item = v2Workspace.feedbackTask;
  if (!item) return;
  const window = $("#v2FeedbackWindow").value;
  const timeline = item.publication?.timeline;
  const group = timeline?.windows?.[window] || { latest: null, revisions: [] };
  if (populate) {
    for (const key of v2WindowMetricKeys(item)) {
      const input = $(v2FeedbackFieldSelectors[key]);
      if (input) input.value = v2SnapshotMetric(group.latest, key) ?? "";
    }
    $("#v2FeedbackCutoffAt").value = v2LocalDateTimeValue(group.latest?.cutoffAt || group.latest?.windowEndedAt);
  }
  const baseline = timeline?.windows?.["72h"]?.latestAccepted;
  const panel = $("#v2FeedbackComparison");
  if (baseline && ["7d", "final"].includes(window)) {
    const rows = v2WindowMetricKeys(item).map((key) => {
      const previous = v2SnapshotMetric(baseline, key);
      const rawCurrent = $(v2FeedbackFieldSelectors[key])?.value ?? "";
      const current = rawCurrent === "" ? null : Number(rawCurrent);
      if (previous === null && current === null) return "";
      const deltaValue = Number.isFinite(previous) && Number.isFinite(current) ? current - previous : null;
      const delta = deltaValue === null ? "—" : `${deltaValue > 0 ? "+" : ""}${deltaValue}`;
      return `<tr><th>${escapeHtml(v2FeedbackMetricLabels[key] || key)}</th><td>${previous ?? "—"}</td><td>${current ?? "—"}</td><td class="${deltaValue > 0 ? "positive" : deltaValue < 0 ? "negative" : ""}">${delta}</td></tr>`;
    }).join("");
    panel.hidden = false;
    panel.innerHTML = `<div><strong>72h → ${escapeHtml(window)} 对比</strong><span>原值保留，不会被当前窗口覆盖</span></div><table><thead><tr><th>指标</th><th>72h 原值</th><th>${escapeHtml(window)} 当前值</th><th>增量</th></tr></thead><tbody>${rows || `<tr><td colspan="4">两个窗口暂无可比指标</td></tr>`}</tbody></table>`;
  } else {
    panel.hidden = true;
    panel.innerHTML = "";
  }
}

function renderV2FeedbackTimeline(item) {
  const timeline = item.publication?.timeline;
  const panel = $("#v2FeedbackTimeline");
  if (!timeline) return panel.innerHTML = `<div class="feedback-timeline-empty">记录发布后，将按 72h、7d、final 独立保存快照。</div>`;
  panel.innerHTML = `<div class="feedback-timeline-rail">${timeline.stages.map((stage) => `<article class="${stage.status}"><i></i><strong>${stage.id === "published" ? "发布时间" : stage.id}</strong><span>${stage.at ? v2Date(stage.at) : stage.dueAt ? `到期 ${v2Date(stage.dueAt)}` : "待回填"}</span>${stage.revision ? `<small>revision ${stage.revision}</small>` : ""}</article>`).join("")}</div>${["72h", "7d", "final"].map((window) => {
    const revisions = timeline.windows?.[window]?.revisions || [];
    if (revisions.length < 2) return "";
    return `<details class="feedback-revision-history"><summary>${window} 有 ${revisions.length} 个 revision，查看前一版</summary>${revisions.map((snapshot) => `<div><b>revision ${snapshot.revision}</b><span>${v2Date(snapshot.collectedAt)}</span><small>${v2WindowMetricKeys(item).map((key) => `${v2FeedbackMetricLabels[key] || key}: ${v2SnapshotMetric(snapshot, key) ?? "—"}`).join(" · ")}</small></div>`).join("")}</details>`;
  }).join("")}`;
}

function setV2LegacyFeedbackReadOnly(readOnly) {
  $$("#v2FeedbackDialog input, #v2FeedbackDialog textarea, #v2FeedbackDialog select").forEach((control) => {
    control.disabled = readOnly && control.id !== "v2FeedbackWindow";
  });
  const save = $("#v2SaveFeedback");
  if (save) save.hidden = readOnly;
}

function openV2Feedback(taskId) {
  const item = (v2Workspace.history?.items || []).find((entry) => entry.contentTaskId === taskId) || null;
  if (!item) return showToast("请先选择需要记录的内容");
  const readOnly = unifiedArtifactWorkbench.atomicPublicationCutoverEnabled && item.authority !== "unified_atomic";
  v2Workspace.feedbackTask = item;
  $("#v2FeedbackTitle").textContent = item.title || item.topic || "记录发布结果";
  $("#v2FeedbackStatus").value = item.publication?.status || "published";
  $("#v2FeedbackUrl").value = item.publication?.url || "";
  $("#v2FeedbackPlatformContentId").value = item.publication?.platformContentId || "";
  $("#v2FeedbackPublishedAt").value = v2LocalDateTimeValue(item.publication?.publishedAt);
  ["Impressions", "Views", "Likes", "Saves", "Comments", "Shares", "Follows", "Leads", "CoverClicks", "ProfileVisits", "Delivered", "Completions", "QualifiedLeads", "WonDeals"].forEach((key) => { $(`#v2Feedback${key}`).value = ""; });
  $$('[data-feedback-platform]').forEach((label) => { label.hidden = label.dataset.feedbackPlatform !== item.platform; });
  $$('[data-feedback-core]').forEach((label) => { label.hidden = !(v2FeedbackCoreMetrics[item.platform] || []).includes(label.dataset.feedbackCore); });
  const timeline = item.publication?.timeline;
  $("#v2FeedbackWindow").value = !timeline?.windows?.["72h"]?.latest ? "72h" : !timeline?.windows?.["7d"]?.latest ? "7d" : "final";
  $("#v2FeedbackNote").value = "";
  renderV2FeedbackTimeline(item);
  renderV2FeedbackQuality(item);
  renderV2FeedbackWindow();
  setV2LegacyFeedbackReadOnly(readOnly);
  if (readOnly) {
    const panel = $("#v2FeedbackQuality");
    panel.hidden = false;
    panel.querySelector("[data-focus-publication-repair]")?.remove();
    panel.insertAdjacentHTML("afterbegin", `<div><strong>旧链路记录仅供查看</strong><span>Atomic cutover 已启用；此处不会再写入 ContentTask / ContentPublication。</span></div>`);
  }
  $("#v2FeedbackDialog").showModal();
}

async function openAtomicReviewProject(projectId, platform) {
  if (!unifiedArtifactWorkbench.enabled) return showToast("统一内容项目当前未启用，无法打开 Atomic 控制区");
  switchView("artifact-review");
  try {
    await openContentProductionProject(projectId, platform);
    showToast(`已打开 ${v2PlatformLabel(platform)} 的 Atomic 项目控制区`);
  } catch (error) {
    showToast(`Atomic 项目打开失败：${error.message}`);
  }
}

function routeLegacyPublicationEntryToAtomic() {
  showToast("旧链路记录已设为只读；请从 Atomic 项目控制区完成发布与反馈");
}

async function saveV2FeedbackLegacy() {
  const item = v2Workspace.feedbackTask;
  if (!item) return;
  const button = $("#v2SaveFeedback"); button.disabled = true; button.textContent = "保存中…";
  try {
    let publicationId = item.publication?.id;
    const publicationPayload = { status: $("#v2FeedbackStatus").value, url: $("#v2FeedbackUrl").value.trim() || null, platformContentId: $("#v2FeedbackPlatformContentId").value.trim() || null, publishedAt: v2IsoFromDateTimeInput("#v2FeedbackPublishedAt") };
    if (!publicationId) {
      const publication = await window.FlowAPI.recordContentPublication(item.contentTaskId, { ...publicationPayload, platform: item.platform, adoptionStatus: "adopted" });
      publicationId = publication.id;
    } else {
      await window.FlowAPI.updateContentPublication(publicationId, publicationPayload);
    }
    const numberOrNull = (selector) => $(selector).value === "" ? null : Number($(selector).value);
    const metricPayload = { impressions: numberOrNull("#v2FeedbackImpressions"), views: numberOrNull("#v2FeedbackViews"), likes: numberOrNull("#v2FeedbackLikes"), saves: numberOrNull("#v2FeedbackSaves"), comments: numberOrNull("#v2FeedbackComments"), shares: numberOrNull("#v2FeedbackShares"), follows: numberOrNull("#v2FeedbackFollows"), leads: numberOrNull("#v2FeedbackLeads"), platformMetrics: item.platform === "wechat" ? { delivered: numberOrNull("#v2FeedbackDelivered"), completions: numberOrNull("#v2FeedbackCompletions") } : { coverClicks: numberOrNull("#v2FeedbackCoverClicks"), profileVisits: numberOrNull("#v2FeedbackProfileVisits") }, businessOutcome: { qualifiedLeads: numberOrNull("#v2FeedbackQualifiedLeads"), wonDeals: numberOrNull("#v2FeedbackWonDeals") }, measurementWindow: $("#v2FeedbackWindow").value, cutoffAt: v2IsoFromDateTimeInput("#v2FeedbackCutoffAt"), source: "manual", userFeedback: { qualitativeResult: $("#v2FeedbackNote").value.trim() } };
    const hasMetric = Object.entries(metricPayload).some(([key, value]) => ["impressions", "views", "likes", "saves", "comments", "shares", "follows", "leads"].includes(key) && value !== null)
      || Object.values(metricPayload.platformMetrics).some((value) => value !== null)
      || Object.values(metricPayload.businessOutcome).some((value) => value !== null);
    if (hasMetric && !metricPayload.cutoffAt) throw new Error("录入指标时必须填写指标数据截止时间");
    if (hasMetric) await window.FlowAPI.recordPublicationMetrics(publicationId, metricPayload);
    $("#v2FeedbackDialog").close();
    showToast("发布记录已保存；到下一个观察窗口再补数据即可");
    await loadV2Review();
  } catch (error) { showToast(`保存失败：${error.message}`); }
  button.disabled = false; button.textContent = "保存发布与反馈";
}

async function saveV2Feedback() {
  if (unifiedArtifactWorkbench.atomicPublicationCutoverEnabled) return routeLegacyPublicationEntryToAtomic();
  return saveV2FeedbackLegacy();
}

const agentFieldLabels = {
  "business.primaryOffers": "主要产品/服务", "business.businessModel": "商业模式", "audiences.primary": "核心受众",
  "business.conversionPath": "转化路径", "accountStrategy.primaryGoal": "账号主目标", "accountStrategy.growthStage": "账号阶段",
  "accountStrategy.platformRoles": "平台目标与分工", "accountStrategy.contentResources": "可用内容材料", "accountStrategy.constraints": "内容安全规则"
};

function addAgentChatMessage(role, content) {
  const log = $("#agentDiagnosticChat");
  log.insertAdjacentHTML("beforeend", `<div class="agent-chat-message ${role}"><span>${role === "assistant" ? "AI" : "你"}</span><p>${escapeHtml(content)}</p></div>`);
  log.scrollTop = log.scrollHeight;
}

function addAgentRecommendationCard(recommendation) {
  if (!recommendation || !["pending_confirmation", "refining", "revision_ready"].includes(recommendation.status)) return;
  if (document.querySelector(`[data-recommendation-card="${CSS.escape(recommendation.id)}"]`)) return;
  currentAgentRecommendationId = recommendation.id;
  const options = asArray(recommendation.options).length ? recommendation.options : [{ optionId: `${recommendation.id}_option_1`, label: "推荐方案", summary: compactCandidateValue(recommendation.recommendedValue), completeValue: recommendation.recommendedValue }];
  const optionMarkup = options.map((option, index) => { const display=option.display||{}; const steps=asArray(display.steps); const advantages=asArray(display.advantages); const attention=asArray(display.attention); return `<button class="agent-recommendation-option ${index === 0 ? "selected" : ""}" data-recommendation-option="${escapeHtml(option.optionId)}" data-recommendation-id="${escapeHtml(recommendation.id)}"><input type="radio" tabindex="-1" ${index === 0 ? "checked" : ""}/><span><strong>${escapeHtml(display.title || option.label || (index ? `备选方案 ${index}` : "推荐方案"))}</strong><small>${escapeHtml(display.summary || option.summary || compactCandidateValue(option.completeValue))}</small>${steps.length ? `<ol>${steps.map((item)=>`<li>${escapeHtml(compactCandidateValue(item))}</li>`).join("")}</ol>` : ""}${advantages.length ? `<em>优点：${advantages.map((item)=>escapeHtml(compactCandidateValue(item))).join("；")}</em>` : ""}${attention.length ? `<em>注意：${attention.map((item)=>escapeHtml(compactCandidateValue(item))).join("；")}</em>` : ""}</span></button>`; }).join("");
  $("#agentDiagnosticChat").insertAdjacentHTML("beforeend", `<section class="agent-recommendation-card" data-recommendation-card="${escapeHtml(recommendation.id)}" data-selected-option="${escapeHtml(options[0].optionId)}"><span>请选择并确认一条策略建议</span><div class="agent-recommendation-options">${optionMarkup}</div><div class="agent-recommendation-actions"><button class="primary" data-recommendation-action="adopt" data-recommendation-id="${escapeHtml(recommendation.id)}">采用所选方案</button><button data-recommendation-action="modify" data-recommendation-id="${escapeHtml(recommendation.id)}">和 AI 对话调整</button><button data-recommendation-action="reject" data-recommendation-id="${escapeHtml(recommendation.id)}">都不采用</button></div></section>`);
  $("#agentDiagnosticChat").scrollTop = $("#agentDiagnosticChat").scrollHeight;
}

function resetAgentConversation() {
  currentAgentSessionId = null;
  currentAgentStrategyDraft = null;
  currentAgentRecommendationId = null;
  currentAgentDraftRevision = null;
  currentAgentDraftReadiness = null;
  currentAgentEditFieldPath = null;
  currentAgentStrategyDecision = null;
  $("#agentDiagnosticChat").innerHTML = `<div class="agent-chat-message assistant"><span>AI</span><p>我会先了解业务、客户、账号目标和转化路径，再形成策略草案。点击下方按钮开始。</p></div>`;
  $("#agentChatStarter").hidden = false;
  $("#agentChatCompose").hidden = true;
  $("#agentStrategyDraftPanel").hidden = true;
  $("#agentStrategyDecisionPanel").hidden = true;
  $("#agentWorkflowPanel").hidden = true;
  $("#agentSessionState").textContent = "尚未开始";
  $("#agentCompleteness").textContent = "0%";
  $("#agentProgressBar").style.width = "0%";
  $("#agentConfirmedCount").textContent = "0";
  $("#agentFieldProgress").textContent = "有效字段 0/9";
  $("#agentConfirmedProgress").textContent = "已确认完整度 0%";
  $("#agentProfileRichness").textContent = "待积累";
  $("#agentFactCount").textContent = "0条动态事实";
  $("#agentEvidenceReadiness").textContent = "较低";
  $("#agentEvidenceCount").textContent = "0条可公开";
  $("#agentContentReadiness").textContent = "需要补充";
  $("#agentContentReadinessDetail").textContent = "等待内容资源";
  $("#agentClaimList").innerHTML = `<div class="empty-state">对话后将在这里整理事实与假设。</div>`;
  $("#agentDynamicFactCount").textContent = "0";
  $("#agentDynamicFactList").innerHTML = `<div class="empty-state">行业经验、案例、市场、偏好和约束会持续沉淀在这里。</div>`;
  $("#agentHistoricalFacts").hidden = true;
  $("#agentHistoricalFactCount").textContent = "0";
  $("#agentHistoricalFactList").innerHTML = "";
  $("#agentCriticalMissing").textContent = "尚未开始诊断";
  $("#agentCoverageSummary").textContent = "核心字段 0/9 · 动态画像尚未开始";
  $("#agentCoverageHint").textContent = "回答后会显示已经获取和仍需补充的信息";
  $("#createStrategyDraft").disabled = true;
  $("#createStrategyDraft").textContent = "完成核心信息后可生成草案";
  $("#agentDraftFeedback").hidden = true;
  $("#agentPostCompleteActions").hidden = true;
  $("#agentComposeContext").hidden = true;
}

function updateAgentStrategySteps(result = {}) {
  const phase=result.strategySessionState?.phase||result.sessionMeta?.conversationPhase||"core_diagnosis";
  const coreComplete=Boolean(result.draftReadiness?.coreComplete);
  const decisionStatus=result.strategyDecisionRecord?.status||result.draftReadiness?.strategyDecision?.status;
  const active=phase==="strategy_active"||Boolean(agentOverviewCache?.activeStrategy?.payload?.schemaVersion==="2.0");
  const current=active?"active":result.strategyDraft?.draft||["draft_created","revising"].includes(phase)?"draft":decisionStatus?"decision":coreComplete?"enrichment":"core";
  const order=["core","enrichment","decision","draft","active"];
  const index=order.indexOf(current);
  $$('[data-agent-step]').forEach((item)=>{const itemIndex=order.indexOf(item.dataset.agentStep);item.classList.toggle("active",itemIndex===index);item.classList.toggle("done",itemIndex<index);});
  if(result.strategySessionState)renderStrategyHandoffState(result.strategySessionState);
}

const decisionIdentityLabels={company_official:"企业官方号",founder_ip:"创始人IP",employee_expert:"员工/专家号",personal_creator:"个人创作者",product_vertical:"产品专号",institution_service:"机构服务号"};
const decisionSpeakerLabels={brand_official:"品牌官方",founder:"创始人",expert_advisor:"专家顾问",operations_team:"运营团队",other:"其他"};
const decisionTrustLabels={professional_knowledge:"专业知识",real_cases:"真实案例",founder_experience:"创始人经验",product_capability:"产品能力",customer_reputation:"客户口碑",industry_data:"行业数据",other:"其他"};
const decisionRoleLabels={primary:"主运营账号",discovery:"触达账号",trust:"信任沉淀账号",conversion:"转化承接账号",supporting:"协同账号"};
const decisionGrowthLabels={steady_vertical:"垂直内容稳步启动",hybrid_bridge:"热点桥接混合启动",hotspot_experiment:"受控热点实验",relationship_ip:"创始人/专家关系经营",search_asset:"搜索与内容资产经营",stable_operation:"稳定期组合优化"};
const scoreLabels={platformFit:"平台匹配",identityFit:"身份匹配",stageFit:"阶段匹配",objectiveFit:"目标匹配",statedPreferenceFit:"用户偏好",capacityFit:"产能",evidenceFit:"证据",riskControl:"风险控制"};

function renderStrategyDecisionRecord(record, accountCatalog = null) {
  if(!record?.selection&&!record?.preview)return;
  currentAgentStrategyDecision=structuredClone(record.selection||record.preview);
  const preview=record.preview||currentAgentStrategyDecision;
  const selection=currentAgentStrategyDecision;
  if(accountCatalog)currentAgentStrategyAccountCatalog=asArray(accountCatalog);
  else if(preview.accountCatalog)currentAgentStrategyAccountCatalog=asArray(preview.accountCatalog);
  const catalogById=new Map(currentAgentStrategyAccountCatalog.map((item)=>[item.id||item.socialAccountId,item]));
  const accountNames=new Map([...asArray(preview.portfolioDecision?.accounts),...currentAgentStrategyAccountCatalog].map((item)=>[item.socialAccountId||item.id,item.name]));
  $("#agentStrategyDecisionPanel").hidden=false;
  $("#agentDecisionEmpty").hidden=true;
  $("#agentDecisionWorkspace").hidden=false;
  $("#agentDecisionStatus").textContent=record.status==="confirmed"?`已确认 · v${record.revision}`:`待确认 · v${record.revision}`;
  $("#agentPortfolioRationale").textContent=asArray(preview.portfolioDecision?.rationale).join("；")||"根据账号数量、角色差异和团队产能进行选择。";
  const selectedMode=selection.portfolioDecision?.mode||preview.portfolioDecision?.mode||"single_account";
  $("#agentPortfolioOptions").innerHTML=[
    {id:"single_account",title:"先以单账号验证",detail:"适合产能有限、定位仍需验证或账号角色差异尚不明确的阶段。"},
    {id:"role_matrix",title:"采用角色型账号矩阵",detail:"适合已有多个账号、不同发声身份或不同平台承担明确分工的情况。"}
  ].map((item)=>`<label class="agent-portfolio-option ${selectedMode===item.id?"selected":""}"><input type="radio" name="agentPortfolioMode" value="${item.id}" ${selectedMode===item.id?"checked":""}/><span><strong>${item.title}${preview.portfolioDecision?.mode===item.id?" · AI推荐":""}</strong><small>${item.detail}</small></span></label>`).join("");
  $("#agentAccountDecisionList").innerHTML=asArray(selection.accountStrategies).map((account)=>{
    const catalogAccount=catalogById.get(account.socialAccountId)||{};
    const catalogIdentity=catalogAccount.accountIdentity||{};
    const identity=catalogIdentity.subjectType&&catalogIdentity.speakerType&&asArray(catalogIdentity.trustSources).length?catalogIdentity:(account.accountIdentity||catalogIdentity);
    const configuration=catalogAccount.configuration||account.accountConfiguration||{};
    const candidates=asArray(account.candidatePlaybooks);
    const selectedIds=asArray(selection.portfolioDecision?.selectedSocialAccountIds||selection.portfolioDecision?.selectedAccountIds);
    const enabled=selectedIds.includes(account.socialAccountId);
    const trustSources=new Set(asArray(identity.trustSources));
    return `<article class="agent-account-decision ${configuration.selectionEligible===false?"unavailable":""}" data-decision-account="${escapeHtml(account.socialAccountId)}"><header><div><strong>${escapeHtml(accountNames.get(account.socialAccountId)||account.socialAccountId)}</strong><small>${v2PlatformLabel(account.platform)}</small><div class="agent-account-meta"><span>运营主体：${escapeHtml(catalogAccount.operatorName||"待确认")}</span><span>${configuration.complete?"设置完整":"设置待完善"}</span></div></div><label><input type="checkbox" data-decision-enabled ${enabled?"checked":""} ${configuration.selectionEligible===false?"disabled":""}/> 纳入当前策略</label></header>${configuration.selectionEligible===false?`<a class="agent-account-repair" href="/?view=accounts&accountId=${encodeURIComponent(account.socialAccountId)}">前往账号与设置修复：${escapeHtml(asArray(configuration.missingFields).join("、")||"账号已停用")}</a>`:""}<div class="agent-identity-grid"><label>对外身份<select data-decision-identity><option value="">请选择</option>${Object.entries(decisionIdentityLabels).map(([value,label])=>`<option value="${value}" ${identity.subjectType===value?"selected":""}>${label}</option>`).join("")}</select></label><label>持续发声者<select data-decision-speaker><option value="">请选择</option>${Object.entries(decisionSpeakerLabels).map(([value,label])=>`<option value="${value}" ${identity.speakerType===value?"selected":""}>${label}</option>`).join("")}</select><small>长期由谁的口吻、经验和判断对外表达</small></label><label>补充说明<input data-decision-speaker-detail value="${escapeHtml(identity.speakerDetail||"")}" placeholder="例如：创始人李女士"/></label><label>账号角色<select data-decision-role>${Object.entries(decisionRoleLabels).map(([value,label])=>`<option value="${value}" ${(selection.portfolioDecision?.accountRoles?.[account.socialAccountId]||account.matrixRole||"supporting")===value?"selected":""}>${label}</option>`).join("")}</select></label></div><div class="agent-trust-options"><strong>主要信任来源：</strong>${Object.entries(decisionTrustLabels).map(([value,label])=>`<label><input type="checkbox" data-decision-trust="${value}" ${trustSources.has(value)?"checked":""}/> ${label}</label>`).join("")}</div><div class="agent-playbook-options">${candidates.map((candidate,candidateIndex)=>{const selected=account.selectedPlaybookId===candidate.playbookId;const breakdown=Object.entries(candidate.scoreBreakdown||{}).map(([key,value])=>`${scoreLabels[key]||key} ${value}`).join(" · ");return `<label class="agent-playbook-card ${selected?"selected":""}"><input type="radio" name="playbook_${escapeHtml(account.socialAccountId)}" value="${escapeHtml(candidate.playbookId)}" ${selected?"checked":""}/><span><strong>${candidateIndex===0?"推荐打法":"备选打法 "+candidateIndex} · ${escapeHtml(candidate.name||decisionGrowthLabels[candidate.growthMode]||candidate.playbookId)}</strong><b>${Number(candidate.score||0)}%</b></span><small>推荐理由：${escapeHtml(asArray(candidate.recommendationReasons||candidate.rationale).join("；"))}</small><small>平台适配：${escapeHtml(asArray(candidate.platformMechanism).join("；")||"按平台内容消费方式执行")}</small><small>所需资源：${escapeHtml(asArray(candidate.resourceRequirements).join("；")||"按现有产能验证")}</small><em>风险：${escapeHtml(asArray(candidate.risks).join("；")||"按观察窗口复核")}</em><div class="agent-playbook-detail">${escapeHtml(breakdown)} · 观察 ${candidate.experimentPlan?.windowDays||"-"} 天 · 退出条件：${escapeHtml(asArray(candidate.experimentPlan?.exitConditions).join("；")||"观察后复核")}</div></label>`}).join("")}</div></article>`;
  }).join("");
  for(const account of asArray(selection.accountStrategies).filter((item)=>item.compatibilityMigration)){
    const panel=$(`[data-decision-account="${CSS.escape(account.socialAccountId)}"]`);
    const catalog=catalogById.get(account.socialAccountId)||{};
    const missing=asArray(catalog.configuration?.missingFields).map((item)=>({subjectType:"对外身份",speakerType:"持续发声者",trustSources:"主要信任来源"}[item]||item));
    panel?.querySelector("header")?.insertAdjacentHTML("afterend",`<p class="agent-compatibility-note">${missing.length?`当前唯一账号记录还缺少：${escapeHtml(missing.join("、"))}。`:""}下方值来自活动策略，仅供你确认；保持一致会补齐账号记录，修改后则需生成并激活下一版策略。</p>`);
  }
  const represented=new Set(asArray(selection.accountStrategies).map((item)=>item.socialAccountId));
  const newlyVisible=currentAgentStrategyAccountCatalog.filter((item)=>!represented.has(item.id||item.socialAccountId));
  if(newlyVisible.length)$("#agentAccountDecisionList").insertAdjacentHTML("beforeend",newlyVisible.map((account)=>`<article class="agent-account-decision unavailable"><header><div><strong>${escapeHtml(account.name||account.id)}</strong><small>${v2PlatformLabel(account.platform)}</small><div class="agent-account-meta"><span>运营主体：${escapeHtml(account.operatorName||"待确认")}</span><span>${account.configuration?.selectionEligible?"新账号待计算":"设置待完善"}</span></div></div></header><p>${account.configuration?.selectionEligible?"该账号来自账号与设置。点击“重新计算推荐”后可纳入当前策略。":"该账号已停用或基础设置不完整，暂不能纳入策略。"}</p><a class="agent-account-repair" href="/?view=accounts&accountId=${encodeURIComponent(account.id)}">前往账号与设置</a></article>`).join(""));
  $("#confirmStrategyDecisions").textContent=record.status==="confirmed"?"更新并重新确认":"确认账号与增长策略";
}

function collectStrategyDecisionSelection() {
  const selection=structuredClone(currentAgentStrategyDecision||{});
  selection.portfolioDecision={...(selection.portfolioDecision||{}),mode:$('input[name="agentPortfolioMode"]:checked')?.value||"single_account"};
  selection.accountStrategies=asArray(selection.accountStrategies).map((account)=>{
    const panel=$(`[data-decision-account="${CSS.escape(account.socialAccountId)}"]`);
    const selectedId=panel?.querySelector('input[type="radio"]:checked')?.value||account.selectedPlaybookId;
    const candidate=asArray(account.candidatePlaybooks).find((item)=>item.playbookId===selectedId)||{};
    const subjectType=panel?.querySelector("[data-decision-identity]")?.value||"";
    const matrixRole=panel?.querySelector("[data-decision-role]")?.value||"supporting";
    return {...account,matrixRole,selectedPlaybookId:selectedId,growthMode:candidate.growthMode||account.growthMode,accountIdentity:{...(account.accountIdentity||{}),subjectType,publicIdentity:decisionIdentityLabels[subjectType]||"",speakerType:panel?.querySelector("[data-decision-speaker]")?.value||"",speakerDetail:panel?.querySelector("[data-decision-speaker-detail]")?.value.trim()||"",trustSources:[...panel?.querySelectorAll("[data-decision-trust]:checked")||[]].map((item)=>item.dataset.decisionTrust)},contentFunctionTargets:candidate.contentFunctionTargets||account.contentFunctionTargets,hotspotPolicy:{...(candidate.hotspotPolicy||account.hotspotPolicy||{}),unrelatedAllowed:false,autoDeleteHistoricalContent:false},experimentPlan:candidate.experimentPlan||account.experimentPlan};
  });
  selection.portfolioDecision.selectedSocialAccountIds=selection.accountStrategies.filter((account)=>$(`[data-decision-account="${CSS.escape(account.socialAccountId)}"] [data-decision-enabled]`)?.checked).map((account)=>account.socialAccountId);
  if(selection.portfolioDecision.mode==="single_account"&&selection.portfolioDecision.selectedSocialAccountIds.length>1)selection.portfolioDecision.selectedSocialAccountIds=selection.portfolioDecision.selectedSocialAccountIds.slice(0,1);
  selection.portfolioDecision.primarySocialAccountId=selection.portfolioDecision.selectedSocialAccountIds[0]||null;
  selection.portfolioDecision.accountRoles=Object.fromEntries(selection.accountStrategies.filter((account)=>selection.portfolioDecision.selectedSocialAccountIds.includes(account.socialAccountId)).map((account)=>[account.socialAccountId,account.matrixRole||"supporting"]));
  selection.portfolioDecision.selectedAccountIds=selection.portfolioDecision.selectedSocialAccountIds;
  selection.portfolioDecision.rationaleSelection={mode:selection.portfolioDecision.mode,selectedSocialAccountIds:[...selection.portfolioDecision.selectedSocialAccountIds],accountRoles:{...selection.portfolioDecision.accountRoles}};
  if(selection.portfolioDecision.mode==="role_matrix"){
    if(selection.portfolioDecision.selectedSocialAccountIds.length<2)throw new Error("账号矩阵至少需要选择两个可运营账号");
    const roles=Object.values(selection.portfolioDecision.accountRoles);
    if(new Set(roles).size!==roles.length)throw new Error("矩阵中的每个账号必须承担不同角色");
  }
  return selection;
}

function compactCandidateValue(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((item) => compactCandidateValue(item)).filter(Boolean).join("、");
  if (value && typeof value === "object") return value.summary || value.description || value.label || value.name || Object.entries(value).filter(([key]) => !["knowledgeAssetIds", "publicUsage"].includes(key)).map(([key, item]) => `${key}：${compactCandidateValue(item)}`).join("；");
  return String(value ?? "");
}

function renderAgentKnowledgeLinks(links = [], claims = [], candidates = []) {
  const panel = $("#agentKnowledgeLinks");
  if (!panel) return;
  panel.hidden = !links.length;
  panel.innerHTML = links.map((link) => {
    const fileCandidates = candidates.filter((item) => item.fileId === link.fileId);
    const pending = fileCandidates.filter((item) => item.status === "pending");
    const confirmed = fileCandidates.filter((item) => item.status === "confirmed");
    const candidateMarkup = pending.map((item) => `<div class="agent-knowledge-candidate" data-agent-candidate-id="${escapeHtml(item.candidateId)}"><strong>${escapeHtml(agentFieldLabels[item.targetFieldPath] || item.targetKey || "补充事实")}</strong><p>${escapeHtml(compactCandidateValue(item.value))}</p><div class="candidate-actions"><button type="button" data-confirm-agent-candidate="${escapeHtml(item.candidateId)}">确认写入</button><button type="button" data-reject-agent-candidate="${escapeHtml(item.candidateId)}">忽略</button></div></div>`).join("");
    const status = link.file?.parseStatus === "failed" ? "解析失败" : pending.length ? `待确认 ${pending.length} 条` : confirmed.length ? `已写入 ${confirmed.length} 条` : link.file?.parseStatus === "ready" ? "未识别到策略信息" : "解析中";
    return `<article class="agent-knowledge-link" data-agent-file-id="${escapeHtml(link.fileId)}"><header><strong>${escapeHtml(link.file?.name || "已上传资料")}</strong><small>${escapeHtml(status)}</small></header><small>${escapeHtml(link.scope === "account" ? "保存到公司知识库" : "仅关联本次诊断")}</small>${pending.length > 1 ? `<div class="candidate-actions"><button type="button" data-confirm-all-file="${escapeHtml(link.fileId)}">确认全部候选</button></div>` : ""}${candidateMarkup}</article>`;
  }).join("");
}

function renderAgentSession(result) {
  const session = result.session || {};
  const claims = result.claims || [];
  const facts = (result.facts || []).filter((fact) => fact.factType !== "diagnostic_detail");
  const historicalFacts = (result.historicalFacts || []).filter((fact) => fact.factType !== "diagnostic_detail");
  const fieldStates = result.fieldStates || [];
  const fieldStateMap = new Map(fieldStates.map((item) => [item.fieldPath, item]));
  const draftReadiness = result.draftReadiness || { canGenerateDraft: Boolean(result.progress?.readyToDraft), canActivate: false, missingFields: [], unresolvedFields: [] };
  currentAgentDraftReadiness = draftReadiness;
  currentAgentDraftRevision = result.strategyDraftRevision || currentAgentDraftRevision;
  const phase = result.sessionMeta?.conversationPhase || (draftReadiness.coreComplete ? "core_complete" : "core_diagnosis");
  const trueComplete = Boolean(draftReadiness.coreComplete || phase === "strategy_active" || session.status === "completed");
  const minimumReady = Boolean(draftReadiness.coreDiagnosis?.minimumReady ?? draftReadiness.canGenerateMinimumDraft ?? draftReadiness.canGenerateDraft);
  updateAgentStrategySteps(result);
  renderStrategyHandoffState(result.strategySessionState);
  const progress = result.progress || { completeness: session.completeness || 0, criticalMissingFields: session.criticalMissingFields || [], readyToDraft: session.status === "ready_to_confirm" };
  const profileCoverage=result.profileCoverage || { core:{ready:0,total:9,items:[]},dynamic:{ready:0,total:14,items:[]} };
  const diagnosticSummary=result.diagnosticSummary||null;
  $("#agentSessionState").textContent = phase === "strategy_active" ? "策略已激活" : phase === "draft_created" || phase === "revising" ? "策略草案待审阅" : minimumReady ? "已达到策略决策门槛" : "诊断进行中";
  const processedCount = draftReadiness.coreDiagnosis?.answered ?? diagnosticSummary?.processed ?? draftReadiness.processedCount ?? progress.completedFieldCount ?? 0;
  const inProgressCount = diagnosticSummary?.inProgress ?? 0;
  const confirmedCount = draftReadiness.confirmedCount ?? diagnosticSummary?.strategyReady ?? progress.completedFieldCount ?? 0;
  const effectivePercent = Math.round((confirmedCount / (draftReadiness.totalCount || 9)) * 100);
  $("#agentCompleteness").textContent = `${effectivePercent}%`;
  $("#agentProgressBar").style.width = `${effectivePercent}%`;
  $("#agentFieldProgress").textContent = `已完成 ${processedCount}/${draftReadiness.totalCount || 9}`;
  $("#agentConfirmedProgress").textContent = `有效结论 ${confirmedCount}/${draftReadiness.totalCount || 9}`;
  const enrichmentStarted=result.sessionContext?.enrichmentStatus && result.sessionContext.enrichmentStatus !== "not_started";
  $("#agentCoverageSummary").textContent=`已完成 ${Math.min(9,processedCount)}/9 · 正在确认 ${Math.min(9,inProgressCount)} 项 · 可用于策略 ${Math.min(9,confirmedCount)}/9 · 动态画像${enrichmentStarted ? `已沉淀 ${facts.length} 条` : "尚未开始"}`;
  const activeCoverage=[...(profileCoverage.core?.items||[]),...(profileCoverage.dynamic?.items||[])].find((item)=>item.status==="partial"&&item.missingRequiredLabels?.length);
  $("#agentCoverageHint").textContent=activeCoverage
    ? minimumReady
      ? `最低草案信息已具备；如需提升质量，可继续补充${activeCoverage.label}中的${(activeCoverage.missingRequiredLabels||[]).slice(0,3).join("、")}`
      : `${activeCoverage.label}：已获取 ${(activeCoverage.capturedSlotLabels||[]).join("、")||"初步信息"}；还需 ${(activeCoverage.missingRequiredLabels||[]).slice(0,3).join("、")}`
    : profileCoverage.dynamic?.complete ? "核心与动态画像计划项均已处理" : "会持续追问到信息足够，或由你选择跳过";
  $("#agentConfirmedCount").textContent = `${Math.min(9,processedCount)}/9`;
  const claimMap = new Map(claims.map((claim) => [claim.fieldPath, claim]));
  const stateLabels = { unasked: "未询问", asked: "待回答", partial:"信息不完整", partially_answered: "部分回答", assisting: "辅助回答中", recommendation_pending: "建议待确认", confirmed: "信息充分", accepted_suggestion: "建议已采纳", explicit_none: "用户确认暂无", temporarily_unknown: "稍后补充", not_available: "当前无法回答", skipped: "已跳过", conflicting: "存在冲突" };
  const summaryFieldMap=new Map(asArray(diagnosticSummary?.fields).map((item)=>[item.fieldPath,item]));
  $("#agentClaimList").innerHTML = Object.keys(agentFieldLabels).map((fieldPath) => {
    const claim = claimMap.get(fieldPath);
    const summaryField=summaryFieldMap.get(fieldPath);
    const state = summaryField?.status||fieldStateMap.get(fieldPath)?.state || (claim?.status === "confirmed" ? "confirmed" : "unasked");
    const sourceLabel = claim?.sourceType === "agent_recommendation_accepted_with_changes" ? "Agent建议 · 调整后采纳" : claim?.sourceType === "agent_recommendation_accepted" ? "Agent建议 · 用户已采纳" : claim?.sourceType === "document_confirmed" ? "知识资料 · 用户已确认" : stateLabels[state] || state;
    const value = summaryField?.displaySummary||(claim ? humanizeDisplayValue(claim.value) : state === "skipped" ? "用户暂时跳过，尚无可用结论" : state === "temporarily_unknown" ? "用户稍后补充" : state === "not_available" ? "当前无法提供有效结论" : "尚未提供");
    return `<article><span class="${escapeHtml(state)}">${escapeHtml(sourceLabel)}</span><div><strong>${escapeHtml(agentFieldLabels[fieldPath])}</strong><p>${escapeHtml(value)}</p></div></article>`;
  }).join("");
  const unresolved = [...new Set(draftReadiness.coreDiagnosis?.missingFields || draftReadiness.minimumMissingFields || [])];
  const readinessAction=result.strategySessionState?.editingSessionTrack?.nextAction||draftReadiness.nextAction||{};
  $("#agentCriticalMissing").textContent = !minimumReady
    ? `还需要确认：${unresolved.map((field) => agentFieldLabels[field] || field).join("、")||"当前核心问题"}。请继续回答；不适用时可选择“跳过”。`
    : readinessAction.label || "请完成当前策略步骤。";
  const profileRichness = progress.profileRichness || {};
  const evidenceReadiness = progress.evidenceReadiness || {};
  const contentReadiness = progress.contentReadiness || {};
  $("#agentProfileRichness").textContent = profileRichness.level || "待积累";
  $("#agentFactCount").textContent = `${profileRichness.factCount || facts.length}条动态事实 · ${profileRichness.categoryCount || 0}类`;
  $("#agentEvidenceReadiness").textContent = evidenceReadiness.level || "较低";
  $("#agentEvidenceCount").textContent = `${evidenceReadiness.publishableCount || 0}条可公开 · ${evidenceReadiness.needsReviewCount || 0}条待确认`;
  $("#agentContentReadiness").textContent = contentReadiness.level || "需要补充";
  $("#agentContentReadinessDetail").textContent = contentReadiness.hasContentResources ? `${contentReadiness.usableFactCount || 0}条事实可用于内容` : "等待内容资源";
  $("#agentDynamicFactCount").textContent = facts.length;
  $("#agentDynamicFactList").innerHTML = facts.map((fact) => {
    const value = humanizeDisplayValue(fact.value);
    const usage = fact.contentUsage === "allowed" ? "可用于内容" : fact.contentUsage === "prohibited" ? "禁止使用" : "使用前确认";
    return `<article><div><strong>${escapeHtml(fact.predicate || fact.factType || "补充事实")}</strong><p>${escapeHtml(value)}</p></div><small>${escapeHtml(fact.factType || "事实")} · ${usage}</small></article>`;
  }).join("") || `<div class="empty-state">行业经验、案例、市场、偏好和约束会持续沉淀在这里。</div>`;
  $("#agentHistoricalFacts").hidden = !historicalFacts.length;
  $("#agentHistoricalFactCount").textContent = historicalFacts.length;
  $("#agentHistoricalFactList").innerHTML = historicalFacts.map((fact) => {
    const value = humanizeDisplayValue(fact.value);
    return `<article><div><strong>${escapeHtml(fact.predicate || fact.factType || "历史资料")}</strong><p>${escapeHtml(value)}</p></div><small>仅作历史参考 · 未写入本轮策略</small></article>`;
  }).join("");
  const draftButton = $("#createStrategyDraft");
  const draftAction=["generate_strategy_draft","regenerate_strategy_draft"].includes(readinessAction.type);
  draftButton.disabled = !draftReadiness.canGenerateDraft || !draftAction;
  const unresolvedCoreCount = Math.min(9, unresolved.length);
  draftButton.textContent = draftAction ? readinessAction.label : minimumReady ? (readinessAction.label||"先确认账号身份与增长打法") : `还需处理 ${unresolvedCoreCount} 项核心信息`;
  const feedback = $("#agentDraftFeedback");
  feedback.hidden = Boolean(draftReadiness.canGenerateDraft);
  if (!draftReadiness.canGenerateDraft) feedback.textContent = `生成草案前还需要：${asArray(draftReadiness.blockingIssues).map((item)=>item.message).join("；") || unresolved.map((field) => agentFieldLabels[field] || field).join("、") || "继续完成当前诊断"}`;
  const decisionPanel=$("#agentStrategyDecisionPanel");
  decisionPanel.hidden=!minimumReady;
  $("#generateStrategyDecisionPreview").disabled=!minimumReady||!["confirm_strategy_decisions"].includes(readinessAction.type);
  if(result.strategyDecisionRecord)renderStrategyDecisionRecord(result.strategyDecisionRecord);
  else if(minimumReady&&!currentAgentStrategyDecision){$("#agentDecisionEmpty").hidden=false;$("#agentDecisionWorkspace").hidden=true;$("#agentDecisionStatus").textContent="等待生成建议";}
  if (currentAgentStrategyDraft) {
    const activateButton = $("#activateAgentStrategy");
    const canActivateExactRevision = Boolean(draftReadiness.canActivate && currentAgentDraftRevision?.id && !currentAgentDraftRevision?.stale);
    activateButton.disabled = !canActivateExactRevision;
    activateButton.textContent = currentAgentDraftRevision?.stale ? "信息已更新，请重新生成草案" : canActivateExactRevision ? "确认并激活策略" : asArray(draftReadiness.blockingIssues)[0]?.message || "当前草案暂不能激活";
  }
  $("#agentPostCompleteActions").hidden = !trueComplete || Boolean(currentAgentEditFieldPath);
  const enrichmentActive = result.sessionContext?.enrichmentStatus === "active" || Boolean(result.pendingEnrichmentQuestion);
  $("#agentStartEnrichment").hidden = enrichmentActive;
  $("#agentStopEnrichment").hidden = !enrichmentActive;
  $("#agentPostCompleteText").textContent = enrichmentActive ? "当前正在补充高价值事实；补充后需要重新确认账号与增长打法，再生成新修订。" : `当前唯一下一步：${readinessAction.label||"继续完成策略流程"}。`;
  $("#agentComposeContext").hidden = !trueComplete || !currentAgentEditFieldPath;
  if (currentAgentEditFieldPath) $("#agentEnrichmentField").value = currentAgentEditFieldPath;
  const canUseAssist = Boolean(result.pendingQuestion || result.pendingEnrichmentQuestion || (trueComplete && currentAgentEditFieldPath));
  $$('[data-agent-assist]').forEach((button) => { button.disabled = !canUseAssist; button.title = result.pendingQuestion || result.pendingEnrichmentQuestion ? "围绕当前问题获得辅助" : canUseAssist ? "围绕正在修改的字段获得辅助" : trueComplete ? "可先选择继续补充动态事实或修改已有字段" : "当前没有待回答问题"; });
  if (result.knowledgeLinks) renderAgentKnowledgeLinks(result.knowledgeLinks, claims, result.knowledgeCandidates || []);
  const stale = result.strategyDraftRevision?.stale;
  if ($("#agentDraftStale")) {
    $("#agentDraftStale").hidden = !stale;
    $("#agentDraftStale").textContent = stale ? `当前草案基于旧信息生成：${asArray(result.strategyDraftRevision.staleReasons).join("；") || "策略资料已更新"}。请点击“更新策略草案”。` : "";
  }
}

async function restoreAgentSession(accountId) {
  if (!accountId) return;
  const result = await window.FlowAPI.getActiveAgentSession(accountId);
  if (!result?.session) return;
  currentAgentSessionId = result.session.id;
  $("#agentChatStarter").hidden = true;
  $("#agentChatCompose").hidden = false;
  $("#agentDiagnosticChat").innerHTML = "";
  for (const turn of result.turns || []) if (turn.role !== "system") addAgentChatMessage(turn.role, turn.content);
  const pending = result.pendingQuestion?.content;
  const lastAssistant = [...(result.turns || [])].reverse().find((turn) => turn.role === "assistant")?.content || "";
  if (pending && !lastAssistant.includes(pending)) addAgentChatMessage("assistant", pending);
  renderAgentSession(result);
  try {
    const decisionContext=await window.FlowAPI.getStrategyDecisionContext(result.session.id);
    currentAgentStrategyAccountCatalog=asArray(decisionContext.accounts);
    if(decisionContext.record)renderStrategyDecisionRecord(decisionContext.record,decisionContext.accounts);
  } catch (error) {
    showToast(`策略账号同步失败：${error.message}`);
  }
  if (result.pendingRecommendation) addAgentRecommendationCard(result.pendingRecommendation);
  if (result.strategyDraft?.draft) renderAgentStrategyDraft(result.strategyDraft.draft, result.draftReadiness, result.strategyDraftRevision);
  try {
    const requestStatus=await window.FlowAPI.getAgentStrategyDraftRequest(result.session.id,"latest");
    renderAgentDraftRequestStatus(requestStatus.draftRequest,requestStatus.draftRequest?.status==="running"?"刷新页面后仍可继续恢复":"");
    if(requestStatus.draftRequest?.status==="succeeded"&&requestStatus.draft&&requestStatus.draftRevision?.id!==result.strategyDraftRevision?.id){
      renderAgentStrategyDraft(requestStatus.draft,requestStatus.readiness,requestStatus.draftRevision);
    }
  } catch(error) {
    if(error.status!==404)renderAgentDraftRequestStatus({id:"状态查询",status:"failed"},error.message);
  }
}

function renderAgentStrategyDraft(draft, readiness = currentAgentDraftReadiness, revision = currentAgentDraftRevision) {
  currentAgentStrategyDraft = draft;
  currentAgentDraftRevision = revision || currentAgentDraftRevision;
  const isV2 = draft.schemaVersion === "2.0";
  const strategy = isV2 ? draft.strategy || {} : draft.accountStrategy || {};
  const roles = isV2
    ? { xiaohongshu: strategy.platformPlaybooks?.xiaohongshu?.role, wechat: strategy.platformPlaybooks?.wechat?.role }
    : strategy.platformRoles || {};
  const offers = isV2 ? asArray(draft.business?.offers).map((item) => item?.name).filter(Boolean) : asArray(draft.business?.primaryOffers);
  const audiences = isV2 ? asArray(strategy.audiences) : asArray(draft.audiences);
  const primaryObjective = isV2
    ? asArray(strategy.objectives).find((item) => item?.id === strategy.primaryObjectiveId)?.label
    : strategy.primaryGoal;
  const missingInformation = isV2 ? draft.governance?.missingInformation : draft.missingInformation;
  const pillars = isV2 ? asArray(strategy.contentSystem?.pillars).map((item) => item?.name).filter(Boolean) : asArray(strategy.contentPillars);
  const portfolio = isV2 ? strategy.contentSystem?.portfolio || {} : strategy.contentPortfolio || {};
  const portfolioLabels = isV2
    ? { discovery: "发现触达", authority: "专业权威", proof: "案例证明", solution: "方案理解", action: "行动转化" }
    : { traffic: "流量", trust: "信任", product: "产品", conversion: "转化" };
  const portfolioText = Object.entries(portfolio).map(([key, value]) => `${portfolioLabels[key] || key} ${value}%`).join(" · ");
  const conversionSteps = isV2 ? asArray(strategy.conversionSystem?.primaryPath?.steps) : asArray(draft.business?.conversionPath?.steps || draft.business?.conversionPath);
  const riskBoundaries = isV2 ? asArray(strategy.riskPolicy?.forbiddenClaims) : asArray(strategy.forbiddenTopics);
  const hypotheses = isV2 ? draft.governance?.hypotheses : draft.hypotheses;
  const extensions = isV2 ? draft.strategyExtensions || {} : {};
  const accountPortfolio = extensions.accountPortfolio || {};
  const growthModeLabels = { steady_vertical: "垂直内容稳步启动", hybrid_bridge: "热点桥接与垂直内容混合启动", hotspot_experiment: "受控热点实验", relationship_ip: "创始人/专家关系经营", search_asset: "搜索与内容资产经营", stable_operation: "稳定期内容组合优化" };
  const portfolioModeLabels = { single_account: "先以单账号验证", role_matrix: "采用角色型账号矩阵" };
  const accountGrowthStrategies = asArray(extensions.accountGrowthStrategies);
  const growthStrategyText = accountGrowthStrategies.map((item) => {
    const identity = item.accountIdentity?.publicIdentity || item.accountIdentity?.subjectType || "待确认身份";
    const mode = growthModeLabels[item.growthMode] || item.growthMode || "待确认打法";
    return `${item.socialAccountId || item.platform || "账号"}：${identity} · ${mode}`;
  }).join("；");
  const hotspotPolicies = asArray(extensions.hotspotPolicy?.accountPolicies);
  const hotspotPolicyText = hotspotPolicies.map((item) => {
    const allowed = asArray(item.allowedTiers).map((tier) => ({ direct: "业务直接相关", bridge: "可解释桥接", weak_experiment: "弱相关实验" }[tier] || tier)).join("、");
    return `${item.socialAccountId || "账号"}：只使用${allowed || "已确认相关"}热点，最高占比 ${Math.round(Number(item.maxShare || 0) * 100)}%`;
  }).join("；");
  const experimentText = asArray(extensions.experimentPlans).map((item) => `${item.socialAccountId || "账号"}：${item.windowDays || "-"} 天验证“${item.hypothesis || "当前增长打法"}”，退出条件：${asArray(item.exitConditions).join("、") || "待确认"}`).join("；");
  const functionPolicyText = Object.entries(extensions.contentFunctionPolicy?.functions || {}).map(([key,item])=>`${portfolioLabels[key] || key} ${item?.min ?? "-"}–${item?.max ?? "-"}%：${item?.rationale || "待说明"}`).join("；");
  const ctaStages = asArray(extensions.conversionLadder?.stages).map((stage)=>`${stage.label || stage.id}：${asArray(stage.allowedActions).join("、")}`).join("；");
  const evidencePlan = extensions.knowledgeEvidencePlan || {};
  const evidencePlanText = asArray(evidencePlan.queries).length ? `${asArray(evidencePlan.queries).length} 个定向检索任务 · ${asArray(evidencePlan.retrievedEvidence).length} 条知识证据 · ${evidencePlan.retrievalStatus === "retrieved" ? "已补证" : "未找到匹配证据"}` : "未调用知识库补证";
  $("#agentStrategyReview").innerHTML = `
    <article><span>业务定位</span><strong>${escapeHtml(draft.business?.valueProposition || "待确认")}</strong></article>
    <article><span>主要服务</span><strong>${offers.map(escapeHtml).join("、") || "待确认"}</strong></article>
    <article><span>核心受众</span><strong>${audiences.map((item) => escapeHtml(item?.name || item?.description || String(item))).join("、") || "待确认"}</strong></article>
    <article><span>账号主目标</span><strong>${escapeHtml(primaryObjective || "待确认")}</strong></article>
    ${accountPortfolio.mode ? `<article><span>账号组合决策</span><strong>${escapeHtml(portfolioModeLabels[accountPortfolio.mode] || accountPortfolio.mode)}；${escapeHtml(asArray(accountPortfolio.rationale).join("；") || "依据当前账号数量、身份与团队产能确定")}</strong></article>` : ""}
    ${growthStrategyText ? `<article><span>各账号身份与增长打法</span><strong>${escapeHtml(growthStrategyText)}</strong></article>` : ""}
    <article><span>小红书</span><strong>${escapeHtml(roles.xiaohongshu || "待确认")}</strong></article>
    <article><span>微信公众号</span><strong>${escapeHtml(roles.wechat || "待确认")}</strong></article>
    <article><span>内容支柱</span><strong>${pillars.map(escapeHtml).join("、") || "待确认"}</strong></article>
    <article><span>内容职能配比</span><strong>${escapeHtml(portfolioText || "待确认")}</strong></article>
    ${functionPolicyText ? `<article><span>配比依据与调整范围</span><strong>${escapeHtml(functionPolicyText)}</strong></article>` : ""}
    <article><span>转化路径</span><strong>${conversionSteps.map((item) => escapeHtml(typeof item === "string" ? item : item?.label || item?.name || String(item))).join(" → ") || "待确认"}</strong></article>
    ${ctaStages ? `<article><span>内容CTA阶梯</span><strong>${escapeHtml(ctaStages)}</strong></article>` : ""}
    ${isV2 ? `<article><span>知识库补证</span><strong>${escapeHtml(evidencePlanText)}</strong></article>` : ""}
    ${hotspotPolicyText ? `<article><span>热点使用边界</span><strong>${escapeHtml(hotspotPolicyText)}；禁止无关热点和发布后自动删文</strong></article>` : ""}
    ${experimentText ? `<article><span>打法验证周期</span><strong>${escapeHtml(experimentText)}</strong></article>` : ""}
    <article><span>事实与表达边界</span><strong>${riskBoundaries.map(escapeHtml).join("、") || "按已确认资料和授权范围执行"}</strong></article>
    <article><span>待验证假设</span><strong>${asArray(hypotheses).map((item) => escapeHtml(compactCandidateValue(item))).join("、") || "暂无"}</strong></article>
    <article><span>待补资料</span><strong>${asArray(missingInformation).map((item) => escapeHtml(compactCandidateValue(item))).join("、") || "暂无"}</strong></article>`;
  $("#agentStrategyDraftPanel").hidden = false;
  $("#agentStrategyEyebrow").textContent="Strategy Draft";
  $("#agentStrategyPanelTitle").textContent="审阅策略草案";
  $("#agentStrategyPanelVersion").textContent=`草案 v${currentAgentDraftRevision?.revision||1} · 确认后才会成为当前策略`;
  $("#agentStrategyScopeNotice").textContent="本轮编辑草案尚未生效。上方当前生效策略继续服务已有内容计划；只有本草案通过校验并由你激活后才会替换。";
  $("#agentStrategyDraftActions").hidden=false;
  const qualityGate=$("#agentDraftQualityGate");
  const semanticGate=currentAgentDraftRevision?.validation?.semanticGate;
  if(qualityGate){
    const fallbackSource=semanticGate?.sourceMode==="validated_fallback"||String(currentAgentDraftRevision?.providerMode||"").includes("fallback");
    const gatePassed=semanticGate?.passed!==false;
    qualityGate.hidden=!semanticGate&&!fallbackSource;
    qualityGate.dataset.state=gatePassed?"passed":"blocked";
    const sourceLabel=fallbackSource?"确定性 fallback（模型结果不可用或经完整回退）":"模型/规则结果已校验";
    const riskLabel={low:"低",medium:"中",high:"高"}[semanticGate?.riskLevel]||"待评估";
    const reasons=asArray(semanticGate?.errors).map((item)=>item?.message||item).filter(Boolean);
    qualityGate.innerHTML=`<strong>草案来源：${escapeHtml(sourceLabel)}</strong><span>语义风险：${escapeHtml(riskLabel)} · ${gatePassed?"已通过语义门禁":"未通过，禁止激活和交接内容 Agent"}</span>${reasons.length?`<ul>${reasons.map((reason)=>`<li>${escapeHtml(reason)}</li>`).join("")}</ul>`:""}`;
  }
  if ($("#agentDraftStale")) {
    $("#agentDraftStale").hidden = !currentAgentDraftRevision?.stale;
    $("#agentDraftStale").textContent = currentAgentDraftRevision?.stale ? `草案 v${currentAgentDraftRevision.revision} 已过期：${asArray(currentAgentDraftRevision.staleReasons).join("；") || "策略资料已变化"}` : `当前草案版本 v${currentAgentDraftRevision?.revision || 1}，你仍可在上方继续对话修改信息。`;
  }
  const canActivateExactRevision = Boolean(readiness?.canActivate && currentAgentDraftRevision?.id && !currentAgentDraftRevision?.stale);
  $("#activateAgentStrategy").disabled = !canActivateExactRevision;
  $("#activateAgentStrategy").textContent = currentAgentDraftRevision?.stale ? "信息已更新，请重新生成草案" : canActivateExactRevision ? "确认并激活策略" : asArray(readiness?.blockingIssues)[0]?.message || "当前草案暂不能激活";
  $("#agentStrategyDraftPanel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderActiveAgentStrategy(snapshot) {
  if (!snapshot?.payload) return;
  renderAgentStrategyDraft(snapshot.payload, {canActivate:false,blockingIssues:[]}, null);
  currentAgentStrategyDraft=null;
  $("#agentStrategyEyebrow").textContent="Active Strategy";
  $("#agentStrategyPanelTitle").textContent="当前激活策略";
  $("#agentStrategyPanelVersion").textContent=`v${snapshot.version} · 已激活`;
  $("#agentStrategyScopeNotice").textContent="这是当前生效的只读策略，正在服务内容计划；它不代表本轮新诊断或新草案已经成功。";
  $("#agentStrategyDraftActions").hidden=true;
  $("#agentDraftStale").hidden=true;
  if($("#agentDraftQualityGate"))$("#agentDraftQualityGate").hidden=true;
}

function renderAgentDraftRequestStatus(draftRequest, detail="") {
  const panel=$("#agentDraftRequestStatus");
  if(!panel)return;
  if(!draftRequest){panel.hidden=true;return;}
  panel.hidden=false;
  panel.dataset.state=draftRequest.status;
  const labels={running:"服务端正在生成策略草案",succeeded:"策略草案已在服务端生成",failed:"本轮新草案生成失败"};
  panel.textContent=`${labels[draftRequest.status]||"策略草案请求"} · 请求 ${draftRequest.id}${detail?` · ${detail}`:""}`;
}

function renderAgentStrategyHistory(items = []) {
  const ordered = [...items].sort((a, b) => Number(b.version || 0) - Number(a.version || 0));
  $("#agentStrategyHistoryCount").textContent = ordered.length;
  $("#agentStrategyHistoryList").innerHTML = ordered.map((item) => `<button type="button" data-agent-strategy-version="${escapeHtml(item.id)}"><span>v${item.version}</span><strong>${item.status === "active" ? "当前激活" : item.status === "superseded" ? "历史版本" : "草案"}</strong><small>${escapeHtml(new Date(item.confirmedAt || item.createdAt || Date.now()).toLocaleString("zh-CN"))}</small></button>`).join("") || `<div class="empty-state">激活第一版策略后，这里会保留完整版本记录。</div>`;
  $$('[data-agent-strategy-version]').forEach((button) => button.addEventListener("click", () => {
    const snapshot = ordered.find((item) => item.id === button.dataset.agentStrategyVersion);
    if (!snapshot) return;
    renderActiveAgentStrategy(snapshot);
    $("#agentStrategyPanelTitle").textContent = snapshot.status === "active" ? "当前激活策略" : `历史策略 v${snapshot.version}`;
    $("#agentStrategyPanelVersion").textContent = `v${snapshot.version} · ${snapshot.status === "active" ? "已激活" : "只读"}`;
  }));
}

function renderAgentWorkflow(data) {
  const snapshot = data.activeStrategy;
  if (!snapshot) return;
  const directions = data.directionSet?.payload?.directions || [];
  const downstream = data.downstream || {};
  const accountStrategies = downstream.accountStrategies || [];
  const rollingPlan = downstream.activeRollingPlan || null;
  const rollingPlanAccounts = [...new Set(asArray(rollingPlan?.items).map((item) => item.accountName || item.socialAccountId).filter(Boolean))];
  const opportunities = downstream.contentOpportunities || [];
  $("#agentWorkflowPanel").hidden = false;
  $("#agentSnapshotVersion").textContent = `v${snapshot.version} · ${snapshot.id}`;
  $("#agentDirectionStep").textContent = accountStrategies.length ? `${accountStrategies.length} 个账号策略已解析` : "等待配置社媒账号";
  $("#agentDirectionStep").classList.toggle("done", accountStrategies.length > 0);
  $("#agentHotspotStep").textContent = rollingPlan ? `${rollingPlan.windowDays} 天滚动计划` : "等待滚动计划";
  $("#agentHotspotStep").classList.toggle("done", Boolean(rollingPlan));
  $("#agentTopicStep").textContent = opportunities.length ? `${opportunities.length} 个内容机会` : "等待内容任务";
  $("#agentTopicStep").classList.toggle("done", opportunities.length > 0);
  $("#agentContentStep").textContent = downstream.contentTasks?.length ? `${downstream.contentTasks.length} 个内容任务` : "等待内容生成";
  $("#agentContentStep").classList.toggle("done", Boolean(downstream.contentTasks?.length));
  $("#agentDirectionList").innerHTML = accountStrategies.map((item) => `<article><span>${v2PlatformLabel(item.platform).slice(0, 1)}</span><div><strong>${escapeHtml(item.name)} · ${item.planningStatus==="active"?"活动计划":"待规划"}</strong><p>${escapeHtml(item.snapshot?.payload?.roleLabel || item.snapshot?.payload?.matrixRole || item.snapshot?.payload?.platformPlaybook?.role || "继承公司与矩阵策略")}</p><small>${item.snapshot ? `账号策略 v${item.snapshot.version}` : `公司策略 v${snapshot.version}`} · ${escapeHtml(item.snapshot?.payload?.selectedPlaybookId || item.snapshot?.payload?.growthPlaybook || "历史兼容打法")}</small></div></article>`).join("") || `<div class="empty-state">请先为公司添加具体社媒账号。</div>`;
  const topics = downstream.topics || [];
  const tasks = downstream.contentTasks || [];
  $("#agentDownstreamSummary").innerHTML = `${rollingPlan ? `<button data-jump="plan"><span>当前滚动计划</span><strong>未来 ${rollingPlan.windowDays} 天 · ${rollingPlan.items?.length || 0} 个账号任务</strong><small>${escapeHtml(rollingPlanAccounts.join("、") || "历史单账号计划")} · ${escapeHtml(rollingPlan.id)}</small></button>` : ""}${opportunities.slice(-4).map((item) => `<button data-jump="plan"><span>${escapeHtml(item.sourceType || "内容机会")}</span><strong>${escapeHtml(item.topic)}</strong><small>${escapeHtml(item.status)} · ${escapeHtml(item.id)}</small></button>`).join("")}${tasks.map((task) => `<button data-agent-content-id="${task.id}"><span>${task.platform === "wechat" ? "公众号内容" : "小红书内容"}</span><strong>${escapeHtml(task.currentContent?.recommended_title || task.currentContent?.post_copy?.recommended_title || task.ideaTitle || "内容任务")}</strong><small>${escapeHtml(task.socialAccountId || task.accountId || "历史账号")} · ${escapeHtml(task.id)} · v${task.version || 1}</small></button>`).join("")}` || `<div class="empty-state">先生成滚动计划，或从热点、爆款、知识和临时主题创建内容任务。</div>`;
}

const agentModelConnectionLabels = {
  connected: "服务已连接",
  unknown: "尚未验证",
  unavailable: "模型未配置",
  authentication_failed: "认证失败",
  rate_limited: "服务限流",
  service_error: "供应商服务异常",
  unreachable: "当前无法连接"
};
const agentModelErrorLabels = {
  timeout: "连接超时", dns: "DNS 解析失败", connection: "连接失败", authentication: "认证失败", authorization: "无访问权限",
  rate_limit: "请求限流", provider_4xx: "请求被拒绝", provider_5xx: "供应商 5xx", empty_response: "空响应", invalid_json: "非法 JSON", contract_validation: "输出合同校验失败", not_configured: "未配置"
};

function agentModelTime(value) {
  if (!value) return "尚无记录";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "时间未知" : date.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function renderAgentModelObservability(model = {}, turn = agentModelTurnState) {
  const connectionState = model.connectionState || (model.configured ? "unknown" : "unavailable");
  const connectionWarning = !["connected", "unknown", "unavailable"].includes(connectionState);
  const connectionCard = $("#agentModelConnectionState")?.closest("article");
  if ($("#agentModelConnectionState")) $("#agentModelConnectionState").textContent = agentModelConnectionLabels[connectionState] || connectionState;
  if ($("#agentModelConnectionDetail")) {
    const latestFailure = model.lastFailure;
    $("#agentModelConnectionDetail").textContent = connectionState === "unknown"
      ? `当前后端进程启动于 ${agentModelTime(model.runtimeStartedAt)}，尚未产生模型调用。`
      : connectionState === "connected"
        ? `最近成功：${agentModelTime(model.lastSuccessAt)}${latestFailure ? `；最近失败仍保留：${agentModelErrorLabels[latestFailure.errorCategory] || latestFailure.errorCategory}` : ""}`
        : connectionState === "unavailable"
          ? "请先在连接设置中配置模型；当前使用确定性基础规则。"
          : `最近失败：${agentModelTime(model.lastFailureAt)} · ${agentModelErrorLabels[latestFailure?.errorCategory] || latestFailure?.errorCategory || "未知错误"}`;
  }
  connectionCard?.classList.toggle("warning", connectionWarning);

  const turnCalls = (model.recentCalls || []).filter((call) => !turn?.startedAt || String(call.at || "") >= turn.startedAt);
  const turnFailure = turnCalls.find((call) => call.fallbackUsed) || null;
  const currentCall = turnFailure || turnCalls[0] || null;
  const turnDegraded = Boolean(turn?.degraded || turnFailure);
  const turnCard = $("#agentModelTurnState")?.closest("article");
  if ($("#agentModelTurnState")) $("#agentModelTurnState").textContent = !turn ? "本轮尚未调用模型" : turnDegraded ? "本轮已安全降级" : currentCall ? "本轮模型执行成功" : "本轮未触发模型";
  if ($("#agentModelTurnDetail")) $("#agentModelTurnDetail").textContent = currentCall
    ? `${currentCall.taskLabel || currentCall.task || "未分类任务"} · ${agentModelTime(currentCall.at)} · 重试 ${currentCall.retryCount || 0} 次 · trace ${currentCall.traceId || "—"}`
    : "任务降级不等于整个模型服务离线。";
  turnCard?.classList.toggle("warning", turnDegraded);

  const recent = model.recentCalls || [];
  if ($("#agentModelRecentCalls")) $("#agentModelRecentCalls").innerHTML = recent.length ? `<div class="agent-model-call-list">${recent.slice(0, 8).map((call) => {
    const failure = call.errorCategory ? call : call.attemptFailures?.at(-1);
    const recovered = call.mode === "live" && call.attemptFailures?.length;
    const outcome = call.fallbackUsed ? "已降级" : recovered ? "重试后成功" : "成功";
    return `<article class="agent-model-call ${call.fallbackUsed ? "failed" : ""}"><strong>${escapeHtml(call.taskLabel || call.task || "未分类任务")}</strong><span>${escapeHtml(outcome)}</span><small>${agentModelTime(call.at)} · ${failure ? escapeHtml(agentModelErrorLabels[failure.errorCategory] || failure.errorCategory) : "无错误"} · 重试 ${call.retryCount || 0} 次</small><small>${escapeHtml(call.provider || "模型服务")} · ${escapeHtml(call.model || "模型未知")}</small><code>trace ${escapeHtml(call.traceId || "—")}</code></article>`;
  }).join("")}</div>` : `<div class="empty-state">当前进程尚无模型调用记录。</div>`;
}

async function refreshAgentModelObservability(turn = agentModelTurnState) {
  try {
    const integrations = await window.FlowAPI.getIntegrations();
    if (agentOverviewCache) agentOverviewCache.providers = integrations;
    renderAgentModelObservability(integrations.model || {}, turn);
    const configured = Object.values(integrations || {}).filter((item) => item?.configured).length;
    const state = integrations.model?.connectionState || "unknown";
    $("#agentProviderStatus").textContent = `${agentModelConnectionLabels[state] || state} · ${configured}/3 服务已配置`;
    $("#agentProviderStatus").classList.toggle("warning", !["connected", "unknown", "unavailable"].includes(state));
  } catch (_) {
    if ($("#agentModelConnectionState")) $("#agentModelConnectionState").textContent = "状态读取失败";
  }
}

function renderAgentOverview(data) {
  agentOverviewCache = data;
  $("#agentBusinessDescription").textContent = data.description || "--";
  const configured = Object.values(data.providers || {}).filter((item) => item?.configured).length;
  const model = data.providers?.model || {};
  const modelStateLabel = agentModelConnectionLabels[model.connectionState] || "尚未验证";
  $("#agentProviderStatus").textContent = `${modelStateLabel} · ${configured}/3 服务已配置`;
  $("#agentProviderStatus").classList.toggle("warning", !["connected", "unknown", "unavailable"].includes(model.connectionState));
  renderAgentModelObservability(model);
  $("#agentNavStatus").textContent = data.activeStrategy ? `v${data.activeStrategy.version}` : "待诊断";
  $("#viewActiveStrategy").hidden = !data.activeStrategy;
  if (data.activeStrategy) {
    $("#viewActiveStrategy").textContent = data.strategyCompatibility?.requiresMigration ? "查看旧版策略 · 建议更新" : "查看已激活策略";
    $("#viewActiveStrategy").title = data.strategyCompatibility?.message || "当前策略已通过内容 Agent 消费协议校验";
    renderActiveAgentStrategy(data.activeStrategy);
  }
  renderAgentStrategyHistory(data.strategyHistory || []);
  $("#goAgentHotspots")?.setAttribute("href", `/?view=opportunities&source=agent&accountId=${encodeURIComponent(data.accountId)}`);
}

async function loadAgentDemo(showWorkflow = false) {
  try {
    if (!currentAgentAccountId) return;
    renderAgentOverview(await window.FlowAPI.getAgentOverview(currentAgentAccountId));
    if (showWorkflow) renderAgentWorkflow(agentOverviewCache);
  }
  catch (error) { showToast(`Agent 加载失败：${error.message}`); }
}

async function loadAgentWorkspace(showWorkflow = false) {
  try {
    await refreshAgentModelObservability();
    const result = await window.FlowAPI.getAgentAccounts();
    agentAccountsCache = result.items || [];
    const socialAccountCount = agentAccountsCache.reduce((sum, item) => sum + asArray(item.socialAccounts).length, 0);
    if ($("#workspaceAccountSummary")) $("#workspaceAccountSummary").textContent = `品牌工作区 · ${agentAccountsCache.length} 家公司 / ${socialAccountCount} 个社媒账号`;
    if (!agentAccountsCache.length) throw new Error("请先创建一个公司");
    if (!agentAccountsCache.some((item) => item.id === currentAgentAccountId)) currentAgentAccountId = agentAccountsCache[0].id;
    localStorage.setItem("flowsocial.agentAccountId", currentAgentAccountId);
    $("#agentAccountSelect").innerHTML = agentAccountsCache.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("");
    $("#agentAccountSelect").value = currentAgentAccountId;
    $("#useDamaishuzhiBrief").disabled = currentAgentAccountId !== "account_damaishuzhi";
    await loadAgentDemo(showWorkflow);
    await restoreAgentSession(currentAgentAccountId);
    await refreshContentPlanningGate(currentAgentAccountId);
  } catch (error) {
    showToast(`公司工作区加载失败：${error.message}`);
  }
}

async function startAgentDiagnosis(prefill = "", restartModeOverride = "fresh") {
  if (!currentAgentAccountId) return showToast("请先选择或创建公司");
  const restartMode = restartModeOverride || "fresh";
  const rediagnoseFields = [];
  const started = await window.FlowAPI.startAgentSession({ accountId: currentAgentAccountId, mode: "quick", restartMode, rediagnoseFields });
  currentAgentSessionId = started.session.id;
  currentAgentStrategyDraft = null;
  $("#agentDiagnosticChat").innerHTML = "";
  $("#agentChatStarter").hidden = true;
  $("#agentChatCompose").hidden = false;
  $("#agentSessionState").textContent = "对话中";
  renderAgentSession(started);
  addAgentChatMessage("assistant", started.openingQuestion);
  if (prefill) {
    $("#agentMessageInput").value = prefill;
    await sendCurrentAgentMessage();
  } else $("#agentMessageInput").focus();
}

async function sendCurrentAgentMessage(metadata = {}) {
  const input = $("#agentMessageInput");
  const message = input.value.trim();
  if (!currentAgentSessionId) return showToast("诊断会话已失效，请重新开始或刷新恢复");
  if (!message) return;
  input.value = "";
  addAgentChatMessage("user", message);
  const button = $("#sendAgentMessage");
  const turnStartedAt = new Date().toISOString();
  button.disabled = true; button.textContent = "分析中…";
  try {
    const targetFieldPath = $("#agentComposeContext")?.hidden ? null : $("#agentEnrichmentField")?.value || null;
    const result = await window.FlowAPI.sendAgentMessage(currentAgentSessionId, message, { ...metadata, ...(targetFieldPath ? { targetFieldPath } : {}) });
    renderAgentSession(result);
    if (result.assistantMessage) addAgentChatMessage("assistant", result.assistantMessage);
    if (result.strategyPatch?.requiresDraftRegeneration) {
      const labels = asArray(result.strategyPatch.affectedFields).map((field) => agentFieldLabels[field] || field).join("、");
      addAgentChatMessage("assistant", `这次修改影响了${labels || "当前策略信息"}。现有草案已标记为过期，点击“更新策略草案”会生成新版本；已激活的旧策略不会被直接覆盖。`);
    }
    agentModelTurnState = { startedAt: turnStartedAt, degraded: Boolean(result.providerWarning), warning: result.providerWarning || null };
    await refreshAgentModelObservability(agentModelTurnState);
    if (result.providerWarning) {
      showToast(`本轮模型请求失败，已使用基础规则：${result.providerWarning}`);
    }
    if (["pending_confirmation","refining","revision_ready"].includes(result.recommendation?.status)) {
      if (result.recommendation.status === "revision_ready") document.querySelector(`[data-recommendation-card="${CSS.escape(result.recommendation.id)}"]`)?.remove();
      addAgentRecommendationCard(result.recommendation);
    }
    else if (["accepted", "accepted_with_changes", "rejected"].includes(result.recommendation?.status)) {
      const card = document.querySelector(`[data-recommendation-card="${result.recommendation.id}"]`);
      if (card) card.querySelector(".agent-recommendation-actions").innerHTML = `<small>${result.recommendation.status === "rejected" ? "已拒绝，不会写入策略" : "已由用户确认并写入策略骨架"}</small>`;
      currentAgentRecommendationId = null;
    }
  } catch (error) { showToast(`诊断失败：${error.message}`); }
  finally { button.disabled = false; button.textContent = "发送"; }
}

$("#startAgentDiagnosis")?.addEventListener("click", () => startAgentDiagnosis());
$("#useDamaishuzhiBrief")?.addEventListener("click", () => startAgentDiagnosis("大卖数智是大卖科技集团旗下的企业AI应用落地服务团队，主要提供企业知识库、AI员工、定制智能体和AI工作流服务。客户来自各行各业，目前主要是外贸工厂。我们希望通过小红书和公众号先建立专业信任，再获得企业咨询；内容之后进入需求诊断、项目方案和交付。小红书负责场景触达，公众号负责系统讲解和深度信任。"));
$("#sendAgentMessage")?.addEventListener("click", () => sendCurrentAgentMessage());
$("#agentMessageInput")?.addEventListener("keydown", (event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendCurrentAgentMessage(); } });
$("#agentKnowledgePurpose")?.addEventListener("change", (event) => {
  const scope = $("#agentKnowledgeScope");
  if (!scope) return;
  if (event.target.value === "knowledge_only") scope.value = "account";
});
$("#agentKnowledgeFileInput")?.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file || !currentAgentSessionId) return;
  const form = new FormData();
  form.append("file", file);
  form.append("scope", $("#agentKnowledgeScope")?.value || "session");
  form.append("purpose", $("#agentKnowledgePurpose")?.value || "answer_current");
  form.append("tags", JSON.stringify(["策略诊断", "会话附件"]));
  const uploadLabel = event.target.closest("label");
  uploadLabel.classList.add("loading");
  try {
    const result = await window.FlowAPI.uploadAgentKnowledgeFile(currentAgentSessionId, form);
    renderAgentKnowledgeLinks(result.knowledgeLinks || [], [], result.knowledgeCandidates || []);
    const count = asArray(result.knowledgeCandidates).filter((item) => item.fileId === result.file.id && item.status === "pending").length;
    const purpose = result.purpose || $("#agentKnowledgePurpose")?.value;
    const primaryMessage = count
      ? purpose === "answer_current"
        ? `已读取《${result.file.name}》，并找到当前问题的候选答案。请确认后再写入，避免把模型推测当成事实。`
        : `已读取《${result.file.name}》，识别出 ${count} 条候选策略信息。请确认后再写入。`
      : purpose === "knowledge_only"
        ? `《${result.file.name}》已保存${result.savedToKnowledge ? "到公司知识库" : "为本轮附件"}，不会自动修改策略。`
        : `已读取《${result.file.name}》，但没有找到与当前处理目标直接相关、可确认写入的信息。`;
    const messages = [...new Set([primaryMessage, result.assistantMessage, result.resumeMessage].filter(Boolean))];
    messages.forEach((message)=>addAgentChatMessage("assistant", message));
    showToast(count ? "资料解析完成，等待确认" : "资料处理完成");
  } catch (error) { showToast(`资料上传失败：${error.message}`); }
  finally { uploadLabel.classList.remove("loading"); event.target.value = ""; }
});
$("#agentKnowledgeLinks")?.addEventListener("click", async (event) => {
  if (!currentAgentSessionId) return;
  const candidateButton = event.target.closest("[data-confirm-agent-candidate], [data-reject-agent-candidate]");
  const allButton = event.target.closest("[data-confirm-all-file]");
  if (!candidateButton && !allButton) return;
  const buttons = allButton ? [...allButton.closest("article").querySelectorAll("[data-confirm-agent-candidate]")] : [candidateButton];
  (allButton || candidateButton).disabled = true;
  try {
    let lastDecision = null;
    for (const button of buttons) {
      const candidateId = button.dataset.confirmAgentCandidate || button.dataset.rejectAgentCandidate;
      lastDecision = await window.FlowAPI.decideAgentKnowledgeCandidate(currentAgentSessionId, candidateId, { action: button.dataset.rejectAgentCandidate ? "reject" : "confirm" });
    }
    const refreshed = await window.FlowAPI.getAgentSession(currentAgentSessionId);
    renderAgentSession(refreshed);
    addAgentChatMessage("assistant", allButton ? `已把这份资料中的 ${buttons.length} 条候选信息写入对应策略字段。你仍可以在右侧策略骨架中逐项检查。` : candidateButton.dataset.rejectAgentCandidate ? "这条候选信息已忽略，不会写入策略。" : "这条资料信息已确认并写入对应策略字段。" );
    if (lastDecision?.resumed?.assistantMessage) addAgentChatMessage("assistant", lastDecision.resumed.assistantMessage);
    showToast(allButton ? "候选信息已批量写入" : "候选信息已处理");
  } catch (error) { showToast(`资料确认失败：${error.message}`); (allButton || candidateButton).disabled = false; }
});
$("#agentStartEnrichment")?.addEventListener("click", async () => {
  if (!currentAgentSessionId) return;
  try {
    const started = await window.FlowAPI.startAgentEnrichment(currentAgentSessionId);
    if (started.assistantMessage) addAgentChatMessage("assistant", started.assistantMessage);
    renderAgentSession(await window.FlowAPI.getAgentSession(currentAgentSessionId));
    $("#agentMessageInput").focus();
  } catch (error) { showToast(`无法开始补充：${error.message}`); }
});
$("#agentStopEnrichment")?.addEventListener("click", async () => {
  if (!currentAgentSessionId) return;
  try {
    const stopped = await window.FlowAPI.stopAgentEnrichment(currentAgentSessionId);
    if (stopped.assistantMessage) addAgentChatMessage("assistant", stopped.assistantMessage);
    renderAgentSession(await window.FlowAPI.getAgentSession(currentAgentSessionId));
  } catch (error) { showToast(`无法结束补充：${error.message}`); }
});
$("#agentStartFieldEdit")?.addEventListener("click", () => {
  currentAgentEditFieldPath = $("#agentEnrichmentField")?.value || "business.primaryOffers";
  $("#agentPostCompleteActions").hidden = true;
  $("#agentComposeContext").hidden = false;
  $("#agentMessageInput").focus();
});
$("#agentEnrichmentField")?.addEventListener("change", (event) => { currentAgentEditFieldPath = event.target.value; });
$("#agentExitFieldEdit")?.addEventListener("click", () => {
  currentAgentEditFieldPath = null;
  $("#agentComposeContext").hidden = true;
  $("#agentPostCompleteActions").hidden = false;
});
$$('[data-agent-assist]').forEach((button) => button.addEventListener("click", () => {
  const messages = { request_clarification: "我不太理解这个问题，可以解释一下吗？", request_examples: "可以给我举几个例子吗？", request_checklist: "我不太清楚，可以生成一个清单让我对照吗？", request_recommendation: "我不太确定，你有什么建议吗？", skip_question: "跳过这个问题",skip_field:"跳过整个字段" };
  $("#agentMessageInput").value = messages[button.dataset.agentAssist] || button.textContent;
  sendCurrentAgentMessage({ intentOverride: button.dataset.agentAssist, recommendationId: currentAgentRecommendationId });
}));
$("#agentDiagnosticChat")?.addEventListener("click", (event) => {
  const optionButton = event.target.closest("[data-recommendation-option]");
  if (optionButton) {
    const card = optionButton.closest("[data-recommendation-card]");
    card.dataset.selectedOption = optionButton.dataset.recommendationOption;
    card.querySelectorAll("[data-recommendation-option]").forEach((item) => { item.classList.toggle("selected", item === optionButton); item.querySelector("input").checked = item === optionButton; });
    return;
  }
  const button = event.target.closest("[data-recommendation-action]");
  if (!button) return;
  const action = button.dataset.recommendationAction;
  const recommendationId = button.dataset.recommendationId;
  const card = button.closest("[data-recommendation-card]");
  currentAgentRecommendationId = recommendationId;
  if (action === "modify") {
    button.disabled=true;
    window.FlowAPI.decideAgentRecommendation(currentAgentSessionId,recommendationId,{action:"begin_refinement",optionId:card.dataset.selectedOption}).then((result)=>{
      if (result.assistantMessage) addAgentChatMessage("assistant",result.assistantMessage);
      card.querySelector(".agent-recommendation-actions").innerHTML="<small>正在与 AI 调整这套方案，请在下方对话框说明你的想法。</small>";
      $("#agentMessageInput").placeholder="例如：保留企业微信承接，但去掉领取资料这一步……";
      $("#agentMessageInput").focus();
    }).catch((error)=>{showToast(`无法进入调整：${error.message}`);button.disabled=false;});
    return;
  }
  const selectedOptionId = card.dataset.selectedOption;
  const modifiedValue = null;
  const decisionAction = action === "reject" ? "reject" : action === "adopt" ? (card.querySelector("strong")?.textContent?.includes("调整方案") ? "accept_with_changes" : "accept") : null;
  if (!decisionAction) return;
  button.disabled = true;
  window.FlowAPI.decideAgentRecommendation(currentAgentSessionId, recommendationId, { action: decisionAction, optionId: selectedOptionId, modifiedValue }).then((result) => {
    renderAgentSession(result);
    if (result.assistantMessage) addAgentChatMessage("assistant", result.assistantMessage);
    card.querySelector(".agent-recommendation-actions").innerHTML = `<small>${decisionAction === "reject" ? "已拒绝，不会写入策略" : "已确认并写入策略骨架"}</small>`;
    $("#agentMessageInput").placeholder="回答 Agent 的问题，或继续补充业务资料…";
    currentAgentRecommendationId = null;
  }).catch((error) => { showToast(`建议处理失败：${error.message}`); button.disabled = false; });
});
$("#newAgentSession")?.addEventListener("click", () => $("#agentRestartDialog").showModal());
$$('input[name="agentRestartChoice"]').forEach((input)=>input.addEventListener("change",()=>{
  const mode=$('input[name="agentRestartChoice"]:checked')?.value||"fresh";
  const copy={fresh:"将新建一轮空白诊断；当前激活策略继续有效，直到你激活新版本。",retain_facts:"动态事实会作为本轮参考；九项策略骨架重新确认，旧策略继续有效。",retain_core:"上一轮已确认的策略骨架会带入新会话；动态事实不带入。",retain_all:"骨架和动态事实都会带入，进入策略迭代模式；旧策略在新版本激活前继续有效。"};
  $("#agentRestartImpact").textContent=copy[mode];
}));
$("#confirmAgentRestart")?.addEventListener("click",async()=>{
  const mode=$('input[name="agentRestartChoice"]:checked')?.value||"fresh";
  $("#agentRestartDialog").close();
  resetAgentConversation();
  await startAgentDiagnosis("",mode);
});
$("#agentAccountSelect")?.addEventListener("change", async (event) => {
  currentAgentAccountId = event.target.value;
  localStorage.setItem("flowsocial.agentAccountId", currentAgentAccountId);
  resetAgentConversation();
  $("#useDamaishuzhiBrief").disabled = currentAgentAccountId !== "account_damaishuzhi";
  await loadAgentDemo();
  await restoreAgentSession(currentAgentAccountId);
});
$("#createAgentCompany")?.addEventListener("click", async () => {
  const input = $("#newAgentCompanyName");
  const name = input.value.trim();
  if (!name) return showToast("请输入公司名称");
  const button = $("#createAgentCompany");
  button.disabled = true; button.textContent = "创建中…";
  try {
    const account = await window.FlowAPI.createAgentAccount({ name });
    currentAgentAccountId = account.id;
    localStorage.setItem("flowsocial.agentAccountId", currentAgentAccountId);
    input.value = "";
    resetAgentConversation();
    await loadAgentWorkspace();
    showToast(`已创建并切换到：${account.name}`);
  } catch (error) {
    showToast(`创建公司失败：${error.message}`);
  } finally {
    button.disabled = false; button.textContent = "创建并切换";
  }
});
$("#viewActiveStrategy")?.addEventListener("click", () => {
  if (agentOverviewCache?.activeStrategy) {
    renderActiveAgentStrategy(agentOverviewCache.activeStrategy);
    renderAgentWorkflow(agentOverviewCache);
    $("#agentStrategyDraftPanel").scrollIntoView({ behavior: "smooth", block: "start" });
  }
});
async function generateStrategyDecisionPreview(){
  if(!currentAgentSessionId)return showToast("请先完成策略诊断");
  const button=$("#generateStrategyDecisionPreview");const refresh=$("#refreshStrategyDecisionPreview");
  if(button){button.disabled=true;button.textContent="正在计算推荐…";}if(refresh)refresh.disabled=true;
  const feedback=$("#agentDecisionFeedback");feedback.hidden=true;
  try{const result=await window.FlowAPI.previewStrategyDecisions(currentAgentSessionId);renderStrategyDecisionRecord(result.record,result.accounts);updateAgentStrategySteps({sessionMeta:{conversationPhase:"strategy_decision_preview"},strategyDecisionRecord:result.record,draftReadiness:{coreComplete:true}});renderStrategyHandoffState({nextAction:{type:"confirm_strategy_decisions",target:"agent",label:"确认账号与增长打法"}});$("#agentStrategyDecisionPanel").scrollIntoView({behavior:"smooth",block:"start"});showToast("账号与增长打法建议已生成，确认后还需生成并激活策略草案");}
  catch(error){feedback.hidden=false;feedback.textContent=`无法生成策略建议：${error.message}`;showToast(error.message);}
  finally{if(button){button.disabled=false;button.textContent="生成账号与增长策略建议";}if(refresh)refresh.disabled=false;}
}
$("#generateStrategyDecisionPreview")?.addEventListener("click",generateStrategyDecisionPreview);
$("#refreshStrategyDecisionPreview")?.addEventListener("click",generateStrategyDecisionPreview);
$("#agentStrategyDecisionPanel")?.addEventListener("change",(event)=>{
  const portfolio=event.target.closest('input[name="agentPortfolioMode"]');
  if(portfolio)$$('.agent-portfolio-option').forEach((item)=>item.classList.toggle("selected",item.contains(portfolio)));
  const playbook=event.target.closest('.agent-playbook-card input[type="radio"]');
  if(playbook)playbook.closest(".agent-playbook-options").querySelectorAll(".agent-playbook-card").forEach((item)=>item.classList.toggle("selected",item.contains(playbook)));
});
$("#confirmStrategyDecisions")?.addEventListener("click",async(event)=>{
  if(!currentAgentSessionId||!currentAgentStrategyDecision)return;
  const button=event.currentTarget;button.disabled=true;button.textContent="正在确认…";const feedback=$("#agentDecisionFeedback");feedback.hidden=true;
  try{const selection=collectStrategyDecisionSelection();await window.FlowAPI.saveStrategyDecisions(currentAgentSessionId,selection);const confirmed=await window.FlowAPI.confirmStrategyDecisions(currentAgentSessionId,selection);renderStrategyDecisionRecord(confirmed.record,confirmed.accounts);const refreshed=await window.FlowAPI.getAgentSession(currentAgentSessionId);renderAgentSession(refreshed);addAgentChatMessage("assistant","账号身份、账号组合和增长打法已经确认，但尚未交接内容 Agent。下一步请生成策略草案，并在审阅后确认激活。");showToast("账号身份与策略选择已写入同一账号记录，下一步生成并激活策略草案");}
  catch(error){const details=asArray(error.details).map((item)=>typeof item==="string"?item:item?.message||"").filter(Boolean).join("；");const message=details||error.message;feedback.hidden=false;feedback.textContent=`确认失败：${message}`;showToast(message);}
  finally{button.disabled=false;button.textContent="确认账号与增长策略";}
});
$("#createStrategyDraft")?.addEventListener("click", async (event) => {
  if (!currentAgentSessionId) return showToast("诊断会话已失效，请刷新恢复或重新开始诊断");
  const button = event.currentTarget; button.disabled = true; button.textContent = "生成中…";
  const feedback = $("#agentDraftFeedback");
  feedback.hidden = true;
  renderAgentDraftRequestStatus({id:"正在分配",status:"running"},"请求会在服务端继续执行，断线或刷新后可以恢复");
  try {
    const result = await window.FlowAPI.createAgentStrategyDraft(currentAgentSessionId);
    renderAgentDraftRequestStatus(result.draftRequest,result.recovered?"连接恢复后读取到服务端结果":"完整校验通过");
    currentAgentDraftReadiness = result.readiness || currentAgentDraftReadiness;
    renderAgentStrategyDraft(result.draft, currentAgentDraftReadiness, result.draftRevision);
    renderStrategyHandoffState({nextAction:{type:"activate_strategy_draft",target:"agent",label:"审阅并激活策略"}});
    const semanticPassed=result.draftRevision?.validation?.semanticGate?.passed!==false;
    showToast(!semanticPassed?"草案已生成，但语义门禁未通过，暂不能激活":result.providerMode?.includes("fallback")?"fallback 草案已生成并通过语义门禁，请重点复核来源风险":"策略草案生成成功");
  }
  catch (error) {
    const details = asArray(error.details).join("；");
    renderAgentDraftRequestStatus({id:error.requestId||"未知",status:"failed"},error.code==="STRATEGY_DRAFT_REQUEST_TIMEOUT"?"服务端状态可稍后继续查询":error.message);
    feedback.hidden = false;
    feedback.textContent = `本轮新草案生成失败：${details || error.message}。当前生效策略未受影响，也不代表本轮已成功。`;
    showToast(`策略草案生成失败：${details || error.message}`);
    try { renderAgentSession(await window.FlowAPI.getAgentSession(currentAgentSessionId)); } catch (_) {}
  }
  finally { button.disabled = !currentAgentDraftReadiness?.canGenerateDraft; button.textContent = currentAgentStrategyDraft ? "更新策略草案" : "根据当前信息生成策略草案"; }
});
$("#continueAgentChat")?.addEventListener("click", () => { $("#agentStrategyDraftPanel").hidden = true; $("#agentMessageInput").focus(); });
$("#activateAgentStrategy")?.addEventListener("click", async (event) => {
  if (!currentAgentSessionId || !currentAgentStrategyDraft || !currentAgentDraftRevision?.id) return;
  const button = event.currentTarget; button.disabled = true; button.textContent = "激活并同步方向…";
  try {
    const activated=await window.FlowAPI.activateAgentStrategy(currentAgentSessionId, currentAgentDraftRevision.id);
    renderActiveAgentStrategy(activated.snapshot);
    setContentPlanningGate(activated.contentPlanningReadiness);
    renderStrategyHandoffState(activated.strategySessionState,activated.contentPlanningReadiness);
    $("#agentChatCompose").hidden = false;
    currentAgentEditFieldPath = null;
    $("#agentComposeContext").hidden = true;
    $("#agentPostCompleteActions").hidden = false;
    addAgentChatMessage("assistant", "策略已经确认并激活，并已为所选社媒账号建立有效策略。现在可以进入内容计划生成7/14/30天滚动计划；如果继续修改基本信息，会形成下一版草案，不会直接覆盖当前策略。");
    await loadAgentDemo(true);
    updateAgentStrategySteps({sessionMeta:{conversationPhase:"strategy_active"},strategySessionState:activated.strategySessionState,draftReadiness:{coreComplete:true},strategyDecisionRecord:{status:"confirmed"}});
    await refreshRuntimeStatus();
    showToast("策略已激活，领域方向已同步到热点发掘");
    $("#agentWorkflowPanel").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) { showToast(`策略激活失败：${error.message}`); }
  finally { button.disabled = false; button.textContent = "确认并激活策略"; }
});
$("#agentDownstreamSummary")?.addEventListener("click", async (event) => {
  const topic = event.target.closest("[data-agent-topic-id]");
  const content = event.target.closest("[data-agent-content-id]");
  if (topic) {
    const topicRecord = agentOverviewCache?.downstream?.topics?.find((item) => item.id === topic.dataset.agentTopicId);
    if (topicRecord) {
      currentDirectionId = topicRecord.directionId;
      currentTopicCategory = topicRecord.topicCategory || "keyword";
      switchView("opportunities");
      await loadDirections();
      await loadTopics(currentTopicCategory);
      document.querySelector(`[data-topic-result="${CSS.escape(topicRecord.id)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
  if (content) location.href = `/?contentTaskId=${encodeURIComponent(content.dataset.agentContentId)}`;
});

async function loadDirections() {
  try {
    const result = await window.FlowAPI.getDirections(currentAgentAccountId || "account_damaishuzhi");
    if (!result.items?.length) return;
    directionsCache = result.items;
    if (!directionsCache.some((item) => item.id === currentDirectionId)) currentDirectionId = directionsCache[0].id;
    $("#directionTabs").innerHTML = `${directionsCache.map((direction) => `<button class="${direction.id === currentDirectionId ? "active" : ""}" data-direction-id="${direction.id}"><span class="direction-icon ${direction.id === "direction_ai" ? "ai" : "site"}">${direction.shortName || direction.name.slice(0, 2)}</span><div><strong>${direction.name}</strong><small>${direction.description || (direction.keywords || []).slice(0, 3).join(" · ")}</small></div><b>--</b></button>`).join("")}<button class="add-direction" id="addDirection"><span>＋</span><div><strong>新增关注主题</strong><small>设置关键词与更新频率</small></div></button>`;
    $("#radarDirection").innerHTML = directionsCache.map((direction) => `<option value="${direction.id}">${direction.name}</option>`).join("");
    if (currentHotspotPool === "keyword") await loadDirectionLibrary(currentDirectionId);
    else {
      await loadHotspotPool("global");
      await loadTopics(currentTopicCategory);
    }
    await loadHotspotLibrary();
  } catch (error) {
    showToast(`主题加载失败：${error.message}`);
  }
}

function renderOpportunityCollection(items = [], emptyMessage = "当前热点池还没有数据，点击“开始扫描”进行实时采集。") {
  $("#directionHotspotCount").textContent = items.length;
  $("#opportunityList").innerHTML = items.map((opportunity, index) => `<button class="opp-list-card ${index === 0 ? "active" : ""}" data-opp="${opportunity.id}"><div class="opp-top"><span class="trend-label ${opportunity.trend === "rising" ? "rising" : "stable"}">${opportunity.poolType === "global" ? "全网热议" : "关键词上升"}</span><time>${opportunity.expiresInHours || 72}h 后更新</time></div><h3>${escapeHtml(opportunity.title)}</h3><p>${escapeHtml(opportunity.summary)}</p><div class="opp-bottom"><span>热点分 <b>${opportunity.score}</b></span><span>${opportunity.sourceCount} 个来源</span><span>${opportunity.signalCount || opportunity.sourceEvidence?.length || 0} 条信号</span></div></button>`).join("") || `<div class="empty-state">${emptyMessage}</div>`;
  items.forEach((opportunity) => { opportunityData[opportunity.id] = { title: opportunity.title, summary: opportunity.summary, full: opportunity }; });
  if (items[0]) renderHotspotOpportunity(items[0]);
}

async function loadHotspotPool(poolType = currentHotspotPool) {
  currentHotspotPool = poolType;
  const result = await window.FlowAPI.getHotspots(poolType, poolType === "keyword" ? currentDirectionId : "", activeHotspotCompanyId());
  renderOpportunityCollection(result.items || []);
  if (result.latestRun) {
    const time = new Date(result.latestRun.completedAt || result.latestRun.createdAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
    $("#directionUpdated").textContent = `${poolType === "global" ? "无关键词全网热点" : "关键词热点"} · 上次采集：${time}`;
  } else {
    $("#directionUpdated").textContent = `${poolType === "global" ? "无关键词全网热点" : "关键词热点"} · 尚未采集`;
  }
}

function renderTopicResults(items = [], latestRun = null) {
  topicResultsCache = items;
  if (latestRun) {
    $("#topicPipelineStatus").innerHTML = `<span>${latestRun.status === "succeeded" ? "已生成可用选题" : "候选需要完善"}</span><span>期待 ${latestRun.requestedCandidateCount || "--"} · 产出 ${latestRun.outputCount ?? items.length}</span><span>共评估 ${latestRun.candidateCount || 0} · 推荐 ${latestRun.approvedCount || 0}</span><span>待完善 ${latestRun.reviewableCount || 0} · 淘汰 ${latestRun.rejectedCount || 0}</span>`;
  }
  const topicHtml = items.map((topic) => {
    const mother = topic.motherTopic || {};
    const xhs = topic.platformTopics?.xiaohongshu || {};
    const wechat = topic.platformTopics?.wechat || {};
    const connection = topic.connection?.realIntersection ? `<div class="topic-connection"><strong>真实交集：</strong>${escapeHtml(topic.connection.realIntersection)}<br><strong>不是硬蹭：</strong>${escapeHtml(topic.connection.whyConnectionWorks || "已通过连接门控")}</div>` : "";
    const platformCard = (platform, label, data) => `<article class="platform-topic-card ${Number(data.fit_score || 0) < 60 ? "low-fit" : ""}"><header><strong>${label}</strong><span>适配分 ${Number(data.fit_score || 0)}</span></header><h4>${escapeHtml(data.platform_topic || "该平台暂不建议使用")}</h4><p>${escapeHtml(platform === "xiaohongshu" ? (data.single_promise || data.practical_value || data.fit_reason) : (data.information_gain || data.core_argument || data.fit_reason))}</p><footer><small>${escapeHtml(platform === "xiaohongshu" ? `收藏理由：${data.save_trigger || "待补充"}` : `转发理由：${data.share_reason || "待补充"}`)}</small><button class="btn secondary" data-select-topic="${topic.id}" data-platform="${platform}" ${!data.platform_topic ? "disabled" : ""}>选择此子选题</button></footer></article>`;
    return `<article class="topic-result-card" data-topic-result="${topic.id}"><div class="topic-result-main"><div class="topic-score"><strong>${Number(topic.scores?.overall || 0)}</strong><span>母选题分</span></div><div class="topic-mother"><div class="topic-mother-head"><span class="topic-category-badge ${topic.topicCategory === "cross_trend" ? "fusion" : ""}">${topic.topicCategory === "cross_trend" ? "推荐结合选题" : "AI / 业务领域选题"}</span><span class="topic-status-badge ${topic.status === "needs_research" ? "research" : ""}">${topic.status === "needs_research" ? "需要补充研究" : "已通过主编门控"}</span></div><h3>${escapeHtml(mother.title)}</h3><p>${escapeHtml(mother.readerValue || mother.coreQuestion)}</p>${connection}</div></div><div class="platform-topic-grid">${platformCard("xiaohongshu", "小红书图文子选题", xhs)}${platformCard("wechat", "微信公众号子选题", wechat)}</div></article>`;
  }).join("");
  const rejectedById = new Map((latestRun?.rejected || latestRun?.gate?.rejected || []).map((item) => [item.candidateId, item]));
  const auditHtml = !topicHtml && latestRun?.candidates?.length ? `<section class="topic-audit-list"><h3>本次候选审核结果</h3>${latestRun.candidates.map((candidate) => { const rejected = rejectedById.get(candidate.candidateId); return `<article><div><strong>${escapeHtml(candidate.motherTitle || "未命名候选")}</strong><small>${candidate.category === "cross_trend" ? "推荐结合" : "关键词直接"} · 综合分 ${candidate.scores?.overall ?? "--"}</small></div><span class="${rejected ? "rejected" : "review"}">${escapeHtml(rejected?.reason || "需要补充研究后再使用")}</span></article>`; }).join("")}</section>` : "";
  $("#topicResults").innerHTML = topicHtml || auditHtml || `<div class="empty-state">尚未生成选题。请先选择具体热点，再点击“生成选题”。</div>`;
}

async function loadTopics(category = currentTopicCategory) {
    const result = await window.FlowAPI.getTopics(currentDirectionId, category, currentAgentAccountId || "account_damaishuzhi");
  renderTopicResults(result.items || [], result.latestRun);
}

async function setHotspotPool(poolType, load = true) {
  currentHotspotPool = poolType;
  $$("#hotspotPoolTabs button").forEach((button) => button.classList.toggle("active", button.dataset.poolMode === poolType));
  const isGlobal = poolType === "global";
  $("#radarKeywordField").hidden = isGlobal;
  $("#radarDirectionField").hidden = isGlobal;
  $$(".global-source").forEach((button) => { button.hidden = !isGlobal; });
  $$(".keyword-source").forEach((button) => { button.hidden = isGlobal; });
  $("#radarWindow").value = isGlobal ? "1" : "7";
  $("#radarModeDescription").textContent = isGlobal
    ? "全网热点无需关键词，从百度公开热榜与 Google Trends RSS 获取当前热议事件。"
    : "关键词热点使用 RedFox 搜索小红书、抖音和微信公众号公开内容，并按业务主题形成独立热点池。";
  $("#runHotspotRadar").textContent = isGlobal ? "采集全网热点" : "搜索关键词热点";
  if (load) {
    if (isGlobal) await loadHotspotPool("global");
    else await loadDirectionLibrary(currentDirectionId);
  }
}

async function loadGenerationAccounts() {
  try {
    const result = await window.FlowAPI.getAccounts();
    const accounts = (result.items || []).filter((item) => item.accountType !== "company");
    const companies = (result.items || []).filter((item) => item.accountType === "company");
    if ($("#workspaceAccountSummary")) $("#workspaceAccountSummary").textContent = `品牌工作区 · ${companies.length} 家公司 / ${accounts.length} 个社媒账号`;
    if (!accounts.length) return;
    accountsCache = accounts;
    const selected = $("#accountSelect").value;
    $("#accountSelect").innerHTML = accounts.map((account) => `<option value="${account.id}">${account.name} · ${platformLabel(account.platform)} · ${modeLabel(account.businessMode)}</option>`).join("");
    if (accounts.some((account) => account.id === selected)) $("#accountSelect").value = selected;
    const active = accounts.find((account) => account.id === $("#accountSelect").value) || accounts[0];
    if (active) {
      $("#activeStyleName").textContent = `${active.name} · ${active.visualStyle?.name || "账号视觉系统"}`;
      const company = (result.items || []).find((item) => item.id === active.companyId);
      $("#generationOwnershipContext").textContent = `当前公司：${active.companyName || company?.name || active.companyId || "待确认"} · 当前账号：${active.name}`;
    }
  } catch (error) {
    showToast(`账号风格加载失败：${error.message}`);
  }
}

async function loadDirectionLibrary(directionId) {
  try {
    currentDirectionId = directionId;
    const result = await window.FlowAPI.getDirectionLibrary(directionId);
    currentDirectionLibrary = result;
    $$("#directionTabs [data-direction-id]").forEach((button) => button.classList.toggle("active", button.dataset.directionId === directionId));
    const direction = result.direction;
    $("#radarDirection").value = directionId;
    $("#radarKeywords").value = (direction.searchKeywords || direction.keywords || []).join(", ");
    $("#keywordProfileSummary").textContent = `核心词 ${(direction.coreKeywords || direction.keywords || []).length} 个 · 平台词 ${(direction.platformKeywords || []).length} 个 · 场景词 ${(direction.scenarioKeywords || []).length} 个 · 排除词 ${(direction.excludeKeywords || []).length} 个`;
    $("#directionUpdated").textContent = `${direction.refreshSchedule === "daily" ? "每日自动更新" : direction.refreshSchedule} · 上次更新：${direction.lastRefreshedAt ? new Date(direction.lastRefreshedAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "尚未更新"}`;
    $("#directionHotspotCount").textContent = result.opportunities.length;
    const tabCount = $(`#directionTabs [data-direction-id="${directionId}"] b`);
    if (tabCount) tabCount.textContent = result.opportunities.length;
    renderOpportunityCollection(result.opportunities, "该主题还没有关键词热点，点击“更新热点库”开始采集。");
    await loadTopics(currentTopicCategory);
  } catch (error) {
    showToast(`热点库加载失败：${error.message}`);
  }
}

function platformLabel(platform) {
  return { xiaohongshu: "小红书", wechat: "微信公众号", instagram: "Instagram", facebook: "Facebook", douyin: "抖音", channels: "视频号" }[platform] || platform;
}

function modeLabel(mode) {
  return { content_as_product: "内容即产品", professional_lead: "专业内容获客", product_sales: "产品展示销售", brand_mix: "品牌综合运营" }[mode] || mode;
}

function accountConfigurationLabel(account={}) {
  if(account.status==="disabled"||account.configurationStatus==="disabled")return "已停用";
  return account.configurationStatus==="configured"?"设置完整":"待完善";
}

async function loadAccounts(preferredId = null) {
  try {
    const result = await window.FlowAPI.getAccounts();
    accountsCache = result.items.filter((item) => item.accountType !== "company");
    $("#accountManagementList").innerHTML = accountsCache.map((account, index) => {const label=accountConfigurationLabel(account);const stateClass=account.configurationStatus==="setup_required"?"setup-required":account.status==="disabled"?"disabled":"";return `<button class="managed-account ${index === 0 ? "active" : ""}" data-account-id="${account.id}"><span class="platform-logo ${account.platform === "xiaohongshu" ? "xhs" : account.platform === "wechat" ? "wx" : "ins"}">${platformLabel(account.platform).slice(0, 2)}</span><div><strong>${escapeHtml(account.name)}</strong><small>${platformLabel(account.platform)} · ${escapeHtml(account.operatorName||account.companyName||"运营主体待确认")}</small></div><i class="${stateClass}">${label}</i></button>`;}).join("")||`<div class="empty-state">当前公司还没有社媒账号。点击“新增账号”后，账号才会进入策略选择。</div>`;
    const requestedId=preferredId||new URLSearchParams(location.search).get("accountId");
    if(accountsCache.length)await selectAccount(accountsCache.some((account) => account.id === requestedId) ? requestedId : accountsCache[0].id);
    else $("#newAccount")?.click();
  } catch (error) {
    showToast(`账号加载失败：${error.message}`);
  }
}

async function selectAccount(id) {
  const account = accountsCache.find((item) => item.id === id);
  if (!account) return;
  $$(".managed-account").forEach((item) => item.classList.toggle("active", item.dataset.accountId === id));
  $("#accountId").value = account.id;
  $("#accountName").value = account.name;
  $("#accountPlatform").value = account.platform;
  $("#accountMode").value = account.businessMode;
  $("#accountAudience").value = account.audience || "";
  $("#accountTone").value = account.tone || "";
  $("#accountPillars").value = (account.contentPillars || []).join(", ");
  $("#accountCompanyDisplay").value=account.companyName||account.companyId||"待选择公司";
  $("#accountConfigurationStatus").value=accountConfigurationLabel(account);
  $("#accountOperator").value=account.operatorName||account.companyName||"";
  $("#accountStatus").value=account.status==="disabled"?"disabled":"active";
  $("#accountSubjectType").value=account.accountIdentity?.subjectType||"";
  $("#accountSpeakerType").value=account.accountIdentity?.speakerType||"";
  $("#accountSpeakerDetail").value=account.accountIdentity?.speakerDetail||"";
  const trustSources=new Set(asArray(account.accountIdentity?.trustSources));
  $$('[data-account-trust]').forEach((input)=>{input.checked=trustSources.has(input.dataset.accountTrust);});
  $("#accountVisualStyle").value = account.visualStyle?.description || "";
  const visualRefs = asArray(account.visualStyle?.assetRefs);
  const viCount = visualRefs.filter((item) => item.assetType === "vi").length;
  const templateCount = visualRefs.filter((item) => item.assetType === "template").length;
  $("#viFileCount").textContent = viCount ? `${viCount} 个已持久化文件` : "尚未上传";
  $("#templateFileCount").textContent = templateCount ? `${templateCount} 个已持久化模板` : "尚未上传";
  $("#accountFormTitle").textContent = account.name;
  await loadAccountDesignDna(account.id);
}

function renderAccountDesignDna(snapshot, snapshotRef = null, accountId = null) {
  const panel = $("#accountDesignDnaPanel");
  if (!panel) return;
  currentAccountDesignDnaSnapshotRef = snapshot && snapshotRef && accountId
    ? { accountId, id: snapshotRef.id, hash: snapshotRef.hash }
    : null;
  if (!snapshot) {
    panel.innerHTML = '<span class="eyebrow">第三步 · 最终确认</span><h3>尚未设置</h3><p>识别并保存后，你可以在这里确认最终版本。只有你确认的版本才会用于后续小红书生图。</p>';
    return;
  }
  const sources = asArray(snapshot.sources).map((source) => `<span>${escapeHtml(source.name)} · 已作为风格依据</span>`).join("");
  panel.innerHTML = `<span class="eyebrow">第三步 · 第 ${snapshot.version} 版</span><h3>${snapshot.status === "confirmed" ? "这套风格正在使用" : "最后确认这套风格"}</h3><p>${snapshot.status === "confirmed" ? "后续小红书整页图文会按照这套已确认风格生成。" : "确认前，你仍可以返回上方修改风格总结或高级规则。"}</p><div class="source-rationale-v2">${sources}<span>品牌色：${escapeHtml(asArray(snapshot.colors).join("、") || "待补充")}</span><span>页面风格：${escapeHtml(asArray(snapshot.layoutPreferences).join("、") || "待补充")}</span><span>图片感觉：${escapeHtml(snapshot.photographyOrIllustrationDirection === "isometric_illustration" ? "统一品牌插画" : "真实品牌摄影")}</span><span>补充要求：${escapeHtml(snapshot.referenceNotes || "无")}</span></div>${snapshot.status === "confirmed" ? "" : '<button type="button" class="btn primary" id="confirmAccountDesignDna">确认使用这套风格</button>'}`;
}

function setDesignDnaRuleField(selector, values) {
  const field = $(selector);
  if (field) field.value = asArray(values).join(", ");
}

function renderDesignDnaAuthoring(snapshot, availableSources = [], analysisDraft = null) {
  currentAccountDesignDnaSources = asArray(availableSources).map((item) => ({ ...item }));
  const draftHasSignals = analysisDraft?.status === "ready_for_review" && ["colors", "fontPreferences", "layoutPreferences", "materials", "forbiddenMotifs"].some((key) => asArray(analysisDraft?.[key]).length);
  const editable = draftHasSignals ? analysisDraft : snapshot;
  setDesignDnaRuleField("#accountDnaColors", editable?.colors);
  setDesignDnaRuleField("#accountDnaFonts", editable?.fontPreferences);
  setDesignDnaRuleField("#accountDnaLayouts", editable?.layoutPreferences);
  setDesignDnaRuleField("#accountDnaMaterials", editable?.materials);
  setDesignDnaRuleField("#accountDnaForbidden", editable?.forbiddenMotifs);
  $("#accountDnaMediaDirection").value = ["editorial_photography", "isometric_illustration"].includes(editable?.photographyOrIllustrationDirection) ? editable.photographyOrIllustrationDirection : "";
  $("#accountDnaNotes").value = editable?.referenceNotes || "";
  const container = $("#accountDnaSourceList");
  container.innerHTML = currentAccountDesignDnaSources.length
    ? currentAccountDesignDnaSources.map((source) => {
      const ready = ["ready", "visual_ready"].includes(source.parseStatus);
      const isPdf = source.parseMode === "pdf_page_vision" || /\.pdf$/i.test(source.name || "");
      const detail = isPdf
        ? source.pageCount ? `已检测到 ${source.pageCount} 页视觉内容` : "PDF 将按每一页画面识别"
        : source.parseMode === "image_metadata" ? "图片已上传" : ready ? "内容已读取" : "资料处理失败";
      return `<article class="visual-source-item"><span class="visual-source-icon">${isPdf ? "PDF" : "资料"}</span><div><strong>${escapeHtml(source.name || source.fileId)}</strong><small>${escapeHtml(detail)} · ${ready ? "等待或已完成识别" : "请重新上传"}</small></div><em class="${ready ? "ready" : "error"}">${ready ? "可识别" : "不可用"}</em></article>`;
    }).join("")
    : "<p>还没有上传品牌资料。你也可以在高级规则里手动创建一套风格。</p>";
  const status = $("#accountVisualAnalysisStatus");
  const coverage = asArray(analysisDraft?.contentCoverage);
  const pagesTotal = coverage.reduce((sum, item) => sum + Number(item.pagesTotal || 0), 0);
  const pagesAnalyzed = coverage.reduce((sum, item) => sum + Number(item.pagesAnalyzed || 0), 0);
  if (status) status.textContent = draftHasSignals
    ? `识别完成${pagesTotal ? `：已读取 ${pagesTotal} 页，分析 ${pagesAnalyzed} 页` : ""}。请检查下方风格总结。`
    : currentAccountDesignDnaSources.length ? "资料已经准备好，点击下方按钮开始识别品牌风格。" : "上传资料后，点击“开始识别品牌风格”。";
  const preview = $("#accountDnaColorPreview");
  if (preview) preview.innerHTML = asArray(editable?.colors).length
    ? asArray(editable.colors).slice(0, 8).map((color) => `<span class="visual-color-chip"><i style="background:${/^#[0-9a-f]{6}$/i.test(color) ? color : "#ECE9E2"}"></i>${escapeHtml(color)}</span>`).join("")
    : "<span>等待识别</span>";
  const layoutSummary = $("#accountDnaLayoutSummary");
  if (layoutSummary) layoutSummary.textContent = asArray(editable?.layoutPreferences).slice(0, 3).join(" · ") || "等待识别";
  const technical = $("#accountVisualTechnicalDetails");
  if (technical) technical.textContent = draftHasSignals
    ? `分析方式：${coverage.some((item) => item.analysisMode === "page_vision") ? "PDF 页面视觉识别" : "资料内容识别"} · 覆盖：${pagesTotal ? `${pagesAnalyzed}/${pagesTotal} 页` : `${currentAccountDesignDnaSources.length} 份资料`} · 调用 ${analysisDraft.providerCalls || 0} 次 · 未自动重试`
    : "尚无分析详情。";
  const state = $("#accountVisualGuidelineState");
  if (state) state.textContent = snapshot?.status === "confirmed" ? "已启用" : draftHasSignals ? "等待确认" : currentAccountDesignDnaSources.length ? "待识别" : "尚未设置";
}

async function loadAccountDesignDna(accountId) {
  try {
    const result = await window.FlowAPI.getDesignDna(accountId);
    if ($("#accountId").value !== accountId) return;
    renderAccountDesignDna(result.item, result.snapshotRef, accountId);
    renderDesignDnaAuthoring(result.item, result.availableSources, result.analysisDraft);
    return result;
  } catch (error) {
    if ($("#accountId").value === accountId) {
      renderAccountDesignDna(null);
      renderDesignDnaAuthoring(null, [], null);
    }
    showToast(`Design DNA 读取失败：${error.message}`);
    return null;
  }
}

async function loadKnowledge(query = "") {
  try {
    const companyId = currentAgentAccountId || "account_damaishuzhi";
    const [foldersResult, filesResult] = await Promise.all([window.FlowAPI.getKnowledgeFolders(companyId), window.FlowAPI.getKnowledgeFiles(currentKnowledgeFolderId, query, companyId)]);
    knowledgeFoldersCache = foldersResult.items || [];
    if (!currentKnowledgeFolderId && knowledgeFoldersCache[0]) currentKnowledgeFolderId = knowledgeFoldersCache[0].id;
    if (currentKnowledgeFolderId && !filesResult.folderId) {
      const refreshed = await window.FlowAPI.getKnowledgeFiles(currentKnowledgeFolderId, query, companyId);
      knowledgeFilesCache = refreshed.items || [];
    } else {
      knowledgeFilesCache = filesResult.items || [];
    }
    renderKnowledgeBrowser();
  } catch (error) {
    showToast(`知识库加载失败：${error.message}`);
  }
}

function renderKnowledgeBrowser() {
  const folder = knowledgeFoldersCache.find((item) => item.id === currentKnowledgeFolderId) || knowledgeFoldersCache[0];
  $("#knowledgeFolderList").innerHTML = knowledgeFoldersCache.map((item) => `<button class="knowledge-folder ${item.id === currentKnowledgeFolderId ? "active" : ""}" data-folder-id="${item.id}"><span>${item.icon || "▤"}</span><div><strong>${item.name}</strong><small>${item.description || "自定义知识文件夹"}</small></div><b>${item.fileCount || 0}</b></button>`).join("") || `<div class="empty-state">还没有文件夹</div>`;
  $("#knowledgeTotalFiles").textContent = `${knowledgeFoldersCache.reduce((sum, item) => sum + (item.fileCount || 0), 0)} 个文件`;
  if (folder) {
    $("#currentFolderName").textContent = folder.name;
    $("#currentFolderDescription").textContent = folder.description || "上传资料并添加标签，生成时 AI 可以按需引用。";
  }
  $("#knowledgeFileList").innerHTML = knowledgeFilesCache.map((file) => `<article class="knowledge-file-card" data-file-id="${escapeHtml(file.id)}"><div class="file-type ${file.kind || "document"}">${file.kind === "image" ? "IMG" : file.kind === "video" ? "VID" : file.kind === "sheet" ? "XLS" : "DOC"}</div><div><strong>${escapeHtml(file.name)}</strong><small>${escapeHtml(file.sizeLabel || "资料文件")} · ${escapeHtml(file.updatedLabel || "最近更新")}</small><p>${escapeHtml(file.description || "暂无内容说明")}</p><div>${(file.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}<span class="parse-badge ${escapeHtml(file.parseStatus || "pending")}">${file.parseStatus === "ready" ? `可检索 · ${file.chunkCount || 0} 段` : file.parseStatus === "failed" ? `解析失败：${escapeHtml(file.errorMessage || "格式不支持")}` : file.parseStatus === "metadata_only" ? "旧记录 · 请重新上传" : "处理中"}</span></div></div><button aria-label="文件菜单">•••</button></article>`).join("") || `<div class="empty-state file-empty">该文件夹还没有资料，上传后系统会自动解析并建立索引。</div>`;
}

async function loadGenerationKnowledgeAssets() {
  try {
    const account = accountsCache.find((item) => item.id === $("#accountSelect").value);
    const result = await window.FlowAPI.getKnowledgeFolders(account?.companyId || currentAgentAccountId || "");
    const folders = result.items || [];
    const selected = new Set($$("#assetList .asset-card.selected").map((item) => item.dataset.asset));
    $("#assetList").innerHTML = folders.map((folder, index) => `<button class="asset-card ${selected.has(folder.id) || (!selected.size && index === 0) ? "selected" : ""}" data-asset="${escapeHtml(folder.id)}"><span class="asset-thumb company">${escapeHtml((folder.icon || folder.name.slice(0, 1)).slice(0, 2))}</span><span><strong>${escapeHtml(folder.name)}</strong><small>${folder.fileCount || 0} 个文件 · ${escapeHtml(folder.description || "企业知识资料")}</small></span><i>${selected.has(folder.id) || (!selected.size && index === 0) ? "✓" : "+"}</i></button>`).join("");
    updateKnowledgeControls(false);
  } catch (error) {
    showToast(`知识文件夹加载失败：${error.message}`);
  }
}

function providerKeyHint(configured) {
  return configured ? "已安全保存，留空表示不修改" : "尚未配置，请输入 API Key";
}

const modelProviderPresets = {
  deepseek: { provider: "DeepSeek", baseUrl: "https://api.deepseek.com", model: "deepseek-chat", protocol: "openai" },
  minimax: { provider: "MiniMax", baseUrl: "https://api.minimaxi.com/anthropic", model: "MiniMax-M3", protocol: "anthropic" }
};

function detectModelProviderPreset(model = {}) {
  const provider = String(model.provider || "").toLowerCase();
  const baseUrl = String(model.baseUrl || "").toLowerCase();
  if (provider.includes("deepseek") || baseUrl.includes("api.deepseek.com")) return "deepseek";
  if (provider.includes("minimax") || baseUrl.includes("api.minimaxi.com")) return "minimax";
  return "custom";
}

function applyModelProviderPreset(form, presetName) {
  const preset = modelProviderPresets[presetName];
  if (!preset) return;
  form.elements.modelProvider.value = preset.provider;
  form.elements.modelBaseUrl.value = preset.baseUrl;
  form.elements.modelName.value = preset.model;
  form.elements.modelProtocol.value = preset.protocol;
}

function renderProviderConfig(config) {
  let panel = $("#providerConfigPanel");
  if (!panel) {
    $("#integrationStatus").insertAdjacentHTML("afterend", `
      <section class="surface provider-config-panel" id="providerConfigPanel">
        <div class="surface-head">
          <div><span class="eyebrow">API KEY 配置</span><h2>模型与热点服务</h2><p>密钥仅提交到本地服务端并写入 .env.local，不会保存在浏览器中。</p></div>
          <span class="version-chip">本机私密配置</span>
        </div>
        <form id="providerConfigForm" class="provider-config-form">
          <fieldset class="provider-model-fieldset">
            <legend><span>LLM</span> <b id="modelProviderLegend">通用模型</b></legend>
            <label>供应商预设<select name="modelPreset" id="modelProviderPreset"><option value="deepseek">DeepSeek</option><option value="minimax">MiniMax</option><option value="custom">自定义兼容 API</option></select></label>
            <label>API Key<input name="modelApiKey" type="password" autocomplete="new-password" /></label>
            <div class="provider-advanced">
              <label>供应商名称<input name="modelProvider" placeholder="例如 DeepSeek、OpenAI、硅基流动" /></label>
              <label>Base URL<input name="modelBaseUrl" type="url" /></label>
              <label>模型名称<input name="modelName" list="modelNameSuggestions" /><datalist id="modelNameSuggestions"><option value="deepseek-chat"></option><option value="deepseek-reasoner"></option><option value="MiniMax-M3"></option></datalist></label>
              <label>接口协议<select name="modelProtocol"><option value="openai">OpenAI 兼容</option><option value="anthropic">Anthropic 兼容</option></select></label>
              <small>其他模型请选择“自定义兼容 API”，填写供应商、地址、模型名和协议。</small>
            </div>
          </fieldset>
          <fieldset>
            <legend><span>热点</span> RedFox</legend>
            <label>RedFox API Key<input name="redfoxApiKey" type="password" autocomplete="new-password" /></label>
            <div class="provider-advanced">
              <label>Base URL<input name="redfoxBaseUrl" type="url" /></label>
              <small>已接入抖音、小红书和微信公众号关键词作品搜索。</small>
            </div>
          </fieldset>
          <fieldset>
            <legend><span>生图</span> Kie.ai</legend>
            <label>Kie.ai API Key<input name="kieApiKey" type="password" autocomplete="new-password" /></label>
            <div class="provider-advanced">
              <label>Base URL<input name="kieBaseUrl" type="url" /></label>
              <label>生图模型<input name="kieImageModel" /></label>
            </div>
          </fieldset>
          <div class="provider-config-actions"><small id="modelConnectionResult">保存后立即生效，无需重启服务。</small><div><button class="btn secondary" type="button" id="testModelConnection">测试模型连接</button><button class="btn primary" type="submit">保存 API 配置</button></div></div>
        </form>
      </section>`);
    panel = $("#providerConfigPanel");
    $("#modelProviderPreset").addEventListener("change", (event) => {
      applyModelProviderPreset($("#providerConfigForm"), event.target.value);
      const providerName = $("#providerConfigForm").elements.modelProvider.value || "通用模型";
      $("#modelProviderLegend").textContent = providerName;
    });
    ["modelProvider", "modelBaseUrl", "modelName", "modelProtocol"].forEach((name) => {
      $("#providerConfigForm").elements[name].addEventListener("input", () => {
        const form = $("#providerConfigForm");
        const presetName = form.elements.modelPreset.value;
        const preset = modelProviderPresets[presetName];
        const matchesPreset = preset
          && form.elements.modelProvider.value === preset.provider
          && form.elements.modelBaseUrl.value === preset.baseUrl
          && form.elements.modelName.value === preset.model
          && form.elements.modelProtocol.value === preset.protocol;
        if (!matchesPreset) form.elements.modelPreset.value = "custom";
        $("#modelProviderLegend").textContent = form.elements.modelProvider.value || "通用模型";
      });
    });
    $("#testModelConnection").addEventListener("click", async (event) => {
      const button = event.currentTarget;
      const resultLabel = $("#modelConnectionResult");
      button.disabled = true;
      button.textContent = "正在测试...";
      resultLabel.textContent = "正在通过本地后端连接模型服务...";
      try {
        const result = await window.FlowAPI.testModelConnection();
        resultLabel.textContent = result.ok
          ? `${result.model?.provider || "LLM"} ${result.model?.model || ""} 连接正常`
          : `连接失败：${result.message || "请检查 API Key 和模型配置"}`;
        showToast(result.ok ? `${result.model?.provider || "LLM"} 模型连接正常` : `模型连接失败：${result.message || "请检查配置"}`);
      } catch (error) {
        resultLabel.textContent = `连接失败：${error.message}`;
        showToast(`模型连接测试失败：${error.message}`);
      } finally {
        button.disabled = false;
        button.textContent = "测试模型连接";
      }
    });
    $("#providerConfigForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = event.currentTarget.querySelector('button[type="submit"]');
      button.disabled = true;
      button.textContent = "正在保存...";
      try {
        const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
        const saved = await window.FlowAPI.saveProviderConfig(payload);
        renderProviderConfig(saved);
        await loadSources();
        showToast("API 配置已安全保存并立即生效");
      } catch (error) {
        showToast(`API 配置保存失败：${error.message}`);
      } finally {
        button.disabled = false;
        button.textContent = "保存 API 配置";
      }
    });
  }
  const form = $("#providerConfigForm");
  form.elements.modelPreset.value = detectModelProviderPreset(config.model);
  form.elements.modelProvider.value = config.model?.provider || "DeepSeek";
  form.elements.modelBaseUrl.value = config.model?.baseUrl || "https://api.deepseek.com";
  form.elements.modelName.value = config.model?.model || "deepseek-chat";
  form.elements.modelProtocol.value = config.model?.protocol || "openai";
  $("#modelProviderLegend").textContent = config.model?.provider || "通用模型";
  form.elements.redfoxBaseUrl.value = config.search?.baseUrl || "https://redfox.hk";
  form.elements.kieBaseUrl.value = config.image?.baseUrl || "https://api.kie.ai";
  form.elements.kieImageModel.value = config.image?.model || "gpt-image-2-text-to-image";
  form.elements.modelApiKey.value = "";
  form.elements.redfoxApiKey.value = "";
  form.elements.kieApiKey.value = "";
  form.elements.modelApiKey.placeholder = providerKeyHint(config.model?.keyConfigured);
  form.elements.redfoxApiKey.placeholder = providerKeyHint(config.search?.keyConfigured);
  form.elements.kieApiKey.placeholder = providerKeyHint(config.image?.keyConfigured);
  [...panel.querySelectorAll("fieldset")].forEach((fieldset, index) => fieldset.classList.toggle("configured", [config.model, config.search, config.image][index]?.keyConfigured));
}

async function loadSources() {
  try {
    const [integrations, config] = await Promise.all([window.FlowAPI.getIntegrations(), window.FlowAPI.getProviderConfig()]);
    renderProviderConfig(config);
    ["model", "search", "image"].forEach((key) => {
      const pill = $(`[data-integration="${key}"]`);
      const status = integrations[key];
      if (!pill || !status) return;
      pill.textContent = `${{ model: "模型", search: "搜索", image: "生图", publishing: "发布" }[key]} · ${status.configured ? "已配置" : "未配置"}`;
      pill.classList.toggle("live", status.configured);
    });
  } catch (error) {
    showToast(`连接状态加载失败：${error.message}`);
  }
}

function activateGroup(containerSelector, button) {
  $$(`${containerSelector} button`).forEach((item) => item.classList.remove("active"));
  button.classList.add("active");
}

function renderHotspotOpportunity(opportunity) {
  currentSelectedHotspotId = opportunity.id;
  opportunityData[opportunity.id] = { title: opportunity.title, summary: opportunity.summary, full: opportunity };
  const existing = $(`.opp-list-card[data-opp="${opportunity.id}"]`);
  if (!existing) {
    const card = document.createElement("button");
    card.className = "opp-list-card active";
    card.dataset.opp = opportunity.id;
    card.innerHTML = `<div class="opp-top"><span class="trend-label rising">上升中</span><time>${opportunity.expiresInHours || 72}h 后更新</time></div><h3>${escapeHtml(opportunity.title)}</h3><p>${escapeHtml(opportunity.summary)}</p><div class="opp-bottom"><span>热点分 <b>${opportunity.score}</b></span><span>${opportunity.sourceCount} 个来源</span><span>相关性 ${opportunity.relevanceScore ?? "--"}</span></div>`;
    $$(".opp-list-card").forEach((item) => item.classList.remove("active"));
    $("#opportunityList").prepend(card);
  }
  $("#detailOppTitle").textContent = opportunity.title;
  $("#detailOppSummary").textContent = opportunity.summary;
  let trace = $("#detailHotspotTrace");
  if (!trace) {
    trace = document.createElement("div");
    trace.id = "detailHotspotTrace";
    trace.className = "hotspot-trace";
    $("#detailOppSummary").after(trace);
  }
  const providerMode = opportunity.providerMode || opportunity.providerTrace?.mode || "unknown";
  const relevanceTier = opportunity.relevanceTier || "weak_experiment";
  const capturedAt = opportunity.collectedAt || opportunity.providerTrace?.collectedAt || opportunity.createdAt;
  trace.innerHTML = [
    `<span>Provider：<b>${escapeHtml(providerMode)}</b></span>`,
    `<span>相关级别：<b>${escapeHtml(relevanceTier)}</b></span>`,
    `<span>生命周期：<b>${escapeHtml(opportunity.lifecycle || "discovered")}</b></span>`,
    `<span>状态：<b>${escapeHtml(opportunity.status || "preview")}</b></span>`,
    `<span>相关理由：<b>${escapeHtml(opportunity.relevanceReason || "待人工复核")}</b></span>`,
    `<span>采集时间：<b>${escapeHtml(capturedAt ? new Date(capturedAt).toLocaleString("zh-CN") : "未知")}</b></span>`
  ].join("");
  $("#addHotspotToLibrary").disabled = opportunity.status !== "preview";
  $("#createFromHotspot").disabled = opportunity.status === "preview" || relevanceTier === "unrelated";
  $("#detailKeywords").innerHTML = (opportunity.keywords || []).map((item) => `<b>${item}</b>`).join("");
  $("#detailProducts").innerHTML = (opportunity.productFits || []).map((item) => `<b>${escapeHtml(item)}</b>`).join("") || `<span>选题阶段再匹配</span>`;
  $("#detailScore").textContent = opportunity.score ?? "--";
  $("#detailWhyHot").textContent = opportunity.whyHot || "请打开来源证据复核该热点。";
  const breakdown = opportunity.scoreBreakdown || {};
  const scoreItems = [["主题相关", breakdown.relevance], ["热度", breakdown.heat], ["时效", breakdown.freshness], ["互动", breakdown.engagement], ["证据", breakdown.evidence]];
  $("#detailScoreBreakdown").innerHTML = scoreItems.map(([label, value]) => `<li><span>${label}</span><b style="width:${Number(value) || 0}%"></b><em>${Number(value) || 0}</em></li>`).join("");
  $("#detailRisks").innerHTML = (opportunity.risks || []).map((item) => `<span>${item}</span>`).join("");
  const evidenceSection = $(".evidence-section");
  if (evidenceSection && opportunity.sourceEvidence?.length) {
    evidenceSection.innerHTML = `<h3>来源证据 <span>${opportunity.sourceEvidence.length}</span></h3>${opportunity.sourceEvidence.slice(0, 6).map((item, index) => `<div class="evidence-item"><i>${String(index + 1).padStart(2, "0")}</i><div><strong>${escapeHtml(item.source)}</strong><small>${escapeHtml(item.type)} · ${item.mode === "live" ? "实时" : item.mode === "manual_import" ? "人工导入" : "待复核"}</small><p>${escapeHtml(item.label)}：${escapeHtml(item.signal)}</p></div>${item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">打开来源</a>` : `<span>有来源</span>`}</div>`).join("")}`;
  }
}

function resetRadarStages() {
  $$("#radarStages > div").forEach((stage) => {
    stage.classList.remove("running", "done");
    stage.querySelector("small").textContent = "等待扫描";
  });
}

async function animateRadarStages(stages) {
  for (const result of stages) {
    const stage = $(`#radarStages [data-stage="${result.id}"]`);
    if (!stage) continue;
    stage.classList.add("running");
    stage.querySelector("small").textContent = "正在处理...";
    await new Promise((resolve) => setTimeout(resolve, 180));
    stage.classList.remove("running");
    stage.classList.add("done");
    stage.querySelector("small").textContent = `${result.count} 项 · ${result.note || "完成"}`;
  }
}

$("#platformTabs").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-platform]");
  if (!button) return;
  invalidateAgentWorkflowForChangedInput();
  activateGroup("#platformTabs", button);
  $("#generationPlatformSelect").value = button.dataset.platform;
  updatePreview(button.dataset.platform);
});

$("#accountSelect").addEventListener("change", invalidateAgentWorkflowForChangedInput);

$("#purposeControl").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-value]");
  if (!button) return;
  invalidateAgentWorkflowForChangedInput();
  activateGroup("#purposeControl", button);
  const content = purposeContent[button.dataset.value];
  if (button.dataset.value === "product_service_promotion") {
    const focused = $('#marketingControl button[data-value="focused"]');
    focused.click();
  }
  updateKnowledgeControls(true);
  showToast(`内容目的：${content.label} · ${content.description}`);
});

$("#hookToggle").addEventListener("change", (event) => {
  $("#hookOptions").style.display = event.target.checked ? "block" : "none";
  const overlay = $("#previewOverlay");
  if (event.target.checked) {
    overlay.style.display = "block";
    showToast("已开启内容钩子");
  } else {
    overlay.style.display = "none";
    showToast("已关闭钩子，内容将直接进入主题");
  }
});

$("#hookTypes").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-hook]");
  if (!button) return;
  activateGroup("#hookTypes", button);
  showToast(`钩子类型已改为：${button.textContent}`);
});

$("#marketingControl").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-value]");
  if (!button) return;
  invalidateAgentWorkflowForChangedInput();
  if ($("#purposeControl .active")?.dataset.value === "product_service_promotion" && button.dataset.value === "none") {
    $('#marketingControl button[data-value="focused"]').click();
    return showToast("产品/服务推广需要至少轻度带出，当前保持重点推广");
  }
  activateGroup("#marketingControl", button);
  const ratio = $(".ratio-note i");
  const promoSlide = $(".promo-slide");
  const values = { none: ["100%", "不插入产品或服务"], soft: ["80%", "先提供价值，再自然带出"], focused: ["60%", "产品或服务是内容重点"] };
  ratio.style.width = values[button.dataset.value][0];
  $("#promotionNote span:last-child").textContent = values[button.dataset.value][1];
  promoSlide.style.opacity = button.dataset.value === "none" ? ".35" : "1";
  updateKnowledgeControls(true);
  showToast(values[button.dataset.value][1]);
});

function updateKnowledgeControls(autoEnable = false) {
  const purposeId = $("#purposeControl .active")?.dataset.value || "knowledge_howto";
  const promotionMode = $("#marketingControl .active")?.dataset.value || "none";
  const purposeNeedsOwnKnowledge = ["product_service_promotion", "case_result_showcase", "brand_story", "event_announcement"].includes(purposeId);
  const shouldUseKnowledge = purposeNeedsOwnKnowledge || promotionMode !== "none";
  if (autoEnable) $("#knowledgeToggle").checked = shouldUseKnowledge;
  $("#knowledgeAssets").hidden = !$("#knowledgeToggle").checked;
  $("#knowledgeHint").textContent = $("#knowledgeToggle").checked
    ? purposeNeedsOwnKnowledge ? "引用完成本篇内容所需的公司、产品、案例或活动资料" : "仅从勾选资料中自然带出产品或服务"
    : "当前不调用产品或公司资料";
  $(".source-badge").textContent = $("#knowledgeToggle").checked ? `引用 ${$$(".asset-card.selected").length} 项资产` : "未引用知识库";
}

function setGenerationMode(mode) {
  if (currentGenerationMode !== mode && currentContentWorkflow?.state !== "content_ready") {
    currentContentWorkflow = null;
    renderContentWorkflow(null);
  }
  currentGenerationMode = mode;
  $$("#generationModeTabs button").forEach((button) => button.classList.toggle("active", button.dataset.generationMode === mode));
  $("#ideaSourcePanel").hidden = mode !== "idea";
  $("#customSourcePanel").hidden = mode !== "custom";
  $("#contentAgentPanel").hidden = mode !== "agent";
  if (mode === "agent" && !contentAgentRecommendations.length) loadContentAgentRecommendations();
  updateAgentGenerateButton();
}

function invalidateAgentWorkflowForChangedInput() {
  if (!currentContentWorkflow || currentContentWorkflow.state === "content_ready") return;
  currentContentWorkflow = null;
  renderContentWorkflow(null);
  const params = new URLSearchParams(location.search);
  params.delete("contentWorkflowId");
  params.delete("contentRunId");
  history.replaceState(null, "", `${location.pathname}${params.toString() ? `?${params.toString()}` : ""}`);
  showToast("平台或内容设置已变化，请重新生成方向与大纲");
}

const contentRoleLabel = { traffic: "流量触达", trust: "专业信任", product: "产品认知", conversion: "转化行动" };
const contentFunctionLabel = { discovery: "发现触达", authority: "专业方法", proof: "案例证据", solution: "方案理解", action: "行动转化" };
const sourceModeLabel = { hotspot: "热点", knowledge_base: "知识库", strategy_facts: "动态事实", viral_blueprint: "爆款蓝图", mixed: "混合来源", user_input_required: "需要补充素材" };

function renderContentAgentRecommendations(result) {
  contentAgentRecommendations = result.recommendations || [];
  $("#contentAgentPlanNote").textContent = result.inputMode === "mock" ? "当前使用模拟策略输入；策略确认后会自动切换为正式快照。" : "建议来自当前已确认策略、历史内容、热点与知识资产。";
  $("#contentRecommendationList").innerHTML = contentAgentRecommendations.map((item, index) => {
    const blocked = item.duplication?.decision === "block" || item.sourcePlan?.sources?.some((source) => source.type === "user_input_required");
    const duplicateLabel = { allow: "低重复", warn: "注意相近", rework: "建议换角度", block: "高度重复" }[item.duplication?.decision] || "待检查";
    const source = sourceModeLabel[item.sourcePlan?.mode] || item.sourcePlan?.mode || "待规划";
    return `<article class="content-recommendation-card ${selectedContentAgentRecommendation?.id === item.id ? "selected" : ""}" data-content-recommendation="${index}">
      <div class="recommendation-meta"><span>${escapeHtml(contentFunctionLabel[item.contentFunction] || contentRoleLabel[item.contentRole] || item.contentRole)}</span><span>${escapeHtml(item.contentPillar)}</span><span>${escapeHtml(source)}</span><span>${duplicateLabel}</span></div>
      <h4>${escapeHtml(item.topic)}</h4>
      <p>${escapeHtml(item.reason)}</p>
      <small>${escapeHtml((item.sourcePlan?.rationale || []).join("；") || "Agent 将在生成前检查可用来源")}</small>
      ${item.sourcePlan?.missing?.length ? `<small>缺少：${escapeHtml(item.sourcePlan.missing.join("；"))}</small>` : ""}
      <button data-select-content-recommendation="${index}" ${blocked ? "disabled" : ""}>${blocked ? "先补充材料或更换方向" : "采用这个方向"}</button>
    </article>`;
  }).join("") || `<div class="empty-state">暂时没有可用建议，请先完成策略确认或补充内容资料。</div>`;
}

async function loadContentAgentRecommendations() {
  const button = $("#refreshContentPlan");
  button.disabled = true;
  button.textContent = "规划中...";
  $("#contentRecommendationList").innerHTML = `<div class="empty-state">正在读取策略与历史内容...</div>`;
  try {
    const selectedAccount = accountsCache.find((item)=>item.id===$("#accountSelect").value);
    const result = await window.FlowAPI.planContent({ accountId: selectedAccount?.id || currentAgentAccountId, companyId:selectedAccount?.companyId || currentAgentAccountId, platform: $("#generationPlatformSelect").value, limit: 3 });
    renderContentAgentRecommendations(result);
  } catch (error) {
    $("#contentRecommendationList").innerHTML = `<div class="empty-state">${escapeHtml(error.message)}。仍可切换到“从热点生成”或“自由创作”。</div>`;
  }
  button.disabled = false;
  button.textContent = "重新规划";
}

const contentWorkflowStateLabel = {
  direction_selected: "方向已选择，准备生成大纲",
  outline_drafting: "正在生成大纲",
  outline_ready: "大纲待确认",
  outline_confirmed: "大纲已确认，可以生成正文",
  generating: "正在按确认大纲生成正文",
  content_ready: "正文已生成",
  needs_review: "大纲需要人工复核",
  blocked: "缺少事实或素材，当前流程已阻断"
};

function updateAgentGenerateButton() {
  const button = $("#generateTop");
  if (!currentContentWorkflow) {
    button.textContent = currentGenerationMode === "agent" ? "先选择内容方向" : "生成方向与大纲";
    button.disabled = currentGenerationMode === "agent" && !selectedContentAgentRecommendation;
  } else if (currentContentWorkflow.state === "outline_confirmed") {
    button.textContent = "按确认大纲生成正文";
    button.disabled = false;
  } else if (currentContentWorkflow.state === "content_ready") {
    button.textContent = "正文已生成";
    button.disabled = true;
  } else {
    button.textContent = currentContentWorkflow.state === "outline_drafting" ? "正在生成大纲..." : currentContentWorkflow.state === "blocked" ? "请先补充可用事实或素材" : "请先确认大纲";
    button.disabled = true;
  }
}

const skillCapabilityLabels = {
  "analyze-viral-content": "爆款参考解析",
  "build-content-master": "构建 ContentMaster",
  "generate-content-outline": "生成内容大纲",
  "write-xhs-content": "生成小红书正文",
  "write-wechat-article": "生成公众号正文",
  "generate-platform-titles": "生成平台标题",
  "naturalize-copy": "表达自然化",
  "review-wechat-article": "公众号内容质检",
  "plan-wechat-images": "公众号配图规划",
  "review-xhs-visuals": "小红书视觉审查",
  "revise-content-package": "内容包局部修改",
  source_analysis: "内容来源解析",
  source_blueprint: "爆款蓝图解析",
  content_master: "构建 ContentMaster",
  outline: "生成内容大纲",
  outline_confirmation: "人工确认大纲",
  platform_writer: "平台正文生成",
  title: "标题生成",
  naturalization: "表达自然化",
  revision: "局部修改",
  title_consistency: "标题—正文一致性",
  schema_and_reference: "事实与引用检查",
  wechat_content_review: "公众号内容质检",
  image_plan: "配图规划",
  render: "内容渲染",
  format: "平台排版",
  format_validation: "排版校验",
  visual_review: "视觉审查"
};

const skillExecutionStatusLabels = {
  completed: "已完成",
  succeeded: "已完成",
  success: "已完成",
  running: "执行中",
  needs_review: "待复核",
  blocked: "已阻断",
  failed: "失败",
  skipped: "已跳过",
  waiting_condition: "按需调用",
  planned: "待执行",
  pending: "待执行"
};

const contentSourceDecisionLabels = { hotspot: "热点", knowledge: "知识", reference_post: "原始参考帖", viral_blueprint: "审核蓝图" };

function bodySectionText(section) {
  if (typeof section === "string") return section;
  return [section?.heading || section?.title, section?.content || section?.body].filter(Boolean).join("\n");
}

function renderPlannedVisuals(items, platform, generatedAssets = []) {
  const visuals = items.length ? items : [{ page_number: 1, page_role: "待规划", headline: "当前内容包没有可用的配图规划", render_strategy: "no_visual_needed" }];
  $("#carouselEditor").innerHTML = visuals.map((item, index) => {
    const headline = item.headline || item.purpose || item.slot_purpose || item.roleLabel || item.page_role || `配图 ${index + 1}`;
    const supporting = item.supportingText || item.visualDescription || item.supporting_text || item.visual_direction || item.prompt || item.strategy || "等待下一阶段执行生图或版式渲染";
    const strategy = item.renderStrategy || item.render_strategy || item.strategy || "html_css";
    const identity = item.pageId || item.page_id || item.slot_id || (index === 0 && platform === "wechat" ? "cover" : null);
    const generated = generatedAssets.find((asset) => asset.status === "succeeded" && (asset.pageId === identity || asset.assetId === identity));
    const image = generated?.relativePath ? `<img src="/${escapeHtml(generated.relativePath)}" alt="${escapeHtml(headline)}的生成底图" />` : "";
    return `<article class="slide-card planned-slide ${index === 0 ? "selected" : ""}">
      <div class="slide-number">${String(index + 1).padStart(2, "0")}</div>
      ${image}
      <div class="slide-copy"><span>${escapeHtml(item.roleLabel || item.pageRole || item.page_role || item.slot_type || (platform === "wechat" ? "文章配图" : "图文页"))}</span><strong>${escapeHtml(headline)}</strong><small>${escapeHtml(strategy)} · ${escapeHtml(supporting).slice(0, 120)}</small></div>
      ${generated ? "" : `<div class="visual-waiting"><b>${strategy === "generated_raster" ? "等待生图" : "等待排版"}</b><span>${platform === "wechat" ? "公众号配图规划" : "小红书 3:4"}</span></div>`}
      <button class="slide-action">编辑规划</button>
    </article>`;
  }).join("");
}

function renderContentPackage(result) {
  currentContentTask = { ...(currentContentTask || {}), ...result };
  const pkg = result.currentContent || {};
  const review = result.qualityReview || {};
  const isXhs = result.platform === "xiaohongshu";
  let title = "";
  let body = "";
  let tags = "";
  if (isXhs) {
    title = pkg.post_copy?.recommended_title || result.ideaTitle || "未生成标题";
    const sections = (pkg.post_copy?.body_sections || []).map(bodySectionText).filter(Boolean);
    body = [pkg.post_copy?.opening, ...sections, pkg.post_copy?.ending, pkg.post_copy?.cta].filter(Boolean).join("\n\n");
    tags = (pkg.post_copy?.hashtags || []).map((tag) => String(tag).startsWith("#") ? tag : `#${tag}`).join(" ");
    renderPlannedVisuals(result.visualStoryboard?.pages || pkg.deck?.pages || [], "xiaohongshu", result.generatedAssets || []);
  } else {
    title = pkg.recommended_title || result.ideaTitle || "未生成标题";
    body = pkg.article_markdown || [pkg.opening, ...(pkg.outline || []).map(bodySectionText), pkg.cta].filter(Boolean).join("\n\n");
    tags = pkg.share_summary || "公众号长文 · 配图待生成";
    const imagePlan = pkg.image_plan || {};
    renderPlannedVisuals([...(imagePlan.cover ? [{ ...imagePlan.cover, slot_id: imagePlan.cover.slot_id || "cover", slot_type: "封面" }] : []), ...(imagePlan.slots || [])], "wechat", result.generatedAssets || []);
  }
  $("#titleEditor").textContent = title;
  $("#bodyEditor").textContent = body;
  $(".preview-tags").textContent = tags;
  $("#previewOverlay").textContent = title;
  $("#previewImage").src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1080' height='1440'%3E%3Cdefs%3E%3ClinearGradient id='g' x2='1' y2='1'%3E%3Cstop stop-color='%23212925'/%3E%3Cstop offset='1' stop-color='%235b8f77'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='url(%23g)'/%3E%3C/svg%3E";
  platformContent[result.platform] = { ...platformContent[result.platform], title, body: body.slice(0, 180), tags };
  updatePreview(result.platform);
  const failed = review.blockers?.length || 0;
  const badge = $(".quality-badge");
  badge.textContent = review.status === "passed" ? "结构与事实检查通过" : `需要复核 ${failed} 项`;
  badge.classList.toggle("needs-review", review.status !== "passed");
  $(".source-badge").textContent = `引用 ${result.knowledgeCitations?.length || result.contentMaster?.source_list?.length || 0} 项证据`;
  $(".page-count").textContent = `1 / ${isXhs ? pkg.deck?.pages?.length || 1 : (pkg.image_plan?.slots?.length || 0) + (pkg.image_plan?.cover ? 1 : 0) || 1}`;
  const storyboardConfirmed = !isXhs || result.visualStoryboard?.status === "visual_storyboard_confirmed";
  const postRenderConfirmed = !isXhs || result.visualQualityConfirmation?.version === result.version && result.visualQualityConfirmation?.decision === "approved";
  $("#generateAssets").disabled = !currentContentTaskId || !storyboardConfirmed || !(isXhs ? pkg.image_specs?.length : [pkg.image_plan?.cover, ...(pkg.image_plan?.slots || [])].filter((item) => item && (item.strategy || item.render_strategy) === "generated_raster").length);
  $("#naturalizeAudit").disabled = !currentContentTaskId;
  $("#visualReview").disabled = !currentContentTaskId || !isXhs || !storyboardConfirmed;
  $("#downloadPackage").disabled = !currentContentTaskId || !postRenderConfirmed;
  $("#aiRevisionSend").disabled = !currentContentTaskId;
  renderContentImageTasks(result.imageTasks || []);
  renderContentExecution(result.skillExecutionPlan || currentContentWorkflow?.skillExecutionPlan, currentContentTrace, currentContentTask);
}

function renderContentImageTasks(items = []) {
  const panel = $("#contentAssetStatus");
  if (!panel) return;
  panel.hidden = !items.length;
  if (!items.length) return;
  const ready = items.filter((item) => item.renderStatus === "succeeded").length;
  const failed = items.filter((item) => item.generationStatus === "failed" || item.renderStatus === "failed").length;
  const qualityBlocked = items.filter((item) => item.qualityReport?.deliveryEligibility === "blocked").length;
  $("#contentAssetSummary").textContent = ready + "/" + items.length + " 页已渲染" + (failed ? " · " + failed + " 项需处理" : "") + (qualityBlocked ? " · " + qualityBlocked + " 页被质量门禁阻断" : "");
  $("#contentAssetList").innerHTML = items.map((item) => {
    const generation = item.generationStatus === "not_required" ? "无需生成式底图" : item.generationStatus === "succeeded" ? "底图已生成" : item.generationStatus === "failed" ? "底图生成失败" : "底图待生成";
    const rendering = item.renderStatus === "succeeded" ? "卡片 PNG 已渲染" : item.renderStatus === "failed" ? "卡片渲染失败" : "卡片 PNG 待渲染";
    const quality = item.qualityReport;
    const stateClass = item.generationStatus === "failed" || item.renderStatus === "failed" || quality?.deliveryEligibility === "blocked" ? "failed" : item.renderStatus === "succeeded" ? "succeeded" : "";
    const detail = escapeHtml(item.generationError || item.renderError || item.prompt || item.visualDirection || "已保留逐页图片规格") + (item.downloadPath ? " · 文件：" + escapeHtml(item.downloadPath) : "");
    const qualityLabels = quality ? [["画布", quality.canvasStatus], ["对比度", quality.contrastStatus], ["溢出", quality.overflowStatus], ["安全区", quality.safeAreaStatus], ["主体", quality.subjectOcclusionStatus], ["容量", quality.capacityStatus]].map(([label, status]) => '<span class="quality-chip ' + escapeHtml(status) + '">' + label + '：' + escapeHtml(status) + '</span>').join("") : "";
    const eligibility = quality ? '<small class="quality-eligibility ' + escapeHtml(quality.deliveryEligibility) + '">交付资格：' + escapeHtml(quality.deliveryEligibility) + (quality.blockers?.length ? ' · ' + escapeHtml(quality.blockers.join("、")) : '') + '</small>' : "";
    const retry = item.generationRetryable ? '<button type="button" data-retry-asset="' + escapeHtml(item.assetId || item.pageId) + '">重试此图</button>' : "";
    return '<article class="content-asset-item"><strong>第 ' + (item.pageNumber || "-") + " 页 · " + escapeHtml(item.role || "图片") + '</strong><span class="' + stateClass + '">' + generation + "；" + rendering + "</span><small>" + detail + '</small><div class="quality-chip-row">' + qualityLabels + "</div>" + eligibility + retry + "</article>";
  }).join("");
}

function uiBodySnapshot(platform, content = {}) {
  if (platform === "xiaohongshu") {
    const copy = content.post_copy || {};
    return JSON.stringify({ title: copy.recommended_title || "", opening: copy.opening || "", sections: copy.body_sections || [], ending: copy.ending || "", cta: copy.cta || "", hashtags: copy.hashtags || [], deckPageCopy: (content.deck?.pages || []).map((page) => ({ id: page.page_id || null, headline: page.headline || "", supportingText: page.supporting_text || "" })) });
  }
  return JSON.stringify({ title: content.recommended_title || "", abstract: content.abstract || "", opening: content.opening || "", article: content.article_markdown || "", cta: content.cta || "" });
}

function renderRevisionDiff(change) {
  const panel = $("#revisionDiff");
  if (!panel || !change?.bodyChanged) { if (panel) panel.hidden = true; return; }
  panel.hidden = false;
  $("#revisionDiffSummary").textContent = "正文由 " + change.beforeBodyLength + " 字变为 " + change.afterBodyLength + " 字（" + (change.bodyLengthDelta >= 0 ? "+" : "") + change.bodyLengthDelta + "）";
  $("#revisionDiffPaths").textContent = (change.changedPaths || []).join("、") || "正文内容已变化";
}

function renderDeliveryState({ status, message, downloadUrl = "", fileName = "" }) {
  const panel = $("#deliveryDownloadState");
  panel.hidden = false;
  panel.classList.toggle("ready", status === "ready");
  panel.classList.toggle("error", status === "error");
  $("#deliveryDownloadTitle").textContent = status === "ready" ? "交付包已生成" : "交付包下载失败";
  $("#deliveryDownloadMessage").textContent = message;
  const link = $("#deliveryFallbackLink");
  link.hidden = !downloadUrl;
  if (downloadUrl) { link.href = downloadUrl; link.download = fileName; }
  $("#retryDeliveryDownload").hidden = status !== "error";
}

async function loadContentVersions() {
  if (!currentContentTaskId) return;
  const result = await window.FlowAPI.getContentVersions(currentContentTaskId);
  $("#versionSelect").innerHTML = (result.items || []).map((item) => `<option value="${item.version}" ${item.version === result.currentVersion ? "selected" : ""}>v${item.version}${item.version === result.currentVersion ? " 当前版本" : item.restoredFromVersion ? ` · 从 v${item.restoredFromVersion} 恢复` : ""}</option>`).join("");
  $("#restoreVersion").disabled = Number($("#versionSelect").value) === Number(result.currentVersion);
}

function renderUpstreamRevision(revision) {
  currentPendingRevision = revision || null;
  const panel = $("#upstreamRevisionPanel");
  if (!panel) return;
  panel.hidden = !revision;
  if (!revision) return;
  $("#upstreamRevisionSummary").textContent = revision.summary || "这项修改会改变选题、目的或事实输入。当前版本会保留，确认后创建新的统一内容项目。";
  $("#upstreamRevisionStatus").textContent = revision.status === "awaiting_upstream_confirmation" ? "等待确认" : revision.status || "待处理";
  $("#upstreamTopic").value = currentContentTask?.ideaTitle || currentContentWorkflow?.generationPayload?.ideaTitle || $("#titleEditor").textContent.trim();
  $("#upstreamPurpose").value = currentContentTask?.contentPurposeId || currentContentTask?.contentIntentProfile?.purpose?.id || currentContentWorkflow?.generationPayload?.contentPurposeId || $("#purposeControl .active")?.dataset.value || "professional_opinion";
  $("#upstreamPromotion").value = currentContentTask?.promotionMode || currentContentTask?.contentIntentProfile?.promotion?.mode || currentContentWorkflow?.generationPayload?.promotionMode || "none";
  $("#upstreamEvidence").value = "";
  panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function sendRevision(instruction) {
  if (!currentContentTaskId) return showToast("请先确认大纲并生成新正文，再继续修改内容");
  const prompt = (instruction || $("#aiRevisionInput").value).trim();
  if (!prompt) return showToast("请告诉 AI 想怎么修改");
  $("#aiChatLog").insertAdjacentHTML("beforeend", `<div class="user-message"><span>你</span><p>${escapeHtml(prompt)}</p></div>`);
  $("#aiRevisionInput").value = "";
  const button = $("#aiRevisionSend");
  button.disabled = true;
  button.textContent = "修改中...";
  try {
    const beforeBody = uiBodySnapshot(currentPlatform, currentContentTask?.currentContent || {});
    const result = await window.FlowAPI.reviseContent(currentContentTaskId || "content_demo", { instruction: prompt, baseVersion: currentRevisionVersion, title: $("#titleEditor").textContent, body: $("#bodyEditor").innerText, accountId: $("#accountSelect").value, platform: currentPlatform });
    currentContentTaskId = result.contentTaskId || currentContentTaskId;
    if (result.status === "awaiting_upstream_confirmation" || result.nextAction?.type === "create_upstream_revision_run") {
      renderUpstreamRevision(result);
      $("#aiChatLog").insertAdjacentHTML("beforeend", `<div class="ai-message"><span>AI</span><p>${escapeHtml(result.summary || "这项修改会影响内容上游，需要确认后创建新 Run。当前版本不会被覆盖。")}</p></div>`);
      $("#aiChatLog").scrollTop = $("#aiChatLog").scrollHeight;
      await refreshContentExecutionUI();
      button.disabled = false;
      button.textContent = "发送修改";
      return;
    }
    const persistedTask = await window.FlowAPI.getContentTask(currentContentTaskId);
    const afterBody = uiBodySnapshot(currentPlatform, persistedTask.currentContent || {});
    if (result.persisted !== true || Number(result.version) <= Number(currentRevisionVersion) || Number(persistedTask.version) !== Number(result.version) || beforeBody === afterBody || !result.change?.bodyChanged) {
      throw new Error("服务端未能确认正文变化和新版本持久化，已停止成功提示");
    }
    currentRevisionVersion = result.version;
    renderContentPackage(persistedTask);
    renderRevisionDiff(result.change);
    if (result.imageDirection) {
      const selectedSlideNote = $(".slide-card.selected .slide-copy small");
      if (selectedSlideNote) selectedSlideNote.textContent = result.imageDirection;
    }
    $("#revisionVersion").textContent = `当前版本 v${currentRevisionVersion}`;
    $(".editor-status span:first-child").textContent = `内容包 v${currentRevisionVersion}`;
    const rerunText = result.rerunPlan?.length ? ` 已局部重跑：${result.rerunPlan.map((item) => item.stage).join("、")}。` : "";
    $("#aiChatLog").insertAdjacentHTML("beforeend", `<div class="ai-message"><span>AI</span><p>${escapeHtml(result.summary || "已按要求修改，并保留未提及内容、事实合同和平台风格。")}${escapeHtml(rerunText)}</p></div>`);
    $("#aiChatLog").scrollTop = $("#aiChatLog").scrollHeight;
    await loadContentVersions();
    await refreshContentExecutionUI();
  } catch (error) {
    showToast(`修改失败：${error.message}`);
  }
  button.disabled = false;
  button.textContent = "发送修改";
}

$("#aiRevisionSend").addEventListener("click", () => sendRevision());

$("#generateAssets").addEventListener("click", async () => {
  if (!currentContentTaskId) return showToast("请先生成内容包");
  const button = $("#generateAssets");
  button.disabled = true;
  button.textContent = "生图中...";
  try {
    const result = await window.FlowAPI.generateContentAssets(currentContentTaskId);
    const task = await window.FlowAPI.getContentTask(currentContentTaskId);
    renderContentPackage(task);
    await refreshContentExecutionUI();
    showToast(`生图完成 ${result.summary.succeeded} 张${result.summary.failed ? `，失败 ${result.summary.failed} 张` : ""}`);
  } catch (error) { showToast(`生图失败：${error.message}`); }
  button.textContent = "生成场景底图";
  button.disabled = false;
});

$("#contentAssetList")?.addEventListener("click", async (event) => {
  const retry = event.target.closest("[data-retry-asset]");
  if (!retry || !currentContentTaskId) return;
  retry.disabled = true;
  retry.textContent = "重试中...";
  try {
    await window.FlowAPI.generateContentAssets(currentContentTaskId, { assetIds: [retry.dataset.retryAsset], force: true });
    renderContentPackage(await window.FlowAPI.getContentTask(currentContentTaskId));
  } catch (error) {
    showToast("图片重试失败：" + error.message);
  }
});

$("#naturalizeAudit").addEventListener("click", async () => {
  if (!currentContentTaskId) return showToast("请先生成内容包");
  const button = $("#naturalizeAudit");
  button.disabled = true;
  button.textContent = "审计中…";
  try {
    const result = await window.FlowAPI.naturalizeContent(currentContentTaskId, { mode: "audit_only", text: $("#bodyEditor").textContent });
    const count = result.data?.findings?.length || 0;
    await refreshContentExecutionUI();
    showToast(count ? `发现 ${count} 处可自然化表达，尚未自动改写` : "自然化审计完成，未自动改写正文");
  } catch (error) { showToast(`自然化审计失败：${error.message}`); }
  button.textContent = "自然化审计";
  button.disabled = false;
});

$("#visualReview").addEventListener("click", async () => {
  if (!currentContentTaskId) return showToast("请先生成内容包");
  const button = $("#visualReview");
  button.disabled = true;
  button.textContent = "视觉审查中…";
  try {
    await window.FlowAPI.renderContent(currentContentTaskId);
    const result = await window.FlowAPI.reviewContentVisuals(currentContentTaskId);
    const decision = result.data?.decision || result.status;
    await refreshContentExecutionUI();
    showToast(decision === "pass" ? "渲染后视觉审查通过" : `视觉审查结果：${decision}，请查看修改建议`);
  } catch (error) { showToast(`视觉审查失败：${error.message}`); }
  button.textContent = "生成卡片预览";
  button.disabled = false;
});

async function runDeliveryDownload() {
  if (!currentContentTaskId) return showToast("请先生成内容包");
  const button = $("#downloadPackage");
  button.disabled = true;
  button.textContent = "打包中...";
  let delivery = null;
  try {
    await window.FlowAPI.renderContent(currentContentTaskId);
    delivery = await window.FlowAPI.deliverContent(currentContentTaskId);
    const downloaded = await window.FlowAPI.downloadContentPackage(delivery.downloadUrl, delivery.fileName);
    renderContentPackage(await window.FlowAPI.getContentTask(currentContentTaskId));
    renderDeliveryState({ status: "ready", message: "已取得 " + Math.round(downloaded.bytes / 1024) + " KB。若浏览器未弹出保存窗口，可使用下方链接。", downloadUrl: delivery.downloadUrl, fileName: delivery.fileName });
    showToast("交付包已生成并开始下载");
  } catch (error) {
    renderDeliveryState({ status: "error", message: error.message + (error.retryable || delivery ? " 可点击重新生成并下载。" : ""), downloadUrl: delivery?.downloadUrl || "", fileName: delivery?.fileName || "" });
    showToast("打包或下载失败：" + error.message);
  }
  button.textContent = "生成交付包";
  button.disabled = false;
}

$("#downloadPackage").addEventListener("click", runDeliveryDownload);
$("#retryDeliveryDownload")?.addEventListener("click", runDeliveryDownload);

$("#versionSelect").addEventListener("change", () => {
  $("#restoreVersion").disabled = Number($("#versionSelect").value) === Number(currentRevisionVersion);
});

$("#restoreVersion").addEventListener("click", async () => {
  if (!currentContentTaskId) return;
  const version = Number($("#versionSelect").value);
  if (version === currentRevisionVersion) return;
  try {
    const restored = await window.FlowAPI.restoreContent(currentContentTaskId, { version, baseVersion: currentRevisionVersion });
    currentRevisionVersion = restored.version;
    renderContentPackage({ ...currentContentTask, ...restored, currentContent: restored.currentContent });
    $("#revisionVersion").textContent = `当前版本 v${currentRevisionVersion}`;
    $(".editor-status span:first-child").textContent = `内容包 v${currentRevisionVersion}`;
    await loadContentVersions();
    showToast(`已从 v${restored.restoredFromVersion} 恢复并创建 v${restored.version}`);
  } catch (error) { showToast(`版本恢复失败：${error.message}`); }
});
$(".revision-suggestions").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-revision]");
  if (button) sendRevision(button.dataset.revision);
});

$("#v2RefreshPlan")?.addEventListener("click", createV2RollingPlan);
$("#v2CreateQuickOpportunity")?.addEventListener("click", createV2QuickOpportunity);
$("#v2QuickTopic")?.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); createV2QuickOpportunity(); } });
$("#v2PlanPlatform")?.addEventListener("change", () => loadV2Plan(true));
$("#v2DirectionCards")?.addEventListener("click", (event) => {
  if (event.target.closest("[data-create-publishing-cycle]")) return createV2RollingPlan();
  if (event.target.closest("[data-cycle-confirm]")) return confirmV2Cycle();
  const start = event.target.closest("[data-v2-start-run]");
  if (start) return startV2Run(Number(start.dataset.v2StartRun));
  const xhs = event.target.closest("[data-v2-start-xhs]");
  if (xhs) return startV2Run(Number(xhs.dataset.v2StartXhs), { productionMode: "xiaohongshu" });
  const adjust = event.target.closest("[data-v2-adjust-direction]");
  if (adjust) {
    if (v2Workspace.plan?.inputMode === "publishing_cycle") return adjustV2CycleSlot(Number(adjust.dataset.v2AdjustDirection));
    const item = v2Workspace.plan?.recommendations?.[Number(adjust.dataset.v2AdjustDirection)];
    $("#companionInput").value = `我想调整这个方向：${item?.topic || "当前推荐"}`;
    switchView("today");
  }
});
$("#v2DirectionCards")?.addEventListener("change", (event) => {
  if (event.target.id !== "v2PlanAccountChoice" || !event.target.value) return;
  v2Workspace.accountSelection = { socialAccountId: event.target.value, selectionSource: "user_confirmed" };
  const globalAccountSelect = $("#accountSelect");
  if (globalAccountSelect) globalAccountSelect.value = event.target.value;
  v2Workspace.plan = null;
  v2Workspace.cycle = null;
  v2Workspace.rollingPlan = null;
  loadV2Plan(true);
});
$("#v2AssetTabs")?.addEventListener("click", (event) => { const tab = event.target.closest("[data-v2-asset]"); if (tab) loadV2Assets(tab.dataset.v2Asset); });
$("#v2KnowledgeFolder")?.addEventListener("change", (event) => { v2Workspace.assetFolderId = event.target.value; loadV2Assets("knowledge"); });
$("#v2NewKnowledgeFolder")?.addEventListener("click", async () => {
  const name = window.prompt("新文件夹名称");
  if (!name?.trim()) return;
  try {
    const ownership = v2KnowledgeOwnership();
    const folder = await window.FlowAPI.createKnowledgeFolder({ ...ownership, name: name.trim(), description: "资产中心创建的企业知识文件夹", icon: "▤" });
    v2Workspace.assetFolderId = folder.id;
    await Promise.all([loadV2Assets("knowledge"), loadGenerationKnowledgeAssets()]);
    showToast("文件夹已创建");
  } catch (error) { showToast(`创建文件夹失败：${error.message}`); }
});

function updateV2AssetProgress(key, { name, progress = 0, status = "pending", message = "" }) {
  const target = $("#v2AssetUploadProgress");
  let row = target.querySelector(`[data-upload-key="${key}"]`);
  if (!row) {
    target.insertAdjacentHTML("beforeend", `<article class="asset-progress-row" data-upload-key="${key}"><strong></strong><div class="asset-progress-track"><i></i></div><span></span></article>`);
    row = target.querySelector(`[data-upload-key="${key}"]`);
  }
  row.className = `asset-progress-row ${status}`;
  row.querySelector("strong").textContent = name;
  row.querySelector("i").style.width = `${Math.max(0, Math.min(100, progress))}%`;
  row.querySelector("span").textContent = message || (status === "ready" ? "ready" : status === "failed" ? "failed" : progress >= 100 ? "pending · 解析中" : `上传 ${progress}%`);
}

async function uploadV2KnowledgeFiles(files) {
  const ownership = v2KnowledgeOwnership();
  const folderId = v2Workspace.assetFolderId || $("#v2KnowledgeFolder").value;
  const tags = $("#v2KnowledgeTags").value.split(/[,，]/).map((item) => item.trim()).filter(Boolean);
  const description = $("#v2KnowledgeDescription").value.trim();
  if (!folderId) return showToast("请先新建并选择目标文件夹");
  if (!tags.length) return showToast("请至少填写一个文件标签");
  const supported = new Set(["pdf", "docx", "txt", "md", "markdown", "csv", "json", "html", "htm", "png", "jpg", "jpeg", "webp"]);
  for (const [index, file] of files.entries()) {
    const key = `${Date.now()}_${index}`;
    const extension = file.name.includes(".") ? file.name.split(".").pop().toLowerCase() : "";
    if (!supported.has(extension)) {
      updateV2AssetProgress(key, { name: file.name, status: "failed", message: "failed · 不支持该格式，未上传" });
      continue;
    }
    if (file.size > 25 * 1024 * 1024) {
      updateV2AssetProgress(key, { name: file.name, status: "failed", message: "failed · 文件超过 25 MB，未上传" });
      continue;
    }
    const formData = new FormData();
    formData.append("folderId", folderId);
    formData.append("workspaceId", ownership.workspaceId);
    formData.append("companyId", ownership.companyId);
    formData.append("tags", JSON.stringify(tags));
    formData.append("description", description);
    formData.append("file", file, file.name);
    updateV2AssetProgress(key, { name: file.name, progress: 0, status: "pending" });
    try {
      const saved = await window.FlowAPI.createKnowledgeFile(formData, (progress) => updateV2AssetProgress(key, { name: file.name, progress, status: "pending" }));
      updateV2AssetProgress(key, { name: file.name, progress: 100, status: saved.parseStatus, message: saved.parseStatus === "ready" ? `ready · 已建立 ${saved.chunkCount} 个知识片段` : `failed · ${saved.errorMessage || "解析失败，可重试"}` });
    } catch (error) {
      updateV2AssetProgress(key, { name: file.name, status: "failed", message: `failed · ${error.message}` });
    }
  }
  $("#v2KnowledgeFiles").value = "";
  await Promise.all([loadV2Assets("knowledge"), loadGenerationKnowledgeAssets()]);
}

$("#v2KnowledgeFiles")?.addEventListener("change", (event) => uploadV2KnowledgeFiles([...event.target.files]));
$("#v2AssetLibrary")?.addEventListener("click", async (event) => {
  const ownership = v2KnowledgeOwnership();
  const retry = event.target.closest("[data-v2-retry-file]");
  const remove = event.target.closest("[data-v2-delete-file]");
  if (retry) {
    retry.disabled = true;
    retry.textContent = "重试中…";
    try { await window.FlowAPI.retryKnowledgeFile(retry.dataset.v2RetryFile, ownership); }
    catch (error) { showToast(`重试结果：${error.message}`); }
    await loadV2Assets("knowledge");
  }
  if (remove && window.confirm("确定删除这个知识文件及其检索片段吗？")) {
    try {
      await window.FlowAPI.deleteKnowledgeFile(remove.dataset.v2DeleteFile, ownership);
      await Promise.all([loadV2Assets("knowledge"), loadGenerationKnowledgeAssets()]);
      showToast("文件已删除");
    } catch (error) { showToast(`删除失败：${error.message}`); }
  }
});
$("#v2ReviewFilters")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-review-filter]");
  if (!button) return;
  v2Workspace.reviewFilter = button.dataset.reviewFilter;
  $$("#v2ReviewFilters button").forEach((item) => item.classList.toggle("active", item === button));
  renderV2PublicationQueue();
});
$("#v2PublicationList")?.addEventListener("click", (event) => {
  const projectButton = event.target.closest("[data-v2-review-project]");
  if (projectButton) return openAtomicReviewProject(projectButton.dataset.v2ReviewProject, projectButton.dataset.v2ReviewPlatform);
  const button = event.target.closest("[data-v2-review-task]");
  if (!button) return;
  openV2Feedback(button.dataset.v2ReviewTask);
});
$("#v2Diagnoses")?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-accept-diagnosis]");
  if (!button) return;
  button.disabled = true;
  try {
    await window.FlowAPI.acceptFeedbackAction(button.dataset.acceptDiagnosis, { accountId: v2AccountId(), acceptedBy: "workspace_user" });
    button.textContent = "已加入下一篇规划";
    button.disabled = true;
    showToast("战术动作已记录；下一篇将从统一内容计划创建");
  } catch (error) { button.disabled = false; showToast(`采用失败：${error.message}`); }
});
$("#v2CycleReviews")?.addEventListener("click", (event) => {
  const discuss = event.target.closest("[data-strategy-feedback-discuss]");
  if (discuss) return openV2StrategyFeedbackDiscussion(discuss.dataset.strategyFeedbackDiscuss);
  const button = event.target.closest("[data-strategy-adjustment-resolution]");
  if (!button) return;
  decideV2StrategyAdjustment(button.dataset.strategyAdjustmentId, button.dataset.strategyAdjustmentHash, button.dataset.strategyAdjustmentResolution);
});
$("#v2SaveFeedback")?.addEventListener("click", saveV2Feedback);
$("#v2FeedbackWindow")?.addEventListener("change", () => renderV2FeedbackWindow());
$("#v2FeedbackQuality")?.addEventListener("click", (event) => {
  if (!event.target.closest("[data-focus-publication-repair]")) return;
  const missing = v2Workspace.feedbackTask?.publication?.missingFields || [];
  const target = missing.includes("platformContentId") ? "#v2FeedbackPlatformContentId" : "#v2FeedbackPublishedAt";
  $(target)?.focus();
});
$("#v2FeedbackDialog")?.addEventListener("input", (event) => { if (event.target.matches('input[type="number"]')) renderV2FeedbackWindow({ populate: false }); });
$("#v2BatchFeedback")?.addEventListener("click", () => { v2Workspace.metricImportBatch = null; $("#confirmMetricImport").disabled = true; $("#metricImportResult").textContent = "导入后会先显示精确匹配、待确认匹配和未匹配内容。"; $("#metricImportDialog").showModal(); });
$("#previewMetricImport")?.addEventListener("click", previewMetricImport);
$("#confirmMetricImport")?.addEventListener("click", confirmMetricImport);
$("#v2UploadAsset")?.addEventListener("click", () => {
  if (v2Workspace.assetTab !== "knowledge") return showToast("当前 Work Item 仅开放企业知识文件上传；其他资产按各自采集流程进入");
  $("#v2KnowledgeFiles")?.click();
});
$("#v2AddAccount")?.addEventListener("click", () => {switchView("accounts");setTimeout(()=>$("#newAccount")?.click(),0);});
$("#v2AccountCards")?.addEventListener("click", async (event) => {
  const wechat = event.target.closest("[data-v2-wechat]");
  if (wechat) return openWechatIntegration(wechat.dataset.v2Wechat);
  const visual = event.target.closest("[data-v2-visual]");
  if (visual) {
    switchView("accounts");
    await loadAccounts(visual.dataset.v2Visual);
    $("#accountVisualGuidelines")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  const accountButton=event.target.closest("[data-v2-account]");
  if (accountButton){switchView("accounts");loadAccounts(accountButton.dataset.v2Account);}
});
$("#saveWechatIntegration")?.addEventListener("click", saveWechatConnection);
$("#testWechatIntegration")?.addEventListener("click", testWechatConnection);
$("#syncWechatIntegration")?.addEventListener("click", syncWechatConnection);
$("#companionSend")?.addEventListener("click", () => {
  const input = $("#companionInput");
  if (!input.value.trim()) return;
  if ($("#v2QuickTopic")) $("#v2QuickTopic").value = input.value.trim();
  showToast("已转成临时内容任务，请确认内容目的后生成大纲");
  switchView("plan");
});
$$('[data-companion-prompt]').forEach((button) => button.addEventListener("click", () => { $("#companionInput").value = button.dataset.companionPrompt; }));

// Unified artifact workbench is loaded from ui/unified-artifact-workbench.js.


$$('.nav-item[data-view-target]').forEach((button) => {
  button.addEventListener("click", () => navigateToView(button.dataset.viewTarget));
});

document.addEventListener("click", (event) => { const button = event.target.closest("[data-jump]"); if (button) navigateToView(button.dataset.jump); });

$("#agentHandoffAction")?.addEventListener("click", async (event) => {
  const action=event.currentTarget.dataset.handoffAction;
  if (["open_content_planning","create_rolling_plan"].includes(action)) return navigateToView("plan");
  if (action==="start_strategy_diagnosis") return $("#startAgentDiagnosis")?.click();
  if (action==="generate_strategy_draft"||action==="regenerate_strategy_draft") return $("#createStrategyDraft")?.click();
  if (action==="activate_strategy_draft") return $("#agentStrategyDraftPanel")?.scrollIntoView({behavior:"smooth",block:"start"});
  if (action==="confirm_strategy_decisions") return $("#agentStrategyDecisionPanel")?.scrollIntoView({behavior:"smooth",block:"start"});
  if (action==="update_strategy_account_decisions") {
    if(!currentAgentSessionId)return showToast("请先开始或恢复当前公司的策略诊断");
    const button=event.currentTarget;button.disabled=true;button.textContent="正在加载账号…";
    try{
      const result=await window.FlowAPI.previewStrategyDecisions(currentAgentSessionId,{compatibilityRepair:true});
      renderStrategyDecisionRecord(result.record,result.accounts);
      $("#agentStrategyDecisionPanel").scrollIntoView({behavior:"smooth",block:"start"});
      showToast("请逐账号确认身份、持续发声者、信任来源和增长打法");
    }catch(error){showToast(`无法打开账号确认：${error.message}`);}
    finally{button.disabled=false;button.textContent="补齐账号身份与增长打法";}
    return;
  }
  $("#agentMessageInput")?.focus();
});

$("#agentUseActiveStrategy")?.addEventListener("click",()=>navigateToView("plan"));

$("#opportunityList").addEventListener("click", (event) => {
  const card = event.target.closest(".opp-list-card");
  if (!card) return;
  $$(".opp-list-card").forEach((item) => item.classList.remove("active"));
  card.classList.add("active");
  const data = opportunityData[card.dataset.opp];
  if (data?.full) renderHotspotOpportunity(data.full);
  else if (data) {
    $("#detailOppTitle").textContent = data.title;
    $("#detailOppSummary").textContent = data.summary;
  }
});

$("#ignoreHotspot").addEventListener("click", async () => {
  if (!currentSelectedHotspotId) return;
  try {
    await window.FlowAPI.updateHotspotStatus(currentSelectedHotspotId, "ignored");
    await loadHotspotPool(currentHotspotPool);
    await loadHotspotLibrary();
    showToast("热点已忽略，可在已忽略列表中恢复");
  } catch (error) {
    showToast(currentHotspotPreviewId ? "请先将搜索结果加入热点库，再设置忽略状态" : `忽略失败：${error.message}`);
  }
});

$("#addHotspotToLibrary").addEventListener("click", async () => {
  const selected = opportunityData[currentSelectedHotspotId]?.full;
  if (!currentHotspotPreviewId || !currentSelectedHotspotId || selected?.status !== "preview") return showToast("当前热点已经在热点库中，或请先执行热点搜索");
  try {
    const result = await window.FlowAPI.commitHotspotPreview(currentHotspotPreviewId, [currentSelectedHotspotId]);
    const committed = result.items?.[0];
    if (!committed?.id) throw new Error("服务端未返回真实热点资产映射，请重试");
    delete opportunityData[currentSelectedHotspotId];
    currentSelectedHotspotId = committed.id;
    currentHotspotPreviewId = null;
    currentPreviewItems = [];
    opportunityData[committed.id] = { title: committed.title, summary: committed.summary, full: committed };
    renderHotspotOpportunity(committed);
    showToast(`已加入热点库：新增${result.stats?.added || 0}个，更新${result.stats?.updated || 0}个`);
    await loadHotspotLibrary();
  } catch (error) {
    showToast(`加入热点库失败：${error.message}`);
  }
});

$("#createFromHotspot")?.addEventListener("click", async () => {
  const account = v2AccountRecord();
  const hotspot = opportunityData[currentSelectedHotspotId]?.full;
  if (!account?.companyId) return showToast("请先选择具体社媒账号");
  if (!hotspot?.id || hotspot.status === "preview") return showToast("请先把当前搜索结果加入热点库，再用于内容创作");
  if (hotspot.relevanceTier === "unrelated") return showToast("该热点与当前业务无关，不能用于内容创作");
  const weakExperimentConfirmed = hotspot.relevanceTier === "weak_experiment"
    ? window.confirm("该热点与当前业务只有弱关联。确认把它作为一次受控实验进入内容创作吗？")
    : false;
  if (hotspot.relevanceTier === "weak_experiment" && !weakExperimentConfirmed) return;
  const button = $("#createFromHotspot");
  button.disabled = true;
  button.textContent = "正在创建…";
  try {
    const opportunity = await window.FlowAPI.createContentOpportunity({ companyId: account.companyId, socialAccountId: account.id, platform: account.platform, sourceType: "hotspot", sourceId: hotspot.id, topic: hotspot.title, angle: hotspot.recommendedAngle || "热点与目标用户的真实关系", contentPurposeId: "hotspot_industry_explainer", preferredSourceMode: "hotspot", metadata: { relevanceScore: hotspot.relevanceScore || hotspot.score, relevanceTier: hotspot.relevanceTier, sourceUrl: hotspot.sourceUrl || hotspot.url, weakExperimentConfirmed } });
    await launchV2Opportunity(opportunity);
    showToast("热点已作为来源锁定，并进入统一内容任务");
  } catch (error) {
    showToast(`热点内容任务创建失败：${error.message}`);
  } finally {
    button.disabled = false;
    button.textContent = "用于内容创作";
  }
});

$("#hotspotLibraryTags").addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-library-hotspot]");
  if (!button) return;
  if (button.dataset.poolType === "keyword") {
    selectedKeywordHotspotIds = [button.dataset.libraryHotspot];
    selectedGlobalHotspotIds = [];
    if (button.dataset.directionId && button.dataset.directionId !== currentDirectionId) {
      currentDirectionId = button.dataset.directionId;
      await loadDirectionLibrary(currentDirectionId);
    }
  } else {
    selectedGlobalHotspotIds = [button.dataset.libraryHotspot];
  }
  currentTopicCategory = button.dataset.poolType === "keyword" ? "keyword" : "cross_trend";
  $$("#topicTypeTabs button").forEach((item) => item.classList.toggle("active", item.dataset.topicCategory === currentTopicCategory));
  renderSelectedTopicHotspots();
  await loadHotspotLibrary();
  $("#topicWorkbench").scrollIntoView({ behavior: "smooth", block: "start" });
  showToast(button.dataset.poolType === "keyword" ? "已选择该关键词热点，点击生成选题" : "已选择该全网热点，请再确认要结合的主题热点");
});

$("#directionTabs").addEventListener("click", async (event) => {
  const directionButton = event.target.closest("button[data-direction-id]");
  if (directionButton) {
    selectedKeywordHotspotIds = [];
    selectedGlobalHotspotIds = [];
    await setHotspotPool("keyword", false);
    await loadDirectionLibrary(directionButton.dataset.directionId);
    return;
  }
  if (!event.target.closest("#addDirection")) return;
  openDirectionDialog();
});

$("#radarDirection").addEventListener("change", (event) => loadDirectionLibrary(event.target.value));

$("#generateDirectionKeywords").addEventListener("click", async (event) => {
  const name = $("#directionNameInput").value.trim();
  if (!name) return showToast("请先输入关注主题");
  event.currentTarget.disabled = true;
  $("#keywordGenerationStatus").textContent = "DeepSeek 正在扩展关键词…";
  try {
    const profile = await window.FlowAPI.expandKeywords({ name, description: $("#directionDescriptionInput").value.trim() });
    writeKeywordLines("#coreKeywordsInput", profile.coreKeywords);
    writeKeywordLines("#platformKeywordsInput", profile.platformKeywords);
    writeKeywordLines("#scenarioKeywordsInput", profile.scenarioKeywords);
    writeKeywordLines("#excludeKeywordsInput", profile.excludeKeywords);
    $("#keywordGenerationStatus").textContent = `已生成 ${profile.searchKeywords?.length || 0} 个搜索词，请确认或修改`;
  } catch (error) {
    $("#keywordGenerationStatus").textContent = "生成失败";
    showToast(`关键词生成失败：${error.message}`);
  } finally {
    event.currentTarget.disabled = false;
  }
});

$("#saveDirectionProfile").addEventListener("click", async (event) => {
  const profile = directionProfileFromForm();
  if (!profile.name) return showToast("请填写关注主题");
  if (profile.searchKeywords.length < 3) return showToast("请至少确认3个有效搜索关键词");
  event.currentTarget.disabled = true;
  try {
    const payload = { ...profile,companyId:currentAgentAccountId || "account_damaishuzhi",workspaceId:"workspace_default", keywords: profile.searchKeywords, shortName: profile.name.slice(0, 2), refreshSchedule: "daily", keywordConfirmedAt: new Date().toISOString() };
    const saved = editingDirectionId ? await window.FlowAPI.updateDirection(editingDirectionId, payload) : await window.FlowAPI.createDirection(payload);
    currentDirectionId = saved.id;
    $("#directionDialog").close();
    await setHotspotPool("keyword", false);
    await loadDirections();
    showToast(`关注主题已保存：${profile.searchKeywords.length}个搜索词，${profile.excludeKeywords.length}个排除词`);
  } catch (error) {
    showToast(`主题保存失败：${error.message}`);
  } finally {
    event.currentTarget.disabled = false;
  }
});

$("#hotspotPoolTabs").addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-pool-mode]");
  if (!button) return;
  try {
    await setHotspotPool(button.dataset.poolMode);
  } catch (error) {
    showToast(`热点池加载失败：${error.message}`);
  }
});

$("#topicTypeTabs").addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-topic-category]");
  if (!button) return;
  currentTopicCategory = button.dataset.topicCategory;
  selectedKeywordHotspotIds = [];
  selectedGlobalHotspotIds = [];
  renderSelectedTopicHotspots();
  $$("#topicTypeTabs button").forEach((item) => item.classList.toggle("active", item === button));
  try {
    await loadTopics(currentTopicCategory);
  } catch (error) {
    showToast(`选题加载失败：${error.message}`);
  }
});

$("#confirmTopicHotspots").addEventListener("click", () => {
  selectedKeywordHotspotIds = $$("#topicHotspotChoices input:checked[data-pool-type=\"keyword\"]").map((input) => input.value);
  selectedGlobalHotspotIds = $$("#topicHotspotChoices input:checked[data-pool-type=\"global\"]").map((input) => input.value);
  if (!selectedKeywordHotspotIds.length) return showToast("请至少选择一个关键词热点");
  if (currentTopicCategory === "cross_trend" && !selectedGlobalHotspotIds.length) return showToast("推荐结合选题还需要至少选择一个全网热点");
  $("#topicHotspotDialog").close();
  renderSelectedTopicHotspots();
  loadHotspotLibrary();
  $("#generateTopics").click();
});

$("#chooseTopicHotspots").addEventListener("click", async () => {
  try { await openTopicHotspotPicker(); } catch (error) { showToast(`热点库加载失败：${error.message}`); }
});

$("#generateTopics").addEventListener("click", async (event) => {
  if (!selectedKeywordHotspotIds.length || (currentTopicCategory === "cross_trend" && !selectedGlobalHotspotIds.length)) {
    try {
      await openTopicHotspotPicker();
    } catch (error) {
      showToast(`热点库加载失败：${error.message}`);
    }
    return;
  }
  const button = event.currentTarget;
  const original = button.textContent;
  button.disabled = true;
  button.textContent = "DeepSeek 生成与审核中...";
  $("#topicPipelineStatus").innerHTML = `<span>候选生成中</span><span>证据校验</span><span>主编门控</span><span>双平台适配</span>`;
  try {
    const requestedCount = Math.min(10, Math.max(1, Number($("#topicCount").value) || 4));
    const result = await window.FlowAPI.runTopicPipeline({ directionId: currentDirectionId, companyId:currentAgentAccountId || "account_damaishuzhi",category: currentTopicCategory, topicCount: requestedCount, keywordHotspotIds: selectedKeywordHotspotIds, globalHotspotIds: selectedGlobalHotspotIds, accountId: accountsCache.find((item)=>item.companyId===currentAgentAccountId)?.id || null });
    renderTopicResults(result.topics || [], result.run);
    showToast(`期待${requestedCount}个；产出${result.run.outputCount ?? result.topics?.length ?? 0}个（推荐${result.run.approvedCount || 0}，待完善${result.run.reviewableCount || 0}），共评估${result.run.candidateCount || 0}个`);
  } catch (error) {
    $("#topicPipelineStatus").innerHTML = `<span>生成失败</span><span>${escapeHtml(error.message)}</span>`;
    showToast(`选题生成失败：${error.message}`);
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
});

$("#topicResults").addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-select-topic]");
  if (!button) return;
  const topic = topicResultsCache.find((item) => item.id === button.dataset.selectTopic);
  if (!topic) return;
  const platform = button.dataset.platform;
  const platformTopic = topic.platformTopics?.[platform];
  const force = Number(platformTopic?.fit_score || 0) < 60;
  button.disabled = true;
  button.textContent = "选择中...";
  try {
    selectedTopicSelection = await window.FlowAPI.selectPlatformTopic(topic.id, { platform, force });
    selectedIdeaSelection = { id: selectedTopicSelection.id, topicId: topic.id, title: selectedTopicSelection.platformTopic.platform_topic, sourceCount: selectedTopicSelection.evidence?.length || 0, opportunityScore: topic.scores?.overall || 0, risks: selectedTopicSelection.risks || [] };
    $("#opportunityTitle").textContent = selectedIdeaSelection.title;
    $("#selectedIdeaMeta").textContent = `${topic.topicCategory === "cross_trend" ? "推荐结合选题" : "AI / 业务领域选题"} · ${platform === "xiaohongshu" ? "小红书" : "微信公众号"} · ${selectedIdeaSelection.sourceCount} 条证据`;
    $("#generationPlatformSelect").value = platform;
    const platformButton = $(`#platformTabs button[data-platform="${platform}"]`);
    if (platformButton) activateGroup("#platformTabs", platformButton);
    updatePreview(platform);
    setGenerationMode("idea");
    switchView("generate");
    showToast("平台子选题已锁定，请继续选择本篇内容目的");
  } catch (error) {
    button.disabled = false;
    button.textContent = "选择此子选题";
    showToast(`选择失败：${error.message}`);
  }
});

$("#editDirection").addEventListener("click", async () => {
  openDirectionDialog(directionsCache.find((item) => item.id === currentDirectionId));
});

$("#refreshDirection").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  button.textContent = "更新中...";
  resetRadarStages();
  try {
    await setHotspotPool("keyword", false);
    const result = await window.FlowAPI.refreshDirection(currentDirectionId);
    await animateRadarStages(result.run?.stages || []);
    await loadDirectionLibrary(currentDirectionId);
    showToast(`热点库已更新，新增 ${result.opportunity?.topicIdeas?.length || 0} 个 ideas`);
  } catch (error) {
    showToast(`更新失败：${error.message}`);
  }
  button.disabled = false;
  button.textContent = "更新热点库";
});

$("#detailIdeas")?.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-idea-id]");
  if (!button) return;
  const opportunity = opportunityData[button.dataset.opportunityId]?.full;
  const direction = currentDirectionLibrary?.direction;
  button.disabled = true;
  button.textContent = "正在创建...";
  try {
    selectedTopicSelection = null;
    selectedIdeaSelection = await window.FlowAPI.selectIdea({
      ideaId: button.dataset.ideaId,
      opportunityId: button.dataset.opportunityId,
      directionId: currentDirectionId,
      title: button.dataset.ideaTitle,
      whyNow: opportunity?.whyHot || "",
      keywords: opportunity?.keywords || [],
      sourceCount: opportunity?.sourceCount || 0,
      opportunityScore: opportunity?.score || 0,
      risks: opportunity?.risks || [],
      productFits: opportunity?.productFits || []
    });
    $("#opportunityTitle").textContent = selectedIdeaSelection.title;
    $("#selectedIdeaMeta").textContent = `来自 ${direction?.name || "当前主题"} · ${selectedIdeaSelection.sourceCount || 0} 个来源证据`;
    const score = $(".opportunity-card .score-row strong");
    if (score) score.textContent = selectedIdeaSelection.opportunityScore || "--";
    setGenerationMode("idea");
    switchView("generate");
    showToast("idea 已带入内容生成，请选择账号、平台和营销方式");
  } catch (error) {
    button.disabled = false;
    button.textContent = "选择并生成";
    showToast(`选择失败：${error.message}`);
  }
});

$("#collectNow").addEventListener("click", () => {
  $("#runHotspotRadar")?.click();
});

$(".radar-sources").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (button) button.classList.toggle("active");
});

$("#runHotspotRadar").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  const keywords = $("#radarKeywords").value.split(/[,，]/).map((item) => item.trim()).filter(Boolean);
  if (currentHotspotPool === "keyword" && !keywords.length) return showToast("请至少输入一个种子关键词");
  const platforms = $$(".keyword-source.active:not([hidden])").map((item) => item.dataset.platform);
  const globalSources = $$(".global-source.active:not([hidden])").map((item) => item.dataset.globalSource);
  if (currentHotspotPool === "keyword" && !platforms.length) return showToast("请至少启用一个关键词搜索平台");
  if (currentHotspotPool === "global" && !globalSources.length) return showToast("请至少启用一个全网热点来源");
  resetRadarStages();
  button.disabled = true;
  button.textContent = "扫描中...";
  try {
    const direction = directionsCache.find((item) => item.id === currentDirectionId);
    if (currentHotspotPool === "keyword") await window.FlowAPI.updateDirection(currentDirectionId, { keywords, searchKeywords: keywords });
    const result = await window.FlowAPI.runHotspotPipeline({
      poolType: currentHotspotPool,
      requireLive: true,
      companyId: activeHotspotCompanyId(),
      directionId: currentHotspotPool === "keyword" ? currentDirectionId : null,
      keywords: currentHotspotPool === "keyword" ? keywords : [],
      keywordProfile: currentHotspotPool === "keyword" ? { ...direction, searchKeywords: keywords } : null,
      platforms, globalSources,
      timeWindowDays: Number($("#radarWindow").value),
      targetOpportunityCount: Number($("#targetHotspotCount").value) || 10,
      pages: 2,
      relevanceThreshold: 70
    });
    await animateRadarStages(result.run.stages || []);
    currentHotspotPreviewId = result.previewId;
    currentPreviewItems = result.opportunities || [];
    renderOpportunityCollection(currentPreviewItems, "没有内容通过主题相关性与时效校验，请调整关键词或时间范围。");
    const warningText = result.warnings?.length ? `，${result.warnings.length} 个来源失败` : "";
    const stats = result.run.stats || {};
    const shortfallText = stats.shortfall ? `，距目标还差${stats.shortfall}个（未用低质量内容补足）` : "";
    const roundText = result.run.collectionRounds?.length > 1 ? `，已自动补搜${result.run.collectionRounds.length}轮` : "";
    showToast(`搜索完成：召回${stats.collected || 0}条，相关性通过${stats.relevancePassed ?? stats.timely ?? 0}条，聚合${stats.opportunities || 0}个热点${roundText}${shortfallText}${warningText}`);
  } catch (error) {
    const failure = error.payload?.run?.failure;
    const classification = failure?.errorClass || error.code;
    const stage = failure?.failureStage;
    const retryLabel = error.payload?.retryAction?.label || failure?.retryAction?.label;
    showToast(`热点扫描失败${classification ? ` [${classification}]` : ""}${stage ? ` · ${stage}` : ""}：${error.message}${retryLabel ? `。${retryLabel}` : ""}`);
  }
  button.disabled = false;
  button.textContent = currentHotspotPool === "global" ? "采集全网热点" : "搜索关键词热点";
});

async function loadContentLearning() {
  try {
    const [status, blueprints] = await Promise.all([
      window.FlowAPI.getContentLearningStatus("acc_xhs"),
      window.FlowAPI.getContentLearningBlueprints("acc_xhs")
    ]);
    const count = blueprints.items?.length || 0;
    $("#viralPatternCount").textContent = `${count} 个版本`;
    $("#viralPatternLibrary").innerHTML = count
      ? blueprints.items.slice(-4).reverse().map((item) => `<div class="pattern-version-row"><b>${escapeHtml(item.contentArchetype || "内容结构蓝图")} · v${item.version || 1}</b><span>${escapeHtml(item.platform || "通用")} · ${escapeHtml(item.lifecycle || "approved")} · ${escapeHtml((item.titleMechanisms || []).join(" / ") || "结构规律")}</span></div>`).join("")
      : "<p>还没有已批准蓝图。</p>";
    if (!currentPatternAnalysisId) {
      $("#viralLearningState").textContent = status.enabled ? "学习层已开启" : "学习层待开启";
      $("#viralLearningSummary").textContent = status.enabled
        ? `已有 ${status.counts?.productionBlueprints || 0} 个可用蓝图；内容 Agent 只读取批准版本。`
        : "审核与版本化已可用；VIRAL_LEARNING_V1 开启前，蓝图不会进入内容 Agent 的默认规划。";
    }
  } catch (error) {
    $("#viralLearningState").textContent = "学习库不可用";
  }
  await loadLearningCenter();
}

function setPatternReviewState(status) {
  const pending = status === "candidate";
  $("#approveViralPattern").disabled = !pending;
  $("#rejectViralPattern").disabled = !pending;
  $("#viralLearningState").textContent = pending ? "待人工审核" : status === "approved" ? "已批准入库" : status === "rejected" ? "已忽略" : "等待拆解";
}

function learningBadge(value) {
  const labels = { stable_commonality: "稳定共性", scenario_pattern: "场景规律", hypothesis: "待验证假设", candidate: "待审核", approved: "已批准", rejected: "已拒绝", testing: "测试中", validated: "已验证", paused: "已暂停", retired: "已退役" };
  return labels[value] || value || "未知";
}

function renderLearningImportJobs(jobs = []) {
  const target = $("#learningImportJobs");
  if (!target) return;
  target.innerHTML = jobs.length ? jobs.slice().reverse().slice(0, 8).map((job) => `<div class="learning-list-item"><div><strong>${escapeHtml(job.platform || "混合平台")} · ${escapeHtml(job.sourceType || "批量导入")}</strong><span>提交 ${job.counts?.submitted || 0} · 成功分析 ${job.counts?.analyzed || 0} · 重复 ${job.counts?.duplicates || 0} · 失败 ${job.counts?.failed || 0}</span><small>${escapeHtml(job.createdAt ? new Date(job.createdAt).toLocaleString() : "")}</small></div><span class="learning-badge ${job.status?.includes("error") || job.status === "failed" ? "warn" : ""}">${escapeHtml(job.status || "completed")}</span></div>`).join("") : "<p>完成第一次批量投喂后，这里会显示导入质量和错误明细。</p>";
}

function renderLearningClusters(clusters = []) {
  const target = $("#learningClusterList");
  if (!target) return;
  target.innerHTML = clusters.length ? clusters.map((cluster) => `<div class="learning-list-item"><div><strong>${escapeHtml(cluster.platform)} · ${escapeHtml(cluster.contentArchetype)}</strong><span>${cluster.sampleCount || 0} 个样本 / ${cluster.independentAuthorCount || 0} 个独立作者 · 共性机制 ${cluster.recurringMechanisms?.length || 0} 条</span><small>置信分 ${Math.round(cluster.confidenceScore || 0)} · 偶然特征 ${cluster.oneOffMechanisms?.length || 0} 条</small></div><span class="learning-badge ${cluster.classification === "hypothesis" ? "warn" : ""}">${learningBadge(cluster.classification)}</span></div>`).join("") : "<p>至少需要两个可比案例。</p>";
}

function renderLearningProposals(proposals = []) {
  const target = $("#learningProposalList");
  if (!target) return;
  target.innerHTML = proposals.length ? proposals.slice().reverse().map((proposal) => `<div class="learning-list-item"><div><strong>${proposal.proposalType === "upgrade" ? `蓝图 v${proposal.proposedVersion}` : "新蓝图家族"}</strong><span>${escapeHtml(proposal.reason)}</span><small>样本 ${proposal.evidenceWindow?.sampleCount || 0} · 置信分 ${Math.round(proposal.confidenceScore || 0)} · ${learningBadge(proposal.status)}</small></div>${proposal.status === "candidate" ? `<div class="learning-list-actions"><button data-proposal-review="reject" data-proposal-id="${escapeHtml(proposal.id)}">拒绝</button><button class="primary" data-proposal-review="approve" data-proposal-id="${escapeHtml(proposal.id)}">批准 v${proposal.proposedVersion || 1}</button></div>` : `<span class="learning-badge">${learningBadge(proposal.status)}</span>`}</div>`).join("") : "<p>尚无蓝图升级建议。</p>";
}

function renderLearningVersions(blueprints = []) {
  const target = $("#learningVersionList");
  if (!target) return;
  const sorted = [...blueprints].sort((a, b) => String(a.familyId).localeCompare(String(b.familyId)) || Number(b.version || 0) - Number(a.version || 0));
  target.innerHTML = sorted.length ? sorted.map((item) => `<div class="learning-list-item"><div><strong>${escapeHtml(item.contentArchetype || "内容蓝图")} · v${item.version || 1}</strong><small>${escapeHtml(item.familyId || "未分组")} · ${escapeHtml(item.platform || "通用")}</small></div><div><span>${escapeHtml((item.titleMechanisms || []).join(" / ") || "未设置标题机制")}</span><div class="learning-version-diff"><span>样本 ${item.sampleCount || 1}</span><span>置信 ${Math.round(item.confidenceScore || 0)}</span><span>效果 ${item.performanceScore ?? "待测"}</span>${item.parentBlueprintId ? "<span>由上一版本升级</span>" : "<span>初始版本</span>"}</div></div><span class="learning-badge">${learningBadge(item.lifecycle)}</span></div>`).join("") : "<p>尚无正式蓝图版本。</p>";
}

function renderLearningPerformance(performance = {}, promotions = {}) {
  const records = performance.records || [];
  const suggestions = performance.suggestions || [];
  const candidates = promotions.items || [];
  const summary = $("#learningPerformanceSummary");
  if (summary) summary.innerHTML = `<article><strong>${performance.publicationCount || 0}</strong><span>有反馈发布</span></article><article><strong>${records.filter((item) => item.score != null).length}</strong><span>已评分蓝图</span></article><article><strong>${suggestions.filter((item) => item.status === "candidate").length}</strong><span>生命周期建议</span></article><article><strong>${candidates.filter((item) => item.status === "candidate").length}</strong><span>Skill 晋级候选</span></article>`;
  const performanceList = $("#learningPerformanceList");
  if (performanceList) performanceList.innerHTML = records.length || suggestions.length ? `${records.map((item) => `<div class="learning-list-item"><div><strong>蓝图 v${item.version || 1} · ${item.score == null ? "待形成评分" : `${item.score} 分`}</strong><span>使用样本 ${item.sampleSize || 0} · 相对基线 ${item.relativeLift == null ? "数据不足" : `${Math.round(item.relativeLift * 100)}%`}</span><small>${escapeHtml(item.interpretationBoundary || "相关性归因，不等于因果证明")}</small></div></div>`).join("")}${suggestions.filter((item) => item.status === "candidate").map((item) => `<div class="learning-list-item"><div><strong>生命周期建议：${item.recommendation === "validate" ? "转为已验证" : item.recommendation === "pause" ? "暂停使用" : "继续测试"}</strong><span>${escapeHtml(item.reason)}</span><small>样本 ${item.sampleSize || 0} · 评分 ${item.score ?? "--"} · 不会自动执行</small></div>${item.recommendation === "keep_testing" ? "" : `<div class="learning-list-actions"><button data-lifecycle-blueprint="${escapeHtml(item.blueprintId)}" data-lifecycle-target="${item.recommendation === "validate" ? "validated" : "paused"}">人工确认</button></div>`}</div>`).join("")}` : "<p>发布内容并回填数据后显示。</p>";
  const promotionList = $("#learningPromotionList");
  if (promotionList) promotionList.innerHTML = candidates.length ? candidates.map((item) => `<div class="learning-list-item"><div><strong>${escapeHtml(item.targetSkill)}</strong><span>${escapeHtml(item.reason)}</span><small>蓝图 v${item.blueprintVersion || 1} · ${learningBadge(item.status)}</small></div>${item.status === "candidate" ? `<div class="learning-list-actions"><button data-promotion-review="reject" data-promotion-id="${escapeHtml(item.id)}">拒绝</button><button class="primary" data-promotion-review="approve" data-promotion-id="${escapeHtml(item.id)}">评测通过并发布</button></div>` : `<span class="learning-badge">${learningBadge(item.status)}</span>`}</div>`).join("") : "<p>只有 validated 且通过评测的蓝图可以晋级。</p>";
}

function renderLearningEvaluationSuite(suite = {}) {
  const target = $("#learningEvaluationList");
  if (!target) return;
  const grouped = (suite.cases || []).reduce((map, item) => {
    map[item.skillName] = (map[item.skillName] || 0) + 1;
    return map;
  }, {});
  target.innerHTML = Object.keys(grouped).length
    ? Object.entries(grouped).map(([skillName, count]) => `<div class="learning-list-item"><div><strong>${escapeHtml(skillName)}</strong><span>${count} 个案例回归任务</span><small>来自 ${suite.sourceCount || 0} 篇已批准案例；用于版本回归，不预测平台流量</small></div><span class="learning-badge">待运行</span></div>`).join("")
    : "<p>批准案例后自动形成标题、大纲和平台写作评测任务。</p>";
}

async function loadLearningCenter() {
  if (!$("#learningCenterTabs")) return;
  try {
    const [status, imports, clusters, proposals, blueprints, performance, promotions, evaluationSuite] = await Promise.all([
      window.FlowAPI.getContentLearningStatus("acc_xhs"),
      window.FlowAPI.getContentLearningImports("acc_xhs"),
      window.FlowAPI.getContentLearningClusters("acc_xhs"),
      window.FlowAPI.getContentLearningProposals("acc_xhs"),
      window.FlowAPI.getContentLearningBlueprints("acc_xhs"),
      window.FlowAPI.getContentLearningPerformance("acc_xhs"),
      window.FlowAPI.getContentLearningPromotions("acc_xhs"),
      window.FlowAPI.getContentLearningEvaluationSuite("acc_xhs")
    ]);
    const counts = status.counts || {};
    $("#learningImportSummary").innerHTML = `<article><strong>${counts.references || 0}</strong><span>累计案例</span></article><article><strong>${counts.importJobs || 0}</strong><span>导入任务</span></article><article><strong>${counts.candidates || 0}</strong><span>待审核候选</span></article><article><strong>${(imports.items || []).reduce((sum, item) => sum + Number(item.counts?.duplicates || 0) + Number(item.counts?.failed || 0), 0)}</strong><span>重复/失败</span></article>`;
    renderLearningImportJobs(imports.items || []);
    renderLearningClusters(clusters.items || []);
    renderLearningProposals(proposals.items || []);
    renderLearningVersions(blueprints.items || []);
    renderLearningPerformance(performance, promotions);
    renderLearningEvaluationSuite(evaluationSuite);
  } catch (error) {
    showToast(`内容学习中心载入失败：${error.message}`);
  }
}

$("#analyzeViral").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  button.textContent = "正在解析标题、结构与视觉...";
  button.disabled = true;
  $("#viralAnalysis").style.opacity = ".45";
  try {
    const comments = $("#viralCommentSamples").value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
    const result = await window.FlowAPI.analyzeReference({ accountId: "acc_xhs", url: $("#viralUrl").value, platform: "xiaohongshu", title: $("#viralTitle").value.trim(), accountType: $("#viralAccountType").value, format: $("#viralFormat").value, usageRights: "public-analysis", metrics: { likes: Number($("#viralLikes").value || 0), saves: Number($("#viralSaves").value || 0), comments: Number($("#viralComments").value || 0), shares: Number($("#viralShares").value || 0) }, comments });
    currentViralAnalysisId = result.id;
    currentPatternAnalysisId = result.contentPatternAnalysisId || `pattern_analysis_${result.id}`;
    setPatternReviewState("candidate");
    $("#viralLearningSummary").textContent = "已生成低置信度候选：它记录的是可复用结构假设，不代表因果结论。请确认后再创建正式蓝图版本。";
    $("#viralOverallScore").textContent = result.valueScore?.overall ?? 89;
    $("#viralSaveScore").textContent = result.valueScore?.save ?? 94;
    $("#viralConversionScore").textContent = result.valueScore?.conversion ?? 91;
    const saveToLike = result.baseData?.rates?.saveToLike;
    const intentKeywords = result.baseData?.conversionIntent?.keywords || [];
    $("#viralScoreSummary").textContent = `收藏/点赞 ${saveToLike ?? "--"}% · ${intentKeywords.length} 类高意向评论表达`;
    $("#viralTitleFormula").textContent = result.titleAnalysis?.formula || "反常识否定 + 具体内容场景 + 更重要的判断";
    button.textContent = "重新拆解";
    button.disabled = false;
    $("#viralAnalysis").style.opacity = "1";
    showToast(`拆解完成：收藏价值 ${result.valueScore?.save || 94}，转化潜力 ${result.valueScore?.conversion || 91}`);
  } catch (error) {
    button.textContent = "开始 AI 拆解";
    button.disabled = false;
    $("#viralAnalysis").style.opacity = "1";
    showToast(`拆解失败：${error.message}`);
  }
});

$("#approveViralPattern").addEventListener("click", async (event) => {
  if (!currentPatternAnalysisId) return showToast("请先完成一次爆款拆解");
  event.currentTarget.disabled = true;
  try {
    const result = await window.FlowAPI.reviewContentPattern(currentPatternAnalysisId, { accountId: "acc_xhs", decision: "approve", reviewerId: "product_user", lifecycle: "approved", notes: "人工确认结构规律可用于后续测试" });
    setPatternReviewState("approved");
    $("#viralLearningSummary").textContent = `已创建蓝图 v${result.blueprint?.version || 1}。后续内容任务只会读取结构规则，并保留版本归因。`;
    await loadContentLearning();
    showToast("蓝图已批准；开启学习层后可由内容 Agent 选择使用");
  } catch (error) {
    setPatternReviewState("candidate");
    showToast(`蓝图审核失败：${error.message}`);
  }
});

$("#rejectViralPattern").addEventListener("click", async () => {
  if (!currentPatternAnalysisId) return showToast("请先完成一次爆款拆解");
  try {
    await window.FlowAPI.reviewContentPattern(currentPatternAnalysisId, { accountId: "acc_xhs", decision: "reject", reviewerId: "product_user", notes: "当前样本不适合沉淀" });
    setPatternReviewState("rejected");
    $("#viralLearningSummary").textContent = "该候选已忽略，不会创建蓝图，也不会进入内容生成。";
    showToast("已忽略本次候选规律");
  } catch (error) {
    showToast(`操作失败：${error.message}`);
  }
});

$("#learningCenterTabs").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-learning-tab]");
  if (!button) return;
  $$("#learningCenterTabs button").forEach((item) => item.classList.toggle("active", item === button));
  $$(".learning-center-panel").forEach((panel) => panel.classList.toggle("active", panel.dataset.learningPanel === button.dataset.learningTab));
});

$("#learningFolderInput").addEventListener("change", (event) => {
  pendingLearningFiles = [...event.target.files];
  $("#learningFileCount").textContent = pendingLearningFiles.length ? `已选择 ${pendingLearningFiles.length} 个文件` : "尚未选择文件";
  $("#importLearningBatch").disabled = !pendingLearningFiles.length;
});

$("#importLearningBatch").addEventListener("click", async (event) => {
  if (!pendingLearningFiles.length) return;
  const button = event.currentTarget;
  button.disabled = true;
  button.textContent = "正在读取与去重...";
  try {
    const items = [];
    for (const file of pendingLearningFiles) {
      const text = await file.text();
      if (file.name.toLowerCase().endsWith(".json")) {
        try {
          const parsed = JSON.parse(text);
          const records = Array.isArray(parsed) ? parsed : Array.isArray(parsed.items) ? parsed.items : [parsed];
          items.push(...records.map((item) => ({ ...item, name: item.name || file.webkitRelativePath || file.name })));
          continue;
        } catch {}
      }
      const firstLine = text.split(/\r?\n/).find((line) => line.trim()) || file.name.replace(/\.[^.]+$/, "");
      items.push({ name: file.webkitRelativePath || file.name, title: firstLine.replace(/^#+\s*/, "").slice(0, 180), rawText: text, format: file.name.toLowerCase().endsWith(".html") || file.name.toLowerCase().endsWith(".htm") ? "html" : "article", contentFunction: $("#learningImportFunction").value });
    }
    const result = await window.FlowAPI.importContentLearningBatch({ accountId: "acc_xhs", platform: $("#learningImportPlatform").value, sourceType: "folder", submittedBy: "product_user", items });
    showToast(`导入完成：分析 ${result.analyzed || 0} 篇，重复 ${result.job?.counts?.duplicates || 0} 篇，失败 ${result.failures?.length || 0} 篇`);
    pendingLearningFiles = [];
    $("#learningFolderInput").value = "";
    $("#learningFileCount").textContent = "尚未选择文件";
    await loadContentLearning();
  } catch (error) {
    showToast(`批量导入失败：${error.message}`);
  }
  button.disabled = !pendingLearningFiles.length;
  button.textContent = "导入并生成候选";
});

$("#runPatternClustering").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const result = await window.FlowAPI.runContentLearningClusters({ accountId: "acc_xhs" });
    renderLearningClusters(result.items || []);
    showToast(`聚类完成：生成 ${result.items?.length || 0} 个规律组`);
  } catch (error) {
    showToast(`聚类失败：${error.message}`);
  }
  button.disabled = false;
});

$("#runUpgradeProposals").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const result = await window.FlowAPI.runContentLearningProposals({ accountId: "acc_xhs" });
    renderLearningProposals(result.items || []);
    showToast(`已生成 ${result.items?.length || 0} 条蓝图升级建议`);
  } catch (error) {
    showToast(`升级建议生成失败：${error.message}`);
  }
  button.disabled = false;
});

$("#learningProposalList").addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-proposal-review]");
  if (!button) return;
  button.disabled = true;
  try {
    const result = await window.FlowAPI.reviewContentLearningProposal(button.dataset.proposalId, { accountId: "acc_xhs", decision: button.dataset.proposalReview, reviewerId: "product_user", lifecycle: "testing", notes: "人工核对聚类样本与版本差异" });
    showToast(result.blueprint ? `已创建蓝图 v${result.blueprint.version}` : "已拒绝该升级建议");
    await loadContentLearning();
  } catch (error) {
    showToast(`审核失败：${error.message}`);
    button.disabled = false;
  }
});

$("#refreshPatternPerformance").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const [performance, promotions] = await Promise.all([window.FlowAPI.refreshContentLearningPerformance({ accountId: "acc_xhs" }), window.FlowAPI.getContentLearningPromotions("acc_xhs")]);
    renderLearningPerformance(performance, promotions);
    showToast("效果归因已刷新；结果仅代表相关性");
  } catch (error) {
    showToast(`效果刷新失败：${error.message}`);
  }
  button.disabled = false;
});

$("#refreshEvaluationSuite").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const suite = await window.FlowAPI.getContentLearningEvaluationSuite("acc_xhs");
    renderLearningEvaluationSuite(suite);
    showToast(`已形成 ${suite.cases?.length || 0} 个案例回归任务`);
  } catch (error) {
    showToast(`案例评测集刷新失败：${error.message}`);
  }
  button.disabled = false;
});

$("#learningPerformanceList").addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-lifecycle-blueprint]");
  if (!button) return;
  button.disabled = true;
  try {
    await window.FlowAPI.updatePatternLifecycle(button.dataset.lifecycleBlueprint, { accountId: "acc_xhs", lifecycle: button.dataset.lifecycleTarget, reviewerId: "product_user", notes: "依据效果看板建议人工确认" });
    showToast(button.dataset.lifecycleTarget === "validated" ? "蓝图已标记为已验证" : "蓝图已暂停使用");
    await loadContentLearning();
  } catch (error) {
    showToast(`生命周期更新失败：${error.message}`);
    button.disabled = false;
  }
});

$("#runSkillPromotion").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const result = await window.FlowAPI.runSkillPromotions({ accountId: "acc_xhs" });
    renderLearningPerformance(await window.FlowAPI.getContentLearningPerformance("acc_xhs"), { items: result.items || [], patternPacks: [] });
    showToast(`生成 ${result.created?.length || 0} 个 Skill 晋级候选`);
  } catch (error) {
    showToast(`Skill 晋级检查失败：${error.message}`);
  }
  button.disabled = false;
});

$("#learningPromotionList").addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-promotion-review]");
  if (!button) return;
  button.disabled = true;
  try {
    await window.FlowAPI.reviewSkillPromotion(button.dataset.promotionId, { accountId: "acc_xhs", decision: button.dataset.promotionReview, reviewerId: "product_user", regressionPassed: button.dataset.promotionReview === "approve", notes: "人工确认回归结果后发布运行时参考包" });
    showToast(button.dataset.promotionReview === "approve" ? "专项 Skill 运行时参考包已发布" : "已拒绝晋级候选");
    await loadLearningCenter();
  } catch (error) {
    showToast(`Skill 晋级审核失败：${error.message}`);
    button.disabled = false;
  }
});

$("#viralAnalysisTabs").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-analysis-tab]");
  if (!button) return;
  $$("#viralAnalysisTabs button").forEach((item) => item.classList.remove("active"));
  $$(".viral-analysis-panel").forEach((panel) => panel.classList.remove("active"));
  button.classList.add("active");
  $(`.viral-analysis-panel[data-analysis-panel="${button.dataset.analysisTab}"]`).classList.add("active");
});

$("#createFromViral").addEventListener("click", async (event) => {
  if (!currentViralAnalysisId) return showToast("请先完成爆款拆解");
  const button = event.currentTarget;
  button.disabled = true;
  button.textContent = "正在创建原创简报...";
  try {
    const result = await window.FlowAPI.createReferenceRemix(currentViralAnalysisId, { accountId: "acc_xhs", platform: "xiaohongshu", newTopic: "AI内容工作流如何帮助企业稳定产出", knowledgeIds: ["company_bluemuse", "campaign_summer"], promotionMode: "soft" });
    showToast(`原创简报已创建：${result.status === "ready_for_generation" ? "可进入内容生成" : "处理中"}`);
    $("#customTopicInput").value = result.originalBrief?.newTopic || "AI内容工作流如何帮助企业稳定产出";
    setGenerationMode("custom");
    switchView("generate");
  } catch (error) {
    showToast(`原创重构失败：${error.message}`);
  }
  button.disabled = false;
  button.textContent = "生成原创内容";
});

$("#clearUrl").addEventListener("click", () => {
  $("#viralUrl").value = "";
  $("#viralUrl").focus();
});

$$('.check-row button').forEach((button) => {
  button.addEventListener("click", () => button.classList.toggle("active"));
});

$$('.filter-tabs').forEach((tabs) => {
  tabs.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    tabs.querySelectorAll("button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
  });
});

$$('.topic-card-top > button').forEach((button) => {
  button.addEventListener("click", () => {
    button.textContent = button.textContent === "★" ? "☆" : "★";
    showToast(button.textContent === "★" ? "已收藏选题" : "已取消收藏");
  });
});

$("#accountManagementList").addEventListener("click", (event) => {
  const item = event.target.closest(".managed-account");
  if (item) selectAccount(item.dataset.accountId);
});

$("#newAccount").addEventListener("click", () => {
  $("#accountForm").reset();
  $("#accountId").value = "";
  $("#accountFormTitle").textContent = "新建平台账号";
  const company=agentAccountsCache.find((item)=>item.id===currentAgentAccountId);
  $("#accountCompanyDisplay").value=company?.name||currentAgentAccountId||"请先选择公司";
  $("#accountConfigurationStatus").value="待完善";
  $("#accountStatus").value="active";
  $$('[data-account-trust]').forEach((input)=>{input.checked=false;});
  $("#viFileCount").textContent = "尚未上传";
  $("#templateFileCount").textContent = "尚未上传";
  renderAccountDesignDna(null);
  renderDesignDnaAuthoring(null, []);
});

$("#accountViFiles").addEventListener("change", (event) => {
  $("#viFileCount").textContent = event.target.files.length ? `${event.target.files.length} 个文件待保存` : "尚未上传";
});

$("#accountTemplateFiles").addEventListener("change", (event) => {
  $("#templateFileCount").textContent = event.target.files.length ? `${event.target.files.length} 个模板待保存` : "尚未上传";
});

$("#previewAccountStyle").addEventListener("click", () => showToast("已在内容预览中应用当前视觉风格"));

function designDnaRuleValues(selector) {
  return $(selector).value.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean);
}

async function uploadPendingAccountVisualFiles(accountId) {
  const uploads = [
    ...[...$("#accountViFiles").files].map((file) => ({ file, assetType: "vi", label: $("#viFileCount") })),
    ...[...$("#accountTemplateFiles").files].map((file) => ({ file, assetType: "template", label: $("#templateFileCount") }))
  ];
  for (const item of uploads) {
    const form = new FormData();
    form.append("file", item.file);
    form.append("assetType", item.assetType);
    form.append("externalUseApproved", "true");
    form.append("description", `${item.assetType === "vi" ? "品牌 VI" : "历史内容"}：${item.file.name}`);
    await window.FlowAPI.uploadAccountVisualAsset(accountId, form, (progress) => { item.label.textContent = `${item.file.name} · ${progress}%`; });
  }
  if (uploads.length) {
    $("#accountViFiles").value = "";
    $("#accountTemplateFiles").value = "";
  }
  return uploads.length;
}

$("#analyzeAccountVisualSources")?.addEventListener("click", async (event) => {
  const accountId = $("#accountId").value;
  if (!accountId) return showToast("请先保存这个小红书账号，再上传品牌资料");
  const button = event.currentTarget;
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "正在准备资料…";
  try {
    const uploaded = await uploadPendingAccountVisualFiles(accountId);
    button.textContent = "正在识别品牌风格…";
    const latest = await loadAccountDesignDna(accountId);
    const sourceFileIds = asArray(latest?.availableSources).filter((source) => ["ready", "visual_ready"].includes(source.parseStatus)).map((source) => source.fileId);
    if (!sourceFileIds.length) return showToast("请先上传一份可以读取的品牌资料");
    const result = await window.FlowAPI.analyzeDesignDnaSources(accountId, {
      sourceFileIds
    });
    renderDesignDnaAuthoring(null, currentAccountDesignDnaSources, result.item);
    await refreshRuntimeStatus();
    showToast(`${uploaded ? `已上传 ${uploaded} 份资料并` : ""}完成品牌风格识别，请检查结果`);
  } catch (error) {
    const status = $("#accountVisualAnalysisStatus");
    if (status) status.textContent = `识别未完成：${error.message}。资料已经保留，可以直接重新识别。`;
    showToast(`品牌风格识别失败：${error.message}`);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
});

$("#generateAccountDesignDna").addEventListener("click", async () => {
  const accountId = $("#accountId").value;
  if (!accountId) return showToast("请先保存账号，再生成 Design DNA 待确认版本");
  const sourceAuthorizations = currentAccountDesignDnaSources.map((source) => ({
    fileId: source.fileId,
    externalUseApproved: ["ready", "visual_ready"].includes(source.parseStatus)
  }));
  const hasApprovedSource = sourceAuthorizations.some((item) => item.externalUseApproved);
  const userAuthoredRulesAuthorized = !hasApprovedSource;
  const payload = {
    mode: hasApprovedSource ? "approved_sources" : "user_authored",
    userAuthoredRulesAuthorized,
    sourceAuthorizations,
    styleRules: {
      colors: designDnaRuleValues("#accountDnaColors"),
      fontPreferences: designDnaRuleValues("#accountDnaFonts"),
      layoutPreferences: designDnaRuleValues("#accountDnaLayouts"),
      materials: designDnaRuleValues("#accountDnaMaterials"),
      photographyOrIllustrationDirection: $("#accountDnaMediaDirection").value,
      forbiddenMotifs: designDnaRuleValues("#accountDnaForbidden"),
      referenceNotes: $("#accountDnaNotes").value.trim()
    }
  };
  try {
    await window.FlowAPI.createDesignDna(accountId, payload);
    await loadAccountDesignDna(accountId);
    showToast("这套风格已保存，请完成最后确认");
  } catch (error) {
    showToast(`视觉规范保存失败：${error.message}`);
  }
});

$("#accountDesignDnaPanel").addEventListener("click", async (event) => {
  if (!event.target.closest("#confirmAccountDesignDna")) return;
  const accountId = $("#accountId").value;
  if (!accountId) return showToast("请先保存账号并上传品牌资料");
  const reviewedRef = currentAccountDesignDnaSnapshotRef;
  if (!reviewedRef || reviewedRef.accountId !== accountId) return showToast("请重新加载并检查当前视觉规范后再确认");
  try {
    await window.FlowAPI.confirmDesignDna(accountId, { id: reviewedRef.id, hash: reviewedRef.hash }, { decision: "confirmed", confirmedBy: "workspace_user", note: "已审阅文字化视觉规则与外部使用范围" });
    await loadAccountDesignDna(accountId);
    showToast("小红书视觉规范已确认，后续整页图文会引用这一版");
  } catch (error) { showToast(`视觉规范确认失败：${error.message}`); }
});

$("#accountForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const accountId = $("#accountId").value;
  const existingAccount = accountsCache.find((item) => item.id === accountId);
  const viFiles = [...$("#accountViFiles").files];
  const templateFiles = [...$("#accountTemplateFiles").files];
  const subjectType=$("#accountSubjectType").value;
  const speakerType=$("#accountSpeakerType").value;
  const trustSources=$$('[data-account-trust]:checked').map((input)=>input.dataset.accountTrust);
  const payload = { companyId: existingAccount?.companyId || currentAgentAccountId || "account_damaishuzhi", name: $("#accountName").value.trim(), platform: $("#accountPlatform").value, operatorName:$("#accountOperator").value.trim(),status:$("#accountStatus").value,businessMode: $("#accountMode").value, audience: $("#accountAudience").value.trim(), tone: $("#accountTone").value.trim(), contentPillars: $("#accountPillars").value.split(/[,，]/).map((item) => item.trim()).filter(Boolean),accountIdentity:{id:existingAccount?.accountIdentityId,companyId:existingAccount?.companyId||currentAgentAccountId,socialAccountId:existingAccount?.id,subjectType,publicIdentity:decisionIdentityLabels[subjectType]||"",speakerType,speakerDetail:$("#accountSpeakerDetail").value.trim(),trustSources}, visualStyle: { ...(existingAccount?.visualStyle || {}), name: "账号视觉系统", description: $("#accountVisualStyle").value.trim() } };
  if (!payload.name) return showToast("请输入账号名称");
  if(!payload.operatorName)return showToast("请填写运营主体");
  if(!subjectType||!speakerType||!trustSources.length)return showToast("请完成对外账号身份、持续发声者，并至少选择一项主要信任来源");
  try {
    const saved = await (accountId ? window.FlowAPI.updateAccount(accountId, payload) : window.FlowAPI.createAccount(payload));
    const uploads = [...viFiles.map((file) => ({ file, assetType: "vi", label: $("#viFileCount") })), ...templateFiles.map((file) => ({ file, assetType: "template", label: $("#templateFileCount") }))];
    for (let index = 0; index < uploads.length; index += 1) {
      const item = uploads[index];
      const form = new FormData();
      form.append("file", item.file);
      form.append("assetType", item.assetType);
      form.append("externalUseApproved", "true");
      form.append("description", `${item.assetType === "vi" ? "品牌 VI" : "内容模板"}：${item.file.name}`);
      form.append("styleInput", JSON.stringify({ description: payload.visualStyle.description }));
      await window.FlowAPI.uploadAccountVisualAsset(saved.id, form, (progress) => { item.label.textContent = `${item.file.name} · ${progress}%`; });
    }
    const imageUploads = uploads.filter((item) => /^image\//.test(item.file.type || "")).length;
    showToast(uploads.length
      ? `账号已保存，${uploads.length} 份品牌资料已上传${imageUploads ? `，其中 ${imageUploads} 张图片等待识别` : "并已准备好"}。现在可以开始识别品牌风格`
      : (accountId ? "账号属性与视觉风格已保存" : "账号已创建"));
    await loadAccounts(saved.id);
  } catch (error) {
    showToast(`保存失败：${error.message}`);
  }
});

$("#knowledgeSearch").addEventListener("input", (event) => {
  window.clearTimeout(loadKnowledge.timer);
  loadKnowledge.timer = window.setTimeout(() => loadKnowledge(event.target.value.trim()), 250);
});

$("#knowledgeFolderList").addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-folder-id]");
  if (!button) return;
  currentKnowledgeFolderId = button.dataset.folderId;
  const result = await window.FlowAPI.getKnowledgeFiles(currentKnowledgeFolderId, $("#knowledgeSearch").value.trim(), currentAgentAccountId || "account_damaishuzhi");
  knowledgeFilesCache = result.items || [];
  renderKnowledgeBrowser();
});

$("#newKnowledgeFolder").addEventListener("click", async () => {
  const name = window.prompt("文件夹名称，例如：客户案例");
  if (!name?.trim()) return;
  try {
    const created = await window.FlowAPI.createKnowledgeFolder({ companyId: currentAgentAccountId || "account_damaishuzhi", name: name.trim(), description: "自定义知识文件夹", icon: "▤" });
    currentKnowledgeFolderId = created.id;
    showToast(`已创建文件夹：${created.name}`);
    await loadKnowledge();
    await loadGenerationKnowledgeAssets();
  } catch (error) {
    showToast(`创建失败：${error.message}`);
  }
});

function queueKnowledgeFiles(files) {
  pendingKnowledgeFiles.push(...files);
  const current = pendingKnowledgeFiles[0];
  if (!current) return;
  $("#uploadFileName").textContent = current.name;
  $("#uploadFileTags").value = "";
  $("#uploadFileDescription").value = "";
  $("#uploadMetaPanel").hidden = false;
  $("#uploadFileTags").focus();
}

[$("#knowledgeFileInput"), $("#knowledgeFileInputInline")].forEach((input) => input.addEventListener("change", (event) => queueKnowledgeFiles([...event.target.files])));

$("#cancelKnowledgeUpload").addEventListener("click", () => {
  pendingKnowledgeFiles = [];
  $("#uploadMetaPanel").hidden = true;
});

$("#confirmKnowledgeUpload").addEventListener("click", async () => {
  const file = pendingKnowledgeFiles[0];
  const tags = $("#uploadFileTags").value.split(/[,，]/).map((item) => item.trim()).filter(Boolean);
  if (!file) return;
  if (!tags.length) return showToast("每个文件至少需要一个标签");
  const button = $("#confirmKnowledgeUpload");
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "上传并解析中...";
  try {
    const formData = new FormData();
    formData.append("folderId", currentKnowledgeFolderId);
    formData.append("tags", JSON.stringify(tags));
    formData.append("description", $("#uploadFileDescription").value.trim());
    formData.append("companyId", currentAgentAccountId || "account_damaishuzhi");
    formData.append("file", file, file.name);
    const saved = await window.FlowAPI.createKnowledgeFile(formData);
    pendingKnowledgeFiles.shift();
    if (pendingKnowledgeFiles.length) {
      $("#uploadFileName").textContent = pendingKnowledgeFiles[0].name;
      $("#uploadFileTags").value = "";
      $("#uploadFileDescription").value = "";
      showToast(`${saved.name} 已${saved.parseStatus === "ready" ? "解析并建立索引" : "保存，但解析失败"}，请处理下一个文件`);
    } else {
      $("#uploadMetaPanel").hidden = true;
      showToast(saved.parseStatus === "ready" ? `文件已保存并建立 ${saved.chunkCount} 个知识片段` : `文件已保存，但解析失败：${saved.errorMessage || "请检查格式"}`);
      await loadKnowledge();
      await loadGenerationKnowledgeAssets();
    }
  } catch (error) {
    showToast(`上传失败：${error.message}`);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
});

$("#sourceConfigList").addEventListener("change", async (event) => {
  const row = event.target.closest("article[data-source-id]");
  if (!row || event.target.type !== "checkbox") return;
  try {
    await window.FlowAPI.updateSource(row.dataset.sourceId, { enabled: event.target.checked });
    showToast(event.target.checked ? "来源已启用" : "来源已停用");
  } catch (error) { showToast(`来源更新失败：${error.message}`); }
});

$("#runSources").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  button.textContent = "正在采集...";
  try {
    const result = await window.FlowAPI.runCollection({ sourceIds: ["source_rss", "source_search", "source_manual"] });
    showToast(`采集完成：发现 ${result.discovered} 个机会`);
  } catch (error) { showToast(`采集失败：${error.message}`); }
  button.disabled = false;
  button.textContent = "运行全部来源";
});

window.FlowAPI.getDashboard().then((result) => {
  if (result?.stats?.opportunities) {
    const opportunityCount = $('.nav-item[data-view-target="opportunities"] .count');
    if (opportunityCount) opportunityCount.textContent = result.stats.opportunities;
  }
}).catch(() => {
  document.documentElement.dataset.apiMode = "offline";
});

async function loadDeepLinkedContentTask() {
  const taskId = new URLSearchParams(location.search).get("contentTaskId");
  if (!taskId || window.FlowAPI.mode !== "live") return;
  try {
    await loadGenerationAccounts();
    const task = await window.FlowAPI.getContentTask(taskId);
    currentContentTaskId = task.id;
    currentContentTask = task;
    currentPublicationId = task.publicationId || null;
    $("#savePublicationFeedback").disabled = false;
    currentRevisionVersion = task.version || 1;
    currentPlatform = task.platform;
    $("#accountSelect").value = task.accountId || $("#accountSelect").value;
    $("#generationPlatformSelect").value = task.platform;
    $$("#platformTabs button").forEach((button) => button.classList.toggle("active", button.dataset.platform === task.platform));
    $("#revisionVersion").textContent = `当前版本 v${currentRevisionVersion}`;
    $(".editor-status span:first-child").textContent = `内容包 v${currentRevisionVersion}`;
    renderContentPackage(task);
    await loadContentVersions();
    await refreshContentExecutionUI();
  } catch (error) { showToast(`内容任务加载失败：${error.message}`); }
}

async function loadStrategyHotspotDeepLink() {
  const params = new URLSearchParams(location.search);
  if (params.get("view") !== "opportunities" || params.get("source") !== "agent" || window.FlowAPI.mode !== "live") return;
  try {
    const accountId = params.get("accountId") || currentAgentAccountId;
    currentAgentAccountId = accountId;
    localStorage.setItem("flowsocial.agentAccountId", currentAgentAccountId);
    const overview = await window.FlowAPI.getAgentOverview(accountId);
    const firstDirection = overview.directionSet?.payload?.directions?.[0];
    if (firstDirection) currentDirectionId = firstDirection.id;
    currentHotspotPool = "keyword";
    switchView("opportunities");
    await loadDirections();
    await setHotspotPool("keyword", false);
  } catch (error) {
    showToast("策略方向载入失败：" + error.message);
  }
}
