(function registerTopicAdjustmentWorkbench(global) {
  const escapeHtml = global.FlowSocialAppFoundation?.escapeHtml || ((value) => String(value || "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]));
  const state = { session: null, cycle: null, slot: null, onAdopt: null, busy: false };
  const byId = (id) => document.getElementById(id);
  const dialog = () => byId("topicAdjustmentDialog");

  function message(role, text) {
    const log = byId("topicAdjustmentChat");
    log.insertAdjacentHTML("beforeend", `<div class="agent-chat-message ${role}"><span>${role === "user" ? "你" : "AI"}</span><p>${escapeHtml(text)}</p></div>`);
    log.scrollTop = log.scrollHeight;
  }

  function renderCandidates(candidates = []) {
    const target = byId("topicAdjustmentCandidates");
    target.innerHTML = candidates.length ? candidates.map((candidate) => {
      const duplicate = candidate.duplication || {};
      const blocked = duplicate.decision === "block";
      const status = blocked ? "与历史/本批过近" : duplicate.decision === "warn" ? "相似度需留意" : "去重通过";
      return `<article class="topic-adjustment-candidate ${blocked ? "blocked" : ""}"><header><span>候选 ${candidate.ordinal}</span><em>${status} · ${Math.round(Number(duplicate.score || 0) * 100)}%</em></header><h3>${escapeHtml(candidate.topic)}</h3><dl><div><dt>调整角度</dt><dd>${escapeHtml(candidate.angle)}</dd></div><div><dt>与原选题差异</dt><dd>${escapeHtml(candidate.difference)}</dd></div><div><dt>推荐理由</dt><dd>${escapeHtml(candidate.reason)}</dd></div>${duplicate.matchedTopic ? `<div><dt>最相近内容</dt><dd>${escapeHtml(duplicate.matchedTopic)}</dd></div>` : ""}</dl><button class="btn primary" type="button" data-adopt-topic-candidate="${escapeHtml(candidate.candidateId)}" data-candidate-hash="${escapeHtml(candidate.candidateHash)}" ${blocked ? "disabled" : ""}>采用这个选题</button></article>`;
    }).join("") : `<div class="empty-state">先和 AI 探讨人群、场景、问题和取舍。方向明确后，请明确说“基于刚才的讨论生成 3 个候选”。</div>`;
  }

  function setBusy(value) {
    state.busy = value;
    byId("sendTopicAdjustmentMessage").disabled = value;
    byId("topicAdjustmentInput").disabled = value;
    byId("topicAdjustmentBusy").hidden = !value;
  }

  async function send() {
    if (state.busy || !state.session) return;
    const input = byId("topicAdjustmentInput");
    const text = input.value.trim();
    if (!text) return;
    input.value = ""; message("user", text); setBusy(true);
    try {
      const result = await global.FlowAPI.sendTopicAdjustmentMessage(state.session.sessionId, { message: text, actor: "workspace_user" });
      state.session = result.session; message("assistant", result.turn.assistantMessage); renderCandidates(result.candidates);
    } catch (error) { message("assistant", `这次没有形成可用候选：${error.message}`); }
    finally { setBusy(false); input.focus(); }
  }

  async function adopt(button) {
    if (state.busy || !state.session) return;
    setBusy(true); button.disabled = true;
    try {
      const result = await global.FlowAPI.adoptTopicAdjustmentCandidate(state.session.sessionId, button.dataset.adoptTopicCandidate, {
        candidateHash: button.dataset.candidateHash, expectedPlanHash: state.cycle.confirmationPreviewHash, userConfirmed: true, actor: "workspace_user"
      });
      await state.onAdopt?.(result);
      dialog().close();
    } catch (error) { message("assistant", `暂时不能采用：${error.message}`); button.disabled = false; }
    finally { setBusy(false); }
  }

  async function open({ cycle, slot, onAdopt }) {
    state.cycle = cycle; state.slot = slot; state.onAdopt = onAdopt; state.session = null;
    byId("topicAdjustmentTitle").textContent = slot.topic;
    byId("topicAdjustmentScope").textContent = `${slot.accountName || slot.socialAccountId} · ${slot.platform === "wechat" ? "公众号" : "小红书"} · 仅调整选题方向`;
    byId("topicAdjustmentChat").innerHTML = `<div class="agent-chat-message assistant"><span>AI</span><p>我们可以先探讨这个选题的人群、场景、问题和取舍。我不会把你说的每句话直接当成题目；方向明确后，你再让我生成 3 个候选。这里不会改日期、账号、平台、策略、正文或图片。</p></div>`;
    renderCandidates([]); byId("topicAdjustmentInput").value = ""; setBusy(true); dialog().showModal();
    try {
      state.session = await global.FlowAPI.startTopicAdjustment(cycle.cycleId, slot.slotId, { actor: "workspace_user" });
      setBusy(false); byId("topicAdjustmentInput").focus();
    } catch (error) { message("assistant", `无法开始选题调整：${error.message}`); byId("topicAdjustmentInput").disabled = true; }
  }

  document.addEventListener("DOMContentLoaded", () => {
    byId("sendTopicAdjustmentMessage")?.addEventListener("click", send);
    byId("topicAdjustmentInput")?.addEventListener("keydown", (event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); } });
    byId("requestTopicCandidates")?.addEventListener("click", () => { byId("topicAdjustmentInput").value = "请基于刚才的讨论生成 3 个选题候选。"; send(); });
    byId("topicAdjustmentCandidates")?.addEventListener("click", (event) => { const button = event.target.closest("[data-adopt-topic-candidate]"); if (button) adopt(button); });
  });
  global.FlowTopicAdjustmentWorkbench = Object.freeze({ open });
})(window);
