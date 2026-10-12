import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(here, '../../../..');
export const fixtureDir = resolve(repoRoot, 'apps/flowsocial/scripts/fixtures/xhs-integrated-page-provider-comparison');
export const outputDir = resolve(repoRoot, '.tmp/xhs-integrated-page-provider-comparison');
const API_ROOT = 'https://api.kie.ai';
const CONTRACT = 'ProviderCapabilityEvaluation@1.0';
const TOP_KEYS = [
  'blockers', 'contract', 'costStatus', 'createdAt', 'deliveryStatus', 'dimensionStatus',
  'editingStatus', 'evaluationHash', 'evaluationId', 'evidence', 'factStatus', 'model',
  'pageCase', 'productionDataWritten', 'provider', 'providerStatus', 'referenceIsolationStatus',
  'runMode', 'schemaVersion', 'selectionStatus', 'source', 'textStatus', 'visualStatus'
].sort();
const EVIDENCE_KEYS = [
  'actualCreditsDelta', 'candidateCount', 'expectedCredits', 'manualReview', 'observedDimensions',
  'outputRelativePath', 'outputSha256', 'requestHash', 'sourceRef'
].sort();
export const EXACT_DIMENSIONS = Object.freeze({ width: 1080, height: 1440 });

export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function sha256(value) {
  return createHash('sha256').update(typeof value === 'string' ? value : stableStringify(value)).digest('hex');
}

export function sha256Bytes(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function meetsExactDimensions(value) {
  return value?.width === EXACT_DIMENSIONS.width && value?.height === EXACT_DIMENSIONS.height;
}

function exactKeys(value, expected, label) {
  assert.deepEqual(Object.keys(value).sort(), expected, `${label} fields must be exact`);
}

function enumValue(value, allowed, label) {
  assert.ok(allowed.includes(value), `${label} is invalid`);
}

export function evaluationHash(value) {
  const copy = structuredClone(value);
  delete copy.evaluationHash;
  return sha256(copy);
}

export function validateEvaluation(value, { verifyOutput = false, artifactRoot = repoRoot } = {}) {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value));
  exactKeys(value, TOP_KEYS, 'evaluation');
  assert.equal(value.schemaVersion, '1.0');
  assert.equal(value.contract, CONTRACT);
  for (const key of ['evaluationId', 'createdAt', 'source', 'provider', 'model', 'pageCase', 'runMode']) {
    assert.equal(typeof value[key], 'string', `${key} must be a string`);
    assert.ok(value[key].length > 0, `${key} must not be empty`);
  }
  enumValue(value.runMode, ['dry-run', 'live', '05a-adapter'], 'runMode');
  enumValue(value.providerStatus, ['not_requested', 'succeeded', 'failed', 'blocked'], 'providerStatus');
  for (const key of ['textStatus', 'factStatus', 'visualStatus', 'dimensionStatus', 'referenceIsolationStatus']) {
    enumValue(value[key], ['pending_human_review', 'passed', 'failed', 'not_tested', 'blocked'], key);
  }
  enumValue(value.costStatus, ['not_measured', 'within_budget', 'measured', 'blocked'], 'costStatus');
  enumValue(value.editingStatus, ['not_tested', 'passed', 'failed', 'blocked'], 'editingStatus');
  assert.equal(value.selectionStatus, 'not_selected');
  assert.equal(value.deliveryStatus, 'not_delivered');
  assert.equal(value.productionDataWritten, false);
  assert.ok(Array.isArray(value.blockers) && value.blockers.every((item) => typeof item === 'string'));
  exactKeys(value.evidence, EVIDENCE_KEYS, 'evidence');
  assert.equal(value.evidence.candidateCount, 1);
  assert.ok(Number.isFinite(value.evidence.expectedCredits) && value.evidence.expectedCredits >= 0);
  assert.ok(value.evidence.actualCreditsDelta === null || (Number.isFinite(value.evidence.actualCreditsDelta) && value.evidence.actualCreditsDelta >= 0));
  assert.ok(value.evidence.outputRelativePath === null || typeof value.evidence.outputRelativePath === 'string');
  assert.ok(value.evidence.outputSha256 === null || /^[0-9a-f]{64}$/.test(value.evidence.outputSha256));
  if (value.evidence.outputRelativePath === null) assert.equal(value.evidence.outputSha256, null, 'output hash requires an output path');
  if (value.providerStatus === 'succeeded' && value.evidence.outputRelativePath !== null) assert.match(value.evidence.outputSha256, /^[0-9a-f]{64}$/, 'successful output requires PNG SHA-256');
  assert.ok(value.evidence.observedDimensions === null || (
    Number.isInteger(value.evidence.observedDimensions.width) && Number.isInteger(value.evidence.observedDimensions.height)
  ));
  assert.ok(value.evidence.manualReview === null || typeof value.evidence.manualReview === 'object');
  if (value.evidence.observedDimensions !== null) {
    assert.equal(value.dimensionStatus, meetsExactDimensions(value.evidence.observedDimensions) ? 'passed' : 'failed', 'dimensionStatus must enforce exact 1080x1440');
    if (value.evidence.manualReview?.dimensionStatus) assert.equal(value.evidence.manualReview.dimensionStatus, value.dimensionStatus, 'manual review cannot override exact dimensions');
  }
  assert.match(value.evidence.requestHash, /^[0-9a-f]{64}$/);
  assert.equal(typeof value.evidence.sourceRef, 'string');
  assert.equal(value.evaluationHash, evaluationHash(value));
  if (verifyOutput && value.evidence.outputRelativePath !== null) {
    const path = resolve(artifactRoot, value.evidence.outputRelativePath);
    assert.ok(isWithin(path, artifactRoot), 'output path escaped artifact root');
    assert.equal(sha256Bytes(readFileSync(path)), value.evidence.outputSha256, 'output file SHA-256 mismatch');
  }
  return value;
}

