import type { Observation } from "../../../packages/contracts/src/index.ts";
import type { Clock, TriageAssessment, TriageFinding } from "./types.ts";

type LatestReadings = Map<string, Observation>;

function latestByKind(observations: readonly Observation[]): LatestReadings {
  const readings: LatestReadings = new Map();
  for (const observation of observations) {
    const current = readings.get(observation.kind);
    if (!current || observation.observedAt > current.observedAt) {
      readings.set(observation.kind, observation);
    }
  }
  return readings;
}

function finding(message: string, ...observations: Observation[]): TriageFinding {
  return {
    classification: "MEASURED",
    message,
    observationIds: observations.map((item) => item.id),
  };
}

export class PrinterTriageEngine {
  private readonly clock: Clock;

  constructor(clock: Clock = () => new Date()) {
    this.clock = clock;
  }

  assess(observations: readonly Observation[]): TriageAssessment {
    if (observations.length === 0) {
      throw new Error("At least one observation is required for triage");
    }

    const tenantId = observations[0].tenantId;
    const siteId = observations[0].siteId;
    const assetId = observations[0].assetId;
    const latest = latestByKind(observations);
    const icmp = latest.get("icmp.reachable");
    const port = latest.get("tcp.9100.reachable");
    const snmp = latest.get("snmp.reachable");
    const printerState = latest.get("printer.state");
    const paper = latest.get("printer.paper.percent");
    const toner = latest.get("printer.toner.black.percent");
    const base = {
      tenantId,
      siteId,
      assetId,
      humanConfirmationRequired: true as const,
      generatedAt: this.clock().toISOString(),
    };

    if (printerState?.value === "PAPER_OUT" || paper?.value === 0) {
      const sources = [printerState, paper].filter((item): item is Observation => Boolean(item));
      return {
        ...base,
        code: "PRINTER_PAPER_OUT",
        state: "ATTENTION",
        severity: "MEDIUM",
        classification: "MEASURED",
        confidence: "HIGH",
        summary: "A impressora informou ausência de papel.",
        findings: [finding("Estado PAPER_OUT ou nível de papel igual a zero.", ...sources)],
        hypotheses: [],
        recommendedChecks: ["Abastecer a bandeja indicada e confirmar o retorno ao estado READY."],
      };
    }

    if (typeof toner?.value === "number" && toner.value <= 10) {
      return {
        ...base,
        code: "PRINTER_TONER_LOW",
        state: "PREVENTIVE",
        severity: "LOW",
        classification: "MEASURED",
        confidence: "HIGH",
        summary: `Toner preto informado em ${toner.value}%.`,
        findings: [finding("Nível de toner preto igual ou inferior a 10%.", toner)],
        hypotheses: [],
        recommendedChecks: ["Programar reposição de toner antes do esgotamento."],
      };
    }

    if (icmp?.value === false && port?.value === false && snmp?.value === false) {
      return {
        ...base,
        code: "PRINTER_NO_COMMUNICATION",
        state: "UNREACHABLE",
        severity: "HIGH",
        classification: "INFERRED",
        confidence: "MEDIUM",
        summary: "A impressora não respondeu aos métodos de comunicação testados.",
        findings: [finding("ICMP, TCP 9100 e SNMP sem resposta.", icmp, port, snmp)],
        hypotheses: [
          "Equipamento desligado ou sem energia.",
          "Cabo ou conexão de rede indisponível.",
          "Endereço IP alterado.",
          "Bloqueio de comunicação entre o Collector e o equipamento.",
        ],
        recommendedChecks: [
          "Verificar o painel e a alimentação elétrica.",
          "Verificar o cabo ou a conexão de rede.",
          "Confirmar o endereço IP exibido no equipamento.",
        ],
      };
    }

    if (icmp?.value === false && (port?.value === true || snmp?.value === true)) {
      const responding = [port, snmp].filter(
        (item): item is Observation => Boolean(item?.value === true),
      );
      return {
        ...base,
        code: "PRINTER_ICMP_UNAVAILABLE",
        state: "HEALTHY",
        severity: "INFO",
        classification: "INFERRED",
        confidence: "HIGH",
        summary: "A impressora está acessível; somente o ICMP não respondeu.",
        findings: [
          finding("ICMP sem resposta.", icmp),
          finding("Outro protocolo autorizado respondeu.", ...responding),
        ],
        hypotheses: ["ICMP bloqueado ou desativado no equipamento ou na rede."],
        recommendedChecks: ["Não classificar o equipamento como offline com base apenas no ping."],
      };
    }

    if (printerState?.value === "READY" && (port?.value === true || snmp?.value === true)) {
      const sources = [printerState, port, snmp].filter(
        (item): item is Observation => Boolean(item),
      );
      return {
        ...base,
        code: "PRINTER_READY",
        state: "HEALTHY",
        severity: "INFO",
        classification: "MEASURED",
        confidence: "HIGH",
        summary: "A impressora informou estado READY e está acessível.",
        findings: [finding("Estado operacional observado.", ...sources)],
        hypotheses: [],
        recommendedChecks: [],
      };
    }

    return {
      ...base,
      code: "INSUFFICIENT_DATA",
      state: "INDETERMINATE",
      severity: "INFO",
      classification: "INDETERMINATE",
      confidence: "LOW",
      summary: "As medições disponíveis são insuficientes para classificar o estado.",
      findings: [],
      hypotheses: [],
      recommendedChecks: ["Coletar ICMP, TCP 9100, SNMP e o estado declarado pela impressora."],
    };
  }
}
