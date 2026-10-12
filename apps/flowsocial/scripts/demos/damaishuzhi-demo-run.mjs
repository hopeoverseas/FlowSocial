import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startDiagnostic, recordDiagnosticAnalysis, confirmStrategy, publishDirectionSet } from "../../strategy-agent/agent-orchestrator.mjs";
import { strategyToLegacyAccount, directionToLegacyContentDirection } from "../../strategy-agent/legacy-adapters.mjs";
import { runTopicPipeline } from "../../topic-engine.mjs";
import { runContentPipeline } from "../../content-engine.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dataDir = path.join(projectRoot, "tests", "fixtures", "demo-data");
const strategyFixture = JSON.parse(await readFile(path.join(dataDir, "expected-strategy-snapshot.json"), "utf8"));
const directionFixture = JSON.parse(await readFile(path.join(dataDir, "monitoring-directions.json"), "utf8"));
const knowledgeFacts = (await readFile(path.join(dataDir, "knowledge-facts.jsonl"), "utf8"))
  .split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));

const accountId = `account_damaishuzhi_${Date.now()}`;
const openingMessage = "我们是大卖数智，主要为企业打造知识库、AI员工、定制智能体和AI工作流，客户主要是外贸工厂。";
const diagnostic = startDiagnostic({ accountId, mode: "quick", openingMessage });

const claims = [
  ["business.primaryOffers", strategyFixture.business.primaryOffers],
  ["business.businessModel", strategyFixture.business.businessModel],
  ["audiences.primary", strategyFixture.audiences[0]],
  ["business.conversionPath", strategyFixture.business.conversionPath],
  ["accountStrategy.primaryGoal", strategyFixture.accountStrategy.primaryGoal],
  ["accountStrategy.growthStage", strategyFixture.accountStrategy.growthStage],
  ["accountStrategy.platformRoles", strategyFixture.accountStrategy.platformRoles],
  ["accountStrategy.contentResources", ["产品资料", "销售话术", "SOP", "业务经验"]],
  ["accountStrategy.constraints", ["不得虚构案例和效果数据", "不把AI描述为万能替代方案"]]
].map(([fieldPath, value], index) => ({
  fieldPath, value, type: "fact", sourceType: "user_statement", sourceRef: `demo_claim_${index + 1}`,
  confidence: 0.98, status: "confirmed"
}));

const analyzed = recordDiagnosticAnalysis({
  sessionId: diagnostic.session.id,
  userMessage: openingMessage,
  analysis: {
    claims,
    missingCriticalFields: [],
    nextQuestion: "你们目前有哪些可公开的客户案例、效果数据和固定咨询入口？",
    questionGoal: "确认内容证据和转化入口",
    stopReason: "核心策略字段已齐，可以形成Demo草案；证据资产仍需补充"
  }
});
assert.equal(analyzed.progress.readyToDraft, true);

const snapshot = confirmStrategy({
  sessionId: diagnostic.session.id,
  accountId,
  strategy: {
    business: strategyFixture.business,
    audiences: strategyFixture.audiences,
    accountStrategy: strategyFixture.accountStrategy,
    knowledgeScope: strategyFixture.knowledgeScope,
    hypotheses: strategyFixture.hypotheses,
    missingInformation: strategyFixture.missingInformation
  }
});
assert.equal(snapshot.status, "active");

const directionSet = publishDirectionSet({
  strategySnapshotId: snapshot.id,
  rawDirectionSet: { directions: directionFixture.directions }
});
assert.equal(directionSet.payload.directions.length, 5);

const account = strategyToLegacyAccount(snapshot, { id: accountId, name: "大卖数智" });
const direction = directionToLegacyContentDirection(directionSet.payload.directions[0], snapshot.id);
const keywordHotspot = {
  id: "hotspot_damaishuzhi_demo_01",
  poolType: "keyword",
  directionId: direction.id,
  title: "企业开始关注AI如何进入外贸销售与客服流程",
  summary: "讨论重点从单一工具使用转向资料准备、流程衔接和输出质量控制。该信号为合成Demo素材，不代表真实热度数据。",
  whyHot: "用于演示领域信号如何转化为选题",
  score: 82,
  keywords: ["外贸工厂 AI", "外贸销售 AI", "AI 工作流"],
  sourceEvidence: [{ source: "Demo合成信号", label: "外贸企业AI落地讨论样例", signal: "synthetic_demo，不作为真实行业证据", url: null, mode: "synthetic_demo" }]
};

