import { env } from 'cloudflare:workers';
import {journalUser} from '../lib/auth';
import {validateRecord} from '../lib/validate-record.mjs';

const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
type Row={id:string;version:number;payload:string|null;updated_at:string};
function entry(row:Row){return {id:row.id,version:row.version,record:row.payload===null?null:JSON.parse(row.payload),updatedAt:row.updated_at}}
async function bodyJson(request:Request){
 const reader=request.body?.getReader();if(!reader)throw Error('请求为空');let length=0;const chunks:Uint8Array[]=[];
 for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>65536){await reader.cancel();throw Error('请求过大')}chunks.push(value)}
 const bytes=new Uint8Array(length);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length}return JSON.parse(new TextDecoder().decode(bytes));
}
export async function GET(request:Request){
 const user=await journalUser(request);if(!user)return reply({user:null,entries:[]});
 try{if(!env.DB)return reply({error:'云端存储暂不可用，请保留本地备份。'},503);
 const rows=await env.DB.prepare('SELECT id,version,payload,updated_at FROM reaction_records WHERE user_id=? ORDER BY id').bind(user.userId).all<Row>();
 return reply({user:{id:user.userId,name:user.displayName,kind:user.kind},entries:rows.results.map(entry)});
 }catch{return reply({error:'云端读取失败，请稍后重试。'},503)}
}
export async function POST(request:Request){
 const user=await journalUser(request);if(!user)return reply({error:'请先登录，再同步记录。'},401);
 const origin=request.headers.get('origin');
 if((origin&&origin!==new URL(request.url).origin)||request.headers.get('x-journal-action')!=='save'||!request.headers.get('content-type')?.startsWith('application/json'))return reply({error:'请求来源无效。'},403);
 let input;try{input=await bodyJson(request);if(typeof input.id!=='string'||!input.id||input.id.length>150||!Number.isSafeInteger(input.baseVersion)||input.baseVersion<0||input.baseVersion>=2147483647)throw Error('记录版本无效');if(input.record!==null){input.record=validateRecord(input.record);if(input.record.id!==input.id)throw Error('记录 ID 不一致')}}catch(e){return reply({error:e instanceof Error?e.message:'请求格式无效。'},400)}
 try{if(!env.DB)return reply({error:'云端存储暂不可用。'},503);
 if(input.accountId!==user.userId)return reply({error:'账号已切换，请重新加载页面。'},401);
 if(input.record?.kind==='day'&&input.record.sleepModel!==2){
 const existing=await env.DB.prepare('SELECT id,version,payload,updated_at FROM reaction_records WHERE user_id=? AND id=?').bind(user.userId,input.id).first<Row>();
 if(existing?.payload&&JSON.parse(existing.payload).sleepModel===2)return reply({error:'睡眠记录已升级，请刷新页面后使用新的睡眠表单。',current:entry(existing)},409);
 }
 const payload=input.record===null?null:JSON.stringify(input.record),now=new Date().toISOString();
 const row=input.baseVersion===0?
 await env.DB.prepare('INSERT INTO reaction_records(user_id,id,version,payload,updated_at) VALUES(?,?,1,?,?) ON CONFLICT(user_id,id) DO NOTHING RETURNING id,version,payload,updated_at').bind(user.userId,input.id,payload,now).first<Row>():
 await env.DB.prepare('UPDATE reaction_records SET version=version+1,payload=?,updated_at=? WHERE user_id=? AND id=? AND version=? RETURNING id,version,payload,updated_at').bind(payload,now,user.userId,input.id,input.baseVersion).first<Row>();
 if(row)return reply({entry:entry(row)});
 const current=await env.DB.prepare('SELECT id,version,payload,updated_at FROM reaction_records WHERE user_id=? AND id=?').bind(user.userId,input.id).first<Row>();
 // Retrying a request whose acknowledgement was lost must not create a conflict.
 if(current&&current.version===input.baseVersion+1&&current.payload===payload)return reply({entry:entry(current)});
 return reply({error:'这条记录已在其他设备修改。',current:current?entry(current):null},409);
 }catch{return reply({error:'同步未完成，修改仍保留在本机，请稍后重试。'},503)}
}



