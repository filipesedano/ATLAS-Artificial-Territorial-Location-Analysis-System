import { ContractViolation } from "./invariants.ts";
import type { Observation } from "./contracts.ts";

export interface CollectionPolicy {
  version: "collection-policy/0.1";
  id: string;
  approvedBy: string;
  tenantId: string;
  siteId: string;
  collectorId: string;
  mode: "SIMULATED";
  state: "ACTIVE" | "PAUSED" | "REVOKED";
  validFrom: string;
  validUntil: string;
  minIntervalMs: number;
  targets: readonly { assetId: string; address: string; metrics: readonly string[] }[];
}
export function assertCollectionAllowed(policy: CollectionPolicy | undefined, scope: {
  tenantId: string; siteId: string; collectorId: string; assetId: string;
}, now: Date, kind?: string, address?: string): void {
  const deny = () => { throw new ContractViolation("COLLECTION_DENIED", "Collection policy absent, inactive, expired or outside authorized scope"); };
  if (!policy || policy.version !== "collection-policy/0.1" || policy.mode !== "SIMULATED" ||
      !Number.isSafeInteger(policy.minIntervalMs) || policy.minIntervalMs < 1000 ||
      !policy.id || !policy.approvedBy || policy.state !== "ACTIVE" ||
      !(Date.parse(policy.validFrom) <= now.getTime() && now.getTime() < Date.parse(policy.validUntil)) ||
      policy.tenantId !== scope.tenantId || policy.siteId !== scope.siteId || policy.collectorId !== scope.collectorId) return deny();
  const target = policy.targets.find(item => item.assetId === scope.assetId);
  if (!target || !target.metrics.length || (kind !== undefined && !target.metrics.includes(kind)) ||
      (address !== undefined && target.address !== address)) return deny();
}
export function assertObservationAllowed(policy: CollectionPolicy | undefined, item: Observation, now: Date): void {
  assertCollectionAllowed(policy, item, now, item.kind);
  if (!policy || !(Date.parse(policy.validFrom) <= Date.parse(item.observedAt) && Date.parse(item.observedAt) < Date.parse(policy.validUntil))) {
    throw new ContractViolation("COLLECTION_DENIED", "Observation was recorded outside the authorization window");
  }
}
/** Explicit synthetic grant for demonstrations only. Never authorizes real network access. */
export function simulatedPolicy(tenantId: string, siteId: string, collectorId: string, assetId: string): CollectionPolicy {
  return {
    version: "collection-policy/0.1", id: "local-simulation-v1", approvedBy: "DEMO_ONLY_NOT_HUMAN_CONSENT",
    tenantId, siteId, collectorId, mode: "SIMULATED", state: "ACTIVE",
    validFrom: "2026-09-01T00:00:00Z", validUntil: "2026-10-01T00:00:00Z",
    minIntervalMs: 1000,
    targets: [{ assetId, address: "192.168.1.45", metrics: ["icmp.reachable", "tcp.9100.reachable", "snmp.reachable", "printer.state", "printer.paper.percent", "printer.toner.black.percent"] }],
  };
}
