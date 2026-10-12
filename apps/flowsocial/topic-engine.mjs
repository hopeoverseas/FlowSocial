import { randomUUID } from "node:crypto";
import { generateText as defaultGenerateText, providerStatus } from "./providers.mjs";
import { executeSkill } from "./skill-runtime.mjs";

const thresholds = { overallMin: 70, reviewMin: 60, evidenceMin: 60, forcedConnectionRiskMax: 60, forcedConnectionReviewMin: 41, platformFitMin: 60 };

function id(prefix) {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}

function text(value, max = 600) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function list(value, limit = 12) {
  return Array.isArray(value) ? value.map((item) => text(item, 240)).filter(Boolean).slice(0, limit) : [];
}

function score(value) {
  return Math.min(100, Math.max(0, Math.round(Number(value) || 0)));
}

function canonical(value) {
  return text(value).toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
}

function evidenceSnapshot(opportunity) {
  const evidence = (opportunity.sourceEvidence || []).map((item, index) => ({
    evidence_id: `${opportunity.id}_EV${String(index + 1).padStart(2, "0")}`,
    source: text(item.source),
    title: text(item.label),
    signal: text(item.signal),
    url: item.url || null,
    published_at: item.publishedAt || null,
    captured_at: item.capturedAt || opportunity.collectedAt || opportunity.createdAt,
    mode: item.mode || "live"
  }));
  return {
    cluster_id: opportunity.id,
    pool_type: opportunity.poolType,
    title: text(opportunity.title),
    summary: text(opportunity.summary),
    why_hot: text(opportunity.whyHot),
    keywords: list(opportunity.keywords),
    hotspot_score: score(opportunity.score),
    risks: list(opportunity.risks),
    confirmed_facts: evidence.map((item) => ({ fact: item.title, evidence_ids: [item.evidence_id] })),
    evidence
  };
}

function accountStrategy(account = {}) {
  return {
    account_id: account.id || null,
    account_name: account.name || "企业内容账号",
    positioning: account.positioning || account.businessMode || "专业内容获客",
    target_audience: account.audience || "关注行业趋势与实用方法的业务决策者和内容运营人员",
    content_pillars: account.contentPillars || [],
    tone: account.tone || "专业、清晰、克制",
    forbidden_topics: account.forbiddenTopics || []
  };
}

function topicPromptBase(payload, strategy) {
  return {
    target_keyword: (payload.keywords || []).join("、") || "当前业务主题",
    account_strategy: strategy,
    content_goal: "发现值得现在创作、对目标读者有明确价值且可追溯到证据的选题",
    topic_count: Math.min(Math.max(Number(payload.topicCount) || 4, 1), 8),
    snapshot_version: new Date().toISOString(),
    hard_rules: [
      "只使用输入事件簇和 evidence，不补充外部事实、产品、案例或个人经历",
      "母选题只决定讲什么、为什么现在讲和对谁有价值，不写平台标题或正文",
      "证据不足时必须标记 needs_research，不得输出确定性核心结论",
      "不要为满足数量制造弱选题，所有分数必须是 0-100 整数",
      "只返回一个合法 JSON 对象"
    ]
  };
}

function keywordRequest(payload, strategy, clusters) {
  return {
    task: "generate_keyword_topic_candidates",
    contract: "KeywordTopicCandidateList@1.0",
    ...topicPromptBase(payload, strategy),
    keyword_event_clusters: clusters,
    instructions: [
      "从教程、误区、趋势、比较、清单、观点中选择实质不同的角度",
      "不得使用无关键词全网热点",
      "每个候选必须引用存在的 cluster_ids 和 evidence_ids",
      "输出结构为 {status,data:{topics:[]},warnings:[],blocked_reasons:[]}"
    ],
    topic_schema: {
      topic_id: "KT001", topic_category: "keyword", status: "recommended | needs_research", mother_title: "", core_question: "", core_angle: "", core_claim: "", why_now: "", reader_value: "", target_audience: [], content_type: "tutorial | analysis | comparison | case | opinion | checklist", evidence_boundary: "", cluster_ids: [], evidence_ids: [], scores: { topic_relevance: 0, evidence_strength: 0, content_value: 0, timeliness: 0, differentiation: 0, overall: 0 }, risks: [], additional_research: { needed: false, queries: [], facts_to_verify: [] }
    }
  };
}

