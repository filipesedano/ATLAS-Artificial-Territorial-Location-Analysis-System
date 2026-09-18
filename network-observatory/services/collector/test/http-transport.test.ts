import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";

import type { Observation } from "../../../packages/contracts/src/index.ts";
import { CollectorTransportError, HttpObservationTransport } from "../src/index.ts";

const observation: Observation = {
  id: "018f1d92-a0e1-7b22-8f13-f6783977f006",
  tenantId: "018f1d92-a0e1-7b22-8f13-f6783977f001",
  siteId: "018f1d92-a0e1-7b22-8f13-f6783977f003",
  assetId: "018f1d92-a0e1-7b22-8f13-f6783977f004",
  collectorId: "018f1d92-a0e1-7b22-8f13-f6783977f005",
  kind: "icmp.reachable",
  value: false,
  provenance: "MEASURED",
  observedAt: "2026-09-16T12:00:00.000Z",
  receivedAt: "2026-09-16T12:00:00.000Z",
  idempotencyKey: "http-transport-test-001",
};

test("sends observations to localhost and returns acknowledgements", async () => {
  let receivedAuthorization = "";
  const server = createServer(async (request, response) => {
    receivedAuthorization = request.headers.authorization ?? "";
    for await (const _chunk of request) {
      // Consume the request before responding.
    }
    const payload = JSON.stringify({
      acknowledgedIdempotencyKeys: [observation.idempotencyKey],
    });
    response.writeHead(200, { "content-type": "application/json" });
    response.end(payload);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  try {
    const transport = new HttpObservationTransport({
      baseUrl: `http://127.0.0.1:${address.port}`,
      collectorId: observation.collectorId,
      token: "collector-secret",
    });
    const acknowledged = await transport.send([observation]);
    assert.deepEqual(acknowledged, [observation.idempotencyKey]);
    assert.equal(receivedAuthorization, "Bearer collector-secret");
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test("refuses non-localhost destinations in v0.1", () => {
  assert.throws(
    () =>
      new HttpObservationTransport({
        baseUrl: "http://192.168.1.10:8080",
        collectorId: observation.collectorId,
        token: "collector-secret",
      }),
    (error: unknown) => error instanceof CollectorTransportError,
  );
});

test("does not acknowledge observations rejected by the server", async () => {
  const server = createServer((_request, response) => {
    response.writeHead(401, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: { message: "Invalid collector token" } }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  try {
    const transport = new HttpObservationTransport({
      baseUrl: `http://127.0.0.1:${address.port}`,
      collectorId: observation.collectorId,
      token: "wrong-token",
    });
    await assert.rejects(
      () => transport.send([observation]),
      (error: unknown) =>
        error instanceof CollectorTransportError && error.status === 401,
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
