import assert from "node:assert/strict";
import { assembleStrategyInputBundle } from "../../strategy-agent/strategy-context-assembler.mjs";
import { buildStrategySynthesisRequest } from "../../strategy-agent/strategy-engine.mjs";

const input = {
  account: { id: "account_context_test", name: "测试企业" },
  claims: [{ id: "claim_1", fieldPath: "business.primaryOffers", value: ["企业服务"], status: "confirmed", confidence: 1, sourceType: "user_statement" }],
  facts: [
    { id: "fact_1", factKey: "audience.pain_points", value: ["不知道如何开始"], status: "user_asserted", confidence: 1, sourceType: "user_statement" },
    { id: "fact_2", factKey: "evidence.available_cases", value: ["匿名案例"], status: "user_asserted", confidence: 1, sourceType: "user_statement" }
  ],
  knowledgeCandidates: [{ candidateId: "knowledge_1", fileId: "file_1", candidateType: "fact", targetKey: "business.proof", value: "已确认资料", confidence: 0.9, status: "confirmed" }],
  claimRevision: 2,
  factRevision: 3
};

const first = assembleStrategyInputBundle(input);
const second = assembleStrategyInputBundle(input);
assert.equal(first.contextHash, second.contextHash);
assert.equal(first.coreClaims.length, 1);
assert.equal(first.dynamicFacts.strategy.length, 1);
assert.equal(first.dynamicFacts.content_only.length, 1);
assert.equal(first.knowledgeEvidence.length, 1);
const request = buildStrategySynthesisRequest({ accountId: input.account.id, claims: input.claims, account: input.account, strategyInputBundle: first });
assert.equal(request.strategyInputBundle.contextHash, first.contextHash);

console.log(JSON.stringify({ status: "strategy-context-assembler-self-test passed", contextHash: first.contextHash, dynamicFactGroups: Object.fromEntries(Object.entries(first.dynamicFacts).map(([key, value]) => [key, value.length])) }, null, 2));

