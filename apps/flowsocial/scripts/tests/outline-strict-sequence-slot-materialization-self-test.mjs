import assert from "node:assert/strict";
import { hashUnifiedContent } from "../../content-agent/unified-content-contracts.mjs";
import {
  createContentOutlineStrictSequenceContract,
  materializeContentMasterSemanticAuthority,
  materializeContentOutlineSemanticAuthority
} from "../../content-agent/unified-skill-output-contracts.mjs";

const clone = structuredClone;

function masterFixture(ids, mode = "strict") {
  const requiredUnits = ids.map((id) => ({ id, meaning: `Meaning ${id}`, boundary: `Boundary ${id}` }));
  const intentBase = {
    id: `intent:${ids.join("-")}:${mode}`,
    structureType: "ordered_framework",
    requiredUnits,
    optionalUnits: [],
    orderingPolicy: { mode, unitOrder: clone(ids) }
  };
  const intent = { ...intentBase, intentHash: hashUnifiedContent(intentBase) };
  return materializeContentMasterSemanticAuthority({
    content_master_id: `master:${ids.join("-")}:${mode}`,
    confirmed_facts: [], supported_interpretations: [], author_opinions: [], source_list: [],
    semanticUnitIds: clone(ids)
  }, intent);
}

function section(sectionId, role, masterUnitIds, sequencePlacement) {
  const value = {
    section_id: sectionId,
    heading: `Heading ${sectionId}`,
    role,
    objective: `Objective ${sectionId}`,
    key_points: [], claim_ids: [], boundary: `Boundary ${sectionId}`,
    sequencePlacement: clone(sequencePlacement)
  };
  if (masterUnitIds !== undefined) value.masterUnitIds = clone(masterUnitIds);
  return value;
}

function rawOutline(sections, suffix = "fixture") {
  return {
    outline_id: `outline:${suffix}`, schema_version: "1.0", platform: "xiaohongshu",
    topic: "Runtime-issued strict sequence", content_promise: "Fill trusted slots without narrative repair.",
    content_function: "authority", content_purpose_id: "knowledge_howto", conversion_stage_id: "consideration",
    opening_strategy: "Use the issued opening anchor.", sections,
    closing_strategy: "Request confirmation.", unresolved_questions: [], confirmation_required: true
  };
}

const fourMaster = masterFixture(["business", "knowledge", "workflow", "iteration"]);
const fourContract = createContentOutlineStrictSequenceContract(fourMaster);
assert.equal(fourContract.slots.length, 4);
assert.equal(fourContract.supplementalAnchors.length, 5);
assert.equal(fourContract.contractHash, hashUnifiedContent({
  schemaVersion: fourContract.schemaVersion,
  contract: fourContract.contract,
  semanticSpineRef: fourContract.semanticSpineRef,
  slots: fourContract.slots,
  supplementalAnchors: fourContract.supplementalAnchors
}));

const fourRaw = rawOutline([
  section("S0", "hook", undefined, { kind: "supplemental", anchorId: "supplemental-anchor:0" }),
  section("S1", "problem", undefined, { kind: "core", slotIds: ["core-slot:1"] }),
  section("S2", "evidence", undefined, { kind: "core", slotIds: ["core-slot:1"] }),
  section("S3", "example", undefined, { kind: "supplemental", anchorId: "supplemental-anchor:1" }),
  section("S4", "method", undefined, { kind: "core", slotIds: ["core-slot:2", "core-slot:3"] }),
  section("S5", "boundary", undefined, { kind: "supplemental", anchorId: "supplemental-anchor:3" }),
  section("S6", "action", undefined, { kind: "core", slotIds: ["core-slot:4"] }),
  section("S7", "action", undefined, { kind: "supplemental", anchorId: "supplemental-anchor:4" })
], "four");
const fourBefore = clone(fourRaw);
const fourRawHash = hashUnifiedContent({ status: "ready", data: fourRaw, warnings: [], blocked_reasons: [] });
const fourCanonical = materializeContentOutlineSemanticAuthority(fourRaw, fourMaster, fourContract);
assert.deepEqual(fourRaw, fourBefore, "strict sequence materialization must preserve raw Provider evidence");
assert.equal(hashUnifiedContent({ status: "ready", data: fourRaw, warnings: [], blocked_reasons: [] }), fourRawHash, "raw Provider evidence must remain hash-bound");
assert.deepEqual(fourCanonical.sections.map((item) => item.section_id), fourRaw.sections.map((item) => item.section_id), "runtime must not post-hoc sort authored sections");
assert.deepEqual(fourCanonical.sections.map((item) => item.adaptationType), ["supplemental", "split", "split", "supplemental", "merge", "supplemental", "direct", "supplemental"]);
assert.deepEqual(fourCanonical.sections[4].masterUnitRefs, fourContract.slots.slice(1, 3).map((slot) => slot.masterUnitRef));
assert.ok(fourRaw.sections.every((item) => !Object.hasOwn(item, "masterUnitIds")), "strict raw sections may omit redundant unit ids");

