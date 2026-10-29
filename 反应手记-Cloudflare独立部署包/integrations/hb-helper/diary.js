(function(){
 'use strict';
 const ORIGIN='https://reaction-diary.warm1ng.workers.dev';if(location.origin!==ORIGIN||location.pathname!=='/'||window.top!==window)return;
 const context=()=>document.getElementById('hbHelperStatus')?.dataset.context||'';
 const post=data=>window.postMessage({source:'reaction-hb-helper',...data},ORIGIN);
 const send=message=>new Promise((resolve,reject)=>{chrome.runtime.sendMessage(message,result=>{const error=chrome.runtime.lastError;if(error)reject(Error(error.message));else resolve(result)})});
 let launching=false,activeLaunch='';
 function ack(type,value){return new Promise(resolve=>{
  let done=false;const finish=accepted=>{if(done)return;done=true;clearTimeout(timer);window.removeEventListener('message',listener);resolve(accepted)};
  const listener=e=>{const d=e.data;if(e.source!==window||e.origin!==ORIGIN||!d||d.source!=='reaction-diary'||d.type!==type||d.context!==value.context||d.launchId!==value.launchId)return;finish(d.accepted===true)};
  const timer=setTimeout(()=>finish(false),2500);window.addEventListener('message',listener);post(value);
 })}
 window.addEventListener('message',e=>{const d=e.data;if(e.source!==window||e.origin!==ORIGIN||!d||d.source!=='reaction-diary'||d.type!=='ping'||!d.context||d.context!==context())return;post({type:'ready',context:d.context})});
 document.addEventListener('click',async e=>{
  const a=e.target.closest?.('a[data-hb-launch]');if(!a||!e.isTrusted||e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;
  const ctx=context();if(!ctx)return;e.preventDefault();e.stopImmediatePropagation();if(launching)return;launching=true;let launchId='';
  try{
   const result=await send({type:'HB_START',context:ctx});if(!result?.ok)throw Error(result?.error||'无法连接回填助手');launchId=result.launchId;activeLaunch=launchId;
   if(context()!==ctx||!await ack('started-ack',{type:'started',context:ctx,launchId}))throw Error('记录页状态已变化，请重新发起测试');
   const opened=await send({type:'HB_OPEN',context:ctx,launchId});if(!opened?.ok)throw Error(opened?.error||'无法打开测试页面');
  }catch(error){if(launchId)send({type:'HB_CANCEL',context:ctx,launchId}).catch(()=>{});post({type:'error',context:ctx,launchId,message:String(error.message||'助手启动失败'),error:String(error.message||'助手启动失败')})}finally{launching=false}
 },true);
 chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(message?.type!=='HB_DRAFT')return false;
  if(sender.id!==chrome.runtime.id||!context()||message.context!==context()||message.launchId!==activeLaunch){respond({ok:false,error:'原记录页已刷新或切换账号、日期，请手动记录'});return false}
  ack('result-ack',{type:'result',context:message.context,launchId:message.launchId,rt:message.rt,capturedAt:message.capturedAt}).then(accepted=>{
   if(accepted)activeLaunch='';respond(accepted?{ok:true}:{ok:false,error:'记录页未接收成绩，请手动填写并核实'});
  }).catch(()=>respond({ok:false,error:'回填确认未完成，请手动记录'}));return true;
 });
 if(context())post({type:'ready',context:context()});
})();
