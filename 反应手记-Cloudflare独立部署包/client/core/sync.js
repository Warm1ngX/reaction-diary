// Cloud state is scoped to the authenticated account. The original local key remains intact.
let cloudError='',lastSyncTime='';
const cloudKey=id=>'reaction-journal-cloud-v2:'+id;
function snapshot(c){return {version:2,entries:[...c.entries.values()],pending:[...c.pending.values()]}}
function storeCloud(c){localStorage.setItem(c.key,JSON.stringify(snapshot(c)))}
function cloudRecords(c){const map=new Map();for(const e of c.entries.values())if(e.record)map.set(e.id,e.record);for(const p of c.pending.values()){if(p.record)map.set(p.id,p.record);else map.delete(p.id)}return [...map.values()]}
function persistJournal(next){
 if(!cloud){try{localStorage.setItem(KEY,JSON.stringify({version:1,records:next}));records=next;localRecords=[...next];return true}catch(e){notify('无法保存到浏览器，请先导出备份。'+e.message);return false}}
 const c=cloud,before=new Map(records.map(r=>[r.id,r])),after=new Map(next.map(r=>[r.id,r])),pending=new Map(c.pending);
 for(const id of new Set([...before.keys(),...after.keys()])){const old=before.get(id),record=after.get(id)||null;if(JSON.stringify(old??null)===JSON.stringify(record))continue;const previous=pending.get(id);const baseVersion=previous?.baseVersion??(id===editing&&editBaseVersion!==null?editBaseVersion:id==='day:'+$('date').value&&dailyBaseVersion!==null?dailyBaseVersion:c.entries.get(id)?.version??0);pending.set(id,{id,record,baseVersion,opId:crypto.randomUUID(),conflict:previous?.conflict||null})}
 const nextCloud={...c,pending};try{storeCloud(nextCloud)}catch(e){notify('本机存储空间不足，修改未保存，请导出备份。');return false}
 c.pending=pending;records=next;cloudError='';updateSyncUI();queueMicrotask(flushCloud);return true;
}
function firstConflict(){return cloud?[...cloud.pending.values()].find(p=>p.conflict):null}
function updateSyncUI(){
 $('signIn').hidden=cloud?.user.kind==='password';$('accountOpen').textContent=cloud?.user.kind==='password'?'我的账号':'账号登录';$('signOut').hidden=!cloud;$('syncNow').hidden=!cloud;
 if(!cloud){$('migrate').hidden=true;$('syncLabel').textContent=journalBooting?'正在检查登录状态…':cloudError?'云端未连接 · 本机模式':'本机模式 · 未登录';$('syncDetail').textContent=cloudError||'仅保存在此浏览器。登录后可在手机、电脑和不同浏览器同步。';$('conflictBox').hidden=true;return}
 const pending=cloud.pending.size,conflict=firstConflict();$('syncLabel').textContent=conflict?'有记录需要你确认':cloudError?'暂未完成同步':syncing?'正在同步…':pending?'已存本机 · 等待同步':'已与云端同步';
 $('syncDetail').textContent=cloud.user.name+' · '+(cloudError|| (pending?pending+' 条修改保留在本机，联网后重试。':(cloud.user.kind==='password'?'同一邮箱账号可在其他设备查看。':'当前为旧 ChatGPT 账号，可注册独立账号后迁移。')+(lastSyncTime?' 上次同步 '+lastSyncTime:'')));
 const oldCount=localRecords.filter(r=>!cloud.entries.has(r.id)&&!cloud.pending.has(r.id)).length;$('migrate').hidden=oldCount===0;$('migrate').textContent='迁入本机旧记录（'+oldCount+' 条）';
 $('conflictBox').hidden=!conflict;if(conflict){const local=conflict.record,remote=conflict.conflict.record;const label=r=>!r?'已删除':r.kind==='day'?r.date+' 当天情况：'+(r.sleepModel===2?(r.nightHours??'未填'):(r.sleep??'未填'))+' 小时主睡眠 / '+(r.napStatus==='recorded'?'午睡 '+r.napStart+'–'+r.napEnd:r.napStatus==='none'?'无午睡':'午睡待补充'):r.date+' '+r.time+'，'+r.rt+' ms，'+(r.state||'未记录状态')+(r.notes?'，备注：'+r.notes:'');$('conflictText').textContent='本机：'+label(local)+'。云端：'+label(remote)+'。请选择保留哪一条。'}
}
async function api(path,options={}){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);try{const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options,signal:controller.signal});let data;try{data=await response.json()}catch{throw Error('服务器未返回有效数据，可能被网络防护拦截。')}return {response,data}}finally{clearTimeout(timer)}}
function mergeCloudEntries(c,entries){if(!Array.isArray(entries))throw Error('云端数据格式无效');const map=new Map();for(const e of entries){if(!e||typeof e.id!=='string'||!Number.isSafeInteger(e.version)||e.version<1)throw Error('云端版本无效');if(e.record!==null){validateRecord(e.record);if(e.record.id!==e.id)throw Error('云端记录 ID 不一致')}map.set(e.id,e)}c.entries=map}
function makeCloud(user,entries){const c={user,key:cloudKey(user.id),entries:new Map(),pending:new Map()};mergeCloudEntries(c,entries);try{const saved=JSON.parse(localStorage.getItem(c.key)||'null');if(saved?.version===2&&Array.isArray(saved.pending)){for(const p of saved.pending){if(!p||typeof p.id!=='string'||typeof p.opId!=='string'||!Number.isSafeInteger(p.baseVersion)||p.baseVersion<0)throw Error('待同步版本无效');if(p.record!==null){validateRecord(p.record);if(p.record.id!==p.id)throw Error('待同步 ID 无效')}c.pending.set(p.id,p)}}}catch(e){throw Error('本机待同步记录读取失败，请勿清理浏览器数据。'+e.message)}return c}
function backToLocal(message){dailyDirty=false;cloud=null;records=[...localRecords];cloudError=message;resetForm();render();updateSyncUI()}
async function refreshCloud(){
 if(refreshing||syncing||journalBooting)return;refreshing=true;
 try{const {response,data}=await api('/api/journal');if(!response.ok)throw Error(data.error||'云端连接失败');if(!data.user){if(cloud)backToLocal('登录已失效，未同步的修改仍保留在本机。请重新登录。');else{cloudError='';updateSyncUI()}return}
 if(!cloud||cloud.user.id!==data.user.id){cloud=makeCloud(data.user,data.entries);dailyDirty=false;resetForm()}else{mergeCloudEntries(cloud,data.entries);cloud.user=data.user}
 records=cloudRecords(cloud);storeCloud(cloud);cloudError='';lastSyncTime=localTime();render();updateSyncUI();
 }catch(e){cloudError=e.name==='AbortError'?'连接超时，记录仍在本机，请稍后重试。':e.message;updateSyncUI()}finally{refreshing=false}
 if(cloud)await flushCloud();
}
async function flushCloud(){
 if(!cloud||syncing||refreshing||journalBooting)return;syncing=true;const c=cloud;updateSyncUI();
 try{for(;;){if(cloud!==c)break;const change=[...c.pending.values()].find(p=>!p.conflict);if(!change)break;const sent={...change};
 const {response,data}=await api('/api/journal',{method:'POST',headers:{'Content-Type':'application/json','X-Journal-Action':'save'},body:JSON.stringify({accountId:c.user.id,id:sent.id,baseVersion:sent.baseVersion,record:sent.record})});
 if(response.status===401){backToLocal('登录已失效，请重新登录继续同步。未同步修改仍保留在本机。');break}
 if(response.status===409){const current=c.pending.get(sent.id);if(current){const remote=data.current||{id:sent.id,version:0,record:null};if(data.current)c.entries.set(sent.id,data.current);current.conflict=remote;storeCloud(c)}continue}
 if(!response.ok)throw Error(data.error||'同步失败');const ack=data.entry;if(!ack||ack.id!==sent.id||!Number.isSafeInteger(ack.version))throw Error('云端确认数据无效');c.entries.set(ack.id,ack);
 const current=c.pending.get(sent.id);if(current?.opId===sent.opId)c.pending.delete(sent.id);else if(current){current.baseVersion=ack.version;current.conflict=null}
 storeCloud(c);records=cloudRecords(c);render();cloudError='';lastSyncTime=localTime();updateSyncUI();
 }}catch(e){cloudError=e.name==='AbortError'?'同步超时，修改仍保留在本机，联网后重试。':e.message}finally{syncing=false;updateSyncUI()}
}
function resolveConflict(useLocal){const p=firstConflict();if(!p)return;const c=cloud,next=new Map(c.pending);if(useLocal)next.set(p.id,{...p,baseVersion:p.conflict.version,opId:crypto.randomUUID(),conflict:null});else next.delete(p.id);const draft={...c,pending:next};try{storeCloud(draft)}catch{notify('本机存储失败，请先备份。');return}c.pending=next;records=cloudRecords(c);if(editing===p.id)resetForm();render();updateSyncUI();flushCloud()}
$('useLocal').onclick=()=>resolveConflict(true);$('useCloud').onclick=()=>resolveConflict(false);
$('syncNow').onclick=refreshCloud;
$('migrate').onclick=()=>{if(!cloud)return;const old=localRecords.filter(r=>!cloud.entries.has(r.id)&&!cloud.pending.has(r.id));if(!old.length)return;if(!confirm('将本浏览器的 '+old.length+' 条旧记录迁入当前账号 '+cloud.user.name+'？原本机副本会保留。'))return;if(commit([...records,...old])){render();notify('旧记录已加入同步队列，原本机副本仍保留。')}};
async function bootSync(){
 $('save').disabled=true;
 try{const {response,data}=await api('/api/journal');if(!response.ok)throw Error(data.error||'云端连接失败');if(data.user){cloud=makeCloud(data.user,data.entries);records=cloudRecords(cloud);storeCloud(cloud);lastSyncTime=localTime()}cloudError='';
 }catch(e){cloudError=e.name==='AbortError'?'云端连接超时，当前仅显示本机记录。':e.message}
 journalBooting=false;$('save').disabled=storageFailed&&!cloud;resetForm();render();updateSyncUI();if(cloud)flushCloud();if(location.hash==='#legacy'&&cloud?.user.kind==='password')showAccount();
}
window.addEventListener('online',refreshCloud);window.addEventListener('focus',refreshCloud);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshCloud()});setInterval(refreshCloud,30000);
bootSync();









