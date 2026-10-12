# ViralContentAnalysis@1.0

```json
{
  "schemaVersion": "1.0",
  "kind": "ViralContentAnalysis",
  "mode": "single_post | batch_compare",
  "status": "candidate",
  "scope": {
    "workspaceId": "string",
    "companyId": "string",
    "socialAccountId": "string|null"
  },
  "sourceReferenceIds": ["reference_id"],
  "sampleAssessment": {
    "level": "verified_high_performer | high_quality_reference | unknown",
    "basis": ["observed reason"],
    "comparability": "high | medium | low | unknown",
    "missingEvidence": ["missing field"]
  },
  "observations": {
    "audienceNeed": ["observed need"],
    "titleAndCover": ["observed mechanism"],
    "opening": ["observed mechanism"],
    "informationPath": ["ordered role"],
    "evidenceMechanism": ["observed evidence type"],
    "visualRoles": ["observed visual role"],
    "interactionAndConversion": ["observed mechanism"]
  },
  "accountInfluence": {
    "observedAccountAssets": ["existing trust or distribution asset"],
    "possibleConfounders": ["account size, author identity, distribution or timing"],
    "targetAccountFit": "high | medium | low | unknown",
    "fitReason": ["reason"]
  },
  "platformAnalysis": {},
  "successHypotheses": [
    {
      "hypothesis": "mechanism that may have helped",
      "evidenceRefs": ["reference_id"],
      "confidence": "low | medium",
      "alternativeExplanations": ["account size, timing, distribution, paid traffic, or other unknown"]
    }
  ],
  "reusableElements": ["abstract mechanism"],
  "nonTransferableElements": ["source-specific asset"],
  "factRisks": ["claim that needs user-owned evidence"],
  "doNotCopy": ["wording, case, image, identity, layout, or other protected element"],
  "blueprintCandidate": {
    "kind": "ContentPatternBlueprint",
    "schemaVersion": "1.0",
    "lifecycle": "candidate",
    "productionReady": false,
    "platform": "xiaohongshu | wechat | douyin | other",
    "contentArchetype": "checklist | case | opinion | tutorial | story | review | other",
    "creativeMechanism": "problem_solution | emotional_resonance | counterintuitive_view | proof_transformation | identity_projection | hotspot_deep_analysis | checklist_tutorial | story | other",
    "applicableFunctions": ["discovery | authority | proof | solution | action"],
    "suitableAudiences": ["audience"],
    "suitableTopics": ["topic"],
    "titleMechanisms": ["mechanism"],
    "openingMechanism": "mechanism",
    "structureRules": ["ordered abstract role"],
    "evidenceRequirements": ["required user-owned evidence"],
    "visualRoles": ["abstract visual role"],
    "platformMechanics": {},
    "applicableSubjectTypes": ["company_official | founder | employee_expert | personal_ip | traffic_publisher | institution_service"],
    "applicableAccountModes": ["brand_operation | lead_generation | professional_ip | traffic_monetization | service_information"],
    "applicableMatrixRoles": ["discovery | authority | trust | proof | solution | action"],
    "interactionMechanism": "mechanism",
    "prohibitedUses": ["prohibited use"],
    "sourceReferenceIds": ["reference_id"],
    "sampleCount": 1,
    "confidence": "low | medium | high",
    "confidenceScore": 0,
    "clusterId": "pattern_cluster_id|null",
    "patternFamilyId": "pattern_family_id|null",
    "patternFingerprint": "deterministic mechanism fingerprint"
  },
  "strategyInsightCandidates": [],
  "reviewPolicy": {
    "requiresHumanApproval": true,
    "autoApplyToStrategy": false,
    "autoUseForGeneration": false
  }
}
```

Rules:

- `observations` contain only directly visible evidence.
- `successHypotheses` contain interpretations and alternative explanations.
- A single-post candidate has `confidence: low` unless external comparative evidence is provided.
- `high` requires a comparable batch and must not be emitted from one post.
- `patternFingerprint` describes abstract mechanics only; it must not hash or retain source wording.
- `patternFamilyId` and `clusterId` may remain null during single-post analysis. The version service assigns them after clustering and human review.
- The blueprint contains mechanics only. It must not contain source facts, full phrases, names, cases, or raw screenshots.
- `creativeMechanism` is a传播结构，不是内容目的或内容职能。
- For Xiaohongshu, `platformAnalysis` should cover title-cover promise, first-screen entry, page/card sequence, visual roles, save mechanism, and interaction/CTA.
- For WeChat, `platformAnalysis` should cover title promise, opening scene, continuous argument chain, evidence placement, emotional curve, share reason, follow reason, and relationship/conversion handoff.
- `strategyInsightCandidates` use `scope: content_only` by default and remain read-only.
