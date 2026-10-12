import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { hashUnifiedContent, validateContentMechanismDecision, validateUnifiedContentOpportunity } from "../../content-agent/unified-content-contracts.mjs";
import { runUnifiedPrerequisitePreparation } from "../live/unified-content-prerequisites-run.mjs";
import { prepareUnifiedLivePreflight, sha256, stableJson } from "../live/unified-content-live-server.mjs";

process.env.UNIFIED_CONTENT_STAGED_ATOMIC_DUAL_BOOTSTRAP_V1 = "0";

const tmpRoot = resolve("apps/flowsocial/.tmp/unified-content-prerequisites-self-test");
rmSync(tmpRoot, { recursive: true, force: true });
mkdirSync(tmpRoot, { recursive: true });
const sourceDatabase = resolve(tmpRoot, "activity-source.db");
const isolatedDataDir = resolve(tmpRoot, "isolated-data");
mkdirSync(isolatedDataDir, { recursive: true });
const isolatedDatabase = resolve(isolatedDataDir, "flowsocial.db");

const company = { id: "company_fixture", companyId: "company_fixture", accountType: "company", activeStrategySnapshotId: "strategy_fixture" };
const designDnaSnapshot = {
  kind: "DesignDNA", schemaVersion: "1.0", id: "dna_prerequisite_fixture_v1", accountId: "xhs_fixture", version: 1, status: "confirmed",
  colors: ["#18352d"], fontPreferences: ["sans-serif"], layoutPreferences: ["stable-grid"], materials: ["paper"],
  photographyOrIllustrationDirection: "restrained editorial illustration", forbiddenMotifs: ["watermark"],
  confirmation: { decision: "confirmed", confirmedBy: "fixture", confirmedAt: "2026-08-06T00:00:00.000Z" }
};
const designDnaSnapshotRef = { id: designDnaSnapshot.id, hash: hashUnifiedContent(designDnaSnapshot) };
const xhs = { id: "xhs_fixture", companyId: company.id, platform: "xiaohongshu", status: "active", visualStyle: { designDnaSnapshotId: designDnaSnapshot.id, designDnaVersion: 1 } };
const wechat = { id: "wechat_fixture", companyId: company.id, platform: "wechat", status: "active" };
const legacyOpportunity = { id: "opportunity_legacy", kind: "ContentOpportunity", platform: "xiaohongshu", topic: "must remain unchanged" };
const store = { accounts: [company, xhs, wechat], designDnaSnapshots: [designDnaSnapshot], contentOpportunities: [legacyOpportunity] };
const strategyPayload = { schemaVersion: "2.0", strategyHotspotPolicy: "optional", positioning: "fixture" };

