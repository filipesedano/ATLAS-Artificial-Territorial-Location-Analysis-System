import { readFileSync, renameSync, writeFileSync } from "node:fs";

import { assertObservation, type Observation } from "../../../packages/contracts/src/index.ts";
import type { ObservationOutbox } from "./types.ts";

export class InMemoryObservationOutbox implements ObservationOutbox {
  private readonly items = new Map<string, Observation>();

  enqueue(observations: readonly Observation[]): void {
    for (const observation of observations) {
      assertObservation(observation);
      if (!this.items.has(observation.idempotencyKey)) {
        this.items.set(observation.idempotencyKey, observation);
      }
    }
  }

  pending(): readonly Observation[] {
    return [...this.items.values()];
  }

  acknowledge(idempotencyKeys: readonly string[]): void {
    for (const key of idempotencyKeys) this.items.delete(key);
  }
}

/**
 * Minimal durable outbox for the simulator. Production will replace this with
 * transactional storage; retries preserve each observation's idempotency key.
 */
export class JsonFileObservationOutbox implements ObservationOutbox {
  private readonly memory = new InMemoryObservationOutbox();
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    try {
      const stored = JSON.parse(readFileSync(filePath, "utf8")) as Observation[];
      this.memory.enqueue(stored);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") throw error;
    }
  }

  enqueue(observations: readonly Observation[]): void {
    this.memory.enqueue(observations);
    this.persist();
  }

  pending(): readonly Observation[] {
    return this.memory.pending();
  }

  acknowledge(idempotencyKeys: readonly string[]): void {
    this.memory.acknowledge(idempotencyKeys);
    this.persist();
  }

  private persist(): void {
    const temporaryPath = `${this.filePath}.tmp`;
    writeFileSync(temporaryPath, JSON.stringify(this.memory.pending(), null, 2), {
      encoding: "utf8",
      mode: 0o600,
    });
    renameSync(temporaryPath, this.filePath);
  }
}

/** Bounds serialized payload; preserves pending evidence instead of silent eviction. */
export class BoundedObservationOutbox implements ObservationOutbox {
  constructor(
    privateStore: ObservationOutbox,
    limits = { maxBytes: 10 * 1024 * 1024, maxAgeMs: 48 * 60 * 60 * 1000 },
    clock: () => Date = () => new Date(),
  ) {
    if (!Number.isSafeInteger(limits.maxBytes) || limits.maxBytes <= 0 || !Number.isSafeInteger(limits.maxAgeMs) || limits.maxAgeMs <= 0) throw new Error("Invalid outbox limits");
    this.store = privateStore; this.limits = { ...limits }; this.clock = clock;
  }
  private readonly store: ObservationOutbox;
  private readonly limits: { maxBytes: number; maxAgeMs: number };
  private readonly clock: () => Date;
  status() {
    const items = this.store.pending();
    const bytes = Buffer.byteLength(JSON.stringify(items, null, 2));
    const expired = items.some(item => this.clock().getTime() - Date.parse(item.observedAt) >= this.limits.maxAgeMs);
    return { count: items.length, bytes, maxBytes: this.limits.maxBytes, expired, warning: expired || bytes >= this.limits.maxBytes * 0.8 };
  }
  enqueue(observations: readonly Observation[]): void {
    const merged = new Map(this.store.pending().map(item => [item.idempotencyKey, item]));
    for (const item of observations) { assertObservation(item); if (!merged.has(item.idempotencyKey)) merged.set(item.idempotencyKey, item); }
    const items = [...merged.values()];
    if (this.status().expired || items.some(item => this.clock().getTime() - Date.parse(item.observedAt) >= this.limits.maxAgeMs)) throw new Error("OUTBOX_AGE_LIMIT: synchronize or explicitly review pending records before collecting");
    if (Buffer.byteLength(JSON.stringify(items, null, 2)) > this.limits.maxBytes) throw new Error("OUTBOX_SIZE_LIMIT: pending records preserved; collection blocked");
    this.store.enqueue(observations);
  }
  pending(): readonly Observation[] { return this.store.pending(); }
  acknowledge(keys: readonly string[]): void { this.store.acknowledge(keys); }
}
