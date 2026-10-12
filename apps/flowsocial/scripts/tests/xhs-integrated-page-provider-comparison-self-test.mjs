import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import {
  adapt05ABaselineReadOnly,
  applyManualReview,
  evaluationHash,
  meetsExactDimensions,
  loadFixtures,
  makeEvaluation,
  markProviderOutcome,
  pollTask,
  repoRoot,
  runDryRun,
  sanitizeError,
  sha256,
  sha256Bytes,
  stableStringify,
  validateEvaluation,
  validateFrozenFixtures,
  validateIsolation
} from '../live/xhs-integrated-page-provider-comparison.mjs';

let assertions = 0;
function check(condition, message) { assert.ok(condition, message); assertions += 1; }
function rejects(fn, pattern) { assert.throws(fn, pattern); assertions += 1; }

const fixtures = loadFixtures();
const fixtureSnapshot = stableStringify(fixtures.baseline05A);
const budget = validateFrozenFixtures(fixtures.models, fixtures.cases);
assert.deepEqual(budget, { projectedCalls: 6, projectedCredits: 42 }); assertions += 1;
check(fixtures.models.models.every((model) => model.estimatedCreditsPerRequest <= 20), 'per-call budget');
check(fixtures.models.models.every((model) => !model.id.includes('seedream')), 'Seedream must not be called');
check(fixtures.models.models.every((model) => model.lifecycle === 'experimental'), 'models must stay experimental');
check(fixtures.models.automaticRetries === 0, 'automatic retries must be zero');
check(validateIsolation(), 'isolated output must be ignored');
rejects(() => validateIsolation(resolve(repoRoot, 'apps')), /xhs-integrated-page-provider-comparison/);

const adapted = adapt05ABaselineReadOnly(fixtures.baseline05A);
assert.equal(stableStringify(fixtures.baseline05A), fixtureSnapshot); assertions += 1;
assert.equal(adapted.providerStatus, 'succeeded'); assertions += 1;
assert.equal(adapted.textStatus, 'failed'); assertions += 1;
assert.equal(adapted.referenceIsolationStatus, 'failed'); assertions += 1;
assert.equal(adapted.dimensionStatus, 'failed', '05A 1680x2240 must fail the exact 1080x1440 gate'); assertions += 1;
assert.deepEqual(adapted.evidence.observedDimensions, { width: 1680, height: 2240 }); assertions += 1;
assert.equal(adapted.selectionStatus, 'not_selected'); assertions += 1;
assert.equal(adapted.deliveryStatus, 'not_delivered'); assertions += 1;

const model = fixtures.models.models[0];
const pageCase = fixtures.cases.cases[0];
const requestHash = sha256({ model: model.id, input: { prompt: pageCase.prompt, ...model.input } });
const initial = makeEvaluation({ model, pageCase, runMode: 'dry-run', expectedCredits: 6, requestHash, now: '2026-08-03T00:00:00.000Z' });
assert.equal(initial.providerStatus, 'not_requested'); assertions += 1;
assert.equal(initial.textStatus, 'pending_human_review'); assertions += 1;
assert.equal(initial.factStatus, 'pending_human_review'); assertions += 1;
assert.equal(initial.visualStatus, 'pending_human_review'); assertions += 1;

const succeeded = markProviderOutcome(initial, {
  succeeded: true, creditsDelta: 6, outputRelativePath: '.tmp/xhs-integrated-page-provider-comparison/mock.png',
  outputSha256: sha256Bytes(Buffer.from('offline mock image')), dimensions: { width: 1080, height: 1440 }
});
assert.equal(succeeded.providerStatus, 'succeeded'); assertions += 1;
assert.equal(succeeded.textStatus, 'pending_human_review', 'provider success must not approve text'); assertions += 1;
assert.equal(succeeded.factStatus, 'pending_human_review', 'provider success must not approve facts'); assertions += 1;
assert.equal(succeeded.visualStatus, 'pending_human_review', 'provider success must not approve visuals'); assertions += 1;
assert.equal(succeeded.dimensionStatus, 'passed', 'exact dimensions must be machine-derived'); assertions += 1;
assert.equal(succeeded.selectionStatus, 'not_selected'); assertions += 1;
assert.equal(succeeded.deliveryStatus, 'not_delivered'); assertions += 1;