export function makeEvaluation({ model, pageCase, runMode, expectedCredits, requestHash, now = new Date().toISOString() }) {
  const value = {
    schemaVersion: '1.0', contract: CONTRACT,
    evaluationId: `pce_${sha256(`${model.id}:${pageCase.id}:${runMode}:${now}`).slice(0, 20)}`,
    createdAt: now, source: 'FS-V1-XHS-VISUAL-05E', provider: 'kie.ai', model: model.id,
    pageCase: pageCase.id, runMode,
    providerStatus: 'not_requested', textStatus: 'pending_human_review', factStatus: 'pending_human_review',
    visualStatus: 'pending_human_review', dimensionStatus: 'pending_human_review',
    referenceIsolationStatus: 'not_tested', costStatus: 'within_budget', editingStatus: 'not_tested',
    selectionStatus: 'not_selected', deliveryStatus: 'not_delivered',
    evidence: {
      candidateCount: 1, expectedCredits, actualCreditsDelta: null, outputRelativePath: null, outputSha256: null,
      observedDimensions: null, manualReview: null, requestHash,
      sourceRef: 'apps/flowsocial/scripts/fixtures/xhs-integrated-page-provider-comparison'
    },
    blockers: [], productionDataWritten: false, evaluationHash: ''
  };
  value.evaluationHash = evaluationHash(value);
  return validateEvaluation(value);
}

export function markProviderOutcome(value, { succeeded, creditsDelta, outputRelativePath = null, outputSha256 = null, dimensions = null, blocker = null }) {
  const next = structuredClone(value);
  next.providerStatus = succeeded ? 'succeeded' : 'failed';
  next.costStatus = Number.isFinite(creditsDelta) ? 'measured' : 'blocked';
  next.evidence.actualCreditsDelta = Number.isFinite(creditsDelta) ? creditsDelta : null;
  next.evidence.outputRelativePath = outputRelativePath;
  next.evidence.outputSha256 = outputSha256;
  next.evidence.observedDimensions = dimensions;
  if (succeeded && dimensions !== null) next.dimensionStatus = meetsExactDimensions(dimensions) ? 'passed' : 'failed';
  if (blocker) next.blockers.push(blocker);
  next.evaluationHash = evaluationHash(next);
  return validateEvaluation(next);
}