const topicGenerator = async (request) => {
  if (request.task === "generate_keyword_topic_candidates") return { mode: "deterministic_demo", data: { status: "success", data: { topics: [{
    topic_id: "KT_DMSZ_001", topic_category: "keyword", status: "recommended",
    mother_title: "外贸工厂做AI，为什么要先盘点业务场景？",
    core_question: "外贸企业应如何判断哪些岗位任务适合优先接入AI？",
    core_angle: "从买工具转向盘点任务的决策清单",
    core_claim: "先明确高频、重复、规则相对清晰的业务任务，再决定知识库、AI员工或工作流方案。",
    why_now: "企业AI讨论正在从工具尝鲜转向业务落地。",
    reader_value: "获得一套可以在企业内部使用的AI场景盘点方法。",
    target_audience: ["外贸工厂老板", "外贸销售或运营负责人"], content_type: "checklist",
    evidence_boundary: "行业讨论信号为合成Demo素材；文章只使用大卖数智已确认业务事实和通用方法，不引用真实热度或客户效果。",
    cluster_ids: [keywordHotspot.id], evidence_ids: [`${keywordHotspot.id}_EV01`],
    scores: { topic_relevance: 94, evidence_strength: 72, content_value: 93, timeliness: 80, differentiation: 86, overall: 87 },
    risks: ["不得虚构外贸工厂实施案例"], additional_research: { needed: false, queries: [], facts_to_verify: [] }
  }] } } };
  if (request.task === "rank_and_gate_topic_candidates") return { mode: "deterministic_demo", data: { status: "success", data: { approved: [{ topic_id: "KT_DMSZ_001", final_priority: 1, status: "recommended", editor_reason: "受众、业务问题和读者价值明确，证据边界已标注", required_changes: [], facts_to_verify: [] }], rejected: [] } } };
  return { mode: "deterministic_demo", data: { items: [{
    topic_id: "KT_DMSZ_001",
    mother_topic_invariants: { core_question: "外贸企业应如何判断哪些岗位任务适合优先接入AI？", fact_ids: [`${keywordHotspot.id}_EV01`], forbidden_claims: ["保证降本增效", "AI完全替代员工"] },
    xiaohongshu: { fit_score: 94, fit_reason: "适合用自查清单形成可收藏图文", platform_topic: "外贸工厂上AI前，先盘点这5类业务任务", single_promise: "给出一套5类任务盘点清单", reader_scenario: "老板或负责人准备采购AI工具但不知道从哪里开始", target_reader: "外贸工厂老板和业务负责人", content_angle: "先场景后工具", practical_value: "可直接用于内部开会盘点", emotional_tension: "担心投入后只做出演示", save_trigger: "五类任务自查表", share_trigger: "可转给销售和运营负责人共同填写", comment_trigger: "你最想先交给AI的任务是什么", recommended_format: "checklist", carousel_logic: ["封面结论", "常见误区", "筛选标准", "五类任务", "实施顺序", "自查总结"], visual_story: "克制的企业信息卡和流程图", cover_message_direction: "外贸工厂上AI，先盘点任务", title_directions: ["反常识", "清单", "避坑"], evidence_focus: [`${keywordHotspot.id}_EV01`], platform_risks: ["避免使用未经证实的效率数字"] },
    wechat_official_account: { fit_score: 92, fit_reason: "适合系统解释项目起点和决策逻辑", platform_topic: "外贸工厂落地AI：为什么第一步不是买工具，而是盘点业务任务", core_argument: "AI项目的起点应是可交付任务，而不是工具清单", target_reader: "外贸企业经营者和AI项目负责人", information_gain: "提供任务筛选、知识准备、工作流设计和验收的完整链路", opening_question: "为什么不少企业买了AI工具，却仍然停留在演示阶段？", content_angle: "从任务、知识、流程和验收四层拆解", recommended_format: "methodology", argument_chain: ["工具先行的误区", "任务筛选标准", "知识与流程准备", "小步验证与验收", "实施边界"], reader_takeaway: "一套项目启动判断框架", share_reason: "可转给企业内部项目团队对齐", title_directions: ["方法论", "项目避坑", "决策指南"], evidence_focus: [`${keywordHotspot.id}_EV01`], platform_risks: ["合成信号不能写成真实市场数据"] }
  }] } };
};

