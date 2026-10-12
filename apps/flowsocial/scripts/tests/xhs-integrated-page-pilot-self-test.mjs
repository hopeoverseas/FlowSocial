import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { encodeRgbaPng, solidRgbaPng } from '../../image-providers/xhs-integrated-page/png-normalizer.mjs';
import {
  adapt05EReadOnly, applyCostOutcome, applyManualReview, buildReferencePng, evaluationHash, executeLiveCases, fixtureDir, loadFixtures, makeEvaluation, outputDir, pollTask,
  repoRoot, runDryRun, sanitizeError, sha256, stableStringify, validateEvaluation, validateFrozenFixtures, validateIsolation
} from '../live/xhs-integrated-page-pilot.mjs';

let assertions = 0;
const ok = (value, message) => { assert.ok(value, message); assertions += 1; };
const equal = (actual, expected, message) => { assert.deepEqual(actual, expected, message); assertions += 1; };
const throws = (fn, pattern, message) => { assert.throws(fn, pattern, message); assertions += 1; };
const rejects = async (fn, pattern, message) => { await assert.rejects(fn, pattern, message); assertions += 1; };

const fixtures = loadFixtures();
const budget = validateFrozenFixtures(fixtures);
equal(budget.projectedCalls, 4); equal(budget.projectedCredits, 32); equal(budget.referenceSha256, fixtures.reference.expectedPngSha256);
equal(sha256(buildReferencePng(fixtures.reference)), fixtures.reference.expectedPngSha256); equal(fixtures.pilot.model.id, 'nano-banana-2'); equal(fixtures.pilot.automaticRetries, 0);
equal(fixtures.cases.cases.length, 4); equal(fixtures.cases.cases.filter((item) => item.referenceAssetId).length, 1); equal(fixtures.pilot.productionWrites, false);

const priceTamper = structuredClone(fixtures); priceTamper.pilot.model.priceUsdPerImage1K = 0.045;
throws(() => validateFrozenFixtures(priceTamper), /Expected values to be strictly equal|strictly equal/);
const budgetTamper = structuredClone(fixtures); budgetTamper.pilot.maxTotalCredits = 31;
throws(() => validateFrozenFixtures(budgetTamper), /falsy|false/);
const retryTamper = structuredClone(fixtures); retryTamper.pilot.automaticRetries = 1;
throws(() => validateFrozenFixtures(retryTamper), /Expected values to be strictly equal|strictly equal/);
const providerTamper = structuredClone(fixtures); providerTamper.pilot.model.id = 'other-model';
throws(() => validateFrozenFixtures(providerTamper), /Expected values to be strictly equal|strictly equal/);
const capabilityTamper = structuredClone(fixtures); capabilityTamper.pilot.model.referenceCapability.status = 'unknown';
throws(() => validateFrozenFixtures(capabilityTamper), /Expected values to be strictly equal|strictly equal/);
const authorizationTamper = structuredClone(fixtures); authorizationTamper.reference.decision = 'approved';
throws(() => validateFrozenFixtures(authorizationTamper), /Expected values to be strictly equal|strictly equal/);
const referenceHashTamper = structuredClone(fixtures); referenceHashTamper.reference.expectedPngSha256 = '0'.repeat(64);
throws(() => validateFrozenFixtures(referenceHashTamper), /reference asset bytes changed/);

const pageCase = fixtures.cases.cases[0];
const evaluation = makeEvaluation({ fixtures, pageCase, runMode: 'dry-run', requestHash: sha256({ test: true }), now: '2026-08-03T00:00:00.000Z' });
equal(validateEvaluation(evaluation), evaluation); equal(evaluation.providerStatus, 'pending'); equal(evaluation.selectionStatus, 'not_selected'); equal(evaluation.deliveryStatus, 'not_delivered'); equal(evaluation.productionStatus, 'disabled');
const unknownField = { ...evaluation, surprise: true }; unknownField.evaluationHash = evaluationHash(unknownField);
throws(() => validateEvaluation(unknownField), /evaluation fields changed/);
const providerShortcut = structuredClone(evaluation); providerShortcut.providerStatus = 'succeeded'; providerShortcut.evaluationHash = evaluationHash(providerShortcut);
throws(() => validateEvaluation(providerShortcut), /nativeAsset/);
const selectionTamper = structuredClone(evaluation); selectionTamper.selectionStatus = 'selected'; selectionTamper.evaluationHash = evaluationHash(selectionTamper);
throws(() => validateEvaluation(selectionTamper), /Expected values to be strictly equal|strictly equal/);
const hashTamper = structuredClone(evaluation); hashTamper.textStatus = 'passed';
throws(() => validateEvaluation(hashTamper), /evaluation hash mismatch/);

