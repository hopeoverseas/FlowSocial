# DiagnosticTurnResult@3.0

```json
{
  "intent": "direct_answer",
  "intentConfidence": 0.95,
  "coreClaimOperations": [{
    "operation": "create | append | refine | replace | correct | confirm | reject",
    "fieldPath": "business.primaryOffers",
    "value": null,
    "type": "fact | user_preference | agent_hypothesis",
    "sourceType": "user_statement | uploaded_file | agent_inference",
    "sourceRef": "turn_id_or_file_id",
    "confidence": 0.0,
    "status": "confirmed | inferred | conflicting | rejected"
  }],
  "discoveredFactOperations": [],
  "answerAssessment": {
    "status": "answered | partially_answered | ambiguous | not_answered | correction",
    "answeredFieldPaths": [],
    "remainingGaps": []
  },
  "targetAssessment": {
    "targetType": "core_field | dynamic_fact",
    "targetId": "business.primaryOffers",
    "capturedSlots": [{"slot":"offerNames","value":[],"confidence":0.9,"source":"user_statement"}],
    "missingRequiredSlots": [],
    "missingOptionalSlots": [],
    "status": "partial | sufficient | confirmed | skipped | not_applicable",
    "strategyReady": false,
    "contentReady": false,
    "followUpNeeded": true,
    "followUpQuestion": ""
  },
  "conflicts": [{
    "fieldPath": "",
    "description": "",
    "claimIds": []
  }],
  "missingCriticalFields": [],
  "acknowledgement": "",
  "nextQuestionRecommendation": "",
  "questionGoal": "",
  "stopReason": ""
}
```

Use confidence from 0 to 1. `confirmed` requires explicit user or verified-file support. `capturedSlots` must contain only information actually present in this turn or prior coverage. Never remove previously captured slots unless the user corrects them. Keep `followUpQuestion` empty only when the target is sufficient, skipped, or not applicable.