const topicResult = await runTopicPipeline({ directionId: direction.id, accountId, category: "keyword", topicCount: 1, keywordHotspotIds: [keywordHotspot.id] }, {
  contentDirections: [direction], accounts: [account], hotspotLibrary: [keywordHotspot]
}, { generateText: topicGenerator });
assert.equal(topicResult.run.status, "succeeded");
assert.equal(topicResult.topics.length, 1);
const topic = topicResult.topics[0];

const buildIntent = (platform) => ({
  profile_id: `intent_damaishuzhi_${platform}`, topic_id: topic.id, platform,
  purpose: { id: "knowledge_howto", label: "知识干货分享", description: "提供方法、步骤、清单、工具或避坑建议" },
  promotion: { mode: "soft", knowledge_enabled: true, knowledge_asset_ids: knowledgeFacts.map((item) => item.id), knowledge_snapshot_id: snapshot.id, insertion_rule: "仅在方法与服务场景自然相连处轻度带出大卖数智，不使用硬性销售话术" },
  engagement_policy: { mode: "auto", optimize_for: ["save", "share", "comment"], selection_rule: "select_one_primary_action_naturally" }
});

const contentMaster = (platform) => ({ status: "ready", data: {
  target_audience: "外贸工厂老板、销售运营负责人和AI项目负责人",
  central_question: "外贸企业应如何判断哪些业务任务适合优先接入AI？",
  central_thesis: "先盘点高频、重复、规则相对清晰且有资料基础的任务，再决定知识库、AI员工或工作流方案。",
  reader_value: "获得一套可用于内部讨论的AI场景盘点方法。",
  content_emphasis: ["场景优先", "五类任务", "知识准备", "小步验证"],
  confirmed_facts: knowledgeFacts.map((fact) => ({ fact_id: fact.id, fact: fact.statement, source_ids: [fact.id] })),
  supported_interpretations: [{ interpretation_id: "I1", text: "大卖数智的服务强调从业务场景出发，而不是单纯销售工具。", source_ids: ["fact_002", "fact_003"] }],
  author_opinions: ["企业AI落地应先明确任务，再选择工具和技术路径。"], unknowns: ["尚无可公开客户效果数据"],
  examples: [{ type: "hypothetical", description: "以询盘整理、产品问答、新人培训等任务作为盘点示例，不表示真实客户案例。" }],
  claims_to_avoid: ["保证降本增效", "AI可以完全替代员工", "已有大量成功案例"], publish_time_checks: ["确认没有把合成热点写成真实趋势数据"], platform
} });