const legacyExactRaw = clone(fourRaw);
legacyExactRaw.sections.forEach((item) => {
  item.masterUnitIds = item.sequencePlacement.kind === "core"
    ? item.sequencePlacement.slotIds.map((slotId) => fourContract.slots.find((slot) => slot.slotId === slotId).masterUnitRef.id)
    : [];
});
assert.deepEqual(
  materializeContentOutlineSemanticAuthority(legacyExactRaw, fourMaster, fourContract),
  fourCanonical,
  "exact legacy strict unit ids remain compatible"
);

const fiveMaster = masterFixture(["one", "two", "three", "four", "five"]);
const fiveContract = createContentOutlineStrictSequenceContract(fiveMaster);
const fiveRaw = rawOutline(fiveContract.slots.map((slot) => section(
  `N${slot.order + 1}`,
  slot.order === 4 ? "action" : "method",
  undefined,
  { kind: "core", slotIds: [slot.slotId] }
)), "five");
assert.deepEqual(
  materializeContentOutlineSemanticAuthority(fiveRaw, fiveMaster, fiveContract).sections.map((item) => item.masterUnitRefs[0].id),
  ["one", "two", "three", "four", "five"],
  "non-four-unit strict fixtures must remain generic"
);

function assertSequenceFailure(label, mutate, causeCode, fieldPaths) {
  const candidate = clone(fourRaw);
  mutate(candidate);
  assert.throws(
    () => materializeContentOutlineSemanticAuthority(candidate, fourMaster, fourContract),
    (error) => {
      assert.equal(error.code, "UNIFIED_CONTENT_SEMANTIC_SPINE_INVALID");
      assert.equal(error.causeCode, causeCode);
      assert.deepEqual(error.details.fieldPaths, fieldPaths);
      return true;
    },
    label
  );
}

