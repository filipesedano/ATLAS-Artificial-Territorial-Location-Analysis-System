import type { Observation, UUID } from "../../../packages/contracts/src/index.ts";
import type { InventoryManager, ManagedAsset } from "./inventory-manager.ts";
import { PrinterTriageEngine } from "./triage-engine.ts";
import type { Clock, ObservationRepository } from "./types.ts";

export type ProjectedAssetStatus =
  | "HEALTHY"
  | "ATTENTION"
  | "UNREACHABLE"
  | "STALE"
  | "UNKNOWN"
  | "MAINTENANCE"
  | "RETIRED";

export type Coverage = "FULL" | "PARTIAL" | "NONE";

export interface AssetStatusProjection {
  tenantId: UUID;
  siteId: UUID;
  assetId: UUID;
  name: string;
  kind: ManagedAsset["asset"]["kind"];
  expectedAddress?: string;
  status: ProjectedAssetStatus;
  coverage: Coverage;
  observedKinds: readonly string[];
  missingKinds: readonly string[];
  lastObservedAt?: string;
  reason: string;
  computedAt: string;
}

export interface TenantOverviewProjection {
  tenantId: UUID;
  computedAt: string;
  totalAssets: number;
  byStatus: Readonly<Record<ProjectedAssetStatus, number>>;
  fullCoverage: number;
  partialCoverage: number;
  noCoverage: number;
  safeToClaimHealthy: boolean;
}

export interface StatusProjectorOptions {
  freshnessMs?: number;
}

function latestByKind(observations: readonly Observation[]): Map<string, Observation> {
  const result = new Map<string, Observation>();
  for (const item of observations) {
    const existing = result.get(item.kind);
    if (!existing || item.observedAt > existing.observedAt) result.set(item.kind, item);
  }
  return result;
}

export class StatusProjector {
  private readonly freshnessMs: number;
  private readonly inventory: InventoryManager;
  private readonly observations: ObservationRepository;
  private readonly printerTriage: PrinterTriageEngine;
  private readonly clock: Clock;

  constructor(
    inventory: InventoryManager,
    observations: ObservationRepository,
    printerTriage: PrinterTriageEngine,
    clock: Clock = () => new Date(),
    options: StatusProjectorOptions = {},
  ) {
    this.inventory = inventory;
    this.observations = observations;
    this.printerTriage = printerTriage;
    this.clock = clock;
    this.freshnessMs = options.freshnessMs ?? 5 * 60 * 1_000;
  }

  projectAsset(managed: ManagedAsset): AssetStatusProjection {
    const now = this.clock();
    const all = this.observations.findByAsset(managed.asset.tenantId, managed.asset.id);
    const latest = latestByKind(all);
    const fresh = [...latest.values()].filter((item) => {
      const age = now.getTime() - Date.parse(item.observedAt);
      return age >= -60_000 && age <= this.freshnessMs;
    });
    const freshKinds = new Set(fresh.map((item) => item.kind));
    const observedKinds = managed.requiredObservationKinds.filter((kind) => freshKinds.has(kind));
    const missingKinds = managed.requiredObservationKinds.filter((kind) => !freshKinds.has(kind));
    const coverage: Coverage =
      observedKinds.length === 0
        ? "NONE"
        : missingKinds.length === 0
          ? "FULL"
          : "PARTIAL";
    const lastObservedAt = all.length
      ? all.reduce((latestAt, item) => (item.observedAt > latestAt ? item.observedAt : latestAt), all[0].observedAt)
      : undefined;
    const base = {
      tenantId: managed.asset.tenantId,
      siteId: managed.asset.siteId,
      assetId: managed.asset.id,
      name: managed.asset.name,
      kind: managed.asset.kind,
      ...(managed.expectedAddress ? { expectedAddress: managed.expectedAddress } : {}),
      coverage,
      observedKinds,
      missingKinds,
      ...(lastObservedAt ? { lastObservedAt } : {}),
      computedAt: now.toISOString(),
    };

    if (managed.asset.status === "RETIRED") {
      return { ...base, status: "RETIRED", reason: "Ativo retirado administrativamente." };
    }
    if (managed.asset.status === "MAINTENANCE" || managed.monitoring === "PAUSED") {
      return { ...base, status: "MAINTENANCE", reason: "Manutenção ou pausa previamente registrada." };
    }
    if (all.length === 0) {
      return { ...base, status: "UNKNOWN", reason: "Nenhuma observação recebida para o ativo." };
    }
    if (fresh.length === 0) {
      return { ...base, status: "STALE", reason: "As últimas observações ultrapassaram a janela de atualização." };
    }

    if (managed.asset.kind === "PRINTER") {
      const assessment = this.printerTriage.assess(fresh);
      if (assessment.state === "UNREACHABLE") {
        return { ...base, status: "UNREACHABLE", reason: assessment.summary };
      }
      if (assessment.state === "ATTENTION" || assessment.state === "PREVENTIVE") {
        return { ...base, status: "ATTENTION", reason: assessment.summary };
      }
      if (assessment.state === "HEALTHY" && coverage === "FULL") {
        return { ...base, status: "HEALTHY", reason: assessment.summary };
      }
      return {
        ...base,
        status: "UNKNOWN",
        reason:
          coverage === "FULL"
            ? assessment.summary
            : "Existem respostas, mas faltam medições obrigatórias para declarar o ativo saudável.",
      };
    }

    const reachable = fresh.filter((item) => item.kind.endsWith(".reachable"));
    if (coverage === "FULL" && reachable.length > 0 && reachable.every((item) => item.value === true)) {
      return { ...base, status: "HEALTHY", reason: "Todas as verificações obrigatórias recentes responderam." };
    }
    if (coverage === "FULL" && reachable.length > 0 && reachable.every((item) => item.value === false)) {
      return { ...base, status: "UNREACHABLE", reason: "Nenhuma verificação obrigatória recente respondeu." };
    }
    return {
      ...base,
      status: "UNKNOWN",
      reason: "Cobertura incompleta ou sinais insuficientes para uma classificação segura.",
    };
  }

  projectTenant(tenantId: UUID): TenantOverviewProjection {
    const projections = this.inventory.listAssets(tenantId).map((item) => this.projectAsset(item));
    const statuses: ProjectedAssetStatus[] = [
      "HEALTHY", "ATTENTION", "UNREACHABLE", "STALE", "UNKNOWN", "MAINTENANCE", "RETIRED",
    ];
    const byStatus = Object.fromEntries(
      statuses.map((status) => [status, projections.filter((item) => item.status === status).length]),
    ) as Record<ProjectedAssetStatus, number>;
    const fullCoverage = projections.filter((item) => item.coverage === "FULL").length;
    const partialCoverage = projections.filter((item) => item.coverage === "PARTIAL").length;
    const noCoverage = projections.filter((item) => item.coverage === "NONE").length;
    return {
      tenantId,
      computedAt: this.clock().toISOString(),
      totalAssets: projections.length,
      byStatus,
      fullCoverage,
      partialCoverage,
      noCoverage,
      safeToClaimHealthy:
        projections.length > 0 &&
        byStatus.HEALTHY === projections.length &&
        fullCoverage === projections.length,
    };
  }
}
