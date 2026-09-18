import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";

import type { Asset, Observation } from "../../../packages/contracts/src/index.ts";
import {
  CollectorSimulator,
  HttpObservationTransport,
  InMemoryObservationOutbox,
  SimulatorProbe,
} from "../../collector/src/index.ts";
import {
  createAtlasHttpServer,
  IncidentManager,
  InventoryManager,
  InMemoryIncidentRepository,
  InMemoryObservationRepository,
  MinimalControlPlane,
  PrinterTriageEngine,
  StatusProjector,
} from "../src/index.ts";

const IDS = {
  tenant: "018f1d92-a0e1-7b22-8f13-f6783977f001",
  site: "018f1d92-a0e1-7b22-8f13-f6783977f003",
  asset: "018f1d92-a0e1-7b22-8f13-f6783977f004",
  collector: "018f1d92-a0e1-7b22-8f13-f6783977f005",
} as const;
const COLLECTOR_TOKEN = "collector-test-token-with-enough-entropy";
const OPERATOR_TOKEN = "operator-test-token-with-enough-entropy";
let idSequence = 400;

function batch(round: number): Observation[] {
  const timestamp = new Date(Date.UTC(2026, 8, 16, 12, 0, round)).toISOString();
  return ["icmp.reachable", "tcp.9100.reachable", "snmp.reachable"].map(
    (kind): Observation => {
      const suffix = String(idSequence++).padStart(3, "0");
      return {
        id: `018f1d92-a0e1-7b22-8f13-f6783977f${suffix}`,
        tenantId: IDS.tenant,
        siteId: IDS.site,
        assetId: IDS.asset,
        collectorId: IDS.collector,
        kind,
        value: false,
        provenance: "MEASURED",
        observedAt: timestamp,
        receivedAt: timestamp,
        idempotencyKey: `http-round-${round}-${kind}`,
      };
    },
  );
}

async function withServer(
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const incidentRepository = new InMemoryIncidentRepository();
  const observationRepository = new InMemoryObservationRepository();
  const triageEngine = new PrinterTriageEngine(() => new Date("2026-09-16T12:00:00.000Z"));
  const controlPlane = new MinimalControlPlane(
    [{ id: IDS.collector, tenantId: IDS.tenant, siteId: IDS.site, status: "ACTIVE" }],
    observationRepository,
    triageEngine,
    () => new Date("2026-09-16T12:00:00.000Z"),
  );
  const inventoryManager = new InventoryManager([
    { id: IDS.collector, tenantId: IDS.tenant, siteId: IDS.site, status: "ACTIVE" },
  ]);
  inventoryManager.registerTenant({
    id: IDS.tenant,
    publicCode: "A4527",
    name: "Cliente HTTP Test",
    status: "ACTIVE",
    createdAt: "2026-09-16T12:00:00.000Z",
  });
  inventoryManager.registerSite({
    id: IDS.site,
    tenantId: IDS.tenant,
    name: "Matriz",
    timezone: "America/Sao_Paulo",
    criticality: "HIGH",
    operatingWindows: [{ weekday: 3, opensAt: "08:00", closesAt: "18:00" }],
    createdAt: "2026-09-16T12:00:00.000Z",
  });
  inventoryManager.registerAsset({
    asset: {
      id: IDS.asset,
      tenantId: IDS.tenant,
      siteId: IDS.site,
      name: "Impressora Financeiro",
      kind: "PRINTER",
      status: "ACTIVE",
      createdAt: "2026-09-16T12:00:00.000Z",
    },
    collectorId: IDS.collector,
    expectedAddress: "192.168.1.45",
    criticality: "HIGH",
    monitoring: "ENABLED",
    requiredObservationKinds: [
      "icmp.reachable",
      "tcp.9100.reachable",
      "snmp.reachable",
      "printer.state",
    ],
  });
  const statusProjector = new StatusProjector(
    inventoryManager,
    observationRepository,
    triageEngine,
    () => new Date("2026-09-16T12:00:00.000Z"),
  );
  const server = createAtlasHttpServer({
    controlPlane,
    incidentManager: new IncidentManager(
      incidentRepository,
      () => "018f1d92-a0e1-7b22-8f13-f6783977f900",
      () => new Date("2026-09-16T12:00:00.000Z"),
    ),
    incidentRepository,
    collectorCredentials: [{ collectorId: IDS.collector, token: COLLECTOR_TOKEN }],
    operatorToken: OPERATOR_TOKEN,
    dashboardHtml: "<!doctype html><title>ATLAS Dashboard Test</title>",
    inventoryManager,
    statusProjector,
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test("exposes a minimal unauthenticated health endpoint", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.status, "healthy");
    assert.equal(body.service, "atlas-control-plane");
  });
});

test("serves the visual dashboard from the same localhost origin", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/`);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /text\/html/);
    assert.match(html, /ATLAS Dashboard Test/);
  });
});

test("rejects observation ingestion without collector authentication", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/v1/collectors/${IDS.collector}/observations`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ observations: batch(1) }),
      },
    );
    const body = await response.json();
    assert.equal(response.status, 401);
    assert.equal(body.error.code, "UNAUTHORIZED");
  });
});