const reviewed = applyManualReview(succeeded, {
  textStatus: 'failed', factStatus: 'passed', visualStatus: 'passed', dimensionStatus: 'passed',
  referenceIsolationStatus: 'not_tested', notes: 'offline mock review'
});
assert.equal(reviewed.textStatus, 'failed'); assertions += 1;
assert.equal(reviewed.selectionStatus, 'not_selected'); assertions += 1;
assert.equal(reviewed.productionDataWritten, false); assertions += 1;

const missing = structuredClone(reviewed); delete missing.textStatus;
rejects(() => validateEvaluation(missing), /fields must be exact/);
const extra = structuredClone(reviewed); extra.unexpected = true;
rejects(() => validateEvaluation(extra), /fields must be exact/);
const badEnum = structuredClone(reviewed); badEnum.selectionStatus = 'selected'; badEnum.evaluationHash = evaluationHash(badEnum);
rejects(() => validateEvaluation(badEnum), /not_selected/);
const tampered = structuredClone(reviewed); tampered.factStatus = 'failed';
rejects(() => validateEvaluation(tampered), /strictly equal|evaluationHash/);
const badEvidence = structuredClone(reviewed); badEvidence.evidence.balanceBefore = 100; badEvidence.evaluationHash = evaluationHash(badEvidence);
rejects(() => validateEvaluation(badEvidence), /evidence fields must be exact/);
const missingOutputHash = structuredClone(reviewed); missingOutputHash.evidence.outputSha256 = null; missingOutputHash.evaluationHash = evaluationHash(missingOutputHash);
rejects(() => validateEvaluation(missingOutputHash), /successful output requires PNG SHA-256/);

const overPerCall = structuredClone(fixtures.models); overPerCall.models[0].priceUsdPerImage = 0.105; overPerCall.models[0].estimatedCreditsPerRequest = 21; overPerCall.models[0].estimatedCreditsForThreeRequests = 63;
rejects(() => validateFrozenFixtures(overPerCall, fixtures.cases), /maxCreditsPerRequest/);
const withSeedream = structuredClone(fixtures.models); withSeedream.models[0].id = 'seedream/4.5-text-to-image';
rejects(() => validateFrozenFixtures(withSeedream, fixtures.cases), /seedream/);
const retrying = structuredClone(fixtures.models); retrying.automaticRetries = 1;
rejects(() => validateFrozenFixtures(retrying, fixtures.cases), /automaticRetries/);

assert.equal(meetsExactDimensions({ width: 1080, height: 1440 }), true); assertions += 1;
assert.equal(meetsExactDimensions({ width: 1086, height: 1448 }), false); assertions += 1;
assert.equal(meetsExactDimensions({ width: 896, height: 1200 }), false); assertions += 1;
const approximate = markProviderOutcome(initial, {
  succeeded: true, creditsDelta: 6, outputRelativePath: '.tmp/xhs-integrated-page-provider-comparison/approximate.png',
  outputSha256: sha256Bytes(Buffer.from('approximate 3:4')), dimensions: { width: 896, height: 1200 }
});
assert.equal(approximate.dimensionStatus, 'failed', 'approximate 3:4 must not pass exact dimensions'); assertions += 1;
const falseExact = structuredClone(approximate); falseExact.dimensionStatus = 'passed'; falseExact.evaluationHash = evaluationHash(falseExact);
rejects(() => validateEvaluation(falseExact), /exact 1080x1440/);

const artifactRoot = mkdtempSync(resolve(tmpdir(), 'flowsocial-provider-eval-'));
const artifactPath = resolve(artifactRoot, 'artifact.png');
try {
  writeFileSync(artifactPath, Buffer.from('original png bytes'));
  const bound = markProviderOutcome(initial, {
    succeeded: true, creditsDelta: 6, outputRelativePath: 'artifact.png',
    outputSha256: sha256Bytes(readFileSync(artifactPath)), dimensions: { width: 1080, height: 1440 }
  });
  validateEvaluation(bound, { verifyOutput: true, artifactRoot }); assertions += 1;
  writeFileSync(artifactPath, Buffer.from('replacement png bytes'));
  rejects(() => validateEvaluation(bound, { verifyOutput: true, artifactRoot }), /SHA-256 mismatch/);
} finally {
  try { unlinkSync(artifactPath); } catch {}
  try { rmdirSync(artifactRoot); } catch {}
}

