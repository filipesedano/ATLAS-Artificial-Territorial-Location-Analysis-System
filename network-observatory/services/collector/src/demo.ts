import { simulatedPolicy } from "../../../packages/contracts/src/index.ts";
import type { Asset } from "../../../packages/contracts/src/index.ts";
import { CollectorSimulator, InMemoryObservationOutbox, SimulatorProbe } from "./index.ts";

const tenantId = "018f1d92-a0e1-7b22-8f13-f6783977f001";
const siteId = "018f1d92-a0e1-7b22-8f13-f6783977f003";
const printer: Asset = {
  id: "018f1d92-a0e1-7b22-8f13-f6783977f004",
  tenantId,
  siteId,
  name: "Impressora Financeiro",
  kind: "PRINTER",
  status: "ACTIVE",
  createdAt: "2026-09-16T12:00:00.000Z",
};

const collector = new CollectorSimulator(
  {
    id: "018f1d92-a0e1-7b22-8f13-f6783977f005",
    tenantId,
    siteId,
    name: "Collector Matriz",
    authorizedAssetIds: [printer.id],
      policy: simulatedPolicy(tenantId, siteId, "018f1d92-a0e1-7b22-8f13-f6783977f005", printer.id),
  },
  new SimulatorProbe(),
  new InMemoryObservationOutbox(),
);

const result = collector.collect({
  asset: printer,
  ipAddress: "192.168.1.45",
  scenario: "NO_COMMUNICATION",
});

console.log("ATLAS Collector Simulator v0.1");
console.log(`Ativo: ${printer.name} — 192.168.1.45`);
console.log(`Observações medidas: ${result.observations.length}`);
for (const observation of result.observations) {
  console.log(`- ${observation.kind}: ${String(observation.value)} [${observation.provenance}]`);
}
console.log(`Fila aguardando sincronização: ${result.queued}`);
console.log("Diagnóstico: não produzido pelo Collector");
