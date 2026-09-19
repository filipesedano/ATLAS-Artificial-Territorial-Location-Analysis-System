import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { LocalAuth } from '../src/local-auth.ts';
import { startAtlas } from '../../../tools/start-atlas.mjs';
import { createServer } from 'node:net';
const password='fixture-long-password-one';
test('password hashed; recovery one-use; sessions revoked and expired; throttle persists',async()=>{
 const db=new DatabaseSync(':memory:');let now=Date.now();const auth=new LocalAuth(db,()=>now);
 try {
 const code=await auth.attempt(()=>auth.setup(password));
 const stored=JSON.stringify(db.prepare('SELECT * FROM local_admin').get());
 assert.equal(stored.includes(password),false);assert.equal(stored.includes(code),false);
 const session=await auth.attempt(()=>auth.login('admin',password));assert.equal(auth.authorized(session),true);
 const next=await auth.attempt(()=>auth.recover(code,'fixture-long-password-two'));assert.notEqual(next,code);assert.equal(auth.authorized(session),false);
 await assert.rejects(()=>auth.attempt(()=>auth.recover(code,password)));
 await assert.rejects(()=>auth.attempt(()=>auth.login('admin',password)));
 const second=await auth.attempt(()=>auth.login('admin','fixture-long-password-two'));now+=1800001;assert.equal(auth.authorized(second),false);
 for(let i=0;i<5;i++)await assert.rejects(()=>auth.attempt(()=>auth.recover('bad',password)));
 const restarted=new LocalAuth(db,()=>now);await assert.rejects(()=>restarted.attempt(()=>restarted.login('admin','fixture-long-password-two')),error=>error.status===429);
 now+=60001;assert.ok(await restarted.attempt(()=>restarted.login('admin','fixture-long-password-two')));
 }finally{db.close();}
});
test('HTTP setup needs bootstrap and same origin; sessions cannot ingest or cross tenant; logout and restart invalidate', {timeout:25000},async()=>{
 const dir=mkdtempSync(join(tmpdir(),'atlas-auth-'));let running;
 const reserve=createServer();await new Promise<void>(r=>reserve.listen(0,'127.0.0.1',r));const port=(reserve.address() as any).port;await new Promise<void>(r=>reserve.close(()=>r()));
 const env={...process.env,ATLAS_DB_PATH:join(dir,'auth.db'),ATLAS_HTTP_PORT:String(port),ATLAS_OPERATOR_TOKEN:'fixture-bootstrap-token',ATLAS_COLLECTOR_TOKEN:'fixture-collector-token'};
 try {
 running=await startAtlas({env,stdio:'ignore'});const base=running.url;
 const post=async(path,body,cookie='',origin=base)=>fetch(base+path,{method:'POST',headers:{origin,'content-type':'application/json',cookie},body:JSON.stringify(body)});
 assert.equal((await post('/auth/setup',{password,bootstrapToken:env.ATLAS_OPERATOR_TOKEN},'','http://evil.test')).status,403);
 assert.equal((await post('/auth/setup',{password,bootstrapToken:'wrong'})).status,401);
 const setup=await post('/auth/setup',{password,bootstrapToken:env.ATLAS_OPERATOR_TOKEN});assert.equal(setup.status,200);assert.match((await setup.json()).recoveryCode,/^[a-f0-9]{64}$/);
 const tenant='/v1/tenants/018f1d92-a0e1-7b22-8f13-f6783977f001/assets';
 assert.equal((await fetch(base+tenant,{headers:{authorization:'Bearer '+env.ATLAS_OPERATOR_TOKEN}})).status,401);
 const login=await post('/auth/login',{username:'admin',password});assert.equal(login.status,200);
 const setCookie=login.headers.get('set-cookie')!;assert.match(setCookie,/HttpOnly/);assert.match(setCookie,/SameSite=Strict/);
 const cookie=setCookie.split(';')[0];assert.equal((await fetch(base+tenant,{headers:{cookie}})).status,200);
 assert.equal((await fetch(base+tenant.replace('f001','f099'),{headers:{cookie}})).status,403);
 assert.equal((await post('/v1/collectors/018f1d92-a0e1-7b22-8f13-f6783977f005/observations',{observations:[]},cookie)).status,401);
 assert.equal((await post('/auth/logout',{},cookie)).status,200);assert.equal((await fetch(base+tenant,{headers:{cookie}})).status,401);
 const login2=await post('/auth/login',{username:'admin',password});const cookie2=login2.headers.get('set-cookie')!.split(';')[0];
 await running.stop();running=await startAtlas({env,stdio:'ignore'});
 assert.equal((await fetch(base+tenant,{headers:{cookie:cookie2}})).status,401);assert.equal((await post('/auth/login',{username:'admin',password})).status,200);
 }finally{if(running)await running.stop();rmSync(dir,{recursive:true,force:true});}
});
