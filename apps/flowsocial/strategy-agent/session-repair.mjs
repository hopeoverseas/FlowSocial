import { buildDeterministicDiagnosticFallback } from "./deterministic-extractor.mjs";
import { assistanceIntents, classifyIntentDeterministically } from "./consultative-engine.mjs";

export function buildSessionRepairPreview({ session, turns = [], claims = [] }) {
  const suggestions = [];
  const reviewFlags = [];
  let previousAssistant = null;
  for (const turn of turns) {
    if (turn.role === "assistant") { previousAssistant = turn; continue; }
    if (turn.role !== "user") continue;
    const questionPlan = previousAssistant?.metadata?.questionPlan || null;
    if (!questionPlan?.targetFieldPaths?.length) continue;
    const intent = classifyIntentDeterministically(turn.content, { pendingQuestion: questionPlan }).intent;
    if (/(这条建议|这个建议).*(不适合|不采用|不采纳|拒绝)/.test(turn.content)) continue;
    if (assistanceIntents.has(intent) || ["skip_question", "skip_field", "temporarily_unknown", "cannot_answer", "adopt_recommendation", "modify_recommendation", "reject_recommendation"].includes(intent)) {
      if (!(intent === "cannot_answer" && ["accountStrategy.contentResources", "accountStrategy.constraints"].includes(questionPlan.targetFieldPaths[0]) && /^(没有|暂无|目前没有|还没有)[。！!]*$/.test(turn.content.trim()))) continue;
    }
    const extracted = buildDeterministicDiagnosticFallback(turn.content, claims, { ...questionPlan, id: questionPlan.id || previousAssistant.id });
    for (const operation of extracted.coreClaimOperations) {
      const current = claims.find((claim) => claim.fieldPath === operation.fieldPath);
      if (JSON.stringify(current?.value) === JSON.stringify(operation.value)) continue;
      suggestions.push({ fieldPath: operation.fieldPath, currentValue: current?.value ?? null, proposedValue: operation.value, sourceTurnId: turn.id, sourceText: turn.content, reason: questionPlan.targetFieldPaths.includes(operation.fieldPath) ? "重新按当前问题目标字段提取" : "从同一回答发现可回填字段", action: current ? "review_replace" : "review_create" });
    }
  }
  const turnMap = new Map(turns.map((turn) => [turn.id, turn]));
  for (const claim of claims) {
    const sourceText = turnMap.get(claim.sourceRef)?.content || "";
    let reason = null;
    if (claim.fieldPath === "business.businessModel" && /SaaS.{0,6}行业/i.test(sourceText) && !/(订阅|按年|收费|部署方式)/.test(sourceText)) reason = "疑似把客户所属SaaS行业误判为SaaS订阅商业模式";
    if (claim.fieldPath === "accountStrategy.growthStage" && claim.value === "transformation" && /数字化转型/.test(sourceText) && !/(账号|内容|定位).{0,8}(转型|调整|重做)/.test(sourceText)) reason = "疑似把客户数字化转型误判为账号转型阶段";
    if (claim.fieldPath === "business.conversionPath" && !/(私信|咨询|表单|预约|企业微信|成交|销售)/.test(sourceText)) reason = "来源回答没有描述用户转化动作，当前路径可能由旧规则虚构";
    if (claim.fieldPath === "accountStrategy.primaryGoal" && sourceText.length > 120 && !/(账号目标|希望账号|希望内容|获得咨询|品牌认知)/.test(sourceText)) reason = "疑似把整段公司介绍写成账号目标";
    if (reason) reviewFlags.push({ fieldPath: claim.fieldPath, currentValue: claim.value, sourceTurnId: claim.sourceRef, sourceText, reason, action: "mark_needs_review" });
  }
  return { sessionId: session.id, accountId: session.accountId, generatedAt: new Date().toISOString(), mode: "preview_only", suggestionCount: suggestions.length, reviewFlagCount: reviewFlags.length, suggestions, reviewFlags };
}
