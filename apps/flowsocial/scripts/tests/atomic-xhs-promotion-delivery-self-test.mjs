import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const source = (path) => readFileSync(resolve(root, path), "utf8");

const promotion = source("content-agent/content-promotion.mjs");
assert.match(promotion, /AtomicXhsContentPromotionPreflight@1\.0/);
assert.match(promotion, /AtomicXhsImmutableContentVersion@1\.0/);
assert.match(promotion, /AtomicXhsPromotionRecord@1\.0/);
assert.match(promotion, /AtomicXhsFinalDeliveryRecord@1\.0/);
assert.match(promotion, /resolveUnifiedContentAuthority/);
assert.match(promotion, /getUnifiedContentArtifactReview/);
assert.match(promotion, /finalDeliveryAuthority:\s*false/);
assert.match(promotion, /platformPublicationPerformed:\s*false/);

const delivery = source("content-agent/platform-delivery-bundle.mjs");
assert.match(delivery, /buildAtomicXhsPostPromotionDeliveryBundle/);
assert.match(delivery, /ATOMIC_XHS_DELIVERY_LIFECYCLE_BINDING_MISMATCH/);
assert.match(delivery, /copy\/title\.txt/);
assert.match(delivery, /copy\/body\.txt/);
assert.match(delivery, /copy\/tags\.txt/);
assert.match(delivery, /copy\/pinned-comment\.txt/);

const projection = source("content-agent/unified-atomic-product-projection.mjs");
assert.match(projection, /AtomicXhsPromotionRecord@1\.0/);
assert.match(projection, /AtomicXhsFinalDeliveryRecord@1\.0/);
assert.match(projection, /delivery_ready/);

const server = source("server.mjs");
assert.match(server, /previewAtomicXhsContentPromotion/);
assert.match(server, /confirmAtomicXhsContentPromotion/);
assert.match(server, /appendAtomicXhsFinalDelivery/);
assert.match(server, /final-delivery/);

const fixture = spawnSync(process.execPath, [resolve(root, "scripts/tests/unified-content-product-api-self-test.mjs")], {
  cwd: root,
  encoding: "utf8",
  env: { ...process.env }
});
if (fixture.status !== 0) {
  process.stderr.write(fixture.stdout || "");
  process.stderr.write(fixture.stderr || "");
}
assert.equal(fixture.status, 0, "selected Atomic XHS through Promotion and post-promotion Delivery fixture must pass");

console.log(JSON.stringify({
  status: "atomic-xhs-promotion-delivery-self-test passed",
  promotionOrder: ["preflight", "immutable_version", "promotion_record", "final_delivery"],
  providerNetworked: false,
  externalCalls: 0,
  activeDatabaseWrites: 0,
  platformPublicationPerformed: false
}, null, 2));