export function applyManualReview(value, review) {
  const next = structuredClone(value);
  const fields = ['textStatus', 'factStatus', 'visualStatus', 'dimensionStatus', 'referenceIsolationStatus'];
  exactKeys(review, [...fields, 'notes'].sort(), 'manual review');
  for (const key of fields) enumValue(review[key], ['passed', 'failed', 'not_tested'], key);
  if (next.evidence.observedDimensions !== null) assert.equal(review.dimensionStatus, next.dimensionStatus, 'manual review cannot override exact dimensions');
  assert.equal(typeof review.notes, 'string');
  next.textStatus = review.textStatus;
  next.factStatus = review.factStatus;
  next.visualStatus = review.visualStatus;
  next.dimensionStatus = review.dimensionStatus;
  next.referenceIsolationStatus = review.referenceIsolationStatus;
  next.evidence.manualReview = { ...review, reviewedAt: new Date().toISOString(), reviewer: 'content-asset-execution-human-inspection' };
  next.evaluationHash = evaluationHash(next);
  return validateEvaluation(next);
}

export function adapt05ABaselineReadOnly(input) {
  const before = stableStringify(input);
  const copy = structuredClone(input);
  assert.equal(copy.schemaVersion, '1.0');
  assert.equal(copy.sourceContract, 'FS-V1-XHS-VISUAL-05A');
  assert.equal(copy.readOnly, true);
  const model = { id: copy.model };
  const pageCase = { id: '05a-five-case-baseline' };
  let value = makeEvaluation({ model, pageCase, runMode: '05a-adapter', expectedCredits: copy.creditsConsumedDelta / copy.paidRequests, requestHash: sha256(copy) });
  value.providerStatus = copy.observations.providerStatus;
  for (const key of ['textStatus', 'factStatus', 'visualStatus', 'dimensionStatus', 'referenceIsolationStatus', 'editingStatus']) value[key] = copy.observations[key];
  value.costStatus = 'measured';
  value.evidence.actualCreditsDelta = copy.creditsConsumedDelta;
  value.evidence.candidateCount = copy.candidatesPerRequest;
  value.evidence.observedDimensions = copy.observations.observedDimensions;
  value.dimensionStatus = meetsExactDimensions(copy.observations.observedDimensions) ? 'passed' : 'failed';
  value.evaluationHash = evaluationHash(value);
  assert.equal(stableStringify(input), before, '05A adapter mutated its input');
  return validateEvaluation(value);
}

export function loadFixtures() {
  return {
    models: JSON.parse(readFileSync(resolve(fixtureDir, 'models.json'), 'utf8')),
    cases: JSON.parse(readFileSync(resolve(fixtureDir, 'cases.json'), 'utf8')),
    baseline05A: JSON.parse(readFileSync(resolve(fixtureDir, '05a-baseline.json'), 'utf8'))
  };
}

