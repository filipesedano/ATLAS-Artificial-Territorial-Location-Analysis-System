import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';
import { startAtlas } from '../../../tools/start-atlas.mjs';
import { acquireInstanceLock } from '../../../tools/instance-lock.mjs';
import { diagnose, inspectPort } from '../../../tools/first-start.mjs';
import { loadConfig, validatePolicy } from '../../../tools/runtime-config.mjs';
async function unusedPort(){const s=createServer();await new Promise<void>(r=>s.listen(0,'127.0.0.1',r));const p=(s.address() as any).port;await new Promise<void>(r=>s.close(()=>r()));return p;}
test('lock prevents second owner and never overwrites an existing lock',()=>{
 const dir=mkdtempSync(join(tmpdir(),'atlas-lock-'));try{
 const db=join(dir,'data.db');const first=acquireInstanceLock(db);const original=readFileSync(first.path,'utf8');
 assert.throws(()=>acquireInstanceLock(db));assert.equal(readFileSync(first.path,'utf8'),original);
 first.release();const second=acquireInstanceLock(db);second.release();assert.equal(existsSync(db),false);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('invalid policy is blocked, missing explicit file never falls back, paused policy permits read server', async()=>{
 const dir=mkdtempSync(join(tmpdir(),'atlas-policy-config-'));try{
 const config=loadConfig({});
 assert.throws(()=>validatePolicy({...config.policy,tenantId:'wrong'},config));
 assert.throws(()=>validatePolicy({...config.policy,targets:[{assetId:'bad'}]},config));
 assert.throws(()=>loadConfig({ATLAS_COLLECTION_POLICY_FILE:join(dir,'missing.json')}));
 const file=join(dir,'policy.json');writeFileSync(file,JSON.stringify({...config.policy,state:'PAUSED'}));
 const result=await diagnose({env:{ATLAS_OPERATOR_TOKEN:'reader-test',ATLAS_COLLECTOR_TOKEN:'collector-test',ATLAS_DB_PATH:join(dir,'new.db'),ATLAS_COLLECTION_POLICY_FILE:file},portProbe:async()=> 'AVAILABLE'});
 assert.equal(result.status,'PRONTO PARA INICIAR');assert.equal(existsSync(join(dir,'new.db')),false);
 assert.match(result.checks.find(c=>c.name==='Coleta').detail,/bloqueada/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('port probe identifies listener without treating it as ATLAS', async()=>{
 const s=createServer(socket=>socket.end());await new Promise<void>(r=>s.listen(0,'127.0.0.1',r));
 try{assert.equal(await inspectPort((s.address() as any).port),'OCCUPIED');}finally{await new Promise<void>(r=>s.close(()=>r()));}
});
test('launcher starts, verifies health, denies second process and restarts same SQLite after clean stop', {timeout:25000},async()=>{
 const dir=mkdtempSync(join(tmpdir(),'atlas-launch-'));let running;
 try{
 const env={...process.env,ATLAS_OPERATOR_TOKEN:'reader-startup-fixture',ATLAS_COLLECTOR_TOKEN:'collector-startup-fixture',ATLAS_DB_PATH:join(dir,'atlas.db'),ATLAS_HTTP_PORT:String(await unusedPort())};
 running=await startAtlas({env,stdio:'ignore'});
 assert.equal((await fetch(running.url+'/health')).status,200);assert.equal(existsSync(env.ATLAS_DB_PATH),true);
 const lock=`${env.ATLAS_DB_PATH}.atlas.lock`;assert.equal(existsSync(lock),true);
 await assert.rejects(()=>startAtlas({env,stdio:'ignore'}),/bloqueada/);
 await running.stop();assert.equal(existsSync(lock),false);
 running=await startAtlas({env,stdio:'ignore'});assert.equal((await fetch(running.url+'/health')).status,200);
 await running.stop();running=null;
 }finally{if(running)await running.stop();rmSync(dir,{recursive:true,force:true});}
});
