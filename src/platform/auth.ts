import { randomUUID, randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { TOTP, Secret } from 'otpauth';
import { z } from 'zod';
import { PlatformStore } from './store';

const scrypt = promisify(scryptCallback);
export const roles = ['admin','analyst','product_owner','architect','security','legal','project_manager','operations','viewer'] as const;
export type Role = typeof roles[number];
export type Principal = {id:string;tenantId:string;username:string;roles:Role[];disabled:boolean};
type User = Principal & {password:string;totpSecret:string;lastCounter:number};
type Session = {id:string;userId:string;tenantId:string;csrf:string;created:number;lastSeen:number};
type Enrollment = {id:string;user:User;expires:number;inviteId?:string;tenantName?:string};
type Invite = {id:string;tenantId:string;username:string;roles:Role[];expires:number};
export class HttpError extends Error { constructor(readonly status:number, message:string) { super(message); } }
export const requireRole = (principal:Principal, allowed: readonly Role[]) => { if (!principal.roles.some(role=>allowed.includes(role))) throw new HttpError(403,'Your role cannot perform this action.'); };
const hashToken = (token:string) => createHash('sha256').update(token).digest('hex');
const usernameSchema = z.string().trim().min(3).max(80).regex(/^[a-zA-Z0-9._@-]+$/);
const passwordSchema = z.string().min(12).max(200);
const publicUser = ({password:_,totpSecret:__,lastCounter:___,...user}:User):Principal => user;
const otp = (secret:string,label='RikuAI') => new TOTP({issuer:'RikuAI',label,algorithm:'SHA1',digits:6,period:30,secret:Secret.fromBase32(secret)});
export const otpCode = (secret:string,timestamp=Date.now()) => otp(secret).generate({timestamp});
export class AuthService {
  private attempts = new Map<string,{count:number;reset:number}>();
  constructor(readonly store:PlatformStore) {}
  setupRequired() { return !this.store.get('_system','config','bootstrap-tenant'); }
  private loginId(tenant:string,username:string) { return this.store.digest(`login:${tenant}:${username.toLowerCase()}`); }
  private limit(key:string,maximum=8) {
    const previous=this.attempts.get(key); const entry=previous && previous.reset>Date.now()?previous:{count:0,reset:Date.now()+15*60_000};
    entry.count++; this.attempts.set(key,entry);
    if(this.attempts.size>10000) for(const [id,value] of this.attempts) if(value.reset<Date.now()) this.attempts.delete(id);
    if(entry.count>maximum) throw new HttpError(429,'Too many authentication attempts. Try again in 15 minutes.');
  }
  private async hashPassword(password:string) { const salt=randomBytes(16).toString('hex'); const key=await scrypt(password,salt,64) as Buffer; return `${salt}:${key.toString('hex')}`; }
  private async checkPassword(password:string,encoded:string) { const [salt,hash]=encoded.split(':'); const candidate=await scrypt(password,salt!,64) as Buffer; const expected=Buffer.from(hash!,'hex');return expected.length===candidate.length && timingSafeEqual(candidate,expected); }
  async startSetup(username:string,password:string,tenantName:string) {
    if(!this.setupRequired()) throw new HttpError(409,'Workspace already configured.');
    this.limit('bootstrap'); username=usernameSchema.parse(username); passwordSchema.parse(password); z.string().trim().min(2).max(100).parse(tenantName);
    const tenantId=randomUUID(), user:User={id:randomUUID(),tenantId,username,roles:['admin','analyst'],disabled:false,password:await this.hashPassword(password),totpSecret:new Secret({size:20}).base32,lastCounter:-1};
    const id=randomBytes(32).toString('base64url');
    this.store.put('_system','enrollments',hashToken(id),{id:hashToken(id),user,expires:Date.now()+15*60_000,tenantName} satisfies Enrollment,Date.now()+15*60_000);
    return {enrollmentToken:id,secret:user.totpSecret,uri:otp(user.totpSecret,username).toString()};
  }
  invite(principal:Principal,username:string,assignedRoles:Role[]) {
    requireRole(principal,['admin']); username=usernameSchema.parse(username); z.array(z.enum(roles)).min(1).parse(assignedRoles);
    if(this.store.get(principal.tenantId,'users',this.loginId(principal.tenantId,username))) throw new HttpError(409,'Username already exists.');
    const token=randomBytes(32).toString('base64url'), id=hashToken(token), expires=Date.now()+24*3600_000;
    this.store.transaction(()=>{this.store.put('_system','invites',id,{id,tenantId:principal.tenantId,username,roles:[...new Set(assignedRoles)],expires} satisfies Invite,expires);this.store.audit(principal.tenantId,principal.id,'user.invited',username,{roles:assignedRoles});});
    return {token,expires};
  }
  async startEnrollment(token:string,password:string) {
    this.limit('enrollment:'+hashToken(token)); passwordSchema.parse(password);
    const invite=this.store.get<Invite>('_system','invites',hashToken(token)); if(!invite) throw new HttpError(401,'Invitation invalid or expired.');
    const id=randomBytes(32).toString('base64url'), user:User={id:randomUUID(),tenantId:invite.tenantId,username:invite.username,roles:invite.roles,disabled:false,password:await this.hashPassword(password),totpSecret:new Secret({size:20}).base32,lastCounter:-1};
    this.store.put('_system','enrollments',hashToken(id),{id:hashToken(id),user,expires:Date.now()+15*60_000,inviteId:invite.id} satisfies Enrollment,Date.now()+15*60_000);
    return {enrollmentToken:id,secret:user.totpSecret,uri:otp(user.totpSecret,user.username).toString()};
  }
  finishEnrollment(token:string,code:string) {
    this.limit('finish:'+hashToken(token));
    const enrollment=this.store.get<Enrollment>('_system','enrollments',hashToken(token));if(!enrollment)throw new HttpError(401,'Enrollment expired.');
    const delta=otp(enrollment.user.totpSecret).validate({token:code,window:1});if(delta===null)throw new HttpError(401,'Invalid authenticator code.');
    this.store.transaction(()=>{
      if(enrollment.inviteId && !this.store.get('_system','invites',enrollment.inviteId))throw new HttpError(409,'Invitation already used.');
      if(!enrollment.inviteId && !this.setupRequired())throw new HttpError(409,'Workspace already configured.');
      const loginId=this.loginId(enrollment.user.tenantId,enrollment.user.username);
      if(this.store.get(enrollment.user.tenantId,'users',loginId))throw new HttpError(409,'Username already enrolled.');
      enrollment.user.lastCounter=Math.floor(Date.now()/30_000)+delta;
      this.store.put(enrollment.user.tenantId,'users',loginId,enrollment.user);
      if(!enrollment.inviteId) {this.store.put('_system','config','bootstrap-tenant',enrollment.user.tenantId);this.store.put(enrollment.user.tenantId,'config','workspace',{name:enrollment.tenantName,retentionDays:90});}
      if(enrollment.inviteId)this.store.remove('_system','invites',enrollment.inviteId);
      this.store.remove('_system','enrollments',hashToken(token));
      this.store.audit(enrollment.user.tenantId,enrollment.user.id,'user.enrolled',enrollment.user.id,{roles:enrollment.user.roles,mfa:true});
    });
    return this.createSession(enrollment.user);
  }
  private createSession(user:User) {
    const token=randomBytes(32).toString('base64url'), id=hashToken(token), csrf=randomBytes(24).toString('base64url'), now=Date.now();
    this.store.put('_system','sessions',id,{id,userId:this.loginId(user.tenantId,user.username),tenantId:user.tenantId,csrf,created:now,lastSeen:now} satisfies Session,now+8*3600_000);
    return {token,csrf,user:publicUser(user)};
  }
  async login(tenantId:string,username:string,password:string,code:string,ip:string) {
    usernameSchema.parse(username);z.string().max(200).parse(password);this.limit(`ip:${ip}`,80);this.limit(`account:${tenantId}:${username.toLowerCase()}`);
    const user=this.store.get<User>(tenantId,'users',this.loginId(tenantId,username));
    const valid=await this.checkPassword(password,user?.password??'00000000000000000000000000000000:'+'0'.repeat(128));
    if(!user || !valid || user.disabled)throw new HttpError(401,'Invalid credentials or authenticator code.');
    const fresh=this.store.get<User>(tenantId,'users',this.loginId(tenantId,username))!;
    const delta=otp(fresh.totpSecret).validate({token:code,window:1}); const counter=Math.floor(Date.now()/30_000)+(delta??0);
    if(delta===null || counter<=fresh.lastCounter || fresh.disabled)throw new HttpError(401,'Invalid or already used authenticator code. Wait for a new code.');
    fresh.lastCounter=counter;this.store.put(tenantId,'users',this.loginId(tenantId,username),fresh);
    this.store.audit(tenantId,user.id,'auth.login',user.id,{mfa:true});
    this.attempts.delete(`account:${tenantId}:${username.toLowerCase()}`);
    return this.createSession(fresh);
  }
  authenticate(token:string) {
    const session=this.store.get<Session>('_system','sessions',hashToken(token));
    if(!session || Date.now()-session.lastSeen>30*60_000)throw new HttpError(401,'Sign in again.');
    const user=this.store.get<User>(session.tenantId,'users',session.userId);if(!user||user.disabled)throw new HttpError(401,'Account unavailable.');
    session.lastSeen=Date.now();this.store.put('_system','sessions',session.id,session,session.created+8*3600_000);
    return {principal:publicUser(user),csrf:session.csrf};
  }
  logout(token:string) { this.store.remove('_system','sessions',hashToken(token)); }
  users(principal:Principal) { requireRole(principal,['admin']);return this.store.list<User>(principal.tenantId,'users').map(publicUser); }
  disableUser(principal:Principal,id:string) {
    requireRole(principal,['admin']);const users=this.store.list<User>(principal.tenantId,'users'),user=users.find(item=>item.id===id);
    if(!user)throw new HttpError(404,'User not found.');if(user.id===principal.id)throw new HttpError(409,'Cannot disable your current account.');
    user.disabled=true;this.store.put(principal.tenantId,'users',this.loginId(principal.tenantId,user.username),user);this.store.audit(principal.tenantId,principal.id,'user.disabled',id);
  }
  tenantId() { return this.store.get<string>('_system','config','bootstrap-tenant')??null; }
}
