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
