import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { ContractViolation, type Asset, type UUID } from "../../../packages/contracts/src/index.ts";
import {
  CollectorSimulator,
  InMemoryObservationOutbox,
  JsonFileObservationOutbox,
  SimulatorProbe,
  type ObservationTransport,
  type PrinterScenario,
} from "../src/index.ts";

const IDS = {
  tenantA: "018f1d92-a0e1-7b22-8f13-f6783977f001",
  tenantB: "018f1d92-a0e1-7b22-8f13-f6783977f002",
  siteA: "018f1d92-a0e1-7b22-8f13-f6783977f003",
  siteB: "018f1d92-a0e1-7b22-8f13-f6783977f004",
  asset: "018f1d92-a0e1-7b22-8f13-f6783977f005",
  collector: "018f1d92-a0e1-7b22-8f13-f6783977f006",
} as const;

const fixedDate = new Date("2026-09-16T12:00:00.000Z");
let idSequence = 100;
const nextId = (): UUID => `018f1d92-a0e1-7b22-8f13-f6783977f${idSequence++}`;

function asset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: IDS.asset,
    tenantId: IDS.tenantA,
    siteId: IDS.siteA,
    name: "Impressora Financeiro",
    kind: "PRINTER",
    status: "ACTIVE",
    createdAt: fixedDate.toISOString(),
    ...overrides,
  };
}

function collector(outbox = new InMemoryObservationOutbox()): CollectorSimulator {
  return new CollectorSimulator(
    {
      id: IDS.collector,
      tenantId: IDS.tenantA,
      siteId: IDS.siteA,
      name: "Collector A",
      authorizedAssetIds: [IDS.asset],
    },
    new SimulatorProbe(),
    outbox,
    () => fixedDate,
    nextId,
  );
}

function collectScenario(scenario: PrinterScenario) {
  return collector().collect({ asset: asset(), ipAddress: "192.168.1.45", scenario });
}

test("records only MEASURED observations and does not create a diagnosis", () => {
  const result = collectScenario("NO_COMMUNICATION");
  assert.equal(result.observations.length, 3);
  assert.ok(result.observations.every((item) => item.provenance === "MEASURED"));
  assert.deepEqual(
    result.observations.map(({ kind, value }) => ({ kind, value })),
    [
      { kind: "icmp.reachable", value: false },
      { kind: "tcp.9100.reachable", value: false },
      { kind: "snmp.reachable", value: false },
    ],
  );
});

test("does not classify a printer as offline when only ICMP is blocked", () => {
  const result = collectScenario("ICMP_BLOCKED");
  const readings = Object.fromEntries(result.observations.map((item) => [item.kind, item.value]));
  assert.equal(readings["icmp.reachable"], false);
  assert.equal(readings["tcp.9100.reachable"], true);
  assert.equal(readings["snmp.reachable"], true);
  assert.equal(readings["printer.state"], "READY");
});

test("rejects assets belonging to another tenant or site", () => {
  assert.throws(
    () =>
      collector().collect({
        asset: asset({ tenantId: IDS.tenantB }),
        ipAddress: "192.168.1.45",
        scenario: "HEALTHY",
      }),
    (error: unknown) =>
      error instanceof ContractViolation && error.invariant === "TENANT_ISOLATION",
  );
  assert.throws(
    () =>
      collector().collect({
        asset: asset({ siteId: IDS.siteB }),
        ipAddress: "192.168.1.45",
        scenario: "HEALTHY",
      }),
    (error: unknown) =>
      error instanceof ContractViolation && error.invariant === "COLLECTOR_SCOPE",
  );
});

test("rejects an asset not explicitly authorized by the network manager", () => {
  const unauthorizedAssetId = "018f1d92-a0e1-7b22-8f13-f6783977f099";
  assert.throws(
    () =>
      collector().collect({
        asset: asset({ id: unauthorizedAssetId }),
        ipAddress: "192.168.1.99",
        scenario: "HEALTHY",
      }),
    (error: unknown) =>
      error instanceof ContractViolation && error.invariant === "ASSET_NOT_AUTHORIZED",
  );
});

test("keeps observations queued when synchronization fails", async () => {
  const instance = collector();
  const collected = instance.collect({
    asset: asset(),
    ipAddress: "192.168.1.45",
    scenario: "PAPER_OUT",
  });
  const failingTransport: ObservationTransport = {
    async send() {
      throw new Error("control plane unavailable");
    },
  };
  await assert.rejects(() => instance.synchronize(failingTransport));
  assert.equal(instance.pendingObservations().length, collected.observations.length);
});

test("acknowledges a retry without changing its idempotency key", async () => {
  const instance = collector();
  const collected = instance.collect({
    asset: asset(),
    ipAddress: "192.168.1.45",
    scenario: "TONER_LOW",
  });
  const originalKeys = collected.observations.map((item) => item.idempotencyKey);
  let receivedKeys: readonly string[] = [];
  const transport: ObservationTransport = {
    async send(observations) {
      receivedKeys = observations.map((item) => item.idempotencyKey);
      return receivedKeys;
    },
  };
  const synced = await instance.synchronize(transport);
  assert.deepEqual(receivedKeys, originalKeys);
  assert.equal(synced.acknowledged, originalKeys.length);
  assert.equal(synced.remaining, 0);
});

test("restores pending observations from the durable JSON outbox", () => {
  const directory = mkdtempSync(join(tmpdir(), "atlas-collector-"));
  const filePath = join(directory, "outbox.json");
  try {
    const first = collector(new JsonFileObservationOutbox(filePath));
    const collected = first.collect({
      asset: asset(),
      ipAddress: "192.168.1.45",
      scenario: "HEALTHY",
    });
    const restarted = collector(new JsonFileObservationOutbox(filePath));
    assert.equal(restarted.pendingObservations().length, collected.observations.length);
    assert.deepEqual(
      restarted.pendingObservations().map((item) => item.idempotencyKey),
      collected.observations.map((item) => item.idempotencyKey),
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