function fusionRequest(payload, strategy, globalClusters, keywordClusters) {
  return {
    task: "generate_fusion_topic_candidates",
    contract: "FusionTopicCandidateList@1.0",
    ...topicPromptBase(payload, strategy),
    general_event_clusters: globalClusters,
    keyword_event_clusters: keywordClusters,
    instructions: [
      "只有存在真实技术应用、行业影响、用户场景、工具方法、内容创作、商业营销或社会议题交集时才生成",
      "两个话题都热门不构成交集；正文无法持续展开两侧关系时必须拒绝",
      "不得虚构案例、数据、应用或因果关系",
      "灾难、伤亡、公共安全、政治或个人隐私事件不得娱乐化借势",
      "保留 rejected_combinations 及原因",
      "输出结构为 {status,data:{topics:[],rejected_combinations:[]},warnings:[],blocked_reasons:[]}"
    ],
    topic_schema: {
      topic_id: "FT001", topic_category: "cross_trend", status: "recommended | needs_research", general_cluster_ids: [], keyword_cluster_ids: [], connection_type: "real_application | industry_impact | user_scenario | method | content_creation | marketing | social_issue", real_intersection: "", why_connection_works: "", mother_title: "", core_question: "", core_angle: "", core_claim: "", why_now: "", reader_value: "", evidence_boundary: "", evidence_ids: [], scores: { general_trend_strength: 0, keyword_relevance: 0, connection_strength: 0, evidence_strength: 0, content_value: 0, timeliness: 0, forced_connection_risk: 0, overall: 0 }, risks: [], additional_research: { needed: false, queries: [], facts_to_verify: [] }
    }
  };
}

function normalizeCandidate(raw, category, allowedClusterIds, allowedEvidenceIds, index) {
  const sourceClusterIds = category === "keyword" ? raw.cluster_ids : [...(raw.general_cluster_ids || []), ...(raw.keyword_cluster_ids || [])];
  const clusterIds = list(sourceClusterIds).filter((item) => allowedClusterIds.has(item));
  const evidenceIds = list(raw.evidence_ids, 30).filter((item) => allowedEvidenceIds.has(item));
  const rawScores = raw.scores || {};
  const scores = Object.fromEntries(Object.entries(rawScores).map(([key, value]) => [key, score(value)]));
  scores.evidence_strength ??= Math.min(100, evidenceIds.length * 20 + 30);
  scores.overall ??= 0;
  return {
    candidateId: text(raw.topic_id) || `${category === "keyword" ? "KT" : "FT"}${String(index + 1).padStart(3, "0")}`,
    category,
    proposedStatus: raw.status === "needs_research" ? "needs_research" : "recommended",
    motherTitle: text(raw.mother_title, 160),
    coreQuestion: text(raw.core_question),
    coreAngle: text(raw.core_angle),
    coreClaim: text(raw.core_claim),
    whyNow: text(raw.why_now),
    readerValue: text(raw.reader_value),
    targetAudience: list(raw.target_audience),
    contentType: text(raw.content_type) || "analysis",
    evidenceBoundary: text(raw.evidence_boundary),
    clusterIds,
    generalClusterIds: category === "cross_trend" ? list(raw.general_cluster_ids).filter((item) => allowedClusterIds.has(item)) : [],
    keywordClusterIds: category === "cross_trend" ? list(raw.keyword_cluster_ids).filter((item) => allowedClusterIds.has(item)) : clusterIds,
    evidenceIds,
    connectionType: category === "cross_trend" ? text(raw.connection_type) : null,
    realIntersection: category === "cross_trend" ? text(raw.real_intersection) : null,
    whyConnectionWorks: category === "cross_trend" ? text(raw.why_connection_works) : null,
    scores,
    risks: list(raw.risks),
    additionalResearch: {
      needed: Boolean(raw.additional_research?.needed),
      queries: list(raw.additional_research?.queries),
      factsToVerify: list(raw.additional_research?.facts_to_verify)
    }
  };
}

