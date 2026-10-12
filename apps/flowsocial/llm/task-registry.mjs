export const LLM_PROFILE_DEFINITIONS = Object.freeze({
  fast_structured: Object.freeze({
    name: "fast_structured",
    latencyClass: "low",
    temperature: 0.1,
    maxOutputTokens: 4096,
    structuredOutput: "json_object",
    reasoning: Object.freeze({ enabled: false, budgetTokens: 0, effort: "low" })
  }),
  conversation: Object.freeze({
    name: "conversation",
    latencyClass: "interactive",
    temperature: 0.45,
    maxOutputTokens: 6144,
    structuredOutput: "json_object",
    reasoning: Object.freeze({ enabled: false, budgetTokens: 0, effort: "low" })
  }),
  reasoning: Object.freeze({
    name: "reasoning",
    latencyClass: "deliberate",
    temperature: 0.2,
    maxOutputTokens: 16384,
    structuredOutput: "json_object",
    reasoning: Object.freeze({ enabled: true, budgetTokens: 8192, effort: "high" })
  }),
  xhs_carousel_creative_draft: Object.freeze({
    name: "xhs_carousel_creative_draft",
    latencyClass: "bounded_structured",
    temperature: 0.4,
    maxOutputTokens: 8192,
    structuredOutput: "json_object",
    // DeepSeek chat is a non-reasoner JSON model. Keep creativity in the
    // temperature, but do not request a thinking channel whose content is
    // discarded by the adapter and can leave message.content empty.
    reasoning: Object.freeze({ enabled: false, budgetTokens: 0, effort: "low" })
  }),
  wechat_narrative_creative_draft: Object.freeze({
    name: "wechat_narrative_creative_draft",
    latencyClass: "bounded_structured",
    temperature: 0.35,
    maxOutputTokens: 14000,
    structuredOutput: "json_object",
    reasoning: Object.freeze({ enabled: false, budgetTokens: 0, effort: "low" })
  }),
  default: Object.freeze({
    name: "default",
    latencyClass: "standard",
    temperature: 0.2,
    maxOutputTokens: 8192,
    structuredOutput: "json_object",
    reasoning: Object.freeze({ enabled: false, budgetTokens: 0, effort: "low" })
  })
});

