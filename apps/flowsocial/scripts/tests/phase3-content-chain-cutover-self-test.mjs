import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { adoptOpportunityToUnifiedProject } from "../../content-agent/unified-entry-adoption.mjs";
import { readFrontendSource } from "./helpers/frontend-source.mjs";

const company = { id: "company_phase3", companyId: "company_phase3", accountType: "company", activeStrategySnapshotId: "strategy_phase3" };
const dna = { kind: "DesignDNA", schemaVersion: "1.0", id: "dna_phase3", accountId: "xhs_phase3", version: 1, status: "confirmed", colors: ["#111111"], fontPreferences: ["sans-serif"], layoutPreferences: ["grid"], materials: ["paper"], photographyOrIllustrationDirection: "editorial", forbiddenMotifs: [], confirmation: { decision: "confirmed", confirmedBy: "fixture", confirmedAt: "2026-08-27T00:00:00.000Z" } };
const xhs = { id: "xhs_phase3", companyId: company.id, platform: "xiaohongshu", status: "active", visualStyle: { designDnaSnapshotId: dna.id } };
const wechat = { id: "wechat_phase3", companyId: company.id, platform: "wechat", status: "active" };
const strategy = { id: company.activeStrategySnapshotId, accountId: company.id, status: "active", document: { schemaVersion: "2.0", strategyHotspotPolicy: "optional" } };
const opportunity = { id: "opportunity_phase3", kind: "ContentOpportunity", schemaVersion: "1.0", companyId: company.id, socialAccountId: wechat.id, platform: "wechat", topic: "阶段三统一入口", angle: "验证旧链路不再扩张", status: "ready" };
const store = { accounts: [company, xhs, wechat], designDnaSnapshots: [dna], contentOpportunities: [opportunity] };
const dependencies = { actor: "fixture", at: "2026-08-27T00:10:00.000Z", flags: { unifiedContentPrerequisitesV1: true, unifiedContentStagedAtomicDualBootstrapV1: true }, getActiveStrategySnapshot: () => strategy, listCompanySocialAccounts: () => [xhs, wechat] };
const adopted = adoptOpportunityToUnifiedProject(store, opportunity, dependencies);
assert.equal(adopted.created, true);
assert.equal(store.contentRuns, undefined);
assert.equal(store.contentWorkflows, undefined);
assert.equal(adoptOpportunityToUnifiedProject(store, opportunity, dependencies).created, false);

const [server, app] = await Promise.all([readFile(new URL("../../server.mjs", import.meta.url), "utf8"), readFrontendSource()]);
assert.match(server, /handleRetiredContentRunRoute/);
assert.doesNotMatch(server, /cycleSlotRunMatch|opportunityRunMatch|planItemRunMatch|upstreamRevisionRunMatch/);
assert.match(server, /authority: "unified_atomic", status: "accepted_for_next_cycle"[\s\S]*nextStep: "create_and_confirm_publishing_cycle"/);
assert.match(app, /FlowAPI\.adoptContentOpportunity/);
for (const oldWriter of ["startContentOpportunity", "startPublishingCycleSlot", "startRollingPlanItem", "createStrategyContentRun", "startUpstreamRevisionRun"]) assert.doesNotMatch(app, new RegExp(`FlowAPI\\.${oldWriter}\\(`));
console.log("phase3-content-chain-cutover-self-test: ok");