export function gateTopics(candidates, options = {}) {
  const used = { ...thresholds, ...options };
  const approved = [];
  const rejected = [];
  const seen = [];
  for (const candidate of candidates) {
    let reason = null;
    let riskType = null;
    if (!candidate.motherTitle || !candidate.coreQuestion || !candidate.readerValue) [reason, riskType] = ["选题缺少标题、核心问题或读者价值", "low_value"];
    else if (!candidate.clusterIds.length || !candidate.evidenceIds.length) [reason, riskType] = ["选题没有可追溯的事件簇或证据", "insufficient_evidence"];
    else if (candidate.category === "cross_trend" && (!candidate.generalClusterIds.length || !candidate.keywordClusterIds.length || !candidate.realIntersection)) [reason, riskType] = ["结合选题没有同时引用两类事件或未说明真实交集", "forced_connection"];
    else if (candidate.category === "cross_trend" && score(candidate.scores.forced_connection_risk) > used.forcedConnectionRiskMax) [reason, riskType] = ["强行结合风险超过淘汰阈值", "forced_connection"];
    else if (score(candidate.scores.overall) < used.reviewMin) [reason, riskType] = ["综合分低于最低保留阈值", "low_value"];
    else if (seen.some((item) => canonical(item.motherTitle) === canonical(candidate.motherTitle))) [reason, riskType] = ["与已保留选题重复", "duplicate"];
    if (reason) {
      rejected.push({ candidateId: candidate.candidateId, reason, riskType });
      continue;
    }
    if (score(candidate.scores.overall) < used.overallMin || score(candidate.scores.evidence_strength) < used.evidenceMin || (candidate.category === "cross_trend" && score(candidate.scores.forced_connection_risk) >= used.forcedConnectionReviewMin)) {
      candidate.proposedStatus = "needs_research";
      candidate.additionalResearch.needed = true;
    }
    seen.push(candidate);
    approved.push(candidate);
  }
  return { thresholds: used, approved, rejected };
}

function gateReviewRequest(candidates, strategy, usedThresholds) {
  return {
    candidate_topics: candidates,
    account_strategy: strategy,
    thresholds: {
      overall_recommended_min: usedThresholds.overallMin,
      overall_needs_research_min: usedThresholds.reviewMin,
      evidence_min: usedThresholds.evidenceMin,
      forced_connection_risk_reject_above: usedThresholds.forcedConnectionRiskMax
    },
    product_policy: [
      "综合分 70 以上可推荐，60-69 分方向合理时降级为 needs_research，低于 60 淘汰",
      "强行结合风险 41-60 只有真实交集成立时才能降级保留，超过 60 淘汰",
      "给所有需要完善的候选输出 required_changes，不得直接改写候选",
      "所有 topic_id 必须来自输入候选"
    ]
  };
}

function mergeEditorReview(candidates, fallbackGate, rawReview) {
  const data = rawReview?.data?.data || rawReview?.data || {};
  const approvedReview = new Map((data.approved || []).map((item) => [text(item.topic_id), item]));
  const rejectedReview = new Map((data.rejected || []).map((item) => [text(item.topic_id), item]));
  if (!approvedReview.size && !rejectedReview.size) return { ...fallbackGate, editorReviewMode: "deterministic_fallback" };
  const fallbackApproved = new Map(fallbackGate.approved.map((item) => [item.candidateId, item]));
  const fallbackRejected = new Map(fallbackGate.rejected.map((item) => [item.candidateId, item]));
  const approved = [];
  const rejected = [];
  for (const candidate of candidates) {
    if (fallbackRejected.has(candidate.candidateId)) {
      rejected.push(fallbackRejected.get(candidate.candidateId));
      continue;
    }
    const editorRejected = rejectedReview.get(candidate.candidateId);
    if (editorRejected) {
      rejected.push({ candidateId: candidate.candidateId, reason: text(editorRejected.reason) || "主编审核未通过", riskType: text(editorRejected.risk_type) || "low_value" });
      continue;
    }
    const editorApproved = approvedReview.get(candidate.candidateId);
    const kept = fallbackApproved.get(candidate.candidateId);
    if (!kept) continue;
    kept.proposedStatus = editorApproved?.status === "needs_research" ? "needs_research" : kept.proposedStatus;
    kept.editorReview = {
      finalPriority: Number(editorApproved?.final_priority) || approved.length + 1,
      editorReason: text(editorApproved?.editor_reason) || "通过基础门控并保留",
      requiredChanges: list(editorApproved?.required_changes),
      factsToVerify: list(editorApproved?.facts_to_verify)
    };
    if (kept.editorReview.requiredChanges.length) kept.proposedStatus = "needs_research";
    approved.push(kept);
  }
  approved.sort((a, b) => (a.editorReview?.finalPriority || 99) - (b.editorReview?.finalPriority || 99));
  return { thresholds: fallbackGate.thresholds, approved, rejected, editorReviewMode: "skill" };
}

