import { simulatedPolicy, type CollectionPolicy } from "../../../packages/contracts/src/index.ts";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  createAtlasHttpServer,
  IncidentManager,
  LocalDatabase,
  MinimalControlPlane,
  PrinterTriageEngine,
  SqliteIncidentRepository,
  SqliteIncidentRuntimeStore,
  SqliteInventoryStore,
  SqliteObservationRepository,
  StatusProjector,
} from "./index.ts";

const operatorToken = process.env.ATLAS_OPERATOR_TOKEN;
const collectorToken = process.env.ATLAS_COLLECTOR_TOKEN;
if (!operatorToken || !collectorToken) {
  throw new Error("ATLAS_OPERATOR_TOKEN and ATLAS_COLLECTOR_TOKEN are required");
}

const collectorId =
  process.env.ATLAS_COLLECTOR_ID ?? "018f1d92-a0e1-7b22-8f13-f6783977f005";
const tenantId = process.env.ATLAS_TENANT_ID ?? "018f1d92-a0e1-7b22-8f13-f6783977f001";
const siteId = process.env.ATLAS_SITE_ID ?? "018f1d92-a0e1-7b22-8f13-f6783977f003";
const port = Number(process.env.ATLAS_HTTP_PORT ?? "8080");
const databasePath = process.env.ATLAS_DB_PATH ?? resolve(process.cwd(), "data", "atlas-local.db");

const localDatabase = new LocalDatabase(databasePath);
const incidentRepository = new SqliteIncidentRepository(localDatabase);
const observationRepository = new SqliteObservationRepository(localDatabase);
const triageEngine = new PrinterTriageEngine();
const collectionPolicy: CollectionPolicy = process.env.ATLAS_COLLECTION_POLICY_FILE
  ? JSON.parse(readFileSync(process.env.ATLAS_COLLECTION_POLICY_FILE, "utf8"))
  : simulatedPolicy(tenantId, siteId, collectorId, "018f1d92-a0e1-7b22-8f13-f6783977f004");

const registeredCollector = { id: collectorId, tenantId, siteId, status: "ACTIVE" as const, policy: collectionPolicy };
const controlPlane = new MinimalControlPlane(
  [registeredCollector],
  observationRepository,
  triageEngine,
);
const incidentManager = new IncidentManager(
  incidentRepository,
  randomUUID,
  () => new Date(),
  new SqliteIncidentRuntimeStore(localDatabase),
);
const createdAt = "2026-09-16T12:00:00.000Z";
const tenant = {
  id: tenantId,
  publicCode: "A4527",
  name: "Ambiente Local ATLAS",
  status: "ACTIVE",
  createdAt,
} as const;
const site = {
  id: siteId,
  tenantId,
  name: "Unidade Local Simulada",
  timezone: "America/Sao_Paulo",
  criticality: "HIGH",
  operatingWindows: [
    { weekday: 1, opensAt: "08:00", closesAt: "18:00" },
    { weekday: 2, opensAt: "08:00", closesAt: "18:00" },
    { weekday: 3, opensAt: "08:00", closesAt: "18:00" },
    { weekday: 4, opensAt: "08:00", closesAt: "18:00" },
    { weekday: 5, opensAt: "08:00", closesAt: "18:00" },
  ],
  createdAt,
} as const;
const localAssets = [
  {
    id: "018f1d92-a0e1-7b22-8f13-f6783977f004",
    name: "Impressora Financeiro",
    kind: "PRINTER" as const,
    address: "192.168.1.45",
    checks: ["icmp.reachable", "tcp.9100.reachable", "snmp.reachable", "printer.state"],
  },
  {
    id: "018f1d92-a0e1-7b22-8f13-f6783977f014",
    name: "Servidor Local",
    kind: "SERVER" as const,
    address: "192.168.1.10",
    checks: ["icmp.reachable"],
  },
  {
    id: "018f1d92-a0e1-7b22-8f13-f6783977f024",
    name: "Roteador Principal",
    kind: "ROUTER" as const,
    address: "192.168.1.1",
    checks: ["icmp.reachable"],
  },
  {
    id: "018f1d92-a0e1-7b22-8f13-f6783977f034",
    name: "Switch Principal",
    kind: "SWITCH" as const,
    address: "192.168.1.2",
    checks: ["icmp.reachable"],
  },
];
const managedAssets = localAssets.map((item) => ({
    asset: {
      id: item.id,
      tenantId,
      siteId,
      name: item.name,
      kind: item.kind,
      status: "ACTIVE",
      createdAt,
    },
    collectorId,
    expectedAddress: item.address,
    criticality: item.kind === "PRINTER" ? "HIGH" : "MEDIUM",
    monitoring: "ENABLED",
    requiredObservationKinds: item.checks,
  } as const));
const inventoryManager = new SqliteInventoryStore(localDatabase).initialize({
  collectors: [registeredCollector],
  tenants: [tenant],
  sites: [site],
  assets: managedAssets,
});
const statusProjector = new StatusProjector(
  inventoryManager,
  observationRepository,
  triageEngine,
);
const server = createAtlasHttpServer({
  controlPlane,
  incidentManager,
  incidentRepository,
  collectorCredentials: [{ collectorId, token: collectorToken }],
  operatorToken,
  operatorTenantIds: [tenantId],
  inventoryManager,
  statusProjector,
  dashboardHtml: readFileSync(
    new URL("../../../index.html", import.meta.url),
    "utf8",
  ),
});

server.listen(port, "127.0.0.1", () => {
  console.log(`ATLAS HTTP local v0.1 em http://127.0.0.1:${port}`);
  console.log(`SQLite: ${databasePath} — integridade: ${localDatabase.integrityCheck()}`);
});

let shuttingDown = false;
function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Encerramento seguro solicitado por ${signal}.`);
  server.close(() => {
    localDatabase.close();
    console.log("ATLAS encerrado; estado local preservado.");
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
