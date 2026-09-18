import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type {
  Incident,
  Observation,
  Site,
  Tenant,
} from "../../../packages/contracts/src/index.ts";
import {
  IncidentManager,
  LOCAL_SCHEMA_VERSION,
  LocalDatabase,
  SqliteIncidentRepository,
  SqliteIncidentRuntimeStore,
  SqliteInventoryStore,
  SqliteObservationRepository,
  type InventorySeed,
  type TriageAssessment,
} from "../src/index.ts";

const IDS = {
  tenant: "018f1d92-a0e1-7b22-8f13-f6783977f001",
  site: "018f1d92-a0e1-7b22-8f13-f6783977f003",
  asset: "018f1d92-a0e1-7b22-8f13-f6783977f004",
  collector: "018f1d92-a0e1-7b22-8f13-f6783977f005",
  observation: "018f1d92-a0e1-7b22-8f13-f6783977f006",
  incident: "018f1d92-a0e1-7b22-8f13-f6783977f900",
} as const;
const now = "2026-09-16T12:00:00.000Z";

function withDatabaseFile(run: (path: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), "atlas-sqlite-"));
  try {
    run(join(directory, "atlas-local.db"));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function observation(): Observation {
  return {
    id: IDS.observation,
    tenantId: IDS.tenant,
    siteId: IDS.site,
    assetId: IDS.asset,
    collectorId: IDS.collector,
    kind: "icmp.reachable",
    value: false,
    provenance: "MEASURED",
    observedAt: now,
    receivedAt: now,
    idempotencyKey: "sqlite-observation-001",
  };
}

function incident(): Incident {
  return {
    id: IDS.incident,
    tenantId: IDS.tenant,
    siteId: IDS.site,
    assetId: IDS.asset,
    title: "Impressora sem comunicação",
    status: "OPEN",
    severity: "HIGH",
    classification: "INFERRED",
    deduplicationKey: `${IDS.tenant}:${IDS.site}:${IDS.asset}:printer-no-communication`,
    observationIds: [IDS.observation],
    evidenceIds: [],
    openedAt: now,
    updatedAt: now,
  };
}

function inventorySeed(): InventorySeed {
  const tenant: Tenant = {
    id: IDS.tenant,
    publicCode: "A4527",
    name: "Cliente Persistente",
    status: "ACTIVE",
    createdAt: now,
  };
  const site: Site = {
    id: IDS.site,
    tenantId: IDS.tenant,
    name: "Matriz",
    timezone: "America/Sao_Paulo",
    criticality: "HIGH",
    operatingWindows: [{ weekday: 3, opensAt: "08:00", closesAt: "18:00" }],
    createdAt: now,
  };
  return {
    collectors: [
      { id: IDS.collector, tenantId: IDS.tenant, siteId: IDS.site, status: "ACTIVE" },
    ],
    tenants: [tenant],
    sites: [site],
    assets: [
      {
        asset: {
          id: IDS.asset,
          tenantId: IDS.tenant,
          siteId: IDS.site,
          name: "Impressora Financeiro",
          kind: "PRINTER",
          status: "ACTIVE",
          createdAt: now,
        },
        collectorId: IDS.collector,
        expectedAddress: "192.168.1.45",
        criticality: "HIGH",
        monitoring: "ENABLED",
        requiredObservationKinds: ["icmp.reachable"],
      },
    ],
  };
}

function assessment(index: number): TriageAssessment {
  return {
    tenantId: IDS.tenant,
    siteId: IDS.site,
    assetId: IDS.asset,
    code: "PRINTER_NO_COMMUNICATION",
    state: "UNREACHABLE",
    severity: "HIGH",
    classification: "INFERRED",
    confidence: "MEDIUM",
    summary: "A impressora não respondeu.",
    findings: [
      {
        classification: "MEASURED",
        message: "Sem resposta.",
        observationIds: [`018f1d92-a0e1-7b22-8f13-f6783977f7${index.toString().padStart(2, "0")}`],
      },
    ],
    hypotheses: [],
    recommendedChecks: [],
    humanConfirmationRequired: true,
    generatedAt: now,
  };
}

test("applies migrations idempotently and passes SQLite integrity check", () => {
  withDatabaseFile((path) => {
    const first = new LocalDatabase(path);
    assert.equal(first.schemaVersion(), LOCAL_SCHEMA_VERSION);
    assert.equal(first.integrityCheck(), "ok");
    first.close();

    const reopened = new LocalDatabase(path);
    assert.equal(reopened.schemaVersion(), LOCAL_SCHEMA_VERSION);
    assert.equal(reopened.integrityCheck(), "ok");
    reopened.close();
  });
});

test("preserves observations and incidents after closing and reopening", () => {
  withDatabaseFile((path) => {
    const first = new LocalDatabase(path);
    new SqliteObservationRepository(first).save(observation());
    new SqliteIncidentRepository(first).save(incident());
    first.close();

    const reopened = new LocalDatabase(path);
    const observations = new SqliteObservationRepository(reopened);
    const incidents = new SqliteIncidentRepository(reopened);
    assert.equal(observations.findByAsset(IDS.tenant, IDS.asset).length, 1);
    assert.equal(incidents.listByTenant(IDS.tenant).length, 1);
    assert.equal(incidents.listByTenant(IDS.tenant)[0].status, "OPEN");
    reopened.close();
  });
});

test("seeds inventory once and restores it on restart", () => {
  withDatabaseFile((path) => {
    const first = new LocalDatabase(path);
    const initial = new SqliteInventoryStore(first).initialize(inventorySeed());
    assert.equal(initial.listAssets(IDS.tenant).length, 1);
    first.close();

    const reopened = new LocalDatabase(path);
    const restored = new SqliteInventoryStore(reopened).initialize(inventorySeed());
    assert.equal(restored.listAssets(IDS.tenant)[0].expectedAddress, "192.168.1.45");
    reopened.close();
  });
});

test("continues incident confirmation counters safely after restart", () => {
  withDatabaseFile((path) => {
    const first = new LocalDatabase(path);
    const firstManager = new IncidentManager(
      new SqliteIncidentRepository(first),
      () => IDS.incident,
      () => new Date(now),
      new SqliteIncidentRuntimeStore(first),
    );
    assert.equal(firstManager.evaluate(assessment(1)).action, "PENDING_CONFIRMATION");
    assert.equal(firstManager.evaluate(assessment(2)).action, "PENDING_CONFIRMATION");
    first.close();

    const reopened = new LocalDatabase(path);
    const secondManager = new IncidentManager(
      new SqliteIncidentRepository(reopened),
      () => IDS.incident,
      () => new Date(now),
      new SqliteIncidentRuntimeStore(reopened),
    );
    assert.equal(secondManager.evaluate(assessment(3)).action, "CREATED");
    assert.equal(secondManager.auditRecords().length, 3);
    reopened.close();
  });
});

test("does not count the same persisted assessment again after restart", () => {
  withDatabaseFile((path) => {
    const item = assessment(1);
    const first = new LocalDatabase(path);
    const firstManager = new IncidentManager(
      new SqliteIncidentRepository(first),
      () => IDS.incident,
      () => new Date(now),
      new SqliteIncidentRuntimeStore(first),
    );
    firstManager.evaluate(item);
    first.close();

    const reopened = new LocalDatabase(path);
    const secondManager = new IncidentManager(
      new SqliteIncidentRepository(reopened),
      () => IDS.incident,
      () => new Date(now),
      new SqliteIncidentRuntimeStore(reopened),
    );
    assert.equal(secondManager.evaluate(item).action, "DUPLICATE_ASSESSMENT");
    reopened.close();
  });
});