const referenceCase = fixtures.cases.cases[3];
const referenceEvaluation = makeEvaluation({ fixtures, pageCase: referenceCase, runMode: 'dry-run', requestHash: sha256('reference') });
equal(referenceEvaluation.referenceIsolationStatus, 'pending'); equal(referenceEvaluation.evidence.reference.sourceSha256, fixtures.reference.expectedPngSha256);
const missingReference = structuredClone(referenceEvaluation); missingReference.evidence.reference = null; missingReference.evaluationHash = evaluationHash(missingReference);
throws(() => validateEvaluation(missingReference), /evidence.reference/);

const baselineBefore = stableStringify(fixtures.baseline05E); const projected = adapt05EReadOnly(fixtures.baseline05E, fixtures);
equal(stableStringify(fixtures.baseline05E), baselineBefore); equal(projected.providerStatus, 'succeeded'); equal(projected.providerNativeDimensionStatus, 'failed'); equal(projected.finalCanvasStatus, 'pending'); equal(projected.referenceIsolationStatus, 'not_tested'); equal(projected.selectionStatus, 'not_selected');
ok(projected.blockers.includes('05E_READ_ONLY_BASELINE_NO_NORMALIZATION_OR_05F_GATES'));

const sanitized = sanitizeError('Bearer secret-token?token=abc task_123456'); ok(!sanitized.includes('secret-token')); ok(!sanitized.includes('task_123456'));
await rejects(() => pollTask('redacted', 'redacted', { maxPolls: 2, intervalMs: 0, transport: async () => ({ data: { state: 'waiting' } }) }), /KIE_POLL_LIMIT_REACHED/);
let pollCount = 0; const terminal = await pollTask('redacted', 'redacted', { maxPolls: 3, intervalMs: 0, transport: async () => ({ data: { state: ++pollCount === 2 ? 'success' : 'generating', resultJson: '{}' } }) });
equal(terminal.state, 'success'); equal(pollCount, 2);
await rejects(() => pollTask('redacted', 'redacted', { maxPolls: 3, intervalMs: 0, transport: async () => ({ data: { state: 'fail', failCode: 'FIXTURE' } }) }), /KIE_TASK_FAILED_FIXTURE/);

equal(validateIsolation(), true);
throws(() => validateIsolation(resolve(repoRoot, 'apps')), /not git ignored/);

const originalFetch = globalThis.fetch; let networkCalls = 0; globalThis.fetch = async () => { networkCalls += 1; throw new Error('NETWORK_FORBIDDEN_IN_DRY_RUN'); };
const dry = await runDryRun(); globalThis.fetch = originalFetch;
equal(networkCalls, 0); equal(dry.mode, 'dry-run'); equal(dry.model, 'nano-banana-2'); equal(dry.cases.map((item) => item.id), ['cover', 'three-point-list', 'process-page', 'reference-isolation']);
ok(dry.cases.every((item) => item.candidates === 1)); equal(dry.estimatedCreditsPerRequest, 8); equal(dry.estimatedTotalCredits, 32); equal(dry.automaticRetries, 0); equal(dry.productionWrites, false); equal(dry.actualPaidRequests, 0);

