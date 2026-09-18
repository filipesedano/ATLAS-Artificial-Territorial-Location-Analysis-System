import assert from "node:assert/strict";
import test from "node:test";

import {
  ContractViolation,
  type Asset,
  type Observation,
  type Site,
  type Tenant,
} from "../../../packages/contracts/src/index.ts";
import {
  InventoryManager,
  InMemoryObservationRepository,
  PrinterTriageEngine,
  StatusProjector,
} from "../src/index.ts";

const IDS = {
  tenant: "018f1d92-a0e1-7b22-8f13-f6783977f001",
  otherTenant: "018f1d92-a0e1-7b22-8f13-f6783977f002",
  site: "018f1d92-a0e1-7b22-8f13-f6783977f003",
  asset: "018f1d92-a0e1-7b22-8f13-f6783977f004",
  collector: "018f1d92-a0e1-7b22-8f13-f6783977f005",
} as const;
const now = new Date("2026-09-16T12:00:00.000Z");
let observationId = 500;

function tenant(): Tenant {
  return {
    id: IDS.tenant,
    publicCode: "A4527",
    name: "Cliente ATLAS",
    status: "ACTIVE",
    createdAt: now.toISOString(),
  };
}

function site(): Site {
  return {
    id: IDS.site,
    tenantId: IDS.tenant,
    name: "Matriz",
    timezone: "America/Sao_Paulo",
    criticality: "HIGH",
    operatingWindows: [{ weekday: 3, opensAt: "08:00", closesAt: "18:00" }],
    createdAt: now.toISOString(),
  };
}

function asset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: IDS.asset,
    tenantId: IDS.tenant,
    siteId: IDS.site,
    name: "Impressora Financeiro",
    kind: "PRINTER",
    status: "ACTIVE",
    createdAt: now.toISOString(),
    ...overrides,
  };
}

function measured(kind: string, value: Observation["value"], at = now): Observation {
  const suffix = String(observationId++).padStart(3, "0");
  return {
    id: `018f1d92-a0e1-7b22-8f13-f6783977f${suffix}`,
    tenantId: IDS.tenant,
    siteId: IDS.site,
    assetId: IDS.asset,
    collectorId: IDS.collector,
    kind,
    value,
    provenance: "MEASURED",
    observedAt: at.toISOString(),
    receivedAt: at.toISOString(),
    idempotencyKey: `inventory-status-${suffix}-${kind}`,
  };
}

function setup() {
  const inventory = new InventoryManager([
    { id: IDS.collector, tenantId: IDS.tenant, siteId: IDS.site, status: "ACTIVE" },
  ]);
  inventory.registerTenant(tenant());
  inventory.registerSite(site());
  inventory.registerAsset({
    asset: asset(),
    collectorId: IDS.collector,
    expectedAddress: "192.168.1.45",
    criticality: "HIGH",
    monitoring: "ENABLED",
    requiredObservationKinds: [
      "icmp.reachable",
      "tcp.9100.reachable",
      "snmp.reachable",
      "printer.state",
    ],
  });
  const repository = new InMemoryObservationRepository();
  const projector = new StatusProjector(
    inventory,
    repository,
    new PrinterTriageEngine(() => now),
    () => now,
    { freshnessMs: 5 * 60 * 1_000 },
  );
  return { inventory, repository, projector };
}

test("registers an authorized tenant, site and managed asset", () => {
  const { inventory } = setup();
  const managed = inventory.listAssets(IDS.tenant);
  assert.equal(managed.length, 1);
  assert.equal(managed[0].expectedAddress, "192.168.1.45");
  assert.equal(managed[0].requiredObservationKinds.length, 4);
});

test("rejects asset registration across tenant boundaries", () => {
  const inventory = new InventoryManager([
    { id: IDS.collector, tenantId: IDS.tenant, siteId: IDS.site, status: "ACTIVE" },
  ]);
  inventory.registerTenant(tenant());
  inventory.registerSite(site());
  assert.throws(
    () =>
      inventory.registerAsset({
        asset: asset({ tenantId: IDS.otherTenant }),
        collectorId: IDS.collector,
        criticality: "HIGH",
        monitoring: "ENABLED",
        requiredObservationKinds: ["icmp.reachable"],
      }),
    (error: unknown) =>
      error instanceof ContractViolation && error.invariant === "TENANT_ISOLATION",
  );
});

test("projects UNKNOWN when an asset has never been observed", () => {
  const { inventory, projector } = setup();
  const projection = projector.projectAsset(inventory.listAssets(IDS.tenant)[0]);
  assert.equal(projection.status, "UNKNOWN");
  assert.equal(projection.coverage, "NONE");
});

test("does not claim healthy with partial coverage", () => {
  const { inventory, repository, projector } = setup();
  repository.save(measured("printer.state", "READY"));
  repository.save(measured("tcp.9100.reachable", true));
  const projection = projector.projectAsset(inventory.listAssets(IDS.tenant)[0]);
  assert.equal(projection.status, "UNKNOWN");
  assert.equal(projection.coverage, "PARTIAL");
  assert.ok(projection.missingKinds.includes("snmp.reachable"));
});

test("projects healthy only with complete fresh coverage", () => {
  const { inventory, repository, projector } = setup();
  repository.save(measured("icmp.reachable", true));
  repository.save(measured("tcp.9100.reachable", true));
  repository.save(measured("snmp.reachable", true));
  repository.save(measured("printer.state", "READY"));
  const projection = projector.projectAsset(inventory.listAssets(IDS.tenant)[0]);
  assert.equal(projection.status, "HEALTHY");
  assert.equal(projection.coverage, "FULL");
  assert.equal(projector.projectTenant(IDS.tenant).safeToClaimHealthy, true);
});

test("projects stale when all observations exceed the freshness window", () => {
  const { inventory, repository, projector } = setup();
  repository.save(measured("icmp.reachable", true, new Date("2026-09-16T11:40:00.000Z")));
  const projection = projector.projectAsset(inventory.listAssets(IDS.tenant)[0]);
  assert.equal(projection.status, "STALE");
});

test("projects a directly reported paper-out condition as attention", () => {
  const { inventory, repository, projector } = setup();
  repository.save(measured("printer.state", "PAPER_OUT"));
  repository.save(measured("printer.paper.percent", 0));
  const projection = projector.projectAsset(inventory.listAssets(IDS.tenant)[0]);
  assert.equal(projection.status, "ATTENTION");
  assert.match(projection.reason, /ausência de papel/i);
});