let polls = 0;
const terminal = await pollTask('not-a-real-key', 'offline-task', {
  maxPolls: 2, intervalMs: 0,
  transport: async () => ({ data: { state: ++polls === 1 ? 'generating' : 'success', resultJson: '{"resultUrls":["https://example.invalid/mock.png"]}' } })
});
assert.equal(terminal.state, 'success'); assertions += 1;
assert.equal(polls, 2); assertions += 1;
polls = 0;
await assert.rejects(() => pollTask('not-a-real-key', 'offline-task', {
  maxPolls: 2, intervalMs: 0, transport: async () => { polls += 1; return { data: { state: 'generating' } }; }
}), /KIE_POLL_LIMIT_REACHED/); assertions += 1;
assert.equal(polls, 2, 'polling must be bounded'); assertions += 1;

const dryRun = await runDryRun();
assert.equal(dryRun.mode, 'dry-run'); assertions += 1;
assert.equal(dryRun.networkCalls, 0); assertions += 1;
assert.equal(dryRun.paidRequests, 0); assertions += 1;
assert.equal(dryRun.automaticRetries, 0); assertions += 1;
assert.equal(dryRun.productionDataWritten, false); assertions += 1;
assert.equal(dryRun.evaluationCount, 6); assertions += 1;
assert.equal(dryRun.models.length, 2); assertions += 1;
assert.equal(dryRun.models.every((item) => item.documentationUrl.startsWith('https://docs.kie.ai/')), true); assertions += 1;
assert.equal(dryRun.outputDirectory, '.tmp/xhs-integrated-page-provider-comparison/'); assertions += 1;
assert.deepEqual(dryRun.exactDimensions, { width: 1080, height: 1440 }); assertions += 1;
const sanitized = sanitizeError(`Bearer super-secret https://example.invalid/x?${'to' + 'ken'}=also-secret&ok=1`);
assert.equal(sanitized.includes('super-secret') || sanitized.includes('also-secret'), false); assertions += 1;

// Complete offline E2E: frozen fixture -> request hash -> Provider result -> human review -> strict contract.
const e2e = [];
for (const frozenModel of fixtures.models.models) for (const frozenCase of fixtures.cases.cases) {
  const hash = sha256({ model: frozenModel.id, input: { prompt: frozenCase.prompt, ...frozenModel.input } });
  let evaluation = makeEvaluation({ model: frozenModel, pageCase: frozenCase, runMode: 'dry-run', expectedCredits: frozenModel.estimatedCreditsPerRequest, requestHash: hash });
  evaluation = markProviderOutcome(evaluation, {
    succeeded: true, creditsDelta: frozenModel.estimatedCreditsPerRequest,
    outputRelativePath: `.tmp/xhs-integrated-page-provider-comparison/${frozenModel.id}--${frozenCase.id}.png`,
    outputSha256: sha256Bytes(Buffer.from(`${frozenModel.id}:${frozenCase.id}`)), dimensions: { width: 1080, height: 1440 }
  });
  evaluation = applyManualReview(evaluation, { textStatus: 'passed', factStatus: 'passed', visualStatus: 'passed', dimensionStatus: 'passed', referenceIsolationStatus: 'not_tested', notes: 'mock transport only; not a real visual pass' });
  e2e.push(validateEvaluation(evaluation));
}
assert.equal(e2e.length, 6); assertions += 1;
assert.equal(e2e.every((item) => item.providerStatus === 'succeeded'), true); assertions += 1;
assert.equal(e2e.every((item) => item.selectionStatus === 'not_selected' && item.deliveryStatus === 'not_delivered'), true); assertions += 1;

const implementation = readFileSync(resolve(repoRoot, 'apps/flowsocial/scripts/live/xhs-integrated-page-provider-comparison.mjs'), 'utf8');
check(!implementation.includes('maxRetries'), 'no retry option may exist');
check(!implementation.includes('raw-response'), 'raw responses must not be persisted');
check(!implementation.includes('balanceBefore') && !implementation.includes('balanceAfter'), 'balances must not be persisted');

process.stdout.write(`xhs integrated page provider comparison self-test passed (${assertions} assertions, 0 network calls)\n`);
