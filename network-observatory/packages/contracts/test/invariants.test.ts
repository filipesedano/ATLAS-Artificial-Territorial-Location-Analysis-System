import assert from "node:assert/strict";
import test from "node:test";

import {
  ContractViolation,
  assertAsset,
  assertEvidence,
  assertIncident,
  assertObservation,
  assertSite,
  assertTenant,
  assertTenantBoundary,
  buildIncidentDeduplicationKey,
  type Evidence,
  type Incident,
  type Observation,
  type Site,
  type Tenant,
} from "../src/index.ts";

const IDS = {
  tenantA: "018f1d92-a0e1-7b22-8f13-f6783977f001",
  tenantB: "018f1d92-a0e1-7b22-8f13-f6783977f002",
  site: "018f1d92-a0e1-7b22-8f13-f6783977f003",
  asset: "018f1d92-a0e1-7b22-8f13-f6783977f004",
  collector: "018f1d92-a0e1-7b22-8f13-f6783977f005",
  observation: "018f1d92-a0e1-7b22-8f13-f6783977f006",
  evidence: "018f1d92-a0e1-7b22-8f13-f6783977f007",
  incident: "018f1d92-a0e1-7b22-8f13-f6783977f008",
} as const;

const now = "2026-09-16T12:00:00.000Z";

function observation(overrides: Partial<Observation> = {}): Observation {
  return {
    id: IDS.observation,
    tenantId: IDS.tenantA,
    siteId: IDS.site,
    assetId: IDS.asset,
    collectorId: IDS.collector,
    kind: "icmp.reachable",
    value: true,
    provenance: "MEASURED",
    observedAt: now,
    receivedAt: now,
    idempotencyKey: "collector-0001:sequence-42",
    ...overrides,
  };
}

function evidence(overrides: Partial<Evidence> = {}): Evidence {
  return {
    id: IDS.evidence,
    tenantId: IDS.tenantA,
    siteId: IDS.site,
    assetId: IDS.asset,
    observationId: IDS.observation,
    source: "COLLECTOR",
    provenance: "MEASURED",
    contentType: "application/json",
    sha256: "a".repeat(64),
    capturedAt: now,
    ...overrides,
  };
}

function incident(overrides: Partial<Incident> = {}): Incident {
  return {
    id: IDS.incident,
    tenantId: IDS.tenantA,
    siteId: IDS.site,
    assetId: IDS.asset,
    title: "Asset unreachable",
    status: "OPEN",
    severity: "HIGH",
    classification: "INFERRED",
    deduplicationKey: `${IDS.tenantA}:${IDS.site}:${IDS.asset}:unreachable`,
    observationIds: [IDS.observation],
    evidenceIds: [IDS.evidence],
    openedAt: now,
    updatedAt: now,
    ...overrides,
  };
}

test("accepts a valid tenant with a public code and internal UUID", () => {
  const tenant: Tenant = {
    id: IDS.tenantA,
    publicCode: "A4527",
    name: "Cliente ATLAS",
    status: "ACTIVE",
    createdAt: now,
  };
  assert.doesNotThrow(() => assertTenant(tenant));
});

test("rejects cross-tenant resources", () => {
  assert.throws(
    () => assertTenantBoundary(IDS.tenantA, { tenantId: IDS.tenantB }),
    (error: unknown) =>
      error instanceof ContractViolation && error.invariant === "TENANT_ISOLATION",
  );
});

test("validates a site's timezone and operating window", () => {
  const site: Site = {
    id: IDS.site,
    tenantId: IDS.tenantA,
    name: "Matriz",
    timezone: "America/Sao_Paulo",
    criticality: "HIGH",
    operatingWindows: [{ weekday: 1, opensAt: "08:00", closesAt: "18:00" }],
    createdAt: now,
  };
  assert.doesNotThrow(() => assertSite(site));
  assert.doesNotThrow(() =>
    assertAsset(
      {
        id: IDS.asset,
        tenantId: IDS.tenantA,
        siteId: IDS.site,
        name: "Roteador principal",
        kind: "ROUTER",
        status: "ACTIVE",
        createdAt: now,
      },
      site,
    ),
  );
});

test("requires explicit provenance on observations", () => {
  const invalid = observation({ provenance: "UNKNOWN" as Observation["provenance"] });
  assert.throws(
    () => assertObservation(invalid),
    (error: unknown) =>
      error instanceof ContractViolation && error.invariant === "PROVENANCE_REQUIRED",
  );
});

test("requires an idempotency key for collector retries", () => {
  assert.throws(
    () => assertObservation(observation({ idempotencyKey: "" })),
    (error: unknown) =>
      error instanceof ContractViolation && error.invariant === "IDEMPOTENCY_REQUIRED",
  );
});

test("validates evidence integrity without treating the digest as truth", () => {
  assert.doesNotThrow(() => assertEvidence(evidence()));
  assert.throws(
    () => assertEvidence(evidence({ sha256: "not-a-digest" })),
    (error: unknown) =>
      error instanceof ContractViolation && error.invariant === "EVIDENCE_INTEGRITY",
  );
});

test("rejects an incident assembled with evidence from another tenant", () => {
  assert.throws(
    () => assertIncident(incident(), [observation()], [evidence({ tenantId: IDS.tenantB })]),
    (error: unknown) =>
      error instanceof ContractViolation && error.invariant === "TENANT_ISOLATION",
  );
});

test("builds the same deduplication key for equivalent incident kinds", () => {
  const base = { tenantId: IDS.tenantA, siteId: IDS.site, assetId: IDS.asset };
  assert.equal(
    buildIncidentDeduplicationKey({ ...base, kind: "  Asset   Unreachable " }),
    buildIncidentDeduplicationKey({ ...base, kind: "asset unreachable" }),
  );
});
