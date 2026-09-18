import { answerAssetQuestion, type AgentQuestion } from "./readonly-agent.ts";
import { timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

import { ContractViolation, type Observation, type UUID } from "../../../packages/contracts/src/index.ts";
import { MinimalControlPlane } from "./control-plane.ts";
import type { IncidentManager, IncidentRepository } from "./incident-manager.ts";
import type { InventoryManager } from "./inventory-manager.ts";
import type { StatusProjector } from "./status-projector.ts";

const MAX_REQUEST_BYTES = 1_048_576;

export interface CollectorCredential {
  collectorId: UUID;
  token: string;
}

export interface AtlasHttpServerOptions {
  controlPlane: MinimalControlPlane;
  incidentManager: IncidentManager;
  incidentRepository: IncidentRepository;
  collectorCredentials: readonly CollectorCredential[];
  operatorToken: string;
  operatorTenantIds: readonly UUID[];
  dashboardHtml?: string;
  inventoryManager?: InventoryManager;
  statusProjector?: StatusProjector;
}

interface ObservationRequestBody {
  observations: Observation[];
}

class HttpError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(payload);
}

function sendHtml(response: ServerResponse, html: string): void {
  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "content-length": Buffer.byteLength(html),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "content-security-policy":
      "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self' http://127.0.0.1:* http://localhost:*",
  });
  response.end(html);
}

function bearerToken(request: IncomingMessage): string | undefined {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) return undefined;
  return header.slice("Bearer ".length);
}

function tokenMatches(received: string | undefined, expected: string): boolean {
  if (!received) return false;
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const contentType = request.headers["content-type"] ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new HttpError(415, "CONTENT_TYPE_REQUIRED", "Content-Type must be application/json");
  }

  const chunks: Buffer[] = [];
  let received = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    received += buffer.length;
    if (received > MAX_REQUEST_BYTES) {
      throw new HttpError(413, "REQUEST_TOO_LARGE", "Request body exceeds 1 MiB");
    }
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "INVALID_JSON", "Request body is not valid JSON");
  }
}

function requireOperator(request: IncomingMessage, expectedToken: string): void {
  if (!tokenMatches(bearerToken(request), expectedToken)) {
    throw new HttpError(401, "UNAUTHORIZED", "Valid operator authentication is required");
  }
}

function requireCollector(
  request: IncomingMessage,
  collectorId: UUID,
  credentials: readonly CollectorCredential[],
): void {
  const credential = credentials.find((item) => item.collectorId === collectorId);
  if (!credential || !tokenMatches(bearerToken(request), credential.token)) {
    throw new HttpError(401, "UNAUTHORIZED", "Valid collector authentication is required");
  }
}

function mapError(error: unknown): HttpError {
  if (error instanceof HttpError) return error;
  if (error instanceof ContractViolation) {
    return new HttpError(422, error.invariant, error.message);
  }
  return new HttpError(500, "INTERNAL_ERROR", "The request could not be completed");
}

