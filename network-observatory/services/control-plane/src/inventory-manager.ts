import {
  ContractViolation,
  assertAsset,
  assertSite,
  assertTenant,
  assertTenantBoundary,
  assertUuid,
  type Asset,
  type AssetKind,
  type Site,
  type Tenant,
  type UUID,
} from "../../../packages/contracts/src/index.ts";
import type { RegisteredCollector } from "./types.ts";

export type AssetCriticality = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type MonitoringState = "ENABLED" | "PAUSED";

export interface ManagedAsset {
  asset: Asset;
  collectorId: UUID;
  expectedAddress?: string;
  criticality: AssetCriticality;
  monitoring: MonitoringState;
  /** Observations required before the system may call this asset healthy. */
  requiredObservationKinds: readonly string[];
}

export interface AssetFilter {
  kind?: AssetKind;
  siteId?: UUID;
}

export class InventoryManager {
  private readonly tenants = new Map<UUID, Tenant>();
  private readonly tenantCodes = new Map<string, UUID>();
  private readonly sites = new Map<UUID, Site>();
  private readonly collectors = new Map<UUID, RegisteredCollector>();
  private readonly assets = new Map<UUID, ManagedAsset>();

  constructor(collectors: readonly RegisteredCollector[] = []) {
    for (const collector of collectors) {
      assertUuid(collector.id, "collector.id");
      assertUuid(collector.tenantId, "collector.tenantId");
      assertUuid(collector.siteId, "collector.siteId");
      this.collectors.set(collector.id, Object.freeze({ ...collector }));
    }
  }

  registerTenant(tenant: Tenant): void {
    assertTenant(tenant);
    this.rejectDuplicate(this.tenants, tenant.id, "TENANT_ALREADY_EXISTS");
    if (this.tenantCodes.has(tenant.publicCode)) {
      throw new ContractViolation(
        "TENANT_PUBLIC_CODE_ALREADY_EXISTS",
        "Tenant public code must be unique",
      );
    }
    this.tenants.set(tenant.id, Object.freeze({ ...tenant }));
    this.tenantCodes.set(tenant.publicCode, tenant.id);
  }

  registerSite(site: Site): void {
    assertSite(site);
    this.rejectDuplicate(this.sites, site.id, "SITE_ALREADY_EXISTS");
    if (!this.tenants.has(site.tenantId)) {
      throw new ContractViolation("TENANT_NOT_FOUND", "Site tenant is not registered");
    }
    this.sites.set(site.id, Object.freeze({ ...site }));
  }

  registerAsset(managed: ManagedAsset): void {
    const { asset } = managed;
    assertAsset(asset);
    this.rejectDuplicate(this.assets, asset.id, "ASSET_ALREADY_EXISTS");
    const site = this.sites.get(asset.siteId);
    if (!site) throw new ContractViolation("SITE_NOT_FOUND", "Asset site is not registered");
    assertTenantBoundary(asset.tenantId, site);

    const collector = this.collectors.get(managed.collectorId);
    if (!collector || collector.status !== "ACTIVE") {
      throw new ContractViolation(
        "COLLECTOR_NOT_AUTHORIZED",
        "Managed asset requires an active registered collector",
      );
    }
    assertTenantBoundary(asset.tenantId, collector);
    if (collector.siteId !== asset.siteId) {
      throw new ContractViolation(
        "COLLECTOR_SCOPE",
        "Collector and asset must belong to the same site",
      );
    }
    if (managed.requiredObservationKinds.length === 0) {
      throw new ContractViolation(
        "MONITORING_REQUIREMENTS_EMPTY",
        "At least one observation kind is required to evaluate coverage",
      );
    }
    const uniqueKinds = [...new Set(managed.requiredObservationKinds.map((kind) => kind.trim()))];
    if (uniqueKinds.some((kind) => kind.length === 0)) {
      throw new ContractViolation(
        "MONITORING_REQUIREMENT_INVALID",
        "Observation kinds cannot be empty",
      );
    }
    this.assets.set(
      asset.id,
      Object.freeze({
        ...managed,
        asset: Object.freeze({ ...asset }),
        requiredObservationKinds: Object.freeze(uniqueKinds),
      }),
    );
  }

  tenant(tenantId: UUID): Tenant | undefined {
    return this.tenants.get(tenantId);
  }

  asset(tenantId: UUID, assetId: UUID): ManagedAsset | undefined {
    const managed = this.assets.get(assetId);
    return managed?.asset.tenantId === tenantId ? managed : undefined;
  }

  listAssets(tenantId: UUID, filter: AssetFilter = {}): readonly ManagedAsset[] {
    assertUuid(tenantId, "tenantId");
    return [...this.assets.values()].filter(
      (managed) =>
        managed.asset.tenantId === tenantId &&
        (!filter.kind || managed.asset.kind === filter.kind) &&
        (!filter.siteId || managed.asset.siteId === filter.siteId),
    );
  }

  private rejectDuplicate<T>(map: Map<UUID, T>, id: UUID, invariant: string): void {
    if (map.has(id)) throw new ContractViolation(invariant, `Identity ${id} is already registered`);
  }
}