export function validateFrozenFixtures(models, cases) {
  assert.equal(models.schemaVersion, '1.0');
  assert.equal(models.provider, 'kie.ai');
  assert.equal(models.models.length <= 2, true);
  assert.equal(cases.cases.length, 3);
  assert.equal(models.requestsPerModel, 3);
  assert.equal(models.candidatesPerRequest, 1);
  assert.equal(models.maxPaidRequests, 6);
  assert.equal(models.automaticRetries, 0, 'automaticRetries must be zero');
  assert.equal(models.creditUsd, 0.005);
  assert.deepEqual(models.requiredDimensions, EXACT_DIMENSIONS, 'fixture must freeze exact 1080x1440 dimensions');
  let projected = 0;
  for (const model of models.models) {
    assert.ok(!model.id.toLowerCase().includes('seedream'));
    assert.equal(model.lifecycle, 'experimental');
    assert.match(model.documentationUrl, /^https:\/\/docs\.kie\.ai\//);
    assert.match(model.pricingUrl, /^https:\/\/(?:www\.)?kie\.ai\//);
    assert.equal(model.createEndpoint, '/api/v1/jobs/createTask');
    assert.equal(model.estimatedCreditsPerRequest, model.priceUsdPerImage / models.creditUsd);
    assert.equal(model.estimatedCreditsForThreeRequests, model.estimatedCreditsPerRequest * 3);
    assert.ok(model.estimatedCreditsPerRequest <= models.maxCreditsPerRequest);
    projected += model.estimatedCreditsForThreeRequests;
  }
  assert.ok(projected <= models.maxTotalCredits);
  for (const pageCase of cases.cases) {
    assert.equal(typeof pageCase.prompt, 'string');
    assert.ok(pageCase.prompt.includes('不要出现'));
    assert.ok(Array.isArray(pageCase.truth.requiredText) && pageCase.truth.requiredText.length >= 2);
  }
  return { projectedCalls: models.models.length * cases.cases.length, projectedCredits: projected };
}

function isWithin(child, parent) {
  const rel = relative(resolve(parent), resolve(child));
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !resolve(rel).startsWith(sep));
}

export function validateIsolation(target = outputDir, root = repoRoot) {
  assert.equal(resolve(target), resolve(root, '.tmp/xhs-integrated-page-provider-comparison'));
  assert.ok(isWithin(target, resolve(root, '.tmp')));
  const ignored = spawnSync('git', ['check-ignore', '--quiet', '--', relative(root, resolve(target, 'probe.txt'))], { cwd: root });
  assert.equal(ignored.status, 0, 'output directory must already be git ignored');
  if (existsSync(target)) {
    assert.equal(lstatSync(target).isSymbolicLink(), false, 'output directory must not be a symlink');
    assert.ok(isWithin(realpathSync(target), realpathSync(resolve(root, '.tmp'))));
  }
  return true;
}

function loadExistingApiKey() {
  const keyNames = ['KIE_API_KEY', 'KIEAI_API_KEY', 'KIE_AI_API_KEY'];
  for (const name of keyNames) if (process.env[name]) return process.env[name];
  const common = spawnSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: repoRoot, encoding: 'utf8' });
  const primaryRoot = common.status === 0 ? resolve(common.stdout.trim(), '..') : repoRoot;
  const candidates = [
    resolve(repoRoot, '.env.local'), resolve(repoRoot, 'apps/flowsocial/.env.local'),
    resolve(primaryRoot, '.env.local'), resolve(primaryRoot, 'apps/flowsocial/.env.local')
  ];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    const content = readFileSync(path, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^\s*(KIE_API_KEY|KIEAI_API_KEY|KIE_AI_API_KEY)\s*=\s*(.*?)\s*$/);
      if (match) return match[2].replace(/^['"]|['"]$/g, '');
    }
  }
  throw new Error('KIE_API_KEY_NOT_CONFIGURED');
}

async function fetchJson(url, options = {}, timeoutMs = 30_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || (body.code !== undefined && body.code !== 200)) throw new Error(`KIE_HTTP_${response.status}_CODE_${body.code ?? 'UNKNOWN'}`);
    return body;
  } finally { clearTimeout(timer); }
}

async function getCredits(apiKey) {
  const body = await fetchJson(`${API_ROOT}/api/v1/chat/credit`, { headers: { Authorization: `Bearer ${apiKey}` } });
  assert.ok(Number.isFinite(body.data), 'credit response is not numeric');
  return body.data;
}

async function createTask(apiKey, request) {
  const body = await fetchJson(`${API_ROOT}/api/v1/jobs/createTask`, {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(request)
  });
  const taskId = body?.data?.taskId ?? body?.data?.task_id;
  assert.equal(typeof taskId, 'string', 'createTask did not return a task id');
  return taskId;
}