export function createAtlasHttpServer(options: AtlasHttpServerOptions): Server {
  if (!options.operatorToken || options.collectorCredentials.some(item => item.token === options.operatorToken)) {
    throw new Error("Reader and collector credentials must be nonempty and distinct");
  }
  return createServer(async (request, response) => {
    try {
      const method = request.method ?? "GET";
      const url = new URL(request.url ?? "/", "http://127.0.0.1");

      if (method === "GET" && url.pathname === "/health") {
        sendJson(response, 200, {
          status: "healthy",
          service: "atlas-control-plane",
          version: "0.1.0",
        });
        return;
      }

      if (method === "GET" && url.pathname === "/" && options.dashboardHtml) {
        sendHtml(response, options.dashboardHtml);
        return;
      }

      const collectorMatch = url.pathname.match(
        /^\/v1\/collectors\/([0-9a-f-]+)\/observations$/i,
      );
      if (method === "POST" && collectorMatch) {
        const collectorId = collectorMatch[1];
        requireCollector(request, collectorId, options.collectorCredentials);
        const body = (await readJsonBody(request)) as Partial<ObservationRequestBody>;
        if (!Array.isArray(body.observations) || body.observations.length === 0) {
          throw new HttpError(
            400,
            "OBSERVATIONS_REQUIRED",
            "A non-empty observations array is required",
          );
        }

        const ingestion = options.controlPlane.ingest(collectorId, body.observations);
        const assets = [
          ...new Map(
            body.observations.map((item) => [
              `${item.tenantId}:${item.assetId}`,
              { tenantId: item.tenantId, assetId: item.assetId },
            ]),
          ).values(),
        ];
        const decisions = assets.map(({ tenantId, assetId }) => {
          const assessment = options.controlPlane.triage(tenantId, assetId);
          const decision = options.incidentManager.evaluate(assessment);
          return {
            assetId,
            triage: {
              code: assessment.code,
              state: assessment.state,
              classification: assessment.classification,
              summary: assessment.summary,
            },
            incident: {
              action: decision.action,
              id: decision.incident?.id,
              status: decision.incident?.status,
            },
          };
        });

        sendJson(response, 200, {
          ingestion,
          decisions,
          acknowledgedIdempotencyKeys: ingestion.acceptedIdempotencyKeys,
        });
        return;
      }

      const assistantMatch = url.pathname.match(
        /^\/v1\/tenants\/([0-9a-f-]+)\/assets\/([0-9a-f-]+)\/assistant$/i,
      );
      if (method === "GET" && assistantMatch) {
        requireOperator(request, options.operatorToken);
        const [, tenantId, assetId] = assistantMatch;
        if (!options.operatorTenantIds?.includes(tenantId)) {
          throw new HttpError(403, "TENANT_FORBIDDEN", "Reader is not authorized for this tenant");
        }
        if (!options.inventoryManager) throw new HttpError(503, "INVENTORY_UNAVAILABLE", "Inventory is unavailable");
        if (!options.inventoryManager.asset(tenantId, assetId)) throw new HttpError(404, "ASSET_NOT_FOUND", "Asset was not found");
        const question = url.searchParams.get("question") ?? "status";
        if (!["status", "evidence", "limits", "policy"].includes(question)) {
          throw new HttpError(400, "QUESTION_UNSUPPORTED", "Only status, evidence, limits and policy are supported");
        }
        if (question === "policy") {
          const policies = options.controlPlane.collectionPolicySummary(tenantId, assetId);
          sendJson(response, 200, {
            tenantId, assetId, contractVersion: "atlas-reader/0.1", policyVersion: "readonly/0.1",
            provider: "DETERMINISTIC", classification: "INDETERMINATE", execution: "NONE",
            observationIds: [], generatedAt: new Date().toISOString(),
            answer: policies.length ? `Configuração de autorização no servidor (não comprova coleta ativa): ${JSON.stringify(policies)}` : "Nenhuma política cadastrada para este equipamento. A coleta deve permanecer bloqueada.",
          });
          return;
        }
        sendJson(response, 200, {
          tenantId, assetId,
          ...answerAssetQuestion(question as AgentQuestion, options.controlPlane.readObservations(tenantId, assetId)),
        });
        return;
      }

      const tenantIncidentsMatch = url.pathname.match(
        /^\/v1\/tenants\/([0-9a-f-]+)\/incidents$/i,
      );
      if (method === "GET" && tenantIncidentsMatch) {
        requireOperator(request, options.operatorToken);
        if (!options.operatorTenantIds?.includes(url.pathname.split("/")[3])) {
          throw new HttpError(403, "TENANT_FORBIDDEN", "Reader is not authorized for this tenant");
        }
        const tenantId = tenantIncidentsMatch[1];
        const incidents = options.incidentRepository.listByTenant(tenantId);
        sendJson(response, 200, { tenantId, incidents });
        return;
      }

      const tenantOverviewMatch = url.pathname.match(
        /^\/v1\/tenants\/([0-9a-f-]+)\/overview$/i,
      );
      if (method === "GET" && tenantOverviewMatch) {
        requireOperator(request, options.operatorToken);
        if (!options.operatorTenantIds?.includes(url.pathname.split("/")[3])) {
          throw new HttpError(403, "TENANT_FORBIDDEN", "Reader is not authorized for this tenant");
        }
        if (!options.statusProjector) {
          throw new HttpError(503, "STATUS_PROJECTOR_UNAVAILABLE", "Status projection is unavailable");
        }
        const tenantId = tenantOverviewMatch[1];
        sendJson(response, 200, options.statusProjector.projectTenant(tenantId));
        return;
      }

      const assetDetailMatch = url.pathname.match(
        /^\/v1\/tenants\/([0-9a-f-]+)\/assets\/([0-9a-f-]+)$/i,
      );
      if (method === "GET" && assetDetailMatch) {
        requireOperator(request, options.operatorToken);
        if (!options.operatorTenantIds?.includes(url.pathname.split("/")[3])) {
          throw new HttpError(403, "TENANT_FORBIDDEN", "Reader is not authorized for this tenant");
        }
        if (!options.inventoryManager || !options.statusProjector) {
          throw new HttpError(503, "INVENTORY_UNAVAILABLE", "Inventory is unavailable");
        }
        const [, tenantId, assetId] = assetDetailMatch;
        const managed = options.inventoryManager.asset(tenantId, assetId);
        if (!managed) throw new HttpError(404, "ASSET_NOT_FOUND", "Asset was not found");
        sendJson(response, 200, {
          contractVersion: "asset-preview/1.0",
          source: { transport: "API_LOCAL", acquisition: "UNVERIFIED" },
          observations: options.controlPlane.readObservations(tenantId, assetId),
          asset: managed.asset,
          monitoring: {
            collectorId: managed.collectorId,
            expectedAddress: managed.expectedAddress,
            criticality: managed.criticality,
            state: managed.monitoring,
            requiredObservationKinds: managed.requiredObservationKinds,
          },
          projection: options.statusProjector.projectAsset(managed),
        });
        return;
      }

      const assetListMatch = url.pathname.match(
        /^\/v1\/tenants\/([0-9a-f-]+)\/(assets|printers|servers|network)$/i,
      );
      if (method === "GET" && assetListMatch) {
        requireOperator(request, options.operatorToken);
        if (!options.operatorTenantIds?.includes(url.pathname.split("/")[3])) {
          throw new HttpError(403, "TENANT_FORBIDDEN", "Reader is not authorized for this tenant");
        }
        if (!options.inventoryManager || !options.statusProjector) {
          throw new HttpError(503, "INVENTORY_UNAVAILABLE", "Inventory is unavailable");
        }
        const [, tenantId, collection] = assetListMatch;
        const kindByCollection = {
          printers: "PRINTER",
          servers: "SERVER",
        } as const;
        let managed = options.inventoryManager.listAssets(tenantId);
        if (collection === "network") {
          managed = managed.filter((item) =>
            ["ROUTER", "SWITCH", "ACCESS_POINT"].includes(item.asset.kind),
          );
        } else if (collection === "printers" || collection === "servers") {
          managed = options.inventoryManager.listAssets(tenantId, {
            kind: kindByCollection[collection],
          });
        }
        sendJson(response, 200, {
          tenantId,
          collection,
          assets: managed.map((item) => ({
            asset: item.asset,
            monitoring: {
              expectedAddress: item.expectedAddress,
              criticality: item.criticality,
              state: item.monitoring,
              requiredObservationKinds: item.requiredObservationKinds,
            },
            projection: options.statusProjector?.projectAsset(item),
          })),
        });
        return;
      }

      const tenantStatusMatch = url.pathname.match(
        /^\/v1\/tenants\/([0-9a-f-]+)\/status$/i,
      );
      if (method === "GET" && tenantStatusMatch) {
        requireOperator(request, options.operatorToken);
        if (!options.operatorTenantIds?.includes(url.pathname.split("/")[3])) {
          throw new HttpError(403, "TENANT_FORBIDDEN", "Reader is not authorized for this tenant");
        }
        const tenantId = tenantStatusMatch[1];
        const incidents = options.incidentRepository.listByTenant(tenantId);
        const active = incidents.filter(
          (item) => item.status === "OPEN" || item.status === "ACKNOWLEDGED",
        );
        const bySeverity = Object.fromEntries(
          ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"].map((severity) => [
            severity,
            active.filter((item) => item.severity === severity).length,
          ]),
        );
        sendJson(response, 200, {
          tenantId,
          incidentStatus: active.length === 0 ? "CLEAR" : "ATTENTION",
          activeIncidents: active.length,
          bySeverity,
          note:
            active.length === 0
              ? "Nenhum incidente ativo; isto não comprova cobertura ou saúde total do ambiente."
              : "Existem incidentes internos que requerem acompanhamento.",
        });
        return;
      }

      throw new HttpError(404, "NOT_FOUND", "Route not found");
    } catch (error) {
      const mapped = mapError(error);
      sendJson(response, mapped.status, { error: { code: mapped.code, message: mapped.message } });
    }
  });
}
