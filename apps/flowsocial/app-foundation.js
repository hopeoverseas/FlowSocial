(function registerFlowSocialAppFoundation(global) {
  const escapeHtml = (value = "") => String(value).replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);
  const asArray = (value) => Array.isArray(value) ? value : value == null || value === "" ? [] : [value];
  const parseKeywordLines = (value = "") => [...new Set(String(value).split(/[\r\n,，]+/).map((item) => item.trim()).filter(Boolean))];

  function humanizeDisplayValue(value) {
    if (value == null || value === "") return "尚未提供";
    if (["string", "number", "boolean"].includes(typeof value)) return String(value);
    if (Array.isArray(value)) return value.map(humanizeDisplayValue).filter(Boolean).join("、");
    if (typeof value !== "object") return "尚未提供";
    if (value.none === true || value.status === "none_declared") return value.summary || "用户确认目前没有可用于内容创作的材料";
    const labels = { primaryOutcome: "核心目标", timeHorizon: "目标周期", targetAudience: "目标客户", successSignals: "验证指标", currentStage: "当前阶段", stageEvidence: "判断依据", bottleneck: "当前瓶颈", nextMilestone: "下一里程碑", summary: "概述", steps: "执行步骤", priority: "优先级", resourceConstraints: "资源约束", tradeoffs: "取舍" };
    const headline = value.summary || value.primaryOutcome || value.currentStage || value.name || value.description || "";
    const details = Object.entries(value).filter(([key, item]) => !["summary", "name", "description"].includes(key) && item != null && item !== "" && (!Array.isArray(item) || item.length)).slice(0, 6).map(([key, item]) => `${labels[key] || key}：${humanizeDisplayValue(item)}`);
    return [headline && humanizeDisplayValue(headline), ...details].filter(Boolean).join("；") || "尚未提供";
  }

  global.FlowSocialAppFoundation = Object.freeze({ escapeHtml, asArray, parseKeywordLines, humanizeDisplayValue });
})(window);