const xhsPackage = { data: {
  content_promise: "用一套五类任务清单，帮助外贸工厂找到AI落地的第一步",
  engagement_strategy: { primary_action: "save", reason: "盘点清单适合保存后用于团队讨论" },
  post_copy: {
    title_candidates: ["外贸工厂上AI，先盘点这5类任务", "别急着买AI工具，先做这张表", "外贸企业AI落地第一步"],
    recommended_title: "外贸工厂上AI，先盘点这5类任务",
    opening: "很多企业一上来先问买哪个模型、装哪个工具。但真正决定项目能不能落地的，是有没有选对第一批任务。",
    body_sections: [
      { heading: "先用四个条件筛任务", content: "优先找高频、重复、规则相对清晰、已有资料基础的工作。复杂决策和高风险承诺不要一开始就全交给AI。" },
      { heading: "盘点五类常见任务", content: "可以依次检查资料整理、标准问答、内容初稿、流程提醒和内部培训。比如询盘归类、产品资料问答、新人SOP学习，都可以先评估输入和验收标准。" },
      { heading: "再决定采用哪种方案", content: "资料分散先解决知识库；任务明确但需要持续执行，可以评估AI员工；涉及多个步骤和系统，再考虑定制智能体与工作流。" },
      { heading: "从小任务开始验收", content: "先定义输入、正确输出、不能说什么、谁来复核，再用一小批真实任务测试。没有验收标准，演示得再漂亮也不等于能进入岗位。" }
    ],
    ending: "大卖数智做企业AI落地时，会先从业务场景和知识资料出发，再判断需要知识库、AI员工还是定制工作流。这个顺序，比追着工具更新更重要。",
    pinned_comment: "你最希望AI先接手哪个重复任务？可以只说岗位和任务，不必透露公司信息。",
    hashtags: ["企业AI", "外贸工厂", "AI员工", "企业知识库", "智能体"], cta: "先收藏这份清单，下次内部讨论AI项目时逐项盘点"
  },
  deck: { pages: [
    { page_id:"P1",page_role:"cover",headline:"外贸工厂上AI\n先盘点这5类任务",supporting_text:"第一步不是买工具",text_layers:[],render_strategy:"html_css",visual_direction:"深绿与米白企业信息卡",fact_ids:[],interpretation_ids:[] },
    { page_id:"P2",page_role:"problem",headline:"为什么工具买了\n还停在演示阶段？",supporting_text:"任务、资料和验收标准没有先定义",text_layers:[],render_strategy:"html_css",visual_direction:"错误路径对比",fact_ids:[],interpretation_ids:["I1"] },
    { page_id:"P3",page_role:"framework",headline:"先用4个条件筛任务",supporting_text:"高频｜重复｜规则清晰｜资料可用",text_layers:[],render_strategy:"html_css",visual_direction:"四象限信息卡",fact_ids:[],interpretation_ids:[] },
    { page_id:"P4",page_role:"checklist",headline:"优先盘点5类任务",supporting_text:"资料整理｜标准问答｜内容初稿｜流程提醒｜内部培训",text_layers:[],render_strategy:"generated_raster",visual_direction:"外贸团队围绕流程板讨论，真实办公场景",fact_ids:[],interpretation_ids:[] },
    { page_id:"P5",page_role:"method",headline:"任务不同，方案也不同",supporting_text:"知识库｜AI员工｜定制智能体与工作流",text_layers:[],render_strategy:"html_css",visual_direction:"三层方案流程图",fact_ids:["fact_004","fact_005"],interpretation_ids:[] },
    { page_id:"P6",page_role:"summary",headline:"从一个小任务开始验证",supporting_text:"先定义输入、输出、边界和复核人",text_layers:[],render_strategy:"html_css",visual_direction:"行动清单卡",fact_ids:[],interpretation_ids:[] }
  ] },
  image_specs: [{ page_id:"P4",prompt:"documentary editorial photography, Chinese export manufacturing company team reviewing an AI workflow board in a clean meeting room, product catalogs and process cards on table, realistic business setting, restrained dark green and warm ivory palette, balanced composition, safe area for later text overlay, no text, no logo, no watermark",prohibitions:["no text","no logo","no watermark","no futuristic robots"] }],
  skipped_image_pages:["P1","P2","P3","P5","P6"], traceability:{ synthetic_demo:true }
} };

