import { DatabaseSync } from 'node:sqlite';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const dpapi = (value: Buffer, protect: boolean) => new Promise<Buffer>((resolve, reject) => {
  const method = protect ? 'Protect' : 'Unprotect';
  const script = `Add-Type -AssemblyName System.Security; $raw=[Convert]::FromBase64String([Console]::In.ReadToEnd()); $out=[System.Security.Cryptography.ProtectedData]::${method}($raw,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($out))`;
  const child = spawn('powershell.exe', ['-NoProfile','-NonInteractive','-Command',script], { windowsHide: true, stdio: ['pipe','pipe','pipe'] });
  let output = ''; child.stdout.on('data', data => output += String(data));
  child.on('error', reject); child.on('exit', code => code === 0 ? resolve(Buffer.from(output, 'base64')) : reject(new Error('Windows DPAPI key protection failed.')));
  child.stdin.end(value.toString('base64'));
});
export const loadMasterKey = async (directory: string): Promise<Buffer> => {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  if (process.env.RIKU_MASTER_KEY) {
    const key = Buffer.from(process.env.RIKU_MASTER_KEY, 'base64');
    if (key.length !== 32) throw new Error('RIKU_MASTER_KEY must be a base64-encoded 32-byte key.');
    return key;
  }
  const path = join(directory, process.platform === 'win32' ? 'master-key.dpapi' : 'master-key.local');
  try { const stored = await readFile(path); return process.platform === 'win32' ? dpapi(stored, false) : stored; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  if (process.env.NODE_ENV === 'production' && process.platform !== 'win32') throw new Error('Production requires RIKU_MASTER_KEY from a secret manager.');
  const key = randomBytes(32), encoded = process.platform === 'win32' ? await dpapi(key, true) : key;
  await writeFile(path, encoded, { flag: 'wx', mode: 0o600 });
  return key;
};
export type AuditEntry = { sequence: number; at: string; actor: string; action: string; subject: string; details: unknown; previous: string; hash: string };
export class PlatformStore {
  readonly db: DatabaseSync;
  constructor(readonly directory: string, private key: Buffer) {
    if (key.length !== 32) throw new Error('Invalid encryption key.');
    this.key=Buffer.from(key);
    this.db = new DatabaseSync(join(directory, 'platform.sqlite'));
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS records(tenant TEXT NOT NULL, collection TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL, expires INTEGER, PRIMARY KEY(tenant,collection,id));
      CREATE TABLE IF NOT EXISTS audit(tenant TEXT NOT NULL, seq INTEGER NOT NULL, at TEXT NOT NULL, payload TEXT NOT NULL, previous TEXT NOT NULL, hash TEXT NOT NULL, PRIMARY KEY(tenant,seq));
      CREATE TABLE IF NOT EXISTS requirements(tenant TEXT NOT NULL, project TEXT NOT NULL, version INTEGER NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(tenant,project,version,id));
      CREATE TABLE IF NOT EXISTS audit_heads(tenant TEXT PRIMARY KEY, seq INTEGER NOT NULL, hash TEXT NOT NULL, signature TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS audit_anchors(tenant TEXT PRIMARY KEY, seq INTEGER NOT NULL, hash TEXT NOT NULL, signature TEXT NOT NULL);`);
  }
  static async open(directory: string, key?: Buffer) {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const store = new PlatformStore(directory, key ?? await loadMasterKey(directory));
    if (process.platform !== 'win32') await chmod(join(directory, 'platform.sqlite'), 0o600);
    // Fail closed on a wrong key before accepting requests.
    const sentinel = store.get<string>('_system','config','sentinel');
    if (sentinel && sentinel !== 'riku-platform-v3') throw new Error('Platform key verification failed.');
    if (!sentinel) store.put('_system','config','sentinel','riku-platform-v3');
    return store;
  }
  digest(value: string) { return createHmac('sha256', this.key).update(value).digest('hex'); }
  private encrypt(value: unknown, aad: string) {
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(Buffer.from(aad));
    const bytes = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), bytes]).toString('base64');
  }
  private decrypt<T>(encoded: string, aad: string): T {
    const bytes = Buffer.from(encoded,'base64'), decipher = createDecipheriv('aes-256-gcm', this.key, bytes.subarray(0,12));
    decipher.setAAD(Buffer.from(aad)); decipher.setAuthTag(bytes.subarray(12,28));
    return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8')) as T;
  }
  transaction<T>(action: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = action(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  put(tenant: string, collection: string, id: string, value: unknown, expires?: number) {
    this.db.prepare('INSERT INTO records VALUES(?,?,?,?,?) ON CONFLICT(tenant,collection,id) DO UPDATE SET payload=excluded.payload,expires=excluded.expires').run(tenant,collection,id,this.encrypt(value, `${tenant}/${collection}/${id}`),expires ?? null);
  }
  get<T>(tenant: string, collection: string, id: string): T | undefined {
    const row = this.db.prepare('SELECT payload,expires FROM records WHERE tenant=? AND collection=? AND id=?').get(tenant,collection,id) as { payload: string; expires: number | null } | undefined;
    if (!row || row.expires !== null && row.expires <= Date.now()) return undefined;
    return this.decrypt<T>(row.payload,`${tenant}/${collection}/${id}`);
  }
  list<T>(tenant: string, collection: string): T[] {
    const rows = this.db.prepare('SELECT id,payload FROM records WHERE tenant=? AND collection=? AND (expires IS NULL OR expires>?) ORDER BY rowid').all(tenant,collection,Date.now()) as {id:string;payload:string}[];
    return rows.map(row => this.decrypt<T>(row.payload,`${tenant}/${collection}/${row.id}`));
  }
  remove(tenant: string, collection: string, id: string) { this.db.prepare('DELETE FROM records WHERE tenant=? AND collection=? AND id=?').run(tenant,collection,id); }
  indexRequirements(tenant: string, project: string, version: number, requirements: {id:string}[]) {
    const insert = this.db.prepare('INSERT INTO requirements VALUES(?,?,?,?,?)');
    for (const requirement of requirements) insert.run(tenant,project,version,requirement.id,this.encrypt(requirement,`${tenant}/${project}/${version}/${requirement.id}`));
  }
  audit(tenant: string, actor: string, action: string, subject: string, details: unknown = {}) {
    const last = this.db.prepare('SELECT seq,hash FROM audit_heads WHERE tenant=?').get(tenant) as {seq:number;hash:string}|undefined;
    const seq = (last?.seq ?? 0)+1, previous = last?.hash ?? 'genesis', at = new Date().toISOString();
    const payload = this.encrypt({actor,action,subject,details},`${tenant}/audit/${seq}`);
    const hash = this.digest(`${tenant}|${seq}|${at}|${previous}|${payload}`);
    this.db.prepare('INSERT INTO audit VALUES(?,?,?,?,?,?)').run(tenant,seq,at,payload,previous,hash);
    this.db.prepare('INSERT INTO audit_heads VALUES(?,?,?,?) ON CONFLICT(tenant) DO UPDATE SET seq=excluded.seq,hash=excluded.hash,signature=excluded.signature').run(tenant,seq,hash,this.digest(`head|${tenant}|${seq}|${hash}`));
  }
  verifyAudit(tenant: string) {
    const rows = this.db.prepare('SELECT * FROM audit WHERE tenant=? ORDER BY seq').all(tenant) as { seq:number;at:string;payload:string;previous:string;hash:string }[];
    const anchor=this.db.prepare('SELECT * FROM audit_anchors WHERE tenant=?').get(tenant) as {seq:number;hash:string;signature:string}|undefined;
    if(anchor&&anchor.signature!==this.digest(`anchor|${tenant}|${anchor.seq}|${anchor.hash}`))return {valid:false,entries:0,brokenAt:anchor.seq};
    let previous = anchor?.hash??'genesis', count = anchor?.seq??0;
    for (const row of rows) {
      count++;
      if (row.seq !== count || row.previous !== previous || row.hash !== this.digest(`${tenant}|${row.seq}|${row.at}|${row.previous}|${row.payload}`)) return {valid:false, entries:count, brokenAt:row.seq};
      previous = row.hash;
    }
    const head = this.db.prepare('SELECT * FROM audit_heads WHERE tenant=?').get(tenant) as {seq:number;hash:string;signature:string}|undefined;
    return {valid:(!head && count===0) || head?.seq===count && head.hash===previous && head.signature===this.digest(`head|${tenant}|${head.seq}|${head.hash}`), entries:rows.length, prunedThrough:anchor?.seq??0};
  }
  auditEntries(tenant: string): AuditEntry[] {
    if (!this.verifyAudit(tenant).valid) throw new Error('Audit integrity failure.');
    const rows = this.db.prepare('SELECT * FROM audit WHERE tenant=? ORDER BY seq').all(tenant) as {seq:number;at:string;payload:string;previous:string;hash:string}[];
    return rows.map(row => ({sequence:row.seq,at:row.at,previous:row.previous,hash:row.hash,...this.decrypt<{actor:string;action:string;subject:string;details:unknown}>(row.payload,`${tenant}/audit/${row.seq}`)}));
  }
  purgeExpired(now=Date.now()) { return this.db.prepare('DELETE FROM records WHERE expires IS NOT NULL AND expires<=?').run(now).changes; }
  pruneAudit(tenant:string,before:string) {
    if(!this.verifyAudit(tenant).valid)throw new Error('Cannot prune an invalid audit chain.');
    const row=this.db.prepare('SELECT seq,hash FROM audit WHERE tenant=? AND at<? ORDER BY seq DESC LIMIT 1').get(tenant,before) as {seq:number;hash:string}|undefined;
    if(!row)return 0;
    this.db.prepare('INSERT INTO audit_anchors VALUES(?,?,?,?) ON CONFLICT(tenant) DO UPDATE SET seq=excluded.seq,hash=excluded.hash,signature=excluded.signature').run(tenant,row.seq,row.hash,this.digest(`anchor|${tenant}|${row.seq}|${row.hash}`));
    return this.db.prepare('DELETE FROM audit WHERE tenant=? AND seq<=?').run(tenant,row.seq).changes;
  }
  tenantIds() {return (this.db.prepare("SELECT DISTINCT tenant FROM records WHERE collection='projects'").all() as {tenant:string}[]).map(row=>row.tenant);}
  deleteProjectData(tenant:string, project:string) { this.db.prepare('DELETE FROM requirements WHERE tenant=? AND project=?').run(tenant,project); }
  close() { this.db.close(); this.key.fill(0); }
}
export const contentHash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