function adaptationRequest(topics, strategy, evidenceById) {
  return {
    task: "adapt_approved_topics_to_xiaohongshu_and_wechat",
    contract: "PlatformTopicPair@2.0",
    approved_mother_topics: topics.map((topic) => ({ ...topic, evidence: topic.evidenceIds.map((evidenceId) => evidenceById.get(evidenceId)).filter(Boolean) })),
    account_strategy: strategy,
    platform_fit_minimum: thresholds.platformFitMin,
    rules: {
      shared: ["保持母选题事实、核心问题和证据边界不变", "平台子选题不是同一标题的语气改写", "不生成完整正文、逐页成稿或图片 Prompt", "没有经历证据时禁止使用亲测、我用了、亲身经历"],
      xiaohongshu: ["给出具体读者场景和一个可兑现的单一承诺", "明确收藏理由、卡片推进逻辑、视觉叙事和封面信息方向", "优先教程、清单、对比、避坑、选择框架和认知反差"],
      wechat: ["给出中心论点、信息增量、论证链、边界讨论和转发理由", "优先趋势分析、事件解读、方法论、机制和影响分析"],
      unsuitable: "fit_score 低于 60 时填写 not_suitable_reason，不强行进入写作"
    },
    output: { items: [{ topic_id: "", mother_topic_invariants: { core_question: "", fact_ids: [], forbidden_claims: [] }, xiaohongshu: { fit_score: 0, fit_reason: "", platform_topic: "", single_promise: "", reader_scenario: "", target_reader: "", content_angle: "", practical_value: "", emotional_tension: "", save_trigger: "", share_trigger: "", comment_trigger: "", recommended_format: "tutorial | checklist | comparison | case | warning | opinion", carousel_logic: [], visual_story: "", cover_message_direction: "", title_directions: [], evidence_focus: [], platform_risks: [], not_suitable_reason: "" }, wechat_official_account: { fit_score: 0, fit_reason: "", platform_topic: "", core_argument: "", target_reader: "", information_gain: "", opening_question: "", content_angle: "", recommended_format: "trend_analysis | event_explainer | case_study | methodology | tutorial | opinion", argument_chain: [], reader_takeaway: "", share_reason: "", title_directions: [], evidence_focus: [], platform_risks: [], not_suitable_reason: "" } }] }
  };
}

function normalizePlatform(raw = {}, platform) {
  const result = { ...raw };
  result.fit_score = score(raw.fit_score);
  result.platform_topic = text(raw.platform_topic, 180);
  result.fit_reason = text(raw.fit_reason);
  result.not_suitable_reason = text(raw.not_suitable_reason);
  result.title_directions = list(raw.title_directions, 5);
  result.evidence_focus = list(raw.evidence_focus, 12);
  result.platform_risks = list(raw.platform_risks, 8);
  if (platform === "xiaohongshu") result.carousel_logic = list(raw.carousel_logic, 10);
  else result.argument_chain = list(raw.argument_chain, 10);
  if (result.fit_score < thresholds.platformFitMin && !result.not_suitable_reason) result.not_suitable_reason = "平台适配分低于 60，建议人工确认后再进入内容生成";
  return result;
}

