import { mkdirSync, realpathSync, existsSync, openSync, writeFileSync, closeSync, unlinkSync } from 'node:fs';
import { dirname, basename, join } from 'node:path';
export function acquireInstanceLock(databasePath) {
  mkdirSync(dirname(databasePath), {recursive:true});
  const canonical = existsSync(databasePath) ? realpathSync(databasePath) : join(realpathSync(dirname(databasePath)),basename(databasePath));
  const path = `${canonical}.atlas.lock`;
  let fd;
  try { fd = openSync(path,'wx',0o600); }
  catch { throw new Error('Não foi possível obter trava exclusiva do banco. Verifique instância ativa, trava remanescente ou permissões.'); }
  try { writeFileSync(fd,JSON.stringify({version:1,pid:process.pid,createdAt:new Date().toISOString()})); }
  catch(error) { closeSync(fd); unlinkSync(path); throw error; }
  closeSync(fd);
  let released=false;
  return {path, release(){ if(!released){ unlinkSync(path); released=true; } }};
}
