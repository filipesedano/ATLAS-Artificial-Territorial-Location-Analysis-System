import type {
  IncidentAuditRecord,
  IncidentRuntimeState,
  IncidentRuntimeStore,
} from "./incident-manager.ts";
import type { LocalDatabase } from "./local-database.ts";

interface SerializedState {
  lastProblemCode?: IncidentRuntimeState["lastProblemCode"];
  consecutiveProblemAssessments: number;
  consecutiveHealthyAssessments: number;
  processedAssessmentSignatures: string[];
}

export class SqliteIncidentRuntimeStore implements IncidentRuntimeStore {
  private readonly database: LocalDatabase;

  constructor(database: LocalDatabase) {
    this.database = database;
  }

  loadState(stateKey: string): IncidentRuntimeState | undefined {
    const row = this.database.connection
      .prepare("SELECT payload_json FROM incident_runtime_state WHERE state_key = ?")
      .get(stateKey) as { payload_json: string } | undefined;
    if (!row) return undefined;
    const value = JSON.parse(row.payload_json) as SerializedState;
    return {
      ...value,
      processedAssessmentSignatures: new Set(value.processedAssessmentSignatures),
    };
  }

  saveState(stateKey: string, state: IncidentRuntimeState): void {
    const payload: SerializedState = {
      ...(state.lastProblemCode ? { lastProblemCode: state.lastProblemCode } : {}),
      consecutiveProblemAssessments: state.consecutiveProblemAssessments,
      consecutiveHealthyAssessments: state.consecutiveHealthyAssessments,
      processedAssessmentSignatures: [...state.processedAssessmentSignatures],
    };
    this.database.connection
      .prepare(`
        INSERT INTO incident_runtime_state (state_key, payload_json, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(state_key) DO UPDATE SET
          payload_json = excluded.payload_json,
          updated_at = excluded.updated_at
      `)
      .run(stateKey, JSON.stringify(payload), new Date().toISOString());
  }

  appendAudit(record: Omit<IncidentAuditRecord, "sequence">): IncidentAuditRecord {
    const result = this.database.connection
      .prepare(`
        INSERT INTO incident_audit (tenant_id, asset_id, occurred_at, payload_json)
        VALUES (?, ?, ?, ?)
      `)
      .run(record.tenantId, record.assetId, record.occurredAt, JSON.stringify(record));
    return { ...record, sequence: Number(result.lastInsertRowid) };
  }

  listAudit(): readonly IncidentAuditRecord[] {
    const rows = this.database.connection
      .prepare("SELECT sequence, payload_json FROM incident_audit ORDER BY sequence ASC")
      .all() as { sequence: number; payload_json: string }[];
    return rows.map((row) => ({
      ...(JSON.parse(row.payload_json) as Omit<IncidentAuditRecord, "sequence">),
      sequence: Number(row.sequence),
    }));
  }
}
