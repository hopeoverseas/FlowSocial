import { adoptTopicAdjustmentCandidate, continueTopicAdjustmentSession, startTopicAdjustmentSession } from "../content-agent/topic-adjustment-session.mjs";

function reply(sendJson, res, status, body) { sendJson(res, status, body); return true; }
function failure(sendJson, res, error, fallbackCode) {
  return reply(sendJson, res, error.statusCode || 400, { error: error.message, code: error.code || fallbackCode, details: error.details || null });
}

export async function handleTopicAdjustmentRoute({ req, res, path, store, bodyJson, sendJson, persistStore, generateText }) {
  const startMatch = path.match(/^\/content-agent\/publishing-cycles\/([^/]+)\/slots\/([^/]+)\/topic-adjustments$/);
  if (req.method === "POST" && startMatch) {
    try {
      const payload = await bodyJson(req);
      const session = startTopicAdjustmentSession(store, { cycleId: startMatch[1], slotId: startMatch[2], actor: payload.actor });
      await persistStore(store);
      return reply(sendJson, res, 201, session);
    } catch (error) { return failure(sendJson, res, error, "TOPIC_ADJUSTMENT_START_FAILED"); }
  }
  const messageMatch = path.match(/^\/content-agent\/topic-adjustments\/([^/]+)\/messages$/);
  if (req.method === "POST" && messageMatch) {
    try {
      const payload = await bodyJson(req);
      const result = await continueTopicAdjustmentSession(store, messageMatch[1], payload, {
        invokeModel: (request, fallback) => generateText(request, fallback)
      });
      await persistStore(store);
      return reply(sendJson, res, 200, result);
    } catch (error) { return failure(sendJson, res, error, "TOPIC_ADJUSTMENT_MESSAGE_FAILED"); }
  }
  const adoptMatch = path.match(/^\/content-agent\/topic-adjustments\/([^/]+)\/candidates\/([^/]+)\/adopt$/);
  if (req.method === "POST" && adoptMatch) {
    try {
      const payload = await bodyJson(req);
      const result = adoptTopicAdjustmentCandidate(store, adoptMatch[1], adoptMatch[2], payload);
      await persistStore(store);
      return reply(sendJson, res, 200, result);
    } catch (error) { return failure(sendJson, res, error, "TOPIC_ADJUSTMENT_ADOPT_FAILED"); }
  }
  return false;
}
