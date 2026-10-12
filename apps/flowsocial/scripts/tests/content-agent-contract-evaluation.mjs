import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { planNextContent, validateContentIdentityContract, validateContentSourcePlanContract, validateContentTaskBriefContract, validateFactSnapshotContract, validateStrategySnapshotContract } from "../../content-agent/index.mjs";
import { runContentPipeline } from "../../content-engine.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const fixture = JSON.parse(await readFile(`${root}/tests/fixtures/content-agent/mock-strategy-cases.json`, "utf8"));
assert.equal(fixture.schemaVersion, "0.1");
assert.equal(fixture.cases.length, 10);

const results = [];
for (const testCase of fixture.cases) {
  const strategyValidation = validateStrategySnapshotContract(testCase.strategySnapshot);
  assert.equal(strategyValidation.valid, true, `${testCase.id}: ${JSON.stringify(strategyValidation.errors)}`);
  const folders = testCase.strategySnapshot.knowledgeScope?.folderIds || [];
  const plan = planNextContent({
    strategySnapshot: testCase.strategySnapshot,
    currentFacts: testCase.facts,
    platform: testCase.platform,
    history: [],
    hotspots: [{
      id: `hot_${testCase.id}`,
      title: `${testCase.label}近期行业变化`,
      status: "recommended",
      relevanceScore: 90
    }],
    knowledgeItems: folders.map((id) => ({ id, title: `${testCase.label}知识资料` })),
    viralBlueprints: [],
    limit: 3
  });
  const first = plan.recommendations[0];
  assert.equal(first.contentPillar, testCase.expected.firstPillar, `${testCase.id}: first pillar`);
  assert.equal(first.contentRole, testCase.expected.primaryRole, `${testCase.id}: primary role`);
  assert.equal(validateFactSnapshotContract(plan.strategyContext.factSnapshot).valid, true);
  assert.equal(validateContentTaskBriefContract(first.contentTaskBrief).valid, true);
  assert.equal(validateContentSourcePlanContract(first.sourcePlan).valid, true);
  assert.equal(validateContentIdentityContract(first.contentIdentity).valid, true);
  const forbiddenIds = new Set(plan.strategyContext.factSnapshot.forbiddenFacts.map((item) => item.id));
  const selectedIds = new Set(first.sourcePlan.sources.flatMap((source) => source.candidateIds));
  assert.equal([...forbiddenIds].some((id) => selectedIds.has(id)), false, `${testCase.id}: forbidden fact selected`);
  results.push({
    id: testCase.id,
    topic: first.topic,
    pillar: first.contentPillar,
    role: first.contentRole,
    sourceMode: first.sourcePlan.mode
  });
}

assert.equal(new Set(results.map((item) => item.topic)).size, 10, "different strategies must produce distinct directions");
assert.ok(new Set(results.map((item) => item.pillar)).size >= 8, "mock strategies should cover diverse pillars");
assert.ok(new Set(results.map((item) => item.role)).size >= 4, "mock strategies should cover all portfolio roles");

const invalid = structuredClone(fixture.cases[0].strategySnapshot);
delete invalid.accountStrategy.primaryGoal;
const invalidResult = validateStrategySnapshotContract(invalid);
assert.equal(invalidResult.valid, false);
assert.ok(invalidResult.errors.some((item) => item.path === "accountStrategy.primaryGoal"));

const noFactCase = fixture.cases.find((item) => item.id === "rapid_launch_fitness_coach");
const noFactPlan = planNextContent({
  strategySnapshot: { id: noFactCase.strategySnapshot.id, accountId: noFactCase.strategySnapshot.accountId, payload: noFactCase.strategySnapshot },
  currentFacts: [],
  platform: noFactCase.platform,
  history: [],
  hotspots: [],
  knowledgeItems: [],
  viralBlueprints: [],
  limit: 1
});
assert.equal(noFactPlan.strategyContext.factSnapshot.usableFacts.length, 0);
assert.equal(noFactPlan.recommendations[0].sourcePlan.sources.some((source) => source.type === "strategy_facts"), false);
assert.ok(noFactPlan.recommendations[0].sourcePlan.missing.length > 0);

const captured = [];
const noFactGeneration = noFactPlan.recommendations[0].generationPayload;
const pipeline = await runContentPipeline({
  payload: noFactGeneration,
  selection: null,
  intentProfile: {
    profile_id: "intent_no_fact",
    topic_id: null,
    platform: noFactGeneration.platform,
    purpose: { id: noFactGeneration.contentPurposeId, label: "防编造测试", description: "没有证据时阻断" },
    promotion: { mode: "none", knowledge_enabled: false, knowledge_asset_ids: [], knowledge_snapshot_id: null, insertion_rule: "do_not_mention" },
    engagement_policy: { mode: "auto", optimize_for: ["save"] },
    source: { type: "content_agent_test" }
  },
  citations: [],
  knowledgeAssets: [],
  contentTaskBrief: noFactGeneration.contentTaskBrief,
  contentSourcePlan: noFactGeneration.contentSourcePlan,
  factSnapshot: noFactGeneration.factSnapshot
}, {
  generateText: async (request, fallback) => {
    captured.push(request);
    return { mode: "evaluation", data: fallback || {} };
  }
});
assert.equal(pipeline.status, "blocked");
assert.equal(pipeline.contentMaster.confirmed_facts.length, 0);
const masterRequest = captured.find((request) => request.task === "build_content_master_v2");
assert.equal(masterRequest.input.supplied_evidence.length, 0);

console.log(JSON.stringify({
  status: "content-agent-contract-evaluation passed",
  caseCount: results.length,
  uniqueTopics: new Set(results.map((item) => item.topic)).size,
  uniquePillars: new Set(results.map((item) => item.pillar)).size,
  coveredRoles: [...new Set(results.map((item) => item.role))],
  noEvidencePipelineStatus: pipeline.status,
  adapterWrapperCompatible: true,
  cases: results
}, null, 2));

