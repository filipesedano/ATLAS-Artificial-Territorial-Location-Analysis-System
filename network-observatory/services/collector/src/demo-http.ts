import type { Asset } from "../../../packages/contracts/src/index.ts";
import {
  CollectorSimulator,
  HttpObservationTransport,
  InMemoryObservationOutbox,
  SimulatorProbe,
} from "./index.ts";

const collectorToken = process.env.ATLAS_COLLECTOR_TOKEN;
if (!collectorToken) throw new Error("ATLAS_COLLECTOR_TOKEN is required");

const baseUrl = process.env.ATLAS_CONTROL_PLANE_URL ?? "http://127.0.0.1:8080";
const tenantId = "018f1d92-a0e1-7b22-8f13-f6783977f001";
const siteId = "018f1d92-a0e1-7b22-8f13-f6783977f003";
const assetId = "018f1d92-a0e1-7b22-8f13-f6783977f004";
const collectorId = "018f1d92-a0e1-7b22-8f13-f6783977f005";
const printer: Asset = {
  id: assetId,
  tenantId,
  siteId,
  name: "Impressora Financeiro",
  kind: "PRINTER",
  status: "ACTIVE",
  createdAt: "2026-09-16T12:00:00.000Z",
};

let round = 0;
const demoStartedAt = Date.now();
const collector = new CollectorSimulator(
  {
    id: collectorId,
    tenantId,
    siteId,
    name: "Collector Local Simulado",
    authorizedAssetIds: [assetId],
  },
  new SimulatorProbe(),
  new InMemoryObservationOutbox(),
  () => new Date(demoStartedAt + ++round * 1_000),
);
const transport = new HttpObservationTransport({
  baseUrl,
  collectorId,
  token: collectorToken,
});

console.log("ATLAS — Demonstração HTTP totalmente simulada");
console.log("Nenhuma consulta ICMP, SNMP ou TCP será feita na rede.");

for (let index = 1; index <= 3; index += 1) {
  const collection = collector.collect({
    asset: printer,
    ipAddress: "192.168.1.45",
    scenario: "NO_COMMUNICATION",
  });
  const synchronization = await collector.synchronize(transport);
  console.log(
    `${index}ª rodada: ${collection.observations.length} medições, ` +
      `${synchronization.acknowledged} confirmadas, ${synchronization.remaining} pendentes`,
  );
}

console.log("Incidente interno esperado após a terceira rodada.");
console.log(`Abra ${baseUrl} e selecione API LOCAL para visualizar.`);
