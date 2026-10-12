import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { encodeRgbaPng, normalizePngCandidate, readPngDimensions } from '../../image-providers/xhs-integrated-page/png-normalizer.mjs';

const here = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(here, '../../../..');
export const fixtureDir = resolve(repoRoot, 'apps/flowsocial/scripts/fixtures/xhs-integrated-page-pilot');
export const outputDir = resolve(repoRoot, '.tmp/xhs-integrated-page-pilot');
const API_ROOT = 'https://api.kie.ai';
const CONTRACT = 'IntegratedPagePilotEvaluation@1.0';
const TARGET = Object.freeze({ width: 1080, height: 1440 });

export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}
export const sha256 = (value) => createHash('sha256').update(Buffer.isBuffer(value) ? value : stableStringify(value)).digest('hex');
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const exactKeys = (value, keys, label) => assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), `${label} fields changed`);
const enumValue = (value, allowed, label) => assert.ok(allowed.includes(value), `${label} invalid`);
const within = (child, parent) => { const rel = relative(resolve(parent), resolve(child)); return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel)); };

export function evaluationHash(value) {
  const copy = structuredClone(value); delete copy.evaluationHash; return sha256(copy);
}

export function buildReferencePng(reference) {
  const { width, height, background, rectangles } = reference.recipe;
  const pixels = Buffer.alloc(width * height * 4);
  for (let i = 0; i < pixels.length; i += 4) for (let c = 0; c < 4; c += 1) pixels[i + c] = background[c];
  for (const rect of rectangles) for (let y = rect.y; y < rect.y + rect.height; y += 1) for (let x = rect.x; x < rect.x + rect.width; x += 1) {
    const offset = (y * width + x) * 4; for (let c = 0; c < 4; c += 1) pixels[offset + c] = rect.color[c];
  }
  return encodeRgbaPng(width, height, pixels);
}

export function loadFixtures() {
  return {
    pilot: readJson(resolve(fixtureDir, 'pilot.json')),
    cases: readJson(resolve(fixtureDir, 'cases.json')),
    reference: readJson(resolve(fixtureDir, 'reference-asset.json')),
    baseline05E: readJson(resolve(fixtureDir, '05e-baseline.json'))
  };
}