export async function runTopicPipeline(payload, store, dependencies = {}) {
  const generateText = dependencies.generateText || defaultGenerateText;
  if (!dependencies.generateText && !providerStatus().model.configured) throw new Error("DeepSeek 尚未配置，不能生成真实选题");
  const directionId = payload.directionId;
  if (!directionId) throw new Error("directionId is required");
  const direction = (store.contentDirections || []).find((item) => item.id === directionId);
  if (!direction) throw new Error("Content direction not found");
  const account = (store.accounts || []).find((item) => item.id === payload.accountId) || store.accounts?.[0] || {};
  const strategy = accountStrategy(account);
  const library = (store.hotspotLibrary?.length ? store.hotspotLibrary : store.opportunities || []).filter((item) => item.status !== "ignored");
  const category = ["keyword", "cross_trend", "all"].includes(payload.category) ? payload.category : "all";
  const selectedKeywordIds = new Set(payload.keywordHotspotIds || payload.hotspotIds || []);
  const selectedGlobalIds = new Set(payload.globalHotspotIds || []);
  if (["keyword", "cross_trend"].includes(category) && !selectedKeywordIds.size) throw new Error("请明确选择至少一个当前主题的关键词热点");
  if (category === "cross_trend" && !selectedGlobalIds.size) throw new Error("推荐结合选题必须明确选择至少一个无关键词全网热点");
  const keywordOpportunities = library.filter((item) => item.poolType === "keyword" && item.directionId === directionId && (!selectedKeywordIds.size || selectedKeywordIds.has(item.id))).sort((a, b) => b.score - a.score).slice(0, 12);
  const globalOpportunities = library.filter((item) => item.poolType === "global" && (!selectedGlobalIds.size || selectedGlobalIds.has(item.id))).sort((a, b) => b.score - a.score).slice(0, 20);
  if (!keywordOpportunities.length) throw new Error("当前业务主题还没有关键词热点，请先运行关键词热点采集");
  const keywordClusters = keywordOpportunities.map(evidenceSnapshot);
  const globalClusters = globalOpportunities.map(evidenceSnapshot);
  const allowedClusterIds = new Set([...keywordClusters, ...globalClusters].map((item) => item.cluster_id));
  const allEvidence = [...keywordClusters, ...globalClusters].flatMap((item) => item.evidence);
  const allowedEvidenceIds = new Set(allEvidence.map((item) => item.evidence_id));
  const evidenceById = new Map(allEvidence.map((item) => [item.evidence_id, item]));
  const jobs = [];
  if (["keyword", "all"].includes(category)) jobs.push(executeSkill({ skillName: "generate-keyword-topics", input: keywordRequest({ ...payload, keywords: direction.keywords }, strategy, keywordClusters), generateText, expectedContract: "KeywordTopicCandidateList@1.0", task: "generate_keyword_topic_candidates" }).then((result) => ({ category: "keyword", result })));
  if (["cross_trend", "all"].includes(category)) {
    if (!globalClusters.length) throw new Error("还没有全网热点，不能生成推荐结合选题");
    jobs.push(executeSkill({ skillName: "generate-fusion-topics", input: fusionRequest({ ...payload, keywords: direction.keywords }, strategy, globalClusters, keywordClusters), generateText, expectedContract: "FusionTopicCandidateList@1.0", task: "generate_fusion_topic_candidates" }).then((result) => ({ category: "cross_trend", result })));
  }
  const generated = await Promise.all(jobs);
  const skillTraces = generated.map((item) => item.result.skillTrace).filter(Boolean);
  let candidates = generated.flatMap(({ category: topicCategory, result }) => {
    const rawTopics = result.data?.data?.topics || result.data?.topics || [];
    return rawTopics.map((topic, index) => normalizeCandidate(topic, topicCategory, allowedClusterIds, allowedEvidenceIds, index));
  });
  const reviewCandidates = async () => {
    const fallbackGate = gateTopics(candidates, payload.thresholds || {});
    if (!candidates.length) return fallbackGate;
    const review = await executeSkill({ skillName: "rank-and-gate-topics", input: gateReviewRequest(candidates, strategy, fallbackGate.thresholds), generateText, expectedContract: "TopicGateReview@1.0", task: "rank_and_gate_topic_candidates" });
    skillTraces.push(review.skillTrace);
    return mergeEditorReview(candidates, fallbackGate, review);
  };
  let gate = await reviewCandidates();
  const requestedCount = Math.min(Math.max(Number(payload.topicCount) || 4, 1), 10);
  let retryCount = 0;
  while (gate.approved.length < requestedCount && retryCount < 2 && category !== "all") {
    retryCount += 1;
    const missing = requestedCount - gate.approved.length;
    const retryPayload = { ...payload, topicCount: Math.min(10, missing + 2), keywords: direction.keywords, retry: { attempt: retryCount, avoidTitles: candidates.map((item) => item.motherTitle).filter(Boolean), rejectedCandidates: gate.rejected, instruction: "优先修复主编指出的问题；没有真实连接时不要补造结合选题" } };
    const request = category === "keyword" ? keywordRequest(retryPayload, strategy, keywordClusters) : fusionRequest(retryPayload, strategy, globalClusters, keywordClusters);
    const result = await executeSkill({ skillName: category === "keyword" ? "generate-keyword-topics" : "generate-fusion-topics", input: request, generateText, expectedContract: category === "keyword" ? "KeywordTopicCandidateList@1.0" : "FusionTopicCandidateList@1.0", task: category === "keyword" ? "generate_keyword_topic_candidates" : "generate_fusion_topic_candidates" });
    generated.push({ category, result });
    skillTraces.push(result.skillTrace);
    const rawTopics = result.data?.data?.topics || result.data?.topics || [];
    candidates = candidates.concat(rawTopics.map((topic, index) => normalizeCandidate(topic, category, allowedClusterIds, allowedEvidenceIds, candidates.length + index)));
    gate = await reviewCandidates();
  }
  if (!gate.approved.length) {
    return { run: { id: id("topicrun"), status: "needs_review", category, directionId, requestedCandidateCount: requestedCount, retryCount, candidateCount: candidates.length, outputCount: 0, approvedCount: 0, reviewableCount: 0, rejectedCount: gate.rejected.length, gate, skillTraces, createdAt: new Date().toISOString() }, topics: [], candidates, rejected: gate.rejected };
  }
  const adapted = await executeSkill({ skillName: "adapt-topic-to-platforms", input: adaptationRequest(gate.approved, strategy, evidenceById), generateText, expectedContract: "PlatformTopicPair@2.0", task: "adapt_approved_topics_to_xiaohongshu_and_wechat" });
  skillTraces.push(adapted.skillTrace);
  const adaptedPayload = adapted.data || {};
  const pairs = adaptedPayload.items || adaptedPayload.data?.items || (adaptedPayload.data?.topic_id ? [adaptedPayload.data] : adaptedPayload.topic_id ? [adaptedPayload] : []);
  const pairByCandidate = new Map(pairs.map((item) => [text(item.topic_id), item]));
  const providerModes = [...new Set([...generated.map((item) => item.result.mode), adapted.mode])];
  const topics = gate.approved.slice(0, requestedCount).map((candidate, index) => {
    const pair = pairByCandidate.get(candidate.candidateId) || pairs[index] || {};
    return {
      id: id("topic"),
      candidateId: candidate.candidateId,
      topicCategory: candidate.category,
      directionId,
      strategySnapshotId: direction.strategySnapshotId || account.strategySnapshotId || null,
      accountId: strategy.account_id,
      status: candidate.proposedStatus,
      motherTopic: { title: candidate.motherTitle, coreQuestion: candidate.coreQuestion, coreAngle: candidate.coreAngle, coreClaim: candidate.coreClaim, whyNow: candidate.whyNow, readerValue: candidate.readerValue, targetAudience: candidate.targetAudience, contentType: candidate.contentType, evidenceBoundary: candidate.evidenceBoundary },
      connection: candidate.category === "cross_trend" ? { type: candidate.connectionType, realIntersection: candidate.realIntersection, whyConnectionWorks: candidate.whyConnectionWorks } : null,
      sourceOpportunityIds: candidate.clusterIds,
      globalOpportunityIds: candidate.generalClusterIds,
      keywordOpportunityIds: candidate.keywordClusterIds,
      evidenceIds: candidate.evidenceIds,
      evidence: candidate.evidenceIds.map((evidenceId) => evidenceById.get(evidenceId)).filter(Boolean),
      scores: candidate.scores,
      risks: candidate.risks,
      additionalResearch: candidate.additionalResearch,
      gateReview: { finalPriority: candidate.editorReview?.finalPriority || index + 1, thresholds: gate.thresholds, editorReason: candidate.editorReview?.editorReason || "通过确定性证据、价值、重复和风险门控", requiredChanges: candidate.editorReview?.requiredChanges || [], factsToVerify: candidate.editorReview?.factsToVerify || [] },
      platformTopics: { xiaohongshu: normalizePlatform(pair.xiaohongshu, "xiaohongshu"), wechat: normalizePlatform(pair.wechat_official_account, "wechat") },
      providerModes,
      promptVersions: [candidate.category === "keyword" ? "keyword_topic_generator_v1" : "cross_trend_topic_generator_v1", "topic_gate_v1", "platform_topic_adapter_v1"],
      createdAt: new Date().toISOString()
    };
  });
  const run = { id: id("topicrun"), status: topics.some((item) => item.status === "recommended") ? "succeeded" : "needs_review", category, directionId, accountId: strategy.account_id, requestedCandidateCount: requestedCount, retryCount, candidateCount: candidates.length, outputCount: topics.length, approvedCount: topics.filter((item) => item.status === "recommended").length, reviewableCount: topics.filter((item) => item.status === "needs_research").length, rejectedCount: gate.rejected.length, gate, providerModes, skillTraces, topicIds: topics.map((item) => item.id), createdAt: new Date().toISOString(), completedAt: new Date().toISOString() };
  return { run, topics, candidates, rejected: gate.rejected };
}
