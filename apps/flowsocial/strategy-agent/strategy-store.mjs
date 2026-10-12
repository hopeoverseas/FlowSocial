import { createHash, randomUUID } from "node:crypto";
import { database } from "../storage.mjs";
import { buildFactSnapshotPayload, classifyFactImpact, factAffectsStrategy, inferFactPlatformScope, normalizeGovernedFact } from "./fact-governance.mjs";
import { assertSharedContract, validateFactSnapshotV1 } from "../contracts/strategy-content-contracts.mjs";
import { completeRecommendationValue, normalizeRecommendationOption } from "./recommendation-contract.mjs";
import { mapStrategySnapshotRow } from "./strategy-snapshot-domain.mjs";

database.exec(`
  CREATE TABLE IF NOT EXISTS diagnostic_sessions (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    mode TEXT NOT NULL,
    status TEXT NOT NULL,
    completeness INTEGER NOT NULL DEFAULT 0,
    critical_missing_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS diagnostic_turns (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES diagnostic_sessions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS profile_claims (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    field_path TEXT NOT NULL,
    value_json TEXT NOT NULL,
    claim_type TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_ref TEXT,
    confidence REAL NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(session_id, field_path, source_ref),
    FOREIGN KEY (session_id) REFERENCES diagnostic_sessions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS strategy_snapshots (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    status TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    source_session_id TEXT,
    created_at TEXT NOT NULL,
    confirmed_at TEXT,
    UNIQUE(account_id, version)
  );

  CREATE TABLE IF NOT EXISTS strategy_snapshot_meta (
    strategy_snapshot_id TEXT PRIMARY KEY,
    source_draft_revision_id TEXT,
    document_hash TEXT,
    context_hash TEXT,
    activation_reason TEXT NOT NULL DEFAULT 'user_confirmed',
    supersedes_snapshot_id TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (strategy_snapshot_id) REFERENCES strategy_snapshots(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS strategy_direction_sets (
    id TEXT PRIMARY KEY,
    strategy_snapshot_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    status TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(strategy_snapshot_id, version),
    FOREIGN KEY (strategy_snapshot_id) REFERENCES strategy_snapshots(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS diagnostic_questions (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    content TEXT NOT NULL,
    goal TEXT NOT NULL DEFAULT '',
    target_fields_json TEXT NOT NULL DEFAULT '[]',
    expected_answer_type TEXT NOT NULL DEFAULT 'free_text',
    question_mode TEXT NOT NULL DEFAULT 'initial',
    attempt INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    answered_at TEXT,
    FOREIGN KEY (session_id) REFERENCES diagnostic_sessions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS profile_fact_events (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    session_id TEXT,
    turn_id TEXT,
    fact_key TEXT NOT NULL,
    fact_type TEXT NOT NULL,
    subject TEXT NOT NULL DEFAULT 'company',
    predicate TEXT NOT NULL,
    value_json TEXT NOT NULL,
    operation TEXT NOT NULL,
    status TEXT NOT NULL,
    confidence REAL NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'unknown',
    content_usage TEXT NOT NULL DEFAULT 'needs_review',
    source_type TEXT NOT NULL DEFAULT 'user_statement',
    supersedes_fact_id TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS profile_current_facts (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    fact_key TEXT NOT NULL,
    fact_type TEXT NOT NULL,
    subject TEXT NOT NULL DEFAULT 'company',
    predicate TEXT NOT NULL,
    value_json TEXT NOT NULL,
    status TEXT NOT NULL,
    confidence REAL NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'unknown',
    content_usage TEXT NOT NULL DEFAULT 'needs_review',
    source_event_ids_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(account_id, fact_key)
  );

  CREATE TABLE IF NOT EXISTS diagnostic_field_states (
    session_id TEXT NOT NULL,
    field_path TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'unasked',
    resolution_type TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_question_id TEXT,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL,
    PRIMARY KEY (session_id, field_path),
    FOREIGN KEY (session_id) REFERENCES diagnostic_sessions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS agent_recommendations (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    target_field_path TEXT NOT NULL,
    recommendation_type TEXT NOT NULL DEFAULT 'strategy_field',
    recommended_value_json TEXT NOT NULL,
    rationale_json TEXT NOT NULL DEFAULT '[]',
    alternatives_json TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'pending_confirmation',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    confirmed_at TEXT,
    FOREIGN KEY (session_id) REFERENCES diagnostic_sessions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS strategy_draft_cache (
    session_id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    validation_json TEXT NOT NULL DEFAULT '{}',
    provider_mode TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES diagnostic_sessions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS agent_recommendation_decisions (
    recommendation_id TEXT PRIMARY KEY,
    selected_option_id TEXT,
    accept_mode TEXT,
    accepted_value_json TEXT,
    validation_json TEXT NOT NULL DEFAULT '{}',
    decided_at TEXT NOT NULL,
    FOREIGN KEY (recommendation_id) REFERENCES agent_recommendations(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS agent_recommendation_revisions (
    id TEXT PRIMARY KEY,
    recommendation_id TEXT NOT NULL,
    revision INTEGER NOT NULL,
    base_option_id TEXT,
    user_instruction TEXT,
    value_json TEXT NOT NULL,
    display_json TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'revision_ready',
    created_at TEXT NOT NULL,
    UNIQUE(recommendation_id, revision),
    FOREIGN KEY (recommendation_id) REFERENCES agent_recommendations(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS diagnostic_session_meta (
    session_id TEXT PRIMARY KEY,
    conversation_phase TEXT NOT NULL DEFAULT 'core_diagnosis',
    completion_announced_at TEXT,
    claim_revision INTEGER NOT NULL DEFAULT 0,
    fact_revision INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES diagnostic_sessions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS diagnostic_session_context (
    session_id TEXT PRIMARY KEY,
    restart_mode TEXT NOT NULL DEFAULT 'fresh',
    inherited_from_session_id TEXT,
    rediagnose_fields_json TEXT NOT NULL DEFAULT '[]',
    memory_policy TEXT NOT NULL DEFAULT 'session_only',
    enrichment_status TEXT NOT NULL DEFAULT 'not_started',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES diagnostic_sessions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS diagnostic_enrichment_questions (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT NOT NULL,
    target_fact_key TEXT NOT NULL,
    expected_answer_type TEXT NOT NULL DEFAULT 'free_text',
    relevance_json TEXT NOT NULL DEFAULT '{}',
    attempt INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    answered_at TEXT,
    FOREIGN KEY (session_id) REFERENCES diagnostic_sessions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS diagnostic_coverage_states (
    session_id TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    category TEXT,
    captured_slots_json TEXT NOT NULL DEFAULT '[]',
    missing_required_slots_json TEXT NOT NULL DEFAULT '[]',
    missing_optional_slots_json TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'partial',
    strategy_ready INTEGER NOT NULL DEFAULT 0,
    content_ready INTEGER NOT NULL DEFAULT 0,
    attempts INTEGER NOT NULL DEFAULT 0,
    assessment_json TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL,
    PRIMARY KEY (session_id, target_type, target_id),
    FOREIGN KEY (session_id) REFERENCES diagnostic_sessions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS strategy_draft_revisions (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    revision INTEGER NOT NULL,
    payload_json TEXT NOT NULL,
    validation_json TEXT NOT NULL DEFAULT '{}',
    provider_mode TEXT,
    source_claim_revision INTEGER NOT NULL DEFAULT 0,
    source_fact_revision INTEGER NOT NULL DEFAULT 0,
    stale INTEGER NOT NULL DEFAULT 0,
    stale_reasons_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    UNIQUE(session_id, revision),
    FOREIGN KEY (session_id) REFERENCES diagnostic_sessions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS strategy_draft_requests (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    status TEXT NOT NULL,
    draft_revision_id TEXT,
    error_code TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT,
    FOREIGN KEY (session_id) REFERENCES diagnostic_sessions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS fact_snapshots (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    revision INTEGER NOT NULL,
    content_hash TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(account_id, revision),
    UNIQUE(account_id, content_hash)
  );

  CREATE INDEX IF NOT EXISTS idx_diagnostic_turns_session ON diagnostic_turns(session_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_profile_claims_session ON profile_claims(session_id, field_path);
  CREATE INDEX IF NOT EXISTS idx_strategy_snapshots_account ON strategy_snapshots(account_id, version DESC);
  CREATE INDEX IF NOT EXISTS idx_strategy_snapshot_meta_draft ON strategy_snapshot_meta(source_draft_revision_id);
  CREATE INDEX IF NOT EXISTS idx_diagnostic_questions_session ON diagnostic_questions(session_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_profile_fact_events_account ON profile_fact_events(account_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_profile_current_facts_account ON profile_current_facts(account_id, fact_type);
  CREATE INDEX IF NOT EXISTS idx_field_states_session ON diagnostic_field_states(session_id, state);
  CREATE INDEX IF NOT EXISTS idx_recommendations_session ON agent_recommendations(session_id, status, created_at);
  CREATE INDEX IF NOT EXISTS idx_draft_revisions_session ON strategy_draft_revisions(session_id, revision DESC);
  CREATE INDEX IF NOT EXISTS idx_draft_requests_session ON strategy_draft_requests(session_id, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_enrichment_questions_session ON diagnostic_enrichment_questions(session_id, status, created_at);
  CREATE INDEX IF NOT EXISTS idx_coverage_states_session ON diagnostic_coverage_states(session_id, target_type, status);
  CREATE INDEX IF NOT EXISTS idx_fact_snapshots_account ON fact_snapshots(account_id, revision DESC);

  INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES ('batch1_fact_memory_v1', datetime('now'));
  INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES ('consultative_agent_v1', datetime('now'));
`);

