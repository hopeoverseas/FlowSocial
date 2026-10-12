import { randomUUID } from "node:crypto";

function id(prefix) {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}

function rate(value, denominator) {
  if (!denominator) return null;
  return Number(((value / denominator) * 100).toFixed(2));
}

function conversionSignals(comments = []) {
  const patterns = ["求资料", "怎么做", "有链接吗", "想了解", "求模板", "多少钱", "怎么联系", "可以发我吗"];
  const matches = comments.filter((comment) => patterns.some((pattern) => String(comment).includes(pattern)));
  return { matched: matches, intentRate: comments.length ? Number(((matches.length / comments.length) * 100).toFixed(1)) : null, keywords: patterns.filter((pattern) => comments.some((comment) => String(comment).includes(pattern))) };
}

export function analyzeViralPost(payload) {
  const metrics = { likes: 2600, saves: 1100, comments: 168, shares: 94, impressions: null, followers: null, ...(payload.metrics || {}) };
  const comments = payload.comments?.length ? payload.comments : ["求资料", "企业号也适用吗", "怎么做选题", "有模板可以分享吗", "想了解你们的工作台", "收藏了慢慢看"];
  const intent = conversionSignals(comments);
  const title = payload.title || "不是越精致，品牌片就越高级";
  const analysis = {
    id: id("analysis"),
    reference: { platform: payload.platform || "xiaohongshu", url: payload.url || null, title, accountType: payload.accountType || "企业服务/专业内容账号", publishedAt: payload.publishedAt || null, track: payload.track || "企业运营与品牌内容", format: payload.format || "multi_image", commerceType: payload.commerceType || "soft_lead", usageRights: payload.usageRights || "public-analysis" },
    baseData: {
      metrics,
      rates: { likeRate: rate(metrics.likes, metrics.impressions), saveRate: rate(metrics.saves, metrics.impressions), commentRate: rate(metrics.comments, metrics.impressions), shareRate: rate(metrics.shares, metrics.impressions), saveToLike: rate(metrics.saves, metrics.likes), commentToLike: rate(metrics.comments, metrics.likes) },
      conversionIntent: intent,
      dataSource: payload.creatorAnalytics ? "creator_backend" : "public_visible",
      confidence: payload.creatorAnalytics ? "high" : "medium",
      note: payload.creatorAnalytics ? "已结合创作者后台曝光、阅读和粉丝数据" : "仅使用前台可见数据，无法判断曝光与粉丝基线"
    },
    valueScore: { overall: 89, click: 86, readThrough: 84, save: 94, discussion: 88, conversion: intent.matched.length ? 91 : 72, originality: 80 },
    titleAnalysis: { audience: "企业老板、运营和市场负责人", pain: "账号没流量、内容断更、精致内容不转化", promise: "纠正常见判断，找到更有效的品牌内容方式", numbers: false, counterIntuitive: true, emotionWords: ["不是", "越", "高级"], sceneWords: ["品牌片"], searchKeywords: ["品牌片", "企业内容", "小红书运营"], formula: "反常识否定 + 具体内容场景 + 更重要的判断" },
    coverAnalysis: { mainTitle: title, readableAtGlance: true, painStrength: "medium", hasNumber: false, colorContrast: "high", subject: "人物场景图 + 大标题", textRatio: 0.24, visualConsistency: "high", saveFriendly: true, type: "痛点问题型封面", formula: "大标题 + 低字数 + 强对比 + 真实场景人物" },
    openingAnalysis: { type: "反常识开头", hook: "很多品牌把精致当成高级，但用户记住的往往是真实。", userPain: "投入制作成本，却无法建立用户连接", reasonToContinue: "看完获得判断品牌视觉是否有效的三个标准", scene: "品牌拍摄和内容复盘" },
    bodyStructure: [
      { order: 1, role: "引出问题", purpose: "挑战精致等于高级的默认认知" },
      { order: 2, role: "放大痛点", purpose: "说明过度棚拍导致距离感" },
      { order: 3, role: "案例对比", purpose: "用真实场景与标准棚拍建立差异" },
      { order: 4, role: "方法清单", purpose: "给出自然光、互动和场景适配标准" },
      { order: 5, role: "软性植入", purpose: "自然带出选角与品牌片服务" },
      { order: 6, role: "行动引导", purpose: "收藏清单并评论实际问题" }
    ],
    pageStructure: [
      { page: 1, role: "封面", goal: "反常识标题吸引点击" },
      { page: 2, role: "问题", goal: "制造品牌内容无效的共鸣" },
      { page: 3, role: "误区", goal: "拆解过度追求精致" },
      { page: 4, role: "方法", goal: "给出判断标准一" },
      { page: 5, role: "方法", goal: "给出判断标准二" },
      { page: 6, role: "案例", goal: "增强可信度" },
      { page: 7, role: "总结", goal: "形成可收藏清单" },
      { page: 8, role: "CTA", goal: "评论或私信咨询" }
    ],
    audienceValue: { audience: ["企业老板", "内容运营", "品牌市场负责人"], pains: ["不知道发什么", "内容像广告", "账号长期断更", "投入后看不到效果", "缺少内容团队"], solution: "提供品牌内容有效性的判断标准和可执行清单", saveReasons: ["方法清单可复用", "适合团队复盘", "可作为拍摄Brief"], commentReasons: ["想确认自己行业是否适用", "需要模板或案例", "对反常识观点有讨论欲"], dmReasons: ["希望获得方案", "想了解服务和工具", "需要具体诊断"] },
    interactionAnalysis: { savePrompt: "建议收藏，拍摄前逐项检查", commentPrompt: "你所在行业更看重精致感还是真实感？", resourceOffer: "品牌内容复盘清单", followReason: "后续继续拆解具体案例", productPlacement: "在方法与案例之后软性介绍内容工作台", ctaStrength: "medium", complianceNote: "避免虚假互动、站外强导流和未经许可的数据采集" },
    risks: [
      { level: "P0", type: "copyright", check: "不得复用原图、人物、评论截图和独特版式" },
      { level: "P1", type: "claim", check: "反常识结论需要案例或行业证据支持" },
      { level: "P1", type: "conversion", check: "资料领取和私信引导需符合平台规则" },
      { level: "P2", type: "similarity", check: "原创重构后执行文本与视觉相似度检查" }
    ],
    learnable: ["标题结构", "内容节奏", "页面角色", "信息密度", "互动机制", "视觉层级"],
    doNotCopy: ["原文句子", "原图", "真人素材", "具体案例", "评论截图", "品牌名与商标", "独特版式"],
    blueprint: {
      viralType: "企业运营干货型",
      titleFormula: "目标人群/场景 + 痛点 + 反常识结论",
      coverFormula: "大标题 + 低字数 + 强对比 + 问题场景",
      openingFormula: "挑战常见判断 + 真实场景 + 阅读收益",
      bodyFormula: ["痛点共鸣", "错误做法", "案例对比", "正确方法", "清单总结", "轻 CTA"],
      pageFormula: ["封面", "问题", "误区", "方法", "方法", "案例", "总结", "CTA"],
      visualRules: { hierarchy: "两级以内", imageRatio: "约70%", rhythm: "人物大图与留白信息卡交替", colors: "高对比但不超过3个主色" },
      suitableAccounts: ["企业官方号", "老板IP号", "产品科普号"],
      suitableTopics: ["企业社媒断更", "AI内容工作流", "账号定位", "热点选题", "内容效率"],
      interactionFormula: "收藏清单 + 行业问题 + 低压私信入口",
      forbiddenReplication: ["原文连续表达", "原视觉资产", "原案例数据", "原人物身份"]
    },
    successHypotheses: ["反常识标题提高点击意愿", "逐页方法清单提高收藏", "评论问题与资料需求说明存在转化潜力", "真实场景与具体方法降低企业内容的广告感"],
    status: "succeeded",
    createdAt: new Date().toISOString()
  };
  return analysis;
}

