import { LocalAuth } from "./local-auth.ts";
import { loadConfig } from '../../../tools/runtime-config.mjs';
import { acquireInstanceLock } from '../../../tools/instance-lock.mjs';
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

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

const config = loadConfig();
const { operatorToken, collectorToken, collectorId, tenantId, siteId, port, databasePath, policy: collectionPolicy } = config;
if (!operatorToken || !collectorToken || operatorToken === collectorToken) {
  throw new Error("Distinct ATLAS_OPERATOR_TOKEN and ATLAS_COLLECTOR_TOKEN are required");
}

const instanceLock = acquireInstanceLock(databasePath);
// Exclusive ownership is acquired before SQLite is opened or migrated.
process.once('exit', () => { try { instanceLock.release(); } catch {} });
const localDatabase = new LocalDatabase(databasePath);
const incidentRepository = new SqliteIncidentRepository(localDatabase);
const observationRepository = new SqliteObservationRepository(localDatabase);
const triageEngine = new PrinterTriageEngine();
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
  database: localDatabase.connection,
  auth: new LocalAuth(localDatabase.connection),
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

server.once("error", () => {
  console.error("ATLAS não conseguiu escutar na porta configurada.");
  localDatabase.close(); instanceLock.release(); process.exitCode = 1;
  if (process.connected) process.disconnect();
});
server.listen(port, "127.0.0.1", () => {
  console.log(`ATLAS HTTP local v0.1 em http://127.0.0.1:${port}`);
  const integrity = localDatabase.integrityCheck();
  console.log(`SQLite — integridade: ${integrity}`);
  if (integrity !== "ok") { process.exitCode = 1; shutdown("integrity-failed"); return; }
  process.send?.({type:"atlas-ready", port});
});

let shuttingDown = false;
function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Encerramento seguro solicitado por ${signal}.`);
  server.close(() => {
    localDatabase.close();
    instanceLock.release();
    if (process.connected) process.disconnect();
    console.log("ATLAS encerrado; estado local preservado.");
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("message", message => { if (message?.type === "atlas-stop") shutdown("launcher"); });
process.on("disconnect", () => shutdown("launcher-disconnected"));
