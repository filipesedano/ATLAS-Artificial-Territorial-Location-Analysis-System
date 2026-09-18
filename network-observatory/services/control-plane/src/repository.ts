import type { Observation, UUID } from "../../../packages/contracts/src/index.ts";
import type { ObservationRepository } from "./types.ts";

export class InMemoryObservationRepository implements ObservationRepository {
  private readonly byIdempotencyKey = new Map<string, Observation>();

  findByIdempotencyKey(key: string): Observation | undefined {
    return this.byIdempotencyKey.get(key);
  }

  save(observation: Observation): void {
    this.byIdempotencyKey.set(observation.idempotencyKey, observation);
  }

  findByAsset(tenantId: UUID, assetId: UUID): readonly Observation[] {
    return [...this.byIdempotencyKey.values()].filter(
      (item) => item.tenantId === tenantId && item.assetId === assetId,
    );
  }
}
