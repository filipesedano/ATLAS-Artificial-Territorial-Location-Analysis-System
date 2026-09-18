import type { Site, Tenant } from "../../../packages/contracts/src/index.ts";
import { InventoryManager, type ManagedAsset } from "./inventory-manager.ts";
import type { LocalDatabase } from "./local-database.ts";
import type { RegisteredCollector } from "./types.ts";

export interface InventorySeed {
  collectors: readonly RegisteredCollector[];
  tenants: readonly Tenant[];
  sites: readonly Site[];
  assets: readonly ManagedAsset[];
}

export class SqliteInventoryStore {
  private readonly database: LocalDatabase;

  constructor(database: LocalDatabase) {
    this.database = database;
  }

  initialize(seed: InventorySeed): InventoryManager {
    const count = this.database.connection
      .prepare("SELECT COUNT(*) AS count FROM inventory_tenants")
      .get() as { count: number };
    if (Number(count.count) === 0) this.saveSeed(seed);
    return this.load();
  }

  private saveSeed(seed: InventorySeed): void {
    const validation = new InventoryManager(seed.collectors);
    for (const tenant of seed.tenants) validation.registerTenant(tenant);
    for (const site of seed.sites) validation.registerSite(site);
    for (const asset of seed.assets) validation.registerAsset(asset);

    const db = this.database.connection;
    db.exec("BEGIN IMMEDIATE");
    try {
      const collectorStatement = db.prepare(`
        INSERT INTO inventory_collectors (id, tenant_id, site_id, payload_json)
        VALUES (?, ?, ?, ?)
      `);
      for (const item of seed.collectors) {
        collectorStatement.run(item.id, item.tenantId, item.siteId, JSON.stringify(item));
      }
      const tenantStatement = db.prepare(`
        INSERT INTO inventory_tenants (id, public_code, payload_json) VALUES (?, ?, ?)
      `);
      for (const item of seed.tenants) {
        tenantStatement.run(item.id, item.publicCode, JSON.stringify(item));
      }
      const siteStatement = db.prepare(`
        INSERT INTO inventory_sites (id, tenant_id, payload_json) VALUES (?, ?, ?)
      `);
      for (const item of seed.sites) {
        siteStatement.run(item.id, item.tenantId, JSON.stringify(item));
      }
      const assetStatement = db.prepare(`
        INSERT INTO inventory_assets (id, tenant_id, site_id, kind, payload_json)
        VALUES (?, ?, ?, ?, ?)
      `);
      for (const item of seed.assets) {
        assetStatement.run(
          item.asset.id,
          item.asset.tenantId,
          item.asset.siteId,
          item.asset.kind,
          JSON.stringify(item),
        );
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  private load(): InventoryManager {
    const parseRows = <T>(table: string): T[] =>
      (
        this.database.connection.prepare(`SELECT payload_json FROM ${table}`).all() as {
          payload_json: string;
        }[]
      ).map((row) => JSON.parse(row.payload_json) as T);

    const collectors = parseRows<RegisteredCollector>("inventory_collectors");
    const manager = new InventoryManager(collectors);
    for (const tenant of parseRows<Tenant>("inventory_tenants")) manager.registerTenant(tenant);
    for (const site of parseRows<Site>("inventory_sites")) manager.registerSite(site);
    for (const asset of parseRows<ManagedAsset>("inventory_assets")) manager.registerAsset(asset);
    return manager;
  }
}
