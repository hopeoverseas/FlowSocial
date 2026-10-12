import { generateText as defaultGenerateText, providerStatus } from "./providers.mjs";

const unique = (items, limit = 20) => [...new Set((items || []).map((item) => String(item || "").trim()).filter(Boolean))].slice(0, limit);

function fallbackProfile(name) {
  const theme = String(name || "").trim();
  const overseasSocial = /海外.*社媒|出海.*社媒|海外.*社交媒体/.test(theme);
  if (overseasSocial) {
    return {
      coreKeywords: [theme, "海外社交媒体营销", "出海品牌社媒", "跨境社媒营销"],
      platformKeywords: ["TikTok运营", "Instagram运营", "YouTube运营", "LinkedIn营销", "Facebook营销"],
      scenarioKeywords: ["出海品牌内容营销", "海外红人营销", "海外社媒增长", "海外社媒投放", "跨境品牌本地化"],
      excludeKeywords: ["招聘", "兼职", "远程岗位", "跳舞", "舞蹈挑战", "娱乐搬运"]
    };
  }
  return {
    coreKeywords: [theme, `${theme}趋势`, `${theme}行业`],
    platformKeywords: [`${theme}小红书`, `${theme}抖音`, `${theme}公众号`],
    scenarioKeywords: [`${theme}案例`, `${theme}方法`, `${theme}工具`, `${theme}增长`, `${theme}避坑`],
    excludeKeywords: ["招聘", "兼职", "无关娱乐"]
  };
}

function normalizeProfile(raw, name) {
  const fallback = fallbackProfile(name);
  const source = raw?.data || raw || {};
  const profile = {
    coreKeywords: unique(source.coreKeywords || source.core_keywords || fallback.coreKeywords, 5),
    platformKeywords: unique(source.platformKeywords || source.platform_keywords || fallback.platformKeywords, 6),
    scenarioKeywords: unique(source.scenarioKeywords || source.scenario_keywords || fallback.scenarioKeywords, 6),
    excludeKeywords: unique(source.excludeKeywords || source.exclude_keywords || fallback.excludeKeywords, 8)
  };
  if (!profile.coreKeywords.includes(name)) profile.coreKeywords.unshift(name);
  const sourceOnlyWords = new Set(["小红书", "抖音", "微信公众号", "微信", "社交媒体"]);
  profile.platformKeywords = profile.platformKeywords.filter((item) => !sourceOnlyWords.has(item));
  profile.searchKeywords = unique([...profile.coreKeywords, ...profile.scenarioKeywords, ...profile.platformKeywords], 12);
  return profile;
}

export async function expandDirectionKeywords({ name, description = "" }, dependencies = {}) {
  if (!String(name || "").trim()) throw new Error("关注主题名称不能为空");
  const generateText = dependencies.generateText || defaultGenerateText;
  const fallback = fallbackProfile(name);
  if (!dependencies.generateText && !providerStatus().model.configured) return { ...normalizeProfile(fallback, name), mode: "rules" };
  const request = {
    task: "expand_social_monitoring_keywords",
    theme: name,
    description,
    target_sources: ["小红书", "抖音", "微信公众号"],
    requirements: [
      "生成与主题直接相关且适合平台内容检索的关键词，不生成空泛单字词",
      "核心词3到5个，平台词3到6个，场景词3到6个，排除词0到8个",
      "排除容易造成歧义、招聘、娱乐或无关内容的表达",
      "只返回JSON对象"
    ],
    output_schema: { coreKeywords: [], platformKeywords: [], scenarioKeywords: [], excludeKeywords: [] }
  };
  try {
    const result = await generateText(request, fallback);
    return { ...normalizeProfile(result.data, name), mode: result.mode || "live" };
  } catch {
    return { ...normalizeProfile(fallback, name), mode: "rules_fallback" };
  }
}

