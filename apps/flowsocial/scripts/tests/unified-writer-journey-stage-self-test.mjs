import assert from "node:assert/strict";
import { projectedJourneyStage } from "../../content-agent/unified-content-server-adapter.mjs";

assert.equal(projectedJourneyStage("discovery_and_validation"), "discover");
assert.equal(projectedJourneyStage("primary"), "discover");
assert.equal(projectedJourneyStage("authority_and_conversion"), "convert");
assert.equal(projectedJourneyStage("主运营账号"), "discover");
assert.equal(projectedJourneyStage("信任沉淀账号"), "trust");
assert.equal(projectedJourneyStage("转化承接账号"), "convert");
assert.equal(projectedJourneyStage("协同账号"), "understand");
assert.equal(projectedJourneyStage(null), null);

console.log("unified writer journey-stage self-test passed");
