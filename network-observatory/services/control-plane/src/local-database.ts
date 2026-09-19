import { AUTH_SCHEMA_SQL } from "./local-auth.ts";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

export const LOCAL_SCHEMA_VERSION = 2;

interface Migration {
  version: number;
  statements: string;
}

const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    statements: `
      CREATE TABLE observations (
        idempotency_key TEXT PRIMARY KEY,
        id TEXT NOT NULL UNIQUE,
        tenant_id TEXT NOT NULL,
        site_id TEXT NOT NULL,
        asset_id TEXT NOT NULL,
        observed_at TEXT NOT NULL,
        payload_json TEXT NOT NULL
      ) STRICT;
      CREATE INDEX observations_asset_time
        ON observations (tenant_id, asset_id, observed_at);

      CREATE TABLE incidents (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        site_id TEXT NOT NULL,
        asset_id TEXT,
        deduplication_key TEXT NOT NULL,
        status TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        payload_json TEXT NOT NULL
      ) STRICT;
      CREATE INDEX incidents_tenant ON incidents (tenant_id, updated_at);
      CREATE INDEX incidents_dedup ON incidents (deduplication_key, status);

      CREATE TABLE inventory_collectors (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        site_id TEXT NOT NULL,
        payload_json TEXT NOT NULL
      ) STRICT;
      CREATE TABLE inventory_tenants (
        id TEXT PRIMARY KEY,
        public_code TEXT NOT NULL UNIQUE,
        payload_json TEXT NOT NULL
      ) STRICT;
      CREATE TABLE inventory_sites (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        payload_json TEXT NOT NULL
      ) STRICT;
      CREATE TABLE inventory_assets (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        site_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        payload_json TEXT NOT NULL
      ) STRICT;

      CREATE TABLE incident_runtime_state (
        state_key TEXT PRIMARY KEY,
        payload_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;
      CREATE TABLE incident_audit (
        sequence INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id TEXT NOT NULL,
        asset_id TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        payload_json TEXT NOT NULL
      ) STRICT;
    `,
  },
  { version: 2, statements: AUTH_SCHEMA_SQL },
];

export class LocalDatabase {
  public readonly connection: DatabaseSync;
  public readonly path: string;

  constructor(path: string) {
    this.path = path;
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.connection = new DatabaseSync(path);
    this.connection.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
    if (path !== ":memory:") this.connection.exec("PRAGMA journal_mode = WAL;");
    this.migrate();
  }

  schemaVersion(): number {
    const row = this.connection
      .prepare("SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations")
      .get() as { version: number };
    return Number(row.version);
  }

  integrityCheck(): string {
    const row = this.connection.prepare("PRAGMA integrity_check").get() as {
      integrity_check: string;
    };
    return row.integrity_check;
  }

  close(): void {
    this.connection.close();
  }

  private migrate(): void {
    this.connection.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      ) STRICT;
    `);
    const current = this.schemaVersion();
    if (current > LOCAL_SCHEMA_VERSION) {
      throw new Error(
        `Database schema ${current} is newer than supported version ${LOCAL_SCHEMA_VERSION}`,
      );
    }
    for (const migration of MIGRATIONS.filter((item) => item.version > current)) {
      this.connection.exec("BEGIN IMMEDIATE");
      try {
        this.connection.exec(migration.statements);
        this.connection
          .prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)")
          .run(migration.version, new Date().toISOString());
        this.connection.exec("COMMIT");
      } catch (error) {
        this.connection.exec("ROLLBACK");
        throw error;
      }
    }
  }
}
