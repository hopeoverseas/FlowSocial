import assert from "node:assert/strict";
import { startDiagnostic, recordDiagnosticAnalysis, confirmStrategy, publishDirectionSet } from "../../strategy-agent/agent-orchestrator.mjs";
import { getActiveStrategySnapshot, getLatestDirectionSet } from "../../strategy-agent/strategy-store.mjs";
import { directionToLegacyContentDirection, strategyToLegacyAccount } from "../../strategy-agent/legacy-adapters.mjs";

const accountId = `agent_test_${Date.now()}`;
const started = startDiagnostic({ accountId, mode: "quick" });
assert.equal(started.session.status, "collecting");

const claims = [
  ["business.primaryOffers", [{ name: "企业AI智能体定制" }]],
  ["business.businessModel", "B2B专业服务"],
  ["audiences.primary", { id: "aud_01", name: "希望引入AI的中小企业负责人" }],
  ["business.conversionPath", "公开内容到私域咨询再成交"],
  ["accountStrategy.primaryGoal", "获得有效企业咨询"],
  ["accountStrategy.growthStage", "account_setup"],
  ["accountStrategy.platformRoles", { xiaohongshu: "获客", wechat: "深度信任" }],
  ["accountStrategy.contentResources", { summary: "产品资料与可脱敏案例", publicUsage: "anonymized" }],
  ["accountStrategy.constraints", ["不得虚构案例和效果数据"]]
].map(([fieldPath, value]) => ({ fieldPath, value, type: "fact", sourceType: "user_statement", confidence: 0.95, status: "confirmed" }));

const analyzed = recordDiagnosticAnalysis({ sessionId: started.session.id, userMessage: "我们给企业做AI智能体，希望通过内容获得咨询。", analysis: { claims, nextQuestion: "你有哪些可公开的案例？", questionGoal: "确认内容证据" } });
assert.equal(analyzed.progress.readyToDraft, true);

const snapshot = confirmStrategy({
  sessionId: started.session.id,
  accountId,
  strategy: {
    business: { valueProposition: "帮助企业找到可落地的AI应用场景" },
    accountStrategy: { contentPillars: ["企业AI落地", "AI智能体避坑"], tone: ["专业", "清晰"] }
  }
});
assert.equal(snapshot.status, "active");
assert.equal(getActiveStrategySnapshot(accountId).id, snapshot.id);

const directionSet = publishDirectionSet({ strategySnapshotId: snapshot.id, rawDirectionSet: { directions: [{ name: "企业AI落地与智能体应用", purpose: "发现企业受众的应用问题", queryGroups: { core: ["企业AI应用", "AI智能体落地"], problem: ["企业AI怎么落地"], exclude: ["招聘", "兼职"] }, sourcePreferences: ["wechat", "xiaohongshu"], freshnessWindowDays: 7, priority: 90 }] } });
assert.equal(getLatestDirectionSet(snapshot.id).id, directionSet.id);

const account = strategyToLegacyAccount(snapshot, { id: accountId, name: "测试账号" });
const direction = directionToLegacyContentDirection(directionSet.payload.directions[0], snapshot.id);
assert.equal(account.strategySnapshotId, snapshot.id);
assert.equal(direction.strategySnapshotId, snapshot.id);
assert.ok(direction.searchKeywords.length >= 2);

console.log(JSON.stringify({ status: "passed", sessionId: started.session.id, strategySnapshotId: snapshot.id, directionSetId: directionSet.id, legacyKeywordCount: direction.searchKeywords.length }));