// Additive migrations for workspaces created before slot-level question tracking.
const questionColumns = new Set(database.prepare("PRAGMA table_info(diagnostic_questions)").all().map((column) => column.name));
if (!questionColumns.has("target_slots_json")) database.exec("ALTER TABLE diagnostic_questions ADD COLUMN target_slots_json TEXT NOT NULL DEFAULT '[]'");
if (!questionColumns.has("relevance_json")) database.exec("ALTER TABLE diagnostic_questions ADD COLUMN relevance_json TEXT NOT NULL DEFAULT '{}'");
const enrichmentQuestionColumns = new Set(database.prepare("PRAGMA table_info(diagnostic_enrichment_questions)").all().map((item) => item.name));
if (!enrichmentQuestionColumns.has("relevance_json")) database.exec("ALTER TABLE diagnostic_enrichment_questions ADD COLUMN relevance_json TEXT NOT NULL DEFAULT '{}'");
const coverageColumns = new Set(database.prepare("PRAGMA table_info(diagnostic_coverage_states)").all().map((column) => column.name));
if (!coverageColumns.has("skipped_slots_json")) database.exec("ALTER TABLE diagnostic_coverage_states ADD COLUMN skipped_slots_json TEXT NOT NULL DEFAULT '[]'");

const now = () => new Date().toISOString();
const id = (prefix) => `${prefix}_${randomUUID().slice(0, 12)}`;
const parse = (value, fallback) => {
  try { return JSON.parse(value); } catch { return fallback; }
};

