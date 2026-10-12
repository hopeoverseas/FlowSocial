import { CONTRACTS, validateProviderCapabilitySnapshot, withComputedHash } from "./contracts.mjs";

export function createProviderCapabilitySnapshot({ id, capabilities }) {
  const base = {
    schemaVersion: "1.0",
    contract: CONTRACTS.providerCapabilitySnapshot,
    id,
    source: "offline_fixture",
    status: "complete",
    productionVerified: false,
    capabilities: structuredClone(capabilities)
  };
  const snapshot = withComputedHash(base, "snapshotHash");
  validateProviderCapabilitySnapshot(snapshot);
  return snapshot;
}
