function setRuntimeBanner(state, title, detail) {
  const banner = $("#runtimeBanner");
  if (!banner) return;
  banner.className = `runtime-banner ${state}`;
  $("#runtimeTitle").textContent = title;
  $("#runtimeDetail").textContent = detail;
  $("#runtimeOpenLink").hidden = state !== "blocked";
  document.documentElement.dataset.apiMode = state;
}

function renderProductCapabilityPolicy(policy, skillRuntime) {
  const anchor = $("#integrationStatus");
  if (!anchor || !policy) return;
  let panel = $("#productCapabilityPolicyPanel");
  if (!panel) {
    anchor.insertAdjacentHTML("afterend", `<section class="surface product-capability-policy" id="productCapabilityPolicyPanel"></section>`);
    panel = $("#productCapabilityPolicyPanel");
  }
  const healthy = policy.baselineReady === true && policy.externalEffectsClosed === true && policy.runtimeFlagsAligned === true;
  const deviations = asArray(policy.deviations);
  const unsafe = asArray(policy.unsafeDeviations);
  const mismatch = asArray(policy.runtimeMismatches);
  panel.classList.toggle("warning", !healthy);
  panel.innerHTML = `<div class="surface-head"><div><span class="eyebrow">产品能力策略</span><h2>${healthy ? "当前本地产品基线一致" : "当前能力配置需要处理"}</h2><p>界面、运行时开关与 Skill Manifest 使用同一 local-package 策略；平台上传和发布默认关闭。</p></div><span class="version-chip">策略 ${escapeHtml(policy.policyVersion || "—")}</span></div>
    <div class="product-capability-summary">
      <article><strong>${policy.counts?.baseline || 0}</strong><span>本地主链能力</span><small>${policy.baselineReady ? "全部可用" : "存在缺失"}</small></article>
      <article><strong>${policy.counts?.controlled || 0}</strong><span>受控 Provider 能力</span><small>保留费用与人工确认</small></article>
      <article><strong>${policy.counts?.externalEffect || 0}</strong><span>平台外部效果</span><small>${policy.externalEffectsClosed ? "全部关闭" : `${unsafe.length} 项异常开启`}</small></article>
      <article><strong>${policy.counts?.experimental || 0}</strong><span>实验能力</span><small>默认不进入主链</small></article>
    </div>
    <div class="product-capability-foot ${healthy ? "healthy" : "warning"}"><strong>${healthy ? "校验通过" : "发现策略偏差"}</strong><span>Skill Manifest ${escapeHtml(skillRuntime?.manifestVersion || "—")} · Profile ${escapeHtml(skillRuntime?.productProfile || policy.mode || "—")} · 运维覆盖 ${deviations.length} · 运行时错位 ${mismatch.length}</span></div>`;
}

async function refreshRuntimeStatus() {
  if (window.FlowAPI.mode === "blocked") {
    setRuntimeBanner("blocked", "当前是本地文件预览", "真实 API 未运行，请启动服务后从本地服务地址访问");
    return;
  }
  if (window.FlowAPI.mode === "demo") {
    setRuntimeBanner("demo", "当前是明确开启的演示模式", "页面数据不会写入真实工作台；移除地址中的 ?demo=1 可退出");
    return;
  }
  try {
    const status = await window.FlowAPI.getRuntimeStatus();
    if (!status.buildId) {
      setRuntimeBanner("error", "后端版本过旧，需要重启", "当前页面已更新，但运行中的后端不包含版本与交接状态检查。请重新启动 FlowSocial 后端。\n");
      return;
    }
    if (status.restartRequired) {
      setRuntimeBanner("error", "后端代码已更新，需要重启", `当前进程加载版本 ${status.buildId}，磁盘代码版本 ${status.currentSourceBuildId}。重启后再继续试跑。`);
      return;
    }
    renderProductCapabilityPolicy(status.productCapabilityPolicy, status.skillRuntime);
    const configured = Object.values(status.providers || {}).filter((item) => item?.configured).length;
    const workspaceData = status.workspaceData;
    const dataDetail = workspaceData?.status === "incomplete"
      ? `工作区数据未就绪（缺少 ${(workspaceData.missing || []).join("、") || "必要数据"}）`
      : "数据存储正常";
    setRuntimeBanner(workspaceData?.status === "incomplete" ? "notice" : "live", workspaceData?.status === "incomplete" ? "真实工作台已连接，但内容数据未就绪" : "真实工作台已连接", `${dataDetail} · 外部能力 ${configured}/3 已连接 · 启动于 ${new Date(status.serverStartedAt).toLocaleTimeString("zh-CN")}`);
  } catch (error) {
    setRuntimeBanner("error", "本地服务连接失败", error.message);
  }
}
