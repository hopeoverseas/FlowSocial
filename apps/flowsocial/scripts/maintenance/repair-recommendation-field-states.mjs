import { database } from "../../storage.mjs";
import { getAgentRecommendation, getDiagnosticSession, listDiagnosticFieldStates, listDiagnosticQuestions, upsertDiagnosticFieldState } from "../../strategy-agent/strategy-store.mjs";

const sessions = database.prepare("SELECT id FROM diagnostic_sessions").all();
let repaired = 0;

for (const { id: sessionId } of sessions) {
  if (!getDiagnosticSession(sessionId)) continue;
  const questions = new Map(listDiagnosticQuestions(sessionId).map((item) => [item.id, item]));
  for (const state of listDiagnosticFieldStates(sessionId)) {
    const recommendationId = state.metadata?.recommendationId;
    if (state.state !== "recommendation_pending" || !recommendationId) continue;
    const recommendation = getAgentRecommendation(recommendationId);
    if (!recommendation || recommendation.status === "pending_confirmation" || recommendation.targetFieldPath === state.fieldPath) continue;
    const question = questions.get(state.lastQuestionId);
    upsertDiagnosticFieldState({ sessionId, fieldPath: state.fieldPath, state: question?.targetFieldPaths?.includes(state.fieldPath) ? "asked" : "unasked", attempts: state.attempts, lastQuestionId: state.lastQuestionId, metadata: {} });
    repaired += 1;
  }
}

console.log(JSON.stringify({ status: "passed", repaired }, null, 2));

