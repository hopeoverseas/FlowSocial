import assert from "node:assert/strict";
import { optimizeFinalTitles } from "../../content-agent/title-atom.mjs";

const master = {
  central_thesis: "稳定的内容系统比追逐临时灵感更重要",
  confirmed_facts: [{ fact_id: "F1", fact: "团队已有三个月发布记录", source_ids: ["K1"] }]
};
const xhsPackage = {
  post_copy: {
    title_candidates: ["企业内容为什么总在断更", "别再依赖临时灵感做内容"],
    recommended_title: "企业内容为什么总在断更",
    opening: "很多团队不是没有工具，而是没有稳定系统。",
    body_sections: [{ heading: "问题", content: "正文保持锁定。" }]
  },
  deck: { pages: [] }
};

let receivedInput;
const validResult = await optimizeFinalTitles({
  platform: "xiaohongshu",
  contentMaster: master,
  contentPackage: xhsPackage,
  contentTaskBrief: { targetAudience: "企业内容负责人" },
  sameAccountTitleSignals: [{ id: "signal_1", label: "方法清单", relation: "historical_correlation" }]
}, {
  generateText: async (request) => {
    receivedInput = request.input;
    return {
      mode: "test",
      data: {
        status: "success",
        data: {
          stage: "final_after_body",
          platform: "xiaohongshu",
          title_brief: { content_type: "方法论", target_reader: "企业内容负责人" },
          candidates: [
            { title_id: "T01", title: "重磅！企业内容最强解法来了", motivation: "spread", claim_ids: ["F1"], scores: { overall: 5 }, risk: "high", risk_reasons: ["无依据极值"] },
            { title_id: "T02", title: "企业内容总断更，缺的不是灵感而是系统", motivation: "balanced", claim_ids: ["F1"], scores: { overall: 4.8 }, risk: "low", risk_reasons: [] },
            { title_id: "T03", title: "企业内容系统：从临时选题到稳定发布", motivation: "search", claim_ids: ["F1"], scores: { overall: 4.5 }, risk: "low", risk_reasons: [] },
            { title_id: "T04", title: "内容运营如何摆脱临时灵感", motivation: "evergreen", claim_ids: ["F1"], scores: { overall: 4.2 }, risk: "low", risk_reasons: [] },
            { title_id: "T05", title: "一个稳定内容系统，应该先解决哪三个问题", motivation: "experiment", claim_ids: ["F1"], scores: { overall: 4.1 }, risk: "medium", risk_reasons: [] }
          ],
          recommendations: { balanced: "T01", safe: "T02", spread: "T01", search: "T03", experiment: "T05" },
          ab_tests: [],
          same_account_signal_usage: { used: true, signal_ids: ["signal_1"], interpretation: "同账号历史相关性" }
        }
      }
    };
  }
});

assert.equal(receivedInput.stage, "final_after_body");
assert.equal(receivedInput.completed_content.post_copy.body_sections[0].content, "正文保持锁定。");
assert.equal(receivedInput.same_account_title_signals[0].relation, "historical_correlation");
assert.equal(validResult.contentPackage.post_copy.recommended_title, "企业内容总断更，缺的不是灵感而是系统", "high-risk recommendation must be rejected");
assert.equal(validResult.contentPackage.post_copy.title_candidates.includes("重磅！企业内容最强解法来了"), false);
assert.deepEqual(validResult.contentPackage.post_copy.body_sections, xhsPackage.post_copy.body_sections, "title atom must not change body");
assert.equal(validResult.checks.every((item) => item.result === "pass"), true);

const invalidClaims = await optimizeFinalTitles({
  platform: "xiaohongshu",
  contentMaster: master,
  contentPackage: xhsPackage
}, {
  generateText: async () => ({
    mode: "test",
    data: {
      status: "success",
      data: {
        candidates: [{ title_id: "T01", title: "虚构数据标题", claim_ids: ["UNKNOWN"], risk: "low" }],
        recommendations: { balanced: "T01" }
      }
    }
  })
});

assert.equal(invalidClaims.contentPackage.post_copy.recommended_title, xhsPackage.post_copy.recommended_title, "untraceable title must not overwrite current title");
assert.equal(invalidClaims.checks.find((item) => item.check === "final_title_claims_traceable").result, "fail");

console.log(JSON.stringify({
  status: "content-title-atom-self-test passed",
  selected: validResult.titleStrategy.selected_title,
  highRiskRejected: true,
  bodyLocked: true,
  unknownClaimBlocked: true
}, null, 2));

