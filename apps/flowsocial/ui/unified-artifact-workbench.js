// UNIFIED_ARTIFACT_REVIEW_WORKBENCH_START
const unifiedArtifactWorkbench = {
  enabled: false,
  xhsIntegratedPageDesignEnabled: false,
  entryOptions: [],
  selectedEntryOptionId: "",
  bootstrap: null,
  bootstrapRequest: null,
  bootstrapBusy: false,
  outlineConfirmations: {},
  platformProductionStatus: {},
  wechatPreupload: null,
  wechatAutoPreuploadRequested: false,
  productionNotice: "",
  productionControl: null,
  promptCostPreview: null,
  promptCostApprovalRequest: null,
  revisionRequestDraft: null,
  revisionExecutionDraft: null,
  productionControlBusy: false,
  studioMode: "projects",
  studioTab: "overview",
  studioSearch: "",
  platformScope: "",
  projects: [],
  project: null,
  platform: "",
  candidateId: "",
  candidateLoadGeneration: 0,
  projectLoadState: "idle",
  activeScopeToken: "",
  productionEditorVersionKey: "",
  productionEditorBaseline: "",
  artifactReview: null,
  reviewState: null,
  xhsProductionState: null,
  xhsGenerationDraft: null,
  xhsLightRevisionState: null,
  xhsLightPlan: null,
  xhsLightApproval: null,
  xhsLightPollingExecutionId: null,
  xhsLightPollTimer: null,
  wechatHumanSelectionEnabled: false,
  wechatUploadEnabled: false,
  wechatPendingRequests: {},
  wechatDeliveryState: null,
  wechatDeliveryStatus: "unknown",
  wechatUploadPreview: null,
  wechatUploadPlan: null,
  wechatUploadExecution: null,
  wechatUploadUncertain: "",
  wechatDraftEnabled: false,
  wechatDraftState: null,
  wechatDraftStatus: "unknown",
  wechatDraftPreview: null,
  wechatDraftExecution: null,
  wechatDraftUncertain: "",
  promotionEnabled: false,
  promotionPreview: null,
  promotionIdempotencyKey: "",
  promotionResult: null,
  promotionConfirmUncertain: "",
  promotionHistoryStatus: "unknown",
  promotionResetReason: "等待当前 UserSelection",
  publicationResult: null,
  publicationHistoryStatus: "unknown",
  atomicPublicationCutoverEnabled: false,
  publicationToolsEnabled: false,
  publicationControlState: null,
  publicationPreview: null,
  feedbackPreview: null,
  feedbackIdempotencyKey: "",
  publicationIdempotencyKey: "",
  publicationConfirmUncertain: "",
  feedbackConfirmUncertain: ""
};

function unifiedProjectId(project) {
  return project?.contentProject?.id || project?.projectId || project?.id || "";
}

function unifiedProjectList(result) {
  if (Array.isArray(result)) return result;
  return result?.items || result?.projects || result?.snapshots || [];
}

function unifiedProjectListScope() {
  const account = v2AccountRecord() || accountsCache[0] || null;
  // The production home is company-scoped and separates platforms in its own
  // UI. Filtering here by whichever account happens to be active hides valid
  // standalone projects from the other platform.
  return account ? { companyId: account.companyId || "" } : {};
}

function unifiedCurrentScopeToken({ projectId = unifiedProjectId(unifiedArtifactWorkbench.project), platform = unifiedArtifactWorkbench.platform, candidateId = unifiedArtifactWorkbench.candidateId, generation = unifiedArtifactWorkbench.candidateLoadGeneration } = {}) {
  return [projectId || "", platform || "", candidateId || "", Number(generation || 0)].join("::");
}

function clearUnifiedProductionEditor() {
  unifiedArtifactWorkbench.productionControl = null;
  unifiedArtifactWorkbench.productionEditorVersionKey = "";
  unifiedArtifactWorkbench.productionEditorBaseline = "";
  for (const id of ["unifiedProductionRevisionPayload", "unifiedProductionCopyTitle", "unifiedProductionCopyAbstract", "unifiedProductionCopyOpening", "unifiedProductionCopyArticle", "unifiedProductionCopyCta", "unifiedProductionRevisionInstruction"]) {
    const field = $("#" + id);
    if (field) field.value = "";
  }
}

function beginUnifiedScopeTransition(message = "正在加载当前项目…") {
  unifiedArtifactWorkbench.projectLoadState = "loading";
  unifiedArtifactWorkbench.activeScopeToken = "";
  clearUnifiedProductionEditor();
  const grid = $("#contentProductionCandidateCards");
  if (grid) grid.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
  for (const selector of ["#unifiedArtifactPlatform", "#unifiedArtifactCandidate", "#unifiedArtifactRefresh", "#unifiedFinalizeCurrentVersion", "#unifiedRejectCurrentVersion"]) {
    const control = $(selector);
    if (control) control.disabled = true;
  }
}

function finishUnifiedScopeTransition({ loaded = true } = {}) {
  unifiedArtifactWorkbench.projectLoadState = loaded ? "loaded" : "error";
  const platform = $("#unifiedArtifactPlatform");
  const candidate = $("#unifiedArtifactCandidate");
  const refresh = $("#unifiedArtifactRefresh");
  if (platform) platform.disabled = !unifiedArtifactWorkbench.project;
  if (candidate) candidate.disabled = !unifiedArtifactWorkbench.platform;
  if (refresh) refresh.disabled = !loaded || !unifiedArtifactWorkbench.candidateId;
}

function unifiedProjectDetail(result) {
  return result?.project || result?.item || result?.snapshot || result;
}

function unifiedRefLabel(ref) {
  if (!ref?.id) return "—";
  return `${ref.id}${ref.hash ? ` · ${String(ref.hash).slice(0, 12)}…` : ""}`;
}

function unifiedProjectPlatforms(project = unifiedArtifactWorkbench.project) {
  const normalizePlatform = (platform, value) => {
    const articleRef = value?.articleRef || value?.[platform]?.articleRef || null;
    const candidateRef = value?.candidateRef || value?.refs?.candidateRef || value?.[platform]?.candidateRef
      || (platform === "wechat" ? articleRef : null);
    return {
    platform, ...value,
    accountId: value?.accountId || value?.[platform]?.accountId || "",
    platformRunRef: value?.platformRunRef || value?.refs?.platformRunRef || value?.[platform]?.platformRunRef || null,
    articleRef,
    candidateRef,
    candidateRefs: asArray(value?.candidateRefs).length ? value.candidateRefs : [candidateRef].filter(Boolean)
    };
  };
  const platforms = project?.platforms;
  if (Array.isArray(platforms)) return platforms.map((value) => normalizePlatform(value.platform, value));
  if (platforms && typeof platforms === "object") {
    return Object.entries(platforms).flatMap(([platform, value]) => value && typeof value === "object"
      ? [normalizePlatform(platform, value)]
      : []);
  }
  return ["xiaohongshu", "wechat"].flatMap((platform) => project?.[platform]
    ? [normalizePlatform(platform, project[platform])]
    : []);
}

function unifiedPlatformSnapshot() {
  return unifiedProjectPlatforms().find((item) => item.platform === unifiedArtifactWorkbench.platform) || null;
}

function unifiedCandidateRef() {
  const platform = unifiedPlatformSnapshot();
  const refs = [...asArray(platform?.candidateRefs)];
  for (const ref of [platform?.candidateRef, platform?.articleRef]) {
    if (ref?.id && !refs.some((item) => item.id === ref.id)) refs.push(ref);
  }
  return refs.find((item) => item.id === unifiedArtifactWorkbench.candidateId) || null;
}

function unifiedArtifactScope({ mutation = false } = {}) {
  const project = unifiedArtifactWorkbench.project;
  const platform = unifiedPlatformSnapshot();
  const account = accountsCache.find((item) => item.id === platform?.accountId || item.socialAccountId === platform?.accountId);
  // XHS mutations bind the exact platform projection hash. WeChat mutations
  // bind the aggregate product hash. Never substitute a stale materialized
  // project hash, otherwise a fresh project is incorrectly reported stale.
  const productSnapshotHash = platform?.platform === "xiaohongshu"
    ? platform?.projectionHash || project?.productSnapshotHash || ""
    : project?.aggregateHash || project?.productSnapshotHash || "";
  return {
    workspaceId: account?.workspaceId || project?.workspaceId || project?.contentProject?.workspaceId || "workspace_default",
    companyId: project?.contentProject?.companyId || project?.companyId || account?.companyId || "",
    accountId: platform?.accountId || account?.id || "",
    ...(mutation ? {} : { candidateId: unifiedArtifactWorkbench.candidateId }),
    ...(productSnapshotHash ? { productSnapshotHash } : {})
  };
}

function unifiedWechatExactReviewPayload(state = unifiedArtifactWorkbench.reviewState) {
  return {
    ...unifiedArtifactScope({ mutation: true }),
    candidateId: unifiedArtifactWorkbench.candidateId,
    commitRef: state?.commitRef,
    materializedContentProjectRef: state?.materializedContentProjectRef,
    articleRef: state?.articleRef,
    artifactStateHash: state?.artifactStateHash,
    artifactAuthoritySetHash: state?.artifactAuthoritySetHash
  };
}

function unifiedWechatPendingRequest(stage, createPayload) {
  if (!unifiedArtifactWorkbench.wechatPendingRequests[stage]) {
    unifiedArtifactWorkbench.wechatPendingRequests[stage] = createPayload();
  }
  return unifiedArtifactWorkbench.wechatPendingRequests[stage];
}

function settleUnifiedWechatPendingRequest(stage, error = null) {
  if (!error || error.status) delete unifiedArtifactWorkbench.wechatPendingRequests[stage];
}

function clearUnifiedWechatUploadState() {
  unifiedArtifactWorkbench.wechatDeliveryState = null;
  unifiedArtifactWorkbench.wechatDeliveryStatus = "unknown";
  unifiedArtifactWorkbench.wechatUploadPreview = null;
  unifiedArtifactWorkbench.wechatUploadPlan = null;
  unifiedArtifactWorkbench.wechatUploadExecution = null;
  unifiedArtifactWorkbench.wechatUploadUncertain = "";
  unifiedArtifactWorkbench.wechatDraftState = null;
  unifiedArtifactWorkbench.wechatDraftStatus = "unknown";
  unifiedArtifactWorkbench.wechatDraftPreview = null;
  unifiedArtifactWorkbench.wechatDraftExecution = null;
  unifiedArtifactWorkbench.wechatDraftUncertain = "";
  for (const stage of ["upload-plan-confirm", "upload-execution", "draft-execution"]) delete unifiedArtifactWorkbench.wechatPendingRequests[stage];
}

async function loadUnifiedWechatUploadState() {
  if (unifiedArtifactWorkbench.platform !== "wechat" || !unifiedArtifactWorkbench.wechatUploadEnabled) {
    unifiedArtifactWorkbench.wechatDeliveryStatus = "disabled";
    unifiedArtifactWorkbench.wechatDeliveryState = null;
    return;
  }
  unifiedArtifactWorkbench.wechatDeliveryStatus = "loading";
  try {
    const state = await window.FlowAPI.getUnifiedWechatDeliveryState(unifiedProjectId(unifiedArtifactWorkbench.project), unifiedArtifactScope());
    unifiedArtifactWorkbench.wechatDeliveryState = state;
    unifiedArtifactWorkbench.wechatDeliveryStatus = "loaded";
    if (unifiedArtifactWorkbench.wechatUploadUncertain.startsWith("对账失败：")) unifiedArtifactWorkbench.wechatUploadUncertain = "";
    if (state.uploaded) {
      unifiedArtifactWorkbench.wechatUploadUncertain = "";
      settleUnifiedWechatPendingRequest("upload-execution");
    }
  } catch (error) {
    unifiedArtifactWorkbench.wechatDeliveryStatus = "error";
    unifiedArtifactWorkbench.wechatUploadUncertain = `对账失败：${error.message}`;
  }
}

async function loadUnifiedWechatDraftState() {
  if (unifiedArtifactWorkbench.platform !== "wechat" || !unifiedArtifactWorkbench.wechatDraftEnabled || !unifiedArtifactWorkbench.wechatDeliveryState?.deliveryReady) {
    unifiedArtifactWorkbench.wechatDraftStatus = unifiedArtifactWorkbench.wechatDraftEnabled ? "waiting_delivery" : "disabled";
    unifiedArtifactWorkbench.wechatDraftState = null;
    return;
  }
  unifiedArtifactWorkbench.wechatDraftStatus = "loading";
  try {
    const state = await window.FlowAPI.getUnifiedWechatDraftState(unifiedProjectId(unifiedArtifactWorkbench.project), unifiedArtifactScope());
    unifiedArtifactWorkbench.wechatDraftState = state;
    unifiedArtifactWorkbench.wechatDraftStatus = "loaded";
    if (state.effectUnknown) unifiedArtifactWorkbench.wechatDraftUncertain = "服务端已记录草稿结果未知；禁止自动重试，需先在公众号后台人工核对。";
    if (state.draftCreated) {
      unifiedArtifactWorkbench.wechatDraftUncertain = "";
      settleUnifiedWechatPendingRequest("draft-execution");
    }
  } catch (error) {
    unifiedArtifactWorkbench.wechatDraftStatus = "error";
    unifiedArtifactWorkbench.wechatDraftUncertain = `草稿对账失败：${error.message}`;
  }
}

function unifiedIdempotencyKey(prefix) {
  const suffix = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `ui-${prefix}-${suffix}`;
}

function latestUnifiedFact(items, candidateId) {
  return asArray(items).filter((item) => !candidateId || item.candidateRef?.id === candidateId).at(-1) || null;
}

function unifiedFactStale(fact, artifactState) {
  if (!fact) return false;
  if (fact.stale === true || fact.status === "stale") return true;
  return Boolean(fact.artifactStateHash && artifactState?.artifactStateHash && fact.artifactStateHash !== artifactState.artifactStateHash);
}

function unifiedSameRef(left, right) {
  return Boolean(left?.id && right?.id && left.id === right.id && left.hash === right.hash);
}

async function loadUnifiedExistingPromotion() {
  unifiedArtifactWorkbench.promotionResult = null;
  unifiedArtifactWorkbench.promotionConfirmUncertain = "";
  if (unifiedArtifactWorkbench.platform === "xiaohongshu") {
    // Atomic promotion records are projected by the platform production-state
    // read model. Rehydrate them on refresh so a completed promotion does not
    // appear actionable again or block final delivery.
    try {
      const state = await window.FlowAPI.getUnifiedXhsProductionState(
        unifiedProjectId(unifiedArtifactWorkbench.project),
        { ...unifiedArtifactScope(), candidateId: unifiedArtifactWorkbench.candidateId }
      );
      if (state?.promotion) {
        unifiedArtifactWorkbench.promotionResult = {
          promotion: state.promotion,
          contentVersion: state.promotion.promotedVersion || null,
          existing: true,
          created: false
        };
      }
      unifiedArtifactWorkbench.promotionHistoryStatus = "loaded";
    } catch (error) {
      unifiedArtifactWorkbench.promotionHistoryStatus = "error";
      unifiedArtifactWorkbench.promotionResetReason = `Atomic Promotion 状态查询失败，已 fail closed：${error.message}`;
    }
    await loadUnifiedExistingPublication();
    return;
  }
  if (unifiedArtifactWorkbench.platform === "wechat" && unifiedArtifactWorkbench.wechatHumanSelectionEnabled) {
    const selected = unifiedArtifactWorkbench.reviewState?.selected === true
      || Boolean(unifiedArtifactWorkbench.reviewState?.selectionRef?.id)
      || Boolean(unifiedArtifactWorkbench.reviewState?.selectedVersionRef?.id);
    if (!selected) {
      unifiedArtifactWorkbench.promotionHistoryStatus = "loaded";
      unifiedArtifactWorkbench.promotionResetReason = "等待确认当前公众号版本";
      await loadUnifiedExistingPublication();
      return;
    }
    try {
      const state = await window.FlowAPI.getUnifiedWechatDeliveryState(
        unifiedProjectId(unifiedArtifactWorkbench.project),
        unifiedArtifactScope()
      );
      if (state?.promoted && state?.promotionRef) {
        unifiedArtifactWorkbench.promotionResult = {
          promotion: {
            id: state.promotionRef.id,
            promotionHash: state.promotionRef.hash,
            promotedVersionRef: state.promotedVersionRef
          },
          contentVersion: null,
          existing: true,
          created: false
        };
      }
      unifiedArtifactWorkbench.promotionHistoryStatus = "loaded";
    } catch (error) {
      unifiedArtifactWorkbench.promotionHistoryStatus = "error";
      unifiedArtifactWorkbench.promotionResetReason = `公众号本地版本状态查询失败，已安全停止：${error.message}`;
    }
    await loadUnifiedExistingPublication();
    return;
  }
  if (unifiedArtifactWorkbench.promotionEnabled !== true) {
    unifiedArtifactWorkbench.promotionHistoryStatus = "loaded";
    return;
  }
  const project = unifiedArtifactWorkbench.project;
  const platform = unifiedPlatformSnapshot();
  const candidateRef = unifiedCandidateRef();
  const promotionInput = platform?.reviewInput?.input?.promotion;
  if (!promotionInput?.contentTaskId || !candidateRef) {
    unifiedArtifactWorkbench.promotionHistoryStatus = "loaded";
    return;
  }
  unifiedArtifactWorkbench.promotionHistoryStatus = "loading";
  try {
    const [versionsResult, promotionsResult] = await Promise.all([
      window.FlowAPI.getContentVersions(promotionInput.contentTaskId),
      window.FlowAPI.getContentPromotions({ contentTaskId: promotionInput.contentTaskId })
    ]);
    const scope = unifiedArtifactScope();
    const projectRef = { id: unifiedProjectId(project), hash: project?.contentProject?.projectHash };
    const platformRunRef = platform?.platformRunRef;
    const versions = asArray(versionsResult?.items).filter((item) => item.immutable === true
      && item.contentTaskId === promotionInput.contentTaskId
      && item.companyId === scope.companyId && item.accountId === scope.accountId
      && item.platform === unifiedArtifactWorkbench.platform
      && unifiedSameRef(item.candidateVersionRef, candidateRef)
      && unifiedSameRef(item.contentProjectRef, projectRef)
      && unifiedSameRef(item.platformRunRef, platformRunRef));
    const promotions = asArray(promotionsResult?.items).filter((item) => item.companyId === scope.companyId
      && item.accountId === scope.accountId
      && unifiedSameRef(item.contentProjectRef, projectRef)
      && unifiedSameRef(item.platformRunRef, platformRunRef));
    const exact = versions.map((contentVersion) => ({
      contentVersion,
      promotion: promotions.find((item) => unifiedSameRef(item.promotedVersionRef, { id: contentVersion.id, hash: contentVersion.versionHash }))
    })).filter((item) => item.promotion);
    if (versions.length !== exact.length) throw new Error("发现 candidate immutable version 缺少精确 PromotionRecord 绑定");
    if (exact.length > 1) throw new Error("当前 candidate 存在多个 PromotionRecord，已阻断重复操作");
    if (exact.length === 1) unifiedArtifactWorkbench.promotionResult = { ...exact[0], existing: true, created: false };
    unifiedArtifactWorkbench.promotionHistoryStatus = "loaded";
    await loadUnifiedExistingPublication();
  } catch (error) {
    unifiedArtifactWorkbench.promotionHistoryStatus = "error";
    unifiedArtifactWorkbench.promotionResetReason = `历史 Promotion 查询失败，已 fail closed：${error.message}`;
  }
}

async function loadUnifiedExistingPublication() {
  unifiedArtifactWorkbench.publicationResult = null;
  unifiedArtifactWorkbench.publicationControlState = null;
  unifiedArtifactWorkbench.publicationPreview = null;
  unifiedArtifactWorkbench.feedbackPreview = null;
  unifiedArtifactWorkbench.feedbackIdempotencyKey = "";
  unifiedArtifactWorkbench.publicationConfirmUncertain = "";
  unifiedArtifactWorkbench.feedbackConfirmUncertain = "";
  if (unifiedArtifactWorkbench.atomicPublicationCutoverEnabled) {
    unifiedArtifactWorkbench.publicationHistoryStatus = "loading";
    try {
      const state = await window.FlowAPI.getAtomicPublicationFeedbackControlState(
        unifiedProjectId(unifiedArtifactWorkbench.project), unifiedArtifactWorkbench.platform, unifiedArtifactScope()
      );
      unifiedArtifactWorkbench.publicationControlState = state;
      unifiedArtifactWorkbench.publicationResult = state.publication || null;
      unifiedArtifactWorkbench.publicationHistoryStatus = "loaded";
      if (!unifiedArtifactWorkbench.publicationIdempotencyKey) unifiedArtifactWorkbench.publicationIdempotencyKey = unifiedIdempotencyKey("atomic-manual-publication");
    } catch (error) {
      unifiedArtifactWorkbench.publicationHistoryStatus = "error";
      unifiedArtifactWorkbench.publicationConfirmUncertain = `Atomic publication state failed closed: ${error.message}`;
    }
    return;
  }
  const promotion = unifiedArtifactWorkbench.promotionResult?.promotion;
  const contentTaskId = unifiedPlatformSnapshot()?.reviewInput?.input?.promotion?.contentTaskId;
  if (!promotion || !contentTaskId) {
    unifiedArtifactWorkbench.publicationHistoryStatus = "loaded";
    return;
  }
  unifiedArtifactWorkbench.publicationHistoryStatus = "loading";
  try {
    const result = await window.FlowAPI.getContentPublications(contentTaskId);
    const scope = unifiedArtifactScope();
    const exact = asArray(result?.items).filter((item) => item.contentTaskId === contentTaskId
      && item.companyId === scope.companyId && (item.socialAccountId || item.accountId) === scope.accountId
      && item.platform === unifiedArtifactWorkbench.platform
      && item.promotionStatus === "promoted_exact_version"
      && unifiedSameRef(item.promotionRecordRef, { id: promotion.id, hash: promotion.promotionHash })
      && unifiedSameRef(item.promotedVersionRef, promotion.promotedVersionRef));
    if (exact.length > 1) throw new Error("当前 Promotion 存在多个 Publication，已阻断更新");
    if (exact.length === 1) unifiedArtifactWorkbench.publicationResult = exact[0];
    unifiedArtifactWorkbench.publicationHistoryStatus = "loaded";
    if (!unifiedArtifactWorkbench.publicationIdempotencyKey) unifiedArtifactWorkbench.publicationIdempotencyKey = unifiedIdempotencyKey("manual-publication");
  } catch (error) {
    unifiedArtifactWorkbench.publicationHistoryStatus = "error";
    unifiedArtifactWorkbench.publicationConfirmUncertain = `Publication 查询失败，已 fail closed：${error.message}`;
  }
}

function clearUnifiedPublicationState() {
  unifiedArtifactWorkbench.publicationResult = null;
  unifiedArtifactWorkbench.publicationControlState = null;
  unifiedArtifactWorkbench.publicationPreview = null;
  unifiedArtifactWorkbench.feedbackPreview = null;
  unifiedArtifactWorkbench.publicationHistoryStatus = "unknown";
  unifiedArtifactWorkbench.publicationIdempotencyKey = "";
  unifiedArtifactWorkbench.publicationConfirmUncertain = "";
  unifiedArtifactWorkbench.feedbackConfirmUncertain = "";
}

function clearUnifiedPromotionState(reason = "候选、Artifact、Review 或 Selection 已变化，请重新 Preview") {
  unifiedArtifactWorkbench.promotionPreview = null;
  unifiedArtifactWorkbench.promotionIdempotencyKey = "";
  unifiedArtifactWorkbench.promotionResult = null;
  unifiedArtifactWorkbench.promotionConfirmUncertain = "";
  unifiedArtifactWorkbench.promotionHistoryStatus = "unknown";
  unifiedArtifactWorkbench.promotionResetReason = reason;
  clearUnifiedPublicationState();
  const confirm = $("#unifiedPromotionConfirm");
  if (confirm) confirm.checked = false;
}

// UNIFIED_XHS_VISUAL_REVIEW_PRESENTATION_START
function unifiedXhsVisualReviewProjection(material, artifactState) {
  return material?.reviewStages || artifactState?.reviewStages || null;
}

function unifiedXhsHumanReviewGate(material, artifactState) {
  const stages = unifiedXhsVisualReviewProjection(material, artifactState);
  if (!stages) return { open: false, reason: "服务端未投影三阶段审阅状态" };
  const humanReviewOpen = material?.humanReviewOpen === true || artifactState?.humanReviewOpen === true;
  if (humanReviewOpen) return { open: true, reason: "服务端已开放人工 Artifact Review" };
  const skillStatus = stages.skillVisualReview?.status;
  const humanStatus = stages.humanArtifactReview?.status;
  return { open: false, reason: stages.humanReviewBlocker || stages.humanArtifactReview?.reason || `服务端未开放人工审阅（Skill ${skillStatus || "未投影"} / Human ${humanStatus || "未投影"}）` };
}

