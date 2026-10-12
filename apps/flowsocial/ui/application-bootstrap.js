refreshRuntimeStatus();
setHotspotPool("global", false);
setGenerationMode(currentGenerationMode);
updateKnowledgeControls(false);
updatePreview(currentPlatform);
const initialParams = new URLSearchParams(location.search);
const requestedInitialView = initialParams.get("view") || (initialParams.get("contentRunId") || initialParams.get("contentWorkflowId") ? "runs" : "today");
const resolvedInitialView = viewMeta[requestedInitialView] || viewAliases[requestedInitialView] ? requestedInitialView : "today";
loadGenerationAccounts().then(() => {
  switchView(resolvedInitialView);
  const planNavigationHydration = resolvedInitialView === "plan" ? Promise.resolve() : loadV2Plan();
  return Promise.all([initializeUnifiedArtifactReviewWorkbench(), planNavigationHydration]);
});
loadGenerationKnowledgeAssets();
loadDeepLinkedContentTask();
loadStrategyHotspotDeepLink();
