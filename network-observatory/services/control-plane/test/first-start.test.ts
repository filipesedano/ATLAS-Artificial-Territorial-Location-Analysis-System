import assert from 'node:assert/strict';
import test from 'node:test';
import { networkCommand, networkDetails, diagnose } from '../../../tools/first-start.mjs';
test('Windows network command is fixed, read-only and executed without shell', async () => {
  assert.deepEqual(networkCommand('win32', 'C:\\Windows'), {file:'C:\\Windows\\System32\\ipconfig.exe',args:['/all']});
  const result = await networkDetails({os:'win32',systemRoot:'C:\\Windows',run:async(file,args,options)=> {
    assert.equal(file,'C:\\Windows\\System32\\ipconfig.exe'); assert.deepEqual(args,['/all']); assert.equal(options.shell,false);assert.equal(options.timeout,15000);
    return {stdout:Buffer.from('fixture-network')};
  }});
  assert.equal(result.output.toString(),'fixture-network');
});
test('non-Windows does not execute network commands; invalid Windows path fails closed', async () => {
  const result = await networkDetails({os:'linux',run:async()=>{throw Error('must not execute');}});
  assert.equal(result.supported,false);
  assert.throws(()=>networkCommand('win32','relative-path'));
});
test('diagnostic hides credentials and blocks identical reader/collector tokens', async () => {
  const secret='fixture-sensitive-token';
  const result=await diagnose({env:{ATLAS_OPERATOR_TOKEN:secret,ATLAS_COLLECTOR_TOKEN:secret}});
  assert.equal(result.status,'BLOQUEADO');assert.equal(JSON.stringify(result).includes(secret),false);
});

test('configuration denies malformed port and wrong tenant policy without exposing values', async () => {
  const result = await diagnose({env:{ATLAS_HTTP_PORT:'not-a-port'},portProbe:async()=>{throw Error('must not probe');}});
  assert.equal(result.status,'BLOQUEADO');
});
test('occupied or indeterminate local port blocks startup', async () => {
  for(const state of ['OCCUPIED','UNKNOWN']) {
    const result=await diagnose({env:{ATLAS_OPERATOR_TOKEN:'reader-test',ATLAS_COLLECTOR_TOKEN:'collector-test'},portProbe:async()=>state});
    assert.equal(result.status,'BLOQUEADO');
  }
});
