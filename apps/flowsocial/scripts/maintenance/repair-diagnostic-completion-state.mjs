import { database } from "../../storage.mjs";
import { resolveDiagnosticState } from "../../strategy-agent/diagnostic-state-resolver.mjs";
import { getDiagnosticSessionMeta, listCurrentProfileClaims, listDiagnosticFieldStates, updateDiagnosticSessionMeta } from "../../strategy-agent/strategy-store.mjs";

const sessions = database.prepare("SELECT id FROM diagnostic_sessions ORDER BY created_at").all();
let repaired = 0;
for (const { id } of sessions) {
  const meta = getDiagnosticSessionMeta(id);
  if (!meta) continue;
  const state = resolveDiagnosticState(listCurrentProfileClaims(id), listDiagnosticFieldStates(id));
  const prematurelyComplete = ["core_complete", "enrichment"].includes(meta.conversationPhase) && !state.coreComplete;
  if (!prematurelyComplete) continue;
  updateDiagnosticSessionMeta(id, { conversationPhase: "core_diagnosis", completionAnnouncedAt: null });
  repaired += 1;
}
console.log(JSON.stringify({ scanned: sessions.length, repaired }, null, 2));