mkdirSync(outputDir, { recursive: true });
const nativePath = resolve(outputDir, 'self-test.native.png'); const normalizedPath = resolve(outputDir, 'self-test.normalized.png');
const nativeBytes = solidRgbaPng(1080, 1440, [244, 241, 233, 255]); const normalizedBytes = solidRgbaPng(1080, 1440, [24, 83, 70, 255]); writeFileSync(nativePath, nativeBytes); writeFileSync(normalizedPath, normalizedBytes);
const artifactEvaluation = structuredClone(evaluation); artifactEvaluation.providerStatus = 'succeeded'; artifactEvaluation.providerNativeDimensionStatus = 'passed'; artifactEvaluation.normalizationStatus = 'succeeded'; artifactEvaluation.finalCanvasStatus = 'passed'; artifactEvaluation.costStatus = 'measured'; artifactEvaluation.evidence.actualCreditsDelta = 8;
artifactEvaluation.evidence.nativeAsset = { relativePath: '.tmp/xhs-integrated-page-pilot/self-test.native.png', sha256: sha256(nativeBytes), bytes: nativeBytes.length, dimensions: { width: 1080, height: 1440 } };
artifactEvaluation.evidence.normalization = { relativePath: '.tmp/xhs-integrated-page-pilot/self-test.normalized.png', sha256: sha256(normalizedBytes), bytes: normalizedBytes.length, dimensions: { width: 1080, height: 1440 }, recordHash: 'a'.repeat(64), mode: 'none' };
artifactEvaluation.evaluationHash = evaluationHash(artifactEvaluation); equal(validateEvaluation(artifactEvaluation, { verifyArtifacts: true }), artifactEvaluation);
const invalidMeasuredOverage = structuredClone(artifactEvaluation); invalidMeasuredOverage.evidence.actualCreditsDelta = 9; invalidMeasuredOverage.evaluationHash = evaluationHash(invalidMeasuredOverage);
throws(() => validateEvaluation(invalidMeasuredOverage, { verifyArtifacts: true }), /measured cost exceeds per-request limit/);
const blockedOverage = applyCostOutcome(artifactEvaluation, { creditsDelta: 9 }); equal(blockedOverage.providerStatus, 'succeeded'); equal(blockedOverage.costStatus, 'blocked'); equal(blockedOverage.evidence.actualCreditsDelta, 9); ok(blockedOverage.blockers.includes('ACTUAL_CREDITS_PER_REQUEST_EXCEEDED')); equal(validateEvaluation(blockedOverage, { verifyArtifacts: true }), blockedOverage);
const reviewed = applyManualReview(artifactEvaluation, { textStatus: 'failed', factStatus: 'passed', visualStatus: 'review_required', referenceIsolationStatus: 'not_applicable', observedText: ['一周内客计划'], extraText: [], factObservations: ['无额外事实'], visualObservations: ['层级需人工复核'], notes: '人工逐项核对；Provider 成功未覆盖 Gate。' });
equal(reviewed.providerStatus, 'succeeded'); equal(reviewed.textStatus, 'failed'); equal(reviewed.factStatus, 'passed'); equal(reviewed.visualStatus, 'review_required'); equal(reviewed.selectionStatus, 'not_selected'); ok(reviewed.blockers.includes('TEXT_GATE_FAILED'));
const originalNormalized = readFileSync(normalizedPath); writeFileSync(normalizedPath, encodeRgbaPng(1080, 1440, Buffer.alloc(1080 * 1440 * 4, 127)));
throws(() => validateEvaluation(reviewed, { verifyArtifacts: true }), /artifact (byte count|SHA-256) mismatch/); writeFileSync(normalizedPath, originalNormalized);
const reviewHashTamper = structuredClone(reviewed); reviewHashTamper.evidence.gateReview.reviewedNativeSha256 = '0'.repeat(64); reviewHashTamper.evaluationHash = evaluationHash(reviewHashTamper);
throws(() => validateEvaluation(reviewHashTamper, { verifyArtifacts: true }), /Expected values to be strictly equal|strictly equal/);

