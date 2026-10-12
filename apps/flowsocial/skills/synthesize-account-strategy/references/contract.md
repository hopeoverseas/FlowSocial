# StrategyDocument@2.0

```json
{
  "schemaVersion": "2.0",
  "accountId": "",
  "business": {
    "businessModel": "",
    "valueProposition": "",
    "offers": [{
      "id": "",
      "name": "",
      "category": "service | product | solution | other",
      "problemsSolved": [],
      "applicableScenarios": [],
      "targetAudienceIds": [],
      "valuePoints": [],
      "proofRequirements": [],
      "publicClaims": [],
      "forbiddenClaims": []
    }]
  },
  "strategy": {
    "diagnosis": {
      "currentSituation": "",
      "coreOpportunity": "",
      "primaryConstraint": "",
      "strategicChoice": "",
      "deprioritizedDirections": [],
      "reasoning": []
    },
    "growthStage": "exploration | account_setup | content_market_fit | growth | monetization | scaling",
    "operatingMode": "guided | learning | experiment | growth | conversion",
    "objectives": [{
      "id": "",
      "type": "reach | authority | demand_generation | product_education | lead_capture | conversion",
      "label": "",
      "priority": 1,
      "weight": 100,
      "timeHorizon": "90_days",
      "successSignals": []
    }],
    "primaryObjectiveId": "",
    "positioning": {
      "category": "",
      "positioningStatement": "",
      "differentiators": [],
      "competitorAlternatives": [],
      "notFor": []
    },
    "audiences": [{
      "id": "",
      "name": "",
      "priority": 1,
      "industries": [],
      "companyStages": [],
      "decisionRoles": [],
      "influencerRoles": [],
      "jobsToBeDone": [],
      "painPoints": [],
      "buyingTriggers": [],
      "commonObjections": [],
      "awarenessStage": "unknown",
      "preferredLanguage": [],
      "contentNeeds": [],
      "conversionBarriers": []
    }],
    "messageArchitecture": {
      "coreMessage": "",
      "supportingMessages": [],
      "misconceptionsToCorrect": [],
      "phrasesToUse": [],
      "phrasesToAvoid": []
    },
    "contentSystem": {
      "pillars": [{
        "id": "",
        "name": "",
        "strategicPurpose": "",
        "objectiveIds": [],
        "audienceIds": [],
        "messageIds": [],
        "typicalProblems": [],
        "recommendedContentFunctions": [],
        "preferredSourceTypes": [],
        "evidenceRequirement": "low | medium | high",
        "weight": 0,
        "excludedAngles": []
      }],
      "portfolio": {
        "discovery": 0,
        "authority": 0,
        "proof": 0,
        "solution": 0,
        "action": 0
      }
    },
    "platformPlaybooks": {
      "xiaohongshu": { "role": "", "priorityAudienceIds": [], "objectivePriorities": [], "toneDefaults": [], "promotionDefault": "soft", "constraints": [] },
      "wechat": { "role": "", "priorityAudienceIds": [], "objectivePriorities": [], "toneDefaults": [], "promotionDefault": "soft", "constraints": [] }
    },
    "conversionSystem": {
      "primaryPath": { "id": "", "steps": [] },
      "platformPaths": {},
      "ctaOptions": [],
      "leadQualification": [],
      "forbiddenConversionMethods": []
    },
    "evidencePolicy": { "defaultVisibility": "internal_only", "knowledgeFolderIds": [], "claimRules": [], "casePolicy": {} },
    "riskPolicy": { "forbiddenClaims": [], "sensitiveTopics": [], "legalChecks": [], "mandatoryDisclosures": [] },
    "operatingPolicy": {},
    "measurement": {}
  },
  "strategyExtensions": {
    "schemaVersion": "1.0",
    "role": "long_term_account_guidance",
    "reviewHorizonDays": 90,
    "contentFunctionPolicy": {
      "reviewWindowDays": 30,
      "functions": {
        "discovery": {"target": 0, "min": 0, "max": 0, "rationale": ""},
        "authority": {"target": 0, "min": 0, "max": 0, "rationale": ""},
        "proof": {"target": 0, "min": 0, "max": 0, "rationale": ""},
        "solution": {"target": 0, "min": 0, "max": 0, "rationale": ""},
        "action": {"target": 0, "min": 0, "max": 0, "rationale": ""}
      },
      "adjustmentRule": ""
    },
    "purposeEligibilityPolicy": {},
    "conversionLadder": {"stages": [], "fullBusinessPath": [], "selectionRule": ""},
    "operatingEnvelope": {"planningWindowDays": 30, "capacitySignals": [], "rule": ""},
    "knowledgeEvidencePlan": {"mode": "targeted_retrieval", "queries": [], "retrievalStatus": "", "retrievedEvidence": [], "usageRules": []},
    "accountPortfolio": {
      "mode": "single_account | role_matrix",
      "confidence": 0.0,
      "rationale": [],
      "risks": [],
      "accounts": []
    },
    "accountGrowthStrategies": [{
      "socialAccountId": "",
      "platform": "xiaohongshu | wechat",
      "accountIdentity": {},
      "matrixRole": "",
      "selectedPlaybookId": "",
      "growthMode": "steady_vertical | hotspot_experiment | hybrid_bridge | relationship_ip | search_asset | stable_operation",
      "contentFunctionTargets": {},
      "hotspotPolicy": {"allowedTiers": [], "maxShare": 0.0, "unrelatedAllowed": false, "autoDeleteHistoricalContent": false},
      "experimentPlan": {"windowDays": 14, "hypothesis": "", "primarySignals": [], "exitConditions": [], "status": "proposed"}
    }],
    "selectedGrowthPlaybooks": [],
    "hotspotPolicy": {"accountPolicies": [], "globalRules": []},
    "experimentPlans": [],
    "platformInfrastructure": [],
    "decisionProvenance": {"sourcePriority": [], "sourceCounts": {}}
  },
  "governance": {
    "confirmedClaimIds": [],
    "strategyFactIds": [],
    "knowledgeSourceIds": [],
    "hypotheses": [],
    "conflicts": [],
    "missingInformation": [],
    "sourceContextHash": ""
  }
}
```

硬性要求：

- `business.offers`、`strategy.audiences`、`strategy.contentSystem.pillars` 均不得为空。
- `contentSystem.portfolio` 五项必须为非负数且总和为100。
- `primaryObjectiveId` 必须引用 `objectives` 中存在的 ID。
- 两个平台 Playbook 必须同时存在。
- 用户确认事实与策略推断必须分开。
- `strategyExtensions` 是向后兼容扩展；不得删除或改变既有 `strategy` 字段语义。
- 内容职能区间必须解释账号阶段、业务目标和证据准备度的影响。
- 知识检索结果不得覆盖本轮对话确认，只能补证、形成缺口或待确认冲突。
- `conversionLadder` 面向长期内容决策，不得生成具体单篇CTA或发文日历。
- `accountPortfolio` 必须明确单账号或角色协同矩阵；不得生成重复铺量矩阵。
- `accountGrowthStrategies` 必须引用上游方法库选择，热点实验必须有观察窗口和退出条件。
- 完全无关热点和自动删除历史内容必须保持关闭。