function unifiedXhsReviewValue(value, fallback = "服务端未投影") {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function renderUnifiedXhsVisualReview(material, artifactState) {
  const stages = unifiedXhsVisualReviewProjection(material, artifactState);
  const gate = unifiedXhsHumanReviewGate(material, artifactState);
  if (!stages) return `<section class="unified-xhs-review-stages blocked" data-xhs-review-state="missing"><h3>三阶段审阅</h3><p>服务端未投影审阅阶段；已 fail closed，不能人工批准或继续选择。</p></section>`;
  const technical = stages.technicalGate || {};
  const skill = stages.skillVisualReview || {};
  const human = stages.humanArtifactReview || {};
  const pageRevisionRefs = asArray(skill.pageRevisionRefs || stages.pageRevisionRefs);
  const pageFindings = asArray(skill.pageFindings);
  const wholeSet = skill.wholeSet || {};
  const wholeSetFindings = asArray(wholeSet.findings);
  const passedChecks = asArray(wholeSet.passedChecks);
  const rerunStages = asArray(wholeSet.rerunStages);
  const redo = skill.redo || {};
  const redoRefs = asArray(skill.redoPageRevisionRefs || skill.redoRevisionRefs || redo.pageRevisionRefs);
  const redoPageIds = asArray(redo.pendingPageIds);
  const invocation = skill.invocation || {};
  const provider = skill.provider?.name || skill.provider || invocation.provider;
  const model = skill.provider?.model || skill.model || invocation.model;
  const calls = skill.usage?.providerCalls ?? skill.calls ?? invocation.calls;
  const cost = skill.usage?.cost ?? skill.cost ?? skill.credits ?? invocation.cost ?? invocation.credits;
  const metadataOnly = skill.productionEligible === false || skill.pixelInputConsumed === false;
  return `<section class="unified-xhs-review-stages ${gate.open ? "open" : "blocked"}" data-xhs-review-state="${escapeHtml(skill.status || "not_projected")}" data-human-review-open="${gate.open}">
    <header><div><span class="eyebrow">AUTHORITATIVE REVIEW PROJECTION</span><h3>技术 / 多模态 Skill / 人工审阅</h3></div><strong>${gate.open ? "人工审阅已开放" : "人工审阅已锁定"}</strong></header>
    <div class="unified-xhs-review-stage-grid">
      <article data-review-stage="technical"><span>1 · Technical Gate</span><strong>${escapeHtml(unifiedXhsReviewValue(technical.status))}</strong><small>${escapeHtml(unifiedXhsReviewValue(technical.reason || technical.blocker, "仅展示服务端权威状态"))}</small></article>
      <article data-review-stage="skill"><span>2 · review-xhs-visuals</span><strong>${escapeHtml(unifiedXhsReviewValue(skill.status))}</strong><small>${metadataOnly ? "metadata-only / 未消费真实像素，不能通过" : escapeHtml(unifiedXhsReviewValue(skill.productionEligible, "productionEligible 未投影"))}</small></article>
      <article data-review-stage="human"><span>3 · Human Artifact Review</span><strong>${escapeHtml(unifiedXhsReviewValue(human.status))}</strong><small>${escapeHtml(gate.reason)}</small></article>
    </div>
    <dl class="unified-xhs-review-evidence">
      <div><dt>revision set</dt><dd>${escapeHtml(unifiedXhsReviewValue(skill.revisionSetHash || stages.revisionSetHash))}</dd></div>
      <div><dt>page revisions</dt><dd>${pageRevisionRefs.length ? pageRevisionRefs.map((ref) => escapeHtml(unifiedRefLabel(ref))).join("<br>") : "服务端未投影"}</dd></div>
      <div><dt>provider / model</dt><dd>${escapeHtml(`${unifiedXhsReviewValue(provider)} / ${unifiedXhsReviewValue(model)}`)}</dd></div>
      <div><dt>calls / cost</dt><dd>${escapeHtml(`${unifiedXhsReviewValue(calls)} / ${unifiedXhsReviewValue(cost)}`)}</dd></div>
      <div><dt>整套 findings</dt><dd>${wholeSetFindings.length ? wholeSetFindings.map((finding) => escapeHtml(unifiedXhsReviewValue(finding))).join("<br>") : "无整套问题"}<br><strong>passed checks</strong> ${passedChecks.length ? passedChecks.map(escapeHtml).join("、") : "服务端未投影"}<br><strong>rerun stages</strong> ${rerunStages.length ? rerunStages.map(escapeHtml).join("、") : "无"}</dd></div>
      <div><dt>redo</dt><dd>${redoRefs.length ? redoRefs.map((ref) => escapeHtml(unifiedRefLabel(ref))).join("<br>") : redoPageIds.length ? redoPageIds.map(escapeHtml).join("、") : escapeHtml(unifiedXhsReviewValue(skill.redoRecommendation || redo.reason))}</dd></div>
    </dl>
    <div class="unified-xhs-page-findings"><h4>逐页问题</h4>${pageFindings.length ? pageFindings.map((finding) => `<article><strong>${escapeHtml(`${finding.pageId || "page 未投影"} · ${unifiedRefLabel(finding.pageRevisionRef)}`)}</strong><span>${escapeHtml(unifiedXhsReviewValue(finding.severity))}</span><p><b>${escapeHtml(unifiedXhsReviewValue(finding.issue))}</b><br>${escapeHtml(unifiedXhsReviewValue(finding.evidence))}<br><code>${escapeHtml(unifiedXhsReviewValue(finding.patch))}</code></p></article>`).join("") : `<p>当前审阅没有逐页问题。</p>`}</div>
    <p class="unified-xhs-review-boundary">此处只表示候选 Artifact 的审阅状态；不代表已选择、已晋升、已下载或已发布。</p>
  </section>`;
}
// UNIFIED_XHS_VISUAL_REVIEW_PRESENTATION_END

// UNIFIED_XHS_ARTIFACT_PRESENTATION_START
function unifiedPreviewPath(page) {
  if (typeof page?.previewUrl === "string" && page.previewUrl.startsWith("/api/v1/")) return page.previewUrl;
  const revision = page?.revision || {};
  const artifact = revision.normalizedAsset || revision.normalizedArtifact || revision.output?.normalizedAsset || revision.output?.normalizedArtifact || revision.normalized || revision.artifact || revision.outputArtifact || revision.asset || {};
  const path = artifact.relativePath || revision.relativePath || artifact.path || "";
  if (typeof path !== "string") return "";
  const normalizedPath = path.trim().replaceAll("\\", "/");
  if (!normalizedPath || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(normalizedPath)) return "";
  const relativePath = normalizedPath.replace(/^\/+/, "");
  if (!relativePath || relativePath.split("/").some((segment) => segment === "." || segment === ".." || !segment)) return "";
  return `/${relativePath}`;
}

function unifiedPageMetadata(page) {
  const revision = page?.revision || {};
  const artifact = revision.normalizedAsset || revision.normalizedArtifact || revision.output?.normalizedAsset || revision.output?.normalizedArtifact || revision.normalized || revision.artifact || revision.outputArtifact || revision.asset || {};
  const dimensions = artifact.dimensions || revision.dimensions || {};
  return {
    sha: artifact.sha256 || artifact.sha || revision.sha256 || revision.outputSha256 || "—",
    bytes: artifact.bytes ?? revision.bytes ?? revision.outputBytes ?? "—",
    width: dimensions.width ?? artifact.width ?? revision.width ?? "—",
    height: dimensions.height ?? artifact.height ?? revision.height ?? "—"
  };
}

function unifiedWechatHtml(material) {
  if (material?.previewArtifact?.semantics === "pre_upload_template_not_wechat_final") return material.previewArtifact.previewHtml || "";
  return "";
}

function unifiedStatusLabel(value, fallback = "尚未记录") {
  const labels = {
    artifact_review_required: "等待 Artifact 人工审阅",
    artifact_review_approved: "Artifact 整套已批准",
    pre_upload_review_required: "等待上传前模板审阅",
    pre_upload_review_approved: "上传前模板已批准",
    visual_artifacts_required: "等待页面 Artifact",
    pre_upload_resource_required: "等待上传前资源",
    editorial_review_passed: "Content Review 已通过",
    changes_required: "Content Review 要求修改",
    machine_review_blocked: "机器 Gate 阻断",
    selected: "已显式选择",
    not_selected: "not_selected"
  };
  return labels[value] || value || fallback;
}

function renderUnifiedArtifactReferences() {
  const project = unifiedArtifactWorkbench.project;
  const platform = unifiedPlatformSnapshot();
  const strategy = project?.contentProject?.activeStrategySnapshotRef || project?.activeStrategySnapshotRef || project?.strategySnapshotRef;
  $("#unifiedArtifactStrategyRef").textContent = unifiedRefLabel(strategy);
  $("#unifiedArtifactMasterRef").textContent = unifiedRefLabel(project?.sharedContentMasterRef || project?.contentMasterRef);
  $("#unifiedArtifactRunRef").textContent = unifiedRefLabel(platform?.platformRunRef);
  $("#unifiedArtifactCandidateRef").textContent = unifiedRefLabel(unifiedCandidateRef());
}

function renderUnifiedXhsMaterial(material, artifactState) {
  const actionStates = new Map(asArray(unifiedArtifactWorkbench.artifactReview?.actionStates).map((item) => [item.id, item.status]));
  const pendingRedo = new Set(asArray(unifiedArtifactWorkbench.artifactReview?.actionFacts)
    .filter((fact) => fact.action === "request_page_redo" && actionStates.get(fact.id) === "applied")
    .map((fact) => fact.payload?.pageId).filter(Boolean));
  const pages = material.pages || [];
  const includedPages = pages.filter((page) => !page.excluded);
  const humanGate = unifiedXhsHumanReviewGate(material, artifactState);
  const manualFlow = unifiedArtifactWorkbench.xhsProductionState?.stages?.humanVisualConfirmation !== null && unifiedArtifactWorkbench.xhsProductionState?.stages?.humanVisualConfirmation !== undefined;
  const visualStatus = manualFlow
    ? `<section class="unified-xhs-visual-review"><h3>人工视觉确认</h3><p>系统只执行尺寸、哈希等技术检查；图片好坏由你人工判断。当前整套版本：${escapeHtml(unifiedArtifactWorkbench.xhsLightRevisionState?.latestConfirmation ? "已确认" : "待确认")}</p></section>`
    : renderUnifiedXhsVisualReview(material, artifactState);
  return `${visualStatus}<div class="unified-xhs-pages">${pages.map((page, index) => {
    const meta = unifiedPageMetadata(page);
    const preview = unifiedPreviewPath(page);
    const included = !page.excluded;
    const includedIndex = includedPages.findIndex((item) => item.pageId === page.pageId);
    return `<article class="unified-xhs-page ${included ? "included" : "excluded"}" data-unified-page="${escapeHtml(page.pageId)}">
      <header><div><span>第 ${index + 1} 页</span><strong>整页图文</strong></div><em>${page.excluded ? "已排除" : pendingRedo.has(page.pageId) ? "等待重做" : "当前版本"}</em></header>
      ${preview ? `<img src="${escapeHtml(preview)}" alt="${escapeHtml(page.pageId)} 当前 revision 预览" loading="lazy" />` : `<div class="unified-preview-missing">当前 revision 没有可用相对预览路径</div>`}
      <details class="content-platform-advanced"><summary>页面高级详情</summary><div><dl><div><dt>revision</dt><dd>${escapeHtml(unifiedRefLabel(page.revisionRef))}</dd></div><div><dt>SHA</dt><dd>${escapeHtml(String(meta.sha))}</dd></div><div><dt>bytes</dt><dd>${escapeHtml(String(meta.bytes))}</dd></div><div><dt>尺寸</dt><dd>${escapeHtml(`${meta.width} × ${meta.height}`)}</dd></div></dl></div></details>
      <div class="unified-page-actions">
        <button class="btn primary" type="button" data-xhs-light-page="${escapeHtml(page.pageId)}">对话修改此页</button>
        <button class="btn secondary" type="button" data-unified-page-action="${page.excluded ? "restore_page" : "exclude_page"}" data-page-id="${escapeHtml(page.pageId)}" ${humanGate.open ? "" : "disabled"}>${page.excluded ? "恢复此页" : "排除此页"}</button>
        <button class="btn secondary" type="button" data-unified-page-action="request_page_redo" data-page-id="${escapeHtml(page.pageId)}" ${humanGate.open ? "" : "disabled"}>请求单页重做</button>
        ${included ? `<button class="btn secondary" type="button" data-unified-page-move="up" data-page-id="${escapeHtml(page.pageId)}" ${!humanGate.open || includedIndex === 0 ? "disabled" : ""}>上移</button><button class="btn secondary" type="button" data-unified-page-move="down" data-page-id="${escapeHtml(page.pageId)}" ${!humanGate.open || includedIndex === includedPages.length - 1 ? "disabled" : ""}>下移</button>` : ""}
      </div>
    </article>`;
  }).join("") || `<div class="empty-state">服务端尚未返回当前 Page Revision。</div>`}</div>`;
}
// UNIFIED_XHS_ARTIFACT_PRESENTATION_END

function unifiedWechatImagePreviews(html) {
  return [...String(html || "").matchAll(/<img\b[^>]*>/gi)].map((match, index) => {
    const tag = match[0];
    const src = tag.match(/\bsrc\s*=\s*(["'])(.*?)\1/i)?.[2] || "";
    const alt = tag.match(/\balt\s*=\s*(["'])(.*?)\1/i)?.[2] || `文章配图 ${index + 1}`;
    return src.startsWith("data:image/") ? { src, alt } : null;
  }).filter(Boolean);
}

function renderUnifiedWechatMaterial(material) {
  const html = unifiedWechatHtml(material);
  const resources = material.resourceRefs || [];
  const resourceDetails = material.resources || [];
  const gates = material.sixGates || [];
  const imagePreviews = unifiedWechatImagePreviews(html);
  const imageGallery = imagePreviews.length
    ? `<section class="unified-wechat-image-gallery"><header><div><span class="eyebrow">文章图片</span><h3>封面与正文插图</h3></div><strong>${imagePreviews.length} 张</strong></header><div>${imagePreviews.map((image, index) => `<figure><img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}" /><figcaption>${index === 0 ? "公众号封面图" : `正文插图 ${index}`} · ${escapeHtml(image.alt)}</figcaption></figure>`).join("")}</div></section>`
    : `<section class="unified-wechat-image-gallery missing"><strong>这个历史版本没有封面或正文插图</strong><p>它是在公众号配图链路接通前生成的。新建公众号内容任务会自动生成封面和正文信息卡。</p></section>`;
  return `<div class="unified-wechat-warning"><strong>公众号文章预览</strong><span>先检查正文和全部配图；满意后再生成本地内容包，不会自动上传或发布。</span><button class="btn secondary" type="button" data-open-wechat-copy-editor>修改正文</button></div>
    ${imageGallery}
    <iframe class="unified-wechat-preview" id="unifiedWechatPreUploadPreview" sandbox="" title="微信公众号上传前模板预览" srcdoc="${escapeHtml(html)}"></iframe>
    ${html ? "" : `<div class="unified-preview-missing">服务端未返回可预览的上传前 HTML。</div>`}
    <details class="content-platform-advanced"><summary>文章高级详情</summary><div><section class="unified-wechat-exact-selection"><h3>当前精确版本</h3><code>文章 ${escapeHtml(unifiedRefLabel(material.articleRef))}</code><code>配图计划 ${escapeHtml(unifiedRefLabel(material.imagePlanRef || material.planFactRef))}</code>${resourceDetails.map((item) => `<article><strong>${escapeHtml(item.slotId || item.role || "image")} · ${escapeHtml(item.assetId || "asset")}</strong><code>${escapeHtml(unifiedRefLabel(item.resourceRef))}</code><span>SHA ${escapeHtml(item.sha256 || "—")} · ${escapeHtml(item.bytes ?? "—")} bytes · ${escapeHtml(item.relativePath || "—")}</span></article>`).join("")}</section><section class="unified-resource-list"><h3>资源引用</h3>${resources.length ? resources.map((ref) => `<code>${escapeHtml(unifiedRefLabel(ref))}</code>`).join("") : `<span>无独立资源引用</span>`}</section><section class="unified-gate-list"><h3>技术检查</h3>${gates.length ? gates.map((gate) => `<article class="${gate.status === "passed" || gate.status === "succeeded" ? "passed" : "blocked"}"><strong>${escapeHtml(gate.gate || gate.id || "Gate")}</strong><span>${escapeHtml(gate.status || "unknown")}</span><small>${escapeHtml(gate.reason || gate.message || "服务端事实")}</small></article>`).join("") : `<div class="empty-state">尚无技术检查记录。</div>`}</section></div></details>`;
}

function unifiedBlockerLabel(value) {
  const labels = {
    design_required: "请生成页面视觉方案",
    provider_plan_required: "请选择图片生成方向",
    provider_execution_approval_required: "图片已准备生成",
    provider_execution_required: "图片已准备生成",
    human_visual_confirmation_required: "请人工查看并确认当前整套图片",
    artifact_review_required: "请完成当前内容版本审阅",
    explicit_user_selection_required: "请明确采用当前版本",
    immutable_promotion_required: "请锁定为可交付版本",
    page_revisions_required: "整页图片仍在生成中",
    wechat_human_review_required: "请先人工确认当前公众号文章",
    wechat_editorial_review_required: "请运行当前公众号正文审阅",
    user_selection_required: "请明确采用当前版本",
    promotion_required: "请生成不可变正式版本",
    final_delivery_required: "请生成本地内容包",
    local_delivery_complete: "本地内容包已完成"
  };
  return labels[value] || value;
}

function unifiedXhsDirectionLabel(item, index) {
  const value = String(item?.name || item?.id || "");
  if (value.includes("narrative-anchor")) return "主题叙事版";
  if (value.includes("modular-sequence")) return "模块步骤版";
  return value && !value.startsWith("server-direction:") ? value : `视觉方向 ${index + 1}`;
}

function renderUnifiedXhsPreGenerationReview(state) {
  const review = state?.preGenerationReview || {};
  const copy = review.copy || {};
  const copyTarget = $("#unifiedXhsCopyReview");
  const promptTarget = $("#unifiedXhsPromptReview");
  if (copyTarget) {
    const sections = asArray(copy.bodySections);
    const pages = asArray(review.pages);
    copyTarget.innerHTML = copy.title || copy.opening || sections.length || pages.length
      ? `<article class="unified-xhs-copy-card">
          <span class="eyebrow">小红书发布文案</span>
          <h3>${escapeHtml(copy.title || "当前标题待补齐")}</h3>
          ${copy.opening ? `<p class="unified-xhs-copy-opening">${escapeHtml(copy.opening)}</p>` : ""}
          ${sections.length ? `<div class="unified-xhs-copy-sections">${sections.map((item, index) => `<section><strong>${escapeHtml(item.heading || `正文第 ${index + 1} 段`)}</strong><p>${escapeHtml(item.text)}</p></section>`).join("")}</div>` : ""}
          ${copy.ending ? `<p>${escapeHtml(copy.ending)}</p>` : ""}
          ${asArray(copy.hashtags).length ? `<div class="unified-xhs-hashtags">${asArray(copy.hashtags).map((item) => `<span>#${escapeHtml(String(item).replace(/^#/, ""))}</span>`).join("")}</div>` : ""}
        </article>
        <div class="unified-xhs-page-copy-grid">${pages.map((page, index) => `<article><span>第 ${escapeHtml(page.page || index + 1)} 页</span>${asArray(page.textLayers).map((layer) => `<p class="${layer.type === "headline" ? "headline" : ""}">${escapeHtml(layer.text)}</p>`).join("")}</article>`).join("")}</div>`
      : `<div class="empty-state">当前候选尚未返回可审阅的标题与正文，不能进入生图。</div>`;
  }
  if (promptTarget) {
    const prompts = asArray(review.prompts);
    promptTarget.innerHTML = prompts.length
      ? `<div class="unified-xhs-creative-summary"><article><strong>品牌色怎么用</strong><p>${escapeHtml(review.brandColorUsage || "品牌色只作识别锚点，不决定整页配色。")}</p></article><article><strong>本次创意原则</strong><p>${escapeHtml(review.creativePrinciple || "视觉形式由每页内容决定。")}</p></article></div><div class="unified-xhs-prompt-grid">${prompts.map((prompt, index) => `<details ${index === 0 ? "open" : ""}><summary>第 ${index + 1} 页提示词</summary><div><strong>必须出现的文字</strong><ul>${asArray(prompt.requiredText).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul><strong>构图要求</strong><ul>${asArray(prompt.composition).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul><strong>本页创意概念</strong><ul>${asArray(prompt.creativeConcept || prompt.style).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul><strong>不要出现</strong><ul>${asArray(prompt.avoid).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div></details>`).join("")}</div>`
      : `<div class="empty-state">尚未编译生图提示词。点击“生成逐页提示词与视觉方案”只会生成可审阅方案，不会生图或扣除图片费用。</div>`;
  }
}

function renderUnifiedArtifactWorkbench() {
  const data = unifiedArtifactWorkbench.artifactReview;
  const reviewState = unifiedArtifactWorkbench.reviewState || {};
  if (!data) return;
  const artifactState = data.artifactState || {};
  const material = data.reviewMaterial || {};
  const candidateId = unifiedArtifactWorkbench.candidateId;
  const wechatPlatform = unifiedArtifactWorkbench.platform === "wechat";
  const dedicatedWechat = wechatPlatform && unifiedArtifactWorkbench.wechatHumanSelectionEnabled;
  const latestReview = dedicatedWechat ? asArray(reviewState.editorialReviewFacts).at(-1) || null : latestUnifiedFact(reviewState.reviewFacts, candidateId);
  const latestSelection = latestUnifiedFact(reviewState.selectionFacts, candidateId);
  const reviewStale = dedicatedWechat ? Boolean(reviewState.stale && latestReview) : unifiedFactStale(latestReview, artifactState);
  const selectionStale = dedicatedWechat ? Boolean(reviewState.stale && latestSelection) : unifiedFactStale(latestSelection, artifactState) || Boolean(latestSelection && latestReview && latestSelection.reviewFactRef?.id !== latestReview.id);
  const pendingRedo = asArray(artifactState.blockers).includes("page_redo_pending");
  const latestArtifactDecision = dedicatedWechat
    ? asArray(reviewState.artifactReviewFacts).at(-1) || null
    : asArray(data.actionStates).filter((item) => ["approve_set", "approve_preupload", "reject_set", "reject_preupload"].includes(item.action)).at(-1) || null;
  const staleArtifactApproval = dedicatedWechat
    ? Boolean(reviewState.stale && latestArtifactDecision?.action === "approve_preupload")
    : Boolean(latestArtifactDecision?.status === "stale" && ["approve_set", "approve_preupload"].includes(latestArtifactDecision.action));
  const currentReviewPassed = dedicatedWechat
    ? reviewState.editorialReviewPassed === true
    : Boolean(latestReview && !reviewStale && latestReview.state === "editorial_review_passed" && latestReview.editorialReview?.status === "passed");
  const selectionGateOpen = dedicatedWechat ? artifactState.reviewable === true && reviewState.artifactApproved === true : artifactState.selectable === true;
  const artifactApproved = dedicatedWechat
    ? reviewState.artifactApproved === true
    : Boolean(latestArtifactDecision?.action === "approve_set" && latestArtifactDecision?.status !== "stale");
  const canSelect = selectionGateOpen && currentReviewPassed && !pendingRedo
    && (!wechatPlatform || (dedicatedWechat && reviewState.selected !== true));
  const platform = unifiedPlatformSnapshot();

  const xhsPipeline = unifiedArtifactWorkbench.xhsProductionState;
  const xhsPanel = $("#unifiedXhsProductionStatePanel");
  if (xhsPanel) {
    xhsPanel.hidden = unifiedArtifactWorkbench.platform !== "xiaohongshu";
    if (unifiedArtifactWorkbench.platform === "xiaohongshu") {
      const stageLabels = { design: "页面方向", providerPlan: "图片生成方案", providerExecutionApproval: "生成授权", providerExecution: "整页图片", humanVisualConfirmation: "图片确认", artifactReview: "内容确认", selection: "版本保存" };
      renderUnifiedXhsPreGenerationReview(xhsPipeline);
      $("#unifiedXhsProductionStatus").textContent = xhsPipeline?.status ? unifiedBlockerLabel(xhsPipeline.status) : "未加载";
      $("#unifiedXhsProductionNext").textContent = xhsPipeline ? `当前步骤：${unifiedBlockerLabel(xhsPipeline.status || xhsPipeline.nextAllowedAction || "等待继续")}` : "正在读取小红书生产状态";
      $("#unifiedXhsProductionStages").innerHTML = Object.entries(stageLabels).filter(([key]) => xhsPipeline?.stages?.[key] !== null && xhsPipeline?.stages?.[key] !== undefined).map(([key, label]) => `<span class="${xhsPipeline?.stages?.[key] ? "done" : "pending"}">${label} · ${xhsPipeline?.stages?.[key] ? "完成" : "待处理"}</span>`).join("");
      const pipelineBlockers = asArray(xhsPipeline?.blockers);
      const runtimeReadiness = xhsPipeline?.runtimeReadiness || {};
      if (runtimeReadiness.providerExecution && !runtimeReadiness.providerExecution.ready && ["provider_execution_required", "provider_result_unknown"].includes(xhsPipeline?.status)) pipelineBlockers.push("XHS_PROVIDER_RUNTIME_NOT_READY");
      if (runtimeReadiness.lightRevision && !runtimeReadiness.lightRevision.ready && ["human_visual_confirmation_required", "light_revision_result_unknown", "light_revision_processing"].includes(xhsPipeline?.status)) pipelineBlockers.push("XHS_LIGHT_REVISION_RUNTIME_NOT_READY");
      const expectedPipelineBlockers = new Set(["design_required", "provider_plan_required", "provider_execution_approval_required", "provider_execution_required", "human_visual_confirmation_required", "artifact_review_required", "explicit_user_selection_required", "user_selection_required", "immutable_promotion_required", "promotion_required", "final_delivery_required"]);
      const expectedStep = pipelineBlockers.length > 0 && pipelineBlockers.every((item) => expectedPipelineBlockers.has(item));
      const visiblePipelineBlockers = expectedStep ? pipelineBlockers.slice(0, 1) : pipelineBlockers;
      $("#unifiedXhsProductionBlockers").innerHTML = pipelineBlockers.length
        ? `<strong>${expectedStep ? "当前步骤" : "生产链路阻断"}</strong>${visiblePipelineBlockers.map((item) => `<span class="${expectedStep ? "clear" : ""}">${escapeHtml(unifiedBlockerLabel(item))}</span>`).join("")}`
        : `<strong>生产链路状态</strong><span class="clear">当前阶段可以继续</span>`;
      const startDesign = $("#unifiedXhsStartDesign");
      const plannedDesignPages = asArray(material.pages).length
        ? asArray(material.pages)
        : asArray(platform?.visualAssetPlan?.pageVisuals).length
          ? asArray(platform.visualAssetPlan.pageVisuals)
          : asArray(platform?.xiaohongshu?.visualAssetPlan?.pageVisuals).length
            ? asArray(platform.xiaohongshu.visualAssetPlan.pageVisuals)
          : asArray(platform?.carouselPlan?.pages);
      if (startDesign) {
        startDesign.disabled = xhsPipeline?.status !== "design_required" || !plannedDesignPages.length;
        startDesign.title = plannedDesignPages.length
          ? "使用当前小红书视觉计划生成设计证据"
          : "当前候选还没有可用的视觉计划";
      }
      const planControls = $("#unifiedXhsProviderPlanControls");
      const directions = asArray(xhsPipeline?.providerPlanOptions?.directionCandidates);
      if (planControls) {
        planControls.hidden = !xhsPipeline || !["provider_plan_required", "provider_execution_approval_required", "provider_execution_required"].includes(xhsPipeline.status);
        $("#unifiedXhsDirectionSelect").innerHTML = directions.map((item, index) => `<option value="${escapeHtml(item.id)}">${escapeHtml(unifiedXhsDirectionLabel(item, index))}</option>`).join("");
        $("#unifiedXhsDirectionSelect").disabled = !directions.length || xhsPipeline.status !== "provider_plan_required";
        $("#unifiedXhsApprovePlan").disabled = xhsPipeline.status === "provider_plan_required"
          ? !directions.length
          : !["provider_execution_approval_required", "provider_execution_required"].includes(xhsPipeline.status) || runtimeReadiness.providerExecution?.ready === false;
        $("#unifiedXhsApprovePlan").textContent = xhsPipeline.status === "provider_plan_required" ? "确认视觉方向并生成整组图片" : "继续生成整组图片";
      }
      const lightPanel = $("#unifiedXhsLightRevisionPanel");
      const lightState = unifiedArtifactWorkbench.xhsLightRevisionState;
      if (lightPanel) {
        lightPanel.hidden = !xhsPipeline?.refs?.providerPlanFactRef || !asArray(lightState?.pageHeads).length;
        const pageSelect = $("#unifiedXhsLightPage");
        const previousPageId = pageSelect?.value;
        const heads = asArray(lightState?.pageHeads);
        if (pageSelect) {
          pageSelect.innerHTML = heads.map((item) => `<option value="${escapeHtml(item.pageId)}">${escapeHtml(item.pageId)} · revision ${escapeHtml(item.revision)}</option>`).join("");
          if (heads.some((item) => item.pageId === previousPageId)) pageSelect.value = previousPageId;
        }
        const activePlan = unifiedArtifactWorkbench.xhsLightPlan;
        const activeApproval = unifiedArtifactWorkbench.xhsLightApproval;
        const pendingExecution = lightState?.pendingExecution;
        const paidCheckpointPending = Boolean(xhsPipeline?.refs?.providerCheckpointRef || xhsPipeline?.refs?.lightRevisionCheckpointFactRef || asArray(lightState?.unresolvedCheckpoints).some((item) => item.requiresReconciliation === true));
        $("#unifiedXhsLightPlanPreview").innerHTML = pendingExecution
          ? `<strong>任务已提交，正在生成</strong><p>后端已保存任务引用；刷新页面会自动继续，不会再次创建或扣费。</p>`
          : activePlan
          ? `<dl><div><dt>目标页</dt><dd>${escapeHtml(activePlan.targetPageId)}</dd></div><div><dt>基础 revision</dt><dd>${escapeHtml(unifiedRefLabel(activePlan.baseRevisionRef))}</dd></div><div><dt>执行模式</dt><dd>${escapeHtml(activePlan.editMode === "image_edit" ? "当前整图编辑" : "整页重新生成")}</dd></div><div><dt>模型</dt><dd>${escapeHtml(activePlan.model)}</dd></div><div><dt>费用估算</dt><dd>${escapeHtml(activePlan.estimateStatus || "unknown")}</dd></div></dl><pre>${escapeHtml(activePlan.compiledPrompt)}</pre>`
          : `<span>尚未生成修改计划。</span>`;
        $("#unifiedXhsCreateLightPlan").disabled = !heads.length || !xhsPipeline?.refs?.providerPlanFactRef || Boolean(pendingExecution) || paidCheckpointPending;
        $("#unifiedXhsApproveLightPlan").disabled = !activePlan || Boolean(activeApproval);
        $("#unifiedXhsExecuteLightPlan").disabled = !activePlan || !activeApproval || runtimeReadiness.lightRevision?.ready === false || paidCheckpointPending || Boolean(pendingExecution);
        const alreadyConfirmed = Boolean(lightState?.latestConfirmation && lightState.latestConfirmation.revisionSetHash === lightState.revisionSetHash);
        $("#unifiedXhsConfirmVisualSet").disabled = !heads.length || heads.length !== asArray(lightState?.expectedPageIds).length || alreadyConfirmed || paidCheckpointPending || Boolean(pendingExecution);
        $("#unifiedXhsVersionTags").innerHTML = asArray(lightState?.versionTags).length ? asArray(lightState.versionTags).map((item) => `<span>${escapeHtml(item.label)}</span>`).join("") : `<span>尚无已确认版本标签。</span>`;
      }
    }
  }

  const xhsAwaitingVisualArtifacts = unifiedArtifactWorkbench.platform === "xiaohongshu" && !asArray(material.pages).length;
  $("#unifiedArtifactReferences").hidden = false;
  // Internal review/selection/promotion facts remain available through the
  // advanced details and API, but the customer workflow uses one progress CTA.
  $("#unifiedArtifactStatusGrid").hidden = true;
  $("#unifiedArtifactWorkspace").hidden = xhsAwaitingVisualArtifacts;
  renderUnifiedArtifactReferences();
  $("#unifiedArtifactTechnicalStatus").textContent = unifiedStatusLabel(artifactState.status);
  $("#unifiedArtifactTechnicalDetail").textContent = dedicatedWechat
    ? `reviewable=${artifactState.reviewable === true} · dedicatedArtifactApproved=${reviewState.artifactApproved === true}`
    : `reviewable=${artifactState.reviewable === true} · selectable=${artifactState.selectable === true}`;
  $("#unifiedArtifactReviewStatus").textContent = wechatPlatform && !dedicatedWechat ? "公众号专用审核未启用" : dedicatedWechat
    ? staleArtifactApproval ? "旧公众号 Artifact 批准已 stale" : reviewState.editorialReviewPassed ? "公众号 Editorial Review 已通过" : reviewState.artifactApproved ? "Artifact 已批准，等待 Editorial Review" : latestArtifactDecision?.action === "reject_preupload" ? "上传前 Artifact 已否决" : "尚未人工审阅"
    : staleArtifactApproval ? "旧 Artifact 批准已 stale" : latestReview ? (reviewStale ? "旧 Review 已 stale" : unifiedStatusLabel(latestReview.state)) : (data.actionFacts?.length ? "Artifact 动作已记录，等待 Content Review" : "尚未人工审阅");
  $("#unifiedArtifactReviewDetail").textContent = dedicatedWechat
    ? `Artifact ${unifiedRefLabel(reviewState.currentArtifactReviewFactRef)} · Editorial ${unifiedRefLabel(reviewState.currentEditorialReviewFactRef)}`
    : latestReview?.editorialReview ? `六维集合审阅：${latestReview.editorialReview.status}` : "Artifact 批准不等于 Content Review";
  $("#unifiedArtifactSelectionStatus").textContent = dedicatedWechat ? (reviewState.selected ? "selected · local ready-for-upload" : reviewState.selectionStatus || "not_selected") : latestSelection ? (selectionStale ? "旧 UserSelection 已 stale" : unifiedStatusLabel(latestSelection.status)) : "not_selected";
  $("#unifiedArtifactSelectionDetail").textContent = latestSelection ? unifiedRefLabel({ id: latestSelection.id, hash: latestSelection.factHash }) : "尚无显式用户选择事实";
  const promotionRecord = unifiedArtifactWorkbench.promotionResult?.promotion || null;
  const promotionRef = promotionRecord ? { id: promotionRecord.id, hash: promotionRecord.promotionHash } : platform?.promotionRecordRef || platform?.promotionRef || null;
  const publication = unifiedArtifactWorkbench.publicationResult;
  const publicationRef = publication ? { id: publication.id } : platform?.publicationRecordRef || platform?.publicationRef || null;
  const promotionHistoryUnavailable = unifiedArtifactWorkbench.promotionEnabled === true && unifiedArtifactWorkbench.promotionHistoryStatus !== "loaded";
  $("#unifiedArtifactPromotionStatus").textContent = promotionRef ? `已登记 ${promotionRef.id}` : promotionHistoryUnavailable ? "晋升状态不可确认" : "未晋升";
  $("#unifiedArtifactPromotionDetail").textContent = promotionRef ? (publication ? `不可变版本已晋升；人工 Publication ${publication.id} 已登记` : "不可变版本已晋升；Publication 仍未登记") : promotionHistoryUnavailable ? unifiedArtifactWorkbench.promotionResetReason : "独立控制节点，只有 saved UserSelection 可进入 Preview";
  $("#unifiedArtifactPublicationStatus").textContent = publicationRef ? `已登记 ${publicationRef.id}` : unifiedArtifactWorkbench.publicationHistoryStatus === "error" ? "发布状态不可确认" : "未登记发布";
  const localPackageReady = wechatPlatform ? Boolean(promotionRef) : Boolean(xhsPipeline?.refs?.deliveryFactRef) || xhsPipeline?.status === "local_delivery_complete";
  const wechatHasImages = asArray(material.resources).length > 0;
  const finalizeStatus = $("#unifiedFinalizeStatus");
  const finalizeButton = $("#unifiedFinalizeCurrentVersion");
  if (finalizeStatus) finalizeStatus.innerHTML = localPackageReady
    ? `<strong>本地内容包已生成</strong><span>${wechatPlatform ? (wechatHasImages ? "文章与配图已锁定，未上传微信" : "文章已锁定；该历史版本未生成配图") : "文字与整页图片已锁定，未发布小红书"}</span>`
    : `<span>确认后会自动完成版本记录并生成本地内容包。</span>`;
  if (finalizeButton) {
    finalizeButton.textContent = localPackageReady && !wechatPlatform ? "下载小红书内容包" : localPackageReady ? "当前版本已生成内容包" : "确认当前版本并生成内容包";
    finalizeButton.disabled = localPackageReady && wechatPlatform;
  }
  const rejectButton = $("#unifiedRejectCurrentVersion");
  if (rejectButton) rejectButton.disabled = localPackageReady || artifactState.reviewable !== true;
  $("#unifiedArtifactStateHash").textContent = artifactState.artifactStateHash ? "内容版本已载入" : "等待载入";
  const xhsHumanGateOpen = !wechatPlatform && unifiedXhsHumanReviewGate(material, artifactState).open;
  const blockers = dedicatedWechat
    ? !reviewState.artifactApproved ? ["wechat_human_review_required"]
      : !reviewState.editorialReviewPassed ? ["wechat_editorial_review_required"]
        : !reviewState.selected ? ["explicit_user_selection_required"]
          : !promotionRef ? ["immutable_promotion_required"] : []
    : !xhsHumanGateOpen ? asArray(artifactState.blockers)
      : !currentReviewPassed ? ["artifact_review_required"]
        : !latestSelection || selectionStale ? ["explicit_user_selection_required"]
          : !promotionRef ? ["immutable_promotion_required"] : [];
  const expectedArtifactBlockers = new Set(["human_visual_confirmation_required", "artifact_review_required", "wechat_human_review_required", "wechat_editorial_review_required", "explicit_user_selection_required", "immutable_promotion_required"]);
  const expectedArtifactStep = blockers.length > 0 && blockers.every((item) => expectedArtifactBlockers.has(item));
  const visibleArtifactBlockers = expectedArtifactStep ? blockers.slice(0, 1) : blockers;
  $("#unifiedArtifactBlockers").innerHTML = blockers.length
    ? `<strong>${expectedArtifactStep ? "等待你的确认" : "当前尚不能继续"}</strong>${visibleArtifactBlockers.map((item) => `<span class="${expectedArtifactStep ? "clear" : ""}">${escapeHtml(unifiedBlockerLabel(item))}</span>`).join("")}`
    : `<strong>内容状态</strong><span class="clear">当前内容可以继续审阅</span>`;
  $("#unifiedArtifactMaterialTitle").textContent = unifiedArtifactWorkbench.platform === "wechat" ? "公众号上传前模板" : "小红书逐页 Revision";
  $("#unifiedArtifactMaterial").innerHTML = unifiedArtifactWorkbench.platform === "wechat" ? renderUnifiedWechatMaterial(material) : renderUnifiedXhsMaterial(material, artifactState);

  const actionDisabled = unifiedArtifactWorkbench.platform === "xiaohongshu"
    ? !unifiedXhsHumanReviewGate(material, artifactState).open
    : artifactState.reviewable !== true || !unifiedArtifactWorkbench.wechatHumanSelectionEnabled;
  $("#unifiedArtifactSetActions").innerHTML = unifiedArtifactWorkbench.platform === "wechat"
    ? `<button class="btn primary" type="button" data-unified-set-action="approve_preupload" ${actionDisabled ? "disabled" : ""}>批准上传前模板</button><button class="btn danger" type="button" data-unified-set-action="reject_preupload" ${actionDisabled ? "disabled" : ""}>否决上传前模板</button>`
    : `<button class="btn primary" type="button" data-unified-set-action="approve_set" ${actionDisabled ? "disabled" : ""}>批准整套页面</button><button class="btn danger" type="button" data-unified-set-action="reject_set" ${actionDisabled ? "disabled" : ""}>否决整套页面</button>`;
  $("#unifiedCreateContentReview").textContent = wechatPlatform ? "运行公众号 Editorial Review" : "创建当前 Content Review";
  $("#unifiedCreateContentReview").disabled = wechatPlatform ? !dedicatedWechat || !reviewState.artifactApproved || reviewState.editorialReviewPassed === true : artifactState.selectable !== true;
  $("#unifiedContentReviewStep").hidden = !artifactApproved || currentReviewPassed;
  $("#unifiedContentReviewHint").textContent = wechatPlatform && !dedicatedWechat ? "需要启用完整的公众号 Atomic Artifact 与 Human Selection 功能开关。" : dedicatedWechat
    ? reviewState.artifactApproved ? "由服务端根据当前精确 Artifact 权威集合生成 Editorial Review，不能注入人工 findings。" : "先由用户批准当前上传前 Artifact。"
    : artifactState.selectable === true ? "Artifact 当前可选择；Content Review 会绑定当前 state hash。" : `尚不可创建：${blockers.join("、") || "等待 Artifact 批准"}`;
  $("#unifiedSelectionBinding").textContent = dedicatedWechat
    ? currentReviewPassed ? `文章 ${unifiedRefLabel(reviewState.articleRef)} · Artifact ${String(reviewState.artifactStateHash || "").slice(0, 12)}… · Editorial ${unifiedRefLabel(reviewState.currentEditorialReviewFactRef)}` : "等待当前公众号 Editorial Review 通过"
    : currentReviewPassed ? `candidate ${candidateId} · review ${latestReview.id} · artifact ${artifactState.artifactStateHash?.slice(0, 12)}…` : reviewStale ? "旧 Review 已 stale，请创建绑定当前 Artifact 的新 Review" : "等待当前 Content Review 通过";
  $("#unifiedSelectionConfirm").checked = false;
  $("#unifiedSelectionConfirm").disabled = !canSelect;
  $("#unifiedConfirmSelection").disabled = true;
  renderUnifiedPromotionPanel({ latestReview, latestSelection, reviewStale, selectionStale, artifactState });
  renderUnifiedWechatUploadPanel();
  renderUnifiedWechatDraftPanel();
  renderUnifiedPublicationPanel();
}

async function startUnifiedXhsDesign() {
  const projectId = unifiedProjectId(unifiedArtifactWorkbench.project);
  const platform = unifiedPlatformSnapshot();
  const xhsContent = platform?.xiaohongshu || platform;
  const material = unifiedArtifactWorkbench.artifactReview?.reviewMaterial || {};
  const scope = unifiedArtifactScope({ mutation: true });
  const sourcePages = asArray(material.pages).length
    ? asArray(material.pages)
    : asArray(xhsContent?.visualAssetPlan?.pageVisuals).length
      ? asArray(xhsContent.visualAssetPlan.pageVisuals)
      : asArray(xhsContent?.carouselPlan?.pages);
  if (!projectId || unifiedArtifactWorkbench.platform !== "xiaohongshu" || !platform || !sourcePages.length) return showToast("当前小红书候选尚无可设计页面");
  const carouselPages = asArray(xhsContent?.carouselPlan?.pages);
  const stylePackId = $("#unifiedXhsStylePack")?.value || "editorial-metaphor";
  const pages = sourcePages.map((page, index) => {
    const role = String(page.role || carouselPages[index]?.role || (index === 0 ? "cover" : index === sourcePages.length - 1 ? "cta" : "method")).toLowerCase();
    const visibleText = [
      page.headline, page.title, page.body, page.copy, page.text, page.contentTruth?.headline,
      ...asArray(page.contentTruth?.supportingText), ...asArray(page.verbatimText), ...asArray(page.bullets),
      ...asArray(page.items).flatMap((item) => typeof item === "string" ? [item] : [item?.title, item?.text])
    ].filter(Boolean).join("\n");
    const explicitProcess = /(?:第[一二三四五六七八九十\d]+步|步骤|流程|阶段|先.+再|\b\d+[.、]\s*)/.test(visibleText);
    const explicitComparison = /(?:对比|相比|区别|差异|之前|之后|改造前|改造后|vs)/i.test(visibleText);
    const explicitList = asArray(page.bullets).length >= 2 || asArray(page.items).length >= 2;
    const adaptiveArchetypeId = index === 0 || role === "cover"
      ? "cover.promise"
      : ["summary", "cta"].includes(role)
        ? "summary.cta"
        : explicitProcess
          ? "process.vertical-steps"
          : explicitComparison
            ? "comparison.before-after"
            : explicitList
              ? "list.key-points"
              : "cover.promise";
    const legacyArchetypeId = index === 0 || role === "cover"
      ? "cover.promise"
      : ["summary", "cta"].includes(role) ? "summary.cta" : role === "problem" ? "explanation.concept-map" : "list.key-points";
    const archetypeId = stylePackId === "editorial-metaphor" ? adaptiveArchetypeId : legacyArchetypeId;
    const patternId = archetypeId === "cover.promise"
      ? "pattern.hierarchy.promise-focus"
      : archetypeId === "summary.cta"
        ? "pattern.cta.single-action"
        : archetypeId === "process.vertical-steps"
          ? "pattern.process.numbered-spine"
          : archetypeId === "comparison.before-after"
            ? "pattern.compare.mirrored-columns"
        : archetypeId === "explanation.concept-map"
          ? "pattern.map.layered-system"
          : "pattern.list.equal-cards";
    return {
      pageId: page.pageId || `P${index + 1}`,
      archetypeId: stylePackId === "editorial-metaphor" ? archetypeId : index === 0 ? "cover.promise" : page.archetypeId || archetypeId,
      patternIds: stylePackId === "editorial-metaphor" ? [patternId] : index === 0 ? ["pattern.hierarchy.promise-focus"] : asArray(page.patternIds).length ? page.patternIds : [patternId],
      referenceAssetIds: asArray(page.referenceAssetIds),
      verbatimTextOverride: null,
      stylePackId: null
    };
  });
  const request = {
    ...scope,
    platformRunRef: platform.platformRunRef,
    candidateRef: unifiedCandidateRef(),
    visualDirection: { stylePackId, reason: stylePackId === "editorial-metaphor" ? "用户选择内容自适应创意：由内容决定媒介与构图，视觉识别资料只提供品牌色锚点" : `用户在工作台选择系统视觉风格：${stylePackId}`, pages },
    idempotencyKey: unifiedIdempotencyKey("xhs-design")
  };
  const button = $("#unifiedXhsStartDesign");
  if (button) button.disabled = true;
  try {
    await window.FlowAPI.executeUnifiedXhsDesign(projectId, request);
    showToast("小红书视觉方案已生成；下一步请确认图片生成方向与费用");
    await refreshUnifiedArtifactCandidate();
  } catch (error) {
    if (button) button.disabled = false;
    showToast(`小红书设计启动失败：${error.message}`);
  }
}

const unifiedXhsStyleDescriptions = {
  "editorial-metaphor": "内容自适应：系统按每页主题选择媒介、构图、材质和配色；视觉识别资料默认只提供一个品牌色锚点，不套用手册版式。",
  "friendly-handdrawn-tech": "轻松手绘：用原创线条和扁平几何辅助解释，所有可见文字仍以中文真值为准。",
  "structured-infographic": "结构化方法卡：适合步骤、清单和证据内容；不会补写输入中不存在的数据。"
};

$("#unifiedXhsStylePack")?.addEventListener("change", (event) => {
  const description = $("#unifiedXhsStyleDescription");
  if (description) description.textContent = unifiedXhsStyleDescriptions[event.target.value] || "系统会按当前内容选择合适的页面表达。";
});

async function approveUnifiedXhsProviderPlan() {
  const projectId = unifiedProjectId(unifiedArtifactWorkbench.project);
  const actor = $("#unifiedXhsPlanApprover")?.value.trim() || "workspace_user";
  if (!projectId) return;
  const button = $("#unifiedXhsApprovePlan");
  if (button) button.disabled = true;
  try {
    let state = unifiedArtifactWorkbench.xhsProductionState;
    if (state?.status === "provider_plan_required") {
      const directionId = $("#unifiedXhsDirectionSelect")?.value;
      const promptSetRef = state.providerPlanOptions?.promptSetRef;
      if (!directionId || !promptSetRef?.hash) throw new Error("请先选择视觉方向");
      const draftKey = `${state.refs.designFactRef.hash}:${directionId}`;
      const planPayload = unifiedArtifactWorkbench.xhsGenerationDraft?.key === draftKey
        ? unifiedArtifactWorkbench.xhsGenerationDraft.planPayload
        : {
        ...unifiedArtifactScope({ mutation: true }), platformRunRef: state.authority.platformRunRef, candidateRef: state.authority.candidateRef,
        designFactRef: state.refs.designFactRef, designEvidenceRef: state.refs.designEvidenceRef, promptSetRef, selectedDirectionId: directionId,
        promptApproval: { reviewedPromptSetHash: promptSetRef.hash, approvedBy: actor, approvedAt: new Date().toISOString() },
        costConfirmation: { currency: "credits", approvedMaxTotal: 100, confirmedBy: actor, confirmedAt: new Date().toISOString() },
        idempotencyKey: unifiedIdempotencyKey("xhs-provider-plan")
      };
      planPayload.costConfirmation.confirmedAt = planPayload.promptApproval.approvedAt;
      unifiedArtifactWorkbench.xhsGenerationDraft = { key: draftKey, planPayload };
      await window.FlowAPI.createUnifiedXhsProviderPlan(projectId, planPayload);
      await refreshUnifiedArtifactCandidate();
      state = unifiedArtifactWorkbench.xhsProductionState;
    }
    if (state?.status === "provider_execution_approval_required") {
      const options = state.providerExecutionOptions;
      const pageIds = asArray(options?.pageIds);
      if (!pageIds.length) throw new Error("当前图片范围为空");
      const approvalKey = `${options.planRef.hash}:attempt:${options.nextAttempt || 1}`;
      const approvalPayload = unifiedArtifactWorkbench.xhsGenerationDraft?.approvalKey === approvalKey
        ? unifiedArtifactWorkbench.xhsGenerationDraft.approvalPayload
        : {
        ...unifiedArtifactScope({ mutation: true }), platformRunRef: state.authority.platformRunRef, candidateRef: state.authority.candidateRef,
        designFactRef: state.refs.designFactRef, designEvidenceRef: state.refs.designEvidenceRef,
        providerPlanFactRef: options.providerPlanFactRef, planRef: options.planRef, targetPageIds: pageIds,
        maxProviderCalls: pageIds.length, maxCredits: 100, approvedBy: actor, approvedAt: new Date().toISOString(),
        idempotencyKey: unifiedIdempotencyKey("xhs-provider-execution-approval")
      };
      unifiedArtifactWorkbench.xhsGenerationDraft = { ...(unifiedArtifactWorkbench.xhsGenerationDraft || {}), approvalKey, approvalPayload };
      await window.FlowAPI.approveUnifiedXhsProviderExecution(projectId, approvalPayload);
      await refreshUnifiedArtifactCandidate();
      state = unifiedArtifactWorkbench.xhsProductionState;
    }
    if (state?.status !== "provider_execution_required") throw new Error("图片生成状态尚未就绪，请刷新后继续");
    const options = state.providerExecutionOptions;
    const result = await window.FlowAPI.executeUnifiedXhsProviderExecution(projectId, {
      ...unifiedArtifactScope({ mutation: true }), platformRunRef: state.authority.platformRunRef, candidateRef: state.authority.candidateRef,
      providerPlanFactRef: options.providerPlanFactRef, approvalFactRef: state.refs.providerExecutionApprovalFactRef,
      targetPageIds: options.pageIds,
      idempotencyKey: `xhs-provider-execution:${state.refs.providerExecutionApprovalFactRef.hash}:attempt:${options.nextAttempt || 1}`
    });
    showToast(result?.status === "checkpoint" ? "图片任务结果待核实，已保留原任务且不会重复扣费" : "整组图片已开始生成，正在刷新结果");
    unifiedArtifactWorkbench.xhsGenerationDraft = null;
    await refreshUnifiedArtifactCandidate();
  } catch (error) {
    if (button) button.disabled = false;
    showToast(`图片生成未能继续：${error.message}`);
  }
}

async function approveUnifiedXhsProviderExecution() {
  const state = unifiedArtifactWorkbench.xhsProductionState;
  const projectId = unifiedProjectId(unifiedArtifactWorkbench.project);
  const approver = $("#unifiedXhsExecutionApprover")?.value.trim();
  const maxProviderCalls = Number($("#unifiedXhsMaxProviderCalls")?.value);
  const maxCredits = Number($("#unifiedXhsMaxExecutionCredits")?.value);
  const options = state?.providerExecutionOptions;
  if (!state || state.status !== "provider_execution_approval_required" || !approver || !options?.pageIds?.length) return showToast("当前尚未具备 Provider 执行批准条件");
  const scope = unifiedArtifactScope({ mutation: true });
  const request = {
    ...scope, platformRunRef: state.authority.platformRunRef, candidateRef: state.authority.candidateRef,
    designFactRef: state.refs.designFactRef, designEvidenceRef: state.refs.designEvidenceRef,
    providerPlanFactRef: options.providerPlanFactRef, planRef: options.planRef, targetPageIds: options.pageIds,
    maxProviderCalls: Number.isInteger(maxProviderCalls) ? maxProviderCalls : 1, maxCredits: Number.isFinite(maxCredits) ? maxCredits : 1,
    approvedBy: approver, approvedAt: new Date().toISOString(), idempotencyKey: unifiedIdempotencyKey("xhs-provider-execution-approval")
  };
  const button = $("#unifiedXhsApproveExecution");
  if (button) button.disabled = true;
  try {
    await window.FlowAPI.approveUnifiedXhsProviderExecution(projectId, request);
    showToast("Provider 执行已获人工批准；下一步仍需单独启动执行");
    await refreshUnifiedArtifactCandidate();
  } catch (error) {
    if (button) button.disabled = false;
    showToast(`Provider 执行批准失败：${error.message}`);
  }
}

async function executeUnifiedXhsProvider() {
  const state = unifiedArtifactWorkbench.xhsProductionState;
  const projectId = unifiedProjectId(unifiedArtifactWorkbench.project);
  const options = state?.providerExecutionOptions;
  if (!state || state.status !== "provider_execution_required" || !options?.pageIds?.length) return showToast("当前没有可执行的已批准 Provider Plan");
  if (!window.confirm("将按已批准的页面范围和费用上限调用视觉 Provider。继续吗？")) return;
  const request = { ...unifiedArtifactScope({ mutation: true }), platformRunRef: state.authority.platformRunRef, candidateRef: state.authority.candidateRef, providerPlanFactRef: options.providerPlanFactRef, approvalFactRef: state.refs.providerExecutionApprovalFactRef, targetPageIds: options.pageIds, idempotencyKey: unifiedIdempotencyKey("xhs-provider-execution") };
  const button = $("#unifiedXhsExecuteProvider");
  if (button) button.disabled = true;
  try {
    const result = await window.FlowAPI.executeUnifiedXhsProviderExecution(projectId, request);
    showToast(result?.status === "checkpoint" ? "Provider 返回了待核实 checkpoint，已停止重试" : "视觉生成执行完成，正在刷新 Artifact");
    await refreshUnifiedArtifactCandidate();
  } catch (error) {
    if (button) button.disabled = false;
    showToast(`视觉生成执行失败：${error.message}`);
  }
}

async function approveUnifiedXhsVisualReview() {
  const state = unifiedArtifactWorkbench.xhsProductionState;
  const projectId = unifiedProjectId(unifiedArtifactWorkbench.project);
  const approver = $("#unifiedXhsExecutionApprover")?.value.trim();
  const maxCredits = Number($("#unifiedXhsMaxExecutionCredits")?.value);
  const options = state?.providerExecutionOptions;
  if (!state || state.status !== "visual_review_approval_required" || !approver || !options?.planRef) return showToast("当前尚未具备视觉审阅批准条件");
  const request = { ...unifiedArtifactScope({ mutation: true }), platformRunRef: state.authority.platformRunRef, candidateRef: state.authority.candidateRef, designEvidenceRef: state.refs.designEvidenceRef, providerPlanFactRef: options.providerPlanFactRef, planRef: options.planRef, maxCredits: Number.isFinite(maxCredits) ? maxCredits : 1, approvedBy: approver, approvedAt: new Date().toISOString(), idempotencyKey: unifiedIdempotencyKey("xhs-visual-review-approval") };
  const button = $("#unifiedXhsApproveVisualReview");
  if (button) button.disabled = true;
  try {
    await window.FlowAPI.approveUnifiedXhsVisualReview(projectId, request);
    showToast("视觉审阅费用已批准；下一步执行审阅并写入审阅事实");
    await refreshUnifiedArtifactCandidate();
  } catch (error) {
    if (button) button.disabled = false;
    showToast(`视觉审阅批准失败：${error.message}`);
  }
}

async function executeUnifiedXhsVisualReview() {
  const state = unifiedArtifactWorkbench.xhsProductionState;
  const projectId = unifiedProjectId(unifiedArtifactWorkbench.project);
  const options = state?.providerExecutionOptions;
  if (!state || state.status !== "visual_review_required" || !state.refs?.visualReviewApprovalFactRef || !options?.planRef) return showToast("当前没有可执行的已批准视觉审阅");
  if (!window.confirm("将按当前精确版本执行视觉质量审阅，并把结果绑定到当前 Provider Plan。继续吗？")) return;
  const request = { ...unifiedArtifactScope({ mutation: true }), platformRunRef: state.authority.platformRunRef, candidateRef: state.authority.candidateRef, designEvidenceRef: state.refs.designEvidenceRef, providerPlanFactRef: options.providerPlanFactRef, planRef: options.planRef, approvalFactRef: state.refs.visualReviewApprovalFactRef, idempotencyKey: unifiedIdempotencyKey("xhs-visual-review") };
  const button = $("#unifiedXhsExecuteVisualReview");
  if (button) button.disabled = true;
  try {
    const result = await window.FlowAPI.executeUnifiedXhsVisualReview(projectId, request);
    showToast(result?.status === "checkpoint" ? "视觉审阅出现待核实 checkpoint，已停止重试" : "视觉审阅完成，正在刷新 Artifact 状态");
    await refreshUnifiedArtifactCandidate();
  } catch (error) {
    if (button) button.disabled = false;
    showToast(`视觉审阅执行失败：${error.message}`);
  }
}

async function createUnifiedXhsLightPlan() {
  const pipeline = unifiedArtifactWorkbench.xhsProductionState;
  const lightState = unifiedArtifactWorkbench.xhsLightRevisionState;
  const targetPageId = $("#unifiedXhsLightPage")?.value;
  const instruction = $("#unifiedXhsLightInstruction")?.value.trim();
  const actor = $("#unifiedXhsLightActor")?.value.trim();
  const base = asArray(lightState?.pageHeads).find((item) => item.pageId === targetPageId);
  if (!pipeline?.refs?.providerPlanFactRef || !base || !instruction || !actor) return showToast("请选择页面，并填写修改要求和操作人");
  const button = $("#unifiedXhsCreateLightPlan");
  if (button) button.disabled = true;
  try {
    const result = await window.FlowAPI.createUnifiedXhsLightRevisionPlan(unifiedProjectId(unifiedArtifactWorkbench.project), {
      ...unifiedArtifactScope({ mutation: true }), providerPlanFactRef: pipeline.refs.providerPlanFactRef,
      targetPageId, baseRevisionRef: base.revisionRef, instruction, createdBy: actor,
      idempotencyKey: unifiedIdempotencyKey("xhs-light-plan")
    });
    unifiedArtifactWorkbench.xhsLightPlan = result.plan;
    unifiedArtifactWorkbench.xhsLightApproval = null;
    renderUnifiedArtifactWorkbench();
    showToast(result.plan?.editMode === "image_edit" ? "已编译为当前整图编辑计划" : "已编译为整页重新生成计划");
  } catch (error) {
    showToast(`修改计划生成失败：${error.message}`);
    if (button) button.disabled = false;
  }
}

async function approveUnifiedXhsLightPlan() {
  const plan = unifiedArtifactWorkbench.xhsLightPlan;
  const actor = $("#unifiedXhsLightActor")?.value.trim();
  const maxCredits = Number($("#unifiedXhsLightMaxCredits")?.value);
  if (!plan || !actor || !Number.isFinite(maxCredits) || maxCredits <= 0) return showToast("请先生成修改方案");
  try {
    const result = await window.FlowAPI.approveUnifiedXhsLightRevision(unifiedProjectId(unifiedArtifactWorkbench.project), {
      ...unifiedArtifactScope({ mutation: true }), planFactRef: { id: plan.id, hash: plan.factHash }, maxCredits, approvedBy: actor,
      idempotencyKey: unifiedIdempotencyKey("xhs-light-approval")
    });
    unifiedArtifactWorkbench.xhsLightApproval = result.approval;
    renderUnifiedArtifactWorkbench();
    showToast("修改方案已确认；点击生成后才会调用生图服务");
  } catch (error) { showToast(`修改计划批准失败：${error.message}`); }
}

function stopUnifiedXhsLightPolling() {
  if (unifiedArtifactWorkbench.xhsLightPollTimer) clearTimeout(unifiedArtifactWorkbench.xhsLightPollTimer);
  unifiedArtifactWorkbench.xhsLightPollTimer = null;
  unifiedArtifactWorkbench.xhsLightPollingExecutionId = null;
}

function scheduleUnifiedXhsLightContinuation(execution, delayMs = 0) {
  if (!execution?.id || !execution?.factHash) return;
  if (unifiedArtifactWorkbench.xhsLightPollingExecutionId && unifiedArtifactWorkbench.xhsLightPollingExecutionId !== execution.id) stopUnifiedXhsLightPolling();
  unifiedArtifactWorkbench.xhsLightPollingExecutionId = execution.id;
  if (unifiedArtifactWorkbench.xhsLightPollTimer) clearTimeout(unifiedArtifactWorkbench.xhsLightPollTimer);
  unifiedArtifactWorkbench.xhsLightPollTimer = setTimeout(async () => {
    unifiedArtifactWorkbench.xhsLightPollTimer = null;
    const projectId = unifiedProjectId(unifiedArtifactWorkbench.project);
    if (!projectId || unifiedArtifactWorkbench.platform !== "xiaohongshu" || unifiedArtifactWorkbench.xhsLightPollingExecutionId !== execution.id) return;
    try {
      const result = await window.FlowAPI.continueUnifiedXhsLightRevision(projectId, execution.id, {
        ...unifiedArtifactScope({ mutation: true }), executionFactRef: { id: execution.id, hash: execution.factHash }
      });
      if (result.status === "processing") return scheduleUnifiedXhsLightContinuation(execution, 3000);
      stopUnifiedXhsLightPolling();
      await refreshUnifiedArtifactCandidate();
      showToast(result.status === "reconciliation_required" ? "图片任务未重复提交，现有结果需要人工核对" : "图片生成完成，已创建新 revision，等待人工确认");
    } catch (error) {
      showToast(`图片任务状态暂时不可用，将自动继续：${error.message}`);
      scheduleUnifiedXhsLightContinuation(execution, 5000);
    }
  }, delayMs);
}

async function executeUnifiedXhsLightPlan() {
  const plan = unifiedArtifactWorkbench.xhsLightPlan;
  const approval = unifiedArtifactWorkbench.xhsLightApproval;
  if (!plan || !approval) return showToast("请先确认修改方案");
  const summary = `${plan.targetPageId}\n模式：${plan.editMode === "image_edit" ? "编辑当前整图" : "整页重新生成"}\n模型：${plan.model}\n\n${plan.compiledPrompt}`;
  if (!window.confirm(`即将真实调用生图 API 并生成新 revision：\n\n${summary}\n\n继续吗？`)) return;
  const button = $("#unifiedXhsExecuteLightPlan");
  if (button) button.disabled = true;
  try {
    const result = await window.FlowAPI.executeUnifiedXhsLightRevision(unifiedProjectId(unifiedArtifactWorkbench.project), {
      ...unifiedArtifactScope({ mutation: true }), planFactRef: { id: plan.id, hash: plan.factHash }, approvalFactRef: { id: approval.id, hash: approval.factHash },
      idempotencyKey: unifiedIdempotencyKey("xhs-light-execution")
    });
    unifiedArtifactWorkbench.xhsLightPlan = null;
    unifiedArtifactWorkbench.xhsLightApproval = null;
    await refreshUnifiedArtifactCandidate();
    const pending = unifiedArtifactWorkbench.xhsLightRevisionState?.pendingExecution || result.execution;
    if (result.status === "processing" && pending) scheduleUnifiedXhsLightContinuation(pending, 0);
    showToast(result.status === "processing" ? "任务已提交并保存，正在生成；刷新页面也会自动继续" : `已生成 ${plan.targetPageId} 的新 revision，旧版本仍保留`);
  } catch (error) {
    if (button) button.disabled = false;
    showToast(`生成新 revision 失败：${error.message}`);
  }
}

async function confirmUnifiedXhsVisualSet() {
  const pipeline = unifiedArtifactWorkbench.xhsProductionState;
  const lightState = unifiedArtifactWorkbench.xhsLightRevisionState;
  const actor = $("#unifiedXhsLightActor")?.value.trim();
  const versionLabel = $("#unifiedXhsVersionLabel")?.value.trim();
  const refs = asArray(lightState?.pageHeads).map((item) => item.revisionRef);
  if (!pipeline?.refs?.providerPlanFactRef || !actor || !refs.length) return showToast("当前整套图片尚不完整，或未填写确认人");
  if (!window.confirm(`确认当前 ${refs.length} 页图片均已由人工检查，并冻结为${versionLabel ? `“${versionLabel}”` : "下一个 XHS 版本"}？`)) return;
  try {
    const result = await window.FlowAPI.confirmUnifiedXhsHumanVisualSet(unifiedProjectId(unifiedArtifactWorkbench.project), {
      ...unifiedArtifactScope({ mutation: true }), providerPlanFactRef: pipeline.refs.providerPlanFactRef, pageRevisionRefs: refs,
      confirmedBy: actor, versionLabel, idempotencyKey: unifiedIdempotencyKey("xhs-human-visual-confirmation")
    });
    await refreshUnifiedArtifactCandidate();
    showToast(`已人工确认整套图片并生成版本标签 ${result.versionTag?.label || "XHS"}`);
  } catch (error) { showToast(`整套图片确认失败：${error.message}`); }
}

// UNIFIED_CONTENT_PROMOTION_UI_START
function unifiedPromotionEligibility({ latestReview, latestSelection, reviewStale, selectionStale, artifactState }) {
  const blockers = [];
  if (unifiedArtifactWorkbench.promotionEnabled !== true) blockers.push("CONTENT_PROMOTION_V1 未启用");
  if (unifiedArtifactWorkbench.promotionEnabled === true && unifiedArtifactWorkbench.promotionHistoryStatus !== "loaded") blockers.push("历史 Promotion 状态尚未安全加载");
  if (unifiedArtifactWorkbench.promotionResult?.promotion) blockers.push("当前 candidate 已存在不可变 Promotion");
  if (unifiedArtifactWorkbench.platform === "wechat" && unifiedArtifactWorkbench.wechatHumanSelectionEnabled) {
    const state = unifiedArtifactWorkbench.reviewState || {};
    if (!state.selected) blockers.push("尚无 saved UserSelection");
    if (!state.editorialReviewPassed) blockers.push("当前公众号正文审阅未通过或已 stale");
    if (state.stale) blockers.push("当前公众号选择已 stale");
    return { eligible: blockers.length === 0, blockers };
  }
  if (!latestSelection) blockers.push("尚无 saved UserSelection");
  else if (latestSelection.status !== "selected") blockers.push("UserSelection 不是 selected");
  if (selectionStale) blockers.push("UserSelection 已 stale");
  if (!latestReview || reviewStale || latestReview.state !== "editorial_review_passed") blockers.push("当前 Content Review 未通过或已 stale");
  if (latestSelection && latestReview && latestSelection.reviewFactRef?.id !== latestReview.id) blockers.push("Selection 未绑定当前 Review");
  if (latestSelection?.artifactStateHash && artifactState?.artifactStateHash && latestSelection.artifactStateHash !== artifactState.artifactStateHash) blockers.push("Selection 未绑定当前 Artifact state");
  return { eligible: blockers.length === 0, blockers };
}

function renderUnifiedPromotionPanel(context = {}) {
  const panel = $("#unifiedPromotionPanel");
  if (!panel) return;
  const eligibility = unifiedPromotionEligibility(context);
  const preview = unifiedArtifactWorkbench.promotionPreview;
  const result = unifiedArtifactWorkbench.promotionResult;
  const publicationLabel = unifiedPromotionPublicationLabel(unifiedArtifactWorkbench.publicationResult) || "Publication：未登记";
  const previewButton = $("#unifiedPreviewPromotion");
  const confirmCheckbox = $("#unifiedPromotionConfirm");
  const confirmButton = $("#unifiedConfirmPromotion");
  const deliveryButton = $("#unifiedXhsFinalDelivery");
  const wechatPackage = unifiedArtifactWorkbench.platform === "wechat";
  $("#unifiedPromotionTitle").textContent = wechatPackage ? "生成公众号本地内容包" : "锁定为可交付版本";
  confirmButton.textContent = wechatPackage ? "生成公众号本地内容包" : "锁定正式版本";
  previewButton.disabled = !eligibility.eligible;
  confirmCheckbox.disabled = !eligibility.eligible || !preview?.previewToken || Boolean(result);
  confirmButton.disabled = !(eligibility.eligible && preview?.previewToken && confirmCheckbox.checked && !result);
  if (deliveryButton) {
    deliveryButton.hidden = unifiedArtifactWorkbench.platform !== "xiaohongshu";
    const deliveryComplete = Boolean(unifiedArtifactWorkbench.xhsProductionState?.refs?.deliveryFactRef);
    deliveryButton.textContent = deliveryComplete ? "下载小红书内容包" : "生成小红书本地内容包";
    deliveryButton.disabled = deliveryButton.hidden || (!result?.promotion && !deliveryComplete);
  }
  $("#unifiedPromotionBlockers").innerHTML = eligibility.eligible
    ? `<span class="clear">saved UserSelection 已精确绑定，可以只读 Preview。</span>`
    : eligibility.blockers.map((item) => `<span>${escapeHtml(item)}</span>`).join("");
  $("#unifiedPromotionPreviewState").textContent = preview
    ? `Preview 已验证 · writesPerformed=${preview.claims?.writesPerformed === false ? "false" : "未知"} · platformPublicationPerformed=${preview.claims?.platformPublicationPerformed === false ? "false" : "未知"}`
    : unifiedArtifactWorkbench.promotionResetReason;
  $("#unifiedPromotionBindings").innerHTML = preview ? [
    ["candidate", preview.bindings?.candidateVersionRef], ["manifest", preview.bindings?.sourceManifestRef],
    ["delivery", preview.bindings?.deliveryArtifactRef], ["review", preview.bindings?.editorialReviewRef],
    ["selection", preview.bindings?.userSelectionRef]
  ].map(([label, ref]) => `<div><dt>${label}</dt><dd>${escapeHtml(unifiedRefLabel(ref))}</dd></div>`).join("") : "";
  $("#unifiedPromotionResult").innerHTML = result?.promotion
    ? `<strong>${wechatPackage ? "公众号本地内容包" : "PromotionRecord"} ${escapeHtml(result.promotion.id)}</strong><code>${escapeHtml(unifiedRefLabel(result.promotion.promotedVersionRef))}</code><span>${wechatPackage ? "文章、上传前 HTML 与资源清单已锁定；未上传微信" : escapeHtml(publicationLabel)}</span>`
    : unifiedArtifactWorkbench.promotionConfirmUncertain
      ? `<strong>Confirm 结果未知</strong><span>${escapeHtml(unifiedArtifactWorkbench.promotionConfirmUncertain)}</span><span>请使用同一幂等键重试，不得另建 Promotion。</span>`
      : `<span>尚未创建不可变 Promotion；Preview 不写数据。</span>`;
}

async function previewUnifiedCurrentPromotion() {
  const artifactState = unifiedArtifactWorkbench.artifactReview?.artifactState;
  const dedicatedWechat = unifiedArtifactWorkbench.platform === "wechat" && unifiedArtifactWorkbench.wechatHumanSelectionEnabled;
  const review = dedicatedWechat
    ? asArray(unifiedArtifactWorkbench.reviewState?.editorialReviewFacts).at(-1) || null
    : latestUnifiedFact(unifiedArtifactWorkbench.reviewState?.reviewFacts, unifiedArtifactWorkbench.candidateId);
  const selection = dedicatedWechat
    ? asArray(unifiedArtifactWorkbench.reviewState?.selectionFacts).at(-1) || null
    : latestUnifiedFact(unifiedArtifactWorkbench.reviewState?.selectionFacts, unifiedArtifactWorkbench.candidateId);
  const reviewStale = unifiedFactStale(review, artifactState);
  const selectionStale = unifiedFactStale(selection, artifactState) || Boolean(selection && review && selection.reviewFactRef?.id !== review.id);
  const eligibility = unifiedPromotionEligibility({ latestReview: review, latestSelection: selection, reviewStale, selectionStale, artifactState });
  if (!eligibility.eligible) return showToast(`Promotion Preview 已阻断：${eligibility.blockers.join("、")}`);
  clearUnifiedPromotionState("正在验证只读 Preview…");
  unifiedArtifactWorkbench.promotionHistoryStatus = "loaded";
  const projectId = unifiedProjectId(unifiedArtifactWorkbench.project);
  try {
    const preview = await window.FlowAPI.previewSavedContentPromotion(projectId, unifiedArtifactWorkbench.platform, { ...unifiedArtifactScope(), selectionId: selection.id });
    if (preview?.claims?.writesPerformed !== false || preview?.claims?.platformPublicationPerformed !== false) throw new Error("服务端未声明 Preview 零写和零平台发布");
    unifiedArtifactWorkbench.promotionPreview = preview;
    unifiedArtifactWorkbench.promotionIdempotencyKey = unifiedIdempotencyKey("promotion");
    unifiedArtifactWorkbench.promotionResetReason = "Preview 已验证";
    renderUnifiedPromotionPanel({ latestReview: review, latestSelection: selection, reviewStale, selectionStale, artifactState });
    showToast("Promotion Preview 已完成：零写入、未执行平台发布");
  } catch (error) {
    clearUnifiedPromotionState(`Preview 被服务端阻断：${error.message}`);
    renderUnifiedPromotionPanel({ latestReview: review, latestSelection: selection, reviewStale, selectionStale, artifactState });
    showToast(`Promotion Preview 未通过：${error.message}`);
  }
}

async function confirmUnifiedCurrentPromotion({ skipConfirmation = false } = {}) {
  const preview = unifiedArtifactWorkbench.promotionPreview;
  if (!preview?.previewToken || (!skipConfirmation && !$("#unifiedPromotionConfirm").checked)) return showToast("请先检查当前交付版本");
  const selection = unifiedArtifactWorkbench.platform === "wechat" && unifiedArtifactWorkbench.wechatHumanSelectionEnabled
    ? asArray(unifiedArtifactWorkbench.reviewState?.selectionFacts).at(-1) || null
    : latestUnifiedFact(unifiedArtifactWorkbench.reviewState?.selectionFacts, unifiedArtifactWorkbench.candidateId);
  const summary = `Candidate：${unifiedArtifactWorkbench.candidateId}\nSelection：${selection?.id || "—"}\nPreview：${preview.previewToken}\n\n确认创建不可变 Promotion？此动作不等于 Publication。`;
  if (!window.confirm(summary)) return;
  const projectId = unifiedProjectId(unifiedArtifactWorkbench.project);
  try {
    const result = await window.FlowAPI.confirmSavedContentPromotion(projectId, unifiedArtifactWorkbench.platform, {
      ...unifiedArtifactScope({ mutation: true }), selectionId: selection.id, previewToken: preview.previewToken, idempotencyKey: unifiedArtifactWorkbench.promotionIdempotencyKey
    });
    unifiedArtifactWorkbench.promotionResult = result;
    unifiedArtifactWorkbench.promotionHistoryStatus = "loaded";
    await loadUnifiedExistingPublication();
    await loadUnifiedWechatUploadState();
    await loadUnifiedWechatDraftState();
    $("#unifiedPromotionConfirm").checked = false;
    renderUnifiedArtifactWorkbench();
    showToast("不可变 Promotion 已登记；Publication 仍未登记");
  } catch (error) {
    if (error.status) clearUnifiedPromotionState(`Confirm 被服务端阻断：${error.message}`);
    else {
      unifiedArtifactWorkbench.promotionConfirmUncertain = error.message;
      unifiedArtifactWorkbench.promotionResetReason = `Confirm 响应未知，可用同一幂等键安全重试：${error.message}`;
    }
    renderUnifiedArtifactWorkbench();
    showToast(error.status ? `Promotion 未创建：${error.message}` : `Promotion 结果未知；请用同一幂等键重试：${error.message}`);
  }
}
// UNIFIED_CONTENT_PROMOTION_UI_END

// UNIFIED_WECHAT_RESOURCE_UPLOAD_UI_START
function unifiedWechatUploadEligibility() {
  const state = unifiedArtifactWorkbench.wechatDeliveryState;
  const blockers = [];
  if (unifiedArtifactWorkbench.platform !== "wechat") blockers.push("仅公众号候选可使用资源上传");
  if (!unifiedArtifactWorkbench.wechatUploadEnabled) blockers.push("公众号受控资源上传功能未启用");
  if (unifiedArtifactWorkbench.wechatDeliveryStatus !== "loaded") blockers.push("服务端上传状态尚未安全对账");
  if (!state?.promoted || !state?.promotionRef) blockers.push("缺少当前精确 Promotion");
  if (state?.uploaded) blockers.push("当前 Promotion 已存在成功上传证据");
  if (unifiedArtifactWorkbench.wechatUploadUncertain) blockers.push("存在结果未知或待人工处理的上传尝试，禁止新建请求");
  return { eligible: blockers.length === 0, blockers };
}

async function createUnifiedXhsFinalDelivery({ skipConfirmation = false } = {}) {
  const existingDelivery = unifiedArtifactWorkbench.xhsProductionState?.refs?.deliveryFactRef;
  const projectId = unifiedProjectId(unifiedArtifactWorkbench.project);
  if (existingDelivery?.id) {
    try {
      await window.FlowAPI.downloadUnifiedXhsLocalPackage(projectId, existingDelivery.id);
      return showToast("小红书内容包已下载到本地");
    } catch (error) {
      return showToast(`小红书内容包下载失败：${error.message}`);
    }
  }
  const promotion = unifiedArtifactWorkbench.promotionResult?.promotion;
  if (!promotion) return showToast("请先创建不可变 Promotion");
  if (!skipConfirmation && !window.confirm("将按当前版本生成本地内容包；不会发布到小红书。继续吗？")) return;
  const request = { ...unifiedArtifactScope({ mutation: true }), promotionId: promotion.id, promotionRef: { id: promotion.id, hash: promotion.promotionHash }, promotedVersionRef: promotion.promotedVersionRef, idempotencyKey: unifiedIdempotencyKey("xhs-final-delivery") };
  const button = $("#unifiedXhsFinalDelivery");
  if (button) button.disabled = true;
  try {
    const result = await window.FlowAPI.createUnifiedXhsFinalDelivery(projectId, request);
    if (result?.localPackage?.downloadUrl) await window.FlowAPI.downloadContentPackage(result.localPackage.downloadUrl, result.localPackage.fileName);
    showToast("小红书内容包已生成并下载到本地；未执行平台发布");
    await refreshUnifiedArtifactCandidate();
  } catch (error) {
    if (button) button.disabled = false;
    showToast(`小红书最终交付生成失败：${error.message}`);
  }
}

function unifiedWechatUploadPlanHtml(plan) {
  if (!plan) return `<span>等待只读上传计划。</span>`;
  const steps = asArray(plan.steps);
  return `<strong>${escapeHtml(plan.contract || "AtomicWechat resource upload plan")}</strong>
    <code>Promotion ${escapeHtml(unifiedRefLabel(plan.promotionRef))}</code>
    <code>Version ${escapeHtml(unifiedRefLabel(plan.promotedVersionRef))}</code>
    <code>HTML ${escapeHtml(plan.sourceHtml?.relativePath || "—")} · ${escapeHtml(plan.sourceHtml?.sha256 || "—")}</code>
    ${steps.map((step) => `<article><b>${escapeHtml(String(step.ordinal))} · ${escapeHtml(step.role)} · ${escapeHtml(step.operation)}</b><span>${escapeHtml(step.relativePath)} · ${escapeHtml(String(step.bytes))} bytes</span><code>${escapeHtml(step.sha256)}</code></article>`).join("")}
    <small>计划包含 ${steps.length} 次顺序调用；失败后不会自动重试后续资源。</small>`;
}

function renderUnifiedWechatUploadPanel() {
  const panel = $("#unifiedWechatUploadPanel");
  if (!panel) return;
  const isWechat = unifiedArtifactWorkbench.platform === "wechat";
  panel.hidden = !isWechat || !unifiedArtifactWorkbench.wechatUploadEnabled;
  if (panel.hidden) return;
  const state = unifiedArtifactWorkbench.wechatDeliveryState;
  const preview = unifiedArtifactWorkbench.wechatUploadPreview;
  const plan = unifiedArtifactWorkbench.wechatUploadPlan;
  const execution = unifiedArtifactWorkbench.wechatUploadExecution;
  const eligibility = unifiedWechatUploadEligibility();
  const approveCheckbox = $("#unifiedWechatUploadConfirm");
  const canApprove = eligibility.eligible && Boolean(preview?.previewToken) && !plan;
  const canExecute = eligibility.eligible && Boolean(plan?.id && plan?.planHash) && !execution;
  $("#unifiedWechatUploadPreview").disabled = !eligibility.eligible || Boolean(preview || plan);
  approveCheckbox.disabled = !canApprove;
  $("#unifiedWechatUploadApprove").disabled = !(canApprove && approveCheckbox.checked && $("#unifiedWechatUploadActorId").value.trim());
  $("#unifiedWechatUploadExecute").disabled = !canExecute;
  $("#unifiedWechatUploadBlockers").innerHTML = eligibility.eligible
    ? `<span class="clear">Promotion 与服务端状态已对账，可预览或继续当前上传计划。</span>`
    : eligibility.blockers.map((item) => `<span>${escapeHtml(item)}</span>`).join("");
  $("#unifiedWechatUploadState").innerHTML = [
    ["state", unifiedArtifactWorkbench.wechatDeliveryStatus], ["promoted", state?.promoted], ["uploaded", state?.uploaded],
    ["deliveryReady", state?.deliveryReady], ["draftCreated", state?.draftCreated], ["published", state?.published]
  ].map(([key, value]) => `<span>${escapeHtml(key)}: <b>${escapeHtml(String(value ?? "unknown"))}</b></span>`).join("");
  $("#unifiedWechatUploadPlan").innerHTML = unifiedWechatUploadPlanHtml(plan || preview?.request);
  $("#unifiedWechatUploadResult").innerHTML = state?.uploaded
    ? `<strong>资源上传证据已对账</strong><code>${escapeHtml(unifiedRefLabel(state.uploadEvidenceRef))}</code><span>draftCreated=false · published=false</span>`
    : execution
      ? `<strong>执行状态：${escapeHtml(execution.status || "unknown")}</strong><code>${escapeHtml(unifiedRefLabel({ id: execution.id, hash: execution.factHash }))}</code><span>provider calls: ${escapeHtml(String(asArray(execution.attempts).length))} · draftCreated=false · published=false</span>`
      : unifiedArtifactWorkbench.wechatUploadUncertain
        ? `<strong>结果未知，已冻结新请求</strong><span>${escapeHtml(unifiedArtifactWorkbench.wechatUploadUncertain)}</span><span>请先刷新对账；若仍无成功证据，交由 Controller 核对本次外部 effect。</span>`
        : `<span>尚未执行资源上传；预览和计划批准都不会调用微信。</span>`;
}

async function previewUnifiedWechatUploadPlan() {
  const eligibility = unifiedWechatUploadEligibility();
  if (!eligibility.eligible) return showToast(`上传计划 Preview 已阻断：${eligibility.blockers.join("；")}`);
  try {
    const preview = await window.FlowAPI.previewUnifiedWechatResourceUploadPlan(unifiedProjectId(unifiedArtifactWorkbench.project), {
      ...unifiedArtifactScope({ mutation: true }), promotionRef: unifiedArtifactWorkbench.wechatDeliveryState.promotionRef
    });
    if (preview?.claims?.writesPerformed !== false || preview?.claims?.providerCalls !== 0 || preview?.claims?.draftCreated !== false || preview?.claims?.platformPublicationPerformed !== false) {
      throw new Error("服务端未声明 Preview 零写入、零 Provider 调用");
    }
    unifiedArtifactWorkbench.wechatUploadPreview = preview;
    renderUnifiedWechatUploadPanel();
    showToast("上传计划只读 Preview 已完成；尚未调用微信");
  } catch (error) {
    showToast(`上传计划 Preview 未通过：${error.message}`);
  }
}

async function approveUnifiedWechatUploadPlan() {
  const preview = unifiedArtifactWorkbench.wechatUploadPreview;
  const actorId = $("#unifiedWechatUploadActorId").value.trim();
  if (!preview?.previewToken || !actorId || !$("#unifiedWechatUploadConfirm").checked) return showToast("请先预览计划并填写批准人、勾选精确计划确认");
  const stage = "upload-plan-confirm";
  const request = unifiedWechatPendingRequest(stage, () => ({
    ...unifiedArtifactScope({ mutation: true }), promotionRef: unifiedArtifactWorkbench.wechatDeliveryState.promotionRef,
    previewToken: preview.previewToken, actorType: "user", actorId, approved: true,
    occurredAt: new Date().toISOString(), idempotencyKey: unifiedIdempotencyKey("wechat-upload-plan")
  }));
  try {
    const result = await window.FlowAPI.confirmUnifiedWechatResourceUploadPlan(unifiedProjectId(unifiedArtifactWorkbench.project), request);
    settleUnifiedWechatPendingRequest(stage);
    unifiedArtifactWorkbench.wechatUploadPlan = result.uploadPlan;
    $("#unifiedWechatUploadConfirm").checked = false;
    renderUnifiedWechatUploadPanel();
    showToast("精确上传计划已获人工批准；尚未调用微信");
  } catch (error) {
    settleUnifiedWechatPendingRequest(stage, error);
    renderUnifiedWechatUploadPanel();
    showToast(error.status ? `上传计划未批准：${error.message}` : "批准响应未知；已保留同一幂等请求，可原样重放该批准");
  }
}

async function executeUnifiedWechatUploadPlan() {
  const plan = unifiedArtifactWorkbench.wechatUploadPlan;
  if (!plan?.id || !plan?.planHash || unifiedArtifactWorkbench.wechatUploadUncertain) return showToast("缺少已批准计划，或当前存在待对账请求");
  const summary = `即将调用微信上传 ${asArray(plan.steps).length} 个资源。\nPromotion：${plan.promotionRef?.id}\nPlan：${plan.id}\n\n此操作不会创建草稿或发布文章。是否继续？`;
  if (!skipConfirmation && !window.confirm(summary)) return;
  const stage = "upload-execution";
  const request = unifiedWechatPendingRequest(stage, () => ({
    ...unifiedArtifactScope({ mutation: true }), promotionRef: plan.promotionRef,
    uploadPlanRef: { id: plan.id, hash: plan.planHash }, idempotencyKey: unifiedIdempotencyKey("wechat-resource-upload")
  }));
  try {
    const result = await window.FlowAPI.executeUnifiedWechatResourceUpload(unifiedProjectId(unifiedArtifactWorkbench.project), request);
    settleUnifiedWechatPendingRequest(stage);
    unifiedArtifactWorkbench.wechatUploadExecution = result.execution;
    await loadUnifiedWechatUploadState();
    await loadUnifiedWechatDraftState();
    renderUnifiedArtifactWorkbench();
    showToast(result.execution?.status === "succeeded" ? "微信资源上传成功并已对账；尚未创建草稿或发布" : `资源上传停止于 ${result.execution?.status || "unknown"}；不会自动重试`);
  } catch (error) {
    settleUnifiedWechatPendingRequest(stage, error);
    unifiedArtifactWorkbench.wechatUploadUncertain = error.status ? "" : `外部执行响应未知：${error.message}`;
    renderUnifiedWechatUploadPanel();
    showToast(error.status ? `资源上传未执行：${error.message}` : "上传结果未知；已冻结新请求，请先刷新并对账");
  }
}

async function reconcileUnifiedWechatUpload() {
  await loadUnifiedWechatUploadState();
  await loadUnifiedWechatDraftState();
  renderUnifiedArtifactWorkbench();
  showToast(unifiedArtifactWorkbench.wechatDeliveryState?.uploaded ? "已找到成功上传证据；资源上传不等于草稿或发布" : "未找到成功上传闭环；不会自动重试任何外部调用");
}
// UNIFIED_WECHAT_RESOURCE_UPLOAD_UI_END

// UNIFIED_WECHAT_DRAFT_CREATION_UI_START
function unifiedWechatDraftEligibility() {
  const blockers = [];
  const delivery = unifiedArtifactWorkbench.wechatDeliveryState;
  const draft = unifiedArtifactWorkbench.wechatDraftState;
  if (unifiedArtifactWorkbench.platform !== "wechat") blockers.push("仅公众号候选可创建草稿");
  if (!unifiedArtifactWorkbench.wechatDraftEnabled) blockers.push("公众号草稿创建功能未启用");
  if (!delivery?.uploaded || !delivery?.deliveryReady) blockers.push("必须先完成资源上传和最终交付闭环");
  if (unifiedArtifactWorkbench.wechatDraftStatus !== "loaded") blockers.push("草稿状态尚未安全对账");
  if (draft?.draftCreated) blockers.push("当前精确交付已经创建草稿");
  if (unifiedArtifactWorkbench.wechatDraftUncertain) blockers.push("存在结果未知的草稿请求，禁止新建调用");
  return { eligible: blockers.length === 0, blockers };
}

function renderUnifiedWechatDraftPanel() {
  const panel = $("#unifiedWechatDraftPanel");
  if (!panel) return;
  panel.hidden = unifiedArtifactWorkbench.platform !== "wechat" || !unifiedArtifactWorkbench.wechatDraftEnabled;
  if (panel.hidden) return;
  const state = unifiedArtifactWorkbench.wechatDraftState;
  const preview = unifiedArtifactWorkbench.wechatDraftPreview;
  const execution = unifiedArtifactWorkbench.wechatDraftExecution;
  const eligibility = unifiedWechatDraftEligibility();
  const checkbox = $("#unifiedWechatDraftConfirm");
  const canConfirm = eligibility.eligible && Boolean(preview?.previewToken);
  $("#unifiedWechatDraftPreview").disabled = !eligibility.eligible || Boolean(preview);
  checkbox.disabled = !canConfirm;
  $("#unifiedWechatDraftExecute").disabled = !(canConfirm && checkbox.checked && $("#unifiedWechatDraftActorId").value.trim());
  $("#unifiedWechatDraftBlockers").innerHTML = eligibility.eligible
    ? `<span class="clear">资源上传与最终交付已对账，可预览精确 draft/add 载荷。</span>`
    : eligibility.blockers.map((item) => `<span>${escapeHtml(item)}</span>`).join("");
  $("#unifiedWechatDraftState").innerHTML = [
    ["state", unifiedArtifactWorkbench.wechatDraftStatus], ["ready", state?.ready], ["draftCreated", state?.draftCreated], ["effectUnknown", state?.effectUnknown], ["published", state?.published]
  ].map(([key, value]) => `<span>${escapeHtml(key)}: <b>${escapeHtml(String(value ?? "unknown"))}</b></span>`).join("");
  const request = preview?.request;
  $("#unifiedWechatDraftPayload").innerHTML = request
    ? `<strong>${escapeHtml(request.draft?.title || "—")}</strong><code>Delivery ${escapeHtml(unifiedRefLabel(request.deliveryRef))}</code><code>Content SHA ${escapeHtml(request.contentSha256 || "—")}</code><code>Thumb media_id ${escapeHtml(request.draft?.thumbMediaId || "—")}</code><span>${escapeHtml(String(request.draft?.content?.length || 0))} characters · 不授权发布</span>`
    : `<span>等待只读草稿 Preview。</span>`;
  $("#unifiedWechatDraftResult").innerHTML = state?.draftCreated
    ? `<strong>微信草稿已创建</strong><code>${escapeHtml(state.mediaId || "—")}</code><span>published=false</span>`
    : execution
      ? `<strong>执行状态：${escapeHtml(execution.status || "unknown")}</strong><code>${escapeHtml(unifiedRefLabel({ id: execution.id, hash: execution.factHash }))}</code><span>草稿 media_id：${escapeHtml(execution.mediaId || "—")} · published=false</span>`
      : unifiedArtifactWorkbench.wechatDraftUncertain
        ? `<strong>结果未知，已冻结新请求</strong><span>${escapeHtml(unifiedArtifactWorkbench.wechatDraftUncertain)}</span>`
        : `<span>尚未调用微信 draft/add。</span>`;
}

async function previewUnifiedWechatDraftCreation() {
  const eligibility = unifiedWechatDraftEligibility();
  if (!eligibility.eligible) return showToast(`草稿 Preview 已阻断：${eligibility.blockers.join("；")}`);
  try {
    const preview = await window.FlowAPI.previewUnifiedWechatDraftCreation(unifiedProjectId(unifiedArtifactWorkbench.project), unifiedArtifactScope());
    if (preview?.claims?.writesPerformed !== false || preview?.claims?.providerCalls !== 0 || preview?.claims?.draftCreated !== false || preview?.claims?.platformPublicationPerformed !== false) {
      throw new Error("服务端未声明 Preview 零写入、零草稿创建和零发布");
    }
    unifiedArtifactWorkbench.wechatDraftPreview = preview;
    renderUnifiedWechatDraftPanel();
    showToast("草稿载荷只读 Preview 已完成；尚未调用微信");
  } catch (error) {
    showToast(`草稿 Preview 未通过：${error.message}`);
  }
}

async function executeUnifiedWechatDraftCreation() {
  const preview = unifiedArtifactWorkbench.wechatDraftPreview;
  const actorId = $("#unifiedWechatDraftActorId").value.trim();
  if (!preview?.previewToken || !actorId || !$("#unifiedWechatDraftConfirm").checked) return showToast("请先预览并确认本次精确草稿");
  const summary = `即将调用微信 draft/add。\n标题：${preview.request?.draft?.title || "—"}\nContent SHA：${preview.request?.contentSha256 || "—"}\nDelivery：${preview.request?.deliveryRef?.id || "—"}\n\n仅创建草稿，不发布。是否继续？`;
  if (!window.confirm(summary)) return;
  const stage = "draft-execution";
  const request = unifiedWechatPendingRequest(stage, () => ({
    ...unifiedArtifactScope({ mutation: true }), previewToken: preview.previewToken, actorType: "user", actorId,
    confirmedAt: new Date().toISOString(), idempotencyKey: unifiedIdempotencyKey("wechat-draft-create")
  }));
  try {
    const result = await window.FlowAPI.executeUnifiedWechatDraftCreation(unifiedProjectId(unifiedArtifactWorkbench.project), request);
    settleUnifiedWechatPendingRequest(stage);
    unifiedArtifactWorkbench.wechatDraftExecution = result.execution;
    await loadUnifiedWechatDraftState();
    $("#unifiedWechatDraftConfirm").checked = false;
    renderUnifiedWechatDraftPanel();
    showToast(result.execution?.effectUnknown ? "草稿结果未知；已冻结新请求，请先在公众号后台核对" : "公众号草稿已创建并对账；文章尚未发布");
  } catch (error) {
    const unknown = error.code === "WECHAT_DRAFT_RESULT_UNKNOWN";
    if (!unknown) settleUnifiedWechatPendingRequest(stage, error);
    unifiedArtifactWorkbench.wechatDraftUncertain = unknown ? `外部草稿响应未知：${error.message}` : "";
    renderUnifiedWechatDraftPanel();
    showToast(unknown ? "草稿结果未知；已冻结新请求，请先对账" : `草稿未创建：${error.message}`);
  }
}

async function reconcileUnifiedWechatDraft() {
  await loadUnifiedWechatDraftState();
  renderUnifiedWechatDraftPanel();
  showToast(unifiedArtifactWorkbench.wechatDraftState?.draftCreated ? "已找到微信草稿创建证据；尚未发布" : "未找到成功草稿证据；不会自动重试外部调用");
}
// UNIFIED_WECHAT_DRAFT_CREATION_UI_END

// UNIFIED_CONTENT_PUBLICATION_FEEDBACK_UI_START
function unifiedPromotionPublicationLabel(publication) {
  return publication?.id
    ? `人工 Publication：${publication.id} 已登记（非平台 API 发布）`
    : "Publication：未登记";
}

function unifiedPublicationEligibility() {
  const blockers = [];
  if (unifiedArtifactWorkbench.atomicPublicationCutoverEnabled) {
    const state = unifiedArtifactWorkbench.publicationControlState;
    if (unifiedArtifactWorkbench.publicationHistoryStatus !== "loaded") blockers.push("Atomic publication control state is not safely loaded");
    if (!state?.states?.deliveryReady) blockers.push("Exact Atomic final delivery is required");
    if (state?.publication) blockers.push("The exact delivery already has a confirmed Publication fact");
    return { eligible: blockers.length === 0, blockers };
  }
  const promotion = unifiedArtifactWorkbench.promotionResult?.promotion;
  const version = unifiedArtifactWorkbench.promotionResult?.contentVersion;
  if (unifiedArtifactWorkbench.promotionHistoryStatus !== "loaded") blockers.push("Promotion 状态尚未安全加载");
  if (!promotion || !version || !unifiedSameRef(promotion.promotedVersionRef, { id: version.id, hash: version.versionHash })) blockers.push("缺少精确 PromotionRecord 与 immutable version");
  if (unifiedArtifactWorkbench.publicationHistoryStatus !== "loaded") blockers.push("Publication 历史尚未安全加载");
  if (unifiedArtifactWorkbench.publicationResult) blockers.push("当前精确 Promotion 已有 Publication");
  return { eligible: blockers.length === 0, blockers };
}

function unifiedMetricValue(selector) {
  const value = $(selector)?.value;
  return value === "" || value == null ? null : Number(value);
}

function unifiedInputIso(selector, fieldLabel) {
  const value = $(selector)?.value;
  if (!value) throw new Error(`请填写${fieldLabel}`);
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error(`${fieldLabel}不是有效时间`);
  return new Date(timestamp).toISOString();
}

function unifiedVerifiablePublicationUrl(rawUrl, platform = unifiedArtifactWorkbench.platform) {
  if (!rawUrl) return "";
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:") return "";
    const host = url.hostname.toLowerCase();
    if (platform === "wechat" && host !== "mp.weixin.qq.com") return "";
    if (platform === "xiaohongshu" && host !== "xiaohongshu.com" && !host.endsWith(".xiaohongshu.com")) return "";
    return url.href;
  } catch { return ""; }
}

function renderUnifiedPublicationPanel() {
  const panel = $("#unifiedPublicationPanel");
  if (!panel) return;
  const enabled = unifiedArtifactWorkbench.publicationToolsEnabled === true;
  panel.hidden = !enabled;
  $("#unifiedFeedbackPanel").hidden = !enabled;
  $("#unifiedLifecyclePanel").hidden = !enabled;
  if (!enabled) return;
  const eligibility = unifiedPublicationEligibility();
  const publication = unifiedArtifactWorkbench.publicationResult;
  const control = unifiedArtifactWorkbench.publicationControlState;
  const publicationUrl = unifiedVerifiablePublicationUrl(publication?.canonicalPlatformUrl || publication?.url, publication?.platform);
  const manualConfirm = $("#unifiedPublicationManualConfirm");
  const recordButton = $("#unifiedRecordPublication");
  manualConfirm.disabled = !eligibility.eligible;
  recordButton.disabled = !(eligibility.eligible && manualConfirm.checked);
  $("#unifiedPublicationBlockers").innerHTML = eligibility.eligible
    ? `<span class="clear">精确 Promotion 与 immutable version 已恢复，可以登记人工结果。</span>`
    : eligibility.blockers.map((item) => `<span>${escapeHtml(item)}</span>`).join("");
  $("#unifiedPublicationStateGrid").innerHTML = control ? Object.entries(control.states || {}).map(([key, value]) => `<span>${escapeHtml(key)}: <b>${escapeHtml(String(value))}</b></span>`).join("") : "";
  $("#unifiedPublicationExactRefs").innerHTML = control ? Object.entries(control.exactRefs || {}).map(([key, value]) => `<code>${escapeHtml(key)} ${escapeHtml(unifiedRefLabel(value))}</code>`).join("") : "";
  $("#unifiedPublicationResult").innerHTML = publication
    ? `<strong>Atomic Publication ${escapeHtml(publication.id)} · ${escapeHtml(String(publication.factHash || "").slice(0, 12))}…</strong><span>${escapeHtml(publication.canonicalPlatformContentId || publication.platformContentId || "missing platform content ID")} · ${escapeHtml(publication.publishedAt || "missing publishedAt")}</span><a href="${escapeHtml(publicationUrl || "#")}" ${publicationUrl ? 'target="_blank" rel="noreferrer"' : 'aria-disabled="true"'}>${escapeHtml(publicationUrl || "no canonical URL")}</a><code>Promotion ${escapeHtml(unifiedRefLabel(publication.promotionRef || publication.promotionRecordRef))}</code><code>Version ${escapeHtml(unifiedRefLabel(publication.promotedVersionRef))}</code>`
    : unifiedArtifactWorkbench.publicationConfirmUncertain
      ? `<strong>登记结果未知</strong><span>${escapeHtml(unifiedArtifactWorkbench.publicationConfirmUncertain)}</span><span>请保持表单不变并用同一幂等键安全重试。</span>`
      : `<span>尚未登记人工 Publication；这不是平台 API 发布按钮。</span>`;
  const feedbackButton = $("#unifiedRecordFeedback");
  feedbackButton.disabled = !publication;
  const history = asArray(publication?.metricHistory || control?.feedback?.items);
  $("#unifiedFeedbackResult").innerHTML = publication
    ? `<strong>${history.length} 个反馈 revision</strong>${history.slice().reverse().map((item) => `<span>${escapeHtml(item.measurementWindow)} · revision ${escapeHtml(item.revision)} · ${escapeHtml(item.dataQuality?.status || item.maturity?.timing || "待服务端评估")} · cutoff ${escapeHtml(item.cutoffAt || "缺失")}</span>`).join("") || "<span>尚无反馈快照。</span>"}${unifiedArtifactWorkbench.feedbackConfirmUncertain ? `<span>保存结果未知：${escapeHtml(unifiedArtifactWorkbench.feedbackConfirmUncertain)}。保持载荷不变可安全重试。</span>` : ""}`
    : `<span>等待精确 Publication。</span>`;
  $("#unifiedLifecycleResult").innerHTML = control?.lifecycle
    ? `<span>everPublished=${escapeHtml(String(control.lifecycle.everPublished))} · current=${escapeHtml(control.lifecycle.currentPlatformState)} · available=${escapeHtml(String(control.lifecycle.currentlyAvailable))}</span>`
    : `<span>No exact lifecycle fact; delivery/upload alone is not publication.</span>`;
  $("#unifiedRecordLifecycle").disabled = !(publication && $("#unifiedLifecycleManualConfirm").checked);
}

async function recordUnifiedAtomicManualPublication() {
  const eligibility = unifiedPublicationEligibility();
  if (!eligibility.eligible || !$("#unifiedPublicationManualConfirm").checked) return showToast(`Atomic Publication blocked: ${eligibility.blockers.join("; ") || "explicit confirmation required"}`);
  const projectId = unifiedProjectId(unifiedArtifactWorkbench.project);
  const platform = unifiedArtifactWorkbench.platform;
  const exactRequest = unifiedArtifactWorkbench.publicationControlState?.exactRequest;
  if (!exactRequest) return showToast("Exact Atomic publication scope is missing");
  let publishedAt;
  try { publishedAt = unifiedInputIso("#unifiedPublicationPublishedAt", "actual publishedAt"); }
  catch (error) { return showToast(error.message); }
  const platformContentId = $("#unifiedPublicationContentId").value.trim();
  const platformUrl = $("#unifiedPublicationUrl").value.trim();
  const actorId = $("#unifiedPublicationActorId").value.trim();
  if (!actorId) return showToast("Explicit user actor ID is required");
  if (platform === "wechat" && !platformUrl) return showToast("WeChat requires the canonical mp.weixin.qq.com article URL");
  if (!platformContentId && !platformUrl) return showToast("Canonical platform identity is required");
  if (platformUrl && !unifiedVerifiablePublicationUrl(platformUrl, platform)) return showToast("URL must be a verifiable HTTPS URL for the selected platform");
  if (!unifiedArtifactWorkbench.publicationIdempotencyKey) unifiedArtifactWorkbench.publicationIdempotencyKey = unifiedIdempotencyKey("atomic-manual-publication");
  try {
    const preflight = await window.FlowAPI.previewAtomicManualPublication(projectId, platform, exactRequest);
    unifiedArtifactWorkbench.publicationPreview = preflight;
    const result = await window.FlowAPI.confirmAtomicManualPublication(projectId, platform, {
      ...exactRequest, previewToken: preflight.previewToken,
      idempotencyKey: unifiedArtifactWorkbench.publicationIdempotencyKey,
      actorType: "user", actorId, method: "manual_platform_observation",
      confirmedAt: new Date().toISOString(), publishedAt, platformContentId: platformContentId || null, platformUrl: platformUrl || null
    });
    if (result.publication?.contract !== "ControlledManualPublication@1.0" || !result.publication.factHash) throw new Error("Server did not return an exact immutable Publication fact");
    $("#unifiedPublicationManualConfirm").checked = false;
    await loadUnifiedExistingPublication();
    renderUnifiedArtifactWorkbench();
    showToast("Atomic manual Publication confirmed; no platform API action was performed");
  } catch (error) {
    unifiedArtifactWorkbench.publicationConfirmUncertain = error.message;
    renderUnifiedPublicationPanel();
    showToast(`Atomic Publication not confirmed: ${error.message}`);
  }
}

async function recordUnifiedManualPublicationLegacy() {
  const eligibility = unifiedPublicationEligibility();
  if (!eligibility.eligible || !$("#unifiedPublicationManualConfirm").checked) return showToast(`Publication 已阻断：${eligibility.blockers.join("、") || "请确认已人工发布"}`);
  const promotion = unifiedArtifactWorkbench.promotionResult.promotion;
  const contentTaskId = unifiedPlatformSnapshot()?.reviewInput?.input?.promotion?.contentTaskId;
  const publishedAt = unifiedInputIso("#unifiedPublicationPublishedAt", "实际发布时间");
  if (Date.parse(publishedAt) > Date.now()) return showToast("实际发布时间不能是未来时间");
  const platformContentId = $("#unifiedPublicationContentId").value.trim();
  const url = $("#unifiedPublicationUrl").value.trim();
  if (!platformContentId && !url) return showToast("平台内容 ID 与可验证平台 URL 至少填写一项");
  if (url && !unifiedVerifiablePublicationUrl(url)) return showToast("平台 URL 必须是当前平台的可验证 HTTPS 地址");
  if (!unifiedArtifactWorkbench.publicationIdempotencyKey) unifiedArtifactWorkbench.publicationIdempotencyKey = unifiedIdempotencyKey("manual-publication");
  try {
    const { recordContentPublication } = window.FlowAPI;
    const publication = await recordContentPublication(contentTaskId, {
      status: "published", platform: unifiedArtifactWorkbench.platform, platformContentId, url, publishedAt,
      promotionId: promotion.id, promotedVersionRef: promotion.promotedVersionRef,
      idempotencyKey: unifiedArtifactWorkbench.publicationIdempotencyKey,
      note: "用户确认已在平台人工完成；FlowSocial 仅登记结果，未调用平台发布 API。"
    });
    if (publication.promotionStatus !== "promoted_exact_version"
      || !unifiedSameRef(publication.promotionRecordRef, { id: promotion.id, hash: promotion.promotionHash })
      || !unifiedSameRef(publication.promotedVersionRef, promotion.promotedVersionRef)) throw new Error("服务端 Publication 未返回精确 Promotion 绑定");
    unifiedArtifactWorkbench.publicationResult = publication;
    unifiedArtifactWorkbench.publicationHistoryStatus = "loaded";
    unifiedArtifactWorkbench.publicationConfirmUncertain = "";
    $("#unifiedPublicationManualConfirm").checked = false;
    renderUnifiedArtifactWorkbench();
    showToast("人工 Publication 已登记；未调用平台发布 API");
  } catch (error) {
    unifiedArtifactWorkbench.publicationConfirmUncertain = error.message;
    if (error.status) await loadUnifiedExistingPublication();
    renderUnifiedPublicationPanel();
    showToast(error.status ? `Publication 未登记：${error.message}` : `登记结果未知；请用同一幂等键重试：${error.message}`);
  }
}

async function recordUnifiedManualPublication() {
  return unifiedArtifactWorkbench.atomicPublicationCutoverEnabled
    ? recordUnifiedAtomicManualPublication()
    : recordUnifiedManualPublicationLegacy();
}

async function recordUnifiedAtomicPublicationFeedback() {
  const publication = unifiedArtifactWorkbench.publicationResult;
  if (!publication?.factHash) return showToast("Exact immutable Publication is required");
  const projectId = unifiedProjectId(unifiedArtifactWorkbench.project);
  const platform = unifiedArtifactWorkbench.platform;
  const evidenceId = $("#unifiedFeedbackEvidenceId").value.trim();
  const evidenceHash = $("#unifiedFeedbackEvidenceHash").value.trim();
  const actorId = $("#unifiedPublicationActorId").value.trim();
  if (!actorId || !evidenceId || !/^[a-f0-9]{64}$/.test(evidenceHash)) return showToast("Actor and exact source evidence {id, SHA-256} are required");
  let cutoffAt;
  try { cutoffAt = unifiedInputIso("#unifiedFeedbackCutoffAt", "feedback cutoffAt"); }
  catch (error) { return showToast(error.message); }
  const label = $("#unifiedFeedbackWindow").value;
  const startMs = Date.parse(publication.publishedAt);
  const endMs = label === "72h" ? startMs + 72 * 36e5 : label === "7d" ? startMs + 168 * 36e5 : Date.parse(cutoffAt);
  const raw = {
    impressions: unifiedMetricValue("#unifiedFeedbackImpressions"), views: unifiedMetricValue("#unifiedFeedbackViews"),
    likes: unifiedMetricValue("#unifiedFeedbackLikes"), saves: unifiedMetricValue("#unifiedFeedbackSaves"),
    comments: unifiedMetricValue("#unifiedFeedbackComments"), shares: unifiedMetricValue("#unifiedFeedbackShares")
  };
  let extra = {};
  try { extra = JSON.parse($("#unifiedFeedbackPlatformMetrics").value.trim() || "{}"); }
  catch { return showToast("Platform metrics must be valid JSON"); }
  const metrics = platform === "wechat"
    ? { reads: raw.views, likes: raw.likes, shares: raw.shares, favorites: raw.saves, comments: raw.comments, ...extra }
    : { ...raw, ...extra };
  Object.keys(metrics).forEach((key) => { if (metrics[key] == null) delete metrics[key]; });
  if (!Object.keys(metrics).length || Object.values(metrics).some((value) => !Number.isSafeInteger(value) || value < 0)) return showToast("At least one non-negative integer platform metric is required");
  const request = {
    workspaceId: publication.workspaceId, companyId: publication.companyId, accountId: publication.accountId,
    platform, publicationRef: { id: publication.id, hash: publication.factHash },
    platformContentId: publication.canonicalPlatformContentId, platformUrl: publication.canonicalPlatformUrl
  };
  if (!unifiedArtifactWorkbench.feedbackIdempotencyKey) unifiedArtifactWorkbench.feedbackIdempotencyKey = unifiedIdempotencyKey(`atomic-feedback-${label}`);
  try {
    const preflight = await window.FlowAPI.previewAtomicPublicationFeedback(projectId, platform, request);
    unifiedArtifactWorkbench.feedbackPreview = preflight;
    const result = await window.FlowAPI.confirmAtomicPublicationFeedback(projectId, platform, {
      ...request, previewToken: preflight.previewToken, requestHash: preflight.requestHash,
      idempotencyKey: unifiedArtifactWorkbench.feedbackIdempotencyKey,
      actorType: "user", actorId,
      measurementWindow: { label, startedAt: new Date(startMs).toISOString(), endedAt: new Date(endMs).toISOString() },
      cutoffAt, collectedAt: new Date().toISOString(), source: { kind: "manual_entry", evidenceRef: { id: evidenceId, hash: evidenceHash } }, metrics
    });
    if (result.snapshot?.contract !== "PublicationMetricSnapshot@3.0" || !result.snapshot.snapshotHash) throw new Error("Server did not return an exact immutable feedback snapshot");
    unifiedArtifactWorkbench.feedbackIdempotencyKey = "";
    await loadUnifiedExistingPublication();
    renderUnifiedPublicationPanel();
    showToast(`Atomic feedback ${result.snapshot.id} recorded`);
  } catch (error) {
    unifiedArtifactWorkbench.feedbackConfirmUncertain = error.message;
    renderUnifiedPublicationPanel();
    showToast(`Atomic feedback not recorded: ${error.message}`);
  }
}

async function recordUnifiedPublicationFeedbackLegacy() {
  const publication = unifiedArtifactWorkbench.publicationResult;
  if (!publication) return showToast("反馈必须绑定当前精确 Publication");
  let platformMetrics = {};
  const rawPlatformMetrics = $("#unifiedFeedbackPlatformMetrics").value.trim();
  try { platformMetrics = rawPlatformMetrics ? JSON.parse(rawPlatformMetrics) : {}; }
  catch { return showToast("平台指标必须是有效 JSON 对象"); }
  if (!platformMetrics || Array.isArray(platformMetrics) || typeof platformMetrics !== "object") return showToast("平台指标必须是 JSON 对象");
  let cutoffAt;
  try { cutoffAt = unifiedInputIso("#unifiedFeedbackCutoffAt", "指标截止时间"); }
  catch (error) { return showToast(error.message); }
  const payload = {
    measurementWindow: $("#unifiedFeedbackWindow").value,
    cutoffAt,
    impressions: unifiedMetricValue("#unifiedFeedbackImpressions"), views: unifiedMetricValue("#unifiedFeedbackViews"),
    likes: unifiedMetricValue("#unifiedFeedbackLikes"), saves: unifiedMetricValue("#unifiedFeedbackSaves"),
    comments: unifiedMetricValue("#unifiedFeedbackComments"), shares: unifiedMetricValue("#unifiedFeedbackShares"),
    platformMetrics, source: "manual",
    userFeedback: { qualitativeResult: $("#unifiedFeedbackQualitative").value.trim() }
  };
  try {
    const { recordPublicationMetrics } = window.FlowAPI;
    const result = await recordPublicationMetrics(publication.id, payload);
    unifiedArtifactWorkbench.publicationResult = result.publication;
    unifiedArtifactWorkbench.feedbackConfirmUncertain = "";
    renderUnifiedPublicationPanel();
    showToast(`反馈已绑定 ${publication.id} · ${result.snapshot.measurementWindow} revision ${result.snapshot.revision}`);
  } catch (error) {
    unifiedArtifactWorkbench.feedbackConfirmUncertain = error.message;
    if (error.status) await loadUnifiedExistingPublication();
    renderUnifiedPublicationPanel();
    showToast(error.status ? `反馈未保存：${error.message}` : `反馈结果未知；保持载荷不变可安全重试：${error.message}`);
  }
}

async function recordUnifiedPublicationFeedback() {
  return unifiedArtifactWorkbench.atomicPublicationCutoverEnabled
    ? recordUnifiedAtomicPublicationFeedback()
    : recordUnifiedPublicationFeedbackLegacy();
}

async function recordUnifiedPublicationLifecycle() {
  const publication = unifiedArtifactWorkbench.publicationResult;
  const control = unifiedArtifactWorkbench.publicationControlState;
  if (!unifiedArtifactWorkbench.atomicPublicationCutoverEnabled || !publication?.factHash || !control?.lifecycle) return showToast("Exact Atomic Publication lifecycle state is required");
  if (!$("#unifiedLifecycleManualConfirm").checked) return showToast("Explicit human platform observation confirmation is required");
  const actorId = $("#unifiedPublicationActorId").value.trim();
  const evidenceId = $("#unifiedFeedbackEvidenceId").value.trim();
  const evidenceHash = $("#unifiedFeedbackEvidenceHash").value.trim();
  if (!actorId || !evidenceId || !/^[a-f0-9]{64}$/.test(evidenceHash)) return showToast("Actor and exact lifecycle evidence {id, SHA-256} are required");
  const action = $("#unifiedLifecycleAction").value;
  const now = new Date().toISOString();
  const request = {
    workspaceId: publication.workspaceId, companyId: publication.companyId, accountId: publication.accountId,
    platform: publication.platform, publicationRef: { id: publication.id, hash: publication.factHash },
    platformContentId: publication.canonicalPlatformContentId, platformUrl: publication.canonicalPlatformUrl
  };
  const common = {
    ...request, expectedLifecycleHeadRef: control.lifecycle.lifecycleHeadRef,
    idempotencyKey: unifiedIdempotencyKey(`atomic-lifecycle-${action}`), actorType: "user", actorId,
    method: "manual_platform_observation", observedAt: now, evidenceRefs: [{ id: evidenceId, hash: evidenceHash }]
  };
  try {
    let payload;
    if (action === "takedown") payload = { ...common, action: "unpublish", actionAttemptedAt: now, outcome: "confirmed_removed", observedAvailability: "unavailable" };
    else if (action === "correction") payload = { ...common, effectivePublishedAt: null };
    else {
      const replacementRequest = JSON.parse($("#unifiedLifecycleReplacementRequest").value.trim() || "null");
      const confirmedTakedownRef = JSON.parse($("#unifiedLifecycleTakedownRef").value.trim() || "null");
      if (!replacementRequest?.publicationRef || !confirmedTakedownRef?.id) throw new Error("Replacement requires an exact replacement request and confirmed takedown ref");
      const replacementState = await window.FlowAPI.getAtomicPublicationLifecycleState(unifiedProjectId(unifiedArtifactWorkbench.project), publication.platform, replacementRequest);
      payload = { ...common, replacementRequest, confirmedTakedownRef, expectedReplacementLifecycleHeadRef: replacementState.lifecycleHeadRef };
    }
    const result = await window.FlowAPI.confirmAtomicPublicationLifecycle(unifiedProjectId(unifiedArtifactWorkbench.project), publication.platform, action, payload);
    if (!result.fact?.factHash) throw new Error("Server did not return an immutable lifecycle fact");
    $("#unifiedLifecycleManualConfirm").checked = false;
    await loadUnifiedExistingPublication();
    renderUnifiedPublicationPanel();
    showToast(`Lifecycle observation ${result.fact.id} recorded; FlowSocial performed no platform action`);
  } catch (error) { showToast(`Lifecycle observation not recorded: ${error.message}`); }
}
// UNIFIED_CONTENT_PUBLICATION_FEEDBACK_UI_END

async function loadUnifiedArtifactReviewProjects({ preserveSelection = true } = {}) {
  if (!unifiedArtifactWorkbench.enabled || window.FlowAPI.mode !== "live") return;
  try {
    const result = await window.FlowAPI.listUnifiedContentProjects(unifiedProjectListScope());
    renderUnifiedArtifactProjectOptions(result, { preserveSelection });
    // Do not infer the current production step from any existing project
    // candidate. A project card may be an older delivery; the production
    // entry must remain at “outline awaiting confirmation” until this
    // bootstrap explicitly completes the selected platform.
  } catch (error) {
    $("#unifiedArtifactScopeHint").textContent = `项目列表不可用：${error.message}`;
    showToast(`统一项目加载失败：${error.message}`);
  }
}

function renderUnifiedArtifactProjectOptions(result, { preserveSelection = true } = {}) {
  const previousProjectId = preserveSelection ? unifiedProjectId(unifiedArtifactWorkbench.project) : "";
  unifiedArtifactWorkbench.projects = unifiedProjectList(result);
  const select = $("#unifiedArtifactProject");
  select.innerHTML = `<option value="">请选择项目</option>${unifiedArtifactWorkbench.projects.map((project) => {
    const id = unifiedProjectId(project);
    const label = project.contentProject?.title || project.title || id;
    return `<option value="${escapeHtml(id)}">${escapeHtml(label)}</option>`;
  }).join("")}`;
  if (previousProjectId && unifiedArtifactWorkbench.projects.some((item) => unifiedProjectId(item) === previousProjectId)) select.value = previousProjectId;
  $("#unifiedArtifactScopeHint").textContent = unifiedArtifactWorkbench.projects.length ? "请选择 Content Project；随后仍需显式选择平台和候选。" : "当前服务端没有可审阅的统一 Content Project。";
  renderContentProductionProjectGrid();
}

function contentProductionProjectTitle(project) {
  const platforms = unifiedProjectPlatforms(project);
  const xhs = platforms.find((item) => item.platform === "xiaohongshu");
  const wechat = platforms.find((item) => item.platform === "wechat");
  const wechatArticle = wechat?.article?.article || wechat?.article || wechat?.wechat?.article?.article || wechat?.wechat?.article || null;
  return project?.contentProject?.title || project?.title || project?.topicIntent?.topic || project?.contentProject?.topicIntent?.topic
    || xhs?.xiaohongshu?.title || xhs?.title || wechat?.wechat?.article?.title || wechat?.article?.title
    || wechatArticle?.recommended_title || wechatArticle?.title || wechatArticle?.article_title
    || wechatArticle?.title_candidates?.[0]?.title || wechatArticle?.title_candidates?.[0] || "未命名内容项目";
}

function contentProductionPlatformSummary(project, platform) {
  const snapshot = unifiedProjectPlatforms(project).find((item) => item.platform === platform);
  if (!snapshot) return { label: "尚未创建", tone: "muted", count: 0 };
  const candidates = [...asArray(snapshot.candidateRefs)];
  for (const ref of [snapshot.candidateRef, snapshot.articleRef]) {
    if (ref?.id && !candidates.some((item) => item.id === ref.id)) candidates.push(ref);
  }
  if (snapshot.publicationRecordRef || snapshot.publicationRef) return { label: "已登记发布", tone: "success", count: candidates.length };
  if (snapshot.promotionRecordRef || snapshot.promotionRef) return { label: "已有正式版本", tone: "success", count: candidates.length };
  if (candidates.length) return { label: `${candidates.length} 个待审版本`, tone: "progress", count: candidates.length };
  return { label: "等待生成", tone: "muted", count: 0 };
}

function contentProductionUpdatedAt(project) {
  const platformDates = unifiedProjectPlatforms(project).flatMap((snapshot) => [
    snapshot?.updatedAt, snapshot?.createdAt, snapshot?.materializedContentProject?.updatedAt,
    snapshot?.materializedContentProject?.createdAt, snapshot?.xiaohongshu?.updatedAt,
    snapshot?.wechat?.updatedAt
  ]).filter(Boolean);
  const value = [project?.updatedAt, project?.contentProject?.updatedAt, project?.createdAt, project?.contentProject?.createdAt, ...platformDates]
    .filter(Boolean).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
  if (!value) return "最近更新";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "最近更新" : date.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}

function contentProductionLogicalProjectId(project) {
  return unifiedProjectId(project).split(":revision:")[0];
}

function contentProductionPlatformTasks(projects = unifiedArtifactWorkbench.projects) {
  const tasks = new Map();
  for (const project of projects) {
    for (const snapshot of unifiedProjectPlatforms(project)) {
      if (!["xiaohongshu", "wechat"].includes(snapshot.platform) || ["not_materialized", "pending"].includes(snapshot.state)) continue;
      const hasContent = Boolean(snapshot.candidateRef || snapshot.articleRef || asArray(snapshot.candidateRefs).length);
      if (!hasContent) continue;
      const key = `${contentProductionLogicalProjectId(project)}:${snapshot.platform}`;
      const rank = Math.max(0, ...[
        project?.updatedAt, project?.createdAt, project?.contentProject?.updatedAt, project?.contentProject?.createdAt,
        snapshot?.updatedAt, snapshot?.createdAt, snapshot?.materializedContentProject?.updatedAt, snapshot?.materializedContentProject?.createdAt
      ].filter(Boolean).map((value) => new Date(value).getTime()).filter(Number.isFinite));
      const prior = tasks.get(key);
      if (!prior || rank > prior.rank || (rank === prior.rank && unifiedProjectId(project).includes(":revision:"))) tasks.set(key, { project, platform: snapshot.platform, rank });
    }
  }
  return [...tasks.values()].sort((a, b) => b.rank - a.rank);
}

function renderContentProductionProjectGrid() {
  const grid = $("#contentProductionProjectGrid");
  if (!grid) return;
  const query = String(unifiedArtifactWorkbench.studioSearch || "").trim().toLowerCase();
  const tasks = contentProductionPlatformTasks().filter(({ project }) => {
    if (!query) return true;
    return `${contentProductionProjectTitle(project)} ${unifiedProjectId(project)}`.toLowerCase().includes(query);
  });
  const count = $("#contentProductionProjectCount");
  if (count) count.textContent = query ? `找到 ${tasks.length} 个平台任务` : `${tasks.length} 个平台任务`;
  if (!tasks.length) {
    grid.innerHTML = `<div class="content-project-empty"><h2>${query ? "没有匹配的平台任务" : "还没有平台内容任务"}</h2><p>${query ? "换一个关键词，或返回查看全部任务。" : "从内容计划选择小红书或公众号任务；两个平台会分别进入各自工作区。"}</p>${query ? "" : `<button class="btn primary" type="button" data-content-create-empty>创建第一篇小红书图文</button>`}</div>`;
    return;
  }
  grid.innerHTML = tasks.map(({ project, platform }) => {
    const summary = contentProductionPlatformSummary(project, platform);
    const name = platform === "wechat" ? "公众号" : "小红书";
    const type = platform === "wechat" ? "长文章制作" : "整页图文制作";
    return `<button class="content-project-card platform-task-card ${platform}" type="button" data-content-project="${escapeHtml(unifiedProjectId(project))}" data-content-platform="${platform}">
      <span class="content-project-date">${escapeHtml(contentProductionUpdatedAt(project))}</span>
      <span class="content-project-platform-row"><i class="platform-mark ${platform === "wechat" ? "wechat" : "xhs"}">${name}</i><b class="${summary.tone}">${escapeHtml(summary.label)}</b></span>
      <strong>${escapeHtml(contentProductionProjectTitle(project))}</strong>
      <small>${type}</small>
      <em>进入${name}工作区</em>
    </button>`;
  }).join("");
}

function setContentProductionMode(mode) {
  unifiedArtifactWorkbench.studioMode = mode;
  const studio = $("#contentProductionStudio");
  if (studio) studio.dataset.studioMode = mode;
  if ($("#contentProductionHome")) $("#contentProductionHome").hidden = mode !== "projects";
  if ($("#contentProductionDetail")) $("#contentProductionDetail").hidden = mode !== "detail";
  if ($("#unifiedProductionEntry")) $("#unifiedProductionEntry").hidden = mode !== "create";
  if (mode === "projects") renderContentProductionProjectGrid();
}

async function openContentProductionPlatform(platform) {
  const selected = platform === "wechat" ? "wechat" : "xiaohongshu";
  unifiedArtifactWorkbench.platformScope = selected;
  $$("[data-production-platform]").forEach((item) => item.classList.toggle("active", item.dataset.productionPlatform === selected));
  const project = contentProductionPlatformTasks().find((item) => item.platform === selected)?.project;
  if (project) {
    await chooseUnifiedArtifactProject(unifiedProjectId(project));
    setContentProductionMode("detail");
    await selectContentProductionTab(selected);
    return;
  }
  await openUnifiedPlatformProductionEntry(selected);
}

function renderContentProductionCurrentProject() {
  const project = unifiedArtifactWorkbench.project;
  if (!project) return;
  const title = contentProductionProjectTitle(project);
  const xhs = contentProductionPlatformSummary(project, "xiaohongshu");
  const wechat = contentProductionPlatformSummary(project, "wechat");
  $("#contentProductionTitle").textContent = title;
  $("#contentProductionSummary").textContent = `${unifiedArtifactWorkbench.platformScope === "wechat" ? "公众号" : "小红书"}只显示本平台的内容版本、审阅和交付；策略与事实仅作为上游输入。`;
  $("#contentProductionPlatformStatus").innerHTML = `
    <button type="button" data-content-project-platform="xiaohongshu"><span class="platform-mark xhs">小红书</span><strong>${escapeHtml(xhs.label)}</strong></button>
    <button type="button" data-content-project-platform="wechat"><span class="platform-mark wechat">公众号</span><strong>${escapeHtml(wechat.label)}</strong></button>`;
}

function renderContentProductionCandidateCards() {
  const grid = $("#contentProductionCandidateCards");
  if (!grid) return;
  if (unifiedArtifactWorkbench.projectLoadState === "loading") {
    grid.innerHTML = `<div class="empty-state">正在加载当前项目与版本…</div>`;
    return;
  }
  const platform = unifiedArtifactWorkbench.platform;
  const snapshot = unifiedPlatformSnapshot();
  const candidates = [...asArray(snapshot?.candidateRefs)];
  for (const ref of [snapshot?.candidateRef, snapshot?.articleRef]) {
    if (ref?.id && !candidates.some((item) => item.id === ref.id)) candidates.push(ref);
  }
  const platformName = platform === "wechat" ? "公众号" : "小红书";
  $("#contentProductionPlatformEyebrow").textContent = `${platformName}工作区`;
  $("#contentProductionCandidateTitle").textContent = candidates.length ? `选择要继续的${platformName}版本` : `${platformName}内容尚未生成`;
  $("#contentProductionCandidateHint").textContent = candidates.length ? "打开版本只用于查看和继续编辑；最终采用仍需要你在审阅区明确确认。" : "请先回到项目总览完成大纲确认和内容生成。";
  const scopeProjectId = unifiedProjectId(unifiedArtifactWorkbench.project);
  grid.innerHTML = candidates.length ? candidates.map((ref, index) => `<button type="button" class="content-candidate-card ${ref.id === unifiedArtifactWorkbench.candidateId ? "selected" : ""}" data-content-candidate="${escapeHtml(ref.id)}" data-scope-project="${escapeHtml(scopeProjectId)}" data-scope-platform="${escapeHtml(platform)}"><span>版本 ${index + 1}</span><strong>${ref.id === unifiedArtifactWorkbench.candidateId ? "正在查看" : "打开此版本"}</strong><small>${index === candidates.length - 1 ? "最新生成" : "历史版本"}</small></button>`).join("") : `<div class="empty-state">当前平台没有可审阅版本。</div>`;
}

async function selectContentProductionTab(tab) {
  unifiedArtifactWorkbench.studioTab = tab;
  const studio = $("#contentProductionStudio");
  if (studio) studio.dataset.studioTab = tab;
  $$('[data-content-studio-tab]').forEach((button) => button.classList.toggle("active", button.dataset.contentStudioTab === tab));
  if ($("#contentProductionWelcome")) $("#contentProductionWelcome").hidden = tab !== "overview";
  if ($("#contentProductionCandidatePicker")) $("#contentProductionCandidatePicker").hidden = tab === "overview";
  if (tab === "overview") return;
  const platform = tab === "wechat" ? "wechat" : tab === "xiaohongshu" ? "xiaohongshu" : (unifiedArtifactWorkbench.platform || "xiaohongshu");
  unifiedArtifactWorkbench.platformScope = platform;
  const platformSelect = $("#unifiedArtifactPlatform");
  if (platformSelect) platformSelect.value = platform;
  if (unifiedArtifactWorkbench.platform !== platform) await chooseUnifiedArtifactPlatform(platform);
  renderContentProductionCandidateCards();
}

async function openContentProductionProject(projectId, tab = "overview") {
  const select = $("#unifiedArtifactProject");
  if (select) select.value = projectId;
  beginUnifiedScopeTransition("正在打开所选项目…");
  await chooseUnifiedArtifactProject(projectId);
  if (!unifiedArtifactWorkbench.project) return setContentProductionMode("projects");
  setContentProductionMode("detail");
  renderContentProductionCurrentProject();
  await selectContentProductionTab(tab);
}

function selectedUnifiedProductionEntry() {
  return unifiedArtifactWorkbench.entryOptions.find((item) => item.id === unifiedArtifactWorkbench.selectedEntryOptionId) || null;
}

function unifiedProductionBootstrapFrom(result) {
  return result?.bootstrap || result?.item || result || null;
}

function unifiedProductionProjectId(entry) {
  const authorityHash = String(entry?.prerequisiteRef?.hash || "").slice(0, 24);
  if (authorityHash) return `unified_project_${authorityHash}`;
  const topic = String(entry?.topicIntent?.topic || "content").toLowerCase()
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 28) || "content";
  return `unified_project_ui_${topic}`;
}

function renderReadablePlatformOutline(outline, platform) {
  if (!outline) return "";
  const sections = asArray(outline.sections);
  const sectionMarkup = sections.map((section, index) => `
    <article class="outline-review-section">
      <span>${platform === "xiaohongshu" ? `第 ${index + 1} 页` : `第 ${index + 1} 节`}</span>
      <div><h4>${escapeHtml(section.heading || `部分 ${index + 1}`)}</h4><p>${escapeHtml(section.objective || "")}</p>
      ${asArray(section.key_points).length ? `<ul>${asArray(section.key_points).map((point) => `<li>${escapeHtml(point)}</li>`).join("")}</ul>` : ""}</div>
    </article>`).join("");
  return `<div class="outline-readable">
    <section class="outline-readable-summary"><div><small>这篇内容要解决什么</small><strong>${escapeHtml(outline.content_promise || outline.topic || "待补充")}</strong></div><div><small>怎么开场</small><p>${escapeHtml(outline.opening_strategy || "直接进入主题")}</p></div></section>
    <div class="outline-review-sections">${sectionMarkup}</div>
    ${outline.closing_strategy ? `<p class="outline-closing"><b>结尾方式</b>${escapeHtml(outline.closing_strategy)}</p>` : ""}
  </div>`;
}

function renderUnifiedProductionEntry() {
  const entry = selectedUnifiedProductionEntry();
  const bootstrap = unifiedArtifactWorkbench.bootstrap;
  const projectId = $("#unifiedProductionProjectId")?.value.trim() || "";
  const actorId = $("#unifiedProductionActor")?.value.trim() || "";
  const busy = unifiedArtifactWorkbench.bootstrapBusy;
  const state = bootstrap?.state || "not_started";
  const xhsOnly = unifiedArtifactWorkbench.platformScope === "xiaohongshu";
  const platformName = xhsOnly ? "小红书" : "公众号";
  const platformEnglish = xhsOnly ? "小红书制作" : "公众号制作";
  const platformDescription = xhsOnly
    ? "从小红书图文大纲开始，逐页确认生图方向、图片修改和最终版本。"
    : "从公众号文章大纲开始，确认正文、配图规划和最终文章版本。";
  if ($("#unifiedProductionPlatformEyebrow")) $("#unifiedProductionPlatformEyebrow").textContent = platformEnglish;
  if ($("#unifiedProductionPlatformTitle")) $("#unifiedProductionPlatformTitle").textContent = `${platformName}内容生产`;
  if ($("#unifiedProductionPlatformDescription")) $("#unifiedProductionPlatformDescription").textContent = platformDescription;
  const platformDone = unifiedArtifactWorkbench.platformProductionStatus[xhsOnly ? "xiaohongshu" : "wechat"] === "completed";
  const stateLabels = { not_started: "尚未开始", awaiting_outline_confirmation: xhsOnly ? "小红书大纲待确认" : "平台大纲待确认", confirmed: "大纲已确认，可以生成内容", completed: "内容已生成，可以进入平台工作区", rejected: "已退回，等待创建修订版" };
  const bindings = $("#unifiedProductionBindings");
  if (bindings) bindings.innerHTML = entry ? `
    <div><dt>内容主题</dt><dd>${escapeHtml(entry.topicIntent?.topic || "—")}</dd></div>
    <div><dt>制作平台</dt><dd>${xhsOnly ? "小红书整页图文" : "按当前入口独立制作"}</dd></div>
    <div><dt>策略来源</dt><dd>已确认策略</dd></div>
    <div><dt>当前进度</dt><dd>${escapeHtml(platformDone ? "内容已生成，可以进入平台工作区" : stateLabels[state] || "处理中")}</dd></div>`
    : `<div><dt>状态</dt><dd>等待选择权威输入</dd></div>`;
  const productionForm = $(".unified-production-form");
  if (productionForm) productionForm.hidden = Boolean(entry);

  const outlines = $("#unifiedProductionOutlines");
  if (outlines) {
    const platformCard = (platform, name, type) => {
      const outline = bootstrap?.outlines?.[platform] || null;
      const confirmed = unifiedArtifactWorkbench.outlineConfirmations?.[platform] || bootstrap?.confirmation || null;
      const done = unifiedArtifactWorkbench.platformProductionStatus[platform] === "completed";
      const status = done ? "内容已生成" : confirmed ? "已确认" : outline ? "等待你确认" : entry ? "等待生成大纲" : "等待选择内容方向";
      const canReview = state === "awaiting_outline_confirmation" && Boolean(outline) && !confirmed && !busy;
      return `<article class="content-platform-start-card ${platform}">
        <header><span class="platform-mark ${platform === "wechat" ? "wechat" : "xhs"}">${name}</span><strong>${type}</strong><em class="${confirmed ? "safe" : outline ? "warn" : "muted"}">${status}</em></header>
        ${outline ? renderReadablePlatformOutline(outline, platform) : `<p>${platform === "wechat" ? "公众号将独立生成文章结构、章节逻辑和配图位置。" : "小红书将独立生成分页节奏、每页文字和整页生图方向。"}</p>`}
        <div class="content-platform-start-actions" ${done ? "" : outline && state === "awaiting_outline_confirmation" ? "" : "hidden"}>
          ${done ? `<button class="btn primary" type="button" data-enter-platform-workspace="${platform}">进入${name}内容工作台</button>` : ""}
          ${done ? "" : confirmed ? `<button class="btn primary" type="button" data-resume-platform-production="${platform}" ${busy ? "disabled" : ""}>继续生成${name}内容</button>` : `<button class="btn primary" type="button" data-confirm-platform-outline="${platform}" ${canReview ? "" : "disabled"}>确认大纲并生成内容</button>
          <button class="btn secondary" type="button" data-open-outline-chat="${platform}" ${canReview ? "" : "disabled"}>和 AI 修改大纲</button>`}
        </div>
        <section class="outline-ai-chat" data-outline-chat="${platform}" hidden>
          <div class="outline-ai-message"><b>AI</b><p>告诉我你想怎么改。你可以直接说“删掉第 4 页”“开头更直接”“把重点改成复购”，当前版本会保留。</p></div>
          <label><span>修改要求</span><textarea rows="3" data-outline-instruction="${platform}" placeholder="用自然语言描述你想修改的大纲内容"></textarea></label>
          <div><button class="btn secondary" type="button" data-cancel-outline-chat="${platform}">取消</button><button class="btn primary" type="button" data-submit-outline-chat="${platform}">发送给 AI 并生成新版大纲</button></div>
        </section>
      </article>`;
    };
    const selectedPlatform = unifiedArtifactWorkbench.platformScope === "wechat" ? "wechat" : "xiaohongshu";
    outlines.innerHTML = platformCard(selectedPlatform, selectedPlatform === "wechat" ? "公众号" : "小红书", selectedPlatform === "wechat" ? "长文章工作区" : "整页图文工作区");
  }

  const result = $("#unifiedProductionResult");
  if (result) result.innerHTML = unifiedArtifactWorkbench.productionNotice
    ? `<span>${escapeHtml(unifiedArtifactWorkbench.productionNotice)}</span>`
    : busy && !bootstrap
      ? `<strong>正在生成${platformName}大纲</strong><span>正在准备内容主轴和平台大纲，请不要重复点击。</span>`
    : bootstrap
      ? `<strong>${escapeHtml(stateLabels[state] || "任务处理中")}</strong><span>${state === "completed" ? `${xhsOnly ? "小红书正文与视觉方案" : "平台内容"}已生成，可以继续制作。` : state === "rejected" ? "本次大纲已保留；创建修订版不会覆盖历史版本。" : "当前不会自动生图、创建草稿或发布。"}</span>`
      : entry ? "尚未生成平台大纲。" : "请先从内容计划采纳一个排期方向；系统会自动带入权威输入和项目，不需要手填技术 ID。";

  const start = $("#unifiedProductionStart");
  if (start) {
    const scopedRequestReusable = unifiedArtifactWorkbench.bootstrapRequest?.targetPlatform === (xhsOnly ? "xiaohongshu" : "wechat");
    start.hidden = Boolean(bootstrap && state !== "rejected") || !entry;
    start.textContent = state === "rejected"
      ? "根据反馈生成小红书修订大纲"
      : !bootstrap && scopedRequestReusable
        ? "使用原请求键继续生成"
        : !bootstrap && unifiedArtifactWorkbench.bootstrapRequest?.idempotencyKey
          ? `按${platformName}重新规划`
        : xhsOnly ? "生成小红书图文大纲" : "生成当前平台大纲";
    start.disabled = busy || !entry || !projectId || !actorId || Boolean(bootstrap && state !== "rejected");
  }
  const reconcile = $("#unifiedProductionReconcile");
  if (reconcile) {
    const canReconcile = Boolean(unifiedArtifactWorkbench.bootstrapRequest?.idempotencyKey && !bootstrap);
    reconcile.hidden = !canReconcile;
    reconcile.disabled = busy || !canReconcile;
  }
  if ($("#unifiedProductionResume")) {
    $("#unifiedProductionResume").hidden = state !== "confirmed";
    $("#unifiedProductionResume").textContent = xhsOnly ? "生成小红书正文与视觉方案" : "进入平台工作区";
    $("#unifiedProductionResume").disabled = busy || state !== "confirmed";
  }
  renderUnifiedProductionControl();
}

const unifiedPlanningStageLabels = Object.freeze({
  authority: "权威输入校验",
  master: "内容母稿",
  xiaohongshu_outline: "小红书大纲",
  wechat_outline: "公众号大纲",
  finalize: "规划收尾"
});

async function reconcileUnifiedProductionPlanning() {
  const request = unifiedArtifactWorkbench.bootstrapRequest;
  const entry = selectedUnifiedProductionEntry();
  if (!request?.idempotencyKey || !entry) return;
  const projectId = $("#unifiedProductionProjectId")?.value.trim() || request.projectId || "";
  const companyId = request.companyId || entry.companyId || "";
  unifiedArtifactWorkbench.bootstrapBusy = true;
  renderUnifiedProductionEntry();
  try {
    const result = await window.FlowAPI.listUnifiedContentPlanningAttempts({ companyId, projectId, requestId: request.requestId || request.idempotencyKey });
    const attempt = asArray(result?.items).at(-1);
    if (!attempt) {
      unifiedArtifactWorkbench.productionNotice = `尚未找到请求 ${request.idempotencyKey} 的对账记录。请稍后再次刷新，系统不会创建新请求。`;
    } else if (attempt.status === "succeeded" && attempt.bootstrapId) {
      unifiedArtifactWorkbench.bootstrap = unifiedProductionBootstrapFrom(await window.FlowAPI.getUnifiedContentBootstrap(attempt.bootstrapId));
      unifiedArtifactWorkbench.productionNotice = "已对账：大纲生成成功，等待人工核对。";
      await loadUnifiedPlatformOutlineConfirmations();
    } else if (attempt.status === "failed") {
      const stage = unifiedArtifactWorkbench.platformScope === "wechat" && attempt.currentStage === "xiaohongshu_outline"
        ? "共享内容规划"
        : unifiedPlanningStageLabels[attempt.currentStage] || attempt.currentStage || "未知阶段";
      const failure = attempt.lastSafeFailure || {};
      const reason = failure.causeCode || "DEPENDENCY_FAILED";
      const samePlatform = request.targetPlatform === (unifiedArtifactWorkbench.platformScope === "wechat" ? "wechat" : "xiaohongshu");
      unifiedArtifactWorkbench.productionNotice = samePlatform
        ? `规划失败于“${stage}”（${reason}）。请求键 ${request.idempotencyKey} 已保留；恢复只会继续当前平台规划。`
        : `旧双平台规划失败于“${stage}”（${reason}）。不会重试旧请求；下一次将按当前平台独立规划。`;
    } else {
      const stage = unifiedPlanningStageLabels[attempt.currentStage] || attempt.currentStage || "准备阶段";
      unifiedArtifactWorkbench.productionNotice = `请求仍在“${stage}”处理中（${attempt.status || "running"}）。请稍后刷新，系统不会重复调用。`;
    }
  } catch (error) {
    unifiedArtifactWorkbench.productionNotice = `请求对账失败：${error.message}。当前请求键仍被冻结，请勿新建请求。`;
  } finally {
    unifiedArtifactWorkbench.bootstrapBusy = false;
    renderUnifiedProductionEntry();
  }
}

async function loadUnifiedPlatformOutlineConfirmations() {
  const bootstrap = unifiedArtifactWorkbench.bootstrap;
  if (!bootstrap?.id || !["awaiting_outline_confirmation", "confirmed"].includes(bootstrap.state)) {
    unifiedArtifactWorkbench.outlineConfirmations = {};
    return;
  }
  const platform = unifiedArtifactWorkbench.platformScope === "wechat" ? "wechat" : "xiaohongshu";
  const result = await window.FlowAPI.getUnifiedPlatformOutlineConfirmation(bootstrap.id, platform);
  unifiedArtifactWorkbench.outlineConfirmations = result?.confirmations || {};
}

async function confirmUnifiedProductionPlatformOutline(platform) {
  const bootstrap = unifiedArtifactWorkbench.bootstrap;
  const actorId = $("#unifiedProductionActor")?.value.trim();
  const outlineRef = bootstrap?.outlineRefs?.[platform];
  if (!bootstrap?.id || !actorId || !outlineRef || bootstrap.state !== "awaiting_outline_confirmation") return;
  const platformName = platform === "wechat" ? "公众号" : "小红书";
  unifiedArtifactWorkbench.bootstrapBusy = true;
  unifiedArtifactWorkbench.productionNotice = "";
  renderUnifiedProductionEntry();
  try {
    const result = await window.FlowAPI.confirmUnifiedPlatformOutline(bootstrap.id, platform, {
      actor: { type: "user", id: actorId },
      confirmedAt: new Date().toISOString(),
      outlineRef,
      idempotencyKey: `platform-outline:${bootstrap.id}:${platform}:${outlineRef.hash}:${actorId}`
    });
    unifiedArtifactWorkbench.outlineConfirmations = result.confirmations || {};
    unifiedArtifactWorkbench.bootstrap = unifiedProductionBootstrapFrom(result.bootstrap || bootstrap);
    unifiedArtifactWorkbench.productionNotice = `${platformName}大纲已确认，正在生成${platformName}内容。`;
  } catch (error) {
    await loadUnifiedPlatformOutlineConfirmations().catch(() => {});
    const persisted = Boolean(unifiedArtifactWorkbench.outlineConfirmations?.[platform]);
    unifiedArtifactWorkbench.productionNotice = persisted
      ? `${platformName}大纲已经确认；内容尚未生成，可以点击“继续生成${platformName}内容”。`
      : `${platformName}大纲确认失败：${error.message}`;
    unifiedArtifactWorkbench.bootstrapBusy = false;
    renderUnifiedProductionEntry();
    return;
  } finally {
    unifiedArtifactWorkbench.bootstrapBusy = false;
    renderUnifiedProductionEntry();
  }
  await resumeUnifiedProductionPlatform(platform);
}

async function resumeUnifiedProductionPlatform(platform) {
  const bootstrap = unifiedArtifactWorkbench.bootstrap;
  const platformName = platform === "wechat" ? "公众号" : "小红书";
  if (!bootstrap?.id || !bootstrap.idempotencyKey || !unifiedArtifactWorkbench.outlineConfirmations?.[platform]) return false;
  unifiedArtifactWorkbench.bootstrapBusy = true;
  renderUnifiedProductionEntry();
  try {
    const production = await window.FlowAPI.resumeUnifiedPlatformProduction(bootstrap.id, platform, {
      idempotencyKey: bootstrap.idempotencyKey
    });
    if (production?.run?.state === "completed" || production?.commit) unifiedArtifactWorkbench.platformProductionStatus[platform] = "completed";
    await loadUnifiedArtifactReviewProjects({ preserveSelection: false });
    const producedProjectId = production?.commit?.contentProjectIdentity?.id || bootstrap.projectId;
    if (producedProjectId) {
      await chooseUnifiedArtifactProject(producedProjectId);
      setContentProductionMode("detail");
      await selectContentProductionTab(platform);
    }
    unifiedArtifactWorkbench.productionNotice = `${platformName}内容已生成，可以继续正文与视觉制作。`;
    showToast(`${platformName}内容生产已完成`);
    return true;
  } catch (error) {
    const recoveryCode = error?.payload?.recovery?.causeCode || error?.code || "";
    const recoveryHint = recoveryCode ? `（${recoveryCode}）` : "";
    unifiedArtifactWorkbench.productionNotice = `${platformName}大纲已确认，但内容生成失败：${error.message}${recoveryHint}。可以使用原任务继续，不要重新确认大纲。`;
    return false;
  } finally {
    unifiedArtifactWorkbench.bootstrapBusy = false;
    renderUnifiedProductionEntry();
  }
}

async function openUnifiedPlatformWorkspace(platform) {
  const projectId = unifiedArtifactWorkbench.bootstrap?.projectId;
  if (!projectId) return showToast("当前平台还没有可进入的内容项目");
  await loadUnifiedArtifactReviewProjects({ preserveSelection: false });
  await chooseUnifiedArtifactProject(projectId);
  setContentProductionMode("detail");
  await selectContentProductionTab(platform);
}

async function loadUnifiedProductionEntryOptions({ refreshBootstrap = true } = {}) {
  const select = $("#unifiedProductionAuthority");
  if (!select || window.FlowAPI.mode !== "live") return;
  try {
    const companyId = unifiedProjectListScope().companyId || "";
    const result = await window.FlowAPI.listUnifiedContentPrerequisites(companyId);
    unifiedArtifactWorkbench.entryOptions = asArray(result?.entryOptions);
    const previous = unifiedArtifactWorkbench.selectedEntryOptionId;
    select.innerHTML = `<option value="">请选择已冻结的权威输入</option>${unifiedArtifactWorkbench.entryOptions.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.topicIntent?.topic || item.id)} · ${escapeHtml(unifiedRefLabel(item.activeStrategySnapshotRef))}</option>`).join("")}`;
    if (previous && unifiedArtifactWorkbench.entryOptions.some((item) => item.id === previous)) select.value = previous;
    if (refreshBootstrap && $("#unifiedProductionProjectId")?.value.trim()) await refreshUnifiedProductionBootstrap();
    else renderUnifiedProductionEntry();
  } catch (error) {
    unifiedArtifactWorkbench.productionNotice = `权威输入加载失败：${error.message}`;
    renderUnifiedProductionEntry();
  }
}

async function refreshUnifiedProductionBootstrap() {
  const bootstrap = unifiedArtifactWorkbench.bootstrap;
  try {
    if (bootstrap?.id) {
      unifiedArtifactWorkbench.bootstrap = unifiedProductionBootstrapFrom(await window.FlowAPI.getUnifiedContentBootstrap(bootstrap.id));
    } else {
      const companyId = selectedUnifiedProductionEntry()?.companyId || unifiedProjectListScope().companyId || "";
      const projectId = $("#unifiedProductionProjectId")?.value.trim() || "";
      const currentPlatform = unifiedArtifactWorkbench.platformScope === "wechat" ? "wechat" : "xiaohongshu";
      const result = await window.FlowAPI.listUnifiedContentBootstraps({ companyId, projectId });
      unifiedArtifactWorkbench.bootstrap = asArray(result?.items)
        .filter((item) => !item.targetPlatform || item.targetPlatform === currentPlatform)
        .at(-1) || null;
      if (!unifiedArtifactWorkbench.bootstrap && !unifiedArtifactWorkbench.bootstrapRequest?.idempotencyKey) {
        let attempts = await window.FlowAPI.listUnifiedContentPlanningAttempts({ companyId, projectId });
        let failedAttempt = asArray(attempts?.items)
          .filter((item) => item.status === "failed" && item.requestId && (!item.targetPlatform || item.targetPlatform === currentPlatform))
          .at(-1);
        if (!failedAttempt && unifiedArtifactWorkbench.entryOptions.length === 1) {
          attempts = await window.FlowAPI.listUnifiedContentPlanningAttempts({ companyId });
          failedAttempt = asArray(attempts?.items)
            .filter((item) => item.status === "failed" && item.requestId && item.projectId && (!item.targetPlatform || item.targetPlatform === currentPlatform))
            .sort((left, right) => String(left.finishedAt || "").localeCompare(String(right.finishedAt || "")))
            .at(-1);
        }
        const entry = selectedUnifiedProductionEntry();
        if (failedAttempt && entry) {
          const recoveredProjectId = failedAttempt.projectId || projectId;
          const projectField = $("#unifiedProductionProjectId");
          if (projectField) projectField.value = recoveredProjectId;
          const recoveredRequest = buildUnifiedProductionRequest(entry, recoveredProjectId, failedAttempt.requestId, null);
          if (failedAttempt.targetPlatform) recoveredRequest.targetPlatform = failedAttempt.targetPlatform;
          else delete recoveredRequest.targetPlatform;
          unifiedArtifactWorkbench.bootstrapRequest = recoveredRequest;
        }
      }
    }
    if (unifiedArtifactWorkbench.bootstrap?.state === "completed") await loadUnifiedProductionControl();
    await loadUnifiedPlatformOutlineConfirmations();
    if (!unifiedArtifactWorkbench.bootstrap && unifiedArtifactWorkbench.bootstrapRequest?.idempotencyKey) {
      unifiedArtifactWorkbench.productionNotice = unifiedArtifactWorkbench.bootstrapRequest.targetPlatform === currentPlatform
        ? `已对账：当前平台请求尚未完成。继续时将复用请求键 ${unifiedArtifactWorkbench.bootstrapRequest.idempotencyKey}。`
        : "已找到旧双平台失败记录；不会重试该请求，下一次将按当前平台独立规划。";
    } else unifiedArtifactWorkbench.productionNotice = "";
    renderUnifiedProductionEntry();
  } catch (error) {
    unifiedArtifactWorkbench.productionNotice = `任务状态无法确认：${error.message}。请先对账，不要新建请求或盲目重试。`;
    renderUnifiedProductionEntry();
  }
}

function buildUnifiedProductionRequest(entry, projectId, nonce, predecessor = null) {
  const targetPlatform = unifiedArtifactWorkbench.platformScope === "wechat" ? "wechat" : "xiaohongshu";
  return {
    requestId: nonce,
    idempotencyKey: nonce,
    targetPlatform,
    companyId: entry.companyId,
    projectId,
    topicIntent: predecessor?.reviewDecision?.explanation
      ? { ...entry.topicIntent, revisionInstruction: predecessor.reviewDecision.explanation }
      : entry.topicIntent,
    activeStrategySnapshotRef: entry.activeStrategySnapshotRef,
    prerequisiteRef: entry.prerequisiteRef,
    accounts: entry.accounts,
    authorizationSourceRefs: entry.authorizationSourceRefs,
    ...(predecessor?.bootstrapFact?.bootstrapRef ? { supersedesBootstrapRef: predecessor.bootstrapFact.bootstrapRef } : {})
  };
}

async function startUnifiedProduction() {
  const entry = selectedUnifiedProductionEntry();
  const projectId = $("#unifiedProductionProjectId")?.value.trim();
  const predecessor = unifiedArtifactWorkbench.bootstrap?.state === "rejected" ? unifiedArtifactWorkbench.bootstrap : null;
  if (!entry || !projectId) {
    showToast("请先选择当前平台的权威输入并填写项目 ID");
    return false;
  }
  const platform = unifiedArtifactWorkbench.platformScope === "wechat" ? "wechat" : "xiaohongshu";
  if (unifiedArtifactWorkbench.bootstrap?.id) {
    if (unifiedArtifactWorkbench.outlineConfirmations?.[platform]) {
      return resumeUnifiedProductionPlatform(platform);
    }
    unifiedArtifactWorkbench.productionNotice = "已恢复当前项目的大纲，请继续核对；不会创建新的内容任务。";
    renderUnifiedProductionEntry();
    return true;
  }
  const priorRequest = unifiedArtifactWorkbench.bootstrapRequest;
  const canResumePriorRequest = !predecessor
    && priorRequest?.idempotencyKey
    && priorRequest.targetPlatform === platform
    && priorRequest.companyId === entry.companyId
    && priorRequest.projectId === projectId
    && priorRequest.prerequisiteRef?.id === entry.prerequisiteRef?.id;
  const nonce = canResumePriorRequest
    ? priorRequest.idempotencyKey
    : unifiedIdempotencyKey(predecessor ? "production-successor" : "production");
  const request = canResumePriorRequest ? priorRequest : buildUnifiedProductionRequest(entry, projectId, nonce, predecessor);
  unifiedArtifactWorkbench.productionNotice = "";
  unifiedArtifactWorkbench.bootstrapBusy = true;
  unifiedArtifactWorkbench.bootstrapRequest = request;
  renderUnifiedProductionEntry();
  try {
    const result = await window.FlowAPI.createUnifiedContentBootstrap(request);
    unifiedArtifactWorkbench.bootstrap = unifiedProductionBootstrapFrom(result);
    await loadUnifiedPlatformOutlineConfirmations();
    showToast(canResumePriorRequest ? "已使用原请求键恢复，大纲等待人工核对" : "大纲已生成，等待人工核对精确版本");
    return true;
  } catch (error) {
    unifiedArtifactWorkbench.productionNotice = `发起结果未知：${error.message}。已保留请求键 ${nonce}；请刷新请求状态，不要另建请求。`;
    await reconcileUnifiedProductionPlanning();
    return false;
  } finally {
    unifiedArtifactWorkbench.bootstrapBusy = false;
    renderUnifiedProductionEntry();
  }
}

async function decideUnifiedProductionOutline(decision, platform = "", suppliedExplanation = "") {
  const bootstrap = unifiedArtifactWorkbench.bootstrap;
  const actorId = $("#unifiedProductionActor")?.value.trim();
  if (!bootstrap?.id || !actorId || bootstrap.state !== "awaiting_outline_confirmation") return;
  const common = { actor: { type: "user", id: actorId }, outlineRefs: bootstrap.outlineRefs };
  let payload;
  if (decision === "reject") {
    const platformName = platform === "wechat" ? "公众号" : platform === "xiaohongshu" ? "小红书" : "当前平台";
    const explanation = suppliedExplanation.trim();
    if (!explanation?.trim()) return;
    payload = { ...common, decidedAt: new Date().toISOString(), reasonCode: "NEEDS_REVISION", explanation: `${platformName}：${explanation.trim()}` };
  } else {
    if (!window.confirm(`确认这两个精确大纲版本？\n公众号：${unifiedRefLabel(bootstrap.outlineRefs.wechat)}\n小红书：${unifiedRefLabel(bootstrap.outlineRefs.xiaohongshu)}\n\n此确认只允许继续本地生成，不代表上传或发布。`)) return;
    payload = { ...common, confirmedAt: new Date().toISOString() };
  }
  unifiedArtifactWorkbench.bootstrapBusy = true;
  unifiedArtifactWorkbench.productionNotice = "";
  renderUnifiedProductionEntry();
  try {
    const result = decision === "reject"
      ? await window.FlowAPI.rejectUnifiedContentBootstrap(bootstrap.id, payload)
      : await window.FlowAPI.confirmUnifiedContentBootstrap(bootstrap.id, payload);
    unifiedArtifactWorkbench.bootstrap = unifiedProductionBootstrapFrom(result);
    if (decision === "reject") unifiedArtifactWorkbench.outlineConfirmations = {};
    showToast(decision === "reject" ? "当前大纲版本已保留并退回" : "平台大纲已确认");
  } catch (error) {
    unifiedArtifactWorkbench.productionNotice = `审核结果无法确认：${error.message}。请刷新当前任务对账，不要重复创建决定。`;
  } finally {
    unifiedArtifactWorkbench.bootstrapBusy = false;
    renderUnifiedProductionEntry();
  }
  if (decision === "reject" && unifiedArtifactWorkbench.bootstrap?.state === "rejected") await startUnifiedProduction();
}

async function resumeUnifiedProduction() {
  const bootstrap = unifiedArtifactWorkbench.bootstrap;
  if (!bootstrap?.id || bootstrap.state !== "confirmed") return;
  unifiedArtifactWorkbench.bootstrapBusy = true;
  unifiedArtifactWorkbench.productionNotice = "";
  renderUnifiedProductionEntry();
  try {
    const result = await window.FlowAPI.resumeUnifiedContentBootstrap(bootstrap.id, { idempotencyKey: bootstrap.idempotencyKey });
    unifiedArtifactWorkbench.bootstrap = unifiedProductionBootstrapFrom(result);
    await loadUnifiedArtifactReviewProjects({ preserveSelection: false });
    if (unifiedArtifactWorkbench.bootstrap?.state === "completed") {
      const projectSelect = $("#unifiedArtifactProject");
      if (projectSelect) projectSelect.value = unifiedArtifactWorkbench.bootstrap.projectId;
      await chooseUnifiedArtifactProject(unifiedArtifactWorkbench.bootstrap.projectId);
      await loadUnifiedProductionControl();
      setContentProductionMode("detail");
      renderContentProductionCurrentProject();
      await selectContentProductionTab("overview");
    }
    showToast("本地正文与视觉计划已生成；外部上传仍未发生");
  } catch (error) {
    unifiedArtifactWorkbench.productionNotice = `生成结果未知：${error.message}。请刷新当前 bootstrap 对账；不得盲目重试。`;
  } finally {
    unifiedArtifactWorkbench.bootstrapBusy = false;
    renderUnifiedProductionEntry();
  }
}

async function createUnifiedProductionWechatPreupload({ refreshWorkspace = false } = {}) {
  const bootstrap = unifiedArtifactWorkbench.bootstrap;
  const projectId = unifiedWechatProductionProjectId();
  if (!projectId) return;
  await loadUnifiedProductionControl();
  if (unifiedArtifactWorkbench.productionControl?.preuploadAllowed !== true) return showToast("当前还有未完成的正文修改，或外部图片费用尚未确认");
  unifiedArtifactWorkbench.bootstrapBusy = true;
  unifiedArtifactWorkbench.productionNotice = "";
  renderUnifiedProductionEntry();
  const versionToken = unifiedArtifactWorkbench.productionControl?.currentVersion?.versionRef?.hash || "base";
  // The first automatic pre-upload pass may legitimately record blocked
  // generated-raster attempts before the user approves image costs. Once the
  // approved provider assets exist, use a later immutable attempt instead of
  // replaying those blocked attempt-1 facts forever.
  const generatedSlots = asArray(unifiedArtifactWorkbench.productionControl?.imageGeneration?.slots);
  const preuploadAttempt = unifiedArtifactWorkbench.productionControl?.imageGeneration?.ready === true
    ? Math.max(2, ...generatedSlots.map((item) => (Number(item.attempt) || 0) + 1))
    : 1;
  const idempotencyKey = `ui-wechat-preupload-v4:${projectId}:${String(versionToken).slice(0, 24)}:attempt-${preuploadAttempt}`;
  try {
    const project = unifiedProjectDetail(await window.FlowAPI.getUnifiedContentProject(projectId));
    const wechat = unifiedProjectPlatforms(project).find((item) => item.platform === "wechat");
    const account = accountsCache.find((item) => item.id === wechat?.accountId || item.socialAccountId === wechat?.accountId);
    const result = await window.FlowAPI.createUnifiedWechatPreuploadArtifacts(projectId, {
      workspaceId: account?.workspaceId || project.workspaceId || "workspace_default",
      companyId: project.companyId,
      accountId: wechat?.accountId,
      productSnapshotHash: project.aggregateHash,
      idempotencyKey,
      idempotencyKeyPrefix: `${idempotencyKey}:runtime`,
      attempt: preuploadAttempt,
      recordedAt: bootstrap?.completedAt || bootstrap?.createdAt || project.createdAt || new Date().toISOString(),
      // Generated images are intentionally left to human review. The normal
      // deterministic format/mobile/fact checks still run, but the optional
      // whole-article visual gate is not activated.
      wholeArticleGateEnabled: false
    });
    unifiedArtifactWorkbench.wechatPreupload = result;
    unifiedArtifactWorkbench.productionNotice = `公众号上传前预览已生成（${unifiedRefLabel(result?.artifactState?.candidateRef || wechat?.articleRef)}）；该产物只用于人工审阅，平台调用、上传、草稿和发布均为 0。`;
    await loadUnifiedArtifactReviewProjects({ preserveSelection: false });
    const projectSelect = $("#unifiedArtifactProject");
    if (projectSelect) projectSelect.value = projectId;
    await chooseUnifiedArtifactProject(projectId);
    $("#unifiedArtifactPlatform").value = "wechat";
    await chooseUnifiedArtifactPlatform("wechat");
    if (refreshWorkspace) await loadUnifiedProductionControl();
    showToast("公众号正文、封面和插图的新版本已生成；尚未上传或发布");
  } catch (error) {
    unifiedArtifactWorkbench.productionNotice = `上传前预览结果未知：${error.message}。已保留幂等键 ${idempotencyKey}；请先对账，禁止盲目重试。`;
  } finally {
    unifiedArtifactWorkbench.bootstrapBusy = false;
    renderUnifiedProductionEntry();
  }
}

async function saveUnifiedWechatCopyRevision() {
  const button = $("#unifiedWechatSaveRevision");
  if (!unifiedWechatProductionProjectId()) return;
  if (button) button.disabled = true;
  try {
    if (unifiedArtifactWorkbench.productionControl?.initialized !== true) await initializeUnifiedProductionControl();
    $("#unifiedProductionRevisionLayer").value = "copy";
    if (!$("#unifiedProductionRevisionInstruction").value.trim()) {
      $("#unifiedProductionRevisionInstruction").value = "用户在公众号工作台直接修改了当前正文";
    }
    syncUnifiedProductionStructuredCopy();
    if (!asArray(unifiedArtifactWorkbench.productionControl?.pendingRevisionRequests).length) await submitUnifiedProductionRevision();
    syncUnifiedProductionStructuredCopy();
    await executeUnifiedProductionRevision();
  } finally {
    renderUnifiedProductionControl();
  }
}

function renderUnifiedProductionControl() {
  const panel = $("#unifiedProductionControl");
  if (!panel) return;
  const projectId = unifiedWechatProductionProjectId();
  const available = Boolean(projectId && unifiedArtifactWorkbench.platform === "wechat");
  panel.hidden = !available;
  if (!available) return;
  const control = unifiedArtifactWorkbench.productionControl;
  const initialized = control?.initialized === true;
  const busy = unifiedArtifactWorkbench.productionControlBusy;
  const pending = asArray(control?.pendingRevisionRequests);
  const approval = control?.promptCostApproval;
  const promptPlan = control?.promptPlan;
  $("#unifiedProductionControlInitialize").disabled = busy || initialized;
  $("#unifiedProductionControlInitialize").hidden = initialized;
  $("#unifiedProductionRevisionSubmit").disabled = busy || !initialized || !$("#unifiedProductionRevisionInstruction").value.trim();
  const executableRequest = pending.length === 1 && pending[0].layer !== "upstream" ? pending[0] : null;
  $("#unifiedProductionRevisionExecute").disabled = busy || !executableRequest || !$("#unifiedProductionRevisionPayload").value.trim();
  const copyFields = $("#unifiedProductionCopyFields");
  if (copyFields) copyFields.hidden = !initialized || $("#unifiedProductionRevisionLayer")?.value !== "copy";
  const saveRevision = $("#unifiedWechatSaveRevision");
  if (saveRevision) saveRevision.disabled = busy || !initialized || !$("#unifiedProductionCopyTitle").value.trim() || !$("#unifiedProductionCopyArticle").value.trim();
  if ($("#unifiedProductionPreupload")) $("#unifiedProductionPreupload").disabled = busy || unifiedArtifactWorkbench.bootstrapBusy || control?.preuploadAllowed !== true || unifiedArtifactWorkbench.wechatPreupload?.artifactState?.reviewable === true;
  const imageGeneration = control?.imageGeneration || { required: false, ready: true, processing: false, failed: false, slots: [] };
  const imageButton = $("#unifiedWechatGenerateImages");
  const promptCount = asArray(promptPlan?.prompts).length;
  if (imageButton) {
    imageButton.hidden = !promptCount;
    imageButton.disabled = busy || !initialized || pending.length > 0 || imageGeneration.ready;
    imageButton.textContent = imageGeneration.processing ? "查询原任务进度" : imageGeneration.failed ? "重新生成失败配图" : "生成本篇配图";
  }
  const budget = $("#unifiedWechatImageCallBudget");
  if (budget) budget.textContent = promptCount
    ? `本篇需要生成 ${promptCount} 张图片，最多调用 ${promptCount} 次；失败不会自动重复付费调用。`
    : "本篇使用确定性语义图表，不调用外部生图服务。";
  $("#unifiedProductionPromptPlan").innerHTML = promptPlan
    ? `<strong>${promptCount ? "本篇配图方案" : "本篇使用内容图表"}</strong>${asArray(promptPlan.prompts).map((item) => {
      const slot = asArray(imageGeneration.slots).find((candidate) => candidate.slotId === item.slotId);
      const status = { waiting: "等待生成", processing: "正在生成", succeeded: "已生成", failed: "生成失败" }[slot?.status] || "等待生成";
      return `<span><b>${escapeHtml(item.role === "cover" ? "封面" : "正文插图")}</b> · ${escapeHtml(item.prompt || "根据正文语义生成")} · ${escapeHtml(status)}</span>`;
    }).join("")}`
    : "等待建立版本基线。";
  const heads = control?.lifecycle?.revisionHeads || {};
  $("#unifiedProductionControlState").innerHTML = control
    ? `<strong>${pending.length ? "修改请求等待生成新版本" : initialized ? "可以直接修改当前文章" : "点击“准备修改”载入当前正文"}</strong>${pending.map((item) => `<span class="blocked">待执行：${escapeHtml(item.instruction)}</span>`).join("")}<span>${control.preuploadAllowed ? "当前版本可生成带封面和插图的本地预览。" : imageGeneration.required && !imageGeneration.ready ? "请先生成本篇配图。" : "正在准备本地预览。"}</span>`
    : "尚未加载生产控制状态。";
}

function unifiedWechatProductionProjectId() {
  // In the studio, the selected materialized project is the authority. A
  // completed bootstrap can remain in memory while the user opens a newer
  // standalone WeChat revision; preferring that stale bootstrap sent edit and
  // delivery commands to the logical parent project instead of the visible
  // version.
  return unifiedProjectId(unifiedArtifactWorkbench.project) || unifiedArtifactWorkbench.bootstrap?.projectId || "";
}

function unifiedWechatProductionActor() {
  return $("#unifiedArtifactReviewer")?.value.trim() || $("#unifiedProductionActor")?.value.trim() || "workspace_user";
}

function populateUnifiedProductionRevisionPayload(request) {
  const field = $("#unifiedProductionRevisionPayload");
  if (!field || !request) return;
  const version = unifiedArtifactWorkbench.productionControl?.currentVersion;
  const versionRef = version?.versionRef || version?.articleRef || version?.candidateRef || {};
  const versionKey = `${unifiedWechatProductionProjectId()}::${versionRef.id || "base"}::${versionRef.hash || ""}`;
  if (unifiedArtifactWorkbench.productionEditorVersionKey === versionKey && field.value.trim()) return;
  if (request.layer === "copy") {
    const article = version?.article?.article || {};
    $("#unifiedProductionCopyTitle").value = article.recommended_title || article.title || "";
    $("#unifiedProductionCopyAbstract").value = article.abstract || "";
    $("#unifiedProductionCopyOpening").value = typeof article.opening === "object" ? article.opening?.text || "" : article.opening || "";
    $("#unifiedProductionCopyArticle").value = article.article_markdown || article.article || "";
    $("#unifiedProductionCopyCta").value = article.cta || "";
    field.value = JSON.stringify(article, null, 2);
    unifiedArtifactWorkbench.productionEditorVersionKey = versionKey;
    unifiedArtifactWorkbench.productionEditorBaseline = field.value;
  }
  if (request.layer === "visual") {
    const declarations = asArray(version?.canonicalImagePlan?.canonicalPlan?.declarations)
      .filter((item) => item.strategy === "generated_raster")
      .map((item) => ({ slotId: item.slotId, prompt: item.imageSpec?.prompt || item.source?.image_spec?.prompt || "" }));
    field.value = JSON.stringify(declarations, null, 2);
  }
}

function syncUnifiedProductionStructuredCopy() {
  if ($("#unifiedProductionRevisionLayer")?.value !== "copy") return;
  const field = $("#unifiedProductionRevisionPayload");
  if (!field) return;
  let article;
  try { article = JSON.parse(field.value || "{}"); } catch { article = structuredClone(unifiedArtifactWorkbench.productionControl?.currentVersion?.article?.article || {}); }
  const openingText = $("#unifiedProductionCopyOpening")?.value || "";
  const values = {
    recommended_title: $("#unifiedProductionCopyTitle")?.value || "",
    abstract: $("#unifiedProductionCopyAbstract")?.value || "",
    article_markdown: $("#unifiedProductionCopyArticle")?.value || "",
    cta: $("#unifiedProductionCopyCta")?.value || ""
  };
  for (const [key, value] of Object.entries(values)) article[key] = value;
  article.opening = article.opening && typeof article.opening === "object"
    ? { ...article.opening, text: openingText }
    : openingText;
  field.value = JSON.stringify(article, null, 2);
  renderUnifiedProductionControl();
}

async function loadUnifiedProductionControl() {
  const projectId = unifiedWechatProductionProjectId();
  if (!projectId || unifiedArtifactWorkbench.platform !== "wechat") return;
  const generation = unifiedArtifactWorkbench.candidateLoadGeneration;
  try {
    const control = await window.FlowAPI.getUnifiedWechatProductionControlState(projectId);
    if (generation !== unifiedArtifactWorkbench.candidateLoadGeneration
      || projectId !== unifiedWechatProductionProjectId()
      || unifiedArtifactWorkbench.platform !== "wechat") return;
    unifiedArtifactWorkbench.productionControl = control;
    if (unifiedArtifactWorkbench.productionControl?.initialized) populateUnifiedProductionRevisionPayload({ layer: "copy" });
  } catch (error) {
    unifiedArtifactWorkbench.productionControl = null;
    unifiedArtifactWorkbench.productionNotice = `生产控制状态加载失败：${error.message}`;
  }
  renderUnifiedProductionControl();
}

async function initializeUnifiedProductionControl() {
  const projectId = unifiedWechatProductionProjectId();
  if (!projectId) return;
  unifiedArtifactWorkbench.productionControlBusy = true;
  renderUnifiedProductionControl();
  try {
    const result = await window.FlowAPI.initializeUnifiedWechatProductionControl(projectId, { occurredAt: new Date().toISOString() });
    unifiedArtifactWorkbench.productionControl = result.state;
    unifiedArtifactWorkbench.revisionExecutionDraft = null;
    showToast("当前文章、视觉计划与权威输入已建立分层版本基线");
  } catch (error) {
    unifiedArtifactWorkbench.productionNotice = `版本基线未建立：${error.message}`;
  } finally {
    unifiedArtifactWorkbench.productionControlBusy = false;
    renderUnifiedProductionEntry();
  }
}

function updateUnifiedProductionRevisionImpact() {
  const layer = $("#unifiedProductionRevisionLayer")?.value;
  const labels = {
    copy: "正文修改只失效 content 与 delivery；当前视觉 Prompt/费用批准仍可保留。",
    visual: "视觉修改失效 visual、delivery 和当前 Prompt/费用批准；正文版本保持不变。",
    upstream: "上游修改失效 authority、content、visual、delivery；必须重新生成并重新审核。"
  };
  $("#unifiedProductionRevisionImpact").textContent = labels[layer] || "请选择影响范围。";
  renderUnifiedProductionControl();
}

async function submitUnifiedProductionRevision() {
  const projectId = unifiedWechatProductionProjectId();
  const layer = $("#unifiedProductionRevisionLayer").value;
  const instruction = $("#unifiedProductionRevisionInstruction").value.trim();
  const actorId = unifiedWechatProductionActor();
  if (!projectId || !instruction || !actorId) return;
  const prior = unifiedArtifactWorkbench.revisionRequestDraft;
  const payload = prior?.layer === layer && prior?.instruction === instruction ? prior : {
    layer, instruction, actorId, occurredAt: new Date().toISOString(), idempotencyKey: unifiedIdempotencyKey(`wechat-${layer}-revision`)
  };
  unifiedArtifactWorkbench.revisionRequestDraft = payload;
  unifiedArtifactWorkbench.productionControlBusy = true;
  renderUnifiedProductionControl();
  try {
    const result = await window.FlowAPI.createUnifiedWechatRevisionRequest(projectId, payload);
    unifiedArtifactWorkbench.productionControl = result.state;
    unifiedArtifactWorkbench.revisionExecutionDraft = null;
    unifiedArtifactWorkbench.promptCostPreview = null;
    unifiedArtifactWorkbench.promptCostApprovalRequest = null;
    // Keep the exact edits already present in the form/payload. Reloading the
    // base article here silently replaced the user's changes between recording
    // the revision request and executing it, which left a permanent pending
    // request and made the one-click save appear broken.
    showToast("修订请求已作为不可变事实记录；等待对应执行器产出新版本");
  } catch (error) {
    unifiedArtifactWorkbench.productionNotice = `修订请求结果未知：${error.message}。请保留当前输入并刷新对账，不要另建请求。`;
  } finally {
    unifiedArtifactWorkbench.productionControlBusy = false;
    renderUnifiedProductionEntry();
  }
}

async function executeUnifiedProductionRevision() {
  const projectId = unifiedWechatProductionProjectId();
  const request = asArray(unifiedArtifactWorkbench.productionControl?.pendingRevisionRequests)[0];
  const executedBy = unifiedWechatProductionActor();
  if (!projectId || !request || request.layer === "upstream" || !executedBy) return;
  let parsed;
  try { parsed = JSON.parse($("#unifiedProductionRevisionPayload").value); }
  catch { return showToast("精确新版本载荷必须是有效 JSON。"); }
  const exactInput = JSON.stringify({ parsed, executedBy });
  const prior = unifiedArtifactWorkbench.revisionExecutionDraft;
  const payload = prior?.requestRef?.hash === request.factHash && prior.exactInput === exactInput ? prior.payload : {
    requestRef: { id: request.id, hash: request.factHash }, executedBy, executedAt: new Date().toISOString(),
    idempotencyKey: unifiedIdempotencyKey(`wechat-${request.layer}-revision-execution`),
    ...(request.layer === "copy" ? { article: parsed } : { promptChanges: parsed })
  };
  unifiedArtifactWorkbench.revisionExecutionDraft = { requestRef: payload.requestRef, exactInput, payload };
  unifiedArtifactWorkbench.productionControlBusy = true;
  renderUnifiedProductionControl();
  try {
    const result = await window.FlowAPI.executeUnifiedWechatRevision(projectId, payload);
    unifiedArtifactWorkbench.productionControl = result.state;
    unifiedArtifactWorkbench.revisionRequestDraft = null;
    unifiedArtifactWorkbench.revisionExecutionDraft = null;
    $("#unifiedProductionRevisionPayload").value = "";
    if (result.state?.imageGeneration?.required && !result.state.imageGeneration.ready) {
      showToast("正文新版本已生成；请查看本篇配图方案并点击“生成本篇配图”");
    } else {
      showToast("正文新版本已生成，正在合成公众号预览");
      await createUnifiedProductionWechatPreupload({ refreshWorkspace: true });
    }
  } catch (error) {
    unifiedArtifactWorkbench.productionNotice = `新版本结果未知：${error.message}。已保留同一幂等载荷；请先刷新对账，不要修改载荷后盲目重试。`;
  } finally {
    unifiedArtifactWorkbench.productionControlBusy = false;
    renderUnifiedProductionEntry();
  }
}

async function previewUnifiedProductionPromptCost() {
  const projectId = unifiedWechatProductionProjectId();
  const maxCredits = Number($("#unifiedProductionMaxCredits").value);
  if (!projectId || !Number.isFinite(maxCredits) || maxCredits <= 0) return showToast("请输入大于 0 的费用上限");
  unifiedArtifactWorkbench.productionControlBusy = true;
  renderUnifiedProductionControl();
  try {
    unifiedArtifactWorkbench.promptCostPreview = await window.FlowAPI.previewUnifiedWechatPromptCost(projectId, { maxCredits });
    unifiedArtifactWorkbench.promptCostApprovalRequest = null;
    $("#unifiedProductionPromptConfirm").checked = false;
    showToast("已生成精确 Prompt 与费用合同；Provider 调用为 0");
  } catch (error) {
    unifiedArtifactWorkbench.productionNotice = `Prompt/费用预览失败：${error.message}`;
  } finally {
    unifiedArtifactWorkbench.productionControlBusy = false;
    renderUnifiedProductionEntry();
  }
}

async function executeUnifiedWechatImages() {
  const projectId = unifiedWechatProductionProjectId();
  const control = unifiedArtifactWorkbench.productionControl;
  const prompts = asArray(control?.promptPlan?.prompts);
  const generation = control?.imageGeneration || { slots: [] };
  const actorId = unifiedWechatProductionActor();
  if (!projectId || !actorId || !prompts.length) return;
  const currentAttempt = Math.max(0, ...asArray(generation.slots).map((item) => Number(item.attempt) || 0));
  const attempt = generation.failed ? Math.min(3, currentAttempt + 1) : Math.max(1, currentAttempt);
  const payload = {
    maxCalls: prompts.length, attempt, confirmProviderExecution: true, executedBy: actorId, executedAt: new Date().toISOString(),
    idempotencyKey: `wechat-images:${control.promptPlan.planHash}:attempt-${attempt}`
  };
  unifiedArtifactWorkbench.productionControlBusy = true;
  renderUnifiedProductionControl();
  try {
    const result = await window.FlowAPI.executeUnifiedWechatGeneratedImages(projectId, payload);
    unifiedArtifactWorkbench.productionControl = result.state;
    if (result.generation?.ready) {
      showToast("本篇封面和正文插图已生成，正在合成公众号预览");
      await createUnifiedProductionWechatPreupload({ refreshWorkspace: true });
    } else {
      showToast("已保留原生图任务，正在查询结果");
    }
  } catch (error) {
    const taskIds = asArray(unifiedArtifactWorkbench.productionControl?.imageGeneration?.slots).map((item) => item.providerTaskId).filter(Boolean);
    unifiedArtifactWorkbench.productionNotice = `配图结果尚未完成：${error.message}。${taskIds.length ? `已保留任务 ${taskIds.join("、")}，请点击“查询原任务进度”，不要重新创建调用。` : "请刷新状态后再继续。"}`;
    await loadUnifiedProductionControl();
  } finally {
    unifiedArtifactWorkbench.productionControlBusy = false;
    renderUnifiedProductionEntry();
  }
}

async function approveUnifiedProductionPromptCost() {
  const projectId = unifiedWechatProductionProjectId();
  const preview = unifiedArtifactWorkbench.promptCostPreview;
  const actorId = unifiedWechatProductionActor();
  if (!projectId || !preview || !actorId || !$("#unifiedProductionPromptConfirm").checked) return;
  const prior = unifiedArtifactWorkbench.promptCostApprovalRequest;
  const payload = prior || {
    maxCredits: preview.costPlan.maxCredits,
    promptPlanRef: { id: preview.promptPlan.id, hash: preview.promptPlan.planHash },
    costPlanRef: { id: preview.costPlan.id, hash: preview.costPlan.planHash },
    decision: "approved", decidedBy: actorId, decidedAt: new Date().toISOString(),
    idempotencyKey: `wechat-prompt-cost:${preview.costPlan.planHash}`
  };
  unifiedArtifactWorkbench.promptCostApprovalRequest = payload;
  unifiedArtifactWorkbench.productionControlBusy = true;
  renderUnifiedProductionControl();
  try {
    const result = await window.FlowAPI.approveUnifiedWechatPromptCost(projectId, payload);
    unifiedArtifactWorkbench.productionControl = result.state;
    showToast("当前精确 Prompt 与费用上限已批准；尚未调用 Provider");
  } catch (error) {
    unifiedArtifactWorkbench.productionNotice = `批准结果未知：${error.message}。请使用同一审批请求对账，不要创建新批准。`;
  } finally {
    unifiedArtifactWorkbench.productionControlBusy = false;
    renderUnifiedProductionEntry();
  }
}

// UNIFIED_ARTIFACT_FEATURE_GATE_START
async function resolveUnifiedArtifactFeatureGate({ getRuntimeStatus, listProjects }) {
  try {
    const runtimeStatus = await getRuntimeStatus();
    const flags = runtimeStatus?.featureFlags || {};
    if (flags.unifiedContentArtifactsV1 !== true) return { enabled: false, xhsIntegratedPageDesignEnabled: false, promotionEnabled: false, atomicPublicationCutoverEnabled: false, publicationToolsEnabled: false, wechatHumanSelectionEnabled: false, wechatUploadEnabled: false, wechatDraftEnabled: false, projectsResult: null };
    return { enabled: true, promotionEnabled: runtimeStatus?.featureFlags?.localContentPromotionV1 === true,
      xhsIntegratedPageDesignEnabled: ["xhsIntegratedPageDesignSkill", "xhsIntegratedPageDirectionReview", "xhsIntegratedPageProviderCompiler", "xhsVisualAssetRegistry", "xhsIntegratedPageSkillExecutionPlan"].every((name) => flags[name] === true),
      atomicPublicationCutoverEnabled: runtimeStatus?.featureFlags?.atomicPublicationFeedbackUiCutoverV1 === true,
      publicationToolsEnabled: ["atomicPublicationFeedbackUiCutoverV1", "atomicManualPublicationV1", "atomicExactFeedbackV1", "atomicPublicationLifecycleV1"]
        .every((name) => flags[name] === true),
      wechatHumanSelectionEnabled: ["unifiedContentProductionV1", "unifiedContentArtifactsV1", "unifiedContentAtomicProductV1",
        "unifiedContentAtomicWechatProductV1", "unifiedContentAtomicWechatArtifactV1", "unifiedContentAtomicWechatHumanSelectionV1"]
        .every((name) => flags[name] === true),
      wechatUploadEnabled: ["unifiedContentProductionV1", "unifiedContentArtifactsV1", "unifiedContentAtomicProductV1",
        "unifiedContentAtomicWechatProductV1", "unifiedContentAtomicWechatArtifactV1", "unifiedContentAtomicWechatHumanSelectionV1",
        "unifiedContentAtomicWechatPromotionUploadDeliveryV1"].every((name) => flags[name] === true),
      wechatDraftEnabled: ["unifiedContentProductionV1", "unifiedContentArtifactsV1", "unifiedContentAtomicProductV1",
        "unifiedContentAtomicWechatProductV1", "unifiedContentAtomicWechatArtifactV1", "unifiedContentAtomicWechatHumanSelectionV1",
        "unifiedContentAtomicWechatPromotionUploadDeliveryV1", "atomicWechatDraftCreationV1"].every((name) => flags[name] === true),
      projectsResult: await listProjects() };
  } catch (_) {
    return { enabled: false, xhsIntegratedPageDesignEnabled: false, promotionEnabled: false, atomicPublicationCutoverEnabled: false, publicationToolsEnabled: false, wechatHumanSelectionEnabled: false, wechatUploadEnabled: false, wechatDraftEnabled: false, projectsResult: null };
  }
}

function applyUnifiedArtifactFeatureVisibility({ enabled, nav, view, workbench }) {
  const visible = enabled === true;
  workbench.enabled = visible;
  nav.hidden = !visible;
  view.hidden = !visible;
  return visible;
}
// UNIFIED_ARTIFACT_FEATURE_GATE_END

async function initializeUnifiedArtifactReviewWorkbench() {
  const nav = $("#unifiedArtifactReviewNav");
  const view = $("#unifiedArtifactReviewView");
  unifiedArtifactWorkbench.enabled = false;
  unifiedArtifactWorkbench.xhsIntegratedPageDesignEnabled = false;
  unifiedArtifactWorkbench.promotionEnabled = false;
  unifiedArtifactWorkbench.atomicPublicationCutoverEnabled = false;
  unifiedArtifactWorkbench.publicationToolsEnabled = false;
  unifiedArtifactWorkbench.wechatHumanSelectionEnabled = false;
  unifiedArtifactWorkbench.wechatUploadEnabled = false;
  unifiedArtifactWorkbench.wechatDraftEnabled = false;
  unifiedArtifactWorkbench.projects = [];
  if (nav && view) applyUnifiedArtifactFeatureVisibility({ enabled: false, nav, view, workbench: unifiedArtifactWorkbench });
  if (!nav || !view || window.FlowAPI.mode !== "live") return;
  const gate = await resolveUnifiedArtifactFeatureGate({
    getRuntimeStatus: () => window.FlowAPI.getRuntimeStatus(),
    listProjects: () => window.FlowAPI.listUnifiedContentProjects(unifiedProjectListScope())
  });
  if (!applyUnifiedArtifactFeatureVisibility({ enabled: gate.enabled, nav, view, workbench: unifiedArtifactWorkbench })) return;
  unifiedArtifactWorkbench.xhsIntegratedPageDesignEnabled = gate.xhsIntegratedPageDesignEnabled === true;
  unifiedArtifactWorkbench.promotionEnabled = gate.promotionEnabled === true;
  unifiedArtifactWorkbench.atomicPublicationCutoverEnabled = gate.atomicPublicationCutoverEnabled === true;
  unifiedArtifactWorkbench.publicationToolsEnabled = gate.publicationToolsEnabled === true;
  unifiedArtifactWorkbench.wechatHumanSelectionEnabled = gate.wechatHumanSelectionEnabled === true;
  unifiedArtifactWorkbench.wechatUploadEnabled = gate.wechatUploadEnabled === true;
  unifiedArtifactWorkbench.wechatDraftEnabled = gate.wechatDraftEnabled === true;
  document.body.dataset.atomicPublicationFeedbackCutover = unifiedArtifactWorkbench.atomicPublicationCutoverEnabled ? "enabled" : "disabled";
  renderUnifiedArtifactProjectOptions(gate.projectsResult, { preserveSelection: false });
  await loadUnifiedProductionEntryOptions({ refreshBootstrap: false });
  // The initial route is evaluated before this async feature gate resolves.
  // Honor a direct link once the server has confirmed that the workbench is enabled.
  const requestedView = new URLSearchParams(location.search).get("view");
  if ((viewAliases[requestedView] || requestedView) === "artifact-review") switchView("artifact-review");
}

async function chooseUnifiedArtifactProject(projectId) {
  const loadGeneration = ++unifiedArtifactWorkbench.candidateLoadGeneration;
  beginUnifiedScopeTransition(projectId ? "正在加载所选项目…" : "请选择项目");
  stopUnifiedXhsLightPolling();
  unifiedArtifactWorkbench.project = null;
  unifiedArtifactWorkbench.platform = "";
  unifiedArtifactWorkbench.candidateId = "";
  unifiedArtifactWorkbench.wechatAutoPreuploadRequested = false;
  unifiedArtifactWorkbench.artifactReview = null;
  unifiedArtifactWorkbench.reviewState = null;
  unifiedArtifactWorkbench.xhsProductionState = null;
  unifiedArtifactWorkbench.xhsLightRevisionState = null;
  unifiedArtifactWorkbench.xhsLightPlan = null;
  unifiedArtifactWorkbench.xhsLightApproval = null;
  unifiedArtifactWorkbench.wechatPendingRequests = {};
  clearUnifiedWechatUploadState();
  clearUnifiedPromotionState("项目已变化，请重新完成 Selection 与 Preview");
  const platformSelect = $("#unifiedArtifactPlatform");
  const candidateSelect = $("#unifiedArtifactCandidate");
  platformSelect.innerHTML = `<option value="">请选择平台</option>`;
  candidateSelect.innerHTML = `<option value="">请选择候选</option>`;
  platformSelect.disabled = true;
  candidateSelect.disabled = true;
  $("#unifiedArtifactReferences").hidden = true;
  $("#unifiedArtifactStatusGrid").hidden = true;
  $("#unifiedArtifactWorkspace").hidden = true;
  if (!projectId) return;
  try {
    const result = await window.FlowAPI.getUnifiedContentProject(projectId);
    if (loadGeneration !== unifiedArtifactWorkbench.candidateLoadGeneration) return;
    unifiedArtifactWorkbench.project = unifiedProjectDetail(result);
    finishUnifiedScopeTransition({ loaded: true });
    unifiedArtifactWorkbench.activeScopeToken = unifiedCurrentScopeToken({ projectId, platform: "", candidateId: "", generation: loadGeneration });
    const platforms = unifiedProjectPlatforms().filter((item) => ["xiaohongshu", "wechat"].includes(item.platform));
    platformSelect.innerHTML = `<option value="">请选择平台</option>${platforms.map((item) => `<option value="${escapeHtml(item.platform)}">${item.platform === "wechat" ? "微信公众号" : "小红书"}</option>`).join("")}`;
    platformSelect.disabled = false;
    $("#unifiedArtifactScopeHint").textContent = "项目已加载；平台和候选选择由上方工作区同步控制。";
    renderContentProductionCurrentProject();
  } catch (error) {
    if (loadGeneration !== unifiedArtifactWorkbench.candidateLoadGeneration) return;
    finishUnifiedScopeTransition({ loaded: false });
    $("#unifiedArtifactScopeHint").textContent = `项目详情不可用：${error.message}`;
    showToast(`项目详情加载失败：${error.message}`);
  }
}

async function chooseUnifiedArtifactPlatform(platform) {
  const loadGeneration = ++unifiedArtifactWorkbench.candidateLoadGeneration;
  beginUnifiedScopeTransition(platform ? "正在加载当前平台版本…" : "请选择平台");
  stopUnifiedXhsLightPolling();
  unifiedArtifactWorkbench.platform = platform;
  unifiedArtifactWorkbench.candidateId = "";
  unifiedArtifactWorkbench.wechatAutoPreuploadRequested = false;
  unifiedArtifactWorkbench.artifactReview = null;
  unifiedArtifactWorkbench.reviewState = null;
  unifiedArtifactWorkbench.xhsProductionState = null;
  unifiedArtifactWorkbench.wechatPendingRequests = {};
  clearUnifiedWechatUploadState();
  clearUnifiedPromotionState("平台已变化，请重新完成 Selection 与 Preview");
  const select = $("#unifiedArtifactCandidate");
  const platformSnapshot = unifiedPlatformSnapshot();
  const candidates = [...asArray(platformSnapshot?.candidateRefs)];
  for (const ref of [platformSnapshot?.candidateRef, platformSnapshot?.articleRef]) {
    if (ref?.id && !candidates.some((item) => item.id === ref.id)) candidates.push(ref);
  }
  select.innerHTML = `<option value="">请选择候选</option>${candidates.map((item, index) => `<option value="${escapeHtml(item.id)}">版本 ${index + 1}</option>`).join("")}`;
  select.disabled = !platform;
  $("#unifiedArtifactReferences").hidden = true;
  $("#unifiedArtifactStatusGrid").hidden = true;
  $("#unifiedArtifactWorkspace").hidden = true;
  const latestCandidate = candidates.at(-1) || null;
  if (latestCandidate) {
    unifiedArtifactWorkbench.candidateId = latestCandidate.id;
    select.value = latestCandidate.id;
    $("#unifiedArtifactScopeHint").textContent = "正在打开当前平台的最新版本…";
  } else {
    $("#unifiedArtifactScopeHint").textContent = platform ? "当前平台还没有可继续的内容版本。" : "请选择平台。";
  }
  renderContentProductionCandidateCards();
  if (latestCandidate) await refreshUnifiedArtifactCandidate();
  else {
    finishUnifiedScopeTransition({ loaded: true });
    unifiedArtifactWorkbench.activeScopeToken = unifiedCurrentScopeToken({ generation: loadGeneration });
  }
}

async function refreshUnifiedArtifactCandidate() {
  const projectId = unifiedProjectId(unifiedArtifactWorkbench.project);
  const { platform, candidateId } = unifiedArtifactWorkbench;
  if (!projectId || !platform || !candidateId) return;
  const loadGeneration = ++unifiedArtifactWorkbench.candidateLoadGeneration;
  unifiedArtifactWorkbench.projectLoadState = "loading";
  unifiedArtifactWorkbench.activeScopeToken = "";
  clearUnifiedProductionEditor();
  const scope = unifiedArtifactScope();
  const expectedScope = unifiedCurrentScopeToken({ projectId, platform, candidateId, generation: loadGeneration });
  clearUnifiedPromotionState("候选状态已刷新，请重新 Preview");
  try {
    const dedicatedWechat = platform === "wechat" && unifiedArtifactWorkbench.wechatHumanSelectionEnabled;
    let [artifactReview, reviewState, xhsProductionState] = await Promise.all([
      window.FlowAPI.getUnifiedContentArtifactReview(projectId, platform, scope),
      dedicatedWechat ? window.FlowAPI.getUnifiedWechatHumanReviewState(projectId, scope) : window.FlowAPI.getUnifiedContentReviewState(projectId, platform, scope),
      platform === "xiaohongshu" ? window.FlowAPI.getUnifiedXhsProductionState(projectId, scope) : Promise.resolve(null)
    ]);
    if (loadGeneration !== unifiedArtifactWorkbench.candidateLoadGeneration) return;
    // A materialized WeChat commit is already a local content package. Create
    // its upload-before-review artifact automatically on first entry so the
    // user sees the article and can review it directly; this never calls or
    // uploads to WeChat.
    if (dedicatedWechat && artifactReview?.artifactState?.blockers?.includes("wechat_plan_fact_required")
      && !unifiedArtifactWorkbench.wechatAutoPreuploadRequested) {
      unifiedArtifactWorkbench.wechatAutoPreuploadRequested = true;
      const detail = unifiedArtifactWorkbench.project?.aggregateHash
        ? unifiedArtifactWorkbench.project
        : await window.FlowAPI.getUnifiedContentProject(projectId);
      const wechat = unifiedProjectPlatforms(detail).find((item) => item.platform === "wechat");
      const account = accountsCache.find((item) => item.id === wechat?.accountId || item.socialAccountId === wechat?.accountId);
      const candidateToken = `${candidateId}:${String(unifiedArtifactWorkbench.artifactReview?.artifactState?.candidateRef?.hash || "current").slice(0, 16)}`;
      const autoPreuploadKey = `ui-wechat-preupload-auto-v7:${projectId}:${candidateToken}`;
      try {
        unifiedArtifactWorkbench.wechatPreupload = await window.FlowAPI.createUnifiedWechatPreuploadArtifacts(projectId, {
          workspaceId: account?.workspaceId || detail?.workspaceId || "workspace_default",
          companyId: detail?.companyId || "",
          accountId: wechat?.accountId || "",
          productSnapshotHash: detail?.aggregateHash || detail?.productSnapshotHash || "",
          idempotencyKey: autoPreuploadKey,
          idempotencyKeyPrefix: `${autoPreuploadKey}:runtime`,
          attempt: 1,
          recordedAt: detail.createdAt || detail.contentProject?.createdAt || "2026-01-01T00:00:00.000Z",
          wholeArticleGateEnabled: false
        });
        [artifactReview, reviewState] = await Promise.all([
          window.FlowAPI.getUnifiedContentArtifactReview(projectId, platform, scope),
          window.FlowAPI.getUnifiedWechatHumanReviewState(projectId, scope)
        ]);
        if (loadGeneration !== unifiedArtifactWorkbench.candidateLoadGeneration) return;
      } catch (error) {
        unifiedArtifactWorkbench.wechatAutoPreuploadRequested = false;
        throw error;
      }
    }
    unifiedArtifactWorkbench.artifactReview = artifactReview;
    unifiedArtifactWorkbench.reviewState = reviewState;
    unifiedArtifactWorkbench.xhsProductionState = xhsProductionState;
    if (platform === "wechat") await loadUnifiedProductionControl();
    unifiedArtifactWorkbench.xhsLightRevisionState = platform === "xiaohongshu" && xhsProductionState?.refs?.providerPlanFactRef
      ? await window.FlowAPI.getUnifiedXhsLightRevisionState(projectId, { ...scope, providerPlanFactRef: xhsProductionState.refs.providerPlanFactRef })
      : null;
    if (loadGeneration !== unifiedArtifactWorkbench.candidateLoadGeneration) return;
    if (platform === "xiaohongshu") {
      const lightState = unifiedArtifactWorkbench.xhsLightRevisionState;
      const headRefs = new Set(asArray(lightState?.pageHeads).map((item) => `${item.revisionRef?.id}:${item.revisionRef?.hash}`));
      const executedPlanRefs = new Set(asArray(lightState?.executions).map((item) => `${item.planFactRef?.id}:${item.planFactRef?.hash}`));
      const recoverablePlan = asArray(lightState?.plans).findLast((item) => headRefs.has(`${item.baseRevisionRef?.id}:${item.baseRevisionRef?.hash}`) && !executedPlanRefs.has(`${item.id}:${item.factHash}`)) || null;
      const recoverableApproval = recoverablePlan
        ? asArray(lightState?.approvals).findLast((item) => item.planFactRef?.id === recoverablePlan.id && item.planFactRef?.hash === recoverablePlan.factHash) || null
        : null;
      unifiedArtifactWorkbench.xhsLightPlan = recoverablePlan;
      unifiedArtifactWorkbench.xhsLightApproval = recoverableApproval;
    }
    await loadUnifiedExistingPromotion();
    await loadUnifiedWechatUploadState();
    await loadUnifiedWechatDraftState();
    if (loadGeneration !== unifiedArtifactWorkbench.candidateLoadGeneration
      || projectId !== unifiedProjectId(unifiedArtifactWorkbench.project)
      || platform !== unifiedArtifactWorkbench.platform
      || candidateId !== unifiedArtifactWorkbench.candidateId) return;
    finishUnifiedScopeTransition({ loaded: true });
    unifiedArtifactWorkbench.activeScopeToken = expectedScope;
    renderUnifiedArtifactWorkbench();
    renderContentProductionCandidateCards();
    renderContentProductionCurrentProject();
    $("#unifiedArtifactScopeHint").textContent = `${platform === "wechat" ? "公众号" : "小红书"}当前版本已加载。`;
    const pendingLightExecution = unifiedArtifactWorkbench.xhsLightRevisionState?.pendingExecution;
    if (platform === "xiaohongshu" && pendingLightExecution) scheduleUnifiedXhsLightContinuation(pendingLightExecution, 200);
    else if (unifiedArtifactWorkbench.xhsLightPollingExecutionId) stopUnifiedXhsLightPolling();
  } catch (error) {
    if (loadGeneration !== unifiedArtifactWorkbench.candidateLoadGeneration) return;
    finishUnifiedScopeTransition({ loaded: false });
    unifiedArtifactWorkbench.activeScopeToken = "";
    $("#unifiedArtifactScopeHint").textContent = `候选状态不可用：${error.message}`;
    showToast(`候选审阅状态加载失败：${error.message}`);
  }
}

async function appendUnifiedArtifactAction(action, payload = {}) {
  if (unifiedArtifactWorkbench.projectLoadState !== "loaded" || !unifiedArtifactWorkbench.activeScopeToken) return showToast("当前版本仍在加载，请稍候");
  const state = unifiedArtifactWorkbench.artifactReview?.artifactState;
  const material = unifiedArtifactWorkbench.artifactReview?.reviewMaterial;
  if (unifiedArtifactWorkbench.platform === "xiaohongshu" && !unifiedXhsHumanReviewGate(material, state).open)
    return showToast("服务端尚未开放 XHS 人工 Artifact Review");
  const reviewerId = $("#unifiedArtifactReviewer").value.trim() || "workspace_user";
  const enteredReason = $("#unifiedArtifactReason").value.trim();
  // Approval is an affirmative decision and does not need a rejection
  // explanation. Keep a deterministic audit reason when the optional field
  // is empty; rejection still requires the user's own explanation.
  const reason = enteredReason || (action === "approve_preupload" || action === "approve_set" ? "批准当前精确版本" : "");
  if (!reviewerId || !reason) return showToast("否决当前版本前请填写审阅意见");
  if (!state?.artifactStateHash) return showToast("服务端尚未返回当前 Artifact state hash");
  const projectId = unifiedProjectId(unifiedArtifactWorkbench.project);
  if (unifiedArtifactWorkbench.platform === "wechat") {
    if (!unifiedArtifactWorkbench.wechatHumanSelectionEnabled) return showToast("公众号专用人工审阅功能尚未启用");
    const stage = `artifact:${action}`;
    const request = unifiedWechatPendingRequest(stage, () => ({
      ...unifiedWechatExactReviewPayload(), action, actorId: reviewerId, actorType: "user", reason,
      occurredAt: new Date().toISOString(), idempotencyKey: unifiedIdempotencyKey(`wechat-${action}`)
    }));
    try {
      await window.FlowAPI.createUnifiedWechatPreuploadReview(projectId, request);
      settleUnifiedWechatPendingRequest(stage);
      await refreshUnifiedArtifactCandidate();
      if (action === "approve_preupload") await createUnifiedCurrentContentReview();
      else showToast("公众号上传前 Artifact 已否决并保留历史版本");
    } catch (error) {
      settleUnifiedWechatPendingRequest(stage, error);
      showToast(error.status ? `公众号 Artifact 审阅未保存：${error.message}` : `审阅结果未知：${error.message}。已保留同一请求身份，请刷新对账后再决定是否重放。`);
    }
    return;
  }
  try {
    const result = await window.FlowAPI.appendUnifiedContentArtifactReviewAction(projectId, unifiedArtifactWorkbench.platform, {
      ...unifiedArtifactScope(),
      artifactStateHash: state.artifactStateHash,
      reviewerId,
      actorType: "user",
      reason,
      action,
      payload,
      idempotencyKey: unifiedIdempotencyKey(action)
    });
    unifiedArtifactWorkbench.artifactReview = result.artifactReview;
    await refreshUnifiedArtifactCandidate();
    if (action === "approve_set") await createUnifiedCurrentContentReview();
    else showToast("人工审阅动作已按当前 state append-only 记录");
  } catch (error) {
    showToast(`动作未保存：${error.message}`);
  }
}

async function createUnifiedCurrentContentReview() {
  const state = unifiedArtifactWorkbench.artifactReview?.artifactState;
  const projectId = unifiedProjectId(unifiedArtifactWorkbench.project);
  if (unifiedArtifactWorkbench.platform === "wechat") {
    const reviewState = unifiedArtifactWorkbench.reviewState || {};
    if (!unifiedArtifactWorkbench.wechatHumanSelectionEnabled || reviewState.artifactApproved !== true) return showToast("请先完成公众号专用 Artifact 人工批准");
    const stage = "editorial-review";
    const request = unifiedWechatPendingRequest(stage, () => ({
      ...unifiedWechatExactReviewPayload(reviewState), artifactReviewFactRef: reviewState.currentArtifactReviewFactRef,
      idempotencyKey: unifiedIdempotencyKey("wechat-editorial-review")
    }));
    try {
      const result = await window.FlowAPI.createUnifiedWechatEditorialReview(projectId, request);
      settleUnifiedWechatPendingRequest(stage);
      await refreshUnifiedArtifactCandidate();
      showToast(result.reviewFact?.status === "passed" ? "公众号 Editorial Review 已通过并绑定当前 Artifact" : "公众号 Editorial Review 未通过；请按 findings 发起新修订");
    } catch (error) {
      settleUnifiedWechatPendingRequest(stage, error);
      showToast(error.status ? `公众号 Editorial Review 未创建：${error.message}` : `Editorial Review 结果未知：${error.message}。已保留同一请求身份，请先对账。`);
    }
    return;
  }
  if (state?.selectable !== true) return showToast("Artifact 尚未由服务端判定为 selectable");
  try {
    await window.FlowAPI.createUnifiedContentReview(projectId, unifiedArtifactWorkbench.platform, {
      ...unifiedArtifactScope(),
      idempotencyKey: unifiedIdempotencyKey("content-review")
    });
    await refreshUnifiedArtifactCandidate();
    showToast("Content Review 已创建并绑定当前 Artifact state");
  } catch (error) {
    showToast(`Content Review 未创建：${error.message}`);
  }
}

async function confirmUnifiedCurrentSelection({ skipConfirmation = false } = {}) {
  if (!skipConfirmation && !$("#unifiedSelectionConfirm").checked) return showToast("请先确认采用当前版本");
  const artifactState = unifiedArtifactWorkbench.artifactReview?.artifactState;
  const dedicatedWechat = unifiedArtifactWorkbench.platform === "wechat" && unifiedArtifactWorkbench.wechatHumanSelectionEnabled;
  const review = dedicatedWechat ? asArray(unifiedArtifactWorkbench.reviewState?.editorialReviewFacts).at(-1) || null : latestUnifiedFact(unifiedArtifactWorkbench.reviewState?.reviewFacts, unifiedArtifactWorkbench.candidateId);
  if (dedicatedWechat) {
    const state = unifiedArtifactWorkbench.reviewState || {};
    if (!state.editorialReviewPassed || !state.currentArtifactReviewFactRef || !state.currentEditorialReviewFactRef) return showToast("当前公众号 Editorial Review 未通过或已 stale");
    const material = unifiedArtifactWorkbench.artifactReview?.reviewMaterial || {};
    const resources = asArray(material.resources).map((item) => `${item.slotId || item.role}: ${unifiedRefLabel(item.resourceRef)}`).join("\n");
    const summary = `文章：${unifiedRefLabel(state.articleRef)}\n${resources || "配图：当前 Artifact 未声明独立资源"}\nArtifact：${state.artifactStateHash}\nEditorial：${unifiedRefLabel(state.currentEditorialReviewFactRef)}\n\n确认写入公众号精确 UserSelection？这只形成 local ready-for-upload，不会上传微信。`;
    if (!skipConfirmation && !window.confirm(summary)) return;
    const actorId = $("#unifiedArtifactReviewer").value.trim() || "workspace_user";
    const projectId = unifiedProjectId(unifiedArtifactWorkbench.project);
    const stage = "selection";
    const request = unifiedWechatPendingRequest(stage, () => ({
      ...unifiedWechatExactReviewPayload(state), artifactReviewFactRef: state.currentArtifactReviewFactRef,
      editorialReviewFactRef: state.currentEditorialReviewFactRef, status: "selected", actorId, actorType: "user",
      occurredAt: new Date().toISOString(), idempotencyKey: unifiedIdempotencyKey("wechat-selection")
    }));
    try {
      await window.FlowAPI.createUnifiedWechatSelection(projectId, request);
      settleUnifiedWechatPendingRequest(stage);
      await refreshUnifiedArtifactCandidate();
      showToast("公众号精确 UserSelection 已保存：local ready-for-upload；上传、草稿和发布仍为 0");
    } catch (error) {
      settleUnifiedWechatPendingRequest(stage, error);
      showToast(error.status ? `公众号 UserSelection 未保存：${error.message}` : `Selection 结果未知：${error.message}。已保留同一请求身份，请刷新对账。`);
    }
    return;
  }
  if (!review || unifiedFactStale(review, artifactState) || review.state !== "editorial_review_passed") return showToast("当前 Content Review 未通过或已 stale");
  const summary = `Candidate：${unifiedArtifactWorkbench.candidateId}\nReview：${review.id}\nArtifact：${artifactState.artifactStateHash}\n\n确认写入 UserSelection？此动作不代表发布。`;
  if (!skipConfirmation && !window.confirm(summary)) return;
  const actorId = $("#unifiedArtifactReviewer").value.trim() || "workspace_user";
  const projectId = unifiedProjectId(unifiedArtifactWorkbench.project);
  try {
    await window.FlowAPI.createUnifiedContentSelection(projectId, unifiedArtifactWorkbench.platform, {
      ...unifiedArtifactScope(),
      reviewId: review.id,
      actorId,
      actorType: "user",
      action: "confirm_selection",
      occurredAt: new Date().toISOString(),
      idempotencyKey: unifiedIdempotencyKey("selection")
    });
    await refreshUnifiedArtifactCandidate();
    showToast("UserSelection 已显式记录；尚未晋升或发布");
  } catch (error) {
    showToast(`UserSelection 未保存：${error.message}`);
  }
}

function unifiedCurrentVersionCheckpoint() {
  const data = unifiedArtifactWorkbench.artifactReview || {};
  const artifactState = data.artifactState || {};
  const reviewState = unifiedArtifactWorkbench.reviewState || {};
  const dedicatedWechat = unifiedArtifactWorkbench.platform === "wechat" && unifiedArtifactWorkbench.wechatHumanSelectionEnabled;
  const review = dedicatedWechat
    ? asArray(reviewState.editorialReviewFacts).at(-1) || null
    : latestUnifiedFact(reviewState.reviewFacts, unifiedArtifactWorkbench.candidateId);
  const selection = dedicatedWechat
    ? asArray(reviewState.selectionFacts).at(-1) || null
    : latestUnifiedFact(reviewState.selectionFacts, unifiedArtifactWorkbench.candidateId);
  const reviewPassed = dedicatedWechat
    ? reviewState.editorialReviewPassed === true
    : Boolean(review && !unifiedFactStale(review, artifactState) && review.state === "editorial_review_passed");
  const selected = dedicatedWechat
    ? reviewState.selected === true
    : Boolean(selection && selection.status === "selected" && !unifiedFactStale(selection, artifactState));
  const approved = dedicatedWechat ? reviewState.artifactApproved === true : artifactState.selectable === true;
  const promoted = Boolean(unifiedArtifactWorkbench.promotionResult?.promotion);
  const delivered = unifiedArtifactWorkbench.platform === "wechat"
    ? promoted
    : Boolean(unifiedArtifactWorkbench.xhsProductionState?.refs?.deliveryFactRef) || unifiedArtifactWorkbench.xhsProductionState?.status === "local_delivery_complete";
  return { approved, reviewPassed, selected, promoted, delivered };
}

async function finalizeUnifiedCurrentVersion() {
  const button = $("#unifiedFinalizeCurrentVersion");
  if (!unifiedArtifactWorkbench.artifactReview?.artifactState?.artifactStateHash) return showToast("当前版本尚未加载完成");
  if (button) button.disabled = true;
  $("#unifiedFinalizeStatus").innerHTML = "<span>正在保存当前版本并生成本地内容包…</span>";
  try {
    let state = unifiedCurrentVersionCheckpoint();
    if (unifiedArtifactWorkbench.platform === "xiaohongshu" && state.delivered) {
      await createUnifiedXhsFinalDelivery({ skipConfirmation: true });
      $("#unifiedFinalizeStatus").innerHTML = "<strong>小红书内容包已下载</strong><span>包含发布文案 Word 文档和按页排序的图片。</span>";
      return;
    }
    if (!state.approved) {
      await appendUnifiedArtifactAction(unifiedArtifactWorkbench.platform === "wechat" ? "approve_preupload" : "approve_set");
      state = unifiedCurrentVersionCheckpoint();
    }
    if (!state.reviewPassed) {
      await createUnifiedCurrentContentReview();
      state = unifiedCurrentVersionCheckpoint();
    }
    if (!state.selected) {
      await confirmUnifiedCurrentSelection({ skipConfirmation: true });
      state = unifiedCurrentVersionCheckpoint();
    }
    if (!state.promoted) {
      await previewUnifiedCurrentPromotion();
      await confirmUnifiedCurrentPromotion({ skipConfirmation: true });
      state = unifiedCurrentVersionCheckpoint();
    }
    if (unifiedArtifactWorkbench.platform === "xiaohongshu" && state.promoted && !state.delivered) {
      await createUnifiedXhsFinalDelivery({ skipConfirmation: true });
      await refreshUnifiedArtifactCandidate();
      state = unifiedCurrentVersionCheckpoint();
    }
    if (!state.delivered) throw new Error("服务端尚未返回完整的本地内容包，请刷新后使用同一版本继续");
    const wechatHasImages = asArray(unifiedArtifactWorkbench.artifactReview?.reviewMaterial?.resources).length > 0;
    $("#unifiedFinalizeStatus").innerHTML = `<strong>本地内容包已生成</strong><span>${unifiedArtifactWorkbench.platform === "wechat" ? (wechatHasImages ? "文章与配图已锁定，未上传微信" : "文章已锁定；该历史版本未生成配图") : "文字与整页图片已锁定，未发布小红书"}</span>`;
    showToast("当前版本已确认，本地内容包已生成");
  } catch (error) {
    $("#unifiedFinalizeStatus").innerHTML = `<strong>本次没有完成</strong><span>${escapeHtml(error.message)}</span><span>已完成的步骤会保留，刷新后可从当前版本继续。</span>`;
    showToast(`内容包生成未完成：${error.message}`);
  } finally {
    if (button) button.disabled = false;
  }
}

async function rejectUnifiedCurrentVersion() {
  const reason = $("#unifiedArtifactReason")?.value.trim();
  if (!reason) return showToast("请先写下希望修改的内容");
  await appendUnifiedArtifactAction(unifiedArtifactWorkbench.platform === "wechat" ? "reject_preupload" : "reject_set");
}

$("#unifiedArtifactProject")?.addEventListener("change", (event) => chooseUnifiedArtifactProject(event.target.value));
$("#contentProductionNew")?.addEventListener("click", () => {
  unifiedArtifactWorkbench.platformScope = "xiaohongshu";
  unifiedArtifactWorkbench.bootstrap = null;
  unifiedArtifactWorkbench.bootstrapRequest = null;
  unifiedArtifactWorkbench.outlineConfirmations = {};
  unifiedArtifactWorkbench.wechatPreupload = null;
  unifiedArtifactWorkbench.productionNotice = "";
  unifiedArtifactWorkbench.productionControl = null;
  const entry = selectedUnifiedProductionEntry();
  $("#unifiedProductionProjectId").value = entry ? unifiedProductionProjectId(entry) : "";
  setContentProductionMode("create");
  renderUnifiedProductionEntry();
});
$("#contentProductionNewWechat")?.addEventListener("click", () => openUnifiedPlatformProductionEntry("wechat"));
$$("[data-production-platform]").forEach((button) => button.addEventListener("click", () => openContentProductionPlatform(button.dataset.productionPlatform)));
$("#contentProductionCancelCreate")?.addEventListener("click", () => setContentProductionMode("projects"));
$("#contentProductionBack")?.addEventListener("click", () => setContentProductionMode("projects"));
$("#contentProductionSearch")?.addEventListener("input", (event) => {
  unifiedArtifactWorkbench.studioSearch = event.target.value;
  renderContentProductionProjectGrid();
});
$("#contentProductionProjectGrid")?.addEventListener("click", (event) => {
  const create = event.target.closest("[data-content-create-empty]");
  if (create) return $("#contentProductionNew")?.click();
  const card = event.target.closest("[data-content-project]");
  if (card) openContentProductionProject(card.dataset.contentProject, card.dataset.contentPlatform || "overview");
});
$("#contentProductionDetail")?.addEventListener("click", async (event) => {
  const tab = event.target.closest("[data-content-studio-tab]");
  if (tab) return selectContentProductionTab(tab.dataset.contentStudioTab);
  const platformButton = event.target.closest("[data-content-project-platform], [data-open-content-platform]");
  if (platformButton) return selectContentProductionTab(platformButton.dataset.contentProjectPlatform || platformButton.dataset.openContentPlatform);
  const copyEditorButton = event.target.closest("[data-open-wechat-copy-editor]");
  if (copyEditorButton) {
    const control = $("#unifiedProductionControl");
    if (!control) return showToast("当前公众号版本暂时无法进入正文修改");
    if (unifiedArtifactWorkbench.productionControl?.initialized !== true) await initializeUnifiedProductionControl();
    await loadUnifiedProductionControl();
    // Select the copy layer before rendering the editor. Previously this was
    // assigned after render, leaving the populated title/body controls hidden
    // even though the user had explicitly clicked “修改正文”.
    $("#unifiedProductionRevisionLayer").value = "copy";
    populateUnifiedProductionRevisionPayload({ layer: "copy" });
    renderUnifiedProductionControl();
    control.hidden = false;
    control.scrollIntoView({ behavior: "smooth", block: "start" });
    $("#unifiedProductionRevisionInstruction")?.focus();
    return;
  }
  const candidate = event.target.closest("[data-content-candidate]");
  if (!candidate) return;
  if (unifiedArtifactWorkbench.projectLoadState === "loading"
    || candidate.dataset.scopeProject !== unifiedProjectId(unifiedArtifactWorkbench.project)
    || candidate.dataset.scopePlatform !== unifiedArtifactWorkbench.platform) return showToast("项目正在切换，请等待当前版本加载完成");
  unifiedArtifactWorkbench.candidateId = candidate.dataset.contentCandidate;
  const select = $("#unifiedArtifactCandidate");
  if (select) select.value = unifiedArtifactWorkbench.candidateId;
  clearUnifiedWechatUploadState();
  clearUnifiedPromotionState("版本已变化，请重新完成选择与预览");
  renderContentProductionCandidateCards();
  await refreshUnifiedArtifactCandidate();
});
$("#unifiedProductionAuthority")?.addEventListener("change", async (event) => {
  unifiedArtifactWorkbench.selectedEntryOptionId = event.target.value;
  unifiedArtifactWorkbench.bootstrap = null;
  unifiedArtifactWorkbench.bootstrapRequest = null;
  unifiedArtifactWorkbench.outlineConfirmations = {};
  unifiedArtifactWorkbench.wechatPreupload = null;
  unifiedArtifactWorkbench.productionNotice = "";
  unifiedArtifactWorkbench.productionControl = null;
  unifiedArtifactWorkbench.promptCostPreview = null;
  unifiedArtifactWorkbench.promptCostApprovalRequest = null;
  unifiedArtifactWorkbench.revisionRequestDraft = null;
  const entry = selectedUnifiedProductionEntry();
  if (entry && !$("#unifiedProductionProjectId").value.trim()) $("#unifiedProductionProjectId").value = unifiedProductionProjectId(entry);
  if (entry) await refreshUnifiedProductionBootstrap();
  else renderUnifiedProductionEntry();
});
$("#v2RunWorkspace")?.addEventListener("change", (event) => {
  const file = event.target.closest("[data-v2-source-file]");
  if (!file) return;
  const id = file.dataset.v2SourceFile;
  const next = new Set(v2Workspace.sourceSelectionIds || []);
  if (file.checked) next.add(id); else next.delete(id);
  v2Workspace.sourceSelectionIds = [...next];
});
$("#unifiedProductionProjectId")?.addEventListener("input", renderUnifiedProductionEntry);
$("#unifiedProductionActor")?.addEventListener("input", renderUnifiedProductionEntry);
$("#unifiedProductionRefresh")?.addEventListener("click", () => loadUnifiedProductionEntryOptions({ refreshBootstrap: true }));
$("#unifiedProductionStart")?.addEventListener("click", startUnifiedProduction);
$("#unifiedProductionReconcile")?.addEventListener("click", reconcileUnifiedProductionPlanning);
$("#unifiedProductionConfirm")?.addEventListener("click", () => decideUnifiedProductionOutline("confirm"));
$("#unifiedProductionReject")?.addEventListener("click", () => decideUnifiedProductionOutline("reject"));
$("#unifiedProductionResume")?.addEventListener("click", resumeUnifiedProduction);
$("#unifiedProductionPreupload")?.addEventListener("click", createUnifiedProductionWechatPreupload);
$("#unifiedProductionOutlines")?.addEventListener("click", (event) => {
  const enterWorkspace = event.target.closest("[data-enter-platform-workspace]");
  if (enterWorkspace) return openUnifiedPlatformWorkspace(enterWorkspace.dataset.enterPlatformWorkspace);
  const confirm = event.target.closest("[data-confirm-platform-outline]");
  if (confirm) return confirmUnifiedProductionPlatformOutline(confirm.dataset.confirmPlatformOutline);
  const resumePlatform = event.target.closest("[data-resume-platform-production]");
  if (resumePlatform) return resumeUnifiedProductionPlatform(resumePlatform.dataset.resumePlatformProduction);
  const openChat = event.target.closest("[data-open-outline-chat]");
  if (openChat) {
    const chat = $(`[data-outline-chat="${openChat.dataset.openOutlineChat}"]`);
    if (chat) chat.hidden = false;
    return;
  }
  const cancelChat = event.target.closest("[data-cancel-outline-chat]");
  if (cancelChat) {
    const chat = $(`[data-outline-chat="${cancelChat.dataset.cancelOutlineChat}"]`);
    if (chat) chat.hidden = true;
    return;
  }
  const submitChat = event.target.closest("[data-submit-outline-chat]");
  if (submitChat) {
    const platform = submitChat.dataset.submitOutlineChat;
    const input = $(`[data-outline-instruction="${platform}"]`);
    const instruction = input?.value.trim() || "";
    if (!instruction) return showToast("请先告诉 AI 你希望怎么修改大纲");
    return decideUnifiedProductionOutline("reject", platform, instruction);
  }
});
$("#unifiedProductionControlInitialize")?.addEventListener("click", initializeUnifiedProductionControl);
$("#unifiedProductionRevisionLayer")?.addEventListener("change", updateUnifiedProductionRevisionImpact);
$("#unifiedProductionRevisionInstruction")?.addEventListener("input", renderUnifiedProductionControl);
$("#unifiedWechatSaveRevision")?.addEventListener("click", saveUnifiedWechatCopyRevision);
for (const id of ["unifiedProductionCopyTitle", "unifiedProductionCopyAbstract", "unifiedProductionCopyOpening", "unifiedProductionCopyArticle", "unifiedProductionCopyCta"]) {
  $("#" + id)?.addEventListener("input", () => { syncUnifiedProductionStructuredCopy(); renderUnifiedProductionControl(); });
}
$("#unifiedProductionRevisionPayload")?.addEventListener("input", renderUnifiedProductionControl);
for (const id of ["unifiedProductionCopyTitle", "unifiedProductionCopyAbstract", "unifiedProductionCopyOpening", "unifiedProductionCopyArticle", "unifiedProductionCopyCta"]) $("#" + id)?.addEventListener("input", syncUnifiedProductionStructuredCopy);
$("#unifiedProductionRevisionSubmit")?.addEventListener("click", submitUnifiedProductionRevision);
$("#unifiedProductionRevisionExecute")?.addEventListener("click", executeUnifiedProductionRevision);
$("#unifiedProductionMaxCredits")?.addEventListener("input", () => {
  unifiedArtifactWorkbench.promptCostPreview = null;
  unifiedArtifactWorkbench.promptCostApprovalRequest = null;
  $("#unifiedProductionPromptConfirm").checked = false;
  renderUnifiedProductionControl();
});
$("#unifiedProductionPromptPreview")?.addEventListener("click", previewUnifiedProductionPromptCost);
$("#unifiedProductionPromptConfirm")?.addEventListener("change", renderUnifiedProductionControl);
$("#unifiedProductionPromptApprove")?.addEventListener("click", approveUnifiedProductionPromptCost);
$("#unifiedWechatGenerateImages")?.addEventListener("click", executeUnifiedWechatImages);
$("#unifiedArtifactPlatform")?.addEventListener("change", (event) => chooseUnifiedArtifactPlatform(event.target.value));
$("#unifiedArtifactCandidate")?.addEventListener("change", async (event) => {
  unifiedArtifactWorkbench.candidateId = event.target.value;
  clearUnifiedProductionEditor();
  clearUnifiedWechatUploadState();
  clearUnifiedPromotionState("candidate 已变化，请重新完成 Selection 与 Preview");
  if (event.target.value) await refreshUnifiedArtifactCandidate();
});
$("#unifiedArtifactRefresh")?.addEventListener("click", refreshUnifiedArtifactCandidate);
$("#unifiedXhsStartDesign")?.addEventListener("click", startUnifiedXhsDesign);
$("#unifiedXhsApprovePlan")?.addEventListener("click", approveUnifiedXhsProviderPlan);
$("#unifiedXhsApproveExecution")?.addEventListener("click", approveUnifiedXhsProviderExecution);
$("#unifiedXhsExecuteProvider")?.addEventListener("click", executeUnifiedXhsProvider);
$("#unifiedXhsApproveVisualReview")?.addEventListener("click", approveUnifiedXhsVisualReview);
$("#unifiedXhsExecuteVisualReview")?.addEventListener("click", executeUnifiedXhsVisualReview);
$("#unifiedXhsCreateLightPlan")?.addEventListener("click", createUnifiedXhsLightPlan);
$("#unifiedXhsApproveLightPlan")?.addEventListener("click", approveUnifiedXhsLightPlan);
$("#unifiedXhsExecuteLightPlan")?.addEventListener("click", executeUnifiedXhsLightPlan);
$("#unifiedXhsConfirmVisualSet")?.addEventListener("click", confirmUnifiedXhsVisualSet);
$("#unifiedCreateContentReview")?.addEventListener("click", createUnifiedCurrentContentReview);
$("#unifiedConfirmSelection")?.addEventListener("click", confirmUnifiedCurrentSelection);
$("#unifiedPreviewPromotion")?.addEventListener("click", previewUnifiedCurrentPromotion);
$("#unifiedConfirmPromotion")?.addEventListener("click", confirmUnifiedCurrentPromotion);
$("#unifiedFinalizeCurrentVersion")?.addEventListener("click", finalizeUnifiedCurrentVersion);
$("#unifiedRejectCurrentVersion")?.addEventListener("click", rejectUnifiedCurrentVersion);
$("#unifiedXhsFinalDelivery")?.addEventListener("click", createUnifiedXhsFinalDelivery);
$("#unifiedPromotionConfirm")?.addEventListener("change", () => renderUnifiedArtifactWorkbench());
$("#unifiedWechatUploadRefresh")?.addEventListener("click", reconcileUnifiedWechatUpload);
$("#unifiedWechatUploadPreview")?.addEventListener("click", previewUnifiedWechatUploadPlan);
$("#unifiedWechatUploadConfirm")?.addEventListener("change", renderUnifiedWechatUploadPanel);
$("#unifiedWechatUploadActorId")?.addEventListener("input", renderUnifiedWechatUploadPanel);
$("#unifiedWechatUploadApprove")?.addEventListener("click", approveUnifiedWechatUploadPlan);
$("#unifiedWechatUploadExecute")?.addEventListener("click", executeUnifiedWechatUploadPlan);
$("#unifiedWechatDraftRefresh")?.addEventListener("click", reconcileUnifiedWechatDraft);
$("#unifiedWechatDraftPreview")?.addEventListener("click", previewUnifiedWechatDraftCreation);
$("#unifiedWechatDraftConfirm")?.addEventListener("change", renderUnifiedWechatDraftPanel);
$("#unifiedWechatDraftActorId")?.addEventListener("input", renderUnifiedWechatDraftPanel);
$("#unifiedWechatDraftExecute")?.addEventListener("click", executeUnifiedWechatDraftCreation);
$("#unifiedPublicationManualConfirm")?.addEventListener("change", renderUnifiedPublicationPanel);
$("#unifiedRecordPublication")?.addEventListener("click", recordUnifiedManualPublication);
$("#unifiedRecordFeedback")?.addEventListener("click", recordUnifiedPublicationFeedback);
$("#unifiedRecordLifecycle")?.addEventListener("click", recordUnifiedPublicationLifecycle);
$("#unifiedLifecycleManualConfirm")?.addEventListener("change", renderUnifiedPublicationPanel);
$("#unifiedSelectionConfirm")?.addEventListener("change", (event) => {
  const state = unifiedArtifactWorkbench.artifactReview?.artifactState;
  const review = latestUnifiedFact(unifiedArtifactWorkbench.reviewState?.reviewFacts, unifiedArtifactWorkbench.candidateId);
  const allowed = state?.selectable === true && review?.state === "editorial_review_passed" && !unifiedFactStale(review, state);
  $("#unifiedConfirmSelection").disabled = !(event.target.checked && allowed);
});
$("#unifiedArtifactSetActions")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-unified-set-action]");
  if (button) appendUnifiedArtifactAction(button.dataset.unifiedSetAction);
});
$("#unifiedArtifactMaterial")?.addEventListener("click", (event) => {
  const lightButton = event.target.closest("[data-xhs-light-page]");
  if (lightButton) {
    const select = $("#unifiedXhsLightPage");
    if (select) select.value = lightButton.dataset.xhsLightPage;
    $("#unifiedXhsLightInstruction")?.focus();
    $("#unifiedXhsLightRevisionPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  const pageButton = event.target.closest("[data-unified-page-action]");
  if (pageButton) {
    const page = unifiedArtifactWorkbench.artifactReview?.reviewMaterial?.pages?.find((item) => item.pageId === pageButton.dataset.pageId);
    if (page) appendUnifiedArtifactAction(pageButton.dataset.unifiedPageAction, { pageId: page.pageId, pageRevisionRef: page.revisionRef });
    return;
  }
  const moveButton = event.target.closest("[data-unified-page-move]");
  if (!moveButton) return;
  const pages = asArray(unifiedArtifactWorkbench.artifactReview?.reviewMaterial?.pages).filter((item) => !item.excluded);
  const index = pages.findIndex((item) => item.pageId === moveButton.dataset.pageId);
  const target = moveButton.dataset.unifiedPageMove === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= pages.length) return;
  [pages[index], pages[target]] = [pages[target], pages[index]];
  appendUnifiedArtifactAction("reorder_pages", { pageIds: pages.map((item) => item.pageId) });
});
// UNIFIED_ARTIFACT_REVIEW_WORKBENCH_END
