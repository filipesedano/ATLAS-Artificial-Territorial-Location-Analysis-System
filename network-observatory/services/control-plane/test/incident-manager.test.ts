import assert from "node:assert/strict";
import test from "node:test";

import {
  IncidentManager,
  InMemoryIncidentRepository,
  type TriageAssessment,
  type TriageCode,
  type TriageState,
} from "../src/index.ts";

const IDS = {
  tenant: "018f1d92-a0e1-7b22-8f13-f6783977f001",
  site: "018f1d92-a0e1-7b22-8f13-f6783977f003",
  asset: "018f1d92-a0e1-7b22-8f13-f6783977f004",
  incident: "018f1d92-a0e1-7b22-8f13-f6783977f900",
} as const;
const now = new Date("2026-09-16T12:00:00.000Z");
let observationSequence = 300;

function assessment(input: {
  code: TriageCode;
  state: TriageState;
  classification?: TriageAssessment["classification"];
  severity?: TriageAssessment["severity"];
}): TriageAssessment {
  const observationId = `018f1d92-a0e1-7b22-8f13-f6783977f${observationSequence++}`;
  return {
    tenantId: IDS.tenant,
    siteId: IDS.site,
    assetId: IDS.asset,
    code: input.code,
    state: input.state,
    severity: input.severity ?? "HIGH",
    classification: input.classification ?? "INFERRED",
    confidence: "MEDIUM",
    summary: "Avaliação de teste",
    findings: [
      {
        classification: "MEASURED",
        message: "Medição de teste",
        observationIds: [observationId],
      },
    ],
    hypotheses: [],
    recommendedChecks: [],
    humanConfirmationRequired: true,
    generatedAt: now.toISOString(),
  };
}

function setup() {
  const repository = new InMemoryIncidentRepository();
  const manager = new IncidentManager(repository, () => IDS.incident, () => now);
  return { manager, repository };
}

test("requires three consecutive no-communication assessments", () => {
  const { manager } = setup();
  const first = manager.evaluate(
    assessment({ code: "PRINTER_NO_COMMUNICATION", state: "UNREACHABLE" }),
  );
  const second = manager.evaluate(
    assessment({ code: "PRINTER_NO_COMMUNICATION", state: "UNREACHABLE" }),
  );
  const third = manager.evaluate(
    assessment({ code: "PRINTER_NO_COMMUNICATION", state: "UNREACHABLE" }),
  );
  assert.equal(first.action, "PENDING_CONFIRMATION");
  assert.equal(second.action, "PENDING_CONFIRMATION");
  assert.equal(third.action, "CREATED");
  assert.equal(third.incident?.title, "Impressora sem comunicação");
  assert.equal(third.incident?.status, "OPEN");
});

test("does not count the same assessment twice", () => {
  const { manager } = setup();
  const item = assessment({ code: "PRINTER_NO_COMMUNICATION", state: "UNREACHABLE" });
  assert.equal(manager.evaluate(item).action, "PENDING_CONFIRMATION");
  assert.equal(manager.evaluate(item).action, "DUPLICATE_ASSESSMENT");
  const next = manager.evaluate(
    assessment({ code: "PRINTER_NO_COMMUNICATION", state: "UNREACHABLE" }),
  );
  assert.equal(next.currentAssessments, 2);
});

test("creates a measured paper-out incident immediately", () => {
  const { manager } = setup();
  const decision = manager.evaluate(
    assessment({
      code: "PRINTER_PAPER_OUT",
      state: "ATTENTION",
      classification: "MEASURED",
      severity: "MEDIUM",
    }),
  );
  assert.equal(decision.action, "CREATED");
  assert.equal(decision.incident?.classification, "MEASURED");
  assert.equal(decision.incident?.title, "Impressora sem papel");
});

test("updates an active incident instead of creating a duplicate", () => {
  const { manager, repository } = setup();
  manager.evaluate(
    assessment({
      code: "PRINTER_TONER_LOW",
      state: "PREVENTIVE",
      classification: "MEASURED",
      severity: "LOW",
    }),
  );
  const updated = manager.evaluate(
    assessment({
      code: "PRINTER_TONER_LOW",
      state: "PREVENTIVE",
      classification: "MEASURED",
      severity: "LOW",
    }),
  );
  assert.equal(updated.action, "UPDATED");
  assert.equal(repository.listByTenant(IDS.tenant).length, 1);
  assert.equal(updated.incident?.observationIds.length, 2);
});

test("requires two distinct healthy assessments before resolving", () => {
  const { manager, repository } = setup();
  manager.evaluate(
    assessment({
      code: "PRINTER_PAPER_OUT",
      state: "ATTENTION",
      classification: "MEASURED",
      severity: "MEDIUM",
    }),
  );
  const firstHealthy = manager.evaluate(
    assessment({
      code: "PRINTER_READY",
      state: "HEALTHY",
      classification: "MEASURED",
      severity: "INFO",
    }),
  );
  const secondHealthy = manager.evaluate(
    assessment({
      code: "PRINTER_READY",
      state: "HEALTHY",
      classification: "MEASURED",
      severity: "INFO",
    }),
  );
  assert.equal(firstHealthy.action, "PENDING_RECOVERY");
  assert.equal(secondHealthy.action, "RESOLVED");
  assert.equal(repository.listByTenant(IDS.tenant)[0].status, "RESOLVED");
});

test("does not create or resolve incidents from indeterminate data", () => {
  const { manager, repository } = setup();
  const decision = manager.evaluate(
    assessment({
      code: "INSUFFICIENT_DATA",
      state: "INDETERMINATE",
      classification: "INDETERMINATE",
      severity: "INFO",
    }),
  );
  assert.equal(decision.action, "NO_ACTION");
  assert.equal(repository.listByTenant(IDS.tenant).length, 0);
});

test("records every incident decision in an ordered audit log", () => {
  const { manager } = setup();
  manager.evaluate(
    assessment({ code: "PRINTER_NO_COMMUNICATION", state: "UNREACHABLE" }),
  );
  manager.evaluate(
    assessment({ code: "PRINTER_NO_COMMUNICATION", state: "UNREACHABLE" }),
  );
  assert.deepEqual(
    manager.auditRecords().map((item) => item.sequence),
    [1, 2],
  );
});