const paragraph = "企业在引入AI时，最容易把注意力放在模型和工具上。但岗位能否真正使用，取决于任务是否明确、资料是否可用、流程是否可描述，以及结果能否被验收。";
const wechatPackage = { data: {
  article_promise:"提供一套外贸工厂启动AI项目的任务盘点与验收框架",core_argument:"AI项目的第一步应是定义可交付任务，而不是列工具采购清单",information_gain:"把任务筛选、知识准备、方案选择和验收机制放进同一条实施链路",
  title_candidates:["外贸工厂落地AI，第一步为什么不是买工具？","从任务盘点开始：外贸企业AI落地指南","AI进入外贸岗位前，要先回答这四个问题"],recommended_title:"外贸工厂落地AI，第一步为什么不是买工具？",abstract:"从任务、知识、流程和验收四层，找到企业AI项目真正可执行的起点。",opening:"工具更新很快，但企业岗位并不会因为接入一个模型就自动改变。很多AI项目停在演示阶段，问题往往不在模型，而在于企业还没有定义AI到底要交付什么任务。",
  outline:[{heading:"工具先行为什么容易失败"},{heading:"如何筛选第一批AI任务"},{heading:"知识库、AI员工与工作流怎么选"},{heading:"如何建立小步验收机制"}],
  article_markdown:`## 一、工具先行，为什么容易停在演示阶段\n\n${paragraph.repeat(8)}\n\n对外贸工厂而言，询盘、产品资料、客户跟进、内部培训等工作彼此相连。如果只展示一次生成结果，却没有说明资料来源、业务规则和复核责任，AI就很难稳定进入日常岗位。\n\n## 二、先筛选第一批可交付任务\n\n${paragraph.repeat(7)}\n\n可以用四个条件初筛：是否高频、是否重复、规则是否相对清晰、是否已经有可整理的资料。再从资料整理、标准问答、内容初稿、流程提醒和内部培训五类任务中列出候选。涉及重大报价、合规承诺或复杂客户关系的任务，应保留人工判断。\n\n## 三、知识库、AI员工与工作流怎么选\n\n${paragraph.repeat(7)}\n\n如果问题首先是产品资料、销售话术、SOP和业务经验分散，应先处理知识资产。如果任务已经明确，需要AI持续承担固定步骤，可以评估AI员工。如果任务跨越多个步骤、角色或系统，再考虑定制智能体和AI工作流。大卖数智提供这些落地服务，但具体方案必须以企业场景诊断为前提。\n\n## 四、用小步验收代替一次性大项目\n\n${paragraph.repeat(7)}\n\n选择一个边界清楚的任务，定义输入资料、合格输出、禁止内容、异常处理和人工复核人，再用真实样本测试。记录错误类型，持续修订知识与流程。本文没有引用客户效果数字，也不承诺AI可以替代员工；它提供的是项目启动的判断框架。`,
  pull_quotes:["AI项目的起点不是工具清单，而是可交付任务。","没有验收标准，漂亮的演示也进不了岗位。"],key_takeaways:["先盘点任务，再选择方案","用知识和流程约束输出","从小任务开始验收"],share_summary:"外贸企业AI项目启动清单",share_reason:"适合转给企业管理层、销售运营负责人和AI项目团队对齐",engagement_strategy:{primary_action:"share",reason:"系统框架适合团队内部转发讨论"},cta:"如果企业正在准备AI项目，可以先让业务团队列出十个高频重复任务，再判断哪些值得进入第一轮验证。",claim_map:[{claim:"大卖数智基于企业知识库打造AI员工、定制智能体和AI工作流",source_ids:["fact_005"]}],used_knowledge_asset_ids:knowledgeFacts.map((item)=>item.id),
  image_plan:{cover:{purpose:"传达从业务任务出发的企业AI落地方法",strategy:"generated_raster",prompt:"editorial business illustration, export manufacturing team mapping tasks and knowledge into an AI workflow, restrained dark green and warm ivory palette, modern but realistic, clean composition, no text, no logo, no watermark"},slots:[{slot_purpose:"呈现任务到方案的选择路径",strategy:"html_chart"},{slot_purpose:"呈现小步验收闭环",strategy:"html_chart"}]}
} };