function textMatchScore(candidate, profile) {
  const haystack = `${candidate.title || ""} ${candidate.summary || candidate.snippet || ""} ${candidate.author || ""}`.toLowerCase();
  const themeText = unique(profile.coreKeywords).join(" ");
  const recruitmentExcludes = /招聘|人力资源|HR|求职/.test(themeText) ? [] : ["招聘", "求职", "岗位", "面试", "面经", "简历", "薪资", "实习", "题库"];
  const excludes = unique([...(profile.excludeKeywords || []), ...recruitmentExcludes]).filter((word) => haystack.includes(word.toLowerCase()));
  if (excludes.length) return { score: 0, matched: [], excluded: excludes, reason: `命中排除词：${excludes.join("、")}` };
  const groups = [
    [profile.coreKeywords, 36],
    [profile.platformKeywords, 28],
    [profile.scenarioKeywords, 24]
  ];
  const matched = [];
  let score = 0;
  for (const [keywords, weight] of groups) {
    const groupMatches = unique(keywords).filter((word) => word.length >= 2 && haystack.includes(word.toLowerCase()));
    if (groupMatches.length) {
      matched.push(...groupMatches);
      score += Math.min(weight, 18 + groupMatches.length * 8);
    }
  }
  const query = String(candidate.query || "").toLowerCase();
  if (query && haystack.includes(query)) score += 24;
  const broadTokens = unique([...profile.coreKeywords, ...profile.platformKeywords, ...profile.scenarioKeywords]
    .flatMap((word) => String(word).split(/[\s/、，,·]+/)).filter((word) => word.length >= 3));
  const tokenMatches = broadTokens.filter((word) => haystack.includes(word.toLowerCase()));
  score += Math.min(18, tokenMatches.length * 4);
  return {
    score: Math.min(100, score),
    matched: unique([...matched, ...tokenMatches], 8),
    excluded: [],
    reason: matched.length ? `命中主题词：${unique(matched, 5).join("、")}` : "没有发现明确的主题锚点"
  };
}

export async function filterRelevantSignals(candidates, profile, dependencies = {}) {
  const threshold = Math.min(95, Math.max(50, Number(dependencies.threshold) || 70));
  const deterministic = candidates.map((candidate) => ({ candidate, review: textMatchScore(candidate, profile) }));
  const accepted = [];
  const rejected = [];
  const ambiguous = [];
  for (const item of deterministic) {
    if (item.review.excluded.length || item.review.score < 25) rejected.push(item);
    else if (item.review.score >= threshold) accepted.push(item);
    else ambiguous.push(item);
  }

  const generateText = dependencies.generateText || defaultGenerateText;
  if (ambiguous.length && (dependencies.generateText || providerStatus().model.configured)) {
    const batch = ambiguous.slice(0, 100);
    try {
      const response = await generateText({
        task: "judge_hotspot_relevance",
        theme_profile: profile,
        minimum_score: threshold,
        rules: ["只判断内容本身，不因搜索词命中而假定相关", "招聘、泛娱乐及偶然词语重合应判为无关", "返回0到100整数和一句具体理由"],
        candidates: batch.map(({ candidate }, index) => ({ id: candidate.id || `candidate_${index}`, title: candidate.title, summary: candidate.summary || candidate.snippet, platform: candidate.platform })),
        output_schema: { items: [{ id: "", score: 0, related: false, reason: "", matchedKeywords: [] }] }
      }, { items: [] });
      const reviews = new Map((response.data?.items || response.data?.data?.items || []).map((item) => [String(item.id), item]));
      for (const item of batch) {
        const model = reviews.get(String(item.candidate.id));
        const modelScore = Math.max(0, Math.min(100, Number(model?.score) || 0));
        const combined = Math.round(item.review.score * 0.35 + modelScore * 0.65);
        item.review = { ...item.review, score: combined, reason: model?.reason || item.review.reason, matched: unique([...(item.review.matched || []), ...(model?.matchedKeywords || [])], 8), mode: "hybrid" };
        (model?.related !== false && combined >= threshold ? accepted : rejected).push(item);
      }
      ambiguous.splice(0, batch.length);
    } catch {
      // Strict fallback below: ambiguous results are rejected instead of weakening quality.
    }
  }
  rejected.push(...ambiguous);
  return {
    accepted: accepted.map(({ candidate, review }) => ({ ...candidate, relevance: review })),
    rejected: rejected.map(({ candidate, review }) => ({ id: candidate.id, title: candidate.title, platform: candidate.platform, ...review })),
    threshold
  };
}
