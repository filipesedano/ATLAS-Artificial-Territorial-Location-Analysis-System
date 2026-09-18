import {
  buildIncidentDeduplicationKey,
  type Incident,
  type UUID,
} from "../../../packages/contracts/src/index.ts";
import type { Clock, TriageAssessment, TriageCode } from "./types.ts";

export type IncidentAction =
  | "NO_ACTION"
  | "DUPLICATE_ASSESSMENT"
  | "PENDING_CONFIRMATION"
  | "CREATED"
  | "UPDATED"
  | "PENDING_RECOVERY"
  | "RESOLVED";

export interface IncidentDecision {
  action: IncidentAction;
  incident?: Incident;
  requiredAssessments?: number;
  currentAssessments?: number;
  reason: string;
}

export interface IncidentAuditRecord {
  sequence: number;
  action: IncidentAction;
  tenantId: UUID;
  assetId: UUID;
  incidentId?: UUID;
  triageCode: TriageCode;
  occurredAt: string;
  reason: string;
}

export interface IncidentRepository {
  save(incident: Incident): void;
  findActiveByDeduplicationKey(key: string): Incident | undefined;
  findActiveByAsset(tenantId: UUID, assetId: UUID): readonly Incident[];
  listByTenant(tenantId: UUID): readonly Incident[];
}

export type IncidentIdGenerator = () => UUID;

export interface IncidentRuntimeState {
  lastProblemCode?: TriageCode;
  consecutiveProblemAssessments: number;
  consecutiveHealthyAssessments: number;
  processedAssessmentSignatures: Set<string>;
}

export interface IncidentRuntimeStore {
  loadState(stateKey: string): IncidentRuntimeState | undefined;
  saveState(stateKey: string, state: IncidentRuntimeState): void;
  appendAudit(record: Omit<IncidentAuditRecord, "sequence">): IncidentAuditRecord;
  listAudit(): readonly IncidentAuditRecord[];
}

export class InMemoryIncidentRuntimeStore implements IncidentRuntimeStore {
  private readonly states = new Map<string, IncidentRuntimeState>();
  private readonly audit: IncidentAuditRecord[] = [];

  loadState(stateKey: string): IncidentRuntimeState | undefined {
    const state = this.states.get(stateKey);
    return state
      ? { ...state, processedAssessmentSignatures: new Set(state.processedAssessmentSignatures) }
      : undefined;
  }

  saveState(stateKey: string, state: IncidentRuntimeState): void {
    this.states.set(stateKey, {
      ...state,
      processedAssessmentSignatures: new Set(state.processedAssessmentSignatures),
    });
  }

  appendAudit(record: Omit<IncidentAuditRecord, "sequence">): IncidentAuditRecord {
    const stored = Object.freeze({ ...record, sequence: this.audit.length + 1 });
    this.audit.push(stored);
    return stored;
  }

  listAudit(): readonly IncidentAuditRecord[] {
    return this.audit.map((item) => ({ ...item }));
  }
}

const TITLES: Readonly<Record<TriageCode, string>> = {
  PRINTER_READY: "Impressora operacional",
  PRINTER_NO_COMMUNICATION: "Impressora sem comunicação",
  PRINTER_ICMP_UNAVAILABLE: "ICMP indisponível com impressora acessível",
  PRINTER_PAPER_OUT: "Impressora sem papel",
  PRINTER_TONER_LOW: "Toner da impressora em nível baixo",
  INSUFFICIENT_DATA: "Dados insuficientes para triagem",
};

function observationIds(assessment: TriageAssessment): UUID[] {
  return [...new Set(assessment.findings.flatMap((item) => item.observationIds))];
}

function assessmentSignature(assessment: TriageAssessment): string {
  return `${assessment.code}:${observationIds(assessment).sort().join(",")}`;
}

function thresholdFor(code: TriageCode): number {
  return code === "PRINTER_NO_COMMUNICATION" ? 3 : 1;
}

export class InMemoryIncidentRepository implements IncidentRepository {
  private readonly incidents = new Map<UUID, Incident>();

  save(incident: Incident): void {
    this.incidents.set(incident.id, Object.freeze({ ...incident }));
  }

  findActiveByDeduplicationKey(key: string): Incident | undefined {
    return [...this.incidents.values()].find(
      (incident) =>
        incident.deduplicationKey === key &&
        (incident.status === "OPEN" || incident.status === "ACKNOWLEDGED"),
    );
  }

  findActiveByAsset(tenantId: UUID, assetId: UUID): readonly Incident[] {
    return [...this.incidents.values()].filter(
      (incident) =>
        incident.tenantId === tenantId &&
        incident.assetId === assetId &&
        (incident.status === "OPEN" || incident.status === "ACKNOWLEDGED"),
    );
  }

  listByTenant(tenantId: UUID): readonly Incident[] {
    return [...this.incidents.values()].filter((incident) => incident.tenantId === tenantId);
  }
}

export class IncidentManager {
  private readonly states = new Map<string, IncidentRuntimeState>();
  private readonly repository: IncidentRepository;
  private readonly nextId: IncidentIdGenerator;
  private readonly clock: Clock;
  private readonly runtimeStore: IncidentRuntimeStore;

  constructor(
    repository: IncidentRepository,
    nextId: IncidentIdGenerator,
    clock: Clock = () => new Date(),
    runtimeStore: IncidentRuntimeStore = new InMemoryIncidentRuntimeStore(),
  ) {
    this.repository = repository;
    this.nextId = nextId;
    this.clock = clock;
    this.runtimeStore = runtimeStore;
  }

