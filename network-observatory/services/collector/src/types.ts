import type { CollectionPolicy } from "../../../packages/contracts/src/index.ts";
import type { Asset, Observation, UUID } from "../../../packages/contracts/src/index.ts";

export type PrinterScenario =
  | "HEALTHY"
  | "NO_COMMUNICATION"
  | "ICMP_BLOCKED"
  | "PAPER_OUT"
  | "TONER_LOW";

export interface CollectorIdentity {
  policy?: CollectionPolicy;
  id: UUID;
  tenantId: UUID;
  siteId: UUID;
  name: string;
  /** Closed scope approved by the network manager. */
  authorizedAssetIds: readonly UUID[];
}

export interface MonitoredPrinter {
  asset: Asset;
  ipAddress: string;
  scenario: PrinterScenario;
}

export interface ProbeReading {
  kind: string;
  value: string | number | boolean | null;
  unit?: string;
}

export interface Probe {
  inspect(target: MonitoredPrinter): readonly ProbeReading[];
}

export interface ObservationOutbox {
  enqueue(observations: readonly Observation[]): void;
  pending(): readonly Observation[];
  acknowledge(idempotencyKeys: readonly string[]): void;
}

export interface ObservationTransport {
  send(observations: readonly Observation[]): Promise<readonly string[]>;
}

export interface CollectionResult {
  runId: string;
  observations: readonly Observation[];
  queued: number;
}

export interface SyncResult {
  attempted: number;
  acknowledged: number;
  remaining: number;
}

export type Clock = () => Date;
export type IdGenerator = () => UUID;
