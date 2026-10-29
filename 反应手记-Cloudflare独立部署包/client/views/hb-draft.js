// This channel only fills an unpersisted draft. Persistence remains in the explicit form submit.
const hbBridge={context:'',scope:null,launchId:null,connected:false,activeDraft:null,pending:null};
function resetHBTransfer(){hbBridge.context='';hbBridge.scope=null;hbBridge.launchId=null;hbBridge.activeDraft=null;hbBridge.pending=null;const panel=$('hbDraftReview');if(panel)panel.hidden=true;if($('hbPending'))$('hbPending').hidden=true;if($('hbDraftConfirmed'))$('hbDraftConfirmed').checked=false;}
function pingHBHelper(){if(hbBridge.context&&typeof window.postMessage==='function')window.postMessage({source:'reaction-diary',type:'ping',context:hbBridge.context},location.origin);}
function renderHBBridge(){
 const eligible=!journalBooting&&!editing&&currentJournalView()==='record'&&$('date').value===localDate();const scope=eligible?(cloud?.user.id||'local')+'|'+$('date').value:null;
 if(scope!==hbBridge.scope||eligible&&!hbBridge.context){const previous=hbBridge.activeDraft;if(previous&&!editing&&Number($('rt').value)===previous.rt)$('rt').value='';resetHBTransfer();hbBridge.scope=scope;if(eligible)hbBridge.context=crypto.randomUUID();pingHBHelper();}
 $('hbHelperStatus').dataset.context=hbBridge.context;
 if(!eligible)$('hbHelperStatus').textContent=journalBooting?'正在检查账号，稍后可发起回填。':editing?'正在编辑历史记录；自动回填仅用于今天的新测试。':'自动回填用于今天的新测试。';
 else if(hbBridge.launchId&&!hbBridge.activeDraft&&!hbBridge.pending)$('hbHelperStatus').textContent='正在等待本次 Human Benchmark 最终平均成绩…';
 else $('hbHelperStatus').textContent=hbBridge.connected?'回填助手已连接 · 测试结束后填入待核实草稿。':'未连接回填助手，可直接手动填写。';
}
function validHBDraft(data){return data&&Number.isFinite(data.rt)&&data.rt>=1&&data.rt<=10000&&typeof data.capturedAt==='string'&&Number.isFinite(Date.parse(data.capturedAt))&&Date.now()-Date.parse(data.capturedAt)>=-120000&&Date.now()-Date.parse(data.capturedAt)<=1800000;}
function applyHBDraft(data){
 if(!validHBDraft(data)||editing||!hbBridge.context||data.context!==hbBridge.context)return false;
 const captured=new Date(data.capturedAt);if(localDate(captured)!==$('date').value){notify('测试日期与当前记录日期不同，请切换日期后重新发起测试。');return false;}
 $('rt').value=String(data.rt);$('time').value=String(captured.getHours()).padStart(2,'0')+':'+String(captured.getMinutes()).padStart(2,'0');testTimeEdited=true;
 hbBridge.activeDraft={...data};hbBridge.pending=null;$('hbPending').hidden=true;$('hbDraftReview').hidden=false;$('hbDraftConfirmed').checked=false;
 $('hbDraftSummary').textContent='最终平均 '+data.rt+' ms · '+$('date').value+' '+$('time').value+'。尚未保存，你可以修改。';$('save').textContent='核实后保存这次测试';renderSleepContext();$('rt').focus({preventScroll:true});notify('平均成绩已回填，核实后再保存。');return true;
}
function acknowledgeHB(type,data,accepted){if(typeof window.postMessage==='function')window.postMessage({source:'reaction-diary',type,context:data.context,launchId:data.launchId,accepted},location.origin);}
function onHBMessage(event){
 const data=event.data;if(event.source!==window||event.origin!==location.origin||!data||data.source!=='reaction-hb-helper'||!hbBridge.context||data.context!==hbBridge.context)return;
 if(data.type==='ready'){hbBridge.connected=true;renderHBBridge();return;}
 if(data.type==='started'&&typeof data.launchId==='string'&&data.launchId.length>=16){hbBridge.connected=true;hbBridge.launchId=data.launchId;renderHBBridge();acknowledgeHB('started-ack',data,true);return;}
 if(data.type==='error'){if(data.launchId===hbBridge.launchId)hbBridge.launchId=null;renderHBBridge();notify(String(data.message||data.error||'回填未完成，可手动填写。').slice(0,180));return;}
 if(data.type!=='result'||typeof data.launchId!=='string'||data.launchId!==hbBridge.launchId||!validHBDraft(data))return;
 hbBridge.launchId=null;
 if(editing){notify('正在编辑历史记录，未覆盖已有成绩。');acknowledgeHB('result-ack',data,false);return;}
 if($('rt').value!==''){
  hbBridge.pending={...data};$('hbPending').hidden=false;$('hbPendingText').textContent='收到最终平均 '+data.rt+' ms，当前已有成绩草稿。是否替换？尚未保存。';renderHBBridge();acknowledgeHB('result-ack',data,true);return;
 }
 const accepted=applyHBDraft(data);renderHBBridge();acknowledgeHB('result-ack',data,accepted);
}
function initializeHBBridge(){
 window.addEventListener('message',onHBMessage);window.addEventListener('focus',pingHBHelper);
 $('hbUsePending').onclick=()=>{if(hbBridge.pending)applyHBDraft(hbBridge.pending)};
 $('hbIgnorePending').onclick=()=>{hbBridge.pending=null;$('hbPending').hidden=true;};
 $('hbDiscardDraft').onclick=()=>{if(hbBridge.activeDraft)$('rt').value='';hbBridge.activeDraft=null;$('hbDraftReview').hidden=true;$('hbDraftConfirmed').checked=false;$('save').textContent=editing?'保存修改':'保存这次测试';};
 $('rt').addEventListener('input',()=>{if(hbBridge.activeDraft){$('hbDraftConfirmed').checked=false;$('hbDraftSummary').textContent='草稿成绩已修改，请重新核对。尚未保存。';}});
 $('time').addEventListener('input',()=>{if(hbBridge.activeDraft)$('hbDraftConfirmed').checked=false;});
 renderHBBridge();pingHBHelper();
}
