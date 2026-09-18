import { randomUUID } from "node:crypto";
import { isIP } from "node:net";

import {
  ContractViolation,
  assertAsset,
  assertObservation,
  assertTenantBoundary,
  assertUuid,
  type Observation,
} from "../../../packages/contracts/src/index.ts";
import type {
  Clock,
  CollectionResult,
  CollectorIdentity,
  IdGenerator,
  MonitoredPrinter,
  ObservationOutbox,
  ObservationTransport,
  Probe,
  SyncResult,
} from "./types.ts";

export class CollectorSimulator {
  private readonly identity: CollectorIdentity;
  private readonly probe: Probe;
  private readonly outbox: ObservationOutbox;
  private readonly clock: Clock;
  private readonly nextId: IdGenerator;

  constructor(
    identity: CollectorIdentity,
    probe: Probe,
    outbox: ObservationOutbox,
    clock: Clock = () => new Date(),
    nextId: IdGenerator = randomUUID,
  ) {
    this.identity = identity;
    this.probe = probe;
    this.outbox = outbox;
    this.clock = clock;
    this.nextId = nextId;
    assertUuid(identity.id, "collector.id");
    assertUuid(identity.tenantId, "collector.tenantId");
    assertUuid(identity.siteId, "collector.siteId");
    for (const assetId of identity.authorizedAssetIds) {
      assertUuid(assetId, "collector.authorizedAssetIds[]");
    }
  }

  collect(target: MonitoredPrinter): CollectionResult {
    this.assertAuthorizedTarget(target);

    const observedAt = this.clock().toISOString();
    const runId = `${this.identity.id}:${target.asset.id}:${observedAt}`;
    const observations = this.probe.inspect(target).map((reading, index): Observation => {
      const observation: Observation = {
        id: this.nextId(),
        tenantId: this.identity.tenantId,
        siteId: this.identity.siteId,
        assetId: target.asset.id,
        collectorId: this.identity.id,
        kind: reading.kind,
        value: reading.value,
        ...(reading.unit ? { unit: reading.unit } : {}),
        provenance: "MEASURED",
        observedAt,
        receivedAt: observedAt,
        idempotencyKey: `${runId}:${index}:${reading.kind}`,
      };
      assertObservation(observation);
      return observation;
    });

    this.outbox.enqueue(observations);
    return { runId, observations, queued: this.outbox.pending().length };
  }

  async synchronize(transport: ObservationTransport): Promise<SyncResult> {
    const batch = this.outbox.pending();
    if (batch.length === 0) return { attempted: 0, acknowledged: 0, remaining: 0 };

    const acknowledgedKeys = await transport.send(batch);
    const attemptedKeys = new Set(batch.map((item) => item.idempotencyKey));
    const safeAcknowledgements = [...new Set(acknowledgedKeys)].filter((key) =>
      attemptedKeys.has(key),
    );
    this.outbox.acknowledge(safeAcknowledgements);

    return {
      attempted: batch.length,
      acknowledged: safeAcknowledgements.length,
      remaining: this.outbox.pending().length,
    };
  }

  pendingObservations(): readonly Observation[] {
    return this.outbox.pending();
  }

  private assertAuthorizedTarget(target: MonitoredPrinter): void {
    assertAsset(target.asset);
    assertTenantBoundary(this.identity.tenantId, target.asset);
    if (target.asset.siteId !== this.identity.siteId) {
      throw new ContractViolation(
        "COLLECTOR_SCOPE",
        "Collector cannot inspect an asset outside its authorized site",
      );
    }
    if (!this.identity.authorizedAssetIds.includes(target.asset.id)) {
      throw new ContractViolation(
        "ASSET_NOT_AUTHORIZED",
        "Collector cannot inspect an asset not approved by the network manager",
      );
    }
    if (isIP(target.ipAddress) === 0) {
      throw new ContractViolation(
        "NETWORK_ADDRESS_INVALID",
        "Monitored target must have a valid IPv4 or IPv6 address",
      );
    }
    if (target.asset.kind !== "PRINTER") {
      throw new ContractViolation(
        "COLLECTOR_CAPABILITY",
        "Collector Simulator v0.1 accepts only PRINTER assets",
      );
    }
  }
}
