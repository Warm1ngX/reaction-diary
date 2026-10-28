import fs from 'node:fs';import {createInterface} from 'node:readline/promises';
const rl=createInterface({input:process.stdin,output:process.stdout});
try{const raw=(await rl.question('粘贴你创建的 Worker 的完整 https://...workers.dev 地址：')).trim();const u=new URL(raw);if(u.protocol!=='https:'||!u.hostname.endsWith('.workers.dev')||u.hostname.split('.').length!==4||u.username||u.password||u.port||u.search||u.hash||u.pathname!=='/')throw Error('请使用 Cloudflare 显示的 Worker 主页地址，不要带路径或查询参数。');
 const c=JSON.parse(fs.readFileSync('wrangler.json','utf8'));c.name=u.hostname.split('.')[0];c.vars.APP_ORIGIN=u.origin;fs.writeFileSync('wrangler.json',JSON.stringify(c,null,2)+'\n');console.log('已配置 Worker 名称和登录域名：'+u.origin);
}finally{rl.close()}
