import { assertObservationAllowed } from "../../../packages/contracts/src/index.ts";
import {
  ContractViolation,
  assertObservation,
  assertTenantBoundary,
  assertUuid,
  type Observation,
  type UUID,
} from "../../../packages/contracts/src/index.ts";
import { PrinterTriageEngine } from "./triage-engine.ts";
import type {
  AuditRecord,
  Clock,
  IngestionResult,
  ObservationRepository,
  RegisteredCollector,
  TriageAssessment,
} from "./types.ts";

function sameObservation(left: Observation, right: Observation): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export class MinimalControlPlane {
  private readonly collectors = new Map<UUID, RegisteredCollector>();
  private readonly auditLog: AuditRecord[] = [];
  private auditSequence = 0;
  private readonly repository: ObservationRepository;
  private readonly triageEngine: PrinterTriageEngine;
  private readonly clock: Clock;

  constructor(
    collectors: readonly RegisteredCollector[],
    repository: ObservationRepository,
    triageEngine: PrinterTriageEngine,
    clock: Clock = () => new Date(),
  ) {
    this.repository = repository;
    this.triageEngine = triageEngine;
    this.clock = clock;
    for (const collector of collectors) {
      assertUuid(collector.id, "collector.id");
      assertUuid(collector.tenantId, "collector.tenantId");
      assertUuid(collector.siteId, "collector.siteId");
      this.collectors.set(collector.id, collector);
    }
  }

  ingest(collectorId: UUID, observations: readonly Observation[]): IngestionResult {
    const collector = this.collectors.get(collectorId);
    if (!collector || collector.status !== "ACTIVE") {
      throw new ContractViolation(
        "COLLECTOR_NOT_AUTHORIZED",
        "Collector is unknown or suspended",
      );
    }

    // Preflight the entire batch before any repository write.
    for (const item of observations) {
      assertObservation(item);
      assertTenantBoundary(collector.tenantId, item);
      if (item.collectorId !== collector.id || item.siteId !== collector.siteId) throw new ContractViolation("COLLECTOR_SCOPE", "Observation outside collector scope");
      assertObservationAllowed(collector.policy, item, this.clock());
    }

    let accepted = 0;
    let duplicates = 0;
    const acceptedIdempotencyKeys: string[] = [];

    for (const observation of observations) {
      assertObservation(observation);
      assertTenantBoundary(collector.tenantId, observation);
      if (observation.collectorId !== collector.id || observation.siteId !== collector.siteId) {
        throw new ContractViolation(
          "COLLECTOR_SCOPE",
          "Observation is outside the registered collector scope",
        );
      }

      const existing = this.repository.findByIdempotencyKey(observation.idempotencyKey);
      if (existing) {
        if (!sameObservation(existing, observation)) {
          throw new ContractViolation(
            "IDEMPOTENCY_COLLISION",
            "An idempotency key cannot identify different observations",
          );
        }
        duplicates += 1;
        acceptedIdempotencyKeys.push(observation.idempotencyKey);
        this.audit("OBSERVATION_DUPLICATE", observation.tenantId, observation.id, {
          idempotencyKey: observation.idempotencyKey,
        });
        continue;
      }

      this.repository.save(Object.freeze({ ...observation }));
      accepted += 1;
      acceptedIdempotencyKeys.push(observation.idempotencyKey);
      this.audit("OBSERVATION_ACCEPTED", observation.tenantId, observation.id, {
        kind: observation.kind,
        provenance: observation.provenance,
      });
    }

    return { accepted, duplicates, acceptedIdempotencyKeys };
  }

  triage(tenantId: UUID, assetId: UUID): TriageAssessment {
    assertUuid(tenantId, "tenantId");
    assertUuid(assetId, "assetId");
    const observations = this.repository.findByAsset(tenantId, assetId);
    if (observations.length === 0) {
      throw new ContractViolation(
        "OBSERVATIONS_NOT_FOUND",
        "No observations are available for this tenant and asset",
      );
    }
    const assessment = this.triageEngine.assess(observations);
    this.audit("TRIAGE_GENERATED", tenantId, assetId, {
      state: assessment.state,
      classification: assessment.classification,
    });
    return assessment;
  }

  collectionPolicySummary(tenantId: UUID, assetId: UUID) {
    return [...this.collectors.values()]
      .filter(item => item.tenantId === tenantId && item.policy?.targets.some(target => target.assetId === assetId))
      .map(item => ({ collectorId: item.id, collectorState: item.status, policy: structuredClone(item.policy) }));
  }

  readObservations(tenantId: UUID, assetId: UUID): readonly Observation[] {
    assertUuid(tenantId, "tenantId");
    assertUuid(assetId, "assetId");
    return this.repository.findByAsset(tenantId, assetId)
      .slice().sort((a, b) => b.observedAt.localeCompare(a.observedAt))
      .slice(0, 100).map(item => ({ ...item }));
  }

  auditRecords(): readonly AuditRecord[] {
    return this.auditLog.map((record) => ({ ...record, details: { ...record.details } }));
  }

  private audit(
    event: AuditRecord["event"],
    tenantId: UUID,
    subjectId: UUID,
    details: AuditRecord["details"],
  ): void {
    this.auditLog.push(
      Object.freeze({
        sequence: ++this.auditSequence,
        event,
        tenantId,
        subjectId,
        occurredAt: this.clock().toISOString(),
        details: Object.freeze({ ...details }),
      }),
    );
  }
}
