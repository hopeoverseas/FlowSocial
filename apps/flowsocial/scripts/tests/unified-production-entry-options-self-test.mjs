import { readFrontendSource, readFrontendSourceSync } from "./helpers/frontend-source.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { listUnifiedContentPrerequisites } from "../../content-agent/unified-content-prerequisite-store.mjs";

const hash = (character) => character.repeat(64);
const store = {
  unifiedContentOpportunities: [{
    id: "opportunity:one",
    opportunityHash: hash("1"),
    companyId: "company:one",
    topic: "把 AI 方法写成可执行四步",
    contentObjective: "生成双平台内容",
    activeStrategySnapshotRef: { id: "strategy:active", hash: hash("2") },
    accountRefs: {
      xiaohongshu: { id: "account:xhs", hash: hash("3") },
      wechat: { id: "account:wechat", hash: hash("4") }
    }
  }],
  unifiedContentMechanismDecisions: [{
    id: "mechanism:one",
    decisionHash: hash("5"),
    companyId: "company:one"
  }],
  unifiedContentPrerequisiteRequests: [{
    idempotencyKey: "prerequisite:one",
    semanticHash: hash("6"),
    contentOpportunityRef: { id: "opportunity:one", hash: hash("1") },
    mechanismDecisionRef: { id: "mechanism:one", hash: hash("5") },
    designDnaSnapshotRef: { id: "design-dna:one", hash: hash("7") },
    createdAt: "2026-08-17T00:00:00.000Z"
  }]
};

const result = listUnifiedContentPrerequisites(store, { companyId: "company:one" });
assert.equal(result.entryOptions.length, 1);
assert.deepEqual(result.entryOptions[0], {
  id: `production-entry:${hash("6").slice(0, 24)}`,
  companyId: "company:one",
  topicIntent: { topic: "把 AI 方法写成可执行四步", objective: "生成双平台内容" },
  activeStrategySnapshotRef: { id: "strategy:active", hash: hash("2") },
  prerequisiteRef: { id: "prerequisite:one", hash: hash("6") },
  accounts: {
    xiaohongshu: { id: "account:xhs", hash: hash("3") },
    wechat: { id: "account:wechat", hash: hash("4") }
  },
  authorizationSourceRefs: [{ id: "mechanism:one", hash: hash("5") }],
  mechanismDecisionRef: { id: "mechanism:one", hash: hash("5") },
  designDnaSnapshotRef: { id: "design-dna:one", hash: hash("7") },
  createdAt: "2026-08-17T00:00:00.000Z"
});

assert.equal(listUnifiedContentPrerequisites(store, { companyId: "company:other" }).entryOptions.length, 0);
assert.equal(Object.hasOwn(result.entryOptions[0], "opportunity"), false);

const [html, app, api] = await Promise.all([
  readFile(new URL("../../index.html", import.meta.url), "utf8"),
  readFrontendSource(),
  readFile(new URL("../../api-client.js", import.meta.url), "utf8")
]);
for (const id of ["unifiedProductionAuthority", "unifiedProductionStart", "unifiedProductionOutlines"]) {
  assert.match(html, new RegExp(`id=["']${id}["']`));
}
for (const removedId of ["unifiedProductionConfirm", "unifiedProductionReject", "unifiedProductionPreupload"]) {
  assert.doesNotMatch(html, new RegExp(`id=["']${removedId}["']`));
}
assert.match(app, /data-confirm-platform-outline/);
assert.match(app, /data-resume-platform-production/);
for (const method of ["listUnifiedContentPrerequisites", "createUnifiedContentBootstrap", "confirmUnifiedContentBootstrap", "rejectUnifiedContentBootstrap", "resumeUnifiedContentBootstrap", "createUnifiedWechatPreuploadArtifacts"]) {
  assert.match(api, new RegExp(`${method}:`));
}
assert.match(app, /supersedesBootstrapRef: predecessor\.bootstrapFact\.bootstrapRef/);
assert.match(app, /revisionInstruction: predecessor\.reviewDecision\.explanation/);
assert.match(app, /ui-wechat-preupload-v4:/);
assert.match(app, /imageGeneration\?\.ready === true[\s\S]*Math\.max\(2,[\s\S]*attempt: preuploadAttempt/);
assert.match(app, /禁止盲目重试/);
assert.match(app, /使用原请求键继续生成/);
assert.match(app, /const canResumePriorRequest/);
assert.match(app, /priorRequest\.idempotencyKey/);
assert.match(app, /platforms && typeof platforms === "object"/);
console.log("unified production entry options self-test passed");
