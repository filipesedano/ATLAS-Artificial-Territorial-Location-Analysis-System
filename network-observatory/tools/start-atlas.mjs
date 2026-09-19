import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { diagnose } from './first-start.mjs';
import { loadConfig, projectRoot } from './runtime-config.mjs';

export async function startAtlas({env=process.env, timeoutMs=15000, stdio='inherit'}={}) {
  const report = await diagnose({env});
  if (report.status !== 'PRONTO PARA INICIAR') throw new Error('Inicialização bloqueada. Execute first-start.mjs para consultar os motivos.');
  const config = loadConfig(env);
  const child = spawn(process.execPath,[resolve(projectRoot,'services/control-plane/src/server-entry.ts')],{
    cwd:resolve(projectRoot,'services/control-plane'), shell:false,
    env:{...env,ATLAS_DB_PATH:config.databasePath,...(config.policyPath?{ATLAS_COLLECTION_POLICY_FILE:config.policyPath}:{})},
    stdio:[stdio,stdio,stdio,'ipc'],
  });
  const exited = new Promise(resolve=>{child.once('exit',(code,signal)=>resolve({code,signal}));child.once('error',()=>resolve({code:1,signal:null}));});
  let stopping;
  const stop=()=> stopping ??= (async()=>{
    if(!child.pid || child.exitCode!==null || child.signalCode!==null) return exited;
    if(child.connected) child.send({type:'atlas-stop'},()=>{});
    const timer=setTimeout(()=>child.kill(),5000);
    try { return await exited; } finally { clearTimeout(timer); }
  })();
  try {
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>finish(new Error('Tempo excedido ao iniciar o ATLAS.')),timeoutMs);
      const onExit=()=>finish(new Error('Servidor encerrou antes de ficar pronto.'));
      const onError=()=>finish(new Error('Não foi possível executar o servidor.'));
      const onMessage=message=>{ if(message?.type==='atlas-ready' && message.port===config.port) finish(); };
      function finish(error){clearTimeout(timer);child.off('exit',onExit);child.off('error',onError);child.off('message',onMessage);error?reject(error):resolve();}
      child.once('exit',onExit);child.once('error',onError);child.on('message',onMessage);
    });
    const response=await fetch(`http://127.0.0.1:${config.port}/health`,{signal:AbortSignal.timeout(3000),redirect:'error'});
    const body=await response.json();
    if(!response.ok || body.service!=='atlas-control-plane' || body.status!=='healthy') throw new Error('Resposta de saúde inesperada.');
    return {child,stop,exited,url:`http://127.0.0.1:${config.port}`};
  } catch(error){await stop();throw error;}
}
async function main(){
  if(process.argv.length>2) throw new Error('Este inicializador não recebe comandos adicionais. Configure por variáveis ATLAS_.');
  const running=await startAtlas();
  const shutdown=()=>{void running.stop();};
  process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
  console.log(`ATLAS iniciado e resposta verificada: ${running.url}\nUse Ctrl+C para encerrar. Não é serviço automático nem comprova saúde dos equipamentos.`);
  const {code}=await running.exited;
  process.exitCode=code??1;
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) main().catch(error=>{console.error(error.message);process.exitCode=1;});