export const LLM_TASK_BUDGETS = Object.freeze({
  wechat_narrative_creative_draft: Object.freeze({ name: "wechat_narrative_creative_draft", connectionTimeoutMs: 120000, firstTokenTimeoutMs: 30000, totalTimeoutMs: 180000, maxOutputTokens: 14000, maxAttempts: 1, contextCharBudget: 80000, repairContextCharBudget: 10000, reasoningMode: "disable_when_toggleable", deepSeekModelOverride: "deepseek-v4-flash" }),
  diagnostic_extract: Object.freeze({ name: "diagnostic_extract", connectionTimeoutMs: 8000, firstTokenTimeoutMs: 15000, totalTimeoutMs: 45000, maxOutputTokens: 4096, maxAttempts: 2, contextCharBudget: 24000, repairContextCharBudget: 6000 }),
  growth_playbook: Object.freeze({ name: "growth_playbook", connectionTimeoutMs: 10000, firstTokenTimeoutMs: 25000, totalTimeoutMs: 90000, maxOutputTokens: 6144, maxAttempts: 2, contextCharBudget: 56000, repairContextCharBudget: 8000, reasoningMode: "disable_when_toggleable" }),
  strategy_draft: Object.freeze({ name: "strategy_draft", connectionTimeoutMs: 10000, firstTokenTimeoutMs: 30000, totalTimeoutMs: 110000, maxOutputTokens: 12000, maxAttempts: 2, contextCharBudget: 72000, repairContextCharBudget: 10000, reasoningMode: "disable_when_toggleable" }),
  content_outline: Object.freeze({ name: "content_outline", connectionTimeoutMs: 30000, firstTokenTimeoutMs: 30000, totalTimeoutMs: 90000, maxOutputTokens: 8192, maxAttempts: 2, contextCharBudget: 48000, repairContextCharBudget: 8000 }),
  topic_adjustment: Object.freeze({ name: "topic_adjustment", connectionTimeoutMs: 30000, firstTokenTimeoutMs: 30000, totalTimeoutMs: 90000, maxOutputTokens: 3072, maxAttempts: 1, contextCharBudget: 24000, repairContextCharBudget: 0, reasoningMode: "disable_when_toggleable" }),
  xhs_carousel_creative_draft: Object.freeze({ name: "xhs_carousel_creative_draft", connectionTimeoutMs: 120000, firstTokenTimeoutMs: 30000, totalTimeoutMs: 150000, maxOutputTokens: 8192, maxAttempts: 1, contextCharBudget: 56000, repairContextCharBudget: 6000, reasoningMode: "profile" }),
  content_master: Object.freeze({ name: "content_master", connectionTimeoutMs: 30000, firstTokenTimeoutMs: 45000, totalTimeoutMs: 150000, maxOutputTokens: 8192, maxAttempts: 2, contextCharBudget: 48000, repairContextCharBudget: 8000, reasoningMode: "disable_when_toggleable", deepSeekModelOverride: "deepseek-v4-flash" }),
  content_body: Object.freeze({ name: "content_body", connectionTimeoutMs: 120000, firstTokenTimeoutMs: 45000, totalTimeoutMs: 150000, maxOutputTokens: 14000, maxAttempts: 2, contextCharBudget: 80000, repairContextCharBudget: 12000 }),
  content_body_recovery: Object.freeze({ name: "content_body_recovery", connectionTimeoutMs: 10000, firstTokenTimeoutMs: 30000, totalTimeoutMs: 180000, maxOutputTokens: 8192, maxAttempts: 1, contextCharBudget: 24000, repairContextCharBudget: 6000, reasoningMode: "disable_when_toggleable", deepSeekModelOverride: "deepseek-v4-flash" }),
  content_body_first_recovery: Object.freeze({ name: "content_body_first_recovery", connectionTimeoutMs: 10000, firstTokenTimeoutMs: 30000, totalTimeoutMs: 180000, maxOutputTokens: 8192, maxAttempts: 1, contextCharBudget: 24000, repairContextCharBudget: 6000, reasoningMode: "disable_when_toggleable", deepSeekModelOverride: "deepseek-v4-flash" }),
  content_metadata_recovery: Object.freeze({ name: "content_metadata_recovery", connectionTimeoutMs: 10000, firstTokenTimeoutMs: 20000, totalTimeoutMs: 90000, maxOutputTokens: 4096, maxAttempts: 1, contextCharBudget: 16000, repairContextCharBudget: 4000, reasoningMode: "disable_when_toggleable", deepSeekModelOverride: "deepseek-v4-flash" }),
  content_recovery_preflight: Object.freeze({ name: "content_recovery_preflight", connectionTimeoutMs: 8000, firstTokenTimeoutMs: 15000, totalTimeoutMs: 30000, maxOutputTokens: 256, maxAttempts: 1, contextCharBudget: 4000, repairContextCharBudget: 1000, reasoningMode: "disable_when_toggleable", deepSeekModelOverride: "deepseek-v4-flash" }),
  default: Object.freeze({ name: "default", connectionTimeoutMs: 10000, firstTokenTimeoutMs: 25000, totalTimeoutMs: 90000, maxOutputTokens: 8192, maxAttempts: 2, contextCharBudget: 56000, repairContextCharBudget: 8000 }),
  compatibility_test: Object.freeze({ name: "compatibility_test", connectionTimeoutMs: 5000, firstTokenTimeoutMs: 10000, totalTimeoutMs: 30000, maxOutputTokens: 4096, maxAttempts: 3, contextCharBudget: 16000, repairContextCharBudget: 4000 })
});