  evaluate(assessment: TriageAssessment): IncidentDecision {
    const state = this.stateFor(assessment);
    const signature = assessmentSignature(assessment);
    if (state.processedAssessmentSignatures.has(signature)) {
      return this.record(assessment, {
        action: "DUPLICATE_ASSESSMENT",
        reason: "Esta triagem já foi processada e não altera contadores ou incidentes.",
      }, state);
    }
    state.processedAssessmentSignatures.add(signature);

    if (assessment.state === "INDETERMINATE") {
      state.consecutiveProblemAssessments = 0;
      state.consecutiveHealthyAssessments = 0;
      return this.record(assessment, {
        action: "NO_ACTION",
        reason: "Dados insuficientes não autorizam a abertura nem a resolução de incidente.",
      }, state);
    }

    if (assessment.state === "HEALTHY") {
      return this.handleHealthyAssessment(assessment, state);
    }

    state.consecutiveHealthyAssessments = 0;
    if (state.lastProblemCode === assessment.code) {
      state.consecutiveProblemAssessments += 1;
    } else {
      state.lastProblemCode = assessment.code;
      state.consecutiveProblemAssessments = 1;
    }

    const required = thresholdFor(assessment.code);
    if (state.consecutiveProblemAssessments < required) {
      return this.record(assessment, {
        action: "PENDING_CONFIRMATION",
        requiredAssessments: required,
        currentAssessments: state.consecutiveProblemAssessments,
        reason: "A condição precisa persistir antes da criação do incidente.",
      }, state);
    }

    const deduplicationKey = buildIncidentDeduplicationKey({
      tenantId: assessment.tenantId,
      siteId: assessment.siteId,
      assetId: assessment.assetId,
      kind: assessment.code,
    });
    const existing = this.repository.findActiveByDeduplicationKey(deduplicationKey);
    if (existing) {
      const updated: Incident = {
        ...existing,
        severity: assessment.severity,
        classification: assessment.classification,
        observationIds: [
          ...new Set([...existing.observationIds, ...observationIds(assessment)]),
        ],
        updatedAt: assessment.generatedAt,
      };
      this.repository.save(updated);
      return this.record(assessment, {
        action: "UPDATED",
        incident: updated,
        reason: "A condição persiste; o incidente existente foi atualizado sem duplicação.",
      }, state);
    }

    const created: Incident = {
      id: this.nextId(),
      tenantId: assessment.tenantId,
      siteId: assessment.siteId,
      assetId: assessment.assetId,
      title: TITLES[assessment.code],
      status: "OPEN",
      severity: assessment.severity,
      classification: assessment.classification,
      deduplicationKey,
      observationIds: observationIds(assessment),
      evidenceIds: [],
      openedAt: assessment.generatedAt,
      updatedAt: assessment.generatedAt,
    };
    this.repository.save(created);
    return this.record(assessment, {
      action: "CREATED",
      incident: created,
      reason: "A política de persistência foi satisfeita; um incidente interno foi criado.",
    }, state);
  }

  auditRecords(): readonly IncidentAuditRecord[] {
    return this.runtimeStore.listAudit();
  }

  private handleHealthyAssessment(
    assessment: TriageAssessment,
    state: IncidentRuntimeState,
  ): IncidentDecision {
    state.lastProblemCode = undefined;
    state.consecutiveProblemAssessments = 0;
    const active = this.repository.findActiveByAsset(assessment.tenantId, assessment.assetId);
    if (active.length === 0) {
      state.consecutiveHealthyAssessments = 0;
      return this.record(assessment, {
        action: "NO_ACTION",
        reason: "O ativo está saudável e não possui incidente interno aberto.",
      }, state);
    }

    state.consecutiveHealthyAssessments += 1;
    if (state.consecutiveHealthyAssessments < 2) {
      return this.record(assessment, {
        action: "PENDING_RECOVERY",
        incident: active[0],
        requiredAssessments: 2,
        currentAssessments: state.consecutiveHealthyAssessments,
        reason: "Uma nova avaliação saudável é necessária para confirmar estabilidade.",
      }, state);
    }

    let lastResolved: Incident | undefined;
    for (const incident of active) {
      lastResolved = {
        ...incident,
        status: "RESOLVED",
        updatedAt: assessment.generatedAt,
        observationIds: [
          ...new Set([...incident.observationIds, ...observationIds(assessment)]),
        ],
      };
      this.repository.save(lastResolved);
    }
    state.consecutiveHealthyAssessments = 0;
    return this.record(assessment, {
      action: "RESOLVED",
      incident: lastResolved,
      reason: "Duas avaliações saudáveis consecutivas confirmaram a recuperação interna.",
    }, state);
  }

  private stateFor(assessment: TriageAssessment): IncidentRuntimeState {
    const key = `${assessment.tenantId}:${assessment.assetId}`;
    let state = this.states.get(key);
    if (!state) {
      state = this.runtimeStore.loadState(key) ?? {
        consecutiveProblemAssessments: 0,
        consecutiveHealthyAssessments: 0,
        processedAssessmentSignatures: new Set(),
      };
      this.states.set(key, state);
    }
    return state;
  }

  private record(
    assessment: TriageAssessment,
    decision: IncidentDecision,
    state: IncidentRuntimeState,
  ): IncidentDecision {
    const stateKey = `${assessment.tenantId}:${assessment.assetId}`;
    this.runtimeStore.saveState(stateKey, state);
    this.runtimeStore.appendAudit(
      Object.freeze({
        action: decision.action,
        tenantId: assessment.tenantId,
        assetId: assessment.assetId,
        ...(decision.incident ? { incidentId: decision.incident.id } : {}),
        triageCode: assessment.code,
        occurredAt: this.clock().toISOString(),
        reason: decision.reason,
      }),
    );
    return decision;
  }
}
