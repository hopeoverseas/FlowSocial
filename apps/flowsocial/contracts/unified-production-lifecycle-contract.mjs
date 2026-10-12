import { hashUnifiedContent } from "./content-hash.mjs";

export const UNIFIED_PRODUCTION_LIFECYCLE_CONTRACT = "UnifiedProductionLifecycle@1.0";
export const UNIFIED_PRODUCTION_REVISION_CONTRACT = "UnifiedProductionRevision@1.0";
export const UNIFIED_PROMPT_COST_APPROVAL_CONTRACT = "UnifiedPromptCostApproval@1.0";
export const UNIFIED_PRODUCTION_COMMAND_CONTRACT = "UnifiedProductionCommand@1.0";

const HASH = /^[a-f0-9]{64}$/;
const LAYERS = Object.freeze(["authority", "content", "visual", "delivery"]);
const COMMAND_STATES = new Set(["pending", "succeeded", "failed", "unknown_effect", "reconciled"]);

function fail(code, fieldPaths = []) {
  throw Object.assign(new Error(code), { code, statusCode: 409, details: { fieldPaths } });
}

function object(value) { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
function text(value) { return typeof value === "string" && Boolean(value.trim()); }
function hash(value) { return typeof value === "string" && HASH.test(value); }
function clone(value) { return structuredClone(value); }
function exact(value, keys) { return object(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key)); }
function ref(value) { return exact(value, ["id", "hash"]) && text(value.id) && hash(value.hash); }
function sameRef(left, right) { return ref(left) && ref(right) && left.id === right.id && left.hash === right.hash; }
function orderedUniqueLayers(value) {
  return Array.isArray(value) && value.length > 0 && value.every((item) => LAYERS.includes(item))
    && new Set(value).size === value.length && JSON.stringify(value) === JSON.stringify(LAYERS.filter((layer) => value.includes(layer)));
}
function validTime(value) { const time = new Date(value); return !Number.isNaN(time.getTime()) && time.toISOString() === value; }
function factRef(value, field) { return { id: value.id, hash: value[field] }; }

function collection(store, name) {
  const value = store?.[name];
  if (value === undefined) return [];
  if (!Array.isArray(value)) fail("UNIFIED_PRODUCTION_LIFECYCLE_STORE_INVALID", [`$.${name}`]);
  return value;
}

function scopeMatches(value, scope) {
  return value.projectId === scope.projectId && value.platform === scope.platform;
}

function validateScope(scope) {
  if (!exact(scope, ["projectId", "platform"]) || !text(scope.projectId) || scope.platform !== "wechat") {
    fail("UNIFIED_PRODUCTION_LIFECYCLE_SCOPE_INVALID", ["$.scope"]);
  }
}

function expectedInvalidations(changedLayers) {
  const changed = new Set(changedLayers);
  if (changed.has("authority")) return [...LAYERS];
  if (changed.has("visual")) return ["visual", "delivery"];
  if (changed.has("content")) return ["content", "delivery"];
  return ["delivery"];
}

export function validateUnifiedProductionRevision(value) {
  const keys = ["schemaVersion", "contract", "id", "projectId", "platform", "parentRevisionRef", "changedLayers", "invalidatedLayers", "sourceRef", "recordedAt", "revisionHash"];
  if (!exact(value, keys) || value.schemaVersion !== "1.0" || value.contract !== UNIFIED_PRODUCTION_REVISION_CONTRACT
    || !text(value.id) || !text(value.projectId) || value.platform !== "wechat" || !(value.parentRevisionRef === null || ref(value.parentRevisionRef))
    || !orderedUniqueLayers(value.changedLayers) || !orderedUniqueLayers(value.invalidatedLayers) || !ref(value.sourceRef) || !validTime(value.recordedAt) || !hash(value.revisionHash)) {
    fail("UNIFIED_PRODUCTION_REVISION_INVALID", ["$"]);
  }
  if (JSON.stringify(value.invalidatedLayers) !== JSON.stringify(expectedInvalidations(value.changedLayers))) {
    fail("UNIFIED_PRODUCTION_REVISION_INVALIDATION_INVALID", ["$.invalidatedLayers"]);
  }
  const copy = clone(value); delete copy.revisionHash;
  if (hashUnifiedContent(copy) !== value.revisionHash) fail("UNIFIED_PRODUCTION_REVISION_HASH_INVALID", ["$.revisionHash"]);
  return value;
}

