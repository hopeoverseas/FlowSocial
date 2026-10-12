function renderV2StrategyAdjustmentCards(strategyAdjustments = {}) {
  const cards = (strategyAdjustments.candidates || []).map((item) => {
    const decision = item.decision;
    const binding = item.cycleBinding;
    const state = binding ? `已进入周期 ${binding.cycleId}` : decision?.resolution === "approved_for_next_cycle" ? "已批准，等待下一周期" : decision?.resolution === "rejected" ? "已拒绝" : "等待人工决定";
    const discuss = `<button class="btn secondary" data-strategy-feedback-discuss="${escapeHtml(item.id)}">与策略 Agent 讨论</button>`;
    const actions = decision ? `<div class="direction-actions-v2">${discuss}</div>` : `<div class="direction-actions-v2">${discuss}<button class="btn secondary" data-strategy-adjustment-resolution="rejected" data-strategy-adjustment-id="${escapeHtml(item.id)}" data-strategy-adjustment-hash="${escapeHtml(item.candidateHash)}">暂不采用</button><button class="btn primary" data-strategy-adjustment-resolution="approved_for_next_cycle" data-strategy-adjustment-id="${escapeHtml(item.id)}" data-strategy-adjustment-hash="${escapeHtml(item.candidateHash)}">批准用于下一周期</button></div>`;
    return `<article class="feedback-insight-card"><div><span>策略调整草案</span><strong>${escapeHtml(item.nextCycleExperiment.changeVariable)}</strong></div><p>${escapeHtml(item.nextCycleExperiment.hypothesis)}</p><small>${escapeHtml(state)} · 目标指标 ${escapeHtml(item.nextCycleExperiment.targetMetric || "由策略 Agent 复核")}</small><em>活动策略快照保持不变；讨论不会直接修改策略，只有审阅并激活新草案后才会生效。</em>${actions}</article>`;
  }).join("");
  const portfolio = strategyAdjustments.nextCyclePortfolio;
  const portfolioCard = portfolio ? `<article class="feedback-insight-card ${portfolio.evidenceWindow.confidence === "insufficient" ? "insufficient" : ""}"><div><span>${portfolio.evidenceWindow.confidence === "insufficient" ? "冷启动的下一周期内容组合" : "数据驱动的下一周期内容组合"}</span><strong>${portfolio.allocation.counts.sustain} 延续 · ${portfolio.allocation.counts.repair} 修复 · ${portfolio.allocation.counts.explore} 探索</strong></div><p>${portfolio.evidenceWindow.confidence === "insufficient" ? "成熟数据不足，当前比例是保守默认值，不代表系统已经从表现数据得出结论。" : "每个槽位都必须生成全新选题和全新正文；数据只决定组合与重点变量。"}</p><small>${portfolio.evidenceWindow.maturePublicationCount} 篇成熟样本 · ${portfolio.evidenceWindow.cycleCount} 个周期 · ${escapeHtml(portfolio.evidenceWindow.confidence)}</small><em>只读建议，不会自动生成内容或修改活动策略。</em></article>` : "";
  const evaluationCards = (portfolio?.priorCycleEvaluations || []).slice(-3).map((item) => `<article class="feedback-insight-card"><div><span>周期学习结论</span><strong>${escapeHtml(({ supported: "得到支持", partially_supported: "部分支持", rejected: "未得到支持", insufficient: "证据不足" })[item.status] || item.status)}</strong></div><p>${escapeHtml(item.metric || "目标指标")}：历史 ${item.baseline == null ? "不足" : `${(item.baseline * 100).toFixed(1)}%`} → 本期 ${item.current == null ? "不足" : `${(item.current * 100).toFixed(1)}%`}</p><small>${item.observedSlotCount} 个已观察修复槽位</small><em>${escapeHtml(item.interpretationBoundary)}</em></article>`).join("");
  return cards + portfolioCard + evaluationCards || (strategyAdjustments.loadError ? `<article class="feedback-insight-card insufficient"><div><span>策略调整暂不可用</span><strong>发布反馈队列不受影响</strong></div><p>${escapeHtml(strategyAdjustments.loadError)}</p></article>` : "");
}

async function decideV2StrategyAdjustment(candidateId, candidateHash, resolution) {
  const account = v2AccountRecord();
  if (!account?.companyId) return showToast("请先选择具体社媒账号");
  try {
    await window.FlowAPI.confirmStrategyAdjustment(candidateId, {
      companyId: account.companyId,
      socialAccountId: account.id,
      candidateHash,
      resolution,
      actorType: "user",
      actorId: "workspace_user",
      userConfirmed: true,
      idempotencyKey: `strategy-adjustment:${candidateId}:${candidateHash}`
    });
    await loadV2Review();
    showToast(resolution === "approved_for_next_cycle" ? "调整已批准；生成下一周期时会绑定这项实验" : "调整已拒绝；活动策略未发生变化");
  } catch (error) {
    showToast(`策略调整决定失败：${error.message}`);
  }
}

function openV2StrategyFeedbackDiscussion(candidateId) {
  const candidate = asArray(v2Workspace.strategyAdjustments?.candidates).find((item) => item.id === candidateId);
  if (!candidate) return showToast("无法定位这条策略反馈，请刷新复盘页后重试");
  switchView("agent");
  const input = $("#agentMessageInput");
  if (input) {
    input.value = `我想基于发布反馈和你讨论是否需要调整策略，但请先分析和提建议，不要直接修改或激活策略。\n\n反馈候选：${candidate.id}\n观察到的问题：${candidate.sourceBottleneck || candidate.nextCycleExperiment?.sourceBottleneck || "待复核"}\n建议实验变量：${candidate.nextCycleExperiment?.changeVariable || "待复核"}\n目标指标：${candidate.nextCycleExperiment?.targetMetric || "待复核"}\n当前假设：${candidate.nextCycleExperiment?.hypothesis || "待复核"}`;
    input.focus();
    input.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  showToast("反馈证据已带到策略 Agent；发送后会先讨论，不会自动改策略");
}