function createDatabase(path, payload = store) {
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE app_state (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL);
    CREATE TABLE strategy_snapshots (id TEXT PRIMARY KEY, account_id TEXT NOT NULL, version INTEGER NOT NULL, status TEXT NOT NULL, payload_json TEXT NOT NULL, source_session_id TEXT, created_at TEXT NOT NULL, confirmed_at TEXT, UNIQUE(account_id,version));
    CREATE TABLE strategy_snapshot_meta (strategy_snapshot_id TEXT PRIMARY KEY, source_draft_revision_id TEXT, document_hash TEXT, context_hash TEXT, activation_reason TEXT NOT NULL DEFAULT 'user_confirmed', supersedes_snapshot_id TEXT, created_at TEXT NOT NULL, FOREIGN KEY(strategy_snapshot_id) REFERENCES strategy_snapshots(id) ON DELETE CASCADE);
  `);
  db.prepare("INSERT INTO app_state VALUES (1, ?, 1, ?)").run(JSON.stringify(payload), "2026-08-06T00:00:00.000Z");
  db.prepare("INSERT INTO strategy_snapshots VALUES (?, ?, 1, 'active', ?, NULL, ?, ?)").run(company.activeStrategySnapshotId, company.id, JSON.stringify(strategyPayload), "2026-08-06T00:00:00.000Z", "2026-08-06T00:00:00.000Z");
  db.close();
}

createDatabase(sourceDatabase);
const sourceBefore = readFileSync(sourceDatabase);
copyFileSync(sourceDatabase, isolatedDatabase);

const request = {
  companyId: company.id,
  xiaohongshuAccountId: xhs.id,
  wechatAccountId: wechat.id,
  topic: "统一内容链路",
  contentObjective: "解释统一上游",
  hotspotEvaluation: { status: "not_available", candidateRefs: [], reason: "evaluated_current_window_no_usable_candidate", factPolicy: "external_event_not_business_fact" },
  idempotencyKey: "prerequisite_fixture_1"
};
const requestFile = resolve(tmpRoot, "request.json");
writeFileSync(requestFile, JSON.stringify(request));

const runnerSource = readFileSync(resolve("apps/flowsocial/scripts/live/unified-content-prerequisites-run.mjs"), "utf8");
assert.equal(runnerSource.includes("createUnifiedContentPrerequisites"), false, "runner must not import or call the domain store directly");
assert.equal(runnerSource.includes("writeStore("), false, "runner must not write Store directly");
const realFetch = globalThis.fetch;
const observedApiCalls = [];
let responseMutation = null;
globalThis.fetch = async (input, init) => {
  observedApiCalls.push({ url: String(input), method: init?.method, body: init?.body });
  const response = await realFetch(input, init);
  if (!responseMutation) return response;
  const payload = await response.json();
  const mutate = responseMutation;
  responseMutation = null;
  return new Response(JSON.stringify(mutate(payload)), { status: response.status, headers: { "content-type": "application/json" } });
};

const first = await runUnifiedPrerequisitePreparation({ dataDir: isolatedDataDir, requestFile });
assert.equal(first.created, true);
assert.equal(first.apiTransport, "http_loopback");
assert.equal(first.apiRoute, "/api/v1/unified-content-prerequisites");
assert.equal(first.apiStatus, 201);
assert.equal(first.providerCalls, 0);
assert.equal(first.hotspotCalls, 0);
assert.equal(first.imageCalls, 0);
assert.equal(first.platformCalls, 0);
assert.equal(first.externalCalls, 0);
assert.equal(first.activityDatabaseWrites, 0);
assert.equal(first.contentGenerated, false);
assert.equal(first.platformPublished, false);
assert.deepEqual(first.designDnaSnapshotRef, designDnaSnapshotRef);
const second = await runUnifiedPrerequisitePreparation({ dataDir: isolatedDataDir, requestFile });
assert.equal(second.created, false);
assert.equal(second.apiStatus, 200);
assert.deepEqual(second.contentOpportunityRef, first.contentOpportunityRef);
assert.deepEqual(second.mechanismDecisionRef, first.mechanismDecisionRef);
assert.deepEqual(second.designDnaSnapshotRef, designDnaSnapshotRef);

responseMutation = (payload) => { delete payload.designDnaSnapshotRef; return payload; };
await assert.rejects(() => runUnifiedPrerequisitePreparation({ dataDir: isolatedDataDir, requestFile }), (error) => error.code === "UNIFIED_PREREQUISITE_API_RESPONSE_FIELDS_INVALID");
responseMutation = (payload) => ({ ...payload, unexpected: true });
await assert.rejects(() => runUnifiedPrerequisitePreparation({ dataDir: isolatedDataDir, requestFile }), (error) => error.code === "UNIFIED_PREREQUISITE_API_RESPONSE_FIELDS_INVALID");
responseMutation = (payload) => ({ ...payload, designDnaSnapshotRef: { ...payload.designDnaSnapshotRef, unexpected: true } });
await assert.rejects(() => runUnifiedPrerequisitePreparation({ dataDir: isolatedDataDir, requestFile }), (error) => error.code === "UNIFIED_PREREQUISITE_API_DESIGN_DNA_REF_INVALID");
responseMutation = (payload) => ({ ...payload, designDnaSnapshotRef: { ...payload.designDnaSnapshotRef, id: "wrong_dna" } });
await assert.rejects(() => runUnifiedPrerequisitePreparation({ dataDir: isolatedDataDir, requestFile }), (error) => error.code === "UNIFIED_PREREQUISITE_API_DESIGN_DNA_REF_MISMATCH");
responseMutation = (payload) => ({ ...payload, designDnaSnapshotRef: { ...payload.designDnaSnapshotRef, hash: "not-a-hash" } });
await assert.rejects(() => runUnifiedPrerequisitePreparation({ dataDir: isolatedDataDir, requestFile }), (error) => error.code === "UNIFIED_PREREQUISITE_API_DESIGN_DNA_REF_INVALID");

const isolated = new DatabaseSync(isolatedDatabase, { readOnly: true });
const isolatedStore = JSON.parse(isolated.prepare("SELECT payload FROM app_state WHERE id=1").get().payload);
isolated.close();
const isolatedRecords = [...(isolatedStore.companies || []), ...(isolatedStore.accounts || []), ...(isolatedStore.socialAccounts || [])];
const storedCompany = isolatedRecords.find((item) => item.id === company.id);
const storedXhs = isolatedRecords.find((item) => item.id === xhs.id);
const storedWechat = isolatedRecords.find((item) => item.id === wechat.id);
assert.ok(storedCompany && storedXhs && storedWechat, "approval bindings must resolve from the normalized isolated Store");
assert.deepEqual(isolatedStore.contentOpportunities, [legacyOpportunity], "legacy ContentOpportunity must remain unchanged");
assert.equal(isolatedStore.unifiedContentOpportunities.length, 1);
assert.equal(isolatedStore.unifiedContentMechanismDecisions.length, 1);
const opportunity = isolatedStore.unifiedContentOpportunities[0];
validateUnifiedContentOpportunity(opportunity);
const decision = isolatedStore.unifiedContentMechanismDecisions[0];
assert.equal(opportunity.contract, "UnifiedContentOpportunity@1.0");
assert.equal(opportunity.accountRefs.xiaohongshu.id, xhs.id);
assert.equal(opportunity.accountRefs.wechat.id, wechat.id);
assert.equal(opportunity.activeStrategySnapshotRef.id, company.activeStrategySnapshotId);
assert.equal(decision.projectInputRef.id, first.projectInputRef.id);
assert.equal(Object.hasOwn(decision, "contentProjectRef"), false, "final ContentProject hash must not be part of prerequisite decision");
assert.equal(decision.selectedMechanism, "strategy_only");
assert.equal(decision.evaluated.find((item) => item.mechanism === "hotspot").status, "not_available");
assert.match(decision.evaluated.find((item) => item.mechanism === "hotspot").reason, /evaluated/);
assert.equal(decision.evaluated.find((item) => item.mechanism === "hotspot").factPolicy, "external_event_not_business_fact");
assert.deepEqual(isolatedStore.unifiedContentPrerequisiteRequests[0].designDnaSnapshotRef, designDnaSnapshotRef);
validateContentMechanismDecision(decision);

const canonicalRowMetadata = {
  id: company.activeStrategySnapshotId,
  accountId: company.id,
  version: 1,
  status: "active",
  sourceSessionId: null,
  createdAt: "2026-08-06T00:00:00.000Z",
  confirmedAt: "2026-08-06T00:00:00.000Z",
  sourceDraftRevisionId: null,
  documentHash: null,
  contextHash: null,
  activationReason: null,
  supersedesSnapshotId: null,
  metadataCreatedAt: null
};
const providerConfig = { text: { provider: "fixture", model: "fixture", protocol: "fixture" } };
const objectBinding = (value) => ({ id: value.id, objectHash: sha256(stableJson(value)) });
const approval = {
  contract: "UnifiedContentLiveApproval@1.0",
  sourceDatabasePath: isolatedDatabase,
  sourceDatabaseSha256: "a".repeat(64),
  destinationDataDir: resolve(tmpRoot, "future-live-copy"),
  destinationDatabaseSha256: "b".repeat(64),
  resolvedProvider: { provider: "fixture", model: "fixture", protocol: "fixture", configHash: sha256(stableJson(providerConfig)) },
  featureFlags: { unifiedContentProductionV1: true, xhsIntegratedPageDesignSkill: false },
  budget: { maxTextCalls: 9, maxCallsPerSkill: 1, automaticRetries: 0, hotspotCalls: 0, imageCalls: 0, platformPublicationCalls: 0 },
  targets: {
    company: objectBinding(storedCompany),
    accounts: { xiaohongshu: objectBinding(storedXhs), wechat: objectBinding(storedWechat) },
    activeStrategy: { id: storedCompany.activeStrategySnapshotId, rowMetadataHash: sha256(stableJson(canonicalRowMetadata)), payloadHash: hashUnifiedContent(strategyPayload) },
    contentOpportunity: objectBinding(opportunity),
    mechanismDecision: objectBinding(decision)
  },
  orchestrationInput: {
    project: {
      id: "future_content_project_fixture",
      companyId: storedCompany.id,
      contentOpportunityRef: { id: opportunity.id, hash: opportunity.opportunityHash },
      activeStrategySnapshotRef: opportunity.activeStrategySnapshotRef,
      designDnaSnapshotRef,
      accounts: { xiaohongshu: storedXhs.id, wechat: storedWechat.id },
      confirmations: { xiaohongshu: { outline_confirmation: "confirmed" }, wechat: { outline_confirmation: "confirmed" } }
    },
    mechanismDecision: decision,
    sourcePlan: { mode: "strategy_only", sources: [] },
    masterInput: { topic: opportunity.topic }
  }
};
const livePreflight = prepareUnifiedLivePreflight({ approval, store: isolatedStore, providerConfig, currentFlags: approval.featureFlags, sourceDatabasePath: isolatedDatabase });
assert.equal(livePreflight.textCallCount, 9);
assert.match(livePreflight.planHash, /^[a-f0-9]{64}$/);
const tamperedApproval = structuredClone(approval);
tamperedApproval.targets.contentOpportunity.objectHash = "0".repeat(64);
assert.throws(() => prepareUnifiedLivePreflight({ approval: tamperedApproval, store: isolatedStore, providerConfig, currentFlags: approval.featureFlags, sourceDatabasePath: isolatedDatabase }), (error) => error.code === "LIVE_SOURCE_OBJECT_HASH_MISMATCH");

const conflictRequest = { ...request, topic: "different semantic topic" };
const conflictFile = resolve(tmpRoot, "conflict.json");
writeFileSync(conflictFile, JSON.stringify(conflictRequest));
await assert.rejects(() => runUnifiedPrerequisitePreparation({ dataDir: isolatedDataDir, requestFile: conflictFile }), (error) => error.code === "UNIFIED_PREREQUISITE_IDEMPOTENCY_CONFLICT");
const duplicateSemanticFile = resolve(tmpRoot, "duplicate-semantic.json");
writeFileSync(duplicateSemanticFile, JSON.stringify({ ...request, idempotencyKey: "different_key_same_semantic" }));
await assert.rejects(() => runUnifiedPrerequisitePreparation({ dataDir: isolatedDataDir, requestFile: duplicateSemanticFile }), (error) => error.code === "UNIFIED_PREREQUISITE_SEMANTIC_DUPLICATE");
await assert.rejects(() => runUnifiedPrerequisitePreparation({ dataDir: resolve(tmpRoot, "../escape"), requestFile }), (error) => error.code === "UNIFIED_PREREQUISITE_ISOLATED_DATA_DIR_REQUIRED");

const forgedInputFile = resolve(tmpRoot, "forged-input.json");
writeFileSync(forgedInputFile, JSON.stringify({ ...request, activeStrategySnapshotRef: { id: "forged", hash: "f".repeat(64) } }));
await assert.rejects(() => runUnifiedPrerequisitePreparation({ dataDir: isolatedDataDir, requestFile: forgedInputFile }), (error) => error.code === "UNIFIED_PREREQUISITE_INPUT_FIELDS_INVALID");
const wrongOwnershipFile = resolve(tmpRoot, "wrong-ownership.json");
writeFileSync(wrongOwnershipFile, JSON.stringify({ ...request, wechatAccountId: xhs.id }));
await assert.rejects(() => runUnifiedPrerequisitePreparation({ dataDir: isolatedDataDir, requestFile: wrongOwnershipFile }), (error) => error.code === "UNIFIED_WECHAT_ACCOUNT_OWNERSHIP_MISMATCH");
const blankReasonFile = resolve(tmpRoot, "blank-reason.json");
writeFileSync(blankReasonFile, JSON.stringify({ ...request, hotspotEvaluation: { ...request.hotspotEvaluation, reason: "" } }));
await assert.rejects(() => runUnifiedPrerequisitePreparation({ dataDir: isolatedDataDir, requestFile: blankReasonFile }), (error) => error.code === "UNIFIED_PREREQUISITE_INPUT_INVALID");
globalThis.fetch = realFetch;
assert.equal(observedApiCalls.length, 12, "every valid-path runner attempt must cross the real local HTTP API");
assert.ok(observedApiCalls.every((call) => call.method === "POST" && /^http:\/\/127\.0\.0\.1:\d+\/api\/v1\/unified-content-prerequisites$/.test(call.url)));
assert.deepEqual(JSON.parse(observedApiCalls[0].body), request);
assert.equal(hashUnifiedContent(JSON.parse(JSON.stringify(opportunity, (key, value) => key === "opportunityHash" ? undefined : value))), opportunity.opportunityHash);
assert.deepEqual(readFileSync(sourceDatabase), sourceBefore, "activity source database must remain byte-identical");

rmSync(tmpRoot, { recursive: true, force: true });
console.log(JSON.stringify({
  status: "unified-content-prerequisites-self-test passed",
  created: first.created,
  replayCreated: second.created,
  localApiCalls: observedApiCalls.length,
  providerCalls: 0,
  hotspotCalls: 0,
  imageCalls: 0,
  platformCalls: 0,
  externalCalls: 0,
  activityDatabaseWrites: 0
}, null, 2));