export function appendUnifiedProductionRevision(store, input) {
  validateScope(input?.scope);
  if (!exact(input, ["scope", "id", "parentRevisionRef", "changedLayers", "sourceRef", "recordedAt"]) || !text(input.id)
    || !(input.parentRevisionRef === null || ref(input.parentRevisionRef)) || !orderedUniqueLayers(input.changedLayers)
    || !ref(input.sourceRef) || !validTime(input.recordedAt)) fail("UNIFIED_PRODUCTION_REVISION_INPUT_INVALID", ["$"]);
  const values = collection(store, "unifiedProductionRevisions");
  const scopeValues = values.filter((item) => scopeMatches(item, input.scope)).map(validateUnifiedProductionRevision);
  const existing = scopeValues.find((item) => item.id === input.id);
  const draft = {
    schemaVersion: "1.0", contract: UNIFIED_PRODUCTION_REVISION_CONTRACT, id: input.id, ...clone(input.scope),
    parentRevisionRef: clone(input.parentRevisionRef), changedLayers: clone(input.changedLayers),
    invalidatedLayers: expectedInvalidations(input.changedLayers), sourceRef: clone(input.sourceRef), recordedAt: input.recordedAt
  };
  const value = { ...draft, revisionHash: hashUnifiedContent(draft) };
  validateUnifiedProductionRevision(value);
  if (existing) {
    if (existing.revisionHash !== value.revisionHash) fail("UNIFIED_PRODUCTION_REVISION_ID_CONFLICT", ["$.id"]);
    return { created: false, revision: clone(existing) };
  }
  if (input.parentRevisionRef !== null && !scopeValues.some((item) => sameRef(factRef(item, "revisionHash"), input.parentRevisionRef))) {
    fail("UNIFIED_PRODUCTION_REVISION_PARENT_NOT_FOUND", ["$.parentRevisionRef"]);
  }
  store.unifiedProductionRevisions = [...values.map(clone), clone(value)];
  return { created: true, revision: clone(value) };
}

export function validateUnifiedPromptCostApproval(value) {
  const keys = ["schemaVersion", "contract", "id", "projectId", "platform", "visualRevisionRef", "promptPlanRef", "costPlanRef", "decision", "decidedBy", "decidedAt", "approvalHash"];
  if (!exact(value, keys) || value.schemaVersion !== "1.0" || value.contract !== UNIFIED_PROMPT_COST_APPROVAL_CONTRACT || !text(value.id)
    || !text(value.projectId) || value.platform !== "wechat" || !ref(value.visualRevisionRef) || !ref(value.promptPlanRef)
    || !ref(value.costPlanRef) || !["approved", "rejected"].includes(value.decision) || !text(value.decidedBy) || !validTime(value.decidedAt) || !hash(value.approvalHash)) {
    fail("UNIFIED_PROMPT_COST_APPROVAL_INVALID", ["$"]);
  }
  const copy = clone(value); delete copy.approvalHash;
  if (hashUnifiedContent(copy) !== value.approvalHash) fail("UNIFIED_PROMPT_COST_APPROVAL_HASH_INVALID", ["$.approvalHash"]);
  return value;
}

export function appendUnifiedPromptCostApproval(store, input) {
  validateScope(input?.scope);
  if (!exact(input, ["scope", "id", "visualRevisionRef", "promptPlanRef", "costPlanRef", "decision", "decidedBy", "decidedAt"])) {
    fail("UNIFIED_PROMPT_COST_APPROVAL_INPUT_INVALID", ["$"]);
  }
  const revision = collection(store, "unifiedProductionRevisions").map(validateUnifiedProductionRevision)
    .find((item) => scopeMatches(item, input.scope) && sameRef(factRef(item, "revisionHash"), input.visualRevisionRef));
  if (!revision || !revision.changedLayers.includes("visual")) fail("UNIFIED_PROMPT_COST_APPROVAL_VISUAL_REVISION_REQUIRED", ["$.visualRevisionRef"]);
  const values = collection(store, "unifiedPromptCostApprovals").filter((item) => scopeMatches(item, input.scope)).map(validateUnifiedPromptCostApproval);
  const draft = { schemaVersion: "1.0", contract: UNIFIED_PROMPT_COST_APPROVAL_CONTRACT, id: input.id, ...clone(input.scope), visualRevisionRef: clone(input.visualRevisionRef), promptPlanRef: clone(input.promptPlanRef), costPlanRef: clone(input.costPlanRef), decision: input.decision, decidedBy: input.decidedBy, decidedAt: input.decidedAt };
  const value = { ...draft, approvalHash: hashUnifiedContent(draft) };
  validateUnifiedPromptCostApproval(value);
  const existing = values.find((item) => item.id === value.id);
  if (existing) {
    if (existing.approvalHash !== value.approvalHash) fail("UNIFIED_PROMPT_COST_APPROVAL_ID_CONFLICT", ["$.id"]);
    return { created: false, approval: clone(existing) };
  }
  store.unifiedPromptCostApprovals = [...collection(store, "unifiedPromptCostApprovals").map(clone), clone(value)];
  return { created: true, approval: clone(value) };
}

