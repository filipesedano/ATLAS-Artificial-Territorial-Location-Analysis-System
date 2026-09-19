import { randomBytes, createHash, scrypt, timingSafeEqual } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const passwordHash = (password: string, salt: string): Promise<Buffer> => new Promise((resolve,reject)=>
  scrypt(password,salt,64,{N:131072,r:8,p:1,maxmem:256*1024*1024},(error,key)=>error?reject(error):resolve(key)));
export const AUTH_SCHEMA_SQL = `CREATE TABLE IF NOT EXISTS local_admin (id INTEGER PRIMARY KEY CHECK(id=1), salt TEXT NOT NULL, password_hash TEXT NOT NULL, recovery_hash TEXT NOT NULL, recovery_expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS auth_throttle (id INTEGER PRIMARY KEY CHECK(id=1), failures INTEGER NOT NULL, blocked_until INTEGER NOT NULL);
      INSERT OR IGNORE INTO auth_throttle VALUES(1,0,0);
      CREATE TABLE IF NOT EXISTS auth_audit (sequence INTEGER PRIMARY KEY AUTOINCREMENT, event TEXT NOT NULL, occurred_at INTEGER NOT NULL);`;
export class AuthError extends Error {
  status: number;
  constructor(status: number,message: string){super(message);this.status=status;}
}
export class LocalAuth {
  private db: DatabaseSync;
  private now: () => number;
  private busy=false;
  private sessions=new Map<string,number>();
  constructor(db: DatabaseSync, now=()=>Date.now()){
    this.db=db;this.now=now;
    db.exec(AUTH_SCHEMA_SQL);
  }
  configured(): boolean {return !!this.db.prepare('SELECT id FROM local_admin WHERE id=1').get();}
  private audit(event: string){this.db.prepare('INSERT INTO auth_audit(event,occurred_at) VALUES(?,?)').run(event,this.now());}
  private password(value: unknown): string {
    if(typeof value!=='string'||value.length<15||value.length>128)throw new AuthError(400,'Use uma senha de 15 a 128 caracteres.');return value;
  }
  async attempt<T>(operation:()=>Promise<T>):Promise<T>{
    const state=this.db.prepare('SELECT * FROM auth_throttle WHERE id=1').get()!;
    if(this.busy||Number(state.blocked_until)>this.now())throw new AuthError(429,'Aguarde antes de tentar novamente.');
    this.busy=true;
    try {const result=await operation();this.db.prepare('UPDATE auth_throttle SET failures=0,blocked_until=0 WHERE id=1').run();return result;}
    catch(error){
      const failures=Number(state.failures)+1;
      this.db.prepare('UPDATE auth_throttle SET failures=?,blocked_until=? WHERE id=1').run(failures>=5?0:failures,failures>=5?this.now()+60000:0);
      this.audit('AUTH_FAILED');throw error;
    } finally {this.busy=false;}
  }
  private atomic(operation: () => void){
    this.db.exec("BEGIN IMMEDIATE");
    try {operation();this.db.exec("COMMIT");} catch(error){this.db.exec("ROLLBACK");throw error;}
  }
  private async credentials(password: unknown){
    const salt=randomBytes(16).toString('hex');
    const hash=(await passwordHash(this.password(password),salt)).toString('hex');
    const recoveryCode=randomBytes(32).toString('hex');
    return {salt,hash,recoveryCode};
  }
  async setup(password: unknown):Promise<string>{
    if(this.configured())throw new AuthError(409,'Administrador já configurado.');
    const next=await this.credentials(password);
    this.atomic(()=>{
      this.db.prepare('INSERT INTO local_admin VALUES(1,?,?,?,?)').run(next.salt,next.hash,digest(next.recoveryCode),this.now()+365*86400000);
      this.audit('ADMIN_CREATED');
    });
    return next.recoveryCode;
  }
  async login(username: unknown,password: unknown):Promise<string>{
    const row=this.db.prepare('SELECT * FROM local_admin WHERE id=1').get();
    if(!row||typeof password!=='string'||password.length>128)throw new AuthError(401,'Credenciais inválidas.');
    const actual=await passwordHash(password,String(row.salt));
    const valid=timingSafeEqual(actual,Buffer.from(String(row.password_hash),'hex'));
    if(!valid||username!=='admin')throw new AuthError(401,'Credenciais inválidas.');
    for(const [key,expiry] of this.sessions)if(expiry<=this.now())this.sessions.delete(key);
    while(this.sessions.size>=8)this.sessions.delete(this.sessions.keys().next().value!);
    const session=randomBytes(32).toString('hex');this.sessions.set(digest(session),this.now()+30*60000);this.audit('LOGIN');return session;
  }
  authorized(token: string|undefined):boolean {
    if(!token||!/^[a-f0-9]{64}$/.test(token))return false;
    const key=digest(token),expiry=this.sessions.get(key);
    if(!expiry||expiry<=this.now()){this.sessions.delete(key);return false;}return true;
  }
  logout(token: string|undefined){if(token)this.sessions.delete(digest(token));this.audit('LOGOUT');}
  async recover(code: unknown,password: unknown):Promise<string>{
    const row=this.db.prepare('SELECT * FROM local_admin WHERE id=1').get();
    if(!row||typeof code!=='string'||!/^[a-f0-9]{64}$/.test(code)||Number(row.recovery_expires)<=this.now()||!timingSafeEqual(Buffer.from(digest(code),'hex'),Buffer.from(String(row.recovery_hash),'hex')))throw new AuthError(401,'Código inválido ou expirado.');
    const next=await this.credentials(password);
    this.atomic(()=>{
      this.db.prepare('UPDATE local_admin SET salt=?,password_hash=?,recovery_hash=?,recovery_expires=? WHERE id=1').run(next.salt,next.hash,digest(next.recoveryCode),this.now()+365*86400000);
      this.audit('PASSWORD_RECOVERED');
    });
    this.sessions.clear();return next.recoveryCode;
  }
}
