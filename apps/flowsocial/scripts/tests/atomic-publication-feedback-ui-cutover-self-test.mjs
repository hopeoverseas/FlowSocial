import { readFrontendSource, readFrontendSourceSync } from "./helpers/frontend-source.mjs";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const dataDir = await mkdtemp(join(tmpdir(), "flowsocial-atomic-publication-ui-"));
process.env.FLOWSOCIAL_DATA_DIR = dataDir;
process.env.FLOWSOCIAL_TEST_MODE = "1";
process.env.FLOWSOCIAL_DISABLE_SERVER_LISTEN = "1";
process.env.ATOMIC_PUBLICATION_FEEDBACK_UI_CUTOVER_V1 = "1";

const [app, html, apiClient, serverSource, flags] = await Promise.all([
  readFrontendSource(), readFile(join(root, "index.html"), "utf8"),
  readFile(join(root, "api-client.js"), "utf8"), readFile(join(root, "server.mjs"), "utf8"),
  readFile(join(root, "feature-flags.mjs"), "utf8")
]);

assert.match(flags, /atomicPublicationFeedbackUiCutoverV1:\s*enabled\("ATOMIC_PUBLICATION_FEEDBACK_UI_CUTOVER_V1", false\)/);
for (const name of [
  "getAtomicPublicationFeedbackControlState", "previewAtomicManualPublication", "confirmAtomicManualPublication",
  "previewAtomicPublicationFeedback", "confirmAtomicPublicationFeedback", "getAtomicPublicationLifecycleState",
  "confirmAtomicPublicationLifecycle"
]) assert.match(apiClient, new RegExp(`${name}:`), `missing Atomic UI client ${name}`);
for (const id of [
  "unifiedPublicationStateGrid", "unifiedPublicationExactRefs", "unifiedPublicationActorId",
  "unifiedFeedbackEvidenceId", "unifiedFeedbackEvidenceHash", "unifiedLifecyclePanel",
  "unifiedLifecycleAction", "unifiedLifecycleManualConfirm", "unifiedRecordLifecycle"
]) assert.match(html, new RegExp(`id="${id}"`), `missing Atomic UI control ${id}`);

const atomicPublication = app.slice(app.indexOf("async function recordUnifiedAtomicManualPublication"), app.indexOf("async function recordUnifiedManualPublicationLegacy"));
const atomicFeedback = app.slice(app.indexOf("async function recordUnifiedAtomicPublicationFeedback"), app.indexOf("async function recordUnifiedPublicationFeedbackLegacy"));
const lifecycle = app.slice(app.indexOf("async function recordUnifiedPublicationLifecycle"), app.indexOf("async function loadUnifiedArtifactReviewProjects"));
for (const source of [atomicPublication, atomicFeedback, lifecycle]) {
  assert.doesNotMatch(source, /recordContentPublication|updateContentPublication|recordPublicationMetrics/);
}
assert.match(atomicPublication, /previewAtomicManualPublication/);
assert.match(atomicPublication, /confirmAtomicManualPublication/);
assert.match(atomicFeedback, /previewAtomicPublicationFeedback/);
assert.match(atomicFeedback, /confirmAtomicPublicationFeedback/);
assert.match(lifecycle, /confirmAtomicPublicationLifecycle/);
assert.match(app, /if \(unifiedArtifactWorkbench\.atomicPublicationCutoverEnabled\) return routeLegacyPublicationEntryToAtomic\(\);/);
assert.match(app, /recordUnifiedManualPublication\(\)[\s\S]*atomicPublicationCutoverEnabled[\s\S]*recordUnifiedAtomicManualPublication/);
assert.match(serverSource, /resourceUploaded[\s\S]*deliveryReady[\s\S]*humanPublicationConfirmed[\s\S]*everPublished[\s\S]*currentPlatformState[\s\S]*currentlyAvailable[\s\S]*feedbackMaturity/);
assert.match(serverSource, /publication-feedback-control-state/);
assert.match(serverSource, /resolveAtomicPublicationUiScope/);
assert.match(serverSource, /platformActionPerformed:\s*false/);