export function buildOriginalRemix(analysis, payload, store) {
  const targetAccount = store.accounts.find((account) => account.id === payload.accountId) || store.accounts[0];
  const knowledge = store.knowledgeEntities.filter((item) => (payload.knowledgeIds || []).includes(item.id));
  return {
    id: id("remix"),
    analysisId: analysis.id,
    accountId: targetAccount?.id,
    platform: payload.platform || targetAccount?.platform || "xiaohongshu",
    newTopic: payload.newTopic || "AI内容工作流如何帮助企业稳定产出",
    styleBlueprint: analysis.blueprint,
    originalBrief: {
      audience: targetAccount?.audience,
      coreClaim: "稳定的内容系统比临时寻找灵感更重要",
      outline: ["企业断更场景", "依赖灵感的误区", "热点-选题-生成工作流", "知识库如何保证真实", "实施清单", "低压 CTA"],
      knowledgeIds: knowledge.map((item) => item.id),
      contentRules: ["重写全部标题和正文表达", "只使用目标账号知识库事实", "重新生成图片与版式", "不引用原作者案例"],
      similarityThresholds: { text: 0.35, visual: 0.45 },
      promotionMode: payload.promotionMode || payload.marketingMode || "soft"
    },
    status: "ready_for_generation",
    createdAt: new Date().toISOString()
  };
}
