(function () {
  const query = new URLSearchParams(location.search);
  const demoRequested = window.__FLOW_DEMO_MODE__ === true || query.get("demo") === "1";
  const liveBase = demoRequested ? null : (window.__FLOW_API_BASE__ || (location.protocol.startsWith("http") ? "/api/v1" : null));
  const mockDirections = [
    { id: "direction_ai", name: "AI定制化智能体", shortName: "AI", description: "企业AI智能体 · AI员工 · 知识库", keywords: ["AI Agent", "AI智能体", "AI员工", "企业知识库"], refreshSchedule: "daily", lastRefreshedAt: new Date().toISOString() },
    { id: "direction_site", name: "独立站建站", shortName: "独立站", description: "外贸建站 · SEO · 询盘转化", keywords: ["独立站", "外贸建站", "SEO", "网站转化率"], refreshSchedule: "daily", lastRefreshedAt: new Date().toISOString() }
  ];
  const mockKnowledgeFolders = [
    { id: "folder_product", name: "产品介绍", description: "产品功能、服务说明、价格与案例资料", icon: "产", fileCount: 3 },
    { id: "folder_company", name: "公司简介", description: "公司介绍、团队、品牌故事与服务能力", icon: "司", fileCount: 2 },
    { id: "folder_cases", name: "客户案例", description: "可公开引用的项目案例与结果", icon: "例", fileCount: 2 },
    { id: "folder_campaign", name: "最新活动", description: "近期活动、优惠和时间信息", icon: "活", fileCount: 2 }
  ];
  // Demo mode must not imply that a company already owns configured platform accounts.
  const mockAccounts = [];
  const mockKnowledgeFiles = [
    { id: "file_ai_intro", folderId: "folder_product", name: "AI定制化智能体产品介绍.pdf", kind: "document", sizeLabel: "2.4 MB", tags: ["AI智能体", "产品功能", "企业服务"], description: "功能模块、适用场景和实施流程。", updatedLabel: "今天更新" },
    { id: "file_ai_scene", folderId: "folder_product", name: "企业AI应用场景.xlsx", kind: "sheet", sizeLabel: "680 KB", tags: ["应用场景", "行业方案"], description: "不同行业的智能体应用场景清单。", updatedLabel: "昨天更新" },
    { id: "file_site_image", folderId: "folder_product", name: "独立站服务封面图.jpg", kind: "image", sizeLabel: "1.8 MB", tags: ["独立站", "产品图片", "封面"], description: "独立站建站服务的品牌视觉素材。", updatedLabel: "7月13日" },
    { id: "file_company", folderId: "folder_company", name: "大卖数智公司介绍.pptx", kind: "document", sizeLabel: "8.2 MB", tags: ["公司介绍", "服务能力"], description: "公司定位、团队与核心服务能力。", updatedLabel: "7月12日" },
    { id: "file_brand", folderId: "folder_company", name: "品牌故事与团队照片.zip", kind: "image", sizeLabel: "22 MB", tags: ["品牌故事", "团队图片"], description: "品牌故事文案及团队图片。", updatedLabel: "7月10日" },
    { id: "file_case_ai", folderId: "folder_cases", name: "制造业AI知识库案例.docx", kind: "document", sizeLabel: "1.1 MB", tags: ["客户案例", "制造业", "知识库"], description: "已脱敏的智能体实施案例。", updatedLabel: "7月11日" },
    { id: "file_case_site", folderId: "folder_cases", name: "外贸独立站改版案例.pdf", kind: "document", sizeLabel: "3.6 MB", tags: ["客户案例", "独立站", "询盘转化"], description: "网站结构与内容改版过程。", updatedLabel: "7月9日" }
  ];
  function mockOpportunity(directionId) {
    const website = directionId === "direction_site";
    return {
      id: website ? "opp_site_demo" : "opp_ai_demo",
      directionId,
      title: website ? "外贸独立站正在从展示网站转向询盘转化系统" : "AI Agent 正在进入企业营销工作流",
      summary: website ? "企业关注点从网站是否上线，转向内容结构、信任证据、询盘路径和持续获客能力。" : "企业开始关注 AI 如何进入真实业务流程，并与知识、内容生产和团队协作连接。",
      score: website ? 90 : 87,
      trend: "rising",
      expiresInHours: website ? 96 : 72,
      sourceCount: website ? 6 : 7,
      keywords: website ? ["外贸独立站", "询盘转化", "品牌官网", "SEO"] : ["AI Agent", "AI营销", "企业工作流", "内容自动化"],
      whyHot: "趋势、平台高互动内容、行业资讯和评论问题出现交叉信号。",
      topicIdeas: website ? ["为什么很多外贸独立站上线后没有询盘？", "展示型官网和获客型独立站，差别到底在哪里？", "外贸独立站首页必须回答客户的5个问题", "小团队建设独立站，应该先做内容还是先做设计？"] : ["企业为什么需要AI员工，而不是更多AI工具？", "AI Agent如何改变内容营销工作流？", "小团队如何用AI完成多平台内容运营？", "AI社媒工作台到底能解决什么问题？"],
      productFits: website ? ["独立站建站服务", "SEO与内容服务"] : ["AI定制化智能体", "企业知识库"],
      commentQuestions: website ? ["独立站上线后为什么没有询盘？", "SEO 和广告应该先做哪一个？"] : ["AI Agent 和普通自动化有什么区别？", "小团队从哪里开始实施？"],
      risks: ["避免夸大转化效果", "区分趋势判断与已验证事实"],
      sourceEvidence: [{ type: "trend", source: "Google Trends", label: website ? "独立站相关词" : "AI Agent", signal: "近7天上升", mode: "demo" }, { type: "industry", source: "行业资讯样本", label: "跨来源验证", signal: "多个独立来源", mode: "demo" }]
    };
  }

  const fallback = {
    dashboard: async () => ({ mode: "mock", stats: { published: 18, pending: 7, opportunities: 12, onTimeRate: 92 } }),
    opportunities: async () => ({ mode: "mock", items: [] }),
    hotspots: async (poolType) => ({ mode: "mock", poolType, items: [], latestRun: null }),
    collect: async () => wait({ runId: `run_${Date.now()}`, status: "succeeded", discovered: 3, merged: 5 }),
    hotspot: async (payload) => wait({ run: { id: `hotrun_${Date.now()}`, status: "succeeded", mode: "demo", stages: [{ id: "indices", name: "趋势指数", status: "succeeded", count: 2 }, { id: "platforms", name: "平台搜索", status: "succeeded", count: 2 }, { id: "industry", name: "行业资讯", status: "succeeded", count: 5 }, { id: "competitors", name: "竞品账号", status: "succeeded", count: 8 }, { id: "comments", name: "评论洞察", status: "succeeded", count: 4 }, { id: "card", name: "热点卡片", status: "succeeded", count: 1 }] }, opportunity: mockOpportunity(payload.directionId || "direction_ai") }, 900),
    generateTopics: async (opportunityId) => wait({ opportunityId, created: 3, status: "ready" }),
    topics: async () => ({ mode: "mock", items: [] }),
    topicPipeline: async (payload) => wait({ run: { id: `topicrun_${Date.now()}`, status: "succeeded", category: payload.category, candidateCount: 0, approvedCount: 0, rejectedCount: 0 }, topics: [], rejected: [] }),
    selectPlatformTopic: async (topicId, payload) => wait({ id: `topicselection_${Date.now()}`, topicId, status: "selected", ...payload }),
    analyzeReference: async (payload) => {
      const id = `analysis_${Date.now()}`;
      const contentPatternAnalysisId = `pattern_analysis_${id}`;
      mockLearning.analyses.push({ id: contentPatternAnalysisId, status: "candidate", sourceReferenceIds: [`reference_${id}`], blueprintCandidate: { platform: payload.platform || "xiaohongshu", contentArchetype: "article", titleMechanisms: ["反常识 + 场景 + 判断"], structureRules: ["问题", "原因", "方法", "行动"] } });
      return wait({ id, contentPatternAnalysisId, status: "succeeded", reference: payload, valueScore: { overall: 89, save: 94, conversion: 91 }, baseData: { rates: { saveToLike: 42.31 }, conversionIntent: { keywords: ["求资料", "怎么做", "想了解"] } }, titleAnalysis: { formula: "反常识否定 + 具体内容场景 + 更重要的判断" }, blueprint: { viralType: "企业运营干货型" } });
    },
    contentLearningStatus: async () => ({ enabled: false, counts: { references: mockLearning.references.length, importJobs: mockLearning.imports.length, candidates: mockLearning.analyses.filter((item) => item.status === "candidate").length, approvedAnalyses: mockLearning.analyses.filter((item) => item.status === "approved").length, productionBlueprints: mockLearning.blueprints.length, clusters: mockLearning.clusters.length, upgradeProposals: mockLearning.proposals.filter((item) => item.status === "candidate").length, skillPromotionCandidates: mockLearning.promotions.filter((item) => item.status === "candidate").length, snapshots: 0 }, policy: { humanReviewRequired: true, structureOnly: true, autoStrategyMutation: false } }),
    contentLearningAnalyses: async () => ({ items: mockLearning.analyses }),
    contentLearningBlueprints: async () => ({ items: mockLearning.blueprints }),
    contentLearningImports: async () => ({ items: mockLearning.imports }),
    contentLearningReferences: async () => ({ items: mockLearning.references }),
    contentLearningClusters: async () => ({ items: mockLearning.clusters }),
    contentLearningProposals: async () => ({ items: mockLearning.proposals }),
    contentLearningPerformance: async () => ({ records: mockLearning.performance, suggestions: [], publicationCount: 0 }),
    contentLearningPromotions: async () => ({ items: mockLearning.promotions, patternPacks: mockLearning.packs }),
    contentLearningEvaluationSuite: async () => ({ sourceCount: 0, cases: [] }),
    importContentLearningBatch: async (payload) => {
      const known = new Set(mockLearning.references.map((item) => `${item.title}|${item.rawText}`));
      const accepted = (payload.items || []).filter((item) => !known.has(`${item.title || item.name}|${item.rawText || item.text || ""}`));
      const job = { id: `reference_job_${Date.now()}`, status: "completed", platform: payload.platform, counts: { submitted: (payload.items || []).length, accepted: accepted.length, duplicates: (payload.items || []).length - accepted.length, invalid: 0, analyzed: accepted.length, failed: 0 }, createdAt: new Date().toISOString() };
      mockLearning.imports.push(job);
      accepted.forEach((item, index) => {
        const reference = { id: `reference_mock_${Date.now()}_${index}`, title: item.title || item.name, rawText: item.rawText || item.text || "", platform: item.platform || payload.platform, author: item.author || null, quality: { grade: item.metrics ? "B" : "C" }, importJobId: job.id };
        mockLearning.references.push(reference);
        mockLearning.analyses.push({ id: `pattern_analysis_${reference.id}`, status: "candidate", sourceReferenceIds: [reference.id], blueprintCandidate: { platform: reference.platform, contentArchetype: "article", titleMechanisms: ["场景 + 痛点 + 明确收益"], structureRules: ["问题", "原因", "方法", "行动"], sourceReferenceIds: [reference.id] } });
      });
      return wait({ job, accepted: accepted.length, analyzed: accepted.length, failures: [] });
    },
    runContentLearningClusters: async () => {
      const groups = mockLearning.analyses.reduce((result, item) => {
        const key = item.blueprintCandidate?.platform || "unknown";
        (result[key] ||= []).push(item);
        return result;
      }, {});
      mockLearning.clusters = Object.entries(groups).map(([platform, items], index) => ({ id: `pattern_cluster_${index}`, platform, contentArchetype: "article", sampleCount: items.length, independentAuthorCount: 0, classification: items.length >= 3 ? "stable_commonality" : items.length >= 2 ? "scenario_pattern" : "hypothesis", confidenceScore: Math.min(90, 25 + items.length * 12), recurringMechanisms: items.length >= 2 ? [{ type: "structure", value: "问题—原因—方法—行动", count: items.length }] : [], oneOffMechanisms: [] }));
      return wait({ items: mockLearning.clusters });
    },
    runContentLearningProposals: async () => {
      mockLearning.proposals = mockLearning.clusters.filter((item) => item.classification !== "hypothesis").map((item) => ({ id: `upgrade_${item.id}`, status: "candidate", proposalType: "create_family", proposedVersion: 1, reason: `发现 ${item.sampleCount} 个相似样本`, confidenceScore: item.confidenceScore, evidenceWindow: { sampleCount: item.sampleCount } }));
      return wait({ items: mockLearning.proposals });
    },
    reviewContentLearningProposal: async (id, payload) => {
      const proposal = mockLearning.proposals.find((item) => item.id === id);
      proposal.status = payload.decision === "approve" ? "approved" : "rejected";
      const blueprint = payload.decision === "approve" ? { id: `pattern_${Date.now()}`, familyId: `family_${id}`, version: proposal.proposedVersion, lifecycle: "testing", platform: "xiaohongshu", contentArchetype: "article", titleMechanisms: ["场景 + 痛点 + 明确收益"], sampleCount: proposal.evidenceWindow.sampleCount, productionReady: true } : null;
      if (blueprint) mockLearning.blueprints.push(blueprint);
      return wait({ proposal, blueprint });
    },
    refreshContentLearningPerformance: async () => ({ records: mockLearning.performance, suggestions: [], publicationCount: 0 }),
    runSkillPromotions: async () => ({ items: mockLearning.promotions, created: [] }),
    reviewSkillPromotion: async (id, payload) => wait({ candidate: { id, status: payload.decision === "approve" ? "approved" : "rejected" }, patternPack: null }),
    reviewContentPattern: async (id, payload) => {
      const analysis = mockLearning.analyses.find((item) => item.id === id) || { id };
      analysis.status = payload.decision === "approve" ? "approved" : "rejected";
      const blueprint = payload.decision === "approve" ? { id: `pattern_${Date.now()}`, familyId: `pattern_family_${id}`, version: 1, lifecycle: "approved", platform: analysis.blueprintCandidate?.platform || "xiaohongshu", contentArchetype: analysis.blueprintCandidate?.contentArchetype || "article", titleMechanisms: analysis.blueprintCandidate?.titleMechanisms || ["反常识 + 场景 + 判断"], productionReady: true } : null;
      if (blueprint) mockLearning.blueprints.push(blueprint);
      return wait({ analysis, blueprint });
    },
    updatePatternLifecycle: async (id, payload) => wait({ id, ...payload }),
    remix: async (payload) => wait({ id: `remix_${Date.now()}`, status: "ready_for_generation", originalBrief: payload }),
    directions: async () => ({ items: mockDirections }),
    createDirection: async (payload) => {
      const direction = { id: `direction_${Date.now()}`, refreshSchedule: "daily", lastRefreshedAt: null, ...payload };
      mockDirections.push(direction);
      return wait(direction);
    },
    updateDirection: async (id, payload) => {
      const index = mockDirections.findIndex((item) => item.id === id);
      if (index >= 0) mockDirections[index] = { ...mockDirections[index], ...payload };
      return wait(mockDirections[index] || { id, ...payload });
    },
    library: async (directionId) => {
      const direction = mockDirections.find((item) => item.id === directionId) || mockDirections[0];
      const opportunity = mockOpportunity(direction.id);
      return { direction, opportunities: [opportunity], ideas: opportunity.topicIdeas.map((title, index) => ({ id: `${opportunity.id}_idea_${index + 1}`, opportunityId: opportunity.id, directionId: direction.id, title })) };
    },
    selectIdea: async (payload) => wait({ id: `selection_${Date.now()}`, status: "selected", ...payload }),
    recoverWechatArticle: async () => { throw new Error("演示模式不会伪造公众号正文恢复结果"); },
    contentPlan: async (payload) => wait({
      inputMode: "mock",
      schemaVersion: "0.1",
      recommendations: [
        { id: "mock_rec_1", topic: "目标客户最容易忽略的三个业务判断", contentPillar: "专业方法", contentRole: "trust", reason: "近期内容需要补充专业信任", duplication: { decision: "allow", score: 0 }, sourcePlan: { mode: "knowledge_base", rationale: ["使用账号知识形成差异化"], missing: [], sources: [{ type: "knowledge_base", role: "提供事实和案例", required: true, candidateIds: [] }] }, generationPayload: { sourceType: "content_agent_recommended", platform: payload.platform || "xiaohongshu", ideaTitle: "目标客户最容易忽略的三个业务判断", contentPurposeId: "knowledge_howto", promotionMode: "none", knowledgeFolderIds: [], contentTaskBrief: { topic: "目标客户最容易忽略的三个业务判断" }, contentSourcePlan: { mode: "knowledge_base", sources: [] }, contentIdentity: {} } },
        { id: "mock_rec_2", topic: "一个常见误区，为什么会让业务投入失效", contentPillar: "误区纠偏", contentRole: "traffic", reason: "增加容易理解和转发的认知入口", duplication: { decision: "warn", score: 0.43 }, sourcePlan: { mode: "mixed", rationale: ["热点负责入口，知识负责观点"], missing: [], sources: [{ type: "hotspot", role: "传播入口", required: false, candidateIds: [] }, { type: "knowledge_base", role: "用户观点", required: false, candidateIds: [] }] }, generationPayload: { sourceType: "content_agent_recommended", platform: payload.platform || "xiaohongshu", ideaTitle: "一个常见误区，为什么会让业务投入失效", contentPurposeId: "professional_opinion", promotionMode: "none", knowledgeFolderIds: [], contentTaskBrief: { topic: "一个常见误区，为什么会让业务投入失效" }, contentSourcePlan: { mode: "mixed", sources: [] }, contentIdentity: {} } }
      ]
    }),
    getPublishingCycles: async () => ({ items: [], legacyPlans: [] }),
    createPublishingCycle: async () => { throw new Error("演示模式没有真实社媒账号，不能创建周期计划"); },
    confirmPublishingCycle: async () => { throw new Error("演示模式没有可确认的真实周期"); },
    updatePublishingCycleSlot: async () => { throw new Error("演示模式没有可调整的真实周期槽位"); },
    startTopicAdjustment: async () => { throw new Error("演示模式没有真实的选题调整会话"); },
    sendTopicAdjustmentMessage: async () => { throw new Error("演示模式不会调用选题调整 Agent"); },
    adoptTopicAdjustmentCandidate: async () => { throw new Error("演示模式不会修改真实周期计划"); },
    adoptPublishingCycleSlot: async () => { throw new Error("演示模式不会建立真实双平台内容项目"); },
    reviseContent: async (contentId, payload) => {
      const requestClass = /目的|营销|推广/.test(payload.instruction) ? "purpose_or_promotion" : /主题|选题|方向|换个话题|受众|目标人群|事实|数据|案例|素材/.test(payload.instruction) ? "upstream_context" : /图片|封面|配图|视觉/.test(payload.instruction) ? "image_spec" : /第\s*\d+\s*页|卡片/.test(payload.instruction) ? "page_text" : "copy";
      if (["purpose_or_promotion", "upstream_context"].includes(requestClass)) {
        const revision = { id: `revision_${Date.now()}`, contentTaskId: contentId, baseVersion: payload.baseVersion || 1, version: null, instruction: payload.instruction, status: "awaiting_upstream_confirmation", summary: "这项修改会改变内容上游契约，需要确认新的主题、目的和事实素材后创建新 Run。", requestClass, executionMode: "new_upstream_run", revisionImpact: { level: "upstream", affected: ["ContentTaskBrief", "ContentSourcePlan", "ContentMaster", "outline", "platform_content"] }, rerunPlan: [{ stage: "upstream_confirmation", status: "blocked" }, { stage: "new_content_run", status: "pending" }], nextAction: { type: "create_upstream_revision_run" } };
        mockContentRevisions.push(revision);
        return wait(revision);
      }
      const rerunPlan = requestClass === "image_spec" ? [{ stage: "imagegen" }, { stage: "renderer" }, { stage: "xhs_review" }] : requestClass === "purpose_or_promotion" ? [{ stage: "content_intent" }, { stage: "content_master" }, { stage: "platform_writer" }] : [{ stage: "platform_writer", scope: [requestClass] }, { stage: payload.platform === "wechat" ? "wechat_review" : "xhs_review" }];
      return wait({ contentTaskId: contentId, status: "completed", version: (payload.baseVersion || 1) + 1, summary: `已根据“${payload.instruction}”完成局部修改，未提及内容保持不变。`, requestClass, executionMode: requestClass === "image_spec" ? "scoped_regeneration" : "local_patch", rerunPlan, patch: { baseVersion: payload.baseVersion || 1, targetPaths: requestClass === "copy" ? ["/post_copy"] : [] }, imageDirection: requestClass === "image_spec" ? `已更新图片方向：${payload.instruction}` : null, content: { title: payload.instruction.includes("标题") ? `别再堆AI工具了，企业真正需要的是能干活的AI员工` : payload.title, body: `已按你的要求局部调整：${payload.instruction}。核心观点和事实引用保持不变。` } });
    },
    contentTask: async (id) => wait({ id, version: 1 }),
    contentVersions: async (id) => wait({ contentTaskId: id, currentVersion: 1, items: [{ version: 1, createdAt: new Date().toISOString() }] }),
    generateContentAssets: async (id) => wait({ contentTaskId: id, summary: { requested: 1, succeeded: 1, failed: 0, pending: 0 }, generatedAssets: [] }),
    naturalizeContent: async (id, payload) => wait({ contentTaskId: id, status: "success", data: { mode: payload.mode || "audit_only", findings: [], revised_text: null }, applied: false }),
    reviewContentVisuals: async (id) => wait({ contentTaskId: id, status: "success", data: { decision: "pass", page_findings: [], deck_findings: [] } }),
    renderContent: async (id) => wait({ contentTaskId: id, delivery: { status: "ready" } }),
    deliverContent: async (id) => wait({ contentTaskId: id, downloadUrl: "#", fileName: "demo.zip" }),
    getVisualStoryboard: async (id) => wait({ contentTaskId: id, status: "visual_storyboard_ready", pages: [] }),
    saveVisualStoryboard: async (id, payload) => wait({ contentTaskId: id, status: "visual_storyboard_ready", ...payload }),
    confirmVisualStoryboard: async (id) => wait({ contentTaskId: id, status: "visual_storyboard_confirmed", confirmation: { decision: "confirmed" } }),
    getVisualDirection: async () => wait(null),
    saveVisualDirection: async (id, payload) => wait({ contentTaskId: id, status: "visual_direction_ready", provider: "demo", model: "demo", quality: "demo", candidateCount: payload.candidateCount || 1, estimatedCalls: 8, pages: [] }),
    confirmVisualDirection: async (id, payload) => wait({ contentTaskId: id, status: "visual_direction_confirmed", confirmation: { decision: "confirmed", ...payload } }),
    selectVisualCandidate: async () => wait({ items: [], summary: { ready: false } }),
    reviewVisualCandidate: async () => wait({ items: [], summary: { ready: false, providerSucceeded: 0, qualityApproved: 0, qualityPendingReview: 0, qualityRejected: 0 } }),
    retryVisualPage: async () => wait({ visualCandidates: [], summary: { ready: false } }),
    fallbackVisualPage: async () => wait({ summary: { ready: false } }),
    confirmRenderedVisuals: async (id, payload) => wait({ contentTaskId: id, version: 1, decision: payload.decision || "approved" }),
    restoreContent: async (id, payload) => wait({ contentTaskId: id, version: (payload.baseVersion || 1) + 1, restoredFromVersion: payload.version, platform: payload.platform, currentContent: payload.currentContent || {} }),
    accounts: async () => ({ items: mockAccounts }),
    createAccount: async (payload) => { const account = { id: `acc_${Date.now()}`, status: "active", ...payload }; mockAccounts.push(account); return wait(account); },
    updateAccount: async (id, payload) => { const index = mockAccounts.findIndex((item) => item.id === id); if (index >= 0) mockAccounts[index] = { ...mockAccounts[index], ...payload }; return wait(mockAccounts[index] || { id, ...payload }); },
    getDesignDna: async () => wait({ item: null, snapshotRef: null, availableSources: [], historyCount: 0 }),
    analyzeDesignDnaSources: async (id, payload) => wait({ item: { accountId: id, status: "ready_for_review", provider: "MiniMax", providerCalls: payload.approvedFileIds?.length || 0 }, providerCallBudget: { approved: payload.approvedFileIds?.length || 0, used: payload.approvedFileIds?.length || 0, automaticRetries: 0 } }),
    createDesignDna: async (id, payload) => wait({ item: { id: `dna_${id}_${Date.now()}`, accountId: id, version: 1, status: "ready_for_confirmation", ...payload.styleRules }, snapshotRef: { id: `dna_${id}`, hash: "0".repeat(64) }, availableSources: [] }),
    confirmDesignDna: async (id, snapshotRef, payload) => wait({ item: { id: snapshotRef?.id || `dna_${id}`, status: "confirmed", confirmation: payload }, snapshotRef }),
    knowledgeFolders: async () => ({ items: mockKnowledgeFolders }),
    knowledgeFiles: async (folderId, query = "") => ({ folderId, items: mockKnowledgeFiles.filter((item) => (!folderId || item.folderId === folderId) && (!query || `${item.name} ${(item.tags || []).join(" ")} ${item.description}`.toLowerCase().includes(query.toLowerCase()))) }),
    createKnowledgeFolder: async (payload) => { const folder = { id: `folder_${Date.now()}`, fileCount: 0, ...payload }; mockKnowledgeFolders.push(folder); return wait(folder); },
    createKnowledgeFile: async (payload) => { const upload = payload instanceof FormData ? payload.get("file") : null; const folderId = payload instanceof FormData ? payload.get("folderId") : payload.folderId; const tags = payload instanceof FormData ? JSON.parse(payload.get("tags") || "[]") : payload.tags; const file = { id: `file_${Date.now()}`, folderId, name: upload?.name || payload.name, kind: "document", sizeLabel: `${Math.max(1, Math.round((upload?.size || payload.size || 0) / 1024))} KB`, updatedLabel: "演示解析", parseStatus: "ready", chunkCount: 1, tags, description: payload instanceof FormData ? payload.get("description") : payload.description }; mockKnowledgeFiles.push(file); const folder = mockKnowledgeFolders.find((item) => item.id === folderId); if (folder) folder.fileCount += 1; return wait(file); },
    knowledge: async () => ({ mode: "mock", items: [] }),
    review: async (contentId) => wait({ contentId, status: "passed", blockers: [], warnings: 0 }),
    publish: async (payload) => wait({ id: `publish_${Date.now()}`, status: "scheduled", ...payload }),
    publicationMetrics: async (payload) => {
      const views = Number(payload.views || payload.impressions || 0);
      const engagement = Number(payload.likes || 0) + Number(payload.saves || 0) * 2 + Number(payload.comments || 0) * 2 + Number(payload.shares || 0) * 3;
      return wait({ snapshot: { id: `metrics_${Date.now()}`, ...payload, engagementRate: views ? engagement / views : 0, conversionRate: views ? Number(payload.conversions || 0) / views : 0 } });
    },
    list: async () => ({ mode: "mock", items: [] }),
    save: async (payload) => wait({ id: payload.id || `demo_${Date.now()}`, ...payload, updatedAt: new Date().toISOString() })
  };

  function wait(value, ms = 650) {
    return new Promise((resolve) => setTimeout(() => resolve(value), ms));
  }

  async function request(path, options = {}) {
    try {
      const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
      const response = await fetch(`${liveBase}${path}`, {
        headers: { ...(isFormData ? {} : { "Content-Type": "application/json" }), ...(options.headers || {}) },
        ...options
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(body.error || `API request failed: ${response.status}`);
        error.status = response.status;
        error.requestId = body.requestId;
        error.details = body.validation?.errors || body.details || [];
        error.code = body.code || null;
        error.retryable = body.retryable === true;
        error.retryUrl = body.retryUrl || null;
        error.payload = body;
        throw error;
      }
      return body;
    } catch (error) {
      window.dispatchEvent(new CustomEvent("flow:api-error", { detail: { path, message: error.message, requestId: error.requestId || null, status: error.status || null, details: error.details || [] } }));
      throw error;
    }
  }

  function call(path, fallbackName, options, ...fallbackArgs) {
    if (demoRequested) return fallback[fallbackName](...fallbackArgs);
    if (!liveBase) {
      const error = new Error("当前通过本地文件打开，真实 API 不可用。请访问 http://127.0.0.1:4173");
      queueMicrotask(() => window.dispatchEvent(new CustomEvent("flow:api-error", { detail: { path, message: error.message } })));
      return Promise.reject(error);
    }
    return request(path, options);
  }

  const waitMs = (ms) => new Promise((resolve)=>setTimeout(resolve,ms));
  async function getStrategyDraftRequest(sessionId, requestId = "latest") {
    return call(`/agent/sessions/${encodeURIComponent(sessionId)}/strategy-draft/requests/${encodeURIComponent(requestId)}`,"list");
  }

  async function createRecoverableStrategyDraft(sessionId) {
    if (demoRequested) return fallback.save({sessionId});
    const requestId=`draftreq_${globalThis.crypto?.randomUUID?.().replaceAll("-","")||Date.now().toString(36)}`;
    let accepted;
    try {
      accepted=await call(`/agent/sessions/${encodeURIComponent(sessionId)}/strategy-draft`,"save",{method:"POST",body:JSON.stringify({requestId,async:true})},{sessionId,requestId});
    } catch(error) {
      error.requestId ||= requestId;
    }
    if(accepted?.draft)return accepted;
    const deadline=Date.now()+12*60*1000;
    let lastNetworkError=null;
    while(Date.now()<deadline){
      try {
        const status=await getStrategyDraftRequest(sessionId,requestId);
        if(status.draftRequest?.status==="succeeded"&&status.draft&&status.draftRevision)return {...status,recovered:true};
        if(status.draftRequest?.status==="failed"){
          const error=new Error(status.draftRequest.errorMessage||"策略草案生成失败");
          error.code=status.draftRequest.errorCode||"STRATEGY_DRAFT_REQUEST_FAILED";
          error.requestId=requestId;
          error.payload=status;
          throw error;
        }
        lastNetworkError=null;
      } catch(error) {
        if(error.code==="STRATEGY_DRAFT_REQUEST_FAILED"||error.status===422||error.status===409)throw error;
        lastNetworkError=error;
      }
      await waitMs(2000);
    }
    const error=new Error(lastNetworkError?`策略草案请求状态暂时无法读取：${lastNetworkError.message}`:"策略草案生成超过 12 分钟，可稍后按请求编号恢复");
    error.code="STRATEGY_DRAFT_REQUEST_TIMEOUT";
    error.requestId=requestId;
    error.retryUrl=`/agent/sessions/${encodeURIComponent(sessionId)}/strategy-draft/requests/${encodeURIComponent(requestId)}`;
    throw error;
  }

  function uploadKnowledgeFile(payload, onProgress = null) {
    if (demoRequested) {
      return Promise.reject(new Error("演示模式不会伪造文件上传成功，请启动本地服务后使用真实资产中心"));
    }
    if (!liveBase) return Promise.reject(new Error("真实 API 不可用，无法上传文件"));
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${liveBase}/knowledge/files`);
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) onProgress?.(Math.round(event.loaded / event.total * 100));
      });
      xhr.addEventListener("load", () => {
        const body = (() => { try { return JSON.parse(xhr.responseText || "{}"); } catch { return {}; } })();
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress?.(100);
          resolve(body);
          return;
        }
        const error = new Error(body.error || `上传失败：${xhr.status}`);
        error.status = xhr.status;
        error.code = body.code || null;
        reject(error);
      });
      xhr.addEventListener("error", () => reject(new Error("上传连接失败，请检查本地服务后重试")));
      xhr.addEventListener("abort", () => reject(new Error("上传已取消")));
      xhr.send(payload);
    });
  }

  function uploadAccountVisualAsset(accountId, payload, onProgress = null) {
    if (demoRequested) return Promise.reject(new Error("演示模式不会伪造品牌视觉资料上传成功，请启动本地服务"));
    if (!liveBase) return Promise.reject(new Error("真实 API 不可用，无法上传品牌视觉资料"));
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${liveBase}/accounts/${encodeURIComponent(accountId)}/visual-assets`);
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) onProgress?.(Math.round(event.loaded / event.total * 100));
      });
      xhr.addEventListener("load", () => {
        const body = (() => { try { return JSON.parse(xhr.responseText || "{}"); } catch { return {}; } })();
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress?.(100);
          resolve(body);
          return;
        }
        const error = new Error(body.error || `视觉资料上传失败：${xhr.status}`);
        error.status = xhr.status;
        error.code = body.code || null;
        reject(error);
      });
      xhr.addEventListener("error", () => reject(new Error("视觉资料上传连接失败，请检查本地服务后重试")));
      xhr.send(payload);
    });
  }

  async function downloadContentPackage(downloadUrl, fileName) {
    if (demoRequested) throw new Error("演示模式不会伪造交付包下载");
    const response = await fetch(downloadUrl, { cache: "no-store" });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const error = new Error(body.error || `下载失败：${response.status}`);
      error.status = response.status;
      error.code = body.code || null;
      error.retryable = body.retryable === true;
      error.retryUrl = body.retryUrl || null;
      throw error;
    }
    const blob = await response.blob();
    if (!blob.size) throw new Error("下载文件为空，请重新生成交付包");
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = fileName || "FlowSocial-content.zip";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
    return { bytes: blob.size, fileName: anchor.download };
  }

  window.FlowAPI = {
    mode: demoRequested ? "demo" : liveBase ? "live" : "blocked",
    getRuntimeStatus: () => call("/health", "dashboard"),
    getDashboard: () => call("/dashboard", "dashboard"),
    getAccounts: () => call("/accounts", "accounts"),
    createAccount: (payload) => call("/accounts", "createAccount", { method: "POST", body: JSON.stringify(payload) }, payload),
    updateAccount: (id, payload) => call(`/accounts/${id}`, "updateAccount", { method: "PATCH", body: JSON.stringify(payload) }, id, payload),
    uploadAccountVisualAsset,
    getDesignDna: (id) => call(`/accounts/${encodeURIComponent(id)}/design-dna`, "getDesignDna", undefined, id),
    analyzeDesignDnaSources: (id, payload) => call(`/accounts/${encodeURIComponent(id)}/design-dna/analyze`, "analyzeDesignDnaSources", { method: "POST", body: JSON.stringify(payload) }, id, payload),
    createDesignDna: (id, payload) => call(`/accounts/${encodeURIComponent(id)}/design-dna`, "createDesignDna", { method: "POST", body: JSON.stringify(payload) }, id, payload),
    confirmDesignDna: (id, snapshotRef, payload = {}) => call(`/accounts/${encodeURIComponent(id)}/design-dna/confirm`, "confirmDesignDna", { method: "POST", body: JSON.stringify({ ...payload, snapshotRef }) }, id, snapshotRef, payload),
    getOpportunities: (directionId = "") => call(`/opportunities${directionId ? `?directionId=${encodeURIComponent(directionId)}` : ""}`, "opportunities"),
    getHotspots: (poolType = "global", directionId = "", companyId = "") => call(`/hotspots?poolType=${encodeURIComponent(poolType)}${directionId ? `&directionId=${encodeURIComponent(directionId)}` : ""}${companyId ? `&companyId=${encodeURIComponent(companyId)}` : ""}`, "hotspots", undefined, poolType),
    getDirections: (companyId = "") => call(`/content-directions${companyId ? `?companyId=${encodeURIComponent(companyId)}` : ""}`, "directions"),
    expandKeywords: (payload) => call("/keyword-profiles/expand", "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    createDirection: (payload) => call("/content-directions", "createDirection", { method: "POST", body: JSON.stringify(payload) }, payload),
    updateDirection: (id, payload) => call(`/content-directions/${id}`, "updateDirection", { method: "PATCH", body: JSON.stringify(payload) }, id, payload),
    getDirectionLibrary: (id) => call(`/content-directions/${id}/library`, "library", undefined, id),
    refreshDirection: (id) => call(`/content-directions/${id}/refresh`, "hotspot", { method: "POST", body: "{}" }, { directionId: id, keywords: mockDirections.find((item) => item.id === id)?.keywords || [] }),
    selectIdea: (payload) => call("/content-ideas/select", "selectIdea", { method: "POST", body: JSON.stringify(payload) }, payload),
    runCollection: (payload = {}) => call("/collections/run", "collect", { method: "POST", body: JSON.stringify(payload) }),
    runHotspotPipeline: (payload = {}) => call("/hotspot-runs", "hotspot", { method: "POST", body: JSON.stringify(payload) }, payload),
    commitHotspotPreview: (previewId, opportunityIds = []) => call(`/hotspot-runs/${previewId}/commit`, "save", { method: "POST", body: JSON.stringify({ opportunityIds }) }, { previewId, opportunityIds }),
    getHotspotLibrary: (poolType = "", directionId = "", status = "active", companyId = "") => call(`/hotspot-library?poolType=${encodeURIComponent(poolType)}&directionId=${encodeURIComponent(directionId)}&status=${encodeURIComponent(status)}${companyId ? `&companyId=${encodeURIComponent(companyId)}` : ""}`, "hotspots", undefined, poolType),
    updateHotspotStatus: (id, status) => call(`/hotspot-library/${id}`, "save", { method: "PATCH", body: JSON.stringify({ status }) }, { id, status }),
    getHotspotRuns: () => call("/hotspot-runs", "list"),
    generateTopics: (opportunityId) => call(`/opportunities/${opportunityId}/topics`, "generateTopics", { method: "POST", body: "{}" }, opportunityId),
    getTopics: (directionId = "", category = "", companyId = "") => call(`/topics?directionId=${encodeURIComponent(directionId)}&category=${encodeURIComponent(category)}${companyId ? `&companyId=${encodeURIComponent(companyId)}` : ""}`, "topics"),
    runTopicPipeline: (payload) => call("/topics/generate", "topicPipeline", { method: "POST", body: JSON.stringify(payload) }, payload),
    selectPlatformTopic: (topicId, payload) => call(`/topics/${topicId}/select`, "selectPlatformTopic", { method: "POST", body: JSON.stringify(payload) }, topicId, payload),
    analyzeReference: (payload) => call("/reference-posts/analyze", "analyzeReference", { method: "POST", body: JSON.stringify(payload) }, payload),
    getContentLearningStatus: (accountId = "") => call(`/content-learning/status${accountId ? `?accountId=${encodeURIComponent(accountId)}` : ""}`, "contentLearningStatus"),
    getContentLearningAnalyses: (accountId = "") => call(`/content-learning/analyses${accountId ? `?accountId=${encodeURIComponent(accountId)}` : ""}`, "contentLearningAnalyses"),
    getContentLearningBlueprints: (accountId = "") => call(`/content-learning/blueprints${accountId ? `?accountId=${encodeURIComponent(accountId)}` : ""}`, "contentLearningBlueprints"),
    getContentLearningImports: (accountId = "") => call(`/content-learning/import-jobs${accountId ? `?accountId=${encodeURIComponent(accountId)}` : ""}`, "contentLearningImports"),
    getContentLearningReferences: (accountId = "") => call(`/content-learning/references${accountId ? `?accountId=${encodeURIComponent(accountId)}` : ""}`, "contentLearningReferences"),
    getContentLearningClusters: (accountId = "") => call(`/content-learning/clusters${accountId ? `?accountId=${encodeURIComponent(accountId)}` : ""}`, "contentLearningClusters"),
    getContentLearningProposals: (accountId = "") => call(`/content-learning/upgrade-proposals${accountId ? `?accountId=${encodeURIComponent(accountId)}` : ""}`, "contentLearningProposals"),
    getContentLearningPerformance: (accountId = "") => call(`/content-learning/performance${accountId ? `?accountId=${encodeURIComponent(accountId)}` : ""}`, "contentLearningPerformance"),
    getContentLearningPromotions: (accountId = "") => call(`/content-learning/skill-promotions${accountId ? `?accountId=${encodeURIComponent(accountId)}` : ""}`, "contentLearningPromotions"),
    getContentLearningEvaluationSuite: (accountId = "") => call(`/content-learning/evaluation-suite${accountId ? `?accountId=${encodeURIComponent(accountId)}` : ""}`, "contentLearningEvaluationSuite"),
    evaluateContentSkillOutput: (payload) => call("/content-learning/evaluate", "evaluateContentSkillOutput", { method: "POST", body: JSON.stringify(payload) }, payload),
    importContentLearningBatch: (payload) => call("/content-learning/imports", "importContentLearningBatch", { method: "POST", body: JSON.stringify(payload) }, payload),
    runContentLearningClusters: (payload) => call("/content-learning/clusters/run", "runContentLearningClusters", { method: "POST", body: JSON.stringify(payload) }, payload),
    runContentLearningProposals: (payload) => call("/content-learning/upgrade-proposals/run", "runContentLearningProposals", { method: "POST", body: JSON.stringify(payload) }, payload),
    reviewContentLearningProposal: (id, payload) => call(`/content-learning/upgrade-proposals/${id}/review`, "reviewContentLearningProposal", { method: "POST", body: JSON.stringify(payload) }, id, payload),
    refreshContentLearningPerformance: (payload) => call("/content-learning/performance/refresh", "refreshContentLearningPerformance", { method: "POST", body: JSON.stringify(payload) }, payload),
    runSkillPromotions: (payload) => call("/content-learning/skill-promotions/run", "runSkillPromotions", { method: "POST", body: JSON.stringify(payload) }, payload),
    reviewSkillPromotion: (id, payload) => call(`/content-learning/skill-promotions/${id}/review`, "reviewSkillPromotion", { method: "POST", body: JSON.stringify(payload) }, id, payload),
    reviewContentPattern: (id, payload) => call(`/content-learning/analyses/${id}/review`, "reviewContentPattern", { method: "POST", body: JSON.stringify(payload) }, id, payload),
    updatePatternLifecycle: (id, payload) => call(`/content-learning/blueprints/${id}/lifecycle`, "updatePatternLifecycle", { method: "PATCH", body: JSON.stringify(payload) }, id, payload),
    createReferenceRemix: (analysisId, payload) => call(`/reference-posts/analyses/${analysisId}/remix`, "remix", { method: "POST", body: JSON.stringify(payload) }, payload),
    recoverWechatArticle: (contentId, payload = {}) => call(`/content-tasks/${encodeURIComponent(contentId)}/recover-wechat-article`, "recoverWechatArticle", { method: "POST", body: JSON.stringify(payload) }, contentId, payload),
    reviseContent: (contentId, payload) => call(`/content-tasks/${contentId}/revise`, "reviseContent", { method: "POST", body: JSON.stringify(payload) }, contentId, payload),
    getContentTask: (contentId) => call(`/content-tasks/${contentId}`, "contentTask", undefined, contentId),
    getContentVersions: (contentId) => call(`/content-tasks/${contentId}/versions`, "contentVersions", undefined, contentId),
    previewContentPromotion: (payload) => call("/content-promotions/preview", "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    confirmContentPromotion: (payload) => call("/content-promotions/confirm", "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    getContentPromotions: ({ companyId = "", accountId = "", contentTaskId = "" } = {}) => { const params = new URLSearchParams(); if (companyId) params.set("companyId", companyId); if (accountId) params.set("accountId", accountId); if (contentTaskId) params.set("contentTaskId", contentTaskId); return call(`/content-promotions${params.size ? `?${params}` : ""}`, "list"); },
    getContentPromotion: (promotionId) => call(`/content-promotions/${encodeURIComponent(promotionId)}`, "list"),
    listUnifiedContentProjects: ({ companyId = "", accountId = "" } = {}) => { const params = new URLSearchParams(); if (companyId) params.set("companyId", companyId); if (accountId) params.set("accountId", accountId); return call(`/unified-content-projects${params.size ? `?${params}` : ""}`, "list"); },
    getUnifiedContentProject: (projectId) => call(`/unified-content-projects/${encodeURIComponent(projectId)}`, "list"),
    listUnifiedContentPrerequisites: (companyId = "") => call(`/unified-content-prerequisites${companyId ? `?companyId=${encodeURIComponent(companyId)}` : ""}`, "list"),
    createUnifiedContentPrerequisites: (payload) => call("/unified-content-prerequisites", "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    listUnifiedContentBootstraps: ({ companyId = "", projectId = "", state = "" } = {}) => { const params = new URLSearchParams(); if (companyId) params.set("companyId", companyId); if (projectId) params.set("projectId", projectId); if (state) params.set("state", state); return call(`/unified-content-projects/bootstrap${params.size ? `?${params}` : ""}`, "list"); },
    listUnifiedContentPlanningAttempts: ({ companyId = "", projectId = "", requestId = "" } = {}) => { const params = new URLSearchParams(); if (companyId) params.set("companyId", companyId); if (projectId) params.set("projectId", projectId); if (requestId) params.set("requestId", requestId); return call(`/unified-content-projects/planning-attempts${params.size ? `?${params}` : ""}`, "list"); },
    confirmUnifiedContentBootstrap: (id, payload) => call(`/unified-content-projects/bootstrap/${encodeURIComponent(id)}/confirm`, "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    rejectUnifiedContentBootstrap: (id, payload) => call(`/unified-content-projects/bootstrap/${encodeURIComponent(id)}/reject`, "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    getUnifiedPlatformOutlineConfirmation: (id, platform) => call(`/unified-content-projects/bootstrap/${encodeURIComponent(id)}/platforms/${encodeURIComponent(platform)}/outline-confirmations`, "list"),
    confirmUnifiedPlatformOutline: (id, platform, payload) => call(`/unified-content-projects/bootstrap/${encodeURIComponent(id)}/platforms/${encodeURIComponent(platform)}/outline-confirmations`, "save", { method: "POST", body: JSON.stringify(payload) }, payload),
   resumeUnifiedContentBootstrap: (id, payload) => call(`/unified-content-projects/bootstrap/${encodeURIComponent(id)}/resume`, "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    resumeUnifiedPlatformProduction: (id, platform, payload) => call(`/unified-content-projects/bootstrap/${encodeURIComponent(id)}/platforms/${encodeURIComponent(platform)}/resume`, "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    materializeUnifiedWechat: (projectId, payload) => call(`/unified-content-projects/${encodeURIComponent(projectId)}/platforms/wechat/materialize`, "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    createUnifiedWechatPreuploadArtifacts: (projectId, payload) => call(`/unified-content-projects/${encodeURIComponent(projectId)}/platforms/wechat/preupload-artifacts`, "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    getUnifiedWechatProductionControlState: (projectId) => call(`/unified-content-projects/${encodeURIComponent(projectId)}/platforms/wechat/production-control/state`, "list"),
    initializeUnifiedWechatProductionControl: (projectId, payload) => call(`/unified-content-projects/${encodeURIComponent(projectId)}/platforms/wechat/production-control/initialize`, "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    createUnifiedWechatRevisionRequest: (projectId, payload) => call(`/unified-content-projects/${encodeURIComponent(projectId)}/platforms/wechat/production-control/revisions`, "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    executeUnifiedWechatRevision: (projectId, payload) => call(`/unified-content-projects/${encodeURIComponent(projectId)}/platforms/wechat/production-control/revision-executions`, "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    executeUnifiedWechatGeneratedImages: (projectId, payload) => call(`/unified-content-projects/${encodeURIComponent(projectId)}/platforms/wechat/production-control/image-executions`, "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    previewUnifiedWechatPromptCost: (projectId, payload) => call(`/unified-content-projects/${encodeURIComponent(projectId)}/platforms/wechat/production-control/prompt-cost-preview`, "list", { method: "POST", body: JSON.stringify(payload) }, payload),
    approveUnifiedWechatPromptCost: (projectId, payload) => call(`/unified-content-projects/${encodeURIComponent(projectId)}/platforms/wechat/production-control/prompt-cost-approval`, "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    getUnifiedWechatHumanReviewState: (projectId, { workspaceId = "", companyId = "", accountId = "", candidateId = "", productSnapshotHash = "" } = {}) => { const params = new URLSearchParams({ workspaceId, companyId, accountId, candidateId }); if (productSnapshotHash) params.set("productSnapshotHash", productSnapshotHash); return call(`/unified-content-projects/${encodeURIComponent(projectId)}/platforms/wechat/human-review-state?${params}`, "list"); },
    createUnifiedWechatPreuploadReview: (projectId, payload) => call(`/unified-content-projects/${encodeURIComponent(projectId)}/platforms/wechat/preupload-artifact-review`, "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    createUnifiedWechatEditorialReview: (projectId, payload) => call(`/unified-content-projects/${encodeURIComponent(projectId)}/platforms/wechat/editorial-reviews`, "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    createUnifiedWechatSelection: (projectId, payload) => call(`/unified-content-projects/${encodeURIComponent(projectId)}/platforms/wechat/human-selections`, "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    previewUnifiedWechatResourceUploadPlan: (projectId, payload) => call(`/unified-content-projects/${encodeURIComponent(projectId)}/platforms/wechat/resource-upload-plan-preview`, "list", { method: "POST", body: JSON.stringify(payload) }, payload),
    confirmUnifiedWechatResourceUploadPlan: (projectId, payload) => call(`/unified-content-projects/${encodeURIComponent(projectId)}/platforms/wechat/resource-upload-plan-confirm`, "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    executeUnifiedWechatResourceUpload: (projectId, payload) => call(`/unified-content-projects/${encodeURIComponent(projectId)}/platforms/wechat/resource-upload-executions`, "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    getUnifiedWechatDeliveryState: (projectId, { workspaceId = "", companyId = "", accountId = "", candidateId = "", productSnapshotHash = "" } = {}) => { const params = new URLSearchParams({ workspaceId, companyId, accountId, candidateId }); if (productSnapshotHash) params.set("productSnapshotHash", productSnapshotHash); return call(`/unified-content-projects/${encodeURIComponent(projectId)}/platforms/wechat/delivery-state?${params}`, "list"); },
    previewUnifiedWechatDraftCreation: (projectId, payload) => call(`/unified-content-projects/${encodeURIComponent(projectId)}/platforms/wechat/draft-preview`, "list", { method: "POST", body: JSON.stringify(payload) }, payload),
    executeUnifiedWechatDraftCreation: (projectId, payload) => call(`/unified-content-projects/${encodeURIComponent(projectId)}/platforms/wechat/draft-executions`, "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    getUnifiedWechatDraftState: (projectId, { workspaceId = "", companyId = "", accountId = "", candidateId = "", productSnapshotHash = "" } = {}) => { const params = new URLSearchParams({ workspaceId, companyId, accountId, candidateId }); if (productSnapshotHash) params.set("productSnapshotHash", productSnapshotHash); return call(`/unified-content-projects/${encodeURIComponent(projectId)}/platforms/wechat/draft-state?${params}`, "list"); },
    createUnifiedContentReview: (projectId, platform, payload) => call(`/unified-content-projects/${encodeURIComponent(projectId)}/platforms/${encodeURIComponent(platform)}/reviews`, "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    createUnifiedContentSelection: (projectId, platform, payload) => call(`/unified-content-projects/${encodeURIComponent(projectId)}/platforms/${encodeURIComponent(platform)}/selections`, "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    getUnifiedContentReviewState: (projectId, platform, { workspaceId = "", companyId = "", accountId = "", candidateId = "", productSnapshotHash = "" } = {}) => { const params = new URLSearchParams({ workspaceId, companyId, accountId, candidateId }); if (productSnapshotHash) params.set("productSnapshotHash", productSnapshotHash); return call(`/unified-content-projects/${encodeURIComponent(projectId)}/platforms/${encodeURIComponent(platform)}/review-state?${params}`, "list"); },
    getUnifiedContentArtifactState: (projectId, platform, { workspaceId = "", companyId = "", accountId = "", candidateId = "" } = {}) => { const params = new URLSearchParams({ workspaceId, companyId, accountId, candidateId }); return call(`/unified-content-projects/${encodeURIComponent(projectId)}/platforms/${encodeURIComponent(platform)}/artifacts?${params}`, "list"); },
    appendUnifiedContentArtifact: (projectId, platform, payload) => call(`/unified-content-projects/${encodeURIComponent(projectId)}/platforms/${encodeURIComponent(platform)}/artifacts`, "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    appendUnifiedContentArtifactRuntimeResult: (projectId, platform, runtimeResult, scope = {}, idempotencyKey = "") => call(`/unified-content-projects/${encodeURIComponent(projectId)}/platforms/${encodeURIComponent(platform)}/artifacts`, "save", { method: "POST", body: JSON.stringify({ ...scope, operation: platform === "xiaohongshu" ? "xhs_runtime_result" : "wechat_preupload_runtime_result", runtimeResult, idempotencyKey }) }, { ...scope, runtimeResult, idempotencyKey }),
    getUnifiedContentArtifactReview: (projectId, platform, { workspaceId = "", companyId = "", accountId = "", candidateId = "", productSnapshotHash = "" } = {}) => { const params = new URLSearchParams({ workspaceId, companyId, accountId, candidateId }); if (productSnapshotHash) params.set("productSnapshotHash", productSnapshotHash); return call(`/unified-content-projects/${encodeURIComponent(projectId)}/platforms/${encodeURIComponent(platform)}/artifact-review?${params}`, "list"); },
    appendUnifiedContentArtifactReviewAction: (projectId, platform, payload) => call(`/unified-content-projects/${encodeURIComponent(projectId)}/platforms/${encodeURIComponent(platform)}/artifact-review`, "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    getUnifiedXhsProductionState: (projectId, { workspaceId = "", companyId = "", accountId = "", candidateId = "", productSnapshotHash = "" } = {}) => { const params = new URLSearchParams({ workspaceId, companyId, accountId, candidateId }); if (productSnapshotHash) params.set("productSnapshotHash", productSnapshotHash); return call(`/unified-content-projects/${encodeURIComponent(projectId)}/platforms/xiaohongshu/production-state?${params}`, "list"); },
    executeUnifiedXhsDesign: (projectId, payload) => call(`/unified-content-projects/${encodeURIComponent(projectId)}/platforms/xiaohongshu/design`, "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    createUnifiedXhsProviderPlan: (projectId, payload) => call(`/unified-content-projects/${encodeURIComponent(projectId)}/platforms/xiaohongshu/provider-plan`, "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    approveUnifiedXhsProviderExecution: (projectId, payload) => call(`/unified-content-projects/${encodeURIComponent(projectId)}/platforms/xiaohongshu/provider-execution-approval`, "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    executeUnifiedXhsProviderExecution: (projectId, payload) => call(`/unified-content-projects/${encodeURIComponent(projectId)}/platforms/xiaohongshu/provider-executions`, "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    getUnifiedXhsLightRevisionState: (projectId, { workspaceId = "", companyId = "", accountId = "", candidateId = "", productSnapshotHash = "", providerPlanFactRef = null } = {}) => { const params = new URLSearchParams({ workspaceId, companyId, accountId, candidateId }); if (productSnapshotHash) params.set("productSnapshotHash", productSnapshotHash); if (providerPlanFactRef?.id) params.set("providerPlanFactId", providerPlanFactRef.id); if (providerPlanFactRef?.hash) params.set("providerPlanFactHash", providerPlanFactRef.hash); return call(`/unified-content-projects/${encodeURIComponent(projectId)}/platforms/xiaohongshu/light-revision-state?${params}`, "list"); },
    createUnifiedXhsLightRevisionPlan: (projectId, payload) => call(`/unified-content-projects/${encodeURIComponent(projectId)}/platforms/xiaohongshu/light-revision-plans`, "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    approveUnifiedXhsLightRevision: (projectId, payload) => call(`/unified-content-projects/${encodeURIComponent(projectId)}/platforms/xiaohongshu/light-revision-approvals`, "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    executeUnifiedXhsLightRevision: (projectId, payload) => call(`/unified-content-projects/${encodeURIComponent(projectId)}/platforms/xiaohongshu/light-revision-executions`, "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    continueUnifiedXhsLightRevision: (projectId, executionId, payload) => call(`/unified-content-projects/${encodeURIComponent(projectId)}/platforms/xiaohongshu/light-revision-executions/${encodeURIComponent(executionId)}/continue`, "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    confirmUnifiedXhsHumanVisualSet: (projectId, payload) => call(`/unified-content-projects/${encodeURIComponent(projectId)}/platforms/xiaohongshu/human-visual-confirmation`, "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    approveUnifiedXhsVisualReview: (projectId, payload) => call(`/unified-content-projects/${encodeURIComponent(projectId)}/platforms/xiaohongshu/visual-review-approval`, "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    executeUnifiedXhsVisualReview: (projectId, payload) => call(`/unified-content-projects/${encodeURIComponent(projectId)}/platforms/xiaohongshu/visual-reviews`, "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    getUnifiedXhsArtifactState: (projectId, scope = {}) => window.FlowAPI.getUnifiedContentArtifactState(projectId, "xiaohongshu", scope),
    getUnifiedXhsArtifactReview: (projectId, scope = {}) => window.FlowAPI.getUnifiedContentArtifactReview(projectId, "xiaohongshu", scope),
    appendUnifiedXhsArtifactReviewAction: (projectId, payload) => window.FlowAPI.appendUnifiedContentArtifactReviewAction(projectId, "xiaohongshu", payload),
    getUnifiedXhsReviewState: (projectId, scope = {}) => window.FlowAPI.getUnifiedContentReviewState(projectId, "xiaohongshu", scope),
    createUnifiedXhsContentReview: (projectId, payload) => window.FlowAPI.createUnifiedContentReview(projectId, "xiaohongshu", payload),
    createUnifiedXhsSelection: (projectId, payload) => window.FlowAPI.createUnifiedContentSelection(projectId, "xiaohongshu", payload),
    previewUnifiedXhsPromotion: (projectId, payload) => window.FlowAPI.previewSavedContentPromotion(projectId, "xiaohongshu", payload),
    confirmUnifiedXhsPromotion: (projectId, payload) => window.FlowAPI.confirmSavedContentPromotion(projectId, "xiaohongshu", payload),
    createUnifiedXhsFinalDelivery: (projectId, payload) => call(`/unified-content-projects/${encodeURIComponent(projectId)}/platforms/xiaohongshu/final-delivery`, "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    downloadUnifiedXhsLocalPackage: (projectId, deliveryId, fileName) => downloadContentPackage(`/api/v1/unified-content-projects/${encodeURIComponent(projectId)}/platforms/xiaohongshu/final-deliveries/${encodeURIComponent(deliveryId)}/download`, fileName || "小红书内容包.zip"),
    getUnifiedXhsPublicationLifecycleState: (projectId, payload) => window.FlowAPI.getAtomicPublicationLifecycleState(projectId, "xiaohongshu", payload),
    previewSavedContentPromotion: (projectId, platform, payload) => call(`/unified-content-projects/${encodeURIComponent(projectId)}/platforms/${encodeURIComponent(platform)}/promotion-preview`, "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    confirmSavedContentPromotion: (projectId, platform, payload) => call(`/unified-content-projects/${encodeURIComponent(projectId)}/platforms/${encodeURIComponent(platform)}/promotion-confirm`, "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    getAtomicPublicationFeedbackControlState: (projectId, platform, { workspaceId = "", companyId = "", accountId = "", candidateId = "" } = {}) => { const params = new URLSearchParams({ workspaceId, companyId, accountId, candidateId }); return call(`/unified-content-projects/${encodeURIComponent(projectId)}/platforms/${encodeURIComponent(platform)}/publication-feedback-control-state?${params}`, "list"); },
    previewAtomicManualPublication: (projectId, platform, payload) => call(`/unified-content-projects/${encodeURIComponent(projectId)}/platforms/${encodeURIComponent(platform)}/manual-publication-preview`, "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    confirmAtomicManualPublication: (projectId, platform, payload) => call(`/unified-content-projects/${encodeURIComponent(projectId)}/platforms/${encodeURIComponent(platform)}/manual-publication-confirm`, "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    previewAtomicPublicationFeedback: (projectId, platform, payload) => call(`/unified-content-projects/${encodeURIComponent(projectId)}/platforms/${encodeURIComponent(platform)}/exact-feedback-preview`, "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    confirmAtomicPublicationFeedback: (projectId, platform, payload) => call(`/unified-content-projects/${encodeURIComponent(projectId)}/platforms/${encodeURIComponent(platform)}/exact-feedback-confirm`, "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    getAtomicPublicationLifecycleState: (projectId, platform, payload) => call(`/unified-content-projects/${encodeURIComponent(projectId)}/platforms/${encodeURIComponent(platform)}/publication-lifecycle-state`, "list", { method: "POST", body: JSON.stringify(payload) }, payload),
    confirmAtomicPublicationLifecycle: (projectId, platform, action, payload) => call(`/unified-content-projects/${encodeURIComponent(projectId)}/platforms/${encodeURIComponent(platform)}/publication-${encodeURIComponent(action)}`, "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    planContent: (payload) => call("/content-agent/plan", "contentPlan", { method: "POST", body: JSON.stringify(payload) }, payload),
    getStrategyHierarchy: (companyId, socialAccountId = "") => call(`/companies/${encodeURIComponent(companyId)}/strategy-hierarchy${socialAccountId ? `?socialAccountId=${encodeURIComponent(socialAccountId)}` : ""}`, "strategyHierarchy"),
    saveMatrixStrategy: (companyId, payload) => call(`/companies/${encodeURIComponent(companyId)}/matrix-strategy-snapshots`, "saveMatrixStrategy", { method: "POST", body: JSON.stringify(payload) }, payload),
    saveAccountStrategy: (socialAccountId, payload) => call(`/social-accounts/${encodeURIComponent(socialAccountId)}/strategy-snapshots`, "saveAccountStrategy", { method: "POST", body: JSON.stringify(payload) }, payload),
    getEffectiveAccountStrategy: (socialAccountId, companyId = "") => call(`/social-accounts/${encodeURIComponent(socialAccountId)}/effective-strategy${companyId ? `?companyId=${encodeURIComponent(companyId)}` : ""}`, "effectiveAccountStrategy"),
    getRollingPlans: ({ companyId = "", socialAccountId = "", status = "" } = {}) => {
      const params = new URLSearchParams();
      if (companyId) params.set("companyId", companyId);
      if (socialAccountId) params.set("socialAccountId", socialAccountId);
      if (status) params.set("status", status);
      return call(`/content-agent/rolling-plans${params.size ? `?${params}` : ""}`, "rollingPlans");
    },
    getPublishingCycles: ({ companyId = "", socialAccountId = "" } = {}) => {
      const params = new URLSearchParams();
      if (companyId) params.set("companyId", companyId);
      if (socialAccountId) params.set("socialAccountId", socialAccountId);
      return call(`/content-agent/publishing-cycles${params.size ? `?${params}` : ""}`, "getPublishingCycles");
    },
    createPublishingCycle: (payload) => call("/content-agent/publishing-cycles", "createPublishingCycle", { method: "POST", body: JSON.stringify(payload) }, payload),
    confirmPublishingCycle: (cycleId, payload = {}) => call(`/content-agent/publishing-cycles/${encodeURIComponent(cycleId)}/confirm`, "confirmPublishingCycle", { method: "POST", body: JSON.stringify(payload) }, payload),
    updatePublishingCycleSlot: (cycleId, slotId, payload = {}) => call(`/content-agent/publishing-cycles/${encodeURIComponent(cycleId)}/slots/${encodeURIComponent(slotId)}`, "updatePublishingCycleSlot", { method: "PATCH", body: JSON.stringify(payload) }, payload),
    startTopicAdjustment: (cycleId, slotId, payload = {}) => call(`/content-agent/publishing-cycles/${encodeURIComponent(cycleId)}/slots/${encodeURIComponent(slotId)}/topic-adjustments`, "startTopicAdjustment", { method: "POST", body: JSON.stringify(payload) }, payload),
    sendTopicAdjustmentMessage: (sessionId, payload = {}) => call(`/content-agent/topic-adjustments/${encodeURIComponent(sessionId)}/messages`, "sendTopicAdjustmentMessage", { method: "POST", body: JSON.stringify(payload) }, payload),
    adoptTopicAdjustmentCandidate: (sessionId, candidateId, payload = {}) => call(`/content-agent/topic-adjustments/${encodeURIComponent(sessionId)}/candidates/${encodeURIComponent(candidateId)}/adopt`, "adoptTopicAdjustmentCandidate", { method: "POST", body: JSON.stringify(payload) }, payload),
    adoptPublishingCycleSlot: (cycleId, slotId, payload = {}) => call(`/content-agent/publishing-cycles/${encodeURIComponent(cycleId)}/slots/${encodeURIComponent(slotId)}/adopt-to-unified-project`, "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    createRollingPlan: (payload) => call("/content-agent/rolling-plans", "createRollingPlan", { method: "POST", body: JSON.stringify(payload) }, payload),
    getContentOpportunities: ({ companyId = "", socialAccountId = "", sourceType = "", status = "" } = {}) => {
      const params = new URLSearchParams();
      if (companyId) params.set("companyId", companyId);
      if (socialAccountId) params.set("socialAccountId", socialAccountId);
      if (sourceType) params.set("sourceType", sourceType);
      if (status) params.set("status", status);
      return call(`/content-agent/opportunities${params.size ? `?${params}` : ""}`, "contentOpportunities");
    },
    createContentOpportunity: (payload) => call("/content-agent/opportunities", "createContentOpportunity", { method: "POST", body: JSON.stringify(payload) }, payload),
    adoptContentOpportunity: (opportunityId, payload = {}) => call(`/content-agent/opportunities/${encodeURIComponent(opportunityId)}/adopt-to-unified-project`, "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    createUnifiedContentBootstrap: (payload) => call("/unified-content-projects/bootstrap", "createUnifiedContentBootstrap", { method: "POST", body: JSON.stringify(payload) }, payload),
    getUnifiedContentBootstrap: (id) => call(`/unified-content-projects/bootstrap/${encodeURIComponent(id)}`, "getUnifiedContentBootstrap", undefined, id),
    getContentHistory: (accountId = "") => call(`/content-agent/history${accountId ? `?accountId=${encodeURIComponent(accountId)}` : ""}`, "list"),
    getContentFeedback: ({ accountId = "", strategySnapshotId = "" } = {}) => {
      const params = new URLSearchParams();
      if (accountId) params.set("accountId", accountId);
      if (strategySnapshotId) params.set("strategySnapshotId", strategySnapshotId);
      return call(`/content-agent/feedback${params.size ? `?${params}` : ""}`, "list");
    },
    getStrategyAdjustments: ({ companyId = "", socialAccountId = "" } = {}) => {
      const params = new URLSearchParams();
      if (companyId) params.set("companyId", companyId);
      if (socialAccountId) params.set("socialAccountId", socialAccountId);
      return call(`/content-agent/strategy-adjustments${params.size ? `?${params}` : ""}`, "list");
    },
    confirmStrategyAdjustment: (candidateId, payload) => call(`/content-agent/strategy-adjustments/${encodeURIComponent(candidateId)}/decisions`, "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    getMetricDictionary: (platform = "") => call(`/content-agent/metric-dictionary${platform ? `?platform=${encodeURIComponent(platform)}` : ""}`, "list"),
    previewMetricImport: (payload) => call("/content-agent/metric-imports/preview", "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    confirmMetricImport: (batchId, payload = {}) => call(`/content-agent/metric-imports/${encodeURIComponent(batchId)}/confirm`, "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    getFeedbackActions: (accountId = "") => call(`/content-agent/feedback-actions${accountId ? `?accountId=${encodeURIComponent(accountId)}` : ""}`, "list"),
    acceptFeedbackAction: (diagnosisId, payload = {}) => call(`/content-agent/feedback/diagnoses/${encodeURIComponent(diagnosisId)}/actions`, "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    updateFeedbackAction: (actionId, payload) => call(`/content-agent/feedback-actions/${encodeURIComponent(actionId)}`, "save", { method: "PATCH", body: JSON.stringify(payload) }, payload),
    getContentPublications: (contentId) => call(`/content-tasks/${contentId}/publications`, "list"),
    recordContentPublication: (contentId, payload) => call(`/content-tasks/${contentId}/publications`, "publish", { method: "POST", body: JSON.stringify(payload) }, { contentTaskId: contentId, ...payload }),
    updateContentPublication: (publicationId, payload) => call(`/content-publications/${publicationId}`, "save", { method: "PATCH", body: JSON.stringify(payload) }, payload),
    recordPublicationMetrics: (publicationId, payload) => call(`/content-publications/${publicationId}/metrics`, "publicationMetrics", { method: "POST", body: JSON.stringify(payload) }, payload),
    generateContentAssets: (contentId, payload = {}) => call(`/content-tasks/${contentId}/assets/generate`, "generateContentAssets", { method: "POST", body: JSON.stringify(payload) }, contentId, payload),
    confirmWechatImages: (contentId, payload = {}) => call(`/content-tasks/${contentId}/wechat-images/confirm`, "confirmWechatImages", { method: "POST", body: JSON.stringify(payload) }, contentId, payload),
    getVisualStoryboard: (contentId) => call(`/content-tasks/${contentId}/visual-storyboard`, "getVisualStoryboard", undefined, contentId),
    saveVisualStoryboard: (contentId, payload) => call(`/content-tasks/${contentId}/visual-storyboard`, "saveVisualStoryboard", { method: "PATCH", body: JSON.stringify(payload) }, contentId, payload),
    confirmVisualStoryboard: (contentId, payload = {}) => call(`/content-tasks/${contentId}/visual-storyboard/confirm`, "confirmVisualStoryboard", { method: "POST", body: JSON.stringify(payload) }, contentId, payload),
    getVisualDirection: (contentId) => call(`/content-tasks/${contentId}/visual-direction`, "getVisualDirection", undefined, contentId),
    saveVisualDirection: (contentId, payload) => call(`/content-tasks/${contentId}/visual-direction`, "saveVisualDirection", { method: "PATCH", body: JSON.stringify(payload) }, contentId, payload),
    confirmVisualDirection: (contentId, payload) => call(`/content-tasks/${contentId}/visual-direction/confirm`, "confirmVisualDirection", { method: "POST", body: JSON.stringify(payload) }, contentId, payload),
    selectVisualCandidate: (contentId, payload) => call(`/content-tasks/${contentId}/visual-candidates/select`, "selectVisualCandidate", { method: "POST", body: JSON.stringify(payload) }, contentId, payload),
    reviewVisualCandidate: (contentId, payload) => call(`/content-tasks/${contentId}/visual-candidates/review`, "reviewVisualCandidate", { method: "POST", body: JSON.stringify(payload) }, contentId, payload),
    retryVisualPage: (contentId, pageId, payload = {}) => call(`/content-tasks/${contentId}/visual-candidates/${encodeURIComponent(pageId)}/retry`, "retryVisualPage", { method: "POST", body: JSON.stringify(payload) }, contentId, pageId, payload),
    fallbackVisualPage: (contentId, pageId, payload) => call(`/content-tasks/${contentId}/visual-candidates/${encodeURIComponent(pageId)}/fallback`, "fallbackVisualPage", { method: "POST", body: JSON.stringify(payload) }, contentId, pageId, payload),
    confirmRenderedVisuals: (contentId, payload = {}) => call(`/content-tasks/${contentId}/visual-review/confirm`, "confirmRenderedVisuals", { method: "POST", body: JSON.stringify(payload) }, contentId, payload),
    naturalizeContent: (contentId, payload) => call(`/content-tasks/${contentId}/naturalize`, "naturalizeContent", { method: "POST", body: JSON.stringify(payload) }, contentId, payload),
    reviewContentVisuals: (contentId) => call(`/content-tasks/${contentId}/visual-review`, "reviewContentVisuals", { method: "POST", body: "{}" }, contentId),
    renderContent: (contentId) => call(`/content-tasks/${contentId}/render`, "renderContent", { method: "POST", body: "{}" }, contentId),
    deliverContent: (contentId) => call(`/content-tasks/${contentId}/deliver`, "deliverContent", { method: "POST", body: "{}" }, contentId),
    downloadContentPackage,
    restoreContent: (contentId, payload) => call(`/content-tasks/${contentId}/restore`, "restoreContent", { method: "POST", body: JSON.stringify(payload) }, contentId, payload),
    getKnowledge: (query = "") => call(`/knowledge/entities${query ? `?q=${encodeURIComponent(query)}` : ""}`, "knowledge"),
    createKnowledge: (payload) => call("/knowledge/entities", "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    updateKnowledge: (id, payload) => call(`/knowledge/entities/${id}`, "save", { method: "PATCH", body: JSON.stringify(payload) }, payload),
    getKnowledgeFolders: (companyId = "", workspaceId = "") => { const params = new URLSearchParams(); if (companyId) params.set("companyId", companyId); if (workspaceId) params.set("workspaceId", workspaceId); return call(`/knowledge/folders${params.size ? `?${params}` : ""}`, "knowledgeFolders"); },
    createKnowledgeFolder: (payload) => call("/knowledge/folders", "createKnowledgeFolder", { method: "POST", body: JSON.stringify(payload) }, payload),
    getKnowledgeFiles: (folderId, query = "", companyId = "", workspaceId = "") => { const params = new URLSearchParams(); if (folderId) params.set("folderId", folderId); if (query) params.set("q", query); if (companyId) params.set("companyId", companyId); if (workspaceId) params.set("workspaceId", workspaceId); return call(`/knowledge/files${params.size ? `?${params}` : ""}`, "knowledgeFiles", undefined, folderId, query); },
    createKnowledgeFile: uploadKnowledgeFile,
    retryKnowledgeFile: (fileId, payload) => call(`/knowledge/files/${encodeURIComponent(fileId)}/retry`, "createKnowledgeFile", { method: "POST", body: JSON.stringify(payload) }, payload),
    deleteKnowledgeFile: (fileId, { companyId = "", workspaceId = "" } = {}) => { const params = new URLSearchParams(); if (companyId) params.set("companyId", companyId); if (workspaceId) params.set("workspaceId", workspaceId); return call(`/knowledge/files/${encodeURIComponent(fileId)}${params.size ? `?${params}` : ""}`, "save", { method: "DELETE" }, { id: fileId, deleted: true }); },
    searchKnowledge: (query, folderIds = [], companyId = "", workspaceId = "") => call(`/knowledge/search?q=${encodeURIComponent(query)}&folderIds=${encodeURIComponent(folderIds.join(","))}${companyId ? `&companyId=${encodeURIComponent(companyId)}` : ""}${workspaceId ? `&workspaceId=${encodeURIComponent(workspaceId)}` : ""}`, "knowledgeFiles", undefined, null, query),
    getSources: () => call("/source-configs", "list"),
    updateSource: (id, payload) => call(`/source-configs/${id}`, "save", { method: "PATCH", body: JSON.stringify(payload) }, payload),
    getIntegrations: () => call("/integrations", "list"),
    getPlatformIntegrations: () => call("/platform-integrations", "list"),
    getWechatIntegration: (accountId) => call(`/platform-integrations/wechat/${encodeURIComponent(accountId)}`, "list"),
    saveWechatIntegration: (accountId, payload) => call(`/platform-integrations/wechat/${encodeURIComponent(accountId)}`, "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    testWechatIntegration: (accountId) => call(`/platform-integrations/wechat/${encodeURIComponent(accountId)}/test`, "save", { method: "POST", body: "{}" }, { ok: false, mode: "demo" }),
    syncWechatIntegration: (accountId, days = 7) => call(`/platform-integrations/wechat/${encodeURIComponent(accountId)}/sync`, "save", { method: "POST", body: JSON.stringify({ days }) }, { status: "demo", articleCount: 0 }),
    getProviderConfig: () => call("/provider-config", "list"),
    saveProviderConfig: (payload) => call("/provider-config", "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    testModelConnection: () => call("/provider-config/model/test", "save", { method: "POST", body: "{}" }, { ok: false, mode: "demo", message: "演示模式不连接真实模型" }),
    generateImage: (payload) => call("/images/generate", "save", { method: "POST", body: JSON.stringify(payload) }, payload),
    getDiagnosticErrors: (limit = 20) => call(`/diagnostics/errors?limit=${encodeURIComponent(limit)}`, "list")
    ,getDamaishuzhiAgent: () => call("/agent/damaishuzhi", "dashboard")
    ,getAgentAccounts: () => call("/agent/accounts", "accounts")
    ,getActiveAgentSession: (accountId) => call(`/agent/accounts/${encodeURIComponent(accountId)}/diagnostic-session/active`, "list")
    ,createAgentAccount: (payload) => call("/agent/accounts", "createAccount", { method: "POST", body: JSON.stringify(payload) }, payload)
    ,getAgentOverview: (accountId) => call(`/agent/accounts/${encodeURIComponent(accountId)}/overview`, "dashboard")
    ,startAgentSession: (payload = {}) => call("/agent/sessions", "save", { method: "POST", body: JSON.stringify(payload) }, payload)
    ,sendAgentMessage: (sessionId, message, metadata = {}) => call(`/agent/sessions/${sessionId}/messages`, "save", { method: "POST", body: JSON.stringify({ message, ...metadata }) }, { sessionId, message, ...metadata })
    ,decideAgentRecommendation: (sessionId, recommendationId, payload) => call(`/agent/sessions/${sessionId}/recommendations/${recommendationId}/decision`, "save", { method: "POST", body: JSON.stringify(payload) }, payload)
    ,uploadAgentKnowledgeFile: (sessionId, payload) => call(`/agent/sessions/${sessionId}/knowledge-files`, "createKnowledgeFile", { method: "POST", body: payload }, payload)
    ,confirmAgentKnowledgeFile: (sessionId, fileId, payload = {}) => call(`/agent/sessions/${sessionId}/knowledge-files/${fileId}/confirm`, "save", { method: "POST", body: JSON.stringify(payload) }, payload)
    ,decideAgentKnowledgeCandidate: (sessionId, candidateId, payload = {}) => call(`/agent/sessions/${sessionId}/knowledge-candidates/${candidateId}/decision`, "save", { method: "POST", body: JSON.stringify(payload) }, payload)
    ,startAgentEnrichment: (sessionId) => call(`/agent/sessions/${sessionId}/enrichment/start`, "save", { method: "POST", body: "{}" }, { sessionId })
    ,stopAgentEnrichment: (sessionId) => call(`/agent/sessions/${sessionId}/enrichment/stop`, "save", { method: "POST", body: "{}" }, { sessionId })
    ,getStrategyDecisionContext: (sessionId) => call(`/agent/sessions/${sessionId}/strategy-decisions/context`, "list")
    ,previewStrategyDecisions: (sessionId, options = {}) => call(`/agent/sessions/${sessionId}/strategy-decisions/preview`, "save", { method: "POST", body: JSON.stringify(options) }, { sessionId, ...options })
    ,saveStrategyDecisions: (sessionId, payload) => call(`/agent/sessions/${sessionId}/strategy-decisions`, "save", { method: "PUT", body: JSON.stringify(payload) }, payload)
    ,confirmStrategyDecisions: (sessionId, selection) => call(`/agent/sessions/${sessionId}/strategy-decisions/confirm`, "save", { method: "POST", body: JSON.stringify({ selection }) }, selection)
    ,getStrategyDecisionReadiness: (sessionId) => call(`/agent/sessions/${sessionId}/strategy-decisions/readiness`, "list")
    ,getContentPlanningReadiness: (companyId) => call(`/companies/${encodeURIComponent(companyId)}/content-planning-readiness`, "list")
    ,getAgentSession: (sessionId) => call(`/diagnostics/${sessionId}`, "list")
    ,getAgentDraftReadiness: (sessionId) => call(`/agent/sessions/${sessionId}/strategy-draft/readiness`, "list")
    ,getAgentRepairPreview: (sessionId) => call(`/agent/sessions/${sessionId}/repair-preview`, "list")
    ,getAgentStrategyDraftRequest: getStrategyDraftRequest
    ,createAgentStrategyDraft: createRecoverableStrategyDraft
    ,activateAgentStrategy: (sessionId, draftRevisionId) => call(`/agent/sessions/${sessionId}/activate`, "save", { method: "POST", body: JSON.stringify({ draftRevisionId }) }, { sessionId, draftRevisionId })
    ,getAgentStrategyHistory: (accountId) => call(`/agent/accounts/${encodeURIComponent(accountId)}/strategy-snapshots`, "list")
    ,rollbackAgentStrategy: (accountId, snapshotId) => call(`/agent/accounts/${encodeURIComponent(accountId)}/strategy-snapshots/${encodeURIComponent(snapshotId)}/rollback`, "save", { method: "POST", body: "{}" }, { accountId, snapshotId })
  };
})();
