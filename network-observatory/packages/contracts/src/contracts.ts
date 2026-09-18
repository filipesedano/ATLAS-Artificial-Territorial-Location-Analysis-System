/**
 * ATLAS Network Observatory — shared domain contracts.
 *
 * These contracts contain no database, transport or UI concerns. They are the
 * vocabulary shared by the Collector, Control Plane and Web application.
 */

export const PROVENANCE_CLASSES = [
  "MEASURED",
  "ESTIMATED",
  "INFERRED",
  "INDETERMINATE",
] as const;

export type ProvenanceClass = (typeof PROVENANCE_CLASSES)[number];

export type UUID = string;
export type ISODateTime = string;
export type TenantPublicCode = string;

export interface Tenant {
  id: UUID;
  publicCode: TenantPublicCode;
  name: string;
  status: "ACTIVE" | "SUSPENDED" | "ARCHIVED";
  createdAt: ISODateTime;
}

export interface OperatingWindow {
  /** ISO weekday: 1 = Monday, 7 = Sunday. */
  weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  opensAt: string;
  closesAt: string;
}

export interface Site {
  id: UUID;
  tenantId: UUID;
  name: string;
  timezone: string;
  criticality: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  operatingWindows: readonly OperatingWindow[];
  createdAt: ISODateTime;
}

export type AssetKind =
  | "ROUTER"
  | "SWITCH"
  | "ACCESS_POINT"
  | "SERVER"
  | "WORKSTATION"
  | "PRINTER"
  | "CAMERA"
  | "NVR"
  | "UPS"
  | "OTHER";

export interface Asset {
  id: UUID;
  tenantId: UUID;
  siteId: UUID;
  name: string;
  kind: AssetKind;
  status: "ACTIVE" | "MAINTENANCE" | "RETIRED";
  createdAt: ISODateTime;
}

export type ObservationValue = string | number | boolean | null;

export interface Observation {
  id: UUID;
  tenantId: UUID;
  siteId: UUID;
  assetId: UUID;
  collectorId: UUID;
  kind: string;
  value: ObservationValue;
  unit?: string;
  provenance: ProvenanceClass;
  observedAt: ISODateTime;
  receivedAt: ISODateTime;
  /** Stable at the producer; retries must reuse this value. */
  idempotencyKey: string;
}

export interface Evidence {
  id: UUID;
  tenantId: UUID;
  siteId: UUID;
  assetId?: UUID;
  observationId?: UUID;
  source: "COLLECTOR" | "CONTROL_PLANE" | "HUMAN" | "EXTERNAL_SYSTEM";
  provenance: ProvenanceClass;
  contentType: string;
  /** Integrity digest; never a claim that the content is true. */
  sha256: string;
  capturedAt: ISODateTime;
}

export interface Incident {
  id: UUID;
  tenantId: UUID;
  siteId: UUID;
  assetId?: UUID;
  title: string;
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "CLOSED";
  severity: "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  classification: ProvenanceClass;
  /** Stable correlation key used to avoid duplicate open incidents. */
  deduplicationKey: string;
  observationIds: readonly UUID[];
  evidenceIds: readonly UUID[];
  openedAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface TenantScoped {
  tenantId: UUID;
}
