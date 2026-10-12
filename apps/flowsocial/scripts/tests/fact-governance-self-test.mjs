import assert from "node:assert/strict";
import { authorizationFromUserText, buildFactSnapshotPayload, classifyFactImpact, factAffectsStrategy, normalizeGovernedFact } from "../../strategy-agent/fact-governance.mjs";
import { getFactSnapshot, saveCurrentFactSnapshot } from "../../strategy-agent/strategy-store.mjs";
import { validateFactSnapshotV1 } from "../../contracts/strategy-content-contracts.mjs";

assert.equal(classifyFactImpact({ factKey: "evidence.available_cases" }), "content_only");
assert.equal(classifyFactImpact({ factKey: "operations.publishing_cadence" }), "platform");
assert.equal(classifyFactImpact({ factKey: "audience.pain_points" }), "strategy");
assert.equal(classifyFactImpact({ factKey: "accountStrategy.constraints" }), "risk");
assert.equal(factAffectsStrategy({ factKey: "evidence.available_cases" }), false);
assert.equal(factAffectsStrategy({ factKey: "audience.pain_points" }), true);
assert.deepEqual(authorizationFromUserText("这些资料全部可以公开"),{visibility:"public",contentUsage:"allowed",publicUsage:"public"});
assert.deepEqual(authorizationFromUserText("客户案例脱敏后可公开"),{visibility:"anonymized",contentUsage:"allowed_with_anonymization",publicUsage:"anonymized"});
assert.deepEqual(authorizationFromUserText("成本数据不能公开"),{visibility:"private",contentUsage:"forbidden",publicUsage:"private"});
assert.deepEqual(authorizationFromUserText("授权暂不确定"),{visibility:"unknown",contentUsage:"needs_review",publicUsage:"unknown"});

const normalized = normalizeGovernedFact({ id: "fact_1", factKey: "audience.pain_points", value: ["不知道如何开始"], visibility: "public", contentUsage: "approved", sourceType: "user_confirmed" });
assert.deepEqual(normalized.platformScope, ["xiaohongshu", "wechat"]);

const payload = { id: "facts_test", ...buildFactSnapshotPayload({ accountId: "account_fact_contract_test", facts: [{ ...normalized, factKey: normalized.key }] }) };
assert.equal(validateFactSnapshotV1(payload).valid, true);
assert.equal(payload.usableFacts.length, 1);

const authorizationPayload={id:"facts_authorization_test",...buildFactSnapshotPayload({accountId:"account_fact_authorization_test",facts:[
  {id:"fact_public",factKey:"evidence.public",value:"可直接发布的产品介绍",visibility:"public",contentUsage:"allowed",status:"user_asserted",sourceType:"user_confirmed"},
  {id:"fact_anonymized",factKey:"evidence.case",value:{summary:"客户案例",anonymizationRules:["移除客户名称"]},visibility:"anonymized",contentUsage:"allowed",status:"user_asserted",sourceType:"user_confirmed"},
  {id:"fact_private",factKey:"evidence.private",value:"内部成本",visibility:"private",contentUsage:"needs_review",status:"user_asserted",sourceType:"user_confirmed"},
  {id:"fact_unknown",factKey:"evidence.unknown",value:"授权状态待确认的数据",visibility:"unknown",contentUsage:"allowed",status:"user_asserted",sourceType:"user_confirmed"}
]})};
assert.equal(validateFactSnapshotV1(authorizationPayload).valid,true);
assert.deepEqual(authorizationPayload.usableFacts.map((fact)=>fact.id),["fact_public","fact_anonymized"]);
assert.equal(authorizationPayload.usableFacts[1].contentUsage,"allowed_with_anonymization");
assert.deepEqual(authorizationPayload.usableFacts[1].anonymizationRules,["移除客户名称"]);
assert.deepEqual(authorizationPayload.forbiddenFacts.map((fact)=>fact.id),["fact_private"]);
assert.deepEqual(authorizationPayload.contextOnlyFacts.map((fact)=>fact.id),["fact_unknown"]);

const legacyAuthorizationPayload={id:"facts_legacy_authorization",...buildFactSnapshotPayload({accountId:"account_legacy_authorization",facts:[
  {id:"legacy_public",factKey:"legacy.public",value:"历史公开事实",visibility:"publishable",contentUsage:"approved",status:"user_asserted",sourceType:"legacy"},
  {id:"legacy_anonymized",factKey:"legacy.anonymized",value:"历史脱敏事实",visibility:"anonymized",contentUsage:"allowed",status:"user_asserted",sourceType:"legacy"}
]})};
assert.equal(validateFactSnapshotV1(legacyAuthorizationPayload).valid,true,"历史授权值应通过兼容投影归一化，而不是改写历史记录");
assert.deepEqual(legacyAuthorizationPayload.usableFacts.map((fact)=>fact.contentUsage),["allowed","allowed_with_anonymization"]);

const stored = saveCurrentFactSnapshot("account_empty_fact_snapshot_test");
assert.equal(validateFactSnapshotV1(stored).valid, true);
assert.equal(getFactSnapshot(stored.id).contentHash, stored.contentHash);
assert.equal(saveCurrentFactSnapshot("account_empty_fact_snapshot_test").id, stored.id);

console.log(JSON.stringify({ status: "fact-governance-self-test passed", snapshotId: stored.id, impactClasses: ["content_only", "topic", "platform", "strategy", "risk"] }, null, 2));