export function validateFrozenFixtures(fixtures) {
  const { pilot, cases, reference } = fixtures;
  exactKeys(pilot, ['schemaVersion', 'frozenAt', 'provider', 'model', 'approvedPaidRequests', 'candidatesPerRequest', 'automaticRetries', 'maxCreditsPerRequest', 'maxTotalCredits', 'expectedTotalCredits', 'requiredDimensions', 'polling', 'productionWrites'], 'pilot');
  assert.equal(pilot.schemaVersion, '1.0'); assert.equal(pilot.provider, 'kie.ai'); assert.equal(pilot.model.id, 'nano-banana-2'); assert.equal(pilot.model.lifecycle, 'experimental');
  assert.equal(pilot.model.documentationUrl, 'https://docs.kie.ai/market/google/nanobanana2');
  assert.match(pilot.model.pricingUrl, /^https:\/\/(?:www\.)?kie\.ai\//); assert.match(pilot.model.creditSourceUrl, /^https:\/\/(?:www\.)?kie\.ai\//);
  assert.equal(pilot.model.referenceCapability.status, 'verified'); assert.equal(pilot.model.referenceCapability.field, 'input.image_input');
  assert.deepEqual(pilot.model.input, { image_input: [], aspect_ratio: '3:4', resolution: '1K', output_format: 'png' });
  assert.equal(pilot.model.priceUsdPerImage1K / pilot.model.creditUsd, pilot.model.estimatedCreditsPerRequest);
  assert.equal(pilot.model.estimatedCreditsPerRequest, 8); assert.ok(pilot.model.estimatedCreditsPerRequest <= pilot.maxCreditsPerRequest);
  assert.equal(pilot.approvedPaidRequests, 4); assert.equal(pilot.candidatesPerRequest, 1); assert.equal(pilot.automaticRetries, 0);
  assert.equal(pilot.expectedTotalCredits, pilot.approvedPaidRequests * pilot.model.estimatedCreditsPerRequest); assert.ok(pilot.expectedTotalCredits <= pilot.maxTotalCredits); assert.equal(pilot.productionWrites, false);
  assert.deepEqual(pilot.requiredDimensions, TARGET); assert.ok(pilot.polling.maxPolls > 0 && pilot.polling.maxPolls <= 300); assert.ok(pilot.polling.intervalMs >= 0);
  assert.equal(cases.schemaVersion, '1.0'); assert.deepEqual(cases.cases.map((item) => item.id), ['cover', 'three-point-list', 'process-page', 'reference-isolation']);
  assert.equal(cases.cases.length, 4); assert.equal(cases.cases.filter((item) => item.referenceAssetId).length, 1);
  for (const item of cases.cases) { exactKeys(item, ['id', 'pageType', 'referenceAssetId', 'truth', 'prompt'], `case:${item.id}`); assert.ok(item.prompt.length > 30); assert.ok(item.truth.requiredText.length >= 2); }
  exactKeys(reference, ['schemaVersion', 'id', 'title', 'source', 'license', 'authorizedUse', 'containsSensitiveInformation', 'containsExternalBrandOrIp', 'reviewedBy', 'reviewedAt', 'decision', 'recipe', 'expectedPngSha256'], 'reference');
  assert.equal(reference.id, cases.cases.find((item) => item.referenceAssetId)?.referenceAssetId); assert.equal(reference.containsSensitiveInformation, false); assert.equal(reference.containsExternalBrandOrIp, false);
  assert.equal(reference.decision, 'experimental_authorized_for_05g_only'); assert.equal(reference.authorizedUse, 'isolated_provider_reference_pilot');
  const referenceBytes = buildReferencePng(reference); assert.equal(sha256(referenceBytes), reference.expectedPngSha256, 'reference asset bytes changed');
  return { projectedCalls: 4, projectedCredits: 32, referenceSha256: sha256(referenceBytes) };
}

const EVALUATION_KEYS = ['schemaVersion', 'contract', 'evaluationId', 'runMode', 'provider', 'model', 'caseId', 'pageType', 'candidateCount', 'providerStatus', 'providerNativeDimensionStatus', 'normalizationStatus', 'finalCanvasStatus', 'textStatus', 'factStatus', 'visualStatus', 'referenceIsolationStatus', 'costStatus', 'selectionStatus', 'deliveryStatus', 'productionStatus', 'productionWrites', 'evidence', 'blockers', 'createdAt', 'evaluationHash'];
const EVIDENCE_KEYS = ['officialSnapshotHash', 'requestHash', 'reference', 'nativeAsset', 'normalization', 'gateReview', 'expectedCredits', 'actualCreditsDelta'];

export function validateEvaluation(value, { verifyArtifacts = false, artifactRoot = repoRoot } = {}) {
  exactKeys(value, EVALUATION_KEYS, 'evaluation'); exactKeys(value.evidence, EVIDENCE_KEYS, 'evaluation.evidence');
  assert.equal(value.schemaVersion, '1.0'); assert.equal(value.contract, CONTRACT); assert.equal(value.provider, 'kie.ai'); assert.equal(value.model, 'nano-banana-2'); assert.equal(value.candidateCount, 1);
  enumValue(value.runMode, ['dry-run', 'live', '05e-adapter'], 'runMode'); enumValue(value.providerStatus, ['pending', 'succeeded', 'failed', 'blocked'], 'providerStatus');
  enumValue(value.providerNativeDimensionStatus, ['pending', 'passed', 'failed', 'blocked'], 'providerNativeDimensionStatus'); enumValue(value.normalizationStatus, ['not_run', 'succeeded', 'blocked'], 'normalizationStatus');
  enumValue(value.finalCanvasStatus, ['pending', 'passed', 'blocked'], 'finalCanvasStatus');
  for (const key of ['textStatus', 'factStatus', 'visualStatus']) enumValue(value[key], ['pending', 'passed', 'failed', 'review_required', 'not_tested'], key);
  enumValue(value.referenceIsolationStatus, ['not_applicable', 'pending', 'passed', 'failed', 'blocked', 'not_tested'], 'referenceIsolationStatus'); enumValue(value.costStatus, ['pending', 'measured', 'blocked', 'historical_observation'], 'costStatus');
  assert.equal(value.selectionStatus, 'not_selected'); assert.equal(value.deliveryStatus, 'not_delivered'); assert.equal(value.productionStatus, 'disabled'); assert.equal(value.productionWrites, false);
  assert.equal(value.evidence.expectedCredits <= 8, true); assert.ok(value.evidence.actualCreditsDelta === null || (Number.isFinite(value.evidence.actualCreditsDelta) && value.evidence.actualCreditsDelta >= 0));
  if (value.costStatus === 'measured') assert.ok(Number.isFinite(value.evidence.actualCreditsDelta) && value.evidence.actualCreditsDelta <= 8, 'measured cost exceeds per-request limit');
  if (value.evidence.actualCreditsDelta > 8) { assert.equal(value.costStatus, 'blocked'); assert.ok(value.blockers.includes('ACTUAL_CREDITS_PER_REQUEST_EXCEEDED'), 'over-limit cost blocker missing'); }
  if (value.costStatus === 'blocked') assert.ok(value.blockers.length > 0, 'blocked cost requires blocker evidence');
  assert.match(value.evidence.officialSnapshotHash, /^[a-f0-9]{64}$/); assert.match(value.evidence.requestHash, /^[a-f0-9]{64}$/); assert.ok(Array.isArray(value.blockers));
  if (value.providerStatus === 'succeeded' && value.runMode !== '05e-adapter') { assert.ok(value.evidence.nativeAsset); assert.match(value.evidence.nativeAsset.sha256, /^[a-f0-9]{64}$/); }
  if (value.finalCanvasStatus === 'passed') { assert.equal(value.normalizationStatus, 'succeeded'); assert.deepEqual(value.evidence.normalization?.dimensions, TARGET); assert.match(value.evidence.normalization?.sha256, /^[a-f0-9]{64}$/); }
  if (value.evidence.nativeAsset) exactKeys(value.evidence.nativeAsset, ['relativePath', 'sha256', 'bytes', 'dimensions'], 'nativeAsset');
  if (value.evidence.normalization) exactKeys(value.evidence.normalization, ['relativePath', 'sha256', 'bytes', 'dimensions', 'recordHash', 'mode'], 'normalization');
  if (value.caseId === 'reference-isolation') { assert.ok(value.evidence.reference); exactKeys(value.evidence.reference, ['id', 'source', 'license', 'authorizedUse', 'sourceSha256', 'uploadStatus', 'requestReferenceHash', 'similarityReview'], 'reference'); assert.match(value.evidence.reference.sourceSha256, /^[a-f0-9]{64}$/); } else assert.equal(value.evidence.reference, null);
  if (value.evidence.gateReview) { exactKeys(value.evidence.gateReview, ['textStatus', 'factStatus', 'visualStatus', 'referenceIsolationStatus', 'observedText', 'extraText', 'factObservations', 'visualObservations', 'notes', 'reviewedNativeSha256', 'reviewedNormalizedSha256'], 'gateReview'); assert.equal(value.evidence.gateReview.reviewedNativeSha256, value.evidence.nativeAsset?.sha256); assert.equal(value.evidence.gateReview.reviewedNormalizedSha256, value.evidence.normalization?.sha256 || null); }
  if (verifyArtifacts && value.evidence.nativeAsset) verifyArtifact(value.evidence.nativeAsset, artifactRoot);
  if (verifyArtifacts && value.evidence.normalization) verifyArtifact(value.evidence.normalization, artifactRoot);
  assert.equal(value.evaluationHash, evaluationHash(value), 'evaluation hash mismatch'); return value;
}

function verifyArtifact(asset, artifactRoot) {
  const path = resolve(artifactRoot, asset.relativePath); assert.ok(within(path, outputDir), 'artifact escaped isolation'); assert.ok(existsSync(path), 'artifact missing');
  const bytes = readFileSync(path); assert.equal(bytes.length, asset.bytes, 'artifact byte count mismatch'); assert.equal(sha256(bytes), asset.sha256, 'artifact SHA-256 mismatch'); assert.deepEqual(readPngDimensions(bytes), asset.dimensions, 'artifact dimensions mismatch');
}

export function makeEvaluation({ fixtures, pageCase, runMode, requestHash, now = new Date().toISOString() }) {
  const value = {
    schemaVersion: '1.0', contract: CONTRACT, evaluationId: `05g:${pageCase.id}:${runMode}`, runMode, provider: 'kie.ai', model: 'nano-banana-2', caseId: pageCase.id, pageType: pageCase.pageType, candidateCount: 1,
    providerStatus: 'pending', providerNativeDimensionStatus: 'pending', normalizationStatus: 'not_run', finalCanvasStatus: 'pending', textStatus: 'pending', factStatus: 'pending', visualStatus: 'pending', referenceIsolationStatus: pageCase.referenceAssetId ? 'pending' : 'not_applicable', costStatus: 'pending', selectionStatus: 'not_selected', deliveryStatus: 'not_delivered', productionStatus: 'disabled', productionWrites: false,
    evidence: { officialSnapshotHash: sha256(fixtures.pilot), requestHash, reference: pageCase.referenceAssetId ? { id: fixtures.reference.id, source: fixtures.reference.source, license: fixtures.reference.license, authorizedUse: fixtures.reference.authorizedUse, sourceSha256: fixtures.reference.expectedPngSha256, uploadStatus: 'pending', requestReferenceHash: null, similarityReview: 'pending' } : null, nativeAsset: null, normalization: null, gateReview: null, expectedCredits: fixtures.pilot.model.estimatedCreditsPerRequest, actualCreditsDelta: null }, blockers: [], createdAt: now, evaluationHash: ''
  };
  value.evaluationHash = evaluationHash(value); return validateEvaluation(value);
}

export function adapt05EReadOnly(input, fixtures = loadFixtures()) {
  const before = sha256(input); const copy = structuredClone(input); const pageCase = fixtures.cases.cases.find((item) => item.id === copy.pageCase) || fixtures.cases.cases[0];
  const value = makeEvaluation({ fixtures, pageCase, runMode: '05e-adapter', requestHash: sha256({ sourceContract: copy.contract, sourceHash: copy.evaluationHash }) });
  value.evaluationId = `05g-adapter:${copy.evaluationId}`; value.providerStatus = copy.providerStatus; value.providerNativeDimensionStatus = copy.dimensionStatus === 'passed' ? 'passed' : 'failed'; value.normalizationStatus = 'not_run'; value.finalCanvasStatus = 'pending';
  value.textStatus = copy.textStatus; value.factStatus = copy.factStatus; value.visualStatus = copy.visualStatus; value.referenceIsolationStatus = copy.referenceIsolationStatus; value.costStatus = 'historical_observation'; value.evidence.actualCreditsDelta = copy.evidence.actualCreditsDelta;
  value.blockers = ['05E_READ_ONLY_BASELINE_NO_NORMALIZATION_OR_05F_GATES']; value.evaluationHash = evaluationHash(value); validateEvaluation(value); assert.equal(sha256(input), before, '05E adapter mutated input'); return value;
}

export function validateIsolation(target = outputDir) {
  const tempRoot = resolve(repoRoot, '.tmp'); mkdirSync(tempRoot, { recursive: true });
  const ignored = spawnSync('git', ['check-ignore', '-q', relative(repoRoot, target)], { cwd: repoRoot }); assert.equal(ignored.status, 0, 'output directory is not git ignored');
  if (existsSync(target)) { assert.equal(lstatSync(target).isSymbolicLink(), false, 'output directory is a symlink'); assert.ok(within(realpathSync(target), realpathSync(tempRoot)), 'output directory escaped .tmp'); }
  return true;
}

export function sanitizeError(value) { return String(value).replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]').replace(/[?&](token|key|signature)=[^&\s]+/gi, '$1=[REDACTED]').replace(/task_[a-z0-9_-]+/gi, '[TASK_ID_REDACTED]'); }

async function fetchJson(url, options = {}, timeoutMs = 30_000) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { const response = await fetch(url, { ...options, signal: controller.signal }); const body = await response.json().catch(() => ({})); if (!response.ok || (body.code !== undefined && body.code !== 200) || body.success === false) throw new Error(`KIE_HTTP_${response.status}_CODE_${body.code ?? 'UNKNOWN'}`); return body; } finally { clearTimeout(timer); }
}

