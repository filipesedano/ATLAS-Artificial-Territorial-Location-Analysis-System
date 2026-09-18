import type { Incident, Observation, UUID } from "../../../packages/contracts/src/index.ts";
import type { IncidentRepository } from "./incident-manager.ts";
import type { LocalDatabase } from "./local-database.ts";
import type { ObservationRepository } from "./types.ts";

function parsePayload<T>(row: unknown): T | undefined {
  if (!row) return undefined;
  return JSON.parse((row as { payload_json: string }).payload_json) as T;
}

export class SqliteObservationRepository implements ObservationRepository {
  private readonly database: LocalDatabase;

  constructor(database: LocalDatabase) {
    this.database = database;
  }

  findByIdempotencyKey(key: string): Observation | undefined {
    const row = this.database.connection
      .prepare("SELECT payload_json FROM observations WHERE idempotency_key = ?")
      .get(key);
    return parsePayload<Observation>(row);
  }

  save(observation: Observation): void {
    this.database.connection
      .prepare(`
        INSERT INTO observations
          (idempotency_key, id, tenant_id, site_id, asset_id, observed_at, payload_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        observation.idempotencyKey,
        observation.id,
        observation.tenantId,
        observation.siteId,
        observation.assetId,
        observation.observedAt,
        JSON.stringify(observation),
      );
  }

  findByAsset(tenantId: UUID, assetId: UUID): readonly Observation[] {
    const rows = this.database.connection
      .prepare(`
        SELECT payload_json FROM observations
        WHERE tenant_id = ? AND asset_id = ?
        ORDER BY observed_at ASC
      `)
      .all(tenantId, assetId) as { payload_json: string }[];
    return rows.map((row) => JSON.parse(row.payload_json) as Observation);
  }
}

export class SqliteIncidentRepository implements IncidentRepository {
  private readonly database: LocalDatabase;

  constructor(database: LocalDatabase) {
    this.database = database;
  }

  save(incident: Incident): void {
    this.database.connection
      .prepare(`
        INSERT INTO incidents
          (id, tenant_id, site_id, asset_id, deduplication_key, status, updated_at, payload_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          status = excluded.status,
          updated_at = excluded.updated_at,
          payload_json = excluded.payload_json
      `)
      .run(
        incident.id,
        incident.tenantId,
        incident.siteId,
        incident.assetId ?? null,
        incident.deduplicationKey,
        incident.status,
        incident.updatedAt,
        JSON.stringify(incident),
      );
  }

  findActiveByDeduplicationKey(key: string): Incident | undefined {
    const row = this.database.connection
      .prepare(`
        SELECT payload_json FROM incidents
        WHERE deduplication_key = ? AND status IN ('OPEN', 'ACKNOWLEDGED')
        ORDER BY updated_at DESC LIMIT 1
      `)
      .get(key);
    return parsePayload<Incident>(row);
  }

  findActiveByAsset(tenantId: UUID, assetId: UUID): readonly Incident[] {
    const rows = this.database.connection
      .prepare(`
        SELECT payload_json FROM incidents
        WHERE tenant_id = ? AND asset_id = ? AND status IN ('OPEN', 'ACKNOWLEDGED')
        ORDER BY updated_at DESC
      `)
      .all(tenantId, assetId) as { payload_json: string }[];
    return rows.map((row) => JSON.parse(row.payload_json) as Incident);
  }

  listByTenant(tenantId: UUID): readonly Incident[] {
    const rows = this.database.connection
      .prepare(`
        SELECT payload_json FROM incidents
        WHERE tenant_id = ? ORDER BY updated_at DESC
      `)
      .all(tenantId) as { payload_json: string }[];
    return rows.map((row) => JSON.parse(row.payload_json) as Incident);
  }
}
