export const DIARY_ORIGIN='https://reaction-diary.warm1ng.workers.dev';
export const TEST_URL='https://humanbenchmark.com/tests/reactiontime';
const CONTEXT=/^[a-zA-Z0-9_-]{16,160}$/;
export const validDiary=value=>{try{const u=new URL(value);return u.origin===DIARY_ORIGIN&&u.pathname==='/'}catch{return false}};
export const validTest=value=>{try{const u=new URL(value);return u.origin==='https://humanbenchmark.com'&&/^\/tests\/reactiontime\/?$/.test(u.pathname)}catch{return false}};
export function createBroker(api){
 let queue=Promise.resolve();
 const empty=()=>({runs:{},latest:{}}),id=sender=>sender?.frameId===0&&Number.isInteger(sender?.tab?.id)?sender.tab.id:null;
 async function run(message,sender){
  if(!message||typeof message!=='object')return {ok:false,error:'无效消息'};
  const tabId=id(sender);if(tabId===null)return {ok:false,error:'只接收顶层测试页面消息'};
  let state=await api.readState()||empty();if(!state.runs||!state.latest)state=empty();
  const now=api.now();for(const [key,r]of Object.entries(state.runs))if(!Number.isFinite(r.createdAt)||now-r.createdAt>30*60*1000){delete state.runs[key];if(state.latest[r.sourceTabId]===r.launchId)delete state.latest[r.sourceTabId]}
  if(message.type==='HB_START'){
   if(!validDiary(sender.url)||!CONTEXT.test(message.context))return {ok:false,error:'请从反应手记记录页发起测试'};
   for(const [key,r]of Object.entries(state.runs))if(r.sourceTabId===tabId)delete state.runs[key];
   const launchId=api.uuid(),created=await api.createTab({url:'about:blank',active:false});
   if(!Number.isInteger(created?.id))return {ok:false,error:'无法创建测试标签页'};
   state.runs[created.id]={sourceTabId:tabId,testTabId:created.id,context:message.context,launchId,createdAt:now,phase:'prepared'};state.latest[tabId]=launchId;await api.writeState(state);
   return {ok:true,launchId};
  }
  if(message.type==='HB_OPEN'||message.type==='HB_CANCEL'){
   if(!validDiary(sender.url)||!CONTEXT.test(message.context)||typeof message.launchId!=='string')return {ok:false,error:'无效启动请求'};
   const r=Object.values(state.runs).find(r=>r.sourceTabId===tabId&&r.launchId===message.launchId&&r.context===message.context);
   if(!r||r.phase!=='prepared'||state.latest[tabId]!==r.launchId)return {ok:false,error:'测试启动请求已失效'};
   const target=await api.getTab(r.testTabId).catch(()=>null);
   // Chrome can redact about:blank URL without blanket tabs permission.
   // This ID is a fresh owned placeholder, never a reused existing tab.
   const changed=target&&((target.url&&target.url!=='about:blank')||(target.pendingUrl&&target.pendingUrl!=='about:blank'));
   if(message.type==='HB_CANCEL'||!target||changed){
    delete state.runs[r.testTabId];delete state.latest[tabId];await api.writeState(state);
    if(target?.url==='about:blank')await api.removeTab(r.testTabId).catch(()=>{});
    return message.type==='HB_CANCEL'?{ok:true}:{ok:false,error:'测试标签页已改变，请重新发起'};
   }
   try{await api.updateTab(r.testTabId,{url:TEST_URL,active:true});r.phase='open';await api.writeState(state);return {ok:true}}catch{r.phase='failed';await api.writeState(state);return {ok:false,error:'无法打开 Human Benchmark'}}
  }
  if(message.type==='HB_FINAL'){
   if(!validTest(sender.url))return {ok:false,error:'仅接收反应测试页面结果'};
   const r=state.runs[tabId];if(!r||r.phase!=='open'||state.latest[r.sourceTabId]!==r.launchId)return {ok:false,error:'本轮未从记录页发起，或成绩已发送；请返回记录页重新发起'};
   if(message.evidence!=='terminal-view-score'||typeof message.rt!=='number'||!Number.isFinite(message.rt)||message.rt<1||message.rt>10000)return {ok:false,error:'最终平均成绩无法确认，请手动记录'};
   const source=await api.getTab(r.sourceTabId).catch(()=>null);if(!source||!validDiary(source.url)){r.phase='failed';await api.writeState(state);return {ok:false,error:'原记录页已关闭或跳转，请手动记录'}}
   r.phase='delivering';await api.writeState(state);
   try{
    const result=await api.sendToTab(r.sourceTabId,{type:'HB_DRAFT',context:r.context,launchId:r.launchId,rt:message.rt,capturedAt:new Date(now).toISOString()});
    if(!result?.ok)throw Error(result?.error||'记录页没有确认接收');
    r.phase='delivered';await api.writeState(state);await api.updateTab(r.sourceTabId,{active:true}).catch(()=>{});return {ok:true,rt:message.rt};
   }catch(e){r.phase='failed';await api.writeState(state);return {ok:false,error:String(e?.message||'回填未完成，请手动记录').slice(0,180)}}
  }
  return {ok:false,error:'不支持的消息'};
 }
 function handle(message,sender){const task=queue.then(()=>run(message,sender));queue=task.catch(()=>{});return task}
 function closed(tabId){const task=queue.then(async()=>{const state=await api.readState();if(!state?.runs)return;for(const [key,r]of Object.entries(state.runs))if(r.sourceTabId===tabId||r.testTabId===tabId){delete state.runs[key];if(state.latest[r.sourceTabId]===r.launchId)delete state.latest[r.sourceTabId]}await api.writeState(state)});queue=task.catch(()=>{});return task}
 return {handle,closed};
}
