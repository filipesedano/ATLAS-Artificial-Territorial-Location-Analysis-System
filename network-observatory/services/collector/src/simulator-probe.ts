import type { MonitoredPrinter, Probe, ProbeReading, PrinterScenario } from "./types.ts";

const SCENARIOS: Readonly<Record<PrinterScenario, readonly ProbeReading[]>> = {
  HEALTHY: [
    { kind: "icmp.reachable", value: true },
    { kind: "tcp.9100.reachable", value: true },
    { kind: "snmp.reachable", value: true },
    { kind: "printer.state", value: "READY" },
    { kind: "printer.paper.percent", value: 78, unit: "percent" },
    { kind: "printer.toner.black.percent", value: 64, unit: "percent" },
  ],
  NO_COMMUNICATION: [
    { kind: "icmp.reachable", value: false },
    { kind: "tcp.9100.reachable", value: false },
    { kind: "snmp.reachable", value: false },
  ],
  ICMP_BLOCKED: [
    { kind: "icmp.reachable", value: false },
    { kind: "tcp.9100.reachable", value: true },
    { kind: "snmp.reachable", value: true },
    { kind: "printer.state", value: "READY" },
  ],
  PAPER_OUT: [
    { kind: "icmp.reachable", value: true },
    { kind: "tcp.9100.reachable", value: true },
    { kind: "snmp.reachable", value: true },
    { kind: "printer.state", value: "PAPER_OUT" },
    { kind: "printer.paper.percent", value: 0, unit: "percent" },
  ],
  TONER_LOW: [
    { kind: "icmp.reachable", value: true },
    { kind: "tcp.9100.reachable", value: true },
    { kind: "snmp.reachable", value: true },
    { kind: "printer.state", value: "READY" },
    { kind: "printer.toner.black.percent", value: 8, unit: "percent" },
  ],
};

/** Produces controlled readings. It performs no real network access. */
export class SimulatorProbe implements Probe {
  inspect(target: MonitoredPrinter): readonly ProbeReading[] {
    return SCENARIOS[target.scenario].map((reading) => ({ ...reading }));
  }
}
