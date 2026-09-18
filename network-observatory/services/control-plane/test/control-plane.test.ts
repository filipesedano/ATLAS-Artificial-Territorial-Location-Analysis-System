import { simulatedPolicy } from "../../../packages/contracts/src/index.ts";
import assert from "node:assert/strict";
import test from "node:test";

import {
  ContractViolation,
  type Asset,
  type Observation,
  type UUID,
} from "../../../packages/contracts/src/index.ts";
import {
  CollectorSimulator,
  InMemoryObservationOutbox,
  SimulatorProbe,
  type ObservationTransport,
} from "../../collector/src/index.ts";
import {
  InMemoryObservationRepository,
  MinimalControlPlane,
  PrinterTriageEngine,
} from "../src/index.ts";

const IDS = {
  tenantA: "018f1d92-a0e1-7b22-8f13-f6783977f001",
  tenantB: "018f1d92-a0e1-7b22-8f13-f6783977f002",
  site: "018f1d92-a0e1-7b22-8f13-f6783977f003",
  asset: "018f1d92-a0e1-7b22-8f13-f6783977f004",
  collector: "018f1d92-a0e1-7b22-8f13-f6783977f005",
} as const;
const now = new Date("2026-09-16T12:00:00.000Z");
let sequence = 100;

function observation(
  kind: string,
  value: Observation["value"],
  overrides: Partial<Observation> = {},
): Observation {
  const suffix = String(sequence++).padStart(3, "0");
  const id: UUID = `018f1d92-a0e1-7b22-8f13-f6783977f${suffix}`;
  return {
    id,
    tenantId: IDS.tenantA,
    siteId: IDS.site,
    assetId: IDS.asset,
    collectorId: IDS.collector,
    kind,
    value,
    provenance: "MEASURED",
    observedAt: now.toISOString(),
    receivedAt: now.toISOString(),
    idempotencyKey: `${IDS.collector}:${IDS.asset}:${suffix}:${kind}`,
    ...overrides,
  };
}

function controlPlane() {
  return new MinimalControlPlane(
    [
      {
        id: IDS.collector,
        tenantId: IDS.tenantA,
        siteId: IDS.site,
        status: "ACTIVE",
        policy: simulatedPolicy(IDS.tenantA, IDS.site, IDS.collector, IDS.asset),
      },
    ],
    new InMemoryObservationRepository(),
    new PrinterTriageEngine(() => now),
    () => now,
  );
}

test("ingests observations idempotently and audits retries", () => {
  const plane = controlPlane();
  const item = observation("icmp.reachable", true);
  assert.deepEqual(plane.ingest(IDS.collector, [item]), {
    accepted: 1,
    duplicates: 0,
    acceptedIdempotencyKeys: [item.idempotencyKey],
  });
  assert.deepEqual(plane.ingest(IDS.collector, [item]), {
    accepted: 0,
    duplicates: 1,
    acceptedIdempotencyKeys: [item.idempotencyKey],
  });
  assert.deepEqual(
    plane.auditRecords().map((record) => record.event),
    ["OBSERVATION_ACCEPTED", "OBSERVATION_DUPLICATE"],
  );
});

test("rejects reuse of an idempotency key for different content", () => {
  const plane = controlPlane();
  const original = observation("icmp.reachable", true);
  plane.ingest(IDS.collector, [original]);
  assert.throws(
    () => plane.ingest(IDS.collector, [{ ...original, value: false }]),
    (error: unknown) =>
      error instanceof ContractViolation && error.invariant === "IDEMPOTENCY_COLLISION",
  );
});

test("rejects observations outside the registered collector scope", () => {
  const plane = controlPlane();
  assert.throws(
    () =>
      plane.ingest(IDS.collector, [
        observation("icmp.reachable", true, { tenantId: IDS.tenantB }),
      ]),
    (error: unknown) =>
      error instanceof ContractViolation && error.invariant === "TENANT_ISOLATION",
  );
});

test("triages three failed protocols as unreachable without confirming a diagnosis", () => {
  const plane = controlPlane();
  plane.ingest(IDS.collector, [
    observation("icmp.reachable", false),
    observation("tcp.9100.reachable", false),
    observation("snmp.reachable", false),
  ]);
  const assessment = plane.triage(IDS.tenantA, IDS.asset);
  assert.equal(assessment.state, "UNREACHABLE");
  assert.equal(assessment.classification, "INFERRED");
  assert.equal(assessment.confidence, "MEDIUM");
  assert.equal(assessment.humanConfirmationRequired, true);
  assert.ok(assessment.hypotheses.length > 1);
});

test("does not call a printer offline when only ICMP fails", () => {
  const plane = controlPlane();
  plane.ingest(IDS.collector, [
    observation("icmp.reachable", false),
    observation("tcp.9100.reachable", true),
    observation("snmp.reachable", true),
    observation("printer.state", "READY"),
  ]);
  const assessment = plane.triage(IDS.tenantA, IDS.asset);
  assert.equal(assessment.state, "HEALTHY");
  assert.match(assessment.summary, /somente o ICMP/i);
});

test("reports PAPER_OUT as a measured condition", () => {
  const plane = controlPlane();
  plane.ingest(IDS.collector, [
    observation("printer.state", "PAPER_OUT"),
    observation("printer.paper.percent", 0),
  ]);
  const assessment = plane.triage(IDS.tenantA, IDS.asset);
  assert.equal(assessment.state, "ATTENTION");
  assert.equal(assessment.classification, "MEASURED");
  assert.match(assessment.summary, /ausência de papel/i);
});

test("returns indeterminate when measurements are insufficient", () => {
  const plane = controlPlane();
  plane.ingest(IDS.collector, [observation("icmp.reachable", false)]);
  const assessment = plane.triage(IDS.tenantA, IDS.asset);
  assert.equal(assessment.state, "INDETERMINATE");
  assert.equal(assessment.classification, "INDETERMINATE");
});

test("runs the complete Collector to Control Plane triage flow", async () => {
  const plane = controlPlane();
  let generatedId = 200;
  const printer: Asset = {
    id: IDS.asset,
    tenantId: IDS.tenantA,
    siteId: IDS.site,
    name: "Impressora Financeiro",
    kind: "PRINTER",
    status: "ACTIVE",
    createdAt: now.toISOString(),
  };
  const collector = new CollectorSimulator(
    {
      id: IDS.collector,
      tenantId: IDS.tenantA,
      siteId: IDS.site,
      name: "Collector Matriz",
      authorizedAssetIds: [IDS.asset],
      policy: simulatedPolicy(IDS.tenantA, IDS.site, IDS.collector, IDS.asset),
    },
    new SimulatorProbe(),
    new InMemoryObservationOutbox(),
    () => now,
    () => `018f1d92-a0e1-7b22-8f13-f6783977f${generatedId++}`,
  );

  collector.collect({
    asset: printer,
    ipAddress: "192.168.1.45",
    scenario: "NO_COMMUNICATION",
  });
  const transport: ObservationTransport = {
    async send(observations) {
      return plane.ingest(IDS.collector, observations).acceptedIdempotencyKeys;
    },
  };
  const synchronization = await collector.synchronize(transport);
  const assessment = plane.triage(IDS.tenantA, IDS.asset);

  assert.equal(synchronization.acknowledged, 3);
  assert.equal(synchronization.remaining, 0);
  assert.equal(assessment.state, "UNREACHABLE");
  assert.equal(assessment.classification, "INFERRED");
  assert.equal(assessment.humanConfirmationRequired, true);
});
