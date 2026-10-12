const activeQuestionStatuses = new Set(["pending", "assisting", "recommendation_pending"]);

function questionFingerprint(question) {
  if (!question) return null;
  if (question.fingerprint) return question.fingerprint;
  const fields = [...(question.targetFieldPaths || [])].sort().join(",") || "none";
  const slots = [...(question.targetSlotIds || [])].sort().join(",") || "field";
  return `${fields}:${slots}`;
}

export function resolveStrategyNextAction({ readiness, draftRevision = null, strategyDecision = null } = {}) {
  if (!readiness?.canGenerateMinimumDraft) return { type: "continue_strategy_diagnosis", target: "agent", label: "继续完成业务诊断" };
  if (!strategyDecision?.ready) return { type: "confirm_strategy_decisions", target: "agent", label: "确认账号与增长打法" };
  if (!draftRevision) return { type: "generate_strategy_draft", target: "agent", label: "生成策略草案" };
  if (draftRevision.stale) return { type: "regenerate_strategy_draft", target: "agent", label: "重新生成策略草案" };
  if (readiness?.canActivate) return { type: "activate_strategy_draft", target: "agent", label: "确认并激活策略" };
  return { type: "resolve_strategy_blockers", target: "agent", label: "处理策略阻断项" };
}

export function buildStrategySessionState({ session, sessionMeta = null, readiness, questions = [], pendingQuestion = null, pendingRecommendation = null, draftRevision = null, strategyDecision = null, activeStrategy = null } = {}) {
  if (!session?.id || !readiness) throw new Error("session and readiness are required");
  const ledger = questions.map((question) => ({
    id: question.id,
    fingerprint: questionFingerprint(question),
    status: question.status,
    targetFieldPaths: question.targetFieldPaths || [],
    targetSlotIds: question.targetSlotIds || [],
    attempt: question.attempt || 1,
    askedAt: question.createdAt,
    closedAt: question.answeredAt || null
  }));
  const activeQuestions = ledger.filter((item) => activeQuestionStatuses.has(item.status));
  // A caller may provide either evaluated decision readiness or the raw
  // persisted record. Only an evaluated value with an explicit `ready` flag
  // can override the readiness projection; raw records still need validation.
  const normalizedDecision = typeof strategyDecision?.ready === "boolean"
    ? strategyDecision
    : readiness.strategyDecision || strategyDecision;
  const activeFromThisSession = Boolean(activeStrategy?.sourceSessionId === session.id || activeStrategy?.source_session_id === session.id);
  const phase = activeFromThisSession && sessionMeta?.conversationPhase === "strategy_active"
    ? "strategy_active"
    : draftRevision
      ? readiness.canActivate ? "draft_ready_to_activate" : "draft_needs_revision"
      : readiness.canGenerateMinimumDraft
        ? normalizedDecision?.ready ? "strategy_decision_confirmed" : "strategy_decision_required"
        : "core_diagnosis";
  const editingNextAction = activeFromThisSession && sessionMeta?.conversationPhase === "strategy_active"
    ? { type: "open_content_planning", target: "plan", label: "进入内容计划" }
    : resolveStrategyNextAction({ readiness, draftRevision, strategyDecision: normalizedDecision });
  const activeStrategyTrack = {
    exists: Boolean(activeStrategy),
    status: activeStrategy ? "active" : "missing",
    snapshotId: activeStrategy?.id || null,
    version: activeStrategy?.version || null,
    sourceSessionId: activeStrategy?.sourceSessionId || activeStrategy?.source_session_id || null,
    contentPlanningAction: activeStrategy ? { type: "open_content_planning", target: "plan", label: "使用当前生效策略进入内容计划" } : null
  };
  const editingSessionTrack = {
    sessionId: session.id,
    status: phase === "strategy_active" ? "activated" : "editing",
    phase,
    readiness: {
      processed: readiness.core?.processed ?? readiness.processedCount ?? 0,
      total: readiness.core?.total ?? readiness.totalCount ?? 9,
      canGenerateDraft: Boolean(readiness.canGenerateDraft),
      canActivate: Boolean(readiness.canActivate)
    },
    blockers: readiness.blockingItems || readiness.blockingIssues || [],
    nextAction: editingNextAction
  };
  return {
    schemaVersion: "1.1",
    kind: "StrategySessionState",
    sessionId: session.id,
    companyId: session.accountId,
    phase,
    activeStrategyTrack,
    editingSessionTrack,
    conversationPhase: sessionMeta?.conversationPhase || phase,
    currentTarget: pendingQuestion ? {
      questionId: pendingQuestion.id,
      fingerprint: questionFingerprint(pendingQuestion),
      fieldPaths: pendingQuestion.targetFieldPaths || [],
      slotIds: pendingQuestion.targetSlotIds || []
    } : null,
    readiness,
    questionLedger: {
      total: ledger.length,
      activeCount: activeQuestions.length,
      invariantValid: activeQuestions.length <= 1,
      items: ledger
    },
    pendingRecommendationId: pendingRecommendation?.id || null,
    revisions: {
      claim: sessionMeta?.claimRevision || 0,
      fact: sessionMeta?.factRevision || 0,
      draft: draftRevision?.revision || draftRevision?.id || null,
      strategyDecision: strategyDecision?.revision || null,
      activeStrategy: activeStrategy?.id || null
    },
    blockers: readiness.blockingItems || readiness.blockingIssues || [],
    warnings: readiness.qualityWarnings || readiness.warnings || [],
    availableActions: readiness.availableActions || {},
    // Compatibility projection for existing clients. It follows the editing
    // session; active content planning remains available on activeStrategyTrack.
    nextAction: editingNextAction
  };
}
