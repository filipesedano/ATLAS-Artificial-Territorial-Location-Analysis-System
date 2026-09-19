import { loadConfig } from './runtime-config.mjs';
import { createConnection } from 'node:net';
import { access, statfs } from 'node:fs/promises';
import { constants } from 'node:fs';
import { totalmem, freemem, platform, release } from 'node:os';
import { resolve, join, win32 } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execute = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));

export function networkCommand(os, systemRoot) {
  if (os !== 'win32') return null;
  if (!systemRoot || !win32.isAbsolute(systemRoot)) throw new Error('Diretório do Windows não identificado com segurança.');
  return { file: win32.join(systemRoot, 'System32', 'ipconfig.exe'), args: ['/all'] };
}
export async function networkDetails({ os = platform(), systemRoot = process.env.SystemRoot, run = execute } = {}) {
  const command = networkCommand(os, systemRoot);
  if (!command) return { supported: false };
  const result = await run(command.file, command.args, { shell: false, timeout: 15_000, maxBuffer: 2 * 1024 * 1024, encoding: 'buffer', windowsHide: true });
  return { supported: true, output: result.stdout };
}
export async function inspectPort(port, timeoutMs = 1000) {
  return new Promise(resolve => {
    const socket = createConnection({host:'127.0.0.1',port});
    const finish = state => { socket.destroy(); resolve(state); };
    socket.once('connect',()=>finish('OCCUPIED'));
    socket.once('error',error=>finish(error.code === 'ECONNREFUSED' ? 'AVAILABLE' : 'UNKNOWN'));
    socket.setTimeout(timeoutMs,()=>finish('UNKNOWN'));
  });
}
export async function diagnose({ env = process.env, cwd = process.cwd(), now = new Date(), portProbe = inspectPort } = {}) {
  const checks = [];
  const add = (name, status, detail) => checks.push({ name, status, detail });
  const [major, minor] = process.versions.node.split('.').map(Number);
  add('Node.js', major > 22 || (major === 22 && minor >= 18) ? 'PRONTO' : 'BLOQUEADO', process.versions.node);
  add('Sistema', 'INFORMATIVO', `${platform()} ${release()} / ${process.arch}`);
  add('Memória', 'INFORMATIVO', `${(totalmem()/2**30).toFixed(1)} GiB total; ${(freemem()/2**30).toFixed(1)} GiB disponível neste instante`);
  try {
    const disk = await statfs(root);
    add('Disco do projeto', 'INFORMATIVO', `${(disk.bavail*disk.bsize/2**30).toFixed(1)} GiB disponíveis; não é garantia de capacidade da carga futura`);
  } catch { add('Disco do projeto', 'CONFIGURAR', 'Não foi possível consultar o espaço disponível.'); }
  let config;
  try { config = loadConfig(env,cwd); add('Configuração', 'PRONTO', 'Formato, escopo e política validados; valores sensíveis ocultos.'); }
  catch (error) { add('Configuração','BLOQUEADO',error.message); }
  if (config) {
    try { await access(config.databasePath, constants.F_OK); add('Banco', 'INFORMATIVO', 'Arquivo encontrado; conteúdo e integridade não foram verificados.'); }
    catch (error) { add('Banco', error.code === 'ENOENT' ? 'INFORMATIVO' : 'BLOQUEADO', error.code === 'ENOENT' ? 'Instalação nova: banco será criado apenas ao iniciar. Nenhum arquivo criado pelo diagnóstico.' : 'Caminho do banco inacessível.'); }
    try { await access(`${config.databasePath}.atlas.lock`, constants.F_OK); add('Instância', 'BLOQUEADO', 'Trava encontrada: servidor ativo ou encerramento incompleto. Não removida automaticamente.'); }
    catch(error) { if (error.code !== 'ENOENT') add('Instância','BLOQUEADO','Não foi possível verificar a trava.'); }
    const active = config.policy.state === 'ACTIVE' && Date.parse(config.policy.validFrom) <= now.getTime() && now.getTime() < Date.parse(config.policy.validUntil);
    add('Coleta', 'INFORMATIVO', active ? 'Política sintética vigente; somente simulação. Não comprova consentimento real.' : 'Coleta bloqueada por estado ou validade. Consultas continuam permitidas.');
    const portState = await portProbe(config.port);
    add('Porta local', portState === 'AVAILABLE' ? 'PRONTO' : 'BLOQUEADO', portState === 'AVAILABLE' ? 'Sem listener TCP detectado; será revalidada ao iniciar.' : portState === 'OCCUPIED' ? 'Há um listener TCP. Não comprova que seja ATLAS; nenhum processo foi encerrado.' : 'Situação da porta indeterminada.');
  }
  for (const key of ['ATLAS_OPERATOR_TOKEN', 'ATLAS_COLLECTOR_TOKEN']) add(key, env[key] ? 'PRONTO' : 'CONFIGURAR', env[key] ? 'Definido; valor oculto.' : 'Não definido neste processo.');
  if (env.ATLAS_OPERATOR_TOKEN && env.ATLAS_OPERATOR_TOKEN === env.ATLAS_COLLECTOR_TOKEN) add('Separação de credenciais', 'BLOQUEADO', 'Leitura e coleta precisam de tokens distintos.');
  return { status: checks.some(c=>c.status==='BLOQUEADO') ? 'BLOQUEADO' : checks.some(c=>c.status==='CONFIGURAR') ? 'PRECISA DE CONFIGURAÇÃO' : 'PRONTO PARA INICIAR', checks };
}
export async function main(args = process.argv.slice(2)) {
  if (args.some(a => !['--network-details', '--help'].includes(a))) throw new Error('Opção desconhecida. Use --help.');
  if (args.includes('--help')) { console.log('node tools/first-start.mjs [--network-details]\nDiagnóstico local somente leitura. --network-details executa ipconfig /all exclusivamente no Windows. Não salva nem envia a saída.'); return; }
  const result = await diagnose();
  console.log(`ATLAS — diagnóstico inicial: ${result.status}`);
  for (const check of result.checks) console.log(`[${check.status}] ${check.name}: ${check.detail}`);
  if (args.includes('--network-details')) {
    console.log('\nDetalhes locais da rede: podem incluir IP, MAC, DNS, DHCP e domínio. Revise antes de compartilhar.');
    const details = await networkDetails();
    if (!details.supported) console.log('ipconfig /all está disponível apenas no Windows. Nenhum comando alternativo foi executado.');
    else { process.stdout.write(details.output); process.stdout.write('\n'); }
  }
  console.log('Diagnóstico parcial: não comprova prontidão completa, saúde da rede ou autorização de coleta.');
  if (result.status === 'BLOQUEADO') process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => { console.error('Não foi possível concluir o diagnóstico. Nenhuma saída de erro contendo dados de rede foi salva pelo ATLAS.'); process.exitCode = 1; });
}
