function parsePayload(value) {
  try { return JSON.parse(value); } catch { return {}; }
}

export function mapStrategySnapshotRow(row, metadata = null) {
  if (!row) return null;
  const payload = parsePayload(row.payload_json);
  const base = {
    id: row.id,
    accountId: row.account_id,
    version: row.version,
    status: row.status,
    sourceSessionId: row.source_session_id,
    payload,
    createdAt: row.created_at,
    confirmedAt: row.confirmed_at
  };
  if (!metadata) return base;
  return {
    ...base,
    schemaVersion: "2.0",
    document: payload,
    sourceDraftRevisionId: metadata.source_draft_revision_id,
    documentHash: metadata.document_hash,
    contextHash: metadata.context_hash,
    activationReason: metadata.activation_reason,
    supersedesSnapshotId: metadata.supersedes_snapshot_id,
    activatedAt: row.confirmed_at
  };
}
