function respond(sendJson, res, status, body) {
  sendJson(res, status, body);
  return true;
}

export async function handleSystemRoute({ req, res, path, store, sendJson, runtime }) {
  if (req.method !== "GET" || path !== "/health") return false;

  const currentBuildId = await runtime.sourceSignature();
  const flags = runtime.resolveFeatureFlags();
  return respond(sendJson, res, 200, {
    status: "ok",
    service: "flowsocial",
    version: "0.1.0",
    buildId: runtime.loadedBuildId,
    currentSourceBuildId: currentBuildId,
    restartRequired: currentBuildId !== runtime.loadedBuildId,
    processId: runtime.processId,
    serverStartedAt: runtime.serverStartedAt,
    runtimeMode: "live",
    productMode: runtime.productMode,
    storage: runtime.getStorageStatus(),
    workspaceData: {
      status: Array.isArray(store.accounts) && store.accounts.length > 0 && Array.isArray(store.contentDirections) && Array.isArray(store.contentTasks) ? "ready" : "incomplete",
      counts: {
        accounts: Array.isArray(store.accounts) ? store.accounts.length : 0,
        contentDirections: Array.isArray(store.contentDirections) ? store.contentDirections.length : 0,
        contentTasks: Array.isArray(store.contentTasks) ? store.contentTasks.length : 0,
        planningAttempts: Array.isArray(store.unifiedContentPlanningAttemptReceipts) ? store.unifiedContentPlanningAttemptReceipts.length : 0
      },
      missing: [
        ["accounts", store.accounts],
        ["contentDirections", store.contentDirections],
        ["contentTasks", store.contentTasks]
      ].filter(([key, value]) => !Array.isArray(value) || (key === "accounts" && value.length === 0)).map(([key]) => key)
    },
    providers: runtime.providerStatus(),
    skillRuntime: runtime.getSkillRuntimeStatus(),
    featureFlags: flags,
    productCapabilityPolicy: runtime.buildProductCapabilityPolicyReport(flags),
    xhsRuntimeReadiness: runtime.xhsRuntimeReadiness(),
    unifiedContentReadiness: runtime.unifiedContentReadiness(),
    serverTime: runtime.now()
  });
}