const simulatedFixtures = structuredClone(fixtures); simulatedFixtures.cases.cases = [
  { ...structuredClone(fixtures.cases.cases[0]), id: 'self-test-post-cost-query' },
  { ...structuredClone(fixtures.cases.cases[1]), id: 'self-test-must-not-run' }
];
const simulatedNativePath = resolve(outputDir, 'self-test-post-cost-query.native.png'); const simulatedNormalizedPath = resolve(outputDir, 'self-test-post-cost-query.normalized.png');
let creditQueries = 0; let providerCalls = 0; const persisted = [];
const simulated = await executeLiveCases({
  fixtures: simulatedFixtures, apiKey: 'offline-redacted', referenceUrl: null,
  operations: {
    credits: async () => { creditQueries += 1; if (creditQueries === 1) return 100; throw new Error('OFFLINE_POST_QUERY_FAILURE'); },
    createTask: async () => { providerCalls += 1; return 'offline-task'; }, pollTask: async () => ({ state: 'success' }), outputUrl: () => 'offline-result', downloadPng: async () => nativeBytes
  },
  artifactWriter: (page) => {
    writeFileSync(simulatedNativePath, nativeBytes); writeFileSync(simulatedNormalizedPath, normalizedBytes);
    return { nativeRelativePath: `.tmp/xhs-integrated-page-pilot/${page.id}.native.png`, normalized: { record: { status: 'succeeded', outputAsset: { relativePath: `.tmp/xhs-integrated-page-pilot/${page.id}.normalized.png`, sha256: sha256(normalizedBytes), bytes: normalizedBytes.length, dimensions: { width: 1080, height: 1440 } }, recordHash: 'b'.repeat(64), mode: 'none', blockers: [] }, outputBuffer: normalizedBytes, finalCanvasStatus: 'passed' } };
  },
  evaluationWriter: (value) => { validateEvaluation(value, { verifyArtifacts: true }); persisted.push(value); }
});
equal(providerCalls, 1); equal(creditQueries, 2); equal(simulated.actualPaidRequests, 1); equal(simulated.evaluations.length, 1); equal(persisted.length, 1); equal(simulated.evaluations[0].providerStatus, 'succeeded'); equal(simulated.evaluations[0].providerNativeDimensionStatus, 'passed'); equal(simulated.evaluations[0].normalizationStatus, 'succeeded'); equal(simulated.evaluations[0].finalCanvasStatus, 'passed'); equal(simulated.evaluations[0].costStatus, 'blocked'); equal(simulated.evaluations[0].evidence.actualCreditsDelta, null); ok(simulated.evaluations[0].blockers.some((item) => item.startsWith('POST_CALL_CREDITS_QUERY_FAILED_'))); ok(simulated.stoppedBy.startsWith('POST_CALL_CREDITS_QUERY_FAILED_'));
rmSync(simulatedNativePath); rmSync(simulatedNormalizedPath);

let overageCreditQueries = 0; let overageProviderCalls = 0;
const overageExecution = await executeLiveCases({
  fixtures: simulatedFixtures, apiKey: 'offline-redacted', referenceUrl: null,
  operations: {
    credits: async () => (++overageCreditQueries % 2 === 1 ? 100 : 91), createTask: async () => { overageProviderCalls += 1; return 'offline-task'; },
    pollTask: async () => ({ state: 'success' }), outputUrl: () => 'offline-result', downloadPng: async () => nativeBytes
  },
  artifactWriter: (page) => {
    writeFileSync(simulatedNativePath, nativeBytes); writeFileSync(simulatedNormalizedPath, normalizedBytes);
    return { nativeRelativePath: `.tmp/xhs-integrated-page-pilot/${page.id}.native.png`, normalized: { record: { status: 'succeeded', outputAsset: { relativePath: `.tmp/xhs-integrated-page-pilot/${page.id}.normalized.png`, sha256: sha256(normalizedBytes), bytes: normalizedBytes.length, dimensions: { width: 1080, height: 1440 } }, recordHash: 'c'.repeat(64), mode: 'none', blockers: [] }, outputBuffer: normalizedBytes, finalCanvasStatus: 'passed' } };
  }, evaluationWriter: (value) => validateEvaluation(value, { verifyArtifacts: true })
});
equal(overageProviderCalls, 1); equal(overageCreditQueries, 2); equal(overageExecution.actualPaidRequests, 1); equal(overageExecution.actualCreditsDelta, 9); equal(overageExecution.stoppedBy, 'ACTUAL_CREDITS_PER_REQUEST_EXCEEDED'); equal(overageExecution.evaluations[0].providerStatus, 'succeeded'); equal(overageExecution.evaluations[0].costStatus, 'blocked'); equal(overageExecution.evaluations[0].evidence.actualCreditsDelta, 9); ok(overageExecution.evaluations[0].blockers.includes('ACTUAL_CREDITS_PER_REQUEST_EXCEEDED'));
rmSync(simulatedNativePath); rmSync(simulatedNormalizedPath);

rmSync(nativePath); rmSync(normalizedPath); equal(existsSync(nativePath), false); equal(existsSync(normalizedPath), false);

ok(existsSync(resolve(fixtureDir, 'pilot.json'))); ok(assertions >= 60);
process.stdout.write(`xhs integrated page pilot self-test: ${assertions} assertions passed\n`);
