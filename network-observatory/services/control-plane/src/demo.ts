import { simulatedPolicy } from "../../../packages/contracts/src/index.ts";
import type { Observation } from "../../../packages/contracts/src/index.ts";
import {
  IncidentManager,
  InMemoryIncidentRepository,
  InMemoryObservationRepository,
  MinimalControlPlane,
  PrinterTriageEngine,
} from "./index.ts";

const ids = {
  tenant: "018f1d92-a0e1-7b22-8f13-f6783977f001",
  site: "018f1d92-a0e1-7b22-8f13-f6783977f003",
  asset: "018f1d92-a0e1-7b22-8f13-f6783977f004",
  collector: "018f1d92-a0e1-7b22-8f13-f6783977f005",
};
const timestamp = "2026-09-16T12:00:00.000Z";

function measured(index: number, kind: string, value: Observation["value"]): Observation {
  return {
    id: `018f1d92-a0e1-7b22-8f13-f6783977f10${index}`,
    tenantId: ids.tenant,
    siteId: ids.site,
    assetId: ids.asset,
    collectorId: ids.collector,
    kind,
    value,
    provenance: "MEASURED",
    observedAt: timestamp,
    receivedAt: timestamp,
    idempotencyKey: `demo-printer-192.168.1.45-${index}-${kind}`,
  };
}

const plane = new MinimalControlPlane(
  [{ id: ids.collector, tenantId: ids.tenant, siteId: ids.site, status: "ACTIVE", policy: simulatedPolicy(ids.tenant, ids.site, ids.collector, ids.asset) }],
  new InMemoryObservationRepository(),
  new PrinterTriageEngine(() => new Date(timestamp)),
  () => new Date(timestamp),
);

const observations = [
  measured(1, "icmp.reachable", false),
  measured(2, "tcp.9100.reachable", false),
  measured(3, "snmp.reachable", false),
];

const ingestion = plane.ingest(ids.collector, observations);
const assessment = plane.triage(ids.tenant, ids.asset);
const incidentRepository = new InMemoryIncidentRepository();
const incidentManager = new IncidentManager(
  incidentRepository,
  () => "018f1d92-a0e1-7b22-8f13-f6783977f900",
  () => new Date(timestamp),
);

console.log("ATLAS Control Plane + Motor de Triagem v0.1");
console.log(`Observações aceitas: ${ingestion.accepted}`);
console.log(`Estado: ${assessment.state}`);
console.log(`Classificação: ${assessment.classification}`);
console.log(`Confiança: ${assessment.confidence}`);
console.log(`Resumo: ${assessment.summary}`);
console.log("Hipóteses:");
for (const hypothesis of assessment.hypotheses) console.log(`- ${hypothesis}`);
console.log(`Confirmação humana obrigatória: ${assessment.humanConfirmationRequired ? "sim" : "não"}`);
console.log("\nIncident Manager — repetição controlada do cenário:");
console.log(`1ª triagem: ${incidentManager.evaluate(assessment).action}`);

const secondAssessment = {
  ...assessment,
  findings: assessment.findings.map((item) => ({
    ...item,
    observationIds: ["018f1d92-a0e1-7b22-8f13-f6783977f201"],
  })),
};
const thirdAssessment = {
  ...assessment,
  findings: assessment.findings.map((item) => ({
    ...item,
    observationIds: ["018f1d92-a0e1-7b22-8f13-f6783977f202"],
  })),
};
console.log(`2ª triagem: ${incidentManager.evaluate(secondAssessment).action}`);
const incidentDecision = incidentManager.evaluate(thirdAssessment);
console.log(`3ª triagem: ${incidentDecision.action}`);
console.log(`Incidente: ${incidentDecision.incident?.title ?? "não criado"}`);
