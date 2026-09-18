import {
  PROVENANCE_CLASSES,
  type Asset,
  type Evidence,
  type Incident,
  type Observation,
  type ProvenanceClass,
  type Site,
  type Tenant,
  type TenantScoped,
} from "./contracts.ts";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TENANT_PUBLIC_CODE_PATTERN = /^[A-Z][0-9]{4,9}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/i;
const LOCAL_TIME_PATTERN = /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/;

export class ContractViolation extends Error {
  public readonly invariant: string;

  constructor(invariant: string, message: string) {
    super(message);
    this.name = "ContractViolation";
    this.invariant = invariant;
  }
}

function requireCondition(
  condition: unknown,
  invariant: string,
  message: string,
): asserts condition {
  if (!condition) throw new ContractViolation(invariant, message);
}

export function assertUuid(value: string, fieldName = "id"): void {
  requireCondition(
    UUID_PATTERN.test(value),
    "IDENTITY_FORMAT",
    `${fieldName} must be a valid, non-nil UUID`,
  );
}

export function assertIsoDateTime(value: string, fieldName: string): void {
  const parsed = Date.parse(value);
  requireCondition(
    Number.isFinite(parsed) && value.includes("T"),
    "TIME_FORMAT",
    `${fieldName} must be an ISO 8601 date-time`,
  );
}

export function assertProvenance(value: string): asserts value is ProvenanceClass {
  requireCondition(
    PROVENANCE_CLASSES.includes(value as ProvenanceClass),
    "PROVENANCE_REQUIRED",
    "Analytical information must have an explicit provenance classification",
  );
}

export function assertTenant(tenant: Tenant): void {
  assertUuid(tenant.id, "tenant.id");
  requireCondition(
    TENANT_PUBLIC_CODE_PATTERN.test(tenant.publicCode),
    "PUBLIC_CODE_FORMAT",
    "tenant.publicCode must use one uppercase letter followed by 4 to 9 digits",
  );
  requireCondition(
    tenant.name.trim().length > 0,
    "TENANT_NAME_REQUIRED",
    "tenant.name is required",
  );
  assertIsoDateTime(tenant.createdAt, "tenant.createdAt");
}

export function assertSite(site: Site): void {
  assertUuid(site.id, "site.id");
  assertUuid(site.tenantId, "site.tenantId");
  requireCondition(site.name.trim().length > 0, "SITE_NAME_REQUIRED", "site.name is required");
  try {
    new Intl.DateTimeFormat("en", { timeZone: site.timezone }).format();
  } catch {
    throw new ContractViolation("TIMEZONE_INVALID", "site.timezone must be an IANA timezone");
  }
  for (const window of site.operatingWindows) {
    requireCondition(
      LOCAL_TIME_PATTERN.test(window.opensAt) && LOCAL_TIME_PATTERN.test(window.closesAt),
      "OPERATING_WINDOW_FORMAT",
      "Operating window times must use HH:mm in the site's local timezone",
    );
    requireCondition(
      window.opensAt < window.closesAt,
      "OPERATING_WINDOW_ORDER",
      "Overnight windows must be represented as two separate weekday windows",
    );
  }
  assertIsoDateTime(site.createdAt, "site.createdAt");
}

export function assertAsset(asset: Asset, site?: Site): void {
  assertUuid(asset.id, "asset.id");
  assertUuid(asset.tenantId, "asset.tenantId");
  assertUuid(asset.siteId, "asset.siteId");
  requireCondition(asset.name.trim().length > 0, "ASSET_NAME_REQUIRED", "asset.name is required");
  assertIsoDateTime(asset.createdAt, "asset.createdAt");
  if (site) {
    assertTenantBoundary(asset.tenantId, site);
    requireCondition(
      asset.siteId === site.id,
      "SITE_ISOLATION",
      "asset.siteId must match the supplied site",
    );
  }
}

