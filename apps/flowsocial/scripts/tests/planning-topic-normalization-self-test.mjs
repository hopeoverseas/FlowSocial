import assert from "node:assert/strict";
import { compactAudienceLabel, MAX_PLANNING_TOPIC_LENGTH, normalizePlanningAudience, normalizePlanningTopic } from "../../content-agent/planning-topic.mjs";
import { projectStrategyForContent } from "../../content-agent/strategy-adapter.mjs";
import { recommendContentTasks } from "../../content-agent/planner.mjs";

const longAudience = "最希望优先影响两类决策人。第一优先是年营收约5000万至10亿元、已有稳定产品和外贸或制造业务，但知识分散、销售依赖个人经验的企业；第二优先是希望搭建岗位型AI员工的老板和业务负责人。";
const audience = {
  id: "audience_business_decision_makers",
  name: longAudience,
  summary: longAudience,
  industries: ["制造业", "外贸", "零售"],
  decisionRoles: ["创始人", "总经理"],
  priority: 1
};

assert.equal(compactAudienceLabel(audience), "制造业、外贸、零售企业决策者");
assert.deepEqual(normalizePlanningAudience(audience), {
  ...audience,
  name: "制造业、外贸、零售企业决策者"
});

const projected = projectStrategyForContent({
  id: "strategy_long_audience",
  version: 1,
  status: "active",
  accountId: "company_test",
  payload: {
    schemaVersion: "2.0",
    accountId: "company_test",
    business: {},
    strategy: {
      audiences: [audience],
      objectives: [],
      contentSystem: {
        pillars: [{ id: "pillar_assets", name: "企业智慧资产库" }],
        portfolio: { discovery: 0, authority: 100, proof: 0, solution: 0, action: 0 }
      },
      platformPlaybooks: { xiaohongshu: { role: "专业信任" } }
    }
  }
});

assert.equal(projected.audiences[0].name, "制造业、外贸、零售企业决策者");
assert.equal(projected.audiences[0].summary, longAudience);

const [recommendation] = recommendContentTasks({
  strategyContext: projected,
  platform: "xiaohongshu",
  limit: 1
});
assert.ok(recommendation.topic.length <= MAX_PLANNING_TOPIC_LENGTH, recommendation.topic);
assert.equal(recommendation.topic.includes("第一优先"), false);
assert.equal(recommendation.targetAudience, "制造业、外贸、零售企业决策者");

const repairedLegacyTopic = normalizePlanningTopic(`企业智慧资产库怎么做：给${longAudience}一套可执行方法`, {
  contentFunction: "authority",
  contentPillar: "企业智慧资产库"
});
assert.equal(repairedLegacyTopic, "企业智慧资产库怎么做：给核心目标用户一套可执行方法");
assert.ok(repairedLegacyTopic.length <= MAX_PLANNING_TOPIC_LENGTH);

console.log("planning-topic-normalization-self-test passed");