const taskDefinitions = {
  analyze_diagnostic_turn: { label: "分析策略诊断回答", skill: "analyze-diagnostic-turn", contract: "DiagnosticTurnResult@3.0", profile: "fast_structured", budget: "diagnostic_extract" },
  provide_diagnostic_assistance: { label: "提供诊断回答辅助", skill: "coach-diagnostic-field", contract: "DiagnosticAssistanceResult@2.0", profile: "conversation" },
  compose_consultative_diagnostic_reply: { label: "组织策略对话回复", skill: "compose-consultative-reply", contract: "ConsultativeReply@2.0", profile: "conversation" },
  select_growth_playbook: { label: "选择增长打法", skill: "select-growth-playbook", contract: "GrowthPlaybookSelection@1.0", profile: "reasoning", budget: "growth_playbook" },
  synthesize_account_strategy: { label: "生成账号策略草案", skill: "synthesize-account-strategy", contract: "StrategySynthesisResult@2.0", profile: "reasoning", budget: "strategy_draft" },
  enrich_completed_diagnostic: { skill: "analyze-diagnostic-turn", contract: "PostCompletionTurnResult@1.0", profile: "fast_structured" },
  patch_strategy_draft: { skill: "synthesize-account-strategy", contract: "StrategyPatch@1.0", profile: "reasoning" },
  generate_monitoring_directions: { skill: "generate-monitoring-directions", contract: "StrategyDirectionSet@1.0", profile: "reasoning" },
  analyze_viral_content_v1: { skill: "analyze-viral-content", contract: "ViralContentAnalysis@1.0", profile: "reasoning" },
  review_xhs_visuals: { skill: "review-xhs-visuals", contract: "XhsVisualReview@1.0", profile: "reasoning" },
  naturalize_copy: { skill: "naturalize-copy", contract: "NaturalizationResult@1.0", profile: "conversation" },
  extract_document_strategy_candidates: { skill: null, contract: "DocumentDiagnosticExtraction@1.0", profile: "fast_structured", budget: "diagnostic_extract" },
  generate_confirmable_content_outline: { skill: null, contract: "ContentOutline@1.0", profile: "reasoning", budget: "content_outline" },
  adjust_content_plan_topic: { label: "对话调整内容计划选题", skill: null, contract: "UnstructuredResult@1.0", profile: "conversation", budget: "topic_adjustment" },
  write_xhs_post_copy: { label: "生成小红书正文", skill: "write-xhs-post-copy", contract: "XhsPostCopyCreativeOutput@1.0", profile: "reasoning", budget: "content_body" },
  generate_platform_titles: { label: "生成平台标题", skill: "generate-platform-titles", contract: "PlatformTitleList@1.0", profile: "reasoning", budget: "content_body" },
  plan_xhs_visual_assets: { label: "规划小红书视觉", skill: "plan-xhs-visual-assets", contract: "XhsVisualAssetPlanCreativeOutput@1.0", profile: "reasoning", budget: "content_body" },
  review_wechat_article: { label: "审阅公众号正文", skill: "review-wechat-article", contract: "WechatArticleReview@1.0", profile: "reasoning", budget: "content_body" },
  plan_wechat_images: { label: "规划公众号配图", skill: "plan-wechat-images", contract: "WechatImagePlan@1.0", profile: "reasoning", budget: "content_body" },
  plan_xhs_carousel: { label: "生成小红书轮播创意草稿", skill: "plan-xhs-carousel", contract: "XhsCarouselPlanCreativeOutput@1.0", profile: "xhs_carousel_creative_draft", budget: "xhs_carousel_creative_draft" },
  build_content_master_v2: { skill: "build-content-master", contract: "ContentMaster@2.0", profile: "fast_structured", budget: "content_master" },
  write_xhs_content_v2: { skill: "write-xhs-content", contract: "XhsPostPackage@2.0", profile: "reasoning", budget: "content_body" },
  write_wechat_article_v2: { skill: "write-wechat-article", contract: "WechatArticle@2.0", profile: "reasoning", budget: "content_body" },
  write_wechat_narrative_creative_draft: { skill: "write-wechat-article", contract: "WechatArticle@2.0", profile: "wechat_narrative_creative_draft", budget: "wechat_narrative_creative_draft" },
  write_wechat_article_v2_recovery: { label: "恢复公众号正文", skill: "write-wechat-article", contract: "WechatArticle@2.0", profile: "reasoning", budget: "content_body_recovery" },
  write_wechat_article_body_recovery_v1: { label: "优先恢复公众号正文", skill: "write-wechat-article", contract: "WechatArticleBodyRecovery@1.0", profile: "reasoning", budget: "content_body_first_recovery" },
  write_wechat_article_metadata_recovery_v1: { label: "恢复公众号元数据", skill: "write-wechat-article", contract: "WechatArticleMetadataRecovery@1.0", profile: "reasoning", budget: "content_metadata_recovery" },
  wechat_content_recovery_preflight: { label: "公众号正文恢复 Provider 预检", skill: null, contract: "ConsultativeReply@2.0", profile: "fast_structured", budget: "content_recovery_preflight" },
  model_gateway_live_test: { label: "测试模型连接", skill: null, contract: "ConsultativeReply@2.0", profile: "fast_structured", budget: "compatibility_test" },
  provider_connection_test: { label: "检查模型供应商", skill: null, contract: null, profile: "fast_structured" }
};

export function getLlmTaskDefinition(task = "unclassified") {
  return taskDefinitions[task] || { label: task, skill: null, contract: null, profile: "default", budget: "default" };
}

export function resolveLlmTaskBudget(task = "unclassified", { enabled = true, override = null } = {}) {
  if (!enabled) return null;
  const definition = getLlmTaskDefinition(task);
  const selected = LLM_TASK_BUDGETS[definition.budget] || LLM_TASK_BUDGETS.default;
  return { responseMode: "non_streaming_json", reasoningMode: "profile", ...selected, ...(override || {}), name: selected.name };
}

export function resolveLlmProfile(profile = "default", { mode = "profiled" } = {}) {
  const requestedName = LLM_PROFILE_DEFINITIONS[profile] ? profile : "default";
  const appliedName = mode === "legacy_structured" ? "default" : requestedName;
  return {
    requestedName,
    appliedName,
    mode: mode === "legacy_structured" ? "legacy_structured" : "profiled",
    ...LLM_PROFILE_DEFINITIONS[appliedName],
    reasoning: { ...LLM_PROFILE_DEFINITIONS[appliedName].reasoning }
  };
}

export function listLlmTasks() {
  return Object.entries(taskDefinitions).map(([task, definition]) => ({
    task,
    ...definition,
    runtimeProfile: resolveLlmProfile(definition.profile),
    runtimeBudget: resolveLlmTaskBudget(task)
  }));
}
