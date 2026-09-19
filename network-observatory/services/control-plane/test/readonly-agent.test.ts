import assert from "node:assert/strict";
import test from "node:test";
import { answerAssetQuestion } from "../src/readonly-agent.ts";
import type { Observation } from "../../../packages/contracts/src/index.ts";
const now = new Date("2026-09-18T12:00:00Z");
function observation(observedAt: string): Observation {
  return { id: "sample", tenantId: "tenant", siteId: "site", assetId: "asset", collectorId: "collector", kind: "icmp.reachable", value: false, provenance: "MEASURED", observedAt, receivedAt: observedAt, idempotencyKey: observedAt };
}
test("agent does not treat absent, stale or future observations as current evidence", () => {
  for (const records of [[], [observation("2026-09-18T11:00:00Z")], [observation("2026-09-18T13:00:00Z")]]) {
    const reply = answerAssetQuestion("status", records, now);
    assert.equal(reply.classification, "INDETERMINATE");
    assert.deepEqual(reply.observationIds, []);
    assert.equal(reply.execution, "NONE");
  }
});
test("agent cites fresh records without promoting ping failure or unverified origin to diagnosis", () => {
  const records = [Object.freeze(observation("2026-09-18T11:59:00Z"))];
  const reply = answerAssetQuestion("status", Object.freeze(records), now);
  assert.deepEqual(reply.observationIds, ["sample"]);
  assert.equal(reply.acquisition, "UNVERIFIED");
  assert.equal(reply.classification, "INDETERMINATE");
  assert.match(reply.answer, /não confirma/);
  assert.equal(records[0].value, false);
});
test("agent explains its limits and distinguishes historical references from recent records", () => {
  assert.match(answerAssetQuestion("limits", [], now).answer, /Não executo comandos/);
  const reply = answerAssetQuestion("evidence", [observation("2026-09-18T11:00:00Z")], now);
  assert.deepEqual(reply.observationIds, ["sample"]);
  assert.match(reply.answer, /0 estão dentro/);
});
