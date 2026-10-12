import { hashUnifiedContent } from "./unified-content-contracts.mjs";

const CONTRACT = "UnifiedWechatStageCheckpoint@1.0";
const COLLECTION = "unifiedWechatStageCheckpoints";
const HASH = /^[a-f0-9]{64}$/;

const clone = (value) => value == null ? value : structuredClone(value);
const text = (value) => typeof value === "string" && Boolean(value.trim());

function fail(code, fieldPaths = []) {
  throw Object.assign(new Error(code), { code, statusCode: 409, details: { fieldPaths } });
}
function checkpointId(materializationId, stepId) {
  return `wechat-stage-checkpoint:${hashUnifiedContent({ materializationId, stepId }).slice(0, 24)}`;
}

export function validateUnifiedWechatStageCheckpoint(value) {
  const keys = ["schemaVersion", "contract", "id", "materializationId", "platform", "stepId", "capability",
    "inputHash", "planHash", "invocationHash", "outputFact", "outputFactHash", "completedAt", "checkpointHash"];
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))
    || value.schemaVersion !== "1.0" || value.contract !== CONTRACT || value.platform !== "wechat"
    || !text(value.id) || !text(value.materializationId) || !text(value.stepId) || !text(value.capability)
    || !HASH.test(value.inputHash || "") || !HASH.test(value.planHash || "") || !HASH.test(value.invocationHash || "")
    || !value.outputFact || typeof value.outputFact !== "object" || !HASH.test(value.outputFactHash || "")
    || !text(value.completedAt) || !HASH.test(value.checkpointHash || "")) {
    fail("UNIFIED_WECHAT_STAGE_CHECKPOINT_INVALID", ["$"]);
  }
  if (value.id !== checkpointId(value.materializationId, value.stepId)
    || value.outputFactHash !== hashUnifiedContent(value.outputFact)) {
    fail("UNIFIED_WECHAT_STAGE_CHECKPOINT_INVALID", ["$.id", "$.outputFactHash"]);
  }
  const { checkpointHash, ...base } = value;
  if (checkpointHash !== hashUnifiedContent(base)) fail("UNIFIED_WECHAT_STAGE_CHECKPOINT_INVALID", ["$.checkpointHash"]);
  return value;
}

export function resolveUnifiedWechatStageCheckpoint(store, query) {
  const values = Array.isArray(store?.[COLLECTION]) ? store[COLLECTION] : [];
  const id = checkpointId(query?.materializationId, query?.stepId);
  const matches = values.filter((item) => item?.id === id);
  if (matches.length > 1) fail("UNIFIED_WECHAT_STAGE_CHECKPOINT_AMBIGUOUS", ["$.id"]);
  if (!matches.length) return null;
  const value = validateUnifiedWechatStageCheckpoint(matches[0]);
  if (value.materializationId !== query.materializationId || value.stepId !== query.stepId
    || value.capability !== query.capability || value.inputHash !== query.inputHash
    || value.planHash !== query.planHash || value.invocationHash !== query.invocationHash) {
    fail("UNIFIED_WECHAT_STAGE_CHECKPOINT_CONFLICT", ["$.inputHash", "$.planHash", "$.invocationHash"]);
  }
  return clone(value);
}

export function appendUnifiedWechatStageCheckpoint(store, input) {
  const base = {
    schemaVersion: "1.0", contract: CONTRACT,
    id: checkpointId(input.materializationId, input.stepId),
    materializationId: input.materializationId, platform: "wechat",
    stepId: input.stepId, capability: input.capability,
    inputHash: input.inputHash, planHash: input.planHash,
    invocationHash: input.invocationHash,
    outputFact: clone(input.outputFact), outputFactHash: hashUnifiedContent(input.outputFact),
    completedAt: input.completedAt
  };
  const value = validateUnifiedWechatStageCheckpoint({ ...base, checkpointHash: hashUnifiedContent(base) });
  store[COLLECTION] ||= [];
  const existing = store[COLLECTION].find((item) => item?.id === value.id);
  if (existing) {
    validateUnifiedWechatStageCheckpoint(existing);
    if (existing.checkpointHash !== value.checkpointHash) fail("UNIFIED_WECHAT_STAGE_CHECKPOINT_CONFLICT", ["$.id"]);
    return { created: false, checkpoint: clone(existing) };
  }
  store[COLLECTION] = [...store[COLLECTION], clone(value)];
  return { created: true, checkpoint: clone(value) };
}
