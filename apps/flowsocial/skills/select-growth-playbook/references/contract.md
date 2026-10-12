# GrowthPlaybookSelection@1.0

```json
{
  "schemaVersion": "1.0",
  "portfolioDecision": {
    "mode": "single_account | role_matrix",
    "primarySocialAccountId": "",
    "selectedSocialAccountIds": [],
    "accountRoles": {},
    "confidence": 0.0,
    "rationale": [],
    "risks": [],
    "accounts": [{
      "socialAccountId": "",
      "name": "",
      "platform": "xiaohongshu | wechat",
      "subjectType": "company_official | founder_ip | employee_expert | personal_creator | product_vertical | institution_service",
      "matrixRole": ""
    }]
  },
  "accountStrategies": [{
    "socialAccountId": "",
    "platform": "xiaohongshu | wechat",
    "accountIdentity": {"subjectType": "", "publicIdentity": "", "speaker": null, "trustSources": []},
    "matrixRole": "",
    "selectedPlaybookId": "",
    "growthMode": "steady_vertical | hotspot_experiment | hybrid_bridge | relationship_ip | search_asset | stable_operation",
    "candidatePlaybooks": [{"playbookId": "", "playbookVersion": "", "name": "", "rank": 1, "isRecommended": true, "score": 0, "rationale": [], "recommendationReasons": [], "platformMechanism": [], "resourceRequirements": [], "recommendedCadence": {"items": 0, "windowDays": 0}, "risks": [], "experimentPlan": {"windowDays": 14, "exitConditions": []}}],
    "contentFunctionTargets": {"discovery": 0, "authority": 0, "proof": 0, "solution": 0, "action": 0},
    "hotspotPolicy": {"allowedTiers": [], "maxShare": 0.0, "unrelatedAllowed": false, "autoDeleteHistoricalContent": false},
    "experimentPlan": {"windowDays": 14, "hypothesis": "", "primarySignals": [], "exitConditions": [], "status": "proposed"}
  }],
  "selectedGrowthPlaybooks": [{"socialAccountId": "", "playbookId": "", "playbookVersion": "", "growthMode": ""}],
  "unresolvedDecisions": [],
  "source": "llm_with_playbook_guardrails"
}
```

硬性规则：

- 所有 `selectedPlaybookId` 必须来自输入候选方法卡。
- 每个账号最多返回三个候选方法。
- `unrelatedAllowed` 和 `autoDeleteHistoricalContent` 必须为 `false`。
- 热点实验必须有观察窗口、主要信号和退出条件。
- 矩阵推荐必须说明不同账号的角色，不能只按数量判断。
- `single_account` 的 `selectedSocialAccountIds` 必须且只能包含主账号；`role_matrix` 可以包含多个账号，但每个账号必须有明确且不同的角色分工。
- 每个平台账号必须有推荐打法和至少一个平台内备选打法；候选项必须包含推荐理由、平台机制、资源要求、观察窗口和退出条件。
- 执行投影必须保留 `socialAccountId`、`strategySnapshotId`、`strategyVersion`、`playbookId`、`playbookVersion` 和 `experimentId`。
- 缺少组合字段的历史策略按 `legacy_single_account` 兼容读取，不原地改写历史记录。