async function generatePlatformContent(platform, packageFixture) {
  const queue = [contentMaster(platform), packageFixture];
  const platformKey = platform === "wechat" ? "wechat" : "xiaohongshu";
  const selection = { platform, topicId: topic.id, platformTopic: topic.platformTopics[platformKey], evidence: topic.evidence };
  const citations = knowledgeFacts.map((fact) => ({ citationId: fact.id, fileId: fact.folderId, fileName: "大卖数智最小知识库", chunkId: fact.id, text: fact.statement }));
  const result = await runContentPipeline({ payload:{ platform, ideaTitle:topic.platformTopics[platformKey].platform_topic }, selection, intentProfile:buildIntent(platform), citations, account, knowledgeAssets:knowledgeFacts }, { generateText:async()=>({mode:"deterministic_demo",data:queue.shift()}) });
  if (result.status !== "succeeded") console.error(JSON.stringify({ platform, qualityReview: result.qualityReview, preflight: result.contentPackage?.preflight_checks, masterFactIds: result.contentMaster?.confirmed_facts?.map((item) => item.fact_id), pageFactIds: result.contentPackage?.deck?.pages?.flatMap((item) => item.fact_ids || []) }, null, 2));
  assert.equal(result.status, "succeeded");
  assert.equal(result.qualityReview.status, "passed");
  return result;
}

const xhs = await generatePlatformContent("xiaohongshu", xhsPackage);
const wechat = await generatePlatformContent("wechat", wechatPackage);
const runId = `damaishuzhi_${new Date().toISOString().replace(/[:.]/g,"-")}`;
const outputDir = path.join(projectRoot,"artifacts","demo-runs",runId);
await mkdir(outputDir,{recursive:true});
const summary = {
  runId, mode:"deterministic_demo", disclaimer:"热点与参考表现为合成Demo数据，不作为真实行业证据。",
  diagnostic:{sessionId:diagnostic.session.id,completeness:analyzed.progress.completeness,readyToDraft:analyzed.progress.readyToDraft},
  strategy:{snapshotId:snapshot.id,status:snapshot.status,primaryGoal:snapshot.payload.accountStrategy.primaryGoal},
  directions:{directionSetId:directionSet.id,count:directionSet.payload.directions.length,names:directionSet.payload.directions.map((item)=>item.name)},
  topic:{runId:topicResult.run.id,title:topic.motherTopic.title,status:topic.status,xiaohongshu:topic.platformTopics.xiaohongshu.platform_topic,wechat:topic.platformTopics.wechat.platform_topic},
  content:{xiaohongshu:{status:xhs.status,title:xhs.contentPackage.post_copy.recommended_title,pages:xhs.contentPackage.deck.pages.length,quality:xhs.qualityReview.status},wechat:{status:wechat.status,title:wechat.contentPackage.recommended_title,characters:wechat.contentPackage.article_markdown.length,quality:wechat.qualityReview.status}}
};
await writeFile(path.join(outputDir,"run-summary.json"),JSON.stringify(summary,null,2),"utf8");
await writeFile(path.join(outputDir,"xiaohongshu-content-package.json"),JSON.stringify(xhs,null,2),"utf8");
await writeFile(path.join(outputDir,"wechat-content-package.json"),JSON.stringify(wechat,null,2),"utf8");
await writeFile(path.join(outputDir,"wechat-article.md"),`# ${wechat.contentPackage.recommended_title}\n\n${wechat.contentPackage.abstract}\n\n${wechat.contentPackage.article_markdown}\n`,"utf8");
await writeFile(path.join(outputDir,"xiaohongshu-post.md"),`# ${xhs.contentPackage.post_copy.recommended_title}\n\n${xhs.contentPackage.post_copy.opening}\n\n${xhs.contentPackage.post_copy.body_sections.map((item)=>`## ${item.heading}\n\n${item.content}`).join("\n\n")}\n\n${xhs.contentPackage.post_copy.ending}\n\n${xhs.contentPackage.post_copy.hashtags.map((item)=>`#${item}`).join(" ")}\n`,"utf8");
console.log(JSON.stringify({status:"passed",outputDir,...summary},null,2));