export async function pollTask(apiKey, taskId, { maxPolls = 180, intervalMs = 3000, transport = fetchJson } = {}) {
  assert.ok(Number.isInteger(maxPolls) && maxPolls > 0 && maxPolls <= 300);
  for (let count = 0; count < maxPolls; count += 1) { const body = await transport(`${API_ROOT}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, { headers: { Authorization: `Bearer ${apiKey}` } }); const state = body?.data?.state; if (state === 'success') return body.data; if (state === 'fail') throw new Error(`KIE_TASK_FAILED_${body?.data?.failCode || 'UNKNOWN'}`); if (!['waiting', 'queuing', 'generating'].includes(state)) throw new Error('KIE_TASK_STATE_UNKNOWN'); if (count + 1 < maxPolls) await new Promise((done) => setTimeout(done, intervalMs)); }
  throw new Error('KIE_POLL_LIMIT_REACHED');
}

function loadApiKey() {
  for (const name of ['KIE_API_KEY', 'KIEAI_API_KEY', 'KIE_AI_API_KEY']) if (process.env[name]) return process.env[name];
  const common = spawnSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: repoRoot, encoding: 'utf8' }); const primaryRoot = common.status === 0 ? resolve(common.stdout.trim(), '..') : repoRoot;
  for (const path of [resolve(repoRoot, '.env.local'), resolve(repoRoot, 'apps/flowsocial/.env.local'), resolve(primaryRoot, '.env.local'), resolve(primaryRoot, 'apps/flowsocial/.env.local')]) if (existsSync(path)) for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) { const match = line.match(/^\s*(KIE_API_KEY|KIEAI_API_KEY|KIE_AI_API_KEY)\s*=\s*(.*?)\s*$/); if (match) return match[2].replace(/^['"]|['"]$/g, ''); }
  throw new Error('KIE_API_KEY_NOT_CONFIGURED');
}

async function credits(apiKey) { const body = await fetchJson(`${API_ROOT}/api/v1/chat/credit`, { headers: { Authorization: `Bearer ${apiKey}` } }); assert.ok(Number.isFinite(body.data)); return body.data; }
async function uploadReference(apiKey, bytes, fixture) { const body = await fetchJson(fixture.pilot.model.referenceUploadEndpoint, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ base64Data: `data:image/png;base64,${bytes.toString('base64')}`, uploadPath: 'images/flowsocial-05g', fileName: `${fixture.reference.id}-${fixture.reference.expectedPngSha256.slice(0, 12)}.png` }) }); const url = body?.data?.downloadUrl || body?.data?.fileUrl; assert.match(url, /^https:\/\//); return url; }
async function createTask(apiKey, request) { const body = await fetchJson(`${API_ROOT}/api/v1/jobs/createTask`, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(request) }); const id = body?.data?.taskId ?? body?.data?.task_id; assert.equal(typeof id, 'string'); return id; }
function outputUrl(task) { const result = typeof task.resultJson === 'string' ? JSON.parse(task.resultJson) : task.resultJson; assert.equal(result.resultUrls.length, 1, 'exactly one candidate required'); const url = new URL(result.resultUrls[0]); assert.equal(url.protocol, 'https:'); return url.toString(); }
async function downloadPng(url) { const response = await fetch(url, { signal: AbortSignal.timeout(60_000) }); if (!response.ok) throw new Error(`RESULT_DOWNLOAD_${response.status}`); const bytes = Buffer.from(await response.arrayBuffer()); readPngDimensions(bytes); return bytes; }

function requestFor(fixtures, pageCase, referenceUrl = null) { return { model: fixtures.pilot.model.id, input: { prompt: pageCase.prompt, ...fixtures.pilot.model.input, image_input: referenceUrl ? [referenceUrl] : [] } }; }
function writeEvaluation(value) { validateEvaluation(value, { verifyArtifacts: Boolean(value.evidence.nativeAsset) }); const path = resolve(outputDir, `${value.caseId}.evaluation.json`); assert.ok(within(path, outputDir)); writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); return path; }

export function applyProviderResult(value, { nativeBytes, nativeRelativePath, normalized }) {
  const next = structuredClone(value); const dimensions = readPngDimensions(nativeBytes); next.providerStatus = 'succeeded'; next.providerNativeDimensionStatus = dimensions.width === TARGET.width && dimensions.height === TARGET.height ? 'passed' : 'failed';
  next.evidence.nativeAsset = { relativePath: nativeRelativePath, sha256: sha256(nativeBytes), bytes: nativeBytes.length, dimensions };
  next.normalizationStatus = normalized.record.status === 'succeeded' ? 'succeeded' : 'blocked'; next.finalCanvasStatus = normalized.finalCanvasStatus; next.evidence.normalization = normalized.outputBuffer ? { relativePath: normalized.record.outputAsset.relativePath, sha256: normalized.record.outputAsset.sha256, bytes: normalized.record.outputAsset.bytes, dimensions: normalized.record.outputAsset.dimensions, recordHash: normalized.record.recordHash, mode: normalized.record.mode } : null;
  next.blockers.push(...normalized.record.blockers.map((item) => item.code)); next.evaluationHash = evaluationHash(next); return validateEvaluation(next, { verifyArtifacts: true });
}

export function applyCostOutcome(value, { creditsDelta = null, blocker = null }) {
  const next = structuredClone(value); next.evidence.actualCreditsDelta = Number.isFinite(creditsDelta) ? creditsDelta : null;
  if (Number.isFinite(creditsDelta) && creditsDelta > 8) { next.costStatus = 'blocked'; next.blockers.push('ACTUAL_CREDITS_PER_REQUEST_EXCEEDED'); }
  else if (blocker) { next.costStatus = 'blocked'; next.blockers.push(blocker); }
  else if (Number.isFinite(creditsDelta)) next.costStatus = 'measured';
  else { next.costStatus = 'blocked'; next.blockers.push('POST_CALL_CREDITS_QUERY_FAILED'); }
  next.blockers = [...new Set(next.blockers)]; next.evaluationHash = evaluationHash(next); return validateEvaluation(next, { verifyArtifacts: Boolean(next.evidence.nativeAsset) });
}

export function applyManualReview(value, review) {
  validateEvaluation(value, { verifyArtifacts: true }); const next = structuredClone(value); exactKeys(review, ['textStatus', 'factStatus', 'visualStatus', 'referenceIsolationStatus', 'observedText', 'extraText', 'factObservations', 'visualObservations', 'notes'], 'manual review');
  for (const key of ['textStatus', 'factStatus', 'visualStatus']) enumValue(review[key], ['passed', 'failed', 'review_required'], key); enumValue(review.referenceIsolationStatus, ['not_applicable', 'passed', 'failed', 'blocked'], 'referenceIsolationStatus');
  next.textStatus = review.textStatus; next.factStatus = review.factStatus; next.visualStatus = review.visualStatus; next.referenceIsolationStatus = review.referenceIsolationStatus;
  next.evidence.gateReview = { ...structuredClone(review), reviewedNativeSha256: next.evidence.nativeAsset.sha256, reviewedNormalizedSha256: next.evidence.normalization?.sha256 || null };
  if (next.evidence.reference) next.evidence.reference.similarityReview = review.referenceIsolationStatus;
  for (const [key, code] of [['textStatus', 'TEXT_GATE_FAILED'], ['factStatus', 'FACT_GATE_FAILED'], ['visualStatus', 'VISUAL_GATE_FAILED'], ['referenceIsolationStatus', 'REFERENCE_ISOLATION_FAILED']]) if (next[key] === 'failed' || next[key] === 'blocked') next.blockers.push(code);
  next.evaluationHash = evaluationHash(next); return validateEvaluation(next, { verifyArtifacts: true });
}

export async function runDryRun() {
  const fixtures = loadFixtures(); const budget = validateFrozenFixtures(fixtures); validateIsolation(); const baseline = adapt05EReadOnly(fixtures.baseline05E, fixtures);
  const evaluations = fixtures.cases.cases.map((pageCase) => makeEvaluation({ fixtures, pageCase, runMode: 'dry-run', requestHash: sha256(requestFor(fixtures, pageCase, pageCase.referenceAssetId ? '[TEMP_REFERENCE_URL]' : null)) }));
  return { mode: 'dry-run', provider: 'kie.ai', model: 'nano-banana-2', officialSources: { documentationUrl: fixtures.pilot.model.documentationUrl, pricingUrl: fixtures.pilot.model.pricingUrl, creditSourceUrl: fixtures.pilot.model.creditSourceUrl, fileUploadDocumentationUrl: fixtures.pilot.model.fileUploadDocumentationUrl }, cases: evaluations.map((item) => ({ id: item.caseId, candidates: 1, estimatedCredits: 8, referenceInput: item.evidence.reference !== null })), approvedPaidRequests: 4, actualPaidRequests: 0, estimatedCreditsPerRequest: 8, estimatedTotalCredits: 32, automaticRetries: 0, networkCalls: 0, productionWrites: false, outputDirectory: '.tmp/xhs-integrated-page-pilot/', baselineContract: baseline.contract, budget };
}

export function persistProviderArtifacts(pageCase, nativeBytes) {
  const nativeRelativePath = `.tmp/xhs-integrated-page-pilot/${pageCase.id}.native.png`; writeFileSync(resolve(repoRoot, nativeRelativePath), nativeBytes);
  let normalized;
  try { const dims = readPngDimensions(nativeBytes); const mode = dims.width * 4 === dims.height * 3 ? 'resample' : 'fit_crop'; normalized = normalizePngCandidate({ id: `05g-normalization:${pageCase.id}`, candidateRef: { id: `05g-candidate:${pageCase.id}`, hash: sha256(nativeBytes) }, sourceBuffer: nativeBytes, sourceRelativePath: nativeRelativePath, declaredSourceSha256: sha256(nativeBytes), outputRelativePath: `.tmp/xhs-integrated-page-pilot/${pageCase.id}.normalized.png`, mode, protectedRegions: [], createdAt: new Date().toISOString() }); if (normalized.outputBuffer) writeFileSync(resolve(repoRoot, normalized.record.outputAsset.relativePath), normalized.outputBuffer); }
  catch (error) { normalized = { record: { status: 'blocked', blockers: [{ code: `NORMALIZATION_${sanitizeError(error.message)}` }] }, outputBuffer: null, finalCanvasStatus: 'blocked' }; }
  return { nativeRelativePath, normalized };
}

export async function executeLiveCases({ fixtures, apiKey, referenceUrl, operations = {}, artifactWriter = persistProviderArtifacts, evaluationWriter = writeEvaluation }) {
  const io = { credits, createTask, pollTask, outputUrl, downloadPng, ...operations }; let actualPaidRequests = 0; let actualCreditsDelta = 0; let stoppedBy = null; const evaluations = [];
  for (const pageCase of fixtures.cases.cases) {
    const request = requestFor(fixtures, pageCase, pageCase.referenceAssetId ? referenceUrl : null); let evaluation = makeEvaluation({ fixtures, pageCase, runMode: 'live', requestHash: sha256(request) }); if (evaluation.evidence.reference) { evaluation.evidence.reference.uploadStatus = 'succeeded'; evaluation.evidence.reference.requestReferenceHash = sha256(referenceUrl); evaluation.evaluationHash = evaluationHash(evaluation); }
    if (actualPaidRequests >= fixtures.pilot.approvedPaidRequests || actualCreditsDelta + 8 > fixtures.pilot.maxTotalCredits) { evaluation.providerStatus = 'blocked'; evaluation.costStatus = 'blocked'; evaluation.blockers.push('BUDGET_STOP_LINE'); evaluation.evaluationHash = evaluationHash(evaluation); evaluationWriter(evaluation); evaluations.push(evaluation); stoppedBy = 'BUDGET_STOP_LINE'; break; }
    let before;
    try { before = await io.credits(apiKey); if (before < 8) throw new Error('INSUFFICIENT_CREDITS_PREFLIGHT'); }
    catch (error) { evaluation.providerStatus = 'blocked'; evaluation.providerNativeDimensionStatus = 'blocked'; evaluation.normalizationStatus = 'blocked'; evaluation.finalCanvasStatus = 'blocked'; evaluation = applyCostOutcome(evaluation, { blocker: `PRE_CALL_CREDITS_QUERY_FAILED_${sanitizeError(error.message).replace(/[^A-Z0-9_]/gi, '_').slice(0, 80)}` }); evaluationWriter(evaluation); evaluations.push(evaluation); stoppedBy = evaluation.blockers.at(-1); break; }
    try {
      actualPaidRequests += 1; const taskId = await io.createTask(apiKey, request); const terminal = await io.pollTask(apiKey, taskId, fixtures.pilot.polling); const nativeBytes = await io.downloadPng(io.outputUrl(terminal)); const artifacts = artifactWriter(pageCase, nativeBytes); evaluation = applyProviderResult(evaluation, { nativeBytes, ...artifacts });
    } catch (error) { evaluation.providerStatus = 'failed'; evaluation.providerNativeDimensionStatus = 'blocked'; evaluation.normalizationStatus = 'blocked'; evaluation.finalCanvasStatus = 'blocked'; evaluation = applyCostOutcome(evaluation, { blocker: `LIVE_STOP_${sanitizeError(error.message).replace(/[^A-Z0-9_]/gi, '_').slice(0, 100)}` }); evaluationWriter(evaluation); evaluations.push(evaluation); stoppedBy = evaluation.blockers.at(-1); break; }
    let delta;
    try { delta = Math.max(0, before - await io.credits(apiKey)); actualCreditsDelta += delta; }
    catch (error) { evaluation = applyCostOutcome(evaluation, { blocker: `POST_CALL_CREDITS_QUERY_FAILED_${sanitizeError(error.message).replace(/[^A-Z0-9_]/gi, '_').slice(0, 80)}` }); evaluationWriter(evaluation); evaluations.push(evaluation); stoppedBy = evaluation.blockers.at(-1); break; }
    evaluation = applyCostOutcome(evaluation, { creditsDelta: delta }); evaluationWriter(evaluation); evaluations.push(evaluation);
    if (delta > 8) { stoppedBy = 'ACTUAL_CREDITS_PER_REQUEST_EXCEEDED'; break; }
    if (actualCreditsDelta >= 32) { stoppedBy = 'ACTUAL_CREDIT_STOP_LINE'; break; }
  }
  return { actualPaidRequests, actualCreditsDelta, stoppedBy, evaluations };
}

export async function runLive() {
  const fixtures = loadFixtures(); const budget = validateFrozenFixtures(fixtures); validateIsolation(); mkdirSync(outputDir, { recursive: true }); validateIsolation(); const apiKey = loadApiKey(); assert.ok(apiKey.length >= 10, 'configured API key is not usable');
  const referenceBytes = buildReferencePng(fixtures.reference); const referencePath = resolve(outputDir, 'reference-input.png'); writeFileSync(referencePath, referenceBytes); assert.equal(sha256(readFileSync(referencePath)), fixtures.reference.expectedPngSha256);
  let referenceUrl; try { referenceUrl = await uploadReference(apiKey, referenceBytes, fixtures); } catch (error) { throw new Error(`REFERENCE_UPLOAD_PREFLIGHT_${sanitizeError(error.message)}`); }
  const execution = await executeLiveCases({ fixtures, apiKey, referenceUrl }); const { actualPaidRequests, actualCreditsDelta, stoppedBy, evaluations } = execution;
  const summary = { schemaVersion: '1.0', mode: 'live', provider: 'kie.ai', model: 'nano-banana-2', approvedPaidRequests: budget.projectedCalls, actualPaidRequests, candidatesPerRequest: 1, expectedCredits: budget.projectedCredits, actualCreditsDelta, automaticRetries: 0, productionWrites: false, selectionStatus: 'not_selected', deliveryStatus: 'not_delivered', productionStatus: 'disabled', evaluationFiles: evaluations.map((item) => `${item.caseId}.evaluation.json`), stoppedBy };
  writeFileSync(resolve(outputDir, 'run-summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8'); return summary;
}

function recordReview(args) { const valueOf = (name) => { const i = args.indexOf(name); assert.ok(i >= 0 && args[i + 1], `${name} required`); return args[i + 1]; }; validateIsolation(); const filename = valueOf('--evaluation'); assert.match(filename, /^[a-z0-9._-]+\.evaluation\.json$/i); const path = resolve(outputDir, filename); assert.ok(within(path, outputDir)); const current = readJson(path); const list = (name) => valueOf(name).split('|').filter(Boolean); const next = applyManualReview(current, { textStatus: valueOf('--text'), factStatus: valueOf('--fact'), visualStatus: valueOf('--visual'), referenceIsolationStatus: valueOf('--reference'), observedText: list('--observed-text'), extraText: list('--extra-text'), factObservations: list('--fact-observations'), visualObservations: list('--visual-observations'), notes: valueOf('--notes') }); writeEvaluation(next); return { recorded: filename, evaluationHash: next.evaluationHash, selectionStatus: next.selectionStatus, deliveryStatus: next.deliveryStatus, productionWrites: false }; }

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  try { const args = process.argv.slice(2); assert.ok(!(args.includes('--live') && args.includes('--record-review')), 'live and review are mutually exclusive'); const result = args.includes('--record-review') ? recordReview(args) : args.includes('--live') ? await runLive() : await runDryRun(); process.stdout.write(`${JSON.stringify(result, null, 2)}\n`); } catch (error) { process.stderr.write(`${sanitizeError(error.message)}\n`); process.exitCode = 1; }
}
