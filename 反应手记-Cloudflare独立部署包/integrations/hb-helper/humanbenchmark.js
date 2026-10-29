(function(){
 'use strict';
 const detector=globalThis.ReactionHBDetector;if(!detector||window.top!==window||!detector.isTestUrl(location.href))return;
 let attempted=false,pending=false,timer=0;
 function status(text,failed=false){
  let box=document.getElementById('reaction-diary-hb-helper');if(!box){box=document.createElement('aside');box.id='reaction-diary-hb-helper';box.setAttribute('role','status');box.style.cssText='position:fixed;right:16px;bottom:16px;z-index:2147483647;max-width:310px;padding:13px 16px;border:1px solid #b9cdb9;border-radius:10px;background:#f5faf4;color:#264c36;font:14px/1.65 system-ui,sans-serif;box-shadow:0 3px 15px #0002';document.documentElement.appendChild(box)}
  box.textContent=text;if(failed){box.style.borderColor='#d9bd73';box.style.background='#fff9e9';box.style.color='#775b16'}
 }
 function observeResult(){
  timer=0;if(pending||attempted||!detector.isTestUrl(location.href))return;const score=detector.readFinalScore(document,location.href);if(score===null)return;
  attempted=true;pending=true;
  chrome.runtime.sendMessage({type:'HB_FINAL',rt:score,evidence:'terminal-view-score'},result=>{
   pending=false;const error=chrome.runtime.lastError;
   if(!error&&result?.ok)status('平均成绩 '+score+' ms 已回填到反应手记草稿。请核实后手动保存。此测试页保留供核对；下一组请从反应手记重新发起。');
   else status('平均成绩 '+score+' ms 未自动回填。'+(result?.error||'记录页或助手连接不可用。')+' 请手动填写此成绩；下一轮请从反应手记发起。',true);
  });
 }
 const observer=new MutationObserver(mutations=>{if(attempted||pending||timer)return;if(mutations.every(m=>m.target?.closest?.('#reaction-diary-hb-helper')))return;timer=setTimeout(observeResult,80)});
 observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class']});observeResult();
})();