const { server } = await import("../../server.mjs");
const { database, readStore } = await import("../../storage.mjs");
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const base = `http://127.0.0.1:${address.port}/api/v1`;
const before = structuredClone(readStore());
const blocked = [
  ["/content-tasks/nonexistent/publications", "POST", {}],
  ["/content-publications/nonexistent", "PATCH", {}],
  ["/content-publications/nonexistent/metrics", "POST", {}]
];
for (const [path, method, body] of blocked) {
  const response = await fetch(`${base}${path}`, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json();
  assert.equal(response.status, 409, `${method} ${path}: ${JSON.stringify(result)}`);
  assert.equal(result.code, "ATOMIC_PUBLICATION_UI_CUTOVER_REQUIRED");
  assert.deepEqual(readStore(), before, `${method} ${path} must fail before mutation`);
}

process.env.ATOMIC_PUBLICATION_FEEDBACK_UI_CUTOVER_V1 = "0";
const flagOff = await fetch(`${base}/content-tasks/nonexistent/publications`, {
  method: "POST", headers: { "content-type": "application/json" }, body: "{}"
});
assert.equal(flagOff.status, 404, "flag-off must preserve legacy route behavior");
assert.deepEqual(readStore(), before);

process.env.ATOMIC_PUBLICATION_FEEDBACK_UI_CUTOVER_V1 = "1";

const sha = (character) => character.repeat(64);
const projectId = "content_project_atomic_browser_fixture";
const accountId = "account_atomic_browser_fixture";
const companyId = "company_atomic_browser_fixture";
const workspaceId = "workspace_atomic_browser_fixture";
const platformFixtures = {
  xiaohongshu: {
    candidateRef: { id: "candidate_xhs_atomic_browser", hash: sha("a") },
    platformRunRef: { id: "platform_run_xhs_atomic_browser", hash: sha("b") },
    contentId: "0123456789abcdef01234567",
    url: "https://www.xiaohongshu.com/explore/0123456789abcdef01234567"
  },
  wechat: {
    candidateRef: { id: "candidate_wechat_atomic_browser", hash: sha("c") },
    platformRunRef: { id: "platform_run_wechat_atomic_browser", hash: sha("d") },
    contentId: "wechat-article-atomic-browser",
    url: "https://mp.weixin.qq.com/s/wechat-article-atomic-browser"
  }
};
const project = {
  id: projectId,
  workspaceId,
  contentProject: {
    id: projectId, title: "Atomic publication browser fixture", workspaceId, companyId,
    projectHash: sha("e"), strategySnapshotRef: { id: "strategy_atomic_browser", hash: sha("f") },
    contentMasterRef: { id: "master_atomic_browser", hash: sha("1") }
  },
  platforms: Object.entries(platformFixtures).map(([platform, fixture]) => ({
    platform, accountId, platformRunRef: fixture.platformRunRef, candidateRefs: [fixture.candidateRef],
    reviewInput: { input: {} }
  }))
};

function initialControlState(platform) {
  const fixture = platformFixtures[platform];
  const exactRefs = {
    candidateRef: fixture.candidateRef,
    platformRunRef: fixture.platformRunRef,
    promotionRef: { id: `promotion_${platform}_atomic_browser`, hash: sha("2") },
    promotedVersionRef: { id: `version_${platform}_atomic_browser`, hash: sha("3") },
    deliveryRef: { id: `delivery_${platform}_atomic_browser`, hash: sha("4") },
    manifestRef: { id: `manifest_${platform}_atomic_browser`, hash: sha("5") }
  };
  return {
    contract: "AtomicPublicationFeedbackUiState@1.0", platform,
    exactRequest: { workspaceId, companyId, accountId, candidateId: fixture.candidateRef.id, ...exactRefs },
    exactRefs,
    states: {
      resourceUploaded: platform === "wechat", deliveryReady: true, humanPublicationConfirmed: false,
      everPublished: false, currentPlatformState: "not_confirmed", currentlyAvailable: null,
      feedbackMaturity: "not_started"
    },
    publication: null,
    feedback: { items: [] },
    lifecycle: { everPublished: false, currentPlatformState: "not_confirmed", currentlyAvailable: null, lifecycleHeadRef: null }
  };
}

async function runAtomicBrowserProof(origin) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const controls = Object.fromEntries(Object.keys(platformFixtures).map((platform) => [platform, initialControlState(platform)]));
  const publicationRequests = new Map();
  const mutationPaths = [];
  const externalApiRequests = [];
  let blockedExternalAssets = 0;

  const json = (route, value, status = 200) => route.fulfill({
    status, contentType: "application/json; charset=utf-8", body: JSON.stringify(value)
  });
  const routePlatform = (pathname) => pathname.match(/\/platforms\/(xiaohongshu|wechat)\//)?.[1] || "";
  const bodyOf = (request) => {
    try { return request.postDataJSON(); } catch { return {}; }
  };
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin) {
      if (["xhr", "fetch"].includes(request.resourceType())) externalApiRequests.push(request.url());
      else blockedExternalAssets += 1;
      return route.abort();
    }
    if (!url.pathname.startsWith("/api/v1/")) return route.continue();
    const path = url.pathname.slice("/api/v1".length);
    const method = request.method();
    if (method !== "GET") mutationPaths.push(`${method} ${path}`);
    if (path === "/health") return json(route, { featureFlags: {
      unifiedContentArtifactsV1: true, contentPromotionV1: true, atomicPublicationFeedbackUiCutoverV1: true
    } });
    if (path === "/accounts") return json(route, { items: [{
      id: accountId, socialAccountId: accountId, workspaceId, companyId,
      name: "Atomic browser fixture account", platform: "xiaohongshu", businessMode: "enterprise"
    }] });
    if (path === "/unified-content-projects") return json(route, { items: [project] });
    if (path === `/unified-content-projects/${projectId}`) return json(route, { project });
    const platform = routePlatform(path);
    if (platform && path.endsWith("/artifact-review")) return json(route, {
      artifactState: { status: "reviewable", reviewable: true, selectable: false, artifactStateHash: sha("6"), blockers: [] },
      reviewMaterial: platform === "xiaohongshu"
        ? { pages: [], reviewStages: { technicalGate: { status: "passed" }, skillVisualReview: { status: "passed", productionEligible: true }, humanArtifactReview: { status: "pending" } } }
        : { previewArtifact: { semantics: "pre_upload_template_not_wechat_final", previewHtml: "<p>Atomic browser fixture</p>" }, resourceRefs: [], sixGates: [] },
      actionFacts: [], actionStates: []
    });
    if (platform && path.endsWith("/review-state")) return json(route, { reviewFacts: [], selectionFacts: [] });
    if (platform && path.endsWith("/publication-feedback-control-state")) return json(route, controls[platform]);
    if (platform && path.endsWith("/manual-publication-preview")) return json(route, {
      previewToken: `preview-${platform}-atomic-browser`, requestHash: sha("7"),
      claims: { writesPerformed: false, platformPublicationPerformed: false }
    });
    if (platform && path.endsWith("/manual-publication-confirm")) {
      const payload = bodyOf(request);
      const previous = publicationRequests.get(payload.idempotencyKey);
      const signature = JSON.stringify({ ...payload, confirmedAt: undefined });
      if (previous && previous.signature !== signature) return json(route, { code: "IDEMPOTENCY_KEY_REUSED", message: "conflicting replay rejected" }, 409);
      if (previous) return json(route, { created: false, publication: previous.publication });
      const publication = {
        contract: "ControlledManualPublication@1.0", id: `publication_${platform}_atomic_browser`, factHash: sha("8"),
        workspaceId, companyId, accountId, platform, publishedAt: payload.publishedAt,
        canonicalPlatformContentId: payload.platformContentId, canonicalPlatformUrl: payload.platformUrl,
        promotionRef: controls[platform].exactRefs.promotionRef,
        promotedVersionRef: controls[platform].exactRefs.promotedVersionRef
      };
      publicationRequests.set(payload.idempotencyKey, { signature, payload, publication });
      controls[platform].publication = publication;
      Object.assign(controls[platform].states, {
        humanPublicationConfirmed: true, everPublished: true,
        currentPlatformState: "published_available", currentlyAvailable: true
      });
      controls[platform].lifecycle = {
        everPublished: true, currentPlatformState: "published_available", currentlyAvailable: true,
        lifecycleHeadRef: { id: `lifecycle_${platform}_atomic_browser`, hash: sha("9") }
      };
      return json(route, { created: true, publication });
    }
    if (platform && path.endsWith("/exact-feedback-preview")) return json(route, {
      previewToken: `feedback-preview-${platform}-atomic-browser`, requestHash: sha("a"),
      claims: { writesPerformed: false, platformPublicationPerformed: false }
    });
    if (platform && path.endsWith("/exact-feedback-confirm")) {
      const payload = bodyOf(request);
      const snapshot = {
        contract: "PublicationMetricSnapshot@3.0", id: `feedback_${platform}_atomic_browser`, snapshotHash: sha("b"),
        measurementWindow: payload.measurementWindow?.label, cutoffAt: payload.cutoffAt, revision: 1,
        dataQuality: { status: "manual_observation" }, metrics: payload.metrics
      };
      controls[platform].feedback = { items: [snapshot] };
      controls[platform].states.feedbackMaturity = payload.measurementWindow?.label || "recorded";
      return json(route, { created: true, snapshot });
    }
    return json(route, method === "GET" ? { items: [] } : {});
  });

  const selectFixture = async (platform) => {
    await page.evaluate(() => document.querySelector('[data-view-target="artifact-review"]')?.click());
    await page.waitForFunction(() => document.querySelector('[data-view="artifact-review"]')?.classList.contains("active"));
    await page.selectOption("#unifiedArtifactProject", projectId);
    await page.waitForFunction(() => !document.querySelector("#unifiedArtifactPlatform")?.disabled);
    await page.selectOption("#unifiedArtifactPlatform", platform);
    await page.waitForFunction(() => !document.querySelector("#unifiedArtifactCandidate")?.disabled);
    await page.selectOption("#unifiedArtifactCandidate", platformFixtures[platform].candidateRef.id);
    await page.waitForFunction(() => !document.querySelector("#unifiedArtifactWorkspace")?.hidden);
    await page.waitForFunction(() => document.querySelector("#unifiedPublicationStateGrid")?.textContent.includes("deliveryReady"));
  };
  const exercisePlatform = async (platform) => {
    const fixture = platformFixtures[platform];
    await selectFixture(platform);
    const stateBefore = await page.locator("#unifiedPublicationStateGrid").textContent();
    assert.match(stateBefore, /deliveryReady:\s*true/);
    assert.match(stateBefore, /humanPublicationConfirmed:\s*false/);
    assert.match(stateBefore, /feedbackMaturity:\s*not_started/);
    assert.match(await page.locator("#unifiedLifecycleResult").textContent(), /current=not_confirmed/);
    assert.match(await page.locator("#unifiedPublicationExactRefs").textContent(), new RegExp(controls[platform].exactRefs.deliveryRef.id));

    const published = new Date(Date.now() - 10 * 24 * 36e5);
    const cutoff = new Date(published.getTime() + 72 * 36e5);
    const localValue = (date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    await page.fill("#unifiedPublicationActorId", `user:${platform}-publisher`);
    await page.fill("#unifiedPublicationPublishedAt", localValue(published));
    await page.fill("#unifiedPublicationContentId", fixture.contentId);
    await page.fill("#unifiedPublicationUrl", fixture.url);
    await page.check("#unifiedPublicationManualConfirm");
    await page.click("#unifiedRecordPublication");
    await page.waitForFunction((id) => document.querySelector("#unifiedPublicationResult")?.textContent.includes(id), `publication_${platform}_atomic_browser`);
    assert.match(await page.locator("#unifiedPublicationStateGrid").textContent(), /humanPublicationConfirmed:\s*true/);
    assert.match(await page.locator("#unifiedLifecycleResult").textContent(), /current=published_available/);
    assert.match(await page.locator("#unifiedLifecycleResult").textContent(), /available=true/);

    const first = [...publicationRequests.values()].find((entry) => entry.publication.platform === platform);
    assert.ok(first, `${platform} browser confirm request must be captured`);
    const replay = await page.evaluate(async ({ projectId, platform, payload }) => {
      return window.FlowAPI.confirmAtomicManualPublication(projectId, platform, payload);
    }, { projectId, platform, payload: first.payload });
    assert.equal(replay.created, false, `${platform} identical replay must reuse immutable publication`);
    const conflict = await page.evaluate(async ({ projectId, platform, payload }) => {
      try {
        await window.FlowAPI.confirmAtomicManualPublication(projectId, platform, { ...payload, publishedAt: "2026-01-01T00:00:00.000Z" });
        return null;
      } catch (error) { return { status: error.status, code: error.body?.code || error.code, message: error.message }; }
    }, { projectId, platform, payload: first.payload });
    assert.equal(conflict?.status, 409, `${platform} conflicting replay must fail closed`);

    await page.fill("#unifiedFeedbackCutoffAt", localValue(cutoff));
    await page.fill("#unifiedFeedbackViews", "101");
    await page.fill("#unifiedFeedbackLikes", "17");
    await page.fill("#unifiedFeedbackEvidenceId", `evidence_${platform}_atomic_browser`);
    await page.fill("#unifiedFeedbackEvidenceHash", sha("c"));
    await page.click("#unifiedRecordFeedback");
    await page.waitForFunction(() => document.querySelector("#unifiedPublicationStateGrid")?.textContent.includes("feedbackMaturity: 72h"));
    assert.match(await page.locator("#unifiedFeedbackResult").textContent(), /72h/);
    assert.match(await page.locator("#unifiedPublicationStateGrid").textContent(), /feedbackMaturity:\s*72h/);

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.body.dataset.atomicPublicationFeedbackCutover === "enabled");
    await selectFixture(platform);
    assert.match(await page.locator("#unifiedPublicationResult").textContent(), new RegExp(`publication_${platform}_atomic_browser`));
    assert.match(await page.locator("#unifiedFeedbackResult").textContent(), /72h/);
  };

  try {
    await page.goto(origin, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.body.dataset.atomicPublicationFeedbackCutover === "enabled");
    await exercisePlatform("xiaohongshu");
    await exercisePlatform("wechat");
    assert.deepEqual(externalApiRequests, [], "browser proof must not attempt external API calls");
    assert.equal(mutationPaths.some((path) => /\/content-tasks\/.*\/publications|\/content-publications\//.test(path)), false,
      `Atomic workbench must bypass legacy mutation routes: ${mutationPaths.join(", ")}`);
    for (const suffix of ["manual-publication-preview", "manual-publication-confirm", "exact-feedback-preview", "exact-feedback-confirm"])
      assert.ok(mutationPaths.some((path) => path.endsWith(`/${suffix}`)), `browser proof missing Atomic endpoint ${suffix}`);
    return { browserPlatforms: 2, pageReloadRecoveries: 2, idempotentReplays: 2, conflictingReplaysRejected: 2,
      blockedExternalAssets, externalApiCalls: externalApiRequests.length, mutationPaths };
  } finally {
    await browser.close();
  }
}

const browserProof = await runAtomicBrowserProof(`http://127.0.0.1:${address.port}`);

await new Promise((resolve) => server.close(resolve));
database.close();
await rm(dataDir, { recursive: true, force: true });
console.log(JSON.stringify({
  status: "atomic-publication-feedback-ui-cutover-self-test passed",
  legacyWriteRoutesBlockedBeforeMutation: 3,
  exactAtomicUiClients: 7,
  platforms: ["xiaohongshu", "wechat"],
  browserProof,
  providerCalls: 0, browserLogins: 0, externalApiCalls: 0, activeDatabaseWrites: 0, platformActions: 0
}, null, 2));
