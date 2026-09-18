import type { CollectionPolicy } from "../../../packages/contracts/src/index.ts";
import type {
  ISODateTime,
  Observation,
  ProvenanceClass,
  UUID,
} from "../../../packages/contracts/src/index.ts";

export interface RegisteredCollector {
  policy?: CollectionPolicy;
  id: UUID;
  tenantId: UUID;
  siteId: UUID;
  status: "ACTIVE" | "SUSPENDED";
}

export interface IngestionResult {
  accepted: number;
  duplicates: number;
  acceptedIdempotencyKeys: readonly string[];
}

export type TriageState =
  | "HEALTHY"
  | "PREVENTIVE"
  | "ATTENTION"
  | "UNREACHABLE"
  | "INDETERMINATE";

export type TriageCode =
  | "PRINTER_READY"
  | "PRINTER_NO_COMMUNICATION"
  | "PRINTER_ICMP_UNAVAILABLE"
  | "PRINTER_PAPER_OUT"
  | "PRINTER_TONER_LOW"
  | "INSUFFICIENT_DATA";

export interface TriageFinding {
  classification: ProvenanceClass;
  message: string;
  observationIds: readonly UUID[];
}

export interface TriageAssessment {
  tenantId: UUID;
  siteId: UUID;
  assetId: UUID;
  code: TriageCode;
  state: TriageState;
  severity: "INFO" | "LOW" | "MEDIUM" | "HIGH";
  classification: "MEASURED" | "INFERRED" | "INDETERMINATE";
  confidence: "LOW" | "MEDIUM" | "HIGH";
  summary: string;
  findings: readonly TriageFinding[];
  hypotheses: readonly string[];
  recommendedChecks: readonly string[];
  humanConfirmationRequired: true;
  generatedAt: ISODateTime;
}

export interface AuditRecord {
  sequence: number;
  event:
    | "OBSERVATION_ACCEPTED"
    | "OBSERVATION_DUPLICATE"
    | "TRIAGE_GENERATED";
  tenantId: UUID;
  subjectId: UUID;
  occurredAt: ISODateTime;
  details: Readonly<Record<string, string | number | boolean>>;
}

export interface ObservationRepository {
  findByIdempotencyKey(key: string): Observation | undefined;
  save(observation: Observation): void;
  findByAsset(tenantId: UUID, assetId: UUID): readonly Observation[];
}

export type Clock = () => Date;