export async function pollTask(apiKey, taskId, { maxPolls = 180, intervalMs = 3000, transport = fetchJson } = {}) {
  assert.ok(Number.isInteger(maxPolls) && maxPolls > 0 && maxPolls <= 300);
  for (let count = 0; count < maxPolls; count += 1) {
    const body = await transport(`${API_ROOT}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, { headers: { Authorization: `Bearer ${apiKey}` } });
    const state = body?.data?.state;
    if (state === 'success') return body.data;
    if (state === 'fail') throw new Error(`KIE_TASK_FAILED_${body?.data?.failCode || 'UNKNOWN'}`);
    if (!['waiting', 'queuing', 'generating'].includes(state)) throw new Error('KIE_TASK_STATE_UNKNOWN');
    if (count + 1 < maxPolls) await new Promise((done) => setTimeout(done, intervalMs));
  }
  throw new Error('KIE_POLL_LIMIT_REACHED');
}

function resultUrl(task) {
  const parsed = typeof task.resultJson === 'string' ? JSON.parse(task.resultJson) : task.resultJson;
  assert.equal(parsed.resultUrls.length, 1, 'exactly one candidate is required');
  const url = new URL(parsed.resultUrls[0]);
  assert.equal(url.protocol, 'https:');
  return url.toString();
}

function dimensions(buffer) {
  if (buffer.length >= 24 && buffer.subarray(1, 4).toString() === 'PNG') return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) { offset += 1; continue; }
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
      offset += 2 + length;
    }
  }
  return null;
}

function safeExt(contentType, url) {
  if (contentType?.includes('png')) return '.png';
  if (contentType?.includes('jpeg') || contentType?.includes('jpg')) return '.jpg';
  if (contentType?.includes('webp')) return '.webp';
  const ext = extname(new URL(url).pathname).toLowerCase();
  return ['.png', '.jpg', '.jpeg', '.webp'].includes(ext) ? ext : '.bin';
}

async function download(url, pathBase) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`RESULT_DOWNLOAD_${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const path = `${pathBase}${safeExt(response.headers.get('content-type'), url)}`;
  writeFileSync(path, buffer);
  return { path, dimensions: dimensions(buffer), outputSha256: sha256Bytes(buffer) };
}

function requestFor(model, pageCase) {
  return { model: model.id, input: { prompt: pageCase.prompt, ...model.input } };
}

function writeEvaluation(value) {
  validateEvaluation(value, { verifyOutput: value.evidence.outputRelativePath !== null });
  const path = resolve(outputDir, `${value.model}--${value.pageCase}.evaluation.json`);
  assert.ok(isWithin(path, outputDir));
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return path;
}

export function reprojectExistingEvaluations() {
  validateIsolation();
  assert.ok(existsSync(outputDir), 'isolated evaluation directory does not exist');
  const files = readdirSync(outputDir).filter((name) => name.endsWith('.evaluation.json')).sort();
  const results = [];
  for (const filename of files) {
    const path = resolve(outputDir, filename);
    const value = JSON.parse(readFileSync(path, 'utf8'));
    assert.equal(value.providerStatus, 'succeeded', 'only successful existing outputs can be reprojected');
    assert.equal(typeof value.evidence.outputRelativePath, 'string');
    const imagePath = resolve(repoRoot, value.evidence.outputRelativePath);
    assert.ok(isWithin(imagePath, outputDir), 'existing output path escaped isolation directory');
    const imageBuffer = readFileSync(imagePath);
    const observedDimensions = dimensions(imageBuffer);
    assert.ok(observedDimensions, 'existing output dimensions could not be parsed');
    value.evidence.outputSha256 = sha256Bytes(imageBuffer);
    value.evidence.observedDimensions = observedDimensions;
    value.dimensionStatus = meetsExactDimensions(value.evidence.observedDimensions) ? 'passed' : 'failed';
    if (value.evidence.manualReview) {
      value.evidence.manualReview.dimensionStatus = value.dimensionStatus;
      if (!value.evidence.manualReview.notes.includes('精确1080×1440')) value.evidence.manualReview.notes += value.dimensionStatus === 'passed' ? ' 精确1080×1440门槛通过。' : ' 精确1080×1440门槛未通过。';
    }
    value.evaluationHash = evaluationHash(value);
    validateEvaluation(value, { verifyOutput: true });
    writeEvaluation(value);
    results.push({ filename, dimensionStatus: value.dimensionStatus, observedDimensions: value.evidence.observedDimensions, outputSha256: value.evidence.outputSha256 });
  }
  return { reprojected: results.length, exactDimensions: EXACT_DIMENSIONS, providerCalls: 0, evaluations: results };
}

export async function runDryRun() {
  const fixtures = loadFixtures();
  const budget = validateFrozenFixtures(fixtures.models, fixtures.cases);
  validateIsolation();
  const baseline = adapt05ABaselineReadOnly(fixtures.baseline05A);
  const evaluations = [];
  for (const model of fixtures.models.models) for (const pageCase of fixtures.cases.cases) {
    const request = requestFor(model, pageCase);
    evaluations.push(makeEvaluation({ model, pageCase, runMode: 'dry-run', expectedCredits: model.estimatedCreditsPerRequest, requestHash: sha256(request) }));
  }
  return {
    mode: 'dry-run', provider: fixtures.models.provider,
    models: fixtures.models.models.map((model) => ({ id: model.id, documentationUrl: model.documentationUrl, requests: 3, candidatesPerRequest: 1, estimatedCreditsPerRequest: model.estimatedCreditsPerRequest })),
    outputDirectory: '.tmp/xhs-integrated-page-provider-comparison/', exactDimensions: fixtures.models.requiredDimensions,
    networkCalls: 0, paidRequests: 0,
    automaticRetries: 0, productionDataWritten: false, budget, evaluationCount: evaluations.length,
    baselineContract: baseline.contract
  };
}

export function sanitizeError(value) {
  return String(value).replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]').replace(/[?&](token|key|signature)=[^&\s]+/gi, '$1=[REDACTED]');
}

export async function runLive() {
  const fixtures = loadFixtures();
  const budget = validateFrozenFixtures(fixtures.models, fixtures.cases);
  validateIsolation();
  const apiKey = loadExistingApiKey();
  assert.ok(apiKey.length >= 10, 'configured API key is not usable');
  mkdirSync(outputDir, { recursive: true });
  let actualCalls = 0;
  let consumed = 0;
  const evaluations = [];
  let stoppedBy = null;
  outer: for (const model of fixtures.models.models) for (const pageCase of fixtures.cases.cases) {
    const request = requestFor(model, pageCase);
    let evaluation = makeEvaluation({ model, pageCase, runMode: 'live', expectedCredits: model.estimatedCreditsPerRequest, requestHash: sha256(request) });
    if (actualCalls >= fixtures.models.maxPaidRequests || model.estimatedCreditsPerRequest > fixtures.models.maxCreditsPerRequest || consumed + model.estimatedCreditsPerRequest > fixtures.models.maxTotalCredits) {
      evaluation.providerStatus = 'blocked'; evaluation.costStatus = 'blocked'; evaluation.blockers.push('BUDGET_STOP_LINE');
      evaluation.evaluationHash = evaluationHash(evaluation); writeEvaluation(validateEvaluation(evaluation)); evaluations.push(evaluation); stoppedBy = 'BUDGET_STOP_LINE'; break outer;
    }
    let before;
    try {
      before = await getCredits(apiKey);
      if (before < model.estimatedCreditsPerRequest) throw new Error('INSUFFICIENT_CREDITS_PREFLIGHT');
      actualCalls += 1;
      const taskId = await createTask(apiKey, request);
      const terminal = await pollTask(apiKey, taskId);
      const url = resultUrl(terminal);
      const fileBase = resolve(outputDir, `${model.id}--${pageCase.id}`);
      const downloaded = await download(url, fileBase);
      const after = await getCredits(apiKey);
      const delta = Math.max(0, before - after);
      consumed += delta;
      const rel = relative(repoRoot, downloaded.path).replaceAll('\\', '/');
      evaluation = markProviderOutcome(evaluation, { succeeded: true, creditsDelta: delta, outputRelativePath: rel, outputSha256: downloaded.outputSha256, dimensions: downloaded.dimensions });
      evaluations.push(evaluation); writeEvaluation(evaluation);
      if (consumed >= fixtures.models.maxTotalCredits) { stoppedBy = 'ACTUAL_CREDIT_STOP_LINE'; break outer; }
    } catch (error) {
      let delta = null;
      if (before !== undefined) {
        try { delta = Math.max(0, before - await getCredits(apiKey)); consumed += delta; } catch { /* no retry; cost remains unknown */ }
      }
      evaluation = markProviderOutcome(evaluation, { succeeded: false, creditsDelta: delta, blocker: `LIVE_STOP_${String(error.message).replace(/[^A-Z0-9_]/gi, '_').slice(0, 80)}` });
      evaluations.push(evaluation); writeEvaluation(evaluation); stoppedBy = evaluation.blockers[0]; break outer;
    }
  }
  const summary = {
    schemaVersion: '1.0', mode: 'live', approvedPaidRequests: budget.projectedCalls, actualPaidRequests: actualCalls,
    candidatesPerRequest: 1, expectedCredits: budget.projectedCredits, actualCreditsDelta: consumed,
    automaticRetries: 0, productionDataWritten: false, evaluationFiles: evaluations.map((item) => `${item.model}--${item.pageCase}.evaluation.json`), stoppedBy
  };
  writeFileSync(resolve(outputDir, 'run-summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  return summary;
}

function parseArgs(argv) {
  const flags = new Set(argv);
  assert.ok(!(flags.has('--live') && flags.has('--dry-run')), '--live and --dry-run are mutually exclusive');
  assert.ok(!(flags.has('--live') && (flags.has('--record-review') || flags.has('--reproject-existing'))), '--live cannot be combined with offline mutation modes');
  return { live: flags.has('--live'), dryRun: !flags.has('--live'), recordReview: flags.has('--record-review'), reprojectExisting: flags.has('--reproject-existing') };
}

async function recordReview(argv) {
  const valueOf = (name) => { const index = argv.indexOf(name); assert.ok(index >= 0 && argv[index + 1], `${name} is required`); return argv[index + 1]; };
  validateIsolation();
  const filename = valueOf('--evaluation');
  assert.match(filename, /^[a-z0-9._-]+\.evaluation\.json$/i);
  const path = resolve(outputDir, filename);
  assert.ok(isWithin(path, outputDir));
  const current = validateEvaluation(JSON.parse(readFileSync(path, 'utf8')));
  const review = {
    textStatus: valueOf('--text'), factStatus: valueOf('--fact'), visualStatus: valueOf('--visual'),
    dimensionStatus: valueOf('--dimension'), referenceIsolationStatus: valueOf('--reference'), notes: valueOf('--notes')
  };
  const next = applyManualReview(current, review);
  writeEvaluation(next);
  return { recorded: filename, selectionStatus: next.selectionStatus, deliveryStatus: next.deliveryStatus, productionDataWritten: false };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  try {
    const args = process.argv.slice(2);
    const parsed = parseArgs(args);
    const result = parsed.reprojectExisting ? reprojectExistingEvaluations() : parsed.recordReview ? await recordReview(args) : parsed.live ? await runLive() : await runDryRun();
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${sanitizeError(error.message)}\n`);
    process.exitCode = 1;
  }
}
