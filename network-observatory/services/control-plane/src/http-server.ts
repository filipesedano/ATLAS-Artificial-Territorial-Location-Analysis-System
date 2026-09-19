import { LocalAuth, AuthError } from "./local-auth.ts";
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
  auth?: LocalAuth;
  database?: import("node:sqlite").DatabaseSync;
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
    "x-frame-options": "DENY",
    "referrer-policy": "no-referrer",
    "content-security-policy":
      "frame-ancestors 'none'; default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self' http://127.0.0.1:* http://localhost:*",
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

async function readJsonBody(request: IncomingMessage, limit = MAX_REQUEST_BYTES): Promise<unknown> {
  const contentType = request.headers["content-type"] ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new HttpError(415, "CONTENT_TYPE_REQUIRED", "Content-Type must be application/json");
  }

  const chunks: Buffer[] = [];
  let received = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    received += buffer.length;
    if (received > limit) {
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

function sessionToken(request: IncomingMessage): string | undefined {
  return request.headers.cookie?.split(';').map(value=>value.trim()).find(value=>value.startsWith('atlas_session='))?.slice('atlas_session='.length);
}
function requireOperator(request: IncomingMessage, options: AtlasHttpServerOptions): void {
  if(options.auth) {
    if(!options.auth.authorized(sessionToken(request))) throw new HttpError(401,"UNAUTHORIZED","Entre com o administrador local.");
    return;
  }
  if (!tokenMatches(bearerToken(request), options.operatorToken)) throw new HttpError(401, "UNAUTHORIZED", "Valid operator authentication is required");
}
function requireLocalOrigin(request: IncomingMessage): void {
  const port=request.socket.localPort;
  if (![ `http://127.0.0.1:${port}`, `http://localhost:${port}` ].includes(request.headers.origin ?? '')) {
    throw new HttpError(403,"ORIGIN_DENIED","Origem não autorizada.");
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
  if (error instanceof AuthError) return new HttpError(error.status,"AUTH_ERROR",error.message);
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

      if (options.auth) {
        const port=request.socket.localPort;
        if (![ `127.0.0.1:${port}`, `localhost:${port}` ].includes(request.headers.host ?? '')) throw new HttpError(403,"HOST_DENIED","Host local obrigatório.");
        if(method === 'GET' && url.pathname === '/auth/status') {
          sendJson(response,200,{configured:options.auth.configured(),authenticated:options.auth.authorized(sessionToken(request)),username:'admin',recovery:'OFFLINE_CODE',emailRecovery:false,smsRecovery:false});return;
        }
        if(method === 'POST' && ['/auth/setup','/auth/login','/auth/recover','/auth/logout'].includes(url.pathname)) {
          requireLocalOrigin(request);
          if(url.pathname === '/auth/logout') {
            options.auth.logout(sessionToken(request));
            response.setHeader('set-cookie','atlas_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
            sendJson(response,200,{ok:true});return;
          }
          const body=await readJsonBody(request,4096) as Record<string,unknown>;
          if(!body || typeof body!=='object' || Array.isArray(body))throw new HttpError(400,'INVALID_REQUEST','Solicitação inválida.');
          const result=await options.auth.attempt(async()=>{
            if(url.pathname === '/auth/setup') {
              if(typeof body.bootstrapToken!=='string'||!tokenMatches(body.bootstrapToken,options.operatorToken)) throw new AuthError(401,'Credenciais inválidas.');
              return {recoveryCode:await options.auth!.setup(body.password)};
            }
            if(url.pathname === '/auth/recover')return {recoveryCode:await options.auth!.recover(body.code,body.password)};
            const session=await options.auth!.login(body.username,body.password);
            // HTTP loopback only. HTTPS and Secure cookies are required before remote deployment.
            response.setHeader('set-cookie',`atlas_session=${session}; HttpOnly; SameSite=Strict; Path=/; Max-Age=1800`);
            return {ok:true};
          });
          sendJson(response,200,result);return;
        }
      }

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
        requireOperator(request, options);
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

      const incidentAction = url.pathname.match(/^\/v1\/tenants\/([0-9a-f-]+)\/incidents\/([0-9a-f-]+)\/(assume|history|evidence|analysis)$/i);
      if (incidentAction) {
        requireOperator(request, options);
        const [, tenantId, incidentId, action] = incidentAction;
        if (!options.operatorTenantIds.includes(tenantId)) throw new HttpError(403,"TENANT_FORBIDDEN","Cliente não autorizado.");
        let incident = options.incidentRepository.listByTenant(tenantId).find(item=>item.id===incidentId);
        if (!incident) throw new HttpError(404,"INCIDENT_NOT_FOUND","Incidente não encontrado.");
        const assignment = () => options.database?.prepare('SELECT actor, occurred_at AS occurredAt, policy_version AS policyVersion FROM incident_assignment WHERE tenant_id=? AND incident_id=?').get(tenantId,incidentId) ?? null;
        if (action === 'assume' && method === 'POST') {
          if (!options.auth || !options.database) throw new HttpError(403,"HUMAN_SESSION_REQUIRED","Atribuição exige sessão do administrador local.");
          requireLocalOrigin(request);
          const body = await readJsonBody(request,4096) as Record<string,unknown>;
          if (!body || body.confirm !== true || Object.keys(body).some(key=>key!=='confirm')) throw new HttpError(400,"CONFIRMATION_REQUIRED","Confirme explicitamente a atribuição ao administrador autenticado.");
          incident = options.incidentRepository.listByTenant(tenantId).find(item=>item.id===incidentId);
          if (!incident) throw new HttpError(404,'INCIDENT_NOT_FOUND','Incidente não encontrado.');
          if (!['OPEN','ACKNOWLEDGED'].includes(incident.status)) throw new HttpError(409,"INCIDENT_NOT_ACTIVE","O incidente já está encerrado.");
          const db=options.database;
          db.exec('BEGIN IMMEDIATE');
          try {
            if (!assignment()) {
              const occurredAt=new Date().toISOString();
              db.prepare('INSERT INTO incident_assignment VALUES(?,?,?,?,?)').run(tenantId,incidentId,'admin',occurredAt,'human-assignment/1.0');
              options.incidentRepository.save({...incident,status:'ACKNOWLEDGED',updatedAt:occurredAt});
            }
            db.exec('COMMIT');
          } catch(error) {db.exec('ROLLBACK');throw error;}
          sendJson(response,200,{contractVersion:'incident-actions/1.0',assignment:assignment(),status:'ACKNOWLEDGED'});return;
        }
        if (method !== 'GET' || action === 'assume') throw new HttpError(405,"METHOD_NOT_ALLOWED","Método não permitido.");
        const observations = options.controlPlane.readObservations(tenantId,incident.assetId).filter(item=>incident.observationIds.includes(item.id));
        const shared={contractVersion:'incident-actions/1.0',tenantId,incidentId,assignment:assignment(),acquisition:'UNVERIFIED'};
        if (action === 'history') {
          sendJson(response,200,{...shared,events:options.incidentManager.auditRecords().filter(item=>item.tenantId===tenantId && item.incidentId===incidentId),note:'Histórico registrado deste incidente; não inclui triagens anteriores sem vínculo. A atribuição humana é um registro separado.'});return;
        }
        if (action === 'evidence') {
          sendJson(response,200,{...shared,observations,missingObservationIds:incident.observationIds.filter(id=>!observations.some(item=>item.id===id)),unavailableEvidenceIds:incident.evidenceIds,note:'Consulta limitada às 100 observações mais recentes do ativo. Referências ausentes não foram recuperadas; API local não comprova aquisição real.'});return;
        }
        sendJson(response,200,{...shared,...answerAssetQuestion('status',observations),incidentClassification:incident.classification});return;
      }

      const tenantIncidentsMatch = url.pathname.match(
        /^\/v1\/tenants\/([0-9a-f-]+)\/incidents$/i,
      );
      if (method === "GET" && tenantIncidentsMatch) {
        requireOperator(request, options);
        if (!options.operatorTenantIds?.includes(url.pathname.split("/")[3])) {
          throw new HttpError(403, "TENANT_FORBIDDEN", "Reader is not authorized for this tenant");
        }
        const tenantId = tenantIncidentsMatch[1];
        const incidents = options.incidentRepository.listByTenant(tenantId);
        sendJson(response, 200, { tenantId, incidents: incidents.map(item=>({...item,
          assignment: options.database?.prepare('SELECT actor, occurred_at AS occurredAt FROM incident_assignment WHERE tenant_id=? AND incident_id=?').get(tenantId,item.id) ?? null
        })) });
        return;
      }

      const tenantOverviewMatch = url.pathname.match(
        /^\/v1\/tenants\/([0-9a-f-]+)\/overview$/i,
      );
      if (method === "GET" && tenantOverviewMatch) {
        requireOperator(request, options);
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
        requireOperator(request, options);
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
        requireOperator(request, options);
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
        requireOperator(request, options);
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