export function assertTenantBoundary(
  expectedTenantId: string,
  ...resources: readonly TenantScoped[]
): void {
  assertUuid(expectedTenantId, "expectedTenantId");
  for (const resource of resources) {
    requireCondition(
      resource.tenantId === expectedTenantId,
      "TENANT_ISOLATION",
      `Cross-tenant access denied: expected ${expectedTenantId}, received ${resource.tenantId}`,
    );
  }
}

export function assertObservation(observation: Observation): void {
  assertTenantBoundary(observation.tenantId, observation);
  assertUuid(observation.id, "observation.id");
  assertUuid(observation.siteId, "observation.siteId");
  assertUuid(observation.assetId, "observation.assetId");
  assertUuid(observation.collectorId, "observation.collectorId");
  assertProvenance(observation.provenance);
  assertIsoDateTime(observation.observedAt, "observation.observedAt");
  assertIsoDateTime(observation.receivedAt, "observation.receivedAt");
  requireCondition(
    observation.kind.trim().length > 0,
    "OBSERVATION_KIND_REQUIRED",
    "observation.kind is required",
  );
  requireCondition(
    observation.idempotencyKey.trim().length >= 8,
    "IDEMPOTENCY_REQUIRED",
    "observation.idempotencyKey must be stable and at least 8 characters",
  );
}

export function assertEvidence(evidence: Evidence): void {
  assertTenantBoundary(evidence.tenantId, evidence);
  assertUuid(evidence.id, "evidence.id");
  assertUuid(evidence.siteId, "evidence.siteId");
  if (evidence.assetId) assertUuid(evidence.assetId, "evidence.assetId");
  if (evidence.observationId) {
    assertUuid(evidence.observationId, "evidence.observationId");
  }
  assertProvenance(evidence.provenance);
  assertIsoDateTime(evidence.capturedAt, "evidence.capturedAt");
  requireCondition(
    SHA256_PATTERN.test(evidence.sha256),
    "EVIDENCE_INTEGRITY",
    "evidence.sha256 must contain a 64-character SHA-256 digest",
  );
}

export function assertIncident(
  incident: Incident,
  observations: readonly Observation[] = [],
  evidence: readonly Evidence[] = [],
): void {
  assertTenantBoundary(incident.tenantId, incident, ...observations, ...evidence);
  assertUuid(incident.id, "incident.id");
  assertUuid(incident.siteId, "incident.siteId");
  if (incident.assetId) assertUuid(incident.assetId, "incident.assetId");
  assertProvenance(incident.classification);
  assertIsoDateTime(incident.openedAt, "incident.openedAt");
  assertIsoDateTime(incident.updatedAt, "incident.updatedAt");
  requireCondition(
    incident.title.trim().length > 0,
    "INCIDENT_TITLE_REQUIRED",
    "incident.title is required",
  );
  requireCondition(
    incident.deduplicationKey.trim().length >= 8,
    "INCIDENT_DEDUPLICATION_REQUIRED",
    "incident.deduplicationKey must be stable and at least 8 characters",
  );
  for (const observation of observations) {
    requireCondition(
      observation.siteId === incident.siteId,
      "SITE_ISOLATION",
      "Incident observations must belong to the incident site",
    );
  }
  for (const item of evidence) {
    requireCondition(
      item.siteId === incident.siteId,
      "SITE_ISOLATION",
      "Incident evidence must belong to the incident site",
    );
  }
}

/**
 * Correlation candidate only. A matching key does not prove a root cause and
 * does not authorize remediation.
 */
export function buildIncidentDeduplicationKey(input: {
  tenantId: string;
  siteId: string;
  assetId?: string;
  kind: string;
}): string {
  const normalizedKind = input.kind.trim().toLowerCase().replace(/\s+/g, "-");
  requireCondition(
    normalizedKind.length > 0,
    "INCIDENT_KIND_REQUIRED",
    "Incident kind is required to build a deduplication key",
  );
  return [input.tenantId, input.siteId, input.assetId ?? "site", normalizedKind].join(":");
}
