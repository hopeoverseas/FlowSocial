import assert from "node:assert/strict";
import { evaluateDiagnosticCompleteness } from "../../strategy-agent/diagnostic-engine.mjs";
import { createStrategyDraft, validateStrategyDraft } from "../../strategy-agent/strategy-engine.mjs";

const confirmed = (fieldPath, value) => ({ id: `claim_${fieldPath}`, fieldPath, value, status: "confirmed", confidence: 0.95 });
const claims = [
  confirmed("business.primaryOffers", "在线客服机器人、云呼叫中心、工单系统、智能外呼"),
  confirmed("business.businessModel", "SaaS服务商"),
  confirmed("audiences.primary", "零售、教育和金融行业客户"),
  confirmed("business.conversionPath", "内容触达 → 企业咨询 → 产品演示 → 商务合作"),
  confirmed("accountStrategy.primaryGoal", "宣传品牌并获取企业客户"),
  { fieldPath: "accountStrategy.contentResources", value: "未提及", status: "inferred", confidence: 0 },
  { fieldPath: "accountStrategy.constraints", value: "未知", status: "inferred", confidence: 0.2 }
];

const progress = evaluateDiagnosticCompleteness(claims);
assert.equal(progress.completeness, 70);
assert.equal(progress.confirmedCompleteness, 70);
assert.equal(progress.completedFieldCount, 5);
assert.equal(progress.readyToDraft, true);

const draft = createStrategyDraft({
  accountId: "account_other_company",
  claims,
  strategy: {
    accountStrategy: { platformRoles: { xiaohongshu: "品牌触达", wechat: "深度转化" } },
    missingInformation: ["客户案例"]
  }
});

assert.deepEqual(draft.business.primaryOffers, ["在线客服机器人", "云呼叫中心", "工单系统", "智能外呼"]);
assert.equal(draft.audiences[0].name, "零售、教育和金融行业客户");
assert.equal(draft.accountId, "account_other_company");
assert.equal(validateStrategyDraft(draft).valid, true);

console.log(JSON.stringify({ status: "passed", completeness: progress.completeness, offers: draft.business.primaryOffers.length, accountId: draft.accountId }));