const insertSession = database.prepare(`
  INSERT INTO diagnostic_sessions
  (id, account_id, mode, status, completeness, critical_missing_json, created_at, updated_at)
  VALUES (?, ?, ?, 'collecting', 0, '[]', ?, ?)
`);
const selectSession = database.prepare("SELECT * FROM diagnostic_sessions WHERE id = ?");
const insertTurn = database.prepare(`
  INSERT INTO diagnostic_turns (id, session_id, role, content, metadata_json, created_at)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const selectTurns = database.prepare("SELECT * FROM diagnostic_turns WHERE session_id = ? ORDER BY created_at, rowid");
const updateTurnContentStatement = database.prepare("UPDATE diagnostic_turns SET content = ?, metadata_json = ? WHERE id = ?");
const upsertClaimStatement = database.prepare(`
  INSERT INTO profile_claims
  (id, session_id, field_path, value_json, claim_type, source_type, source_ref, confidence, status, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(session_id, field_path, source_ref) DO UPDATE SET
    value_json = excluded.value_json,
    claim_type = excluded.claim_type,
    source_type = excluded.source_type,
    confidence = excluded.confidence,
    status = excluded.status,
    updated_at = excluded.updated_at
`);
const selectClaims = database.prepare("SELECT * FROM profile_claims WHERE session_id = ? ORDER BY created_at, rowid");
const selectLatestOpenSession = database.prepare("SELECT * FROM diagnostic_sessions WHERE account_id = ? ORDER BY updated_at DESC LIMIT 1");
const insertQuestion = database.prepare(`
  INSERT INTO diagnostic_questions
  (id, session_id, content, goal, target_fields_json, target_slots_json, relevance_json, expected_answer_type, question_mode, attempt, status, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
`);
const selectPendingQuestion = database.prepare("SELECT * FROM diagnostic_questions WHERE session_id = ? AND status IN ('pending','assisting','recommendation_pending') ORDER BY created_at DESC, rowid DESC LIMIT 1");
const selectQuestions = database.prepare("SELECT * FROM diagnostic_questions WHERE session_id = ? ORDER BY created_at, rowid");
const answerQuestion = database.prepare("UPDATE diagnostic_questions SET status = 'answered', answered_at = ? WHERE id = ?");
const updateQuestionStatus = database.prepare("UPDATE diagnostic_questions SET status = ?, answered_at = ? WHERE id = ?");
const insertFactEvent = database.prepare(`
  INSERT INTO profile_fact_events
  (id, account_id, session_id, turn_id, fact_key, fact_type, subject, predicate, value_json, operation, status, confidence, visibility, content_usage, source_type, supersedes_fact_id, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const selectFactEvents = database.prepare("SELECT * FROM profile_fact_events WHERE account_id = ? ORDER BY created_at, rowid");
const selectCurrentFacts = database.prepare("SELECT * FROM profile_current_facts WHERE account_id = ? ORDER BY updated_at, rowid");
const selectCurrentFact = database.prepare("SELECT * FROM profile_current_facts WHERE account_id = ? AND fact_key = ?");
const upsertCurrentFact = database.prepare(`
  INSERT INTO profile_current_facts
  (id, account_id, fact_key, fact_type, subject, predicate, value_json, status, confidence, visibility, content_usage, source_event_ids_json, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(account_id, fact_key) DO UPDATE SET
    fact_type = excluded.fact_type,
    subject = excluded.subject,
    predicate = excluded.predicate,
    value_json = excluded.value_json,
    status = excluded.status,
    confidence = excluded.confidence,
    visibility = excluded.visibility,
    content_usage = excluded.content_usage,
    source_event_ids_json = excluded.source_event_ids_json,
    updated_at = excluded.updated_at
`);
const upsertFieldStateStatement = database.prepare(`
  INSERT INTO diagnostic_field_states
  (session_id, field_path, state, resolution_type, attempts, last_question_id, metadata_json, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(session_id, field_path) DO UPDATE SET
    state = excluded.state,
    resolution_type = excluded.resolution_type,
    attempts = excluded.attempts,
    last_question_id = excluded.last_question_id,
    metadata_json = excluded.metadata_json,
    updated_at = excluded.updated_at
`);
const selectFieldStates = database.prepare("SELECT * FROM diagnostic_field_states WHERE session_id = ? ORDER BY field_path");
const selectFieldState = database.prepare("SELECT * FROM diagnostic_field_states WHERE session_id = ? AND field_path = ?");
const insertRecommendation = database.prepare(`
  INSERT INTO agent_recommendations
  (id, session_id, account_id, target_field_path, recommendation_type, recommended_value_json, rationale_json, alternatives_json, status, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const selectRecommendation = database.prepare("SELECT * FROM agent_recommendations WHERE id = ?");
const selectRecommendations = database.prepare("SELECT * FROM agent_recommendations WHERE session_id = ? ORDER BY created_at, rowid");
const selectPendingRecommendation = database.prepare("SELECT * FROM agent_recommendations WHERE session_id = ? AND status IN ('pending_confirmation','refining','revision_ready') ORDER BY created_at DESC, rowid DESC LIMIT 1");
const updateRecommendationStatus = database.prepare("UPDATE agent_recommendations SET status = ?, updated_at = ?, confirmed_at = ? WHERE id = ?");
const upsertRecommendationDecision = database.prepare(`INSERT INTO agent_recommendation_decisions (recommendation_id, selected_option_id, accept_mode, accepted_value_json, validation_json, decided_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(recommendation_id) DO UPDATE SET selected_option_id = excluded.selected_option_id, accept_mode = excluded.accept_mode, accepted_value_json = excluded.accepted_value_json, validation_json = excluded.validation_json, decided_at = excluded.decided_at`);
const selectRecommendationDecision = database.prepare("SELECT * FROM agent_recommendation_decisions WHERE recommendation_id = ?");
const nextRecommendationRevision = database.prepare("SELECT COALESCE(MAX(revision),0)+1 AS revision FROM agent_recommendation_revisions WHERE recommendation_id=?");
const insertRecommendationRevision = database.prepare("INSERT INTO agent_recommendation_revisions (id,recommendation_id,revision,base_option_id,user_instruction,value_json,display_json,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)");
const selectLatestRecommendationRevision = database.prepare("SELECT * FROM agent_recommendation_revisions WHERE recommendation_id=? ORDER BY revision DESC LIMIT 1");
const upsertDraftCache = database.prepare(`
  INSERT INTO strategy_draft_cache (session_id, account_id, payload_json, validation_json, provider_mode, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(session_id) DO UPDATE SET
    payload_json = excluded.payload_json,
    validation_json = excluded.validation_json,
    provider_mode = excluded.provider_mode,
    updated_at = excluded.updated_at
`);
const selectDraftCache = database.prepare("SELECT * FROM strategy_draft_cache WHERE session_id = ?");
const upsertSessionMeta = database.prepare(`INSERT INTO diagnostic_session_meta (session_id, conversation_phase, completion_announced_at, claim_revision, fact_revision, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(session_id) DO UPDATE SET conversation_phase = excluded.conversation_phase, completion_announced_at = COALESCE(excluded.completion_announced_at, diagnostic_session_meta.completion_announced_at), claim_revision = excluded.claim_revision, fact_revision = excluded.fact_revision, updated_at = excluded.updated_at`);
const replaceSessionMetaState = database.prepare("UPDATE diagnostic_session_meta SET conversation_phase = ?, completion_announced_at = ?, updated_at = ? WHERE session_id = ?");
const selectSessionMeta = database.prepare("SELECT * FROM diagnostic_session_meta WHERE session_id = ?");
const upsertSessionContext = database.prepare(`INSERT INTO diagnostic_session_context (session_id, restart_mode, inherited_from_session_id, rediagnose_fields_json, memory_policy, enrichment_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(session_id) DO UPDATE SET restart_mode=excluded.restart_mode, inherited_from_session_id=excluded.inherited_from_session_id, rediagnose_fields_json=excluded.rediagnose_fields_json, memory_policy=excluded.memory_policy, enrichment_status=excluded.enrichment_status, updated_at=excluded.updated_at`);
const selectSessionContext = database.prepare("SELECT * FROM diagnostic_session_context WHERE session_id = ?");
const insertEnrichmentQuestion = database.prepare(`INSERT INTO diagnostic_enrichment_questions (id, session_id, content, category, target_fact_key, expected_answer_type, relevance_json, attempt, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`);
const selectPendingEnrichmentQuestion = database.prepare("SELECT * FROM diagnostic_enrichment_questions WHERE session_id = ? AND status IN ('pending','assisting','recommendation_pending') ORDER BY created_at DESC, rowid DESC LIMIT 1");
const selectEnrichmentQuestions = database.prepare("SELECT * FROM diagnostic_enrichment_questions WHERE session_id = ? ORDER BY created_at, rowid");
const updateEnrichmentQuestionStatus = database.prepare("UPDATE diagnostic_enrichment_questions SET status = ?, answered_at = ? WHERE id = ?");
const upsertCoverageStateStatement = database.prepare(`INSERT INTO diagnostic_coverage_states
  (session_id,target_type,target_id,category,captured_slots_json,skipped_slots_json,missing_required_slots_json,missing_optional_slots_json,status,strategy_ready,content_ready,attempts,assessment_json,updated_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(session_id,target_type,target_id) DO UPDATE SET category=excluded.category,captured_slots_json=excluded.captured_slots_json,skipped_slots_json=excluded.skipped_slots_json,missing_required_slots_json=excluded.missing_required_slots_json,missing_optional_slots_json=excluded.missing_optional_slots_json,status=excluded.status,strategy_ready=excluded.strategy_ready,content_ready=excluded.content_ready,attempts=excluded.attempts,assessment_json=excluded.assessment_json,updated_at=excluded.updated_at`);
const selectCoverageState = database.prepare("SELECT * FROM diagnostic_coverage_states WHERE session_id=? AND target_type=? AND target_id=?");
const selectCoverageStates = database.prepare("SELECT * FROM diagnostic_coverage_states WHERE session_id=? ORDER BY target_type,target_id");
const incrementClaimRevision = database.prepare("UPDATE diagnostic_session_meta SET claim_revision = claim_revision + 1, updated_at = ? WHERE session_id = ?");
const incrementFactRevision = database.prepare("UPDATE diagnostic_session_meta SET fact_revision = fact_revision + 1, updated_at = ? WHERE session_id = ?");
const markDraftsStale = database.prepare("UPDATE strategy_draft_revisions SET stale = 1, stale_reasons_json = ? WHERE session_id = ? AND stale = 0");
const nextDraftRevision = database.prepare("SELECT COALESCE(MAX(revision), 0) + 1 AS revision FROM strategy_draft_revisions WHERE session_id = ?");
const insertDraftRevision = database.prepare(`INSERT INTO strategy_draft_revisions (id, session_id, account_id, revision, payload_json, validation_json, provider_mode, source_claim_revision, source_fact_revision, stale, stale_reasons_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '[]', ?)`);
const selectLatestDraftRevision = database.prepare("SELECT * FROM strategy_draft_revisions WHERE session_id = ? ORDER BY revision DESC LIMIT 1");
const selectDraftRevision = database.prepare("SELECT * FROM strategy_draft_revisions WHERE id = ?");
const insertDraftRequest = database.prepare("INSERT INTO strategy_draft_requests (id,session_id,account_id,status,created_at,updated_at) VALUES (?,?,?,?,?,?)");
const selectDraftRequest = database.prepare("SELECT * FROM strategy_draft_requests WHERE id = ? AND session_id = ?");
const selectLatestDraftRequest = database.prepare("SELECT * FROM strategy_draft_requests WHERE session_id = ? ORDER BY updated_at DESC, rowid DESC LIMIT 1");
const updateDraftRequest = database.prepare("UPDATE strategy_draft_requests SET status = ?, draft_revision_id = ?, error_code = ?, error_message = ?, updated_at = ?, completed_at = ? WHERE id = ? AND session_id = ?");
const updateSessionProgress = database.prepare(`
  UPDATE diagnostic_sessions
  SET status = ?, completeness = ?, critical_missing_json = ?, updated_at = ?, completed_at = ?
  WHERE id = ?
`);
const nextSnapshotVersion = database.prepare("SELECT COALESCE(MAX(version), 0) + 1 AS version FROM strategy_snapshots WHERE account_id = ?");
const insertSnapshot = database.prepare(`
  INSERT INTO strategy_snapshots
  (id, account_id, version, status, payload_json, source_session_id, created_at, confirmed_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
const selectSnapshot = database.prepare("SELECT * FROM strategy_snapshots WHERE id = ?");
const selectActiveSnapshot = database.prepare("SELECT * FROM strategy_snapshots WHERE account_id = ? AND status = 'active' ORDER BY version DESC LIMIT 1");
const selectSnapshotsByAccount = database.prepare("SELECT * FROM strategy_snapshots WHERE account_id = ? ORDER BY version DESC");
const deactivateSnapshots = database.prepare("UPDATE strategy_snapshots SET status = 'superseded' WHERE account_id = ? AND status = 'active'");
const activateSnapshot = database.prepare("UPDATE strategy_snapshots SET status = 'active', confirmed_at = ? WHERE id = ?");
const insertSnapshotMeta = database.prepare(`
  INSERT INTO strategy_snapshot_meta
  (strategy_snapshot_id, source_draft_revision_id, document_hash, context_hash, activation_reason, supersedes_snapshot_id, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const selectSnapshotMeta = database.prepare("SELECT * FROM strategy_snapshot_meta WHERE strategy_snapshot_id = ?");
const nextDirectionVersion = database.prepare("SELECT COALESCE(MAX(version), 0) + 1 AS version FROM strategy_direction_sets WHERE strategy_snapshot_id = ?");
const insertDirectionSet = database.prepare(`
  INSERT INTO strategy_direction_sets
  (id, strategy_snapshot_id, version, status, payload_json, created_at)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const selectLatestDirectionSet = database.prepare("SELECT * FROM strategy_direction_sets WHERE strategy_snapshot_id = ? ORDER BY version DESC LIMIT 1");
const nextFactSnapshotRevision = database.prepare("SELECT COALESCE(MAX(revision), 0) + 1 AS revision FROM fact_snapshots WHERE account_id = ?");
const insertFactSnapshot = database.prepare("INSERT INTO fact_snapshots (id, account_id, revision, content_hash, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?)");
const selectFactSnapshot = database.prepare("SELECT * FROM fact_snapshots WHERE id = ?");
const selectLatestFactSnapshot = database.prepare("SELECT * FROM fact_snapshots WHERE account_id = ? ORDER BY revision DESC LIMIT 1");
const selectFactSnapshotByHash = database.prepare("SELECT * FROM fact_snapshots WHERE account_id = ? AND content_hash = ?");

function mapSession(row) {
  if (!row) return null;
  return {
    id: row.id,
    accountId: row.account_id,
    mode: row.mode,
    status: row.status,
    completeness: row.completeness,
    criticalMissingFields: parse(row.critical_missing_json, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at
  };
}

function mapClaim(row) {
  return {
    id: row.id,
    sessionId: row.session_id,
    fieldPath: row.field_path,
    value: parse(row.value_json, null),
    type: row.claim_type,
    sourceType: row.source_type,
    sourceRef: row.source_ref,
    confidence: row.confidence,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapQuestion(row) {
  if (!row) return null;
  const targetFieldPaths = parse(row.target_fields_json, []);
  const targetSlotIds = parse(row.target_slots_json, []);
  return {
    id: row.id,
    sessionId: row.session_id,
    content: row.content,
    goal: row.goal,
    targetFieldPaths,
    targetSlotIds,
    fingerprint: `${[...targetFieldPaths].sort().join(",") || "none"}:${[...targetSlotIds].sort().join(",") || "field"}`,
    relevance: parse(row.relevance_json, {}),
    expectedAnswerType: row.expected_answer_type,
    questionMode: row.question_mode,
    attempt: row.attempt,
    status: row.status,
    createdAt: row.created_at,
    answeredAt: row.answered_at
  };
}

function mapFact(row) {
  if (!row) return null;
  const base = {
    id: row.id,
    accountId: row.account_id,
    sessionId: row.session_id,
    turnId: row.turn_id,
    factKey: row.fact_key,
    factType: row.fact_type,
    subject: row.subject,
    predicate: row.predicate,
    value: parse(row.value_json, null),
    operation: row.operation,
    status: row.status,
    confidence: row.confidence,
    visibility: row.visibility,
    contentUsage: row.content_usage,
    sourceType: row.source_type,
    supersedesFactId: row.supersedes_fact_id,
    sourceEventIds: parse(row.source_event_ids_json, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
  return {
    ...base,
    strategyImpact: classifyFactImpact(base),
    platformScope: inferFactPlatformScope(base),
    sensitivity: base.visibility === "private" ? "restricted" : "internal"
  };
}

function mapFactSnapshot(row) {
  if (!row) return null;
  const storedPayload=parse(row.payload_json, {});
  const compatiblePayload={...storedPayload};
  for(const key of ["usableFacts","contextOnlyFacts","forbiddenFacts","missingFacts"]){
    compatiblePayload[key]=(storedPayload[key]||[]).map((fact)=>normalizeGovernedFact({...fact,factKey:fact.key||fact.factKey}));
  }
  return {
    id: row.id,
    accountId: row.account_id,
    revision: row.revision,
    contentHash: row.content_hash,
    ...compatiblePayload,
    createdAt: row.created_at
  };
}

function mapFieldState(row) {
  if (!row) return null;
  return {
    sessionId: row.session_id,
    fieldPath: row.field_path,
    state: row.state,
    resolutionType: row.resolution_type,
    attempts: row.attempts,
    lastQuestionId: row.last_question_id,
    metadata: parse(row.metadata_json, {}),
    updatedAt: row.updated_at
  };
}

function mapRecommendation(row) {
  if (!row) return null;
  const recommendedValue = parse(row.recommended_value_json, null);
  const alternatives = parse(row.alternatives_json, []);
  const completeForField = (value) => {
    const completed=completeRecommendationValue(row.target_field_path,value);
    if (completed !== value) return completed;
    if (value && typeof value === "object") return value;
    const text = String(value || "").trim();
    if (row.target_field_path === "business.conversionPath") return { summary: text, steps: text.split(/\s*(?:→|->|到)\s*/).filter(Boolean), assumptions: ["具体承接角色与工具仍应按实际情况确认"] };
    if (row.target_field_path === "accountStrategy.contentResources") return { summary: text, resourceTypes: [], publicUsage: "unknown" };
    if (row.target_field_path === "audiences.primary") return { summary: text, industries: [], companyStages: [], decisionMakers: [] };
    if (row.target_field_path === "accountStrategy.platformRoles") return { summary: text };
    return value;
  };
  const normalizeOption = (value, index, recommended = false) => {
    const normalized=normalizeRecommendationOption(value,{ recommendationId:row.id,index,recommended,rationale:parse(row.rationale_json,[]) });
    return { ...normalized,completeValue:completeForField(normalized.completeValue) };
  };
  const decisionRow = selectRecommendationDecision.get(row.id);
  const revisionRow = selectLatestRecommendationRevision.get(row.id);
  const latestRevision=revisionRow ? { id:revisionRow.id,revision:revisionRow.revision,baseOptionId:revisionRow.base_option_id,userInstruction:revisionRow.user_instruction,value:parse(revisionRow.value_json,null),display:parse(revisionRow.display_json,{}),status:revisionRow.status,createdAt:revisionRow.created_at } : null;
  const baseOptions=[normalizeOption(recommendedValue, 0, true), ...alternatives.map((item, index) => normalizeOption(item, index + 1, false))];
  const options=row.status === "revision_ready" && latestRevision ? [{ optionId:`${row.id}_revision_${latestRevision.revision}`,label:`调整方案 v${latestRevision.revision}`,summary:latestRevision.display?.summary,display:latestRevision.display,completeValue:completeForField(latestRevision.value),rationale:[],assumptions:[],completeness:"reviewed" }] : baseOptions;
  return {
    id: row.id,
    sessionId: row.session_id,
    accountId: row.account_id,
    targetFieldPath: row.target_field_path,
    recommendationType: row.recommendation_type,
    recommendedValue,
    rationale: parse(row.rationale_json, []),
    alternatives,
    options,
    latestRevision,
    decision: decisionRow ? { selectedOptionId: decisionRow.selected_option_id, acceptMode: decisionRow.accept_mode, acceptedValue: parse(decisionRow.accepted_value_json, null), validation: parse(decisionRow.validation_json, {}), decidedAt: decisionRow.decided_at } : null,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    confirmedAt: row.confirmed_at
  };
}

function mapSnapshot(row) {
  return mapStrategySnapshotRow(row, row ? selectSnapshotMeta.get(row.id) : null);
}

export function createDiagnosticSession({ accountId, mode = "quick", restartMode = "fresh", inheritedFromSessionId = null, rediagnoseFields = [] }) {
  if (!accountId) throw new Error("accountId is required");
  if (!["quick", "deep", "import"].includes(mode)) throw new Error("mode must be quick, deep, or import");
  const sessionId = id("diag");
  const createdAt = now();
  insertSession.run(sessionId, accountId, mode, createdAt, createdAt);
  upsertSessionMeta.run(sessionId, "core_diagnosis", null, 0, 0, createdAt);
  const memoryPolicy = ({ fresh: "session_only", retain_facts: "facts_carried_forward", retain_core: "core_carried_forward", retain_all: "core_and_facts_carried_forward" })[restartMode] || "session_only";
  upsertSessionContext.run(sessionId, restartMode, inheritedFromSessionId, JSON.stringify(rediagnoseFields || []), memoryPolicy, "not_started", createdAt, createdAt);
  return getDiagnosticSession(sessionId);
}

export function getDiagnosticSessionContext(sessionId) {
  const row = selectSessionContext.get(sessionId);
  if (!row) return { sessionId, restartMode: "fresh", inheritedFromSessionId: null, rediagnoseFields: [], memoryPolicy: "session_only", enrichmentStatus: "not_started" };
  return { sessionId: row.session_id, restartMode: row.restart_mode, inheritedFromSessionId: row.inherited_from_session_id, rediagnoseFields: parse(row.rediagnose_fields_json, []), memoryPolicy: row.memory_policy, enrichmentStatus: row.enrichment_status, createdAt: row.created_at, updatedAt: row.updated_at };
}

export function updateDiagnosticSessionContext(sessionId, patch = {}) {
  const current = getDiagnosticSessionContext(sessionId);
  const timestamp = now();
  upsertSessionContext.run(sessionId, patch.restartMode ?? current.restartMode, patch.inheritedFromSessionId ?? current.inheritedFromSessionId, JSON.stringify(patch.rediagnoseFields ?? current.rediagnoseFields), patch.memoryPolicy ?? current.memoryPolicy, patch.enrichmentStatus ?? current.enrichmentStatus, current.createdAt || timestamp, timestamp);
  return getDiagnosticSessionContext(sessionId);
}

function mapEnrichmentQuestion(row) {
  if (!row) return null;
  return { id: row.id, sessionId: row.session_id, content: row.content, category: row.category, factCategory: row.category, targetFactKey: row.target_fact_key, targetFieldPaths: [], expectedAnswerType: row.expected_answer_type, relevance: parse(row.relevance_json, {}), attempt: row.attempt, status: row.status, questionKind: "enrichment", createdAt: row.created_at, answeredAt: row.answered_at };
}

export function createEnrichmentQuestion({ sessionId, content, category, targetFactKey, expectedAnswerType = "free_text", relevance = {}, attempt = 1 }) {
  const questionId = id("enrichq");
  insertEnrichmentQuestion.run(questionId, sessionId, content, category, targetFactKey, expectedAnswerType, JSON.stringify(relevance || {}), attempt, now());
  return getPendingEnrichmentQuestion(sessionId);
}

export function getPendingEnrichmentQuestion(sessionId) { return mapEnrichmentQuestion(selectPendingEnrichmentQuestion.get(sessionId)); }
export function listEnrichmentQuestions(sessionId) { return selectEnrichmentQuestions.all(sessionId).map(mapEnrichmentQuestion); }
export function setEnrichmentQuestionStatus(questionId, status) { updateEnrichmentQuestionStatus.run(status, ["answered","skipped"].includes(status) ? now() : null, questionId); return true; }

function mapCoverageState(row) {
  if (!row) return null;
  return { sessionId:row.session_id,targetType:row.target_type,targetId:row.target_id,category:row.category,capturedSlots:parse(row.captured_slots_json,[]),skippedSlots:parse(row.skipped_slots_json,[]),missingRequiredSlots:parse(row.missing_required_slots_json,[]),missingOptionalSlots:parse(row.missing_optional_slots_json,[]),status:row.status,strategyReady:Boolean(row.strategy_ready),contentReady:Boolean(row.content_ready),attempts:row.attempts,assessment:parse(row.assessment_json,{}),updatedAt:row.updated_at };
}

export function upsertDiagnosticCoverageState({ sessionId,targetType,targetId,category=null,capturedSlots=[],skippedSlots=[],missingRequiredSlots=[],missingOptionalSlots=[],status="partial",strategyReady=false,contentReady=false,attempts=0,assessment={} }) {
  if (!getDiagnosticSession(sessionId) || !targetType || !targetId) throw new Error("Valid coverage target is required");
  upsertCoverageStateStatement.run(sessionId,targetType,targetId,category,JSON.stringify(capturedSlots),JSON.stringify(skippedSlots),JSON.stringify(missingRequiredSlots),JSON.stringify(missingOptionalSlots),status,strategyReady?1:0,contentReady?1:0,Math.max(0,Number(attempts)||0),JSON.stringify(assessment||{}),now());
  return getDiagnosticCoverageState(sessionId,targetType,targetId);
}
export function getDiagnosticCoverageState(sessionId,targetType,targetId) { return mapCoverageState(selectCoverageState.get(sessionId,targetType,targetId)); }
export function listDiagnosticCoverageStates(sessionId) { return selectCoverageStates.all(sessionId).map(mapCoverageState); }

export function getDiagnosticSession(sessionId) {
  return mapSession(selectSession.get(sessionId));
}

export function getLatestOpenDiagnosticSession(accountId) {
  return mapSession(selectLatestOpenSession.get(accountId));
}

export function appendDiagnosticTurn({ sessionId, role, content, metadata = {} }) {
  if (!getDiagnosticSession(sessionId)) throw new Error("Diagnostic session not found");
  if (!["user", "assistant", "system"].includes(role)) throw new Error("Unsupported diagnostic role");
  const turn = { id: id("turn"), sessionId, role, content: String(content || "").trim(), metadata, createdAt: now() };
  if (!turn.content) throw new Error("Diagnostic turn content is required");
  insertTurn.run(turn.id, sessionId, role, turn.content, JSON.stringify(metadata), turn.createdAt);
  return turn;
}

export function listDiagnosticTurns(sessionId) {
  return selectTurns.all(sessionId).map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    role: row.role,
    content: row.content,
    metadata: parse(row.metadata_json, {}),
    createdAt: row.created_at
  }));
}

export function updateDiagnosticTurn({ turnId, content, metadata = {} }) {
  if (!turnId || !String(content || "").trim()) throw new Error("turnId and content are required");
  updateTurnContentStatement.run(String(content).trim(), JSON.stringify(metadata || {}), turnId);
  return database.prepare("SELECT * FROM diagnostic_turns WHERE id = ?").get(turnId);
}

export function upsertProfileClaim({ sessionId, fieldPath, value, type = "fact", sourceType = "user_statement", sourceRef = null, confidence = 0.8, status = "inferred" }) {
  if (!getDiagnosticSession(sessionId)) throw new Error("Diagnostic session not found");
  if (!fieldPath) throw new Error("fieldPath is required");
  const timestamp = now();
  const claimId = id("claim");
  upsertClaimStatement.run(claimId, sessionId, fieldPath, JSON.stringify(value), type, sourceType, sourceRef, Math.min(1, Math.max(0, Number(confidence) || 0)), status, timestamp, timestamp);
  ensureDiagnosticSessionMeta(sessionId);
  incrementClaimRevision.run(timestamp, sessionId);
  markDraftsStale.run(JSON.stringify([`策略字段 ${fieldPath} 已更新`]), sessionId);
  return listProfileClaims(sessionId).find((claim) => claim.fieldPath === fieldPath && claim.sourceRef === sourceRef);
}

export function listProfileClaims(sessionId) {
  return selectClaims.all(sessionId).map(mapClaim);
}

export function listCurrentProfileClaims(sessionId) {
  const byPath = new Map();
  for (const claim of listProfileClaims(sessionId)) {
    const previous = byPath.get(claim.fieldPath);
    if (!previous || claim.updatedAt >= previous.updatedAt) byPath.set(claim.fieldPath, claim);
  }
  return [...byPath.values()];
}

export function createDiagnosticQuestion({ sessionId, content, goal = "", targetFieldPaths = [], targetSlotIds = [], relevance = {}, expectedAnswerType = "free_text", questionMode = "initial", attempt = 1 }) {
  if (!getDiagnosticSession(sessionId)) throw new Error("Diagnostic session not found");
  const fingerprint = `${[...targetFieldPaths].sort().join(",") || "none"}:${[...targetSlotIds].sort().join(",") || "field"}`;
  const active = getPendingDiagnosticQuestion(sessionId);
  if (active?.fingerprint === fingerprint) return active;
  if (active) setDiagnosticQuestionStatus(active.id, "superseded");
  const questionId = id("question");
  const createdAt = now();
  insertQuestion.run(questionId, sessionId, String(content || "").trim(), goal, JSON.stringify(targetFieldPaths || []), JSON.stringify(targetSlotIds || []), JSON.stringify(relevance || {}), expectedAnswerType, questionMode, Math.max(1, Number(attempt) || 1), createdAt);
  for (const fieldPath of targetFieldPaths || []) {
    const existing = getDiagnosticFieldState(sessionId, fieldPath);
    upsertDiagnosticFieldState({ sessionId, fieldPath, state: existing?.state === "confirmed" ? "confirmed" : "asked", attempts: Math.max(existing?.attempts || 0, Number(attempt) || 1), lastQuestionId: questionId, metadata: existing?.metadata || {} });
  }
  return getPendingDiagnosticQuestion(sessionId);
}

export function getPendingDiagnosticQuestion(sessionId) {
  return mapQuestion(selectPendingQuestion.get(sessionId));
}

export function listDiagnosticQuestions(sessionId) {
  return selectQuestions.all(sessionId).map(mapQuestion);
}

export function markDiagnosticQuestionAnswered(questionId) {
  if (questionId) answerQuestion.run(now(), questionId);
}

export function setDiagnosticQuestionStatus(questionId, status) {
  if (!questionId) return;
  updateQuestionStatus.run(status, ["answered", "skipped", "superseded", "cancelled"].includes(status) ? now() : null, questionId);
}

export function upsertDiagnosticFieldState({ sessionId, fieldPath, state, resolutionType = null, attempts = 0, lastQuestionId = null, metadata = {} }) {
  if (!getDiagnosticSession(sessionId) || !fieldPath) throw new Error("Valid sessionId and fieldPath are required");
  upsertFieldStateStatement.run(sessionId, fieldPath, state, resolutionType, Math.max(0, Number(attempts) || 0), lastQuestionId, JSON.stringify(metadata || {}), now());
  return getDiagnosticFieldState(sessionId, fieldPath);
}

export function getDiagnosticFieldState(sessionId, fieldPath) {
  return mapFieldState(selectFieldState.get(sessionId, fieldPath));
}

export function listDiagnosticFieldStates(sessionId) {
  return selectFieldStates.all(sessionId).map(mapFieldState);
}

export function createAgentRecommendation({ sessionId, accountId, targetFieldPath, recommendationType = "strategy_field", recommendedValue, rationale = [], alternatives = [] }) {
  if (!getDiagnosticSession(sessionId) || !accountId || !targetFieldPath) throw new Error("Recommendation session, account and target field are required");
  const recommendationId = id("recommendation");
  const timestamp = now();
  insertRecommendation.run(recommendationId, sessionId, accountId, targetFieldPath, recommendationType, JSON.stringify(recommendedValue), JSON.stringify(rationale || []), JSON.stringify(alternatives || []), "pending_confirmation", timestamp, timestamp);
  return getAgentRecommendation(recommendationId);
}

export function getAgentRecommendation(recommendationId) {
  return mapRecommendation(selectRecommendation.get(recommendationId));
}

export function getPendingAgentRecommendation(sessionId) {
  return mapRecommendation(selectPendingRecommendation.get(sessionId));
}

export function listAgentRecommendations(sessionId) {
  return selectRecommendations.all(sessionId).map(mapRecommendation);
}

export function setAgentRecommendationStatus(recommendationId, status) {
  updateRecommendationStatus.run(status, now(), ["accepted", "accepted_with_changes", "rejected"].includes(status) ? now() : null, recommendationId);
  return getAgentRecommendation(recommendationId);
}

export function saveAgentRecommendationRevision({ recommendationId,baseOptionId=null,userInstruction="",value,display={} }) {
  if (!getAgentRecommendation(recommendationId) || value == null) throw new Error("Valid recommendation revision is required");
  const revision=Number(nextRecommendationRevision.get(recommendationId).revision);
  insertRecommendationRevision.run(id("recorev"),recommendationId,revision,baseOptionId,userInstruction,JSON.stringify(value),JSON.stringify(display||{}),"revision_ready",now());
  setAgentRecommendationStatus(recommendationId,"revision_ready");
  return getAgentRecommendation(recommendationId);
}

export function saveAgentRecommendationDecision({ recommendationId, selectedOptionId = null, acceptMode, acceptedValue, validation = {} }) {
  const recommendation = getAgentRecommendation(recommendationId);
  if (!recommendation) throw new Error("Recommendation not found");
  upsertRecommendationDecision.run(recommendationId, selectedOptionId, acceptMode, JSON.stringify(acceptedValue), JSON.stringify(validation || {}), now());
  return getAgentRecommendation(recommendationId);
}

export function ensureDiagnosticSessionMeta(sessionId) {
  const existing = selectSessionMeta.get(sessionId);
  if (existing) return getDiagnosticSessionMeta(sessionId);
  const timestamp = now();
  upsertSessionMeta.run(sessionId, "core_diagnosis", null, 0, 0, timestamp);
  return getDiagnosticSessionMeta(sessionId);
}

export function getDiagnosticSessionMeta(sessionId) {
  const row = selectSessionMeta.get(sessionId);
  if (!row) return null;
  return { sessionId: row.session_id, conversationPhase: row.conversation_phase, completionAnnouncedAt: row.completion_announced_at, claimRevision: row.claim_revision, factRevision: row.fact_revision, updatedAt: row.updated_at };
}

export function updateDiagnosticSessionMeta(sessionId, patch = {}) {
  const current = ensureDiagnosticSessionMeta(sessionId);
  const phase = Object.prototype.hasOwnProperty.call(patch, "conversationPhase") ? patch.conversationPhase : current.conversationPhase;
  const announcedAt = Object.prototype.hasOwnProperty.call(patch, "completionAnnouncedAt") ? patch.completionAnnouncedAt : current.completionAnnouncedAt;
  replaceSessionMetaState.run(phase, announcedAt, now(), sessionId);
  return getDiagnosticSessionMeta(sessionId);
}

export function saveStrategyDraftCache({ sessionId, accountId, draft, validation = {}, providerMode = null }) {
  const timestamp = now();
  const existing = selectDraftCache.get(sessionId);
  upsertDraftCache.run(sessionId, accountId, JSON.stringify(draft), JSON.stringify(validation), providerMode, existing?.created_at || timestamp, timestamp);
  return getStrategyDraftCache(sessionId);
}

export function saveStrategyDraftRevision({ sessionId, accountId, draft, validation = {}, providerMode = null }) {
  const meta = ensureDiagnosticSessionMeta(sessionId);
  const revision = nextDraftRevision.get(sessionId).revision;
  const draftId = id("draft");
  insertDraftRevision.run(draftId, sessionId, accountId, revision, JSON.stringify(draft), JSON.stringify(validation || {}), providerMode, meta.claimRevision, meta.factRevision, now());
  updateDiagnosticSessionMeta(sessionId, { conversationPhase: "draft_created" });
  return getLatestStrategyDraftRevision(sessionId);
}

export function markStrategyDraftsStale(sessionId, reason = "账号身份、账号组合或增长打法已更新") {
  markDraftsStale.run(JSON.stringify([reason]), sessionId);
  return getLatestStrategyDraftRevision(sessionId);
}

export function getLatestStrategyDraftRevision(sessionId) {
  const row = selectLatestDraftRevision.get(sessionId);
  if (!row) return null;
  return { id: row.id, sessionId: row.session_id, accountId: row.account_id, revision: row.revision, draft: parse(row.payload_json, {}), validation: parse(row.validation_json, {}), providerMode: row.provider_mode, sourceClaimRevision: row.source_claim_revision, sourceFactRevision: row.source_fact_revision, stale: Boolean(row.stale), staleReasons: parse(row.stale_reasons_json, []), createdAt: row.created_at };
}

export function getStrategyDraftRevision(draftRevisionId) {
  const row = selectDraftRevision.get(draftRevisionId);
  if (!row) return null;
  return { id: row.id, sessionId: row.session_id, accountId: row.account_id, revision: row.revision, draft: parse(row.payload_json, {}), validation: parse(row.validation_json, {}), providerMode: row.provider_mode, sourceClaimRevision: row.source_claim_revision, sourceFactRevision: row.source_fact_revision, stale: Boolean(row.stale), staleReasons: parse(row.stale_reasons_json, []), createdAt: row.created_at };
}

function mapDraftRequest(row) {
  if (!row) return null;
  return { id:row.id,sessionId:row.session_id,accountId:row.account_id,status:row.status,draftRevisionId:row.draft_revision_id,errorCode:row.error_code,errorMessage:row.error_message,createdAt:row.created_at,updatedAt:row.updated_at,completedAt:row.completed_at };
}

export function createStrategyDraftRequest({ requestId, sessionId, accountId }) {
  const timestamp=now();
  insertDraftRequest.run(requestId,sessionId,accountId,"running",timestamp,timestamp);
  return getStrategyDraftRequest(sessionId,requestId);
}

export function updateStrategyDraftRequest({ requestId, sessionId, status, draftRevisionId = null, errorCode = null, errorMessage = null }) {
  const timestamp=now();
  updateDraftRequest.run(status,draftRevisionId,errorCode,errorMessage,timestamp,["succeeded","failed"].includes(status)?timestamp:null,requestId,sessionId);
  return getStrategyDraftRequest(sessionId,requestId);
}

export function getStrategyDraftRequest(sessionId, requestId = "latest") {
  return mapDraftRequest(requestId==="latest"?selectLatestDraftRequest.get(sessionId):selectDraftRequest.get(requestId,sessionId));
}

export function getStrategyDraftCache(sessionId) {
  const row = selectDraftCache.get(sessionId);
  if (!row) return null;
  return { sessionId: row.session_id, accountId: row.account_id, draft: parse(row.payload_json, {}), validation: parse(row.validation_json, {}), providerMode: row.provider_mode, createdAt: row.created_at, updatedAt: row.updated_at };
}

function mergeFactValue(previous, incoming, operation) {
  if (operation === "append") {
    if (Array.isArray(previous) || Array.isArray(incoming)) {
      const combined = [...(Array.isArray(previous) ? previous : previous == null ? [] : [previous]), ...(Array.isArray(incoming) ? incoming : incoming == null ? [] : [incoming])];
      const seen = new Set();
      return combined.filter((item) => {
        const key = typeof item === "string" ? item.trim() : JSON.stringify(item);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    if (previous && typeof previous === "object" && incoming && typeof incoming === "object") return { ...previous, ...incoming };
  }
  if (operation === "refine" && previous && typeof previous === "object" && incoming && typeof incoming === "object") return { ...previous, ...incoming };
  return incoming;
}

export function applyProfileFactOperation({ accountId, sessionId = null, turnId = null, factKey, factType = "business_detail", subject = "company", predicate, value, operation = "create", status = "user_asserted", confidence = 0.9, visibility = "unknown", contentUsage = "needs_review", sourceType = "user_statement", strategyImpact = null, platformScope = null }) {
  if (!accountId || !factKey || !predicate) throw new Error("accountId, factKey and predicate are required");
  const previousRow = selectCurrentFact.get(accountId, factKey);
  const previousCurrent = mapFact(previousRow);
  const sessionContext = sessionId ? getDiagnosticSessionContext(sessionId) : null;
  const isolateFromCompanyHistory = Boolean(sessionId && sessionContext?.memoryPolicy === "session_only");
  const previousInSession = isolateFromCompanyHistory
    ? selectFactEvents.all(accountId).map(mapFact).filter((fact) => fact.sessionId === sessionId && fact.factKey === factKey).at(-1) || null
    : null;
  const previous = isolateFromCompanyHistory ? previousInSession : previousCurrent;
  const eventId = id("factevent");
  const timestamp = now();
  const nextValue = mergeFactValue(previous?.value, value, operation);
  const normalizedConfidence = Math.min(1, Math.max(0, Number(confidence) || 0));
  insertFactEvent.run(eventId, accountId, sessionId, turnId, factKey, factType, subject, predicate, JSON.stringify(nextValue), operation, status, normalizedConfidence, visibility, contentUsage, sourceType, previous?.id || null, timestamp);
  const sourceEventIds = [...(previous?.sourceEventIds || []), eventId];
  upsertCurrentFact.run(previousCurrent?.id || id("fact"), accountId, factKey, factType, subject, predicate, JSON.stringify(nextValue), status, normalizedConfidence, visibility, contentUsage, JSON.stringify(sourceEventIds), previousCurrent?.createdAt || timestamp, timestamp);
  if (sessionId) {
    ensureDiagnosticSessionMeta(sessionId);
    incrementFactRevision.run(timestamp, sessionId);
    const governed = { factKey, factType, predicate, strategyImpact, platformScope };
    if (factAffectsStrategy(governed)) {
      markDraftsStale.run(JSON.stringify([`动态事实 ${factKey} 已更新（${classifyFactImpact(governed)}）`]), sessionId);
    }
  }
  return mapFact(selectCurrentFact.get(accountId, factKey));
}

export function listProfileFactEvents(accountId) {
  return selectFactEvents.all(accountId).map(mapFact);
}

export function listCurrentProfileFacts(accountId) {
  return selectCurrentFacts.all(accountId).map(mapFact);
}

function saveFactSnapshot(accountId, facts) {
  const stableFacts = facts.map((fact) => ({
    id: fact.id,
    key: fact.factKey,
    value: fact.value,
    status: fact.status,
    confidence: fact.confidence,
    visibility: fact.visibility,
    contentUsage: fact.contentUsage,
    sourceType: fact.sourceType,
    strategyImpact: fact.strategyImpact,
    platformScope: fact.platformScope,
    anonymizationRules: fact.anonymizationRules || fact.value?.anonymizationRules || fact.value?.anonymization || [],
    updatedAt: fact.updatedAt
  }));
  const contentHash = createHash("sha256").update(JSON.stringify(stableFacts)).digest("hex");
  const existing = selectFactSnapshotByHash.get(accountId, contentHash);
  if (existing) return mapFactSnapshot(existing);
  const revision = Number(nextFactSnapshotRevision.get(accountId).revision);
  const snapshotId = id("factsnapshot");
  const payload = { id: snapshotId, ...buildFactSnapshotPayload({ accountId, facts, factRevision: revision }) };
  assertSharedContract(validateFactSnapshotV1(payload));
  insertFactSnapshot.run(snapshotId, accountId, revision, contentHash, JSON.stringify(payload), payload.capturedAt);
  return mapFactSnapshot(selectFactSnapshot.get(snapshotId));
}

export function saveCurrentFactSnapshot(accountId) {
  if (!accountId) throw new Error("accountId is required");
  return saveFactSnapshot(accountId,listCurrentProfileFacts(accountId));
}

export function saveSessionFactSnapshot(accountId, sessionId) {
  if (!accountId || !sessionId) throw new Error("accountId and sessionId are required");
  return saveFactSnapshot(accountId,listSessionProfileFacts(accountId,sessionId));
}

export function getFactSnapshot(snapshotId) {
  return mapFactSnapshot(selectFactSnapshot.get(snapshotId));
}

export function getLatestFactSnapshot(accountId) {
  return mapFactSnapshot(selectLatestFactSnapshot.get(accountId));
}

export function listSessionProfileFacts(accountId, sessionId) {
  const events = selectFactEvents.all(accountId).map(mapFact).filter((fact) => fact.sessionId === sessionId && !["rejected", "conflicting"].includes(fact.status));
  const latest = new Map();
  for (const fact of events) latest.set(fact.factKey, fact);
  return [...latest.values()];
}

export function listHistoricalProfileFacts(accountId, excludedSessionId = null) {
  const volatileTypes = new Set(["diagnostic_detail", "growth_stage", "platform_role", "conversion_path", "content_preference", "operating_preference", "team_resource"]);
  const events = selectFactEvents.all(accountId).map(mapFact).filter((fact) => fact.sessionId !== excludedSessionId && !volatileTypes.has(fact.factType) && !["rejected", "conflicting"].includes(fact.status));
  const latest = new Map();
  for (const fact of events) latest.set(fact.factKey, { ...fact, status: "historical_candidate" });
  return [...latest.values()];
}

export function setDiagnosticProgress({ sessionId, status, completeness, criticalMissingFields = [] }) {
  const completedAt = status === "completed" ? now() : null;
  updateSessionProgress.run(status, Math.min(100, Math.max(0, Math.round(completeness))), JSON.stringify(criticalMissingFields), now(), completedAt, sessionId);
  return getDiagnosticSession(sessionId);
}

export function saveStrategySnapshot({ accountId, sourceSessionId = null, payload, status = "draft", metadata = null }) {
  if (!accountId || !payload) throw new Error("accountId and payload are required");
  const snapshotId = id("strategy");
  const version = nextSnapshotVersion.get(accountId).version;
  const createdAt = now();
  insertSnapshot.run(snapshotId, accountId, version, status, JSON.stringify(payload), sourceSessionId, createdAt, status === "active" ? createdAt : null);
  if (metadata) insertSnapshotMeta.run(snapshotId, metadata.sourceDraftRevisionId || null, metadata.documentHash || null, metadata.contextHash || null, metadata.activationReason || "user_confirmed", metadata.supersedesSnapshotId || null, createdAt);
  return getStrategySnapshot(snapshotId);
}

export function activateExactStrategyDocument({ accountId, sourceSessionId, sourceDraftRevisionId, payload, documentHash, contextHash, activationReason = "user_confirmed" }) {
  if (!accountId || !sourceSessionId || !sourceDraftRevisionId || !payload || !documentHash || !contextHash) throw new Error("Exact strategy activation metadata is incomplete");
  const snapshotId = id("strategy");
  const createdAt = now();
  database.exec("BEGIN IMMEDIATE");
  try {
    const version = nextSnapshotVersion.get(accountId).version;
    const previous = selectActiveSnapshot.get(accountId);
    insertSnapshot.run(snapshotId, accountId, version, "draft", JSON.stringify(payload), sourceSessionId, createdAt, null);
    insertSnapshotMeta.run(snapshotId, sourceDraftRevisionId, documentHash, contextHash, activationReason, previous?.id || null, createdAt);
    deactivateSnapshots.run(accountId);
    activateSnapshot.run(createdAt, snapshotId);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  return getStrategySnapshot(snapshotId);
}

export function getStrategySnapshot(snapshotId) {
  return mapSnapshot(selectSnapshot.get(snapshotId));
}

export function listStrategySnapshots(accountId) {
  return selectSnapshotsByAccount.all(accountId).map(mapSnapshot);
}

export function activateStrategySnapshot(snapshotId) {
  const snapshot = getStrategySnapshot(snapshotId);
  if (!snapshot) throw new Error("Strategy snapshot not found");
  database.exec("BEGIN IMMEDIATE");
  try {
    deactivateSnapshots.run(snapshot.accountId);
    activateSnapshot.run(now(), snapshotId);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  return getStrategySnapshot(snapshotId);
}

export function getActiveStrategySnapshot(accountId) {
  return mapSnapshot(selectActiveSnapshot.get(accountId));
}

export function saveDirectionSet({ strategySnapshotId, payload, status = "draft" }) {
  if (!getStrategySnapshot(strategySnapshotId)) throw new Error("Strategy snapshot not found");
  const directionSetId = id("directionset");
  const version = nextDirectionVersion.get(strategySnapshotId).version;
  const createdAt = now();
  insertDirectionSet.run(directionSetId, strategySnapshotId, version, status, JSON.stringify(payload), createdAt);
  return getLatestDirectionSet(strategySnapshotId);
}

export function getLatestDirectionSet(strategySnapshotId) {
  const row = selectLatestDirectionSet.get(strategySnapshotId);
  if (!row) return null;
  return {
    id: row.id,
    strategySnapshotId: row.strategy_snapshot_id,
    version: row.version,
    status: row.status,
    payload: parse(row.payload_json, {}),
    createdAt: row.created_at
  };
}