test("requires operator authentication for tenant information", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/v1/tenants/${IDS.tenant}/status`);
    assert.equal(response.status, 401);
  });
});

test("ingests three rounds and exposes one deduplicated incident", async () => {
  await withServer(async (baseUrl) => {
    for (let round = 1; round <= 3; round += 1) {
      const response = await fetch(
        `${baseUrl}/v1/collectors/${IDS.collector}/observations`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${COLLECTOR_TOKEN}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ observations: batch(round) }),
        },
      );
      const body = await response.json();
      assert.equal(response.status, 200);
      assert.equal(body.ingestion.accepted, 3);
      assert.equal(body.acknowledgedIdempotencyKeys.length, 3);
      assert.equal(
        body.decisions[0].incident.action,
        round < 3 ? "PENDING_CONFIRMATION" : "CREATED",
      );
    }

    const incidentsResponse = await fetch(
      `${baseUrl}/v1/tenants/${IDS.tenant}/incidents`,
      { headers: { authorization: `Bearer ${OPERATOR_TOKEN}` } },
    );
    const incidentsBody = await incidentsResponse.json();
    assert.equal(incidentsResponse.status, 200);
    assert.equal(incidentsBody.incidents.length, 1);
    assert.equal(incidentsBody.incidents[0].title, "Impressora sem comunicação");
  });
});

test("runs Collector HTTP transport through the real local API", async () => {
  await withServer(async (baseUrl) => {
    const printer: Asset = {
      id: IDS.asset,
      tenantId: IDS.tenant,
      siteId: IDS.site,
      name: "Impressora Financeiro",
      kind: "PRINTER",
      status: "ACTIVE",
      createdAt: "2026-09-16T12:00:00.000Z",
    };
    let round = 0;
    const collector = new CollectorSimulator(
      {
        id: IDS.collector,
        tenantId: IDS.tenant,
        siteId: IDS.site,
        name: "Collector HTTP Test",
        authorizedAssetIds: [IDS.asset],
      },
      new SimulatorProbe(),
      new InMemoryObservationOutbox(),
      () => new Date(Date.UTC(2026, 8, 16, 13, 0, ++round)),
    );
    const transport = new HttpObservationTransport({
      baseUrl,
      collectorId: IDS.collector,
      token: COLLECTOR_TOKEN,
    });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      collector.collect({
        asset: printer,
        ipAddress: "192.168.1.45",
        scenario: "NO_COMMUNICATION",
      });
      const synchronized = await collector.synchronize(transport);
      assert.equal(synchronized.acknowledged, 3);
      assert.equal(synchronized.remaining, 0);
    }

    const response = await fetch(`${baseUrl}/v1/tenants/${IDS.tenant}/incidents`, {
      headers: { authorization: `Bearer ${OPERATOR_TOKEN}` },
    });
    const body = await response.json();
    assert.equal(body.incidents.length, 1);
    assert.equal(body.incidents[0].title, "Impressora sem comunicação");
  });
});

test("status endpoint does not claim full environmental health", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/v1/tenants/${IDS.tenant}/status`, {
      headers: { authorization: `Bearer ${OPERATOR_TOKEN}` },
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.incidentStatus, "CLEAR");
    assert.match(body.note, /não comprova cobertura ou saúde total/i);
  });
});

test("exposes authorized inventory and an honest tenant overview", async () => {
  await withServer(async (baseUrl) => {
    const headers = { authorization: `Bearer ${OPERATOR_TOKEN}` };
    const assetsResponse = await fetch(
      `${baseUrl}/v1/tenants/${IDS.tenant}/printers`,
      { headers },
    );
    const assets = await assetsResponse.json();
    assert.equal(assetsResponse.status, 200);
    assert.equal(assets.assets.length, 1);
    assert.equal(assets.assets[0].asset.name, "Impressora Financeiro");
    assert.equal(assets.assets[0].projection.status, "UNKNOWN");

    const overviewResponse = await fetch(
      `${baseUrl}/v1/tenants/${IDS.tenant}/overview`,
      { headers },
    );
    const overview = await overviewResponse.json();
    assert.equal(overviewResponse.status, 200);
    assert.equal(overview.totalAssets, 1);
    assert.equal(overview.byStatus.UNKNOWN, 1);
    assert.equal(overview.safeToClaimHealthy, false);
  });
});

test("returns one asset detail only inside its tenant scope", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/v1/tenants/${IDS.tenant}/assets/${IDS.asset}`,
      { headers: { authorization: `Bearer ${OPERATOR_TOKEN}` } },
    );
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.monitoring.expectedAddress, "192.168.1.45");
    assert.deepEqual(body.projection.missingKinds, [
      "icmp.reachable",
      "tcp.9100.reachable",
      "snmp.reachable",
      "printer.state",
    ]);
  });
});

test("rejects unsupported content types and unknown routes", async () => {
  await withServer(async (baseUrl) => {
    const unsupported = await fetch(
      `${baseUrl}/v1/collectors/${IDS.collector}/observations`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${COLLECTOR_TOKEN}`,
          "content-type": "text/plain",
        },
        body: "not-json",
      },
    );
    assert.equal(unsupported.status, 415);

    const missing = await fetch(`${baseUrl}/unknown`);
    assert.equal(missing.status, 404);
  });
});