export function validateUnifiedProductionCommand(value) {
  const keys = ["schemaVersion", "contract", "id", "projectId", "platform", "commandKind", "versionRef", "idempotencyKey", "state", "attempt", "previousCommandRef", "effectRef", "reconciliation", "recordedAt", "commandHash"];
  const reconciliation = value?.reconciliation;
  if (!exact(value, keys) || value.schemaVersion !== "1.0" || value.contract !== UNIFIED_PRODUCTION_COMMAND_CONTRACT || !text(value.id)
    || !text(value.projectId) || value.platform !== "wechat" || !text(value.commandKind) || !ref(value.versionRef) || !text(value.idempotencyKey)
    || !COMMAND_STATES.has(value.state) || !Number.isInteger(value.attempt) || value.attempt !== 1 || !(value.previousCommandRef === null || ref(value.previousCommandRef)) || !(value.effectRef === null || ref(value.effectRef))
    || !(reconciliation === null || exact(reconciliation, ["observedState", "observedAt", "evidenceRef"]) && ["succeeded", "failed", "not_found"].includes(reconciliation.observedState) && validTime(reconciliation.observedAt) && ref(reconciliation.evidenceRef))
    || !validTime(value.recordedAt) || !hash(value.commandHash)) fail("UNIFIED_PRODUCTION_COMMAND_INVALID", ["$"]);
  if ((value.state === "pending" && (value.previousCommandRef !== null || value.effectRef !== null || reconciliation !== null))
    || (value.state !== "pending" && value.previousCommandRef === null)
    || (["succeeded", "failed"].includes(value.state) && value.effectRef === null)
    || (value.state === "unknown_effect" && value.effectRef !== null)
    || (value.state === "reconciled" && reconciliation === null)) fail("UNIFIED_PRODUCTION_COMMAND_STATE_INVALID", ["$.state"]);
  const copy = clone(value); delete copy.commandHash;
  if (hashUnifiedContent(copy) !== value.commandHash) fail("UNIFIED_PRODUCTION_COMMAND_HASH_INVALID", ["$.commandHash"]);
  return value;
}

function commandValues(store, scope) {
  const values = collection(store, "unifiedProductionCommands").filter((item) => scopeMatches(item, scope)).map(validateUnifiedProductionCommand);
  const heads = new Map();
  for (const item of values) {
    const previous = heads.get(item.id) || null;
    if (item.state === "pending") {
      if (previous || item.previousCommandRef !== null) fail("UNIFIED_PRODUCTION_COMMAND_HISTORY_INVALID", ["$.previousCommandRef"]);
    } else {
      if (!previous || !sameRef(item.previousCommandRef, factRef(previous, "commandHash"))
        || previous.idempotencyKey !== item.idempotencyKey || previous.commandKind !== item.commandKind
        || !sameRef(previous.versionRef, item.versionRef)
        || !((previous.state === "pending" && ["succeeded", "failed", "unknown_effect"].includes(item.state))
          || (previous.state === "unknown_effect" && item.state === "reconciled"))) {
        fail("UNIFIED_PRODUCTION_COMMAND_HISTORY_INVALID", ["$.previousCommandRef"]);
      }
    }
    heads.set(item.id, item);
  }
  return values;
}

function latestCommandValues(store, scope) {
  const heads = new Map();
  for (const item of commandValues(store, scope)) heads.set(item.id, item);
  return [...heads.values()];
}

export function startUnifiedProductionCommand(store, input) {
  validateScope(input?.scope);
  if (!exact(input, ["scope", "id", "commandKind", "versionRef", "idempotencyKey", "recordedAt"]) || !text(input.id) || !text(input.commandKind) || !ref(input.versionRef) || !text(input.idempotencyKey) || !validTime(input.recordedAt)) fail("UNIFIED_PRODUCTION_COMMAND_INPUT_INVALID", ["$"]);
  const values = commandValues(store, input.scope);
  const matching = values.filter((item) => item.idempotencyKey === input.idempotencyKey);
  const existing = matching.at(-1) || null;
  const draft = { schemaVersion: "1.0", contract: UNIFIED_PRODUCTION_COMMAND_CONTRACT, id: input.id, ...clone(input.scope), commandKind: input.commandKind, versionRef: clone(input.versionRef), idempotencyKey: input.idempotencyKey, state: "pending", attempt: 1, previousCommandRef: null, effectRef: null, reconciliation: null, recordedAt: input.recordedAt };
  const value = { ...draft, commandHash: hashUnifiedContent(draft) };
  validateUnifiedProductionCommand(value);
  if (existing) {
    if (existing.id !== input.id || existing.commandKind !== input.commandKind || !sameRef(existing.versionRef, input.versionRef)) fail("UNIFIED_PRODUCTION_COMMAND_IDEMPOTENCY_CONFLICT", ["$.idempotencyKey"]);
    return { created: false, command: clone(existing) };
  }
  if (values.some((item) => item.id === value.id)) fail("UNIFIED_PRODUCTION_COMMAND_ID_CONFLICT", ["$.id"]);
  store.unifiedProductionCommands = [...collection(store, "unifiedProductionCommands").map(clone), clone(value)];
  return { created: true, command: clone(value) };
}

