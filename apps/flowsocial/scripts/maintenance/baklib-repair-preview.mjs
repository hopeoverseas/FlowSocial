import { getDiagnosticSession, getLatestOpenDiagnosticSession, listCurrentProfileClaims, listDiagnosticTurns } from "../../strategy-agent/strategy-store.mjs";
import { buildSessionRepairPreview } from "../../strategy-agent/session-repair.mjs";

const target = process.argv[2] || "diag_aeea227f-d0e";
const session = target.startsWith("diag_")
  ? getDiagnosticSession(target)
  : getLatestOpenDiagnosticSession(target);
if (!session) throw new Error(`No diagnostic session found for ${target}`);
console.log(JSON.stringify(buildSessionRepairPreview({ session, turns: listDiagnosticTurns(session.id), claims: listCurrentProfileClaims(session.id) }), null, 2));

