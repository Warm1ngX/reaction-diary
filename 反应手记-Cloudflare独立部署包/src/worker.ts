import {createAuth} from '../lib/auth';
import {GET,POST} from './journal';
export default {
 async fetch(request:Request,env:Cloudflare.Env):Promise<Response>{
  const url=new URL(request.url);
  try{
   if(url.pathname.startsWith('/api/auth/'))return await createAuth(url.origin).handler(request);
   if(url.pathname==='/api/journal'){
    if(request.method==='GET')return await GET(request);
    if(request.method==='POST')return await POST(request);
    return new Response('Method not allowed',{status:405,headers:{Allow:'GET, POST'}});
   }
   if(url.pathname==='/api/legacy-import')return Response.json({error:'请在旧网站导出 JSON，再在新账号导入。'},{status:410});
   if(url.pathname.startsWith('/api/'))return Response.json({error:'Not found'},{status:404});
   if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
   if(url.pathname==='/'||url.pathname==='/insights'||url.pathname==='/insights/'){
    url.pathname=url.pathname==='/'?'/index.html':'/insights.html';
    const response=await env.ASSETS.fetch(new Request(url,request));const headers=new Headers(response.headers);headers.set('Cache-Control','no-cache');return new Response(response.body,{status:response.status,headers});
   }
   return env.ASSETS.fetch(request);
  }catch{return Response.json({error:'服务暂不可用，请检查域名、密钥和 D1 配置。'},{status:503,headers:{'Cache-Control':'no-store'}})}
 }
};