export function settleUnifiedProductionCommand(store, input) {
  validateScope(input?.scope);
  if (!exact(input, ["scope", "id", "state", "effectRef", "recordedAt"]) || !["succeeded", "failed", "unknown_effect"].includes(input.state) || !(input.effectRef === null || ref(input.effectRef)) || !validTime(input.recordedAt)) fail("UNIFIED_PRODUCTION_COMMAND_SETTLE_INPUT_INVALID", ["$"]);
  const current = latestCommandValues(store, input.scope).find((item) => item.id === input.id);
  if (!current) fail("UNIFIED_PRODUCTION_COMMAND_NOT_FOUND", ["$.id"]);
  if (current.state !== "pending") fail("UNIFIED_PRODUCTION_COMMAND_TERMINAL", ["$.state"]);
  const draft = { ...clone(current), state: input.state, previousCommandRef: factRef(current, "commandHash"), effectRef: clone(input.effectRef), recordedAt: input.recordedAt };
  delete draft.commandHash;
  const value = { ...draft, commandHash: hashUnifiedContent(draft) };
  validateUnifiedProductionCommand(value);
  store.unifiedProductionCommands = [...collection(store, "unifiedProductionCommands").map(clone), clone(value)];
  return { changed: true, command: clone(value) };
}

export function reconcileUnifiedProductionCommand(store, input) {
  validateScope(input?.scope);
  if (!exact(input, ["scope", "id", "observedState", "observedAt", "evidenceRef"]) || !["succeeded", "failed", "not_found"].includes(input.observedState) || !validTime(input.observedAt) || !ref(input.evidenceRef)) fail("UNIFIED_PRODUCTION_COMMAND_RECONCILE_INPUT_INVALID", ["$"]);
  const current = latestCommandValues(store, input.scope).find((item) => item.id === input.id);
  if (!current) fail("UNIFIED_PRODUCTION_COMMAND_NOT_FOUND", ["$.id"]);
  if (current.state !== "unknown_effect") fail("UNIFIED_PRODUCTION_COMMAND_RECONCILIATION_NOT_REQUIRED", ["$.state"]);
  const draft = { ...clone(current), state: "reconciled", previousCommandRef: factRef(current, "commandHash"), reconciliation: { observedState: input.observedState, observedAt: input.observedAt, evidenceRef: clone(input.evidenceRef) }, recordedAt: input.observedAt };
  delete draft.commandHash;
  const value = { ...draft, commandHash: hashUnifiedContent(draft) };
  validateUnifiedProductionCommand(value);
  store.unifiedProductionCommands = [...collection(store, "unifiedProductionCommands").map(clone), clone(value)];
  return { changed: true, command: clone(value) };
}

export function getUnifiedProductionLifecycleState(store, scope) {
  validateScope(scope);
  const revisions = collection(store, "unifiedProductionRevisions").filter((item) => scopeMatches(item, scope)).map(validateUnifiedProductionRevision);
  const heads = Object.fromEntries(LAYERS.map((layer) => [layer, null]));
  for (const revision of revisions) for (const layer of revision.changedLayers) heads[layer] = factRef(revision, "revisionHash");
  const approvals = collection(store, "unifiedPromptCostApprovals").filter((item) => scopeMatches(item, scope)).map(validateUnifiedPromptCostApproval);
  const currentVisualApproval = approvals.find((item) => item.decision === "approved" && sameRef(item.visualRevisionRef, heads.visual)) || null;
  const commands = latestCommandValues(store, scope);
  const unresolved = commands.filter((item) => item.state === "unknown_effect").map((item) => factRef(item, "commandHash"));
  return Object.freeze({ schemaVersion: "1.0", contract: UNIFIED_PRODUCTION_LIFECYCLE_CONTRACT, scope: clone(scope), revisionHeads: clone(heads), promptCostApproval: currentVisualApproval ? factRef(currentVisualApproval, "approvalHash") : null, blockers: [
    ...(heads.authority ? [] : ["authority_revision_required"]),
    ...(heads.content ? [] : ["content_revision_required"]),
    ...(heads.visual ? [] : ["visual_revision_required"]),
    ...(heads.visual && !currentVisualApproval ? ["current_prompt_cost_approval_required"] : []),
    ...(unresolved.length ? ["unknown_effect_reconciliation_required"] : [])
  ], unresolvedCommandRefs: unresolved });
}
