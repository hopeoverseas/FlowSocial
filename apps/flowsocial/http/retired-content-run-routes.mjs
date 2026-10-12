const REMOVED_CODE = "LEGACY_CONTENT_RUN_COMPATIBILITY_REMOVED";
const REMOVED_MESSAGE = "Legacy ContentRun compatibility has been removed; use the unified atomic content project APIs";

const exactRoutes = new Set([
  "POST /content-agent/workflows",
  "POST /content-agent/strategy-runs",
  "POST /content-tasks/generate"
]);

const routePatterns = [
  ["POST", /^\/content-agent\/publishing-cycles\/[^/]+\/slots\/[^/]+\/runs$/],
  ["POST", /^\/content-agent\/opportunities\/[^/]+\/runs$/],
  ["POST", /^\/content-agent\/rolling-plans\/[^/]+\/items\/[^/]+\/runs$/],
  ["GET", /^\/content-agent\/(?:workflows|runs)\/[^/]+$/],
  ["GET", /^\/content-agent\/(?:workflows|runs)\/[^/]+\/(?:execution-plan|trace)$/],
  ["POST", /^\/content-agent\/(?:workflows|runs)\/[^/]+\/source-selection$/],
  ["POST", /^\/content-agent\/(?:workflows|runs)\/[^/]+\/outline$/],
  ["PATCH", /^\/content-agent\/(?:workflows|runs)\/[^/]+\/outline$/],
  ["POST", /^\/content-agent\/(?:workflows|runs)\/[^/]+\/outline\/confirm$/],
  ["POST", /^\/content-revisions\/[^/]+\/start-upstream-run$/]
];

export function isRetiredContentRunRoute(method, path) {
  const normalizedMethod = String(method || "GET").toUpperCase();
  if (exactRoutes.has(`${normalizedMethod} ${path}`)) return true;
  return routePatterns.some(([candidateMethod, pattern]) => candidateMethod === normalizedMethod && pattern.test(path));
}

export function handleRetiredContentRunRoute({ req, res, path, sendJson }) {
  if (!isRetiredContentRunRoute(req.method, path)) return false;
  sendJson(res, 410, {
    error: REMOVED_MESSAGE,
    code: REMOVED_CODE,
    replacement: "/api/v1/content-agent/runs"
  });
  return true;
}

export const RETIRED_CONTENT_RUN_RESPONSE = Object.freeze({
  statusCode: 410,
  code: REMOVED_CODE,
  message: REMOVED_MESSAGE
});
