import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isIP } from 'node:net';
import { simulatedPolicy } from '../packages/contracts/src/collection-policy.ts';
export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const metrics = new Set(['icmp.reachable','tcp.9100.reachable','snmp.reachable','printer.state','printer.paper.percent','printer.toner.black.percent']);
export function validatePolicy(policy, scope) {
  const fail = () => { throw new Error('Política inválida ou incompatível com o escopo configurado.'); };
  if (!policy || policy.version !== 'collection-policy/0.1' || policy.mode !== 'SIMULATED' ||
    typeof policy.id !== 'string' || !policy.id.trim() || typeof policy.approvedBy !== 'string' || !policy.approvedBy.trim() ||
    !['ACTIVE','PAUSED','REVOKED'].includes(policy.state) ||
    !Number.isSafeInteger(policy.minIntervalMs) || policy.minIntervalMs < 1000 ||
    !Number.isFinite(Date.parse(policy.validFrom)) || !Number.isFinite(Date.parse(policy.validUntil)) ||
    Date.parse(policy.validFrom) >= Date.parse(policy.validUntil) ||
    ['tenantId','siteId','collectorId'].some(key => policy[key] !== scope[key]) ||
    !Array.isArray(policy.targets) || policy.targets.length === 0) fail();
  const seen = new Set();
  for (const target of policy.targets) {
    if (!target || !uuid.test(target.assetId) || seen.has(target.assetId) || typeof target.address !== 'string' || !isIP(target.address) ||
      !Array.isArray(target.metrics) || target.metrics.length === 0 || target.metrics.some(kind => !metrics.has(kind))) fail();
    seen.add(target.assetId);
  }
  return policy;
}
export function loadConfig(env = process.env, cwd = process.cwd()) {
  const tenantId = env.ATLAS_TENANT_ID ?? '018f1d92-a0e1-7b22-8f13-f6783977f001';
  const siteId = env.ATLAS_SITE_ID ?? '018f1d92-a0e1-7b22-8f13-f6783977f003';
  const collectorId = env.ATLAS_COLLECTOR_ID ?? '018f1d92-a0e1-7b22-8f13-f6783977f005';
  if (![tenantId,siteId,collectorId].every(id=>uuid.test(id))) throw new Error('Identificadores de cliente, unidade ou Collector inválidos.');
  const rawPort = env.ATLAS_HTTP_PORT ?? '8080';
  const port = Number(rawPort);
  if (!/^\d+$/.test(rawPort) || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Porta deve ser um inteiro entre 1 e 65535.');
  const databasePath = env.ATLAS_DB_PATH ? resolve(cwd, env.ATLAS_DB_PATH) : resolve(projectRoot,'services/control-plane/data/atlas-local.db');
  const policyPath = env.ATLAS_COLLECTION_POLICY_FILE ? resolve(cwd,env.ATLAS_COLLECTION_POLICY_FILE) : undefined;
  let policy;
  try { policy = policyPath ? JSON.parse(readFileSync(policyPath,'utf8')) : simulatedPolicy(tenantId,siteId,collectorId,'018f1d92-a0e1-7b22-8f13-f6783977f004'); }
  catch { throw new Error('Não foi possível ler a política; nenhuma política alternativa foi aplicada.'); }
  validatePolicy(policy,{tenantId,siteId,collectorId});
  return {tenantId,siteId,collectorId,port,databasePath,policyPath,policy,operatorToken:env.ATLAS_OPERATOR_TOKEN,collectorToken:env.ATLAS_COLLECTOR_TOKEN};
}
