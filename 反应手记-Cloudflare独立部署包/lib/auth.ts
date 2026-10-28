import {env} from 'cloudflare:workers';
import {betterAuth} from 'better-auth/minimal';
import {drizzleAdapter} from 'better-auth/adapters/drizzle';
import {drizzle} from 'drizzle-orm/d1';
import {randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';

import * as schema from '../db/schema';

export function siteOrigin(){const raw=(env as typeof env & {APP_ORIGIN?:string}).APP_ORIGIN;if(!raw)throw Error('APP_ORIGIN 未设置');const url=new URL(raw);if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))throw Error('APP_ORIGIN 无效');return url.origin}
const options={N:16384,r:16,p:1,maxmem:64*1024*1024};
export function createAuth(origin=siteOrigin()){
 const secret=(env as typeof env&{REACTION_AUTH_SECRET?:string}).REACTION_AUTH_SECRET;
 if(!env.DB||!secret)throw Error('账号服务暂不可用');
 const baseURL=siteOrigin();if(origin!==baseURL)throw Error('请求域名与 APP_ORIGIN 不一致');
 return betterAuth({
  appName:'反应手记',baseURL,basePath:'/api/auth',secret,
  database:drizzleAdapter(drizzle(env.DB,{schema}),{provider:'sqlite',schema,transaction:false}),
  emailAndPassword:{enabled:true,minPasswordLength:10,maxPasswordLength:128,autoSignIn:true,
   password:{async hash(password){const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(password.normalize('NFKC'),salt,64,options).toString('hex')},
    async verify({password,hash}){const [salt,key]=hash.split(':');if(!salt||!key||key.length!==128)return false;const actual=scryptSync(password.normalize('NFKC'),salt,64,options);return timingSafeEqual(Buffer.from(key,'hex'),actual)}}},
  session:{expiresIn:60*60*24*30,updateAge:60*60*24,cookieCache:{enabled:false}},
  advanced:{cookiePrefix:'reaction-account',ipAddress:{ipAddressHeaders:['cf-connecting-ip']}},
  rateLimit:{enabled:true,storage:'database',window:60,max:60,customRules:{'/sign-in/email':{window:60,max:8},'/sign-up/email':{window:3600,max:10}}},
 });
}
export async function journalUser(request:Request){const result=await createAuth(new URL(request.url).origin).api.getSession({headers:request.headers});return result?{userId:'account:'+result.user.id,displayName:result.user.email,kind:'password' as const}:null}
