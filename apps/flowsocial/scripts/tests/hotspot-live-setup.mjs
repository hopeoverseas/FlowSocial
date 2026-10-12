import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

if (process.env.FLOWSOCIAL_HOTSPOT_LIVE !== "1") {
  throw new Error("Live setup is disabled. Set FLOWSOCIAL_HOTSPOT_LIVE=1 explicitly.");
}
if (!String(process.env.FLOWSOCIAL_DATA_DIR || "").includes("flowsocial-hotspot-live-")) {
  throw new Error("Live setup may only write to a dedicated flowsocial-hotspot-live-* data directory.");
}

const root = fileURLToPath(new URL("../..", import.meta.url));
const payload = JSON.parse(
  await readFile(`${root}/tests/fixtures/demo-data/expected-strategy-snapshot.json`, "utf8")
);
const companyId = process.env.FLOWSOCIAL_LIVE_COMPANY_ID || "account_damaishuzhi";
const socialAccountId = process.env.FLOWSOCIAL_LIVE_SOCIAL_ACCOUNT_ID || "acc_xhs";
payload.accountId = companyId;

const { readStore, writeStore } = await import("../../storage.mjs");
const {
  activateStrategySnapshot,
  getActiveStrategySnapshot,
  saveStrategySnapshot
} = await import("../../strategy-agent/strategy-store.mjs");

const store = readStore();
const socialAccount = store.accounts.find((item) => item.id === socialAccountId);
assert.ok(socialAccount, `Isolated seed account not found: ${socialAccountId}`);
socialAccount.accountType = "social";
socialAccount.socialAccountId = socialAccountId;
socialAccount.workspaceId ||= "workspace_default";
socialAccount.companyId = companyId;
socialAccount.status = "active";
socialAccount.accountIdentity = {
  ...(socialAccount.accountIdentity || {}),
  id: `identity_${socialAccountId}`,
  companyId,
  socialAccountId,
  subjectType: "company_official",
  publicIdentity: "FlowSocial 热点链路隔离验收账号",
  speakerType: "brand_official",
  trustSources: ["professional_knowledge"],
  version: 1
};
socialAccount.accountIdentityId = socialAccount.accountIdentity.id;
socialAccount.subjectType = socialAccount.accountIdentity.subjectType;
socialAccount.speakerType = socialAccount.accountIdentity.speakerType;
if (!store.accounts.some((item) => item.id === companyId)) {
  store.accounts.push({
    id: companyId,
    workspaceId: socialAccount.workspaceId,
    companyId,
    accountType: "company",
    name: "FlowSocial 热点链路隔离验收公司",
    status: "active",
    platform: "multi"
  });
}

let active = getActiveStrategySnapshot(companyId);
if (!active) {
  const draft = saveStrategySnapshot({
    accountId: companyId,
    payload,
    status: "draft",
    metadata: { activationReason: "isolated_live_acceptance_fixture" }
  });
  active = activateStrategySnapshot(draft.id);
}
for (const direction of store.contentDirections || []) {
  direction.companyId = companyId;
  direction.strategySnapshotId = active.id;
}
writeStore(store);

console.log(JSON.stringify({
  kind: "FlowSocialHotspotLiveSetup",
  isolated: true,
  companyId,
  socialAccountId,
  strategySnapshotId: active.id,
  strategyVersion: active.version
}, null, 2));