assertSequenceFailure("missing placement", (value) => { delete value.sections[1].sequencePlacement; }, "OUTLINE_SEQUENCE_PLACEMENT_MISSING", ["data.sections[].sequencePlacement"]);
assertSequenceFailure("duplicate slot", (value) => { value.sections[4].sequencePlacement.slotIds = ["core-slot:2", "core-slot:2"]; }, "OUTLINE_SEQUENCE_SLOT_DUPLICATE", ["data.sections[].sequencePlacement.slotIds"]);
assertSequenceFailure("unknown slot", (value) => { value.sections[4].sequencePlacement.slotIds = ["invented-slot"]; }, "OUTLINE_SEQUENCE_SLOT_UNKNOWN", ["data.sections[].sequencePlacement.slotIds"]);
assertSequenceFailure("out-of-range slot", (value) => { value.sections[4].sequencePlacement.slotIds = ["core-slot:99"]; }, "OUTLINE_SEQUENCE_SLOT_OUT_OF_RANGE", ["data.sections[].sequencePlacement.slotIds"]);
assertSequenceFailure("non-contiguous group", (value) => { value.sections[4].sequencePlacement.slotIds = ["core-slot:2", "core-slot:4"]; }, "OUTLINE_SEQUENCE_GROUP_NON_CONTIGUOUS", ["data.sections[].sequencePlacement.slotIds"]);
assertSequenceFailure("unit mapping conflict", (value) => { value.sections[4].masterUnitIds = ["knowledge"]; }, "OUTLINE_SEQUENCE_UNIT_MAPPING_CONFLICT", ["data.sections[].sequencePlacement", "data.sections[].masterUnitIds"]);
for (const [label, supplied] of [
  ["null unit mapping", null],
  ["malformed unit mapping", "knowledge"],
  ["non-string unit mapping", ["knowledge", null]],
  ["duplicate unit mapping", ["knowledge", "knowledge"]],
  ["unknown unit mapping", ["knowledge", "unknown"]]
]) {
  assertSequenceFailure(label, (value) => { value.sections[4].masterUnitIds = supplied; }, "OUTLINE_SEQUENCE_UNIT_MAPPING_CONFLICT", ["data.sections[].sequencePlacement", "data.sections[].masterUnitIds"]);
}
assertSequenceFailure("supplemental unit mapping conflict", (value) => { value.sections[3].masterUnitIds = ["business"]; }, "OUTLINE_SEQUENCE_UNIT_MAPPING_CONFLICT", ["data.sections[].sequencePlacement", "data.sections[].masterUnitIds"]);
assertSequenceFailure("unknown anchor", (value) => { value.sections[3].sequencePlacement.anchorId = "supplemental-anchor:99"; }, "OUTLINE_SEQUENCE_ANCHOR_UNKNOWN", ["data.sections[].sequencePlacement.anchorId"]);
assertSequenceFailure("section fill order", (value) => { [value.sections[1], value.sections[4]] = [value.sections[4], value.sections[1]]; }, "OUTLINE_SEQUENCE_PLACEMENT_ORDER_INVALID", ["data.sections[].sequencePlacement"]);
assertSequenceFailure("anchor inside merge", (value) => { value.sections[5].sequencePlacement.anchorId = "supplemental-anchor:2"; }, "OUTLINE_SEQUENCE_PLACEMENT_ORDER_INVALID", ["data.sections[].sequencePlacement"]);

const tamperedContract = clone(fourContract);
tamperedContract.slots[0].masterUnitRef.hash = "0".repeat(64);
assert.throws(
  () => materializeContentOutlineSemanticAuthority(fourRaw, fourMaster, tamperedContract),
  (error) => error.causeCode === "OUTLINE_SEQUENCE_CONTRACT_INVALID" && error.details.fieldPaths[0] === "input.strict_sequence_contract"
);

const flexibleMaster = masterFixture(["alpha", "beta", "gamma"], "flexible");
assert.equal(createContentOutlineStrictSequenceContract(flexibleMaster), null);
const flexibleRaw = rawOutline([
  section("F1", "method", ["gamma"], undefined),
  section("F2", "method", ["alpha"], undefined),
  section("F3", "action", ["beta"], undefined)
], "flexible");
flexibleRaw.sections.forEach((item) => { delete item.sequencePlacement; });
assert.doesNotThrow(() => materializeContentOutlineSemanticAuthority(flexibleRaw, flexibleMaster));

const historicalRaw = clone(fourRaw);
historicalRaw.sections.forEach((item) => { delete item.sequencePlacement; });
assert.throws(
  () => materializeContentOutlineSemanticAuthority(historicalRaw, fourMaster),
  (error) => error.causeCode === "OUTLINE_MASTER_UNIT_IDS_INVALID",
  "historical strict no-sequence raw sections retain the prior unit-id requirement"
);
const historicalLegacyRaw = clone(legacyExactRaw);
historicalLegacyRaw.sections.forEach((item) => { delete item.sequencePlacement; });
assert.doesNotThrow(() => materializeContentOutlineSemanticAuthority(historicalLegacyRaw, fourMaster), "historical strict no-sequence input with unit ids remains compatible");

console.log(JSON.stringify({
  status: "outline-strict-sequence-slot-materialization-self-test passed",
  fixtures: ["strict-four-unit", "strict-five-unit", "flexible", "historical-no-sequence"],
  postHocSectionSorts: 0, semanticRepairs: 0, retries: 0,
  realProviderCalls: 0, externalApiCalls: 0, activeDatabaseWrites: 0, browserCalls: 0,
  platformWrites: 0, publicationWrites: 0, feedbackWrites: 0
}, null, 2));
