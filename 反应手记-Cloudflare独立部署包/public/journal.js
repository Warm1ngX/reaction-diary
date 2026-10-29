'use strict';
// Timing-aware sleep context and exploratory personal reviews. No diagnosis or causal inference.
const ReactionSleep=(()=>{
 const DAY=86400000,MINUTE=60000;
 const validTime=t=>typeof t==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(t);
 const validDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
 const stamp=(date,time)=>validDate(date)&&validTime(time)?Date.parse(date+'T'+time):NaN;
 function dateAdd(date,n){const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
 const dateDistance=(a,b)=>Math.round((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/DAY);
 const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
 function median(a){const s=[...a].sort((a,b)=>a-b),n=s.length;return n?n%2?s[(n-1)/2]:(s[n/2-1]+s[n/2])/2:null}
 function validateDay(day){
  if(day.sleepModel!==2)return;
  if(day.nightHours!=null&&(typeof day.nightHours!=='number'||!Number.isFinite(day.nightHours)||day.nightHours<0||day.nightHours>24))throw Error('夜间主睡眠时长应为 0–24 小时');
  if(day.nightWake&&(!validTime(day.nightWake)||day.nightHours==null))throw Error('请补全夜间主睡眠时长和有效的起床时间');
  if(!['unknown','none','recorded'].includes(day.napStatus))throw Error('请选择午睡记录状态');
  if(day.napStatus==='recorded'){
   if(!validTime(day.napStart)||!validTime(day.napEnd))throw Error('记录午睡时，请填写开始和结束时间');
   if(day.napEnd<=day.napStart)throw Error('午睡结束须晚于开始；跨日的主睡眠请按起床日期记录');
  }else if(day.napStart||day.napEnd)throw Error('未记录或无午睡时，请清空午睡时间');
 }
 function resolver(records){
  const days=new Map(records.filter(r=>r.kind==='day').map(r=>[r.date,r]));
  const nights=[...days.values()].filter(d=>d.sleepModel===2&&typeof d.nightHours==='number'&&Number.isFinite(d.nightHours)&&validTime(d.nightWake)).map(d=>({date:d.date,end:stamp(d.date,d.nightWake),hours:d.nightHours})).sort((a,b)=>a.end-b.end);
  return test=>{
   const t=stamp(test.date,test.time),current=days.get(test.date);let lo=0,hi=nights.length;
   while(lo<hi){const m=(lo+hi)>>1;if(nights[m].end<=t)lo=m+1;else hi=m}
   let night=nights[lo-1]||null;if(night&&t-night.end>36*60*MINUTE)night=null;
   const out={nightHours:night?.hours??null,nightDate:night?.date??null,nightWake:night?new Date(night.end).toTimeString().slice(0,5):null,nightKnown:!!night,nightGap:night?Math.floor((t-night.end)/MINUTE):null,napMinutes:null,napGap:null,napState:'unknown',napKnown:true,duringNap:false,legacy:false};
   if(!Number.isFinite(t)){out.napKnown=false;out.label='测试日期或时间待补充';return out}
   const begin=night?night.date:test.date,n=Math.min(3,Math.max(0,dateDistance(begin,test.date)));let completed=[],future=false;
   for(let i=0;i<=n;i++){
    const date=dateAdd(begin,i),d=days.get(date);
    if(!d||d.sleepModel!==2||d.napStatus==='unknown'){out.napKnown=false;continue}
    if(d.napStatus==='none')continue;
    const start=stamp(date,d.napStart),end=stamp(date,d.napEnd);
    if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start){out.napKnown=false;continue}
    if(night&&end<=night.end)continue;
    if(start<=t&&t<end)out.duringNap=true;
    else if(end<=t)completed.push({start,end});else future=true;
   }
   const latest=completed.sort((a,b)=>b.end-a.end)[0];
   if(out.duringNap){out.napState='overlap';out.napKnown=false}
   else if(latest){out.napMinutes=Math.round((latest.end-latest.start)/MINUTE);out.napGap=Math.floor((t-latest.end)/MINUTE);out.napState=out.napGap<60?'recent':'after'}
   else if(out.napKnown)out.napState=future?'before':'none';
   const old=current?.sleep!=null?current:test;
   out.legacy=!out.nightKnown&&old.sleep!=null;
   const nightText=out.nightKnown?'夜间主睡眠 '+out.nightHours+' h（'+out.nightDate+' '+out.nightWake+' 起床）':out.legacy?'历史睡眠 '+old.sleep+' h（类型或起床时间未确认）':'夜间主睡眠时间待补充';
   let napText=out.napState==='overlap'?'测试与午睡时段重叠，请检查时间':out.napState==='before'?'午睡前（本次不计入后续午睡）':out.napState==='none'?'已确认测试前无午睡':out.napMinutes!=null?'午睡 '+out.napMinutes+' min，醒后 '+out.napGap+' min'+(out.napState==='recent'?'（醒后 1 小时内，单独观察）':''):'午睡情况待补充';
   if(latest&&!out.napKnown)napText+='；其他午睡记录未确认';
   out.label=nightText+(out.nightKnown&&out.nightGap<60?'（主睡眠醒后不足 1 小时，单独观察）':'')+'；'+napText;
   return out;
  };
 }
 return {resolver,validateDay,validTime,validDate,stamp,dateAdd,median,mean};
})();





const ReactionStats=(()=>{
 const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
 function quantile(a,p){if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),h=(x.length-1)*p,i=Math.floor(h);return x[i]+(h-i)*((x[i+1]??x[i])-x[i])}
 const median=a=>quantile(a,.5);
 function distribution(a){const q1=quantile(a,.25),q3=quantile(a,.75);return {n:a.length,median:median(a),q1,q3,iqr:a.length?q3-q1:null}}
 function fitSleepDate(units,value='rt'){
  if(units.length<4)return {ok:false,reason:'few-nights'};
  const xs=units.map(u=>u.hours),ts=units.map(u=>u.day),ys=units.map(u=>u[value]),mx=mean(xs),mt=mean(ts),my=mean(ys);
  let xx=0,tt=0,xt=0,xy=0,ty=0;for(let i=0;i<units.length;i++){const x=xs[i]-mx,t=ts[i]-mt,y=ys[i]-my;xx+=x*x;tt+=t*t;xt+=x*t;xy+=x*y;ty+=t*y}
  if(xx<1e-8||tt<1e-8)return {ok:false,reason:'no-variation'};
  const correlation=xt/Math.sqrt(xx*tt),denominator=xx*tt-xt*xt;
  if(Math.abs(correlation)>=.9||denominator<1e-8)return {ok:false,reason:'confounded-time',correlation};
  const slope=(xy*tt-ty*xt)/denominator,trend=(ty*xx-xy*xt)/denominator,intercept=my-slope*mx-trend*mt;
  return {ok:true,slope,trend,intercept,unadjustedSlope:xy/xx,correlation,residuals:units.map((u,i)=>ys[i]-intercept-slope*xs[i]-trend*ts[i])};
 }
 function sensitivity(units,fit){
  const values=[];let failed=0;for(let i=0;i<=units.length-3;i++){const check=fitSleepDate([...units.slice(0,i),...units.slice(i+3)]);if(check.ok)values.push(check.slope);else failed++}
  const alternate=fitSleepDate(units,'meanRT'),early=fitSleepDate(units.slice(3)),min=values.length?Math.min(...values):null,max=values.length?Math.max(...values):null;
  const sameSign=v=>Number.isFinite(v)&&Math.abs(v)>1e-6&&Math.abs(fit.slope)>1e-6&&Math.sign(v)===Math.sign(fit.slope);
  const noReversal=failed===0&&values.length>0&&values.every(sameSign)&&alternate.ok&&sameSign(alternate.slope)&&early.ok&&sameSign(early.slope)&&sameSign(fit.unadjustedSlope);
  return {min,max,checks:values.length,failed,alternateMeanSlope:alternate.ok?alternate.slope:null,withoutEarlySlope:early.ok?early.slope:null,noReversal,confidenceInterval:null};
 }
 return {mean,quantile,median,distribution,fitSleepDate,sensitivity};
})();

const ReactionAnalysis=(()=>{
 const MIN_NIGHTS=20,normalize=s=>String(s||'').trim().toLowerCase(),knownCaffeine=r=>['none','yes'].includes(r.caffeineWindow);
 const badQuality=r=>['practice','interrupted','device_issue'].includes(r.quality);
 function review(records,{windowDays=28,asOf,asOfTime='23:59'}={}){
  const window=[10,28,56].includes(Number(windowDays))?Number(windowDays):28,end=asOf||new Date().toISOString().slice(0,10),start=ReactionSleep.dateAdd(end,1-window),cutoff=ReactionSleep.stamp(end,asOfTime);
  const rows=records.filter(r=>r.kind!=='day'&&ReactionSleep.validDate(r.date)&&ReactionSleep.validTime(r.time)&&Number.isFinite(r.rt)&&r.rt>0&&r.date>=start&&ReactionSleep.stamp(r.date,r.time)<=cutoff).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
  const resolve=ReactionSleep.resolver(records),enriched=rows.map(r=>({r,c:resolve(r)}));
  const descriptor=rows.filter(r=>!badQuality(r)&&(!r.source||r.source==='Human Benchmark'));
  const dayValues=new Map();for(const r of descriptor){if(!dayValues.has(r.date))dayValues.set(r.date,[]);dayValues.get(r.date).push(r.rt)}
  const summary=ReactionStats.distribution([...dayValues.values()].map(ReactionStats.median));
  const coverage={qualityExcluded:rows.filter(badQuality).length,legacyQuality:rows.filter(r=>!r.quality||r.quality==='unknown').length,missingSetup:rows.filter(r=>!normalize(r.testSetup)).length,missingCaffeine:rows.filter(r=>!knownCaffeine(r)).length,incompleteSleep:enriched.filter(v=>!v.c.nightKnown||!v.c.napKnown||v.c.duringNap||v.r.dateInferred).length,recentWake:enriched.filter(v=>v.c.napState==='recent'||(v.c.nightKnown&&v.c.nightGap<60)).length};
  const validBase=enriched.filter(({r,c})=>r.quality==='normal'&&r.source==='Human Benchmark'&&normalize(r.testSetup)&&knownCaffeine(r)&&c.nightKnown&&c.napKnown&&!c.duringNap&&!r.dateInferred&&c.nightGap>=60&&r.activity&&r.activity!=='其他');
  const eligible=validBase.filter(v=>['none','before'].includes(v.c.napState)),strata=new Map();
  for(const {r,c} of eligible){const clock=Math.floor(Number(r.time.slice(0,2))/3),awake=Math.floor(c.nightGap/120),setup=normalize(r.testSetup),key=JSON.stringify([setup,r.caffeineWindow,r.activity,clock,awake]);
   if(!strata.has(key))strata.set(key,{key,setup:r.testSetup.trim(),caffeine:r.caffeineWindow,activity:r.activity,clock,awake,nights:new Map()});const group=strata.get(key);if(!group.nights.has(c.nightDate))group.nights.set(c.nightDate,{date:c.nightDate,hours:c.nightHours,values:[]});group.nights.get(c.nightDate).values.push(r.rt);
  }
  const candidates=[...strata.values()].map(g=>({...g,units:[...g.nights.values()].sort((a,b)=>a.date.localeCompare(b.date)).map(n=>({date:n.date,hours:n.hours,day:Math.round((Date.parse(n.date+'T00:00:00Z')-Date.parse(start+'T00:00:00Z'))/86400000),rt:ReactionStats.median(n.values),meanRT:ReactionStats.mean(n.values),tests:n.values.length}))})).sort((a,b)=>b.units.length-a.units.length||a.key.localeCompare(b.key));
  const selected=candidates[0]||null,nights=selected?.units.length||0,result={methodVersion:'observational-v2',windowDays:window,start,end,totalTests:rows.length,descriptiveTests:descriptor.length,summary,coverage,eligibleTests:eligible.length,selectedNights:nights,targetNights:MIN_NIGHTS,selected:null,model:null,sensitivity:null,status:'few-nights',nap:null,napProgress:0,confidenceInterval:null};
  if(selected){const hours=selected.units.map(u=>u.hours);result.selected={setup:selected.setup,caffeine:selected.caffeine,activity:selected.activity,clock:selected.clock,awake:selected.awake,nights,tests:selected.units.reduce((s,u)=>s+u.tests,0),sleepMin:Math.min(...hours),sleepMax:Math.max(...hours)}}
  if(window===10)result.status='short-window';else if(nights<MIN_NIGHTS)result.status='few-nights';else if(result.selected.sleepMax-result.selected.sleepMin<1)result.status='little-sleep-variation';else{
   const fit=ReactionStats.fitSleepDate(selected.units);if(!fit.ok)result.status=fit.reason;else{result.model={slope:fit.slope,trend:fit.trend,unadjustedSlope:fit.unadjustedSlope,correlation:fit.correlation};result.sensitivity=ReactionStats.sensitivity(selected.units,fit);result.status='model-estimate'}
  }
  // Nap summaries remain descriptive paired observations, with no causal/clinical score.
  const naps=new Map(records.filter(r=>r.kind==='day'&&r.sleepModel===2&&r.napStatus==='recorded').map(r=>[r.date,r])),pairs=new Map();
  for(const {r,c} of validBase){const nap=naps.get(r.date);if(!nap)continue;const t=ReactionSleep.stamp(r.date,r.time),a=ReactionSleep.stamp(nap.date,nap.napStart),b=ReactionSleep.stamp(nap.date,nap.napEnd);let side=null;if(t<a&&a-t<=180*60000)side='before';else if(t-b>=60*60000&&t-b<=240*60000)side='after';if(!side)continue;
   const key=JSON.stringify([r.date,c.nightDate,normalize(r.testSetup),r.caffeineWindow,r.activity]);if(!pairs.has(key))pairs.set(key,{date:r.date,setup:r.testSetup.trim(),caffeine:r.caffeineWindow,activity:r.activity,before:[],after:[]});pairs.get(key)[side].push(r.rt);
  }
  const napStrata=new Map();for(const p of pairs.values())if(p.before.length&&p.after.length){const key=JSON.stringify([normalize(p.setup),p.caffeine,p.activity]);if(!napStrata.has(key))napStrata.set(key,{key,setup:p.setup,caffeine:p.caffeine,activity:p.activity,days:new Map()});napStrata.get(key).days.set(p.date,{difference:ReactionStats.median(p.after)-ReactionStats.median(p.before),tests:p.before.length+p.after.length})}
  const ranked=[...napStrata.values()].sort((a,b)=>b.days.size-a.days.size||a.key.localeCompare(b.key)),best=ranked[0];result.napProgress=best?.days.size||0;if(best&&best.days.size>=3){const values=[...best.days.values()];result.nap={setup:best.setup,caffeine:best.caffeine,activity:best.activity,days:best.days.size,tests:values.reduce((s,p)=>s+p.tests,0),...ReactionStats.distribution(values.map(p=>p.difference))}}
  return result;
 }
 return {review,normalize,badQuality};
})();

function loadTestDefaults(){
 const scope=cloud?.user.id||'local';if(editing)return;if(lastSetupScope!==scope){lastSetupScope=scope;setupDefaultsNeeded=true;setupTouched=false}
 if(setupDefaultsNeeded&&!setupTouched){let saved='';try{saved=localStorage.getItem('reaction-setup-v1:'+scope)||''}catch{}const recent=tests().filter(r=>r.testSetup).sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time))[0];$('testSetup').value=saved||recent?.testSetup||'';setupDefaultsNeeded=false}
 $('setupOptions').innerHTML=[...new Set(tests().map(r=>r.testSetup).filter(Boolean))].slice(0,30).map(s=>'<option value="'+esc(s)+'"></option>').join('');
}
function currentJournalView(){return document.querySelector?.('.journal-site')?.dataset?.view||'record'}
function renderImmediateResult(){
 const all=tests().sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)),r=all.find(r=>r.id===lastResultId)||all.at(-1);
 if(!r){$('immediateResult').innerHTML='<p class="quiet">输入一组平均成绩，保存后查看本次结果。</p>';return}
 const setup=ReactionAnalysis.normalize(r.testSetup),time=r.date+r.time;
 const previous=all.filter(a=>a.id!==r.id&&a.quality==='normal'&&a.source==='Human Benchmark'&&setup&&ReactionAnalysis.normalize(a.testSetup)===setup&&((a.date+a.time)<time||((a.date+a.time)===time&&a.recordedAt&&r.recordedAt&&a.recordedAt<r.recordedAt))).slice(-7);
 const center=ReactionStats.median(previous.map(a=>a.rt));let comparison;
 if(r.quality!=='normal'||r.source!=='Human Benchmark')comparison='本组标为'+({'practice':'熟悉 / 练习','interrupted':'被打断','device_issue':'设备异常','unknown':'情况未确认'}[r.quality]||'待确认')+'，先保留，不作表现优劣判断。';
 else if(!setup)comparison='测试配置尚未填写，暂不跨设备比较。可在“时间与分析补充”中补充。';
 else if(previous.length<3)comparison='同配置可比历史 '+previous.length+' / 3 组，暂不比较。';
 else{const delta=r.rt-center;comparison='同配置此前 '+previous.length+' 组中位数 '+center.toFixed(1)+' ms；本组'+(Math.abs(delta)<.05?'与其接近':delta<0?'快 '+(-delta).toFixed(1)+' ms':'慢 '+delta.toFixed(1)+' ms')+'。仅作描述。'}
 $('immediateResult').innerHTML='<div class="result-number">'+r.rt+'<small>ms</small></div><p class="quiet">'+esc(r.date)+' '+esc(r.time)+'</p><p>'+esc(comparison)+'</p>';
}
function updateDailySummary(){const date=$('date').value,day=records.find(r=>r.kind==='day'&&r.date===date),complete=day?.sleepModel===2&&day.nightHours!=null&&day.nightWake&&day.napStatus!=='unknown';const today=date===localDate();$('daySummary').textContent=dailyDirty?'有未保存的填写':complete?'✓ '+(today?'今日':'该日')+'睡眠已记录':day?'睡眠时间待补全':'补充睡眠与运动';$('daySummary').className=complete&&!dailyDirty?'daily-summary complete':'daily-summary';}
function renderInsightInvitation(){const n=tests().filter(r=>r.quality==='normal').length,days=new Set(tests().map(r=>r.date)).size;$('insightPrompt').textContent=n<3?'常规记录 '+n+' / 3 组；描述性趋势会随记录积累更新。':'已保存 '+tests().length+' 组，覆盖 '+days+' 天。可以查看描述性趋势；因素关联仍需检查条件。'}
function openDailyAccordion(){const panel=$('dailyAccordion');panel.open=true;panel.scrollIntoView({behavior:'smooth',block:'start'})}
function consumeRequestedEdit(){if(journalBooting||editRequestHandled||currentJournalView()!=='record'||typeof URLSearchParams==='undefined')return;const id=new URLSearchParams(location.search||'').get('edit');if(!id)return;const r=records.find(r=>r.id===id);if(!r)return;editRequestHandled=true;openRecordEditor(r);if(window.history?.replaceState)window.history.replaceState(null,'','/')}

function recordWarnings(r){const c=sleepContext(r),issues=[];if(r.dateInferred)issues.push('日期原为推定，请人工确认');if(!c.nightKnown)issues.push('主睡眠类型或起床时间待补充');if(!c.napKnown)issues.push('午睡时间或状态待补充');if(c.duringNap)issues.push('测试时间与午睡时段重叠');if(!r.testSetup)issues.push('测试设备配置未填写');if(!['none','yes'].includes(r.caffeineWindow))issues.push('测试前咖啡因未记录');if(!r.quality||r.quality==='unknown')issues.push('本组情况未确认');if(ReactionAnalysis.badQuality(r))issues.push({'practice':'熟悉 / 练习记录','interrupted':'测试被打断','device_issue':'设备异常'}[r.quality]);return issues}
function renderHistory(rows){
 $('tableCount').textContent='共 '+rows.length+' 组';$('history').innerHTML=rows.length?[...rows].reverse().map(r=>{const d=dailyValues(r),c=d.context,day=records.find(v=>v.kind==='day'&&v.date===r.date),legacy=r.sleepType==='晚睡'?r.sleep:day?.sleepType==='晚睡'?day.sleep:null,night=c.nightHours??legacy,nap=c.napMinutes??(c.napKnown&&!c.duringNap?0:null),issues=recordWarnings(r),title=issues.length?issues.join('；'):'查看完整记录';return '<tr><td><span>'+esc(r.date)+'</span> <span class="quiet">'+esc(r.time)+'</span></td><td class="numeric"><b>'+r.rt+'</b></td><td class="numeric">'+(night==null?'—':night+'h')+'</td><td class="numeric">'+(nap==null?'—':nap+'min')+'</td><td>'+esc(r.activity||'—')+'</td><td class="numeric">'+(r.duration==null?'—':r.duration+'min')+'</td><td>'+esc(r.state||'—')+'</td><td><button class="icon-detail '+(issues.length?'has-warning':'')+'" data-detail="'+esc(r.id)+'" title="'+esc(title)+'" aria-label="'+esc(title)+'">'+(issues.length?'⚠':'⋯')+'</button></td><td class="row-actions"><button data-edit="'+esc(r.id)+'">编辑</button><button class="danger" data-delete="'+esc(r.id)+'">删除</button></td></tr>'}).join(''):'<tr><td colspan="9" class="table-empty">还没有记录，先去“记录”页保存一组成绩。</td></tr>';
 $('migration').textContent=records.some(r=>r.raw)?'⚠ 的详细缺失内容可悬停或点击查看。原表数值保留在 JSON 备份中。':'';
}
function openRecordDetails(r){const d=dailyValues(r),issues=recordWarnings(r);$('recordDetailTitle').textContent=r.date+' '+r.time+' · '+r.rt+' ms';$('recordDetailBody').innerHTML='<h3>测试前睡眠背景</h3><p>'+esc(d.context.label)+'</p><h3>本组情况</h3><p>配置：'+esc(r.testSetup||'未记录')+'<br>活动：'+esc(r.activity||'未记录')+'；时长：'+(r.duration==null?'未记录':r.duration+' min')+'<br>咖啡因：'+esc({none:'前 6 小时自报未摄入',yes:'前 6 小时自报摄入过',unknown:'未记录'}[r.caffeineWindow]||'未记录')+'<br>来源：'+esc(r.source||'未确认')+'</p>'+(issues.length?'<h3>待确认信息</h3><p>'+issues.map(esc).join('<br>')+'</p>':'')+'<h3>备注</h3><p>'+esc(r.notes||'无')+'</p>';$('recordDetailDialog').showModal()}
function openRecordEditor(r){
 if(dailyDirty&&!confirm('编辑历史记录将切换日期，放弃尚未保存的当天情况？'))return;dailyDirty=false;$('date').value=r.date;activeDate=r.date;loadDay(true);editing=r.id;testTimeEdited=true;editBaseVersion=cloud?.entries.get(r.id)?.version??0;
 for(const k of ['time','rt','duration','meal','notes'])$(k).value=r[k]??'';state(r.state||'');activity(r.activity||'无');$('duration').value=$('activity').value==='无'?'0':(r.duration??'');$('testSetup').value=r.testSetup||'';$('caffeineWindow').value=r.caffeineWindow||'unknown';$('quality').value=r.quality||'unknown';setupTouched=true;setupDefaultsNeeded=false;
 $('formtitle').textContent='编辑本次测试';$('save').textContent='保存修改';$('cancel').hidden=false;$('details').open=true;$('entry').scrollIntoView({behavior:'smooth',block:'start'});$('rt').focus({preventScroll:true});renderSleepContext();renderHBBridge();
}
function onHistoryAction(e){const b=e.target.closest('button');if(!b)return;const id=b.dataset.detail||b.dataset.edit||b.dataset.delete,r=records.find(v=>v.id===id);if(!r)return;if(b.dataset.detail){openRecordDetails(r);return}if(b.dataset.delete){if(confirm('删除 '+r.date+' '+r.time+' 的 '+r.rt+' ms 记录？')&&commit(records.filter(v=>v.id!==id))){if(editing===id)resetForm();render();notify('记录已删除。')}return}if(currentJournalView()==='insights'){location.href='/?edit='+encodeURIComponent(r.id);return}openRecordEditor(r)}

function chartSeries(rows,mode){if(mode==='day'){const days=new Map();for(const r of rows){if(!days.has(r.date))days.set(r.date,[]);days.get(r.date).push(r)}return [...days].map(([date,a])=>({date,time:'12:00',rt:a.reduce((n,r)=>n+r.rt,0)/a.length,n:a.length,label:date+'，'+a.length+' 次测试'}))}if(mode==='rolling7')return rows.slice(6).map((r,i)=>({date:r.date,time:r.time,rt:rows.slice(i,i+7).reduce((n,r)=>n+r.rt,0)/7,n:7,label:r.date+' '+r.time+'，截至此时的最近 7 次测试'}));return rows.map(r=>({...r,n:1,label:r.date+' '+r.time}))}
function drawChart(rows){const mode=$('chartMode').value,series=chartSeries(rows,mode);$('chartExplanation').textContent=mode==='day'?'同一天的测试合并为一个平均值，悬停可查看当天测试数。':mode==='rolling7'?'在所选时间范围内，每个点取当次及此前 6 次测试的平均；不足 7 次时不计算。':'每个点代表一组 5 次测试的平均成绩。';$('seriesLabel').textContent=mode==='day'?'每日平均（ms）':mode==='rolling7'?'最近 7 次平均（ms）':'每次测试（ms）';
 if(!series.length){$('chart').innerHTML='<div class="empty"><b>'+ (mode==='rolling7'&&rows.length?'再记录 '+(7-rows.length)+' 次，就能看平滑趋势':'你的变化，从这一笔开始')+'</b>保存一次测试，或导入已有的 JSON 记录。</div>';$('period').textContent='';return}
 const w=680,h=250,l=44,right=16,t=18,b=36,v=series.map(r=>r.rt),min=Math.floor((Math.min(...v)-10)/10)*10,max=Math.ceil((Math.max(...v)+10)/10)*10;
 const stamps=series.map(r=>Date.parse(r.date+'T'+r.time)),first=Math.min(...stamps),last=Math.max(...stamps),x=i=>last===first?(w+l-right)/2:l+(stamps[i]-first)/(last-first)*(w-l-right),y=n=>t+(max-n)/(max-min)*(h-t-b);
 let svg=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc($('seriesLabel').textContent)}，共 ${series.length} 个点，最低 ${Math.min(...v).toFixed(1)} 毫秒，最高 ${Math.max(...v).toFixed(1)} 毫秒。">`;
 for(let i=0;i<4;i++){const n=min+(max-min)*i/3;svg+=`<line x1="${l}" x2="${w-right}" y1="${y(n)}" y2="${y(n)}" stroke="#e7ecdf"/><text x="${l-8}" y="${y(n)+4}" text-anchor="end" font-size="11" fill="#626b64">${n.toFixed(0)}</text>`}
 if(series.length>1){const d=series.map((r,i)=>`${i?'L':'M'} ${x(i)} ${y(r.rt)}`).join(' ');svg+=`<path d="${d} L ${x(series.length-1)} ${h-b} L ${x(0)} ${h-b} Z" fill="#edf3e4"/><path d="${d}" fill="none" stroke="#286447" stroke-width="2"/>`}
 series.forEach((r,i)=>svg+=`<circle cx="${x(i)}" cy="${y(r.rt)}" r="4.2" fill="#286447" stroke="white" stroke-width="2"><title>${esc(r.label)}：${r.rt.toFixed(1)} ms</title></circle>`);svg+=`<text x="${l}" y="${h-8}" fill="#626b64" font-size="11">${series[0].date.slice(5)}</text>`;if(series.length>1)svg+=`<text x="${w-right}" y="${h-8}" text-anchor="end" fill="#626b64" font-size="11">${series.at(-1).date.slice(5)}</text>`;$('chart').innerHTML=svg+'</svg>';$('period').textContent=series[0].date+' — '+series.at(-1).date;
}
function comparison(id,rows,classify,labels){
 const map=new Map((labels||[]).map(s=>[s,[]]));for(const r of rows){const label=classify(r);if(label==null||label==='')continue;if(!map.has(label))map.set(label,[]);map.get(label).push(r)}
 const groups=[...map].map(([label,a])=>({label,n:a.length,days:new Set(a.map(r=>r.date)).size,mean:a.length?ReactionStats.mean(a.map(r=>r.rt)):null})),shown=groups.filter(g=>g.n>=3),small=groups.filter(g=>g.n>0&&g.n<3),top=Math.max(1,...shown.map(g=>g.mean));
 if(shown.length){$(id).innerHTML=shown.map(g=>'<div class="group"><span>'+esc(g.label)+'</span><div class="bar"><i style="width:'+g.mean/top*100+'%"></i></div><small>'+g.mean.toFixed(1)+' ms · '+g.n+' 组 / '+g.days+' 天</small></div>').join('')+'<p class="chart-caveat">组均值，仅作描述；同一天多组不等于多个独立样本。</p>'}
 else{const best=Math.max(0,...groups.map(g=>g.n)),message=id==='sleepGroups'?'补全主睡眠时长与起床时间，积累后查看分布。':id==='napGroups'?'填写午睡状态与时间，再按测试时间分组。':'同一类别至少 3 组才展示条形。';$(id).innerHTML='<div class="cold-start"><b>正在积累可展示的记录</b><p>'+message+'</p><progress max="3" value="'+best+'" aria-label="最多记录类别的展示进度"></progress><span>'+best+' / 3 组 · 最多记录的类别</span></div>'}
 if(small.length)$(id).innerHTML+='<p class="sample-note">'+small.map(g=>esc(g.label)+' '+g.n+'/3').join(' · ')+'：样本不足，未画条形。</p>';return groups;
}
function renderReview(){
 const report=ReactionAnalysis.review(records,{windowDays:Number($('reviewWindow').value),asOf:localDate(),asOfTime:localTime()}),n=report.selectedNights,target=report.targetNights,c=report.coverage;
 const fmt=v=>Number.isFinite(v)?v.toFixed(1):'—',signed=v=>(v>0?'+':'')+fmt(v);
 $('reviewCounts').textContent=report.windowDays+' 天内 '+report.totalTests+' 组；描述覆盖 '+report.summary.n+' 天；可比主睡眠记录 '+report.eligibleTests+' 组（分属不同条件）。';
 $('reviewDistribution').textContent=report.summary.n?'跨日日代表值中位数 '+fmt(report.summary.median)+' ms · 中间 50% 为 '+fmt(report.summary.q1)+'–'+fmt(report.summary.q3)+' ms':'保存常规测试后，这里会显示跨日分布。';
 $('dataProgress').innerHTML='<div class="cold-start compact"><label for="nightProgress">最多记录的同条件夜晚 '+n+' / '+target+'</label><progress id="nightProgress" value="'+Math.min(n,target)+'" max="'+target+'"></progress><p>'+(n<target?'还差 '+(target-n)+' 个同条件夜晚达到模型计算门槛；数量达到后仍需检查睡眠跨度与时间混杂。':'已达到数量门槛；是否能计算还取决于睡眠变化与时间混杂。')+'</p></div>';
 const status={ 'short-window':['近 10 天先看描述','短窗口不计算睡眠系数，避免把短期波动解释成因素影响。'], 'few-nights':['继续积累可比夜晚','优先保持测试配置和日常测试时段一致，并补全睡眠时间。无需刻意少睡来制造变化。'], 'little-sleep-variation':['睡眠变化较小，暂不解释关联','已观察睡眠跨度不足 1 小时，无法分辨睡眠时长与成绩的关系。'], 'confounded-time':['睡眠与日期共同变化，暂不解释','目前无法区分睡眠变化与练习或其他时间趋势。'], 'no-variation':['变化不足，暂不解释','当前记录不能支持这个模型。'], 'model-estimate':['探索性关联已更新','这是个人观察记录中的关联；未知的压力、作息、练习和设备变化仍可能影响结果。'] }[report.status]||['继续积累','信息补齐后再更新。'];
 $('reviewStatus').textContent=status[0];$('reviewMessage').textContent=status[1];
 let context='';if(report.selected){const s=report.selected;context='条件：'+s.setup+' · '+s.activity+' · '+(s.caffeine==='none'?'前 6 小时自报无咖啡因':'前 6 小时自报有咖啡因')+' · '+String(s.clock*3).padStart(2,'0')+':00–'+String(s.clock*3+3).padStart(2,'0')+':00 · 清醒 '+s.awake*2+'–'+(s.awake*2+2)+' h。观察睡眠 '+fmt(s.sleepMin)+'–'+fmt(s.sleepMax)+' h。'}
 if(report.model){const m=report.model,s=report.sensitivity;const slope=Math.abs(m.slope)<.05?'接近 0':signed(m.slope);$('nightReview').innerHTML='<h3>主睡眠：连续时长关联</h3><p>在已观察睡眠范围内，加入线性日期趋势后，系数为 <b>'+slope+' ms/h</b>（负值表示睡得较长时成绩较快）。</p><p>'+(s.noReversal?'预设敏感性检查未发现方向反转；这不代表统计显著。':'预设敏感性检查出现方向变化或无法计算，当前关联较脆弱。')+'</p><p class="quiet">连续删去 3 条夜晚记录后的系数范围 '+fmt(s.min)+' 至 '+fmt(s.max)+' ms/h；这是敏感性范围，非置信区间。</p>'}
 else $('nightReview').innerHTML='<p class="quiet">'+(n?'已保留 '+n+' 个同条件夜晚。暂不生成“睡眠导致反应变慢”的建议。':'旧记录仍保留。补全配置、咖啡因、测试状态和睡眠时序后，才会参与探索性关联。')+'</p>';
 if(report.nap){const p=report.nap;$('napReview').innerHTML='<h3>午睡前后：配对描述</h3><p>'+p.days+' 个同条件配对日，醒后减去午睡前的差值中位数 <b>'+signed(p.median)+' ms</b>；中间 50% 为 '+fmt(p.q1)+' 至 '+fmt(p.q3)+' ms。负值表示醒后较快；时段与练习仍可能解释差异。</p>'}
 else $('napReview').innerHTML='<p class="quiet">午睡前后配对日 '+report.napProgress+' / 3：达到展示门槛后显示描述差值。</p>';
 $('modelDiagnostics').innerHTML='<h3>本窗口数据检查</h3><p>'+esc(context||'尚无完整的同条件夜晚。')+'</p><p>异常或练习 '+c.qualityExcluded+' 组；本组情况待确认 '+c.legacyQuality+' 组；缺配置 '+c.missingSetup+' 组；缺咖啡因类别 '+c.missingCaffeine+' 组；睡眠时序或日期待确认 '+c.incompleteSleep+' 组；近期醒后 '+c.recentWake+' 组。以上计数可能重叠。</p>'+(report.model?'<p>线性日期趋势 '+signed(report.model.trend)+' ms/天；未加入日期趋势的睡眠系数 '+signed(report.model.unadjustedSlope)+' ms/h。改用每晚组均值平均：'+signed(report.sensitivity.alternateMeanSlope)+' ms/h；去掉最初 3 个可比夜晚：'+signed(report.sensitivity.withoutEarlySlope)+' ms/h。连续删块有效检查 '+report.sensitivity.checks+' 次，无法拟合 '+report.sensitivity.failed+' 次。</p>':'');
}

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

'use strict';
const $=id=>document.getElementById(id),KEY='reaction-journal-v1';
let records=[],editing=null,selectedState='',toastTimer,journalBooting=true,editBaseVersion=null,dailyBaseVersion=null;
let cloud=null,localRecords=[],syncing=false,refreshing=false,dailyDirty=false,activeDate='',authMode='login',storageFailed=false,testTimeEdited=false,resolveSleep=null,lastResultId=null,setupDefaultsNeeded=true,setupTouched=false,lastSetupScope=null,editRequestHandled=false;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const localDate=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const localTime=()=>new Date().toTimeString().slice(0,5);
function notify(s){$('toast').textContent=s;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').textContent='',3000)}
function validateRecord(r){
 if(!r||typeof r!=='object'||Array.isArray(r)||typeof r.id!=='string'||!r.id||r.id.length>150)throw Error('记录 ID 无效');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!Number.isFinite(Date.parse(r.date+'T00:00:00Z'))||new Date(r.date+'T00:00:00Z').toISOString().slice(0,10)!==r.date)throw Error('日期格式无效');
 if(r.kind==='day'){if(r.id!=='day:'+r.date)throw Error('当天情况 ID 无效')}else if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time))throw Error('时间格式无效');
 for(const [k,min,max] of [['rt',1,10000],['sleep',0,24],['duration',0,1440]]){if(r.kind==='day'&&k!=='sleep')continue;if(k!=='rt'&&(r[k]==null))continue;if(typeof r[k]!=='number'||!Number.isFinite(r[k])||r[k]<min||r[k]>max)throw Error('数值无效：'+k)}
 if(r.kind==='day')ReactionSleep.validateDay(r);
 if(r.testSetup!=null&&(typeof r.testSetup!=='string'||r.testSetup.length>120))throw Error('测试配置名称过长');
 if(r.caffeineWindow!=null&&!['unknown','none','yes'].includes(r.caffeineWindow))throw Error('咖啡因类别无效');
 if(r.quality!=null&&!['unknown','normal','practice','interrupted','device_issue'].includes(r.quality))throw Error('测试状态无效');
 if(r.recordedAt!=null&&(typeof r.recordedAt!=='string'||r.recordedAt.length>40||!Number.isFinite(Date.parse(r.recordedAt))))throw Error('录入时间无效');
 for(const k of ['sleepType','activity','meal','exercise','state','notes','source'])if(r[k]!=null&&(typeof r[k]!=='string'||r[k].length>2000))throw Error('文本字段无效：'+k);return r;
}
const tests=()=>records.filter(r=>r.kind!=='day');
function sleepContext(r){return (resolveSleep||ReactionSleep.resolver(records))(r)}
function dailyValues(r){const day=records.find(d=>d.kind==='day'&&d.date===r.date),c=sleepContext(r);return {sleep:c.nightHours,sleepType:c.nightKnown?'夜间主睡眠':'未确认',exercise:day?day.exercise:r.exercise,context:c}}
function renderSleepContext(){try{let source=records;if(dailyDirty)source=withDay(records,dayDraft());const c=ReactionSleep.resolver(source)({date:$('date').value,time:$('time').value||localTime()});$('sleepContext').textContent=c.label}catch(e){$('sleepContext').textContent=e.message}}

function commit(next){if(journalBooting){notify('正在检查账号状态，请稍候。');return false}if(storageFailed&&!cloud){notify('本机记录读取失败，请先导入备份恢复。');return false}return persistJournal(next)}
function setChips(id,value){document.querySelectorAll('#'+id+' button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.value===value)))}
function state(v){selectedState=v;setChips('state',v)}
function activity(v){const previousActivity=$('activity').value;const common=['无','aim_rush','aim_botz','死斗','CS2对局','篮球'];$('activity').value=v||'无';const custom=!common.includes($('activity').value);setChips('activityChips',custom?'其他':$('activity').value);$('activityCustomField').hidden=!custom;$('activityCustom').value=custom&&v!=='其他'?v:'';$('durationField').hidden=$('activity').value==='无';if(previousActivity==='无'&&$('activity').value!=='无'&&$('duration').value==='0')$('duration').value='';if($('activity').value==='无')$('duration').value='0'}
function loadDay(force=false){if(dailyDirty&&!force)return;const date=$('date').value,day=records.find(r=>r.kind==='day'&&r.date===date),legacy=tests().filter(r=>r.date===date).sort((a,b)=>a.time.localeCompare(b.time));
 const oldNight=[day,...[...legacy].reverse()].find(r=>r&&r.sleepType==='晚睡'&&r.sleep!=null);
 $('sleep').value=day?.sleepModel===2?(day.nightHours??''):(oldNight?.sleep??'');$('nightWake').value=day?.sleepModel===2?(day.nightWake||''):'';$('napStatus').value=day?.sleepModel===2?day.napStatus:'unknown';$('napStart').value=day?.sleepModel===2?(day.napStart||''):'';$('napEnd').value=day?.sleepModel===2?(day.napEnd||''):'';$('napFields').hidden=$('napStatus').value!=='recorded';
 $('exercise').value=day?(day.exercise||''):(legacy.at(-1)?.exercise||'');setChips('exerciseChips',$('exercise').value);dailyDirty=false;dailyBaseVersion=cloud?.entries.get('day:'+date)?.version??0;
 const complete=day?.sleepModel===2&&day.nightHours!=null&&day.nightWake&&day.napStatus!=='unknown';$('dayStatus').textContent=complete?'时间已补全':day||legacy.length?'待补全':'未填写';$('saveDay').textContent=day?'更新当天情况':'保存当天情况';$('sleepHint').textContent=day?.sleepModel!==2&&(day||legacy.length)?'历史睡眠类型或起床时间未确认，原值仍保留；补全后才参与按时序分析。':'夜间主睡眠按起床日期填写。午夜测试会寻找此前最近已结束的主睡眠，不会使用尚未结束的睡眠。';$('testDayLabel').textContent=date+' · 按本次测试时间关联睡眠。';renderSleepContext();
}
function dayDraft(){const prior=records.find(r=>r.id==='day:'+$('date').value),status=$('napStatus').value;const day={...prior,id:'day:'+$('date').value,kind:'day',date:$('date').value,sleepModel:2,nightHours:$('sleep').value===''?null:Number($('sleep').value),nightWake:$('nightWake').value,napStatus:status,napStart:status==='recorded'?$('napStart').value:'',napEnd:status==='recorded'?$('napEnd').value:'',exercise:$('exercise').value,updatedAt:new Date().toISOString()};validateRecord(day);return day}

function withDay(next,day){return [...next.filter(r=>r.id!==day.id),day]}
function resetForm(){resetHBTransfer();editing=null;editBaseVersion=null;$('rt').value='';$('time').value=localTime();testTimeEdited=false;$('meal').value='';$('notes').value='';$('formtitle').textContent='本次测试';$('save').textContent='保存这次测试';$('cancel').hidden=true;$('details').open=false;$('caffeineWindow').value='unknown';$('quality').value='normal';$('testSetup').value='';setupTouched=false;setupDefaultsNeeded=true;}
function visible(){let rows=tests().sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));if($('range').value!=='all'){const cutoff=new Date();cutoff.setDate(cutoff.getDate()-Number($('range').value)+1);rows=rows.filter(r=>r.date>=localDate(cutoff)&&r.date<=localDate())}return rows}
function render(){resolveSleep=ReactionSleep.resolver(records);const rows=visible(),values=rows.map(r=>r.rt);$('count').innerHTML=rows.length+'<small>组</small>';$('average').innerHTML=rows.length?(values.reduce((a,b)=>a+b,0)/rows.length).toFixed(1)+'<small>ms</small>':'—';$('recent').innerHTML=rows.length>=7?(values.slice(-7).reduce((a,b)=>a+b,0)/7).toFixed(1)+'<small>ms</small>':'—<small class="remaining">还差 '+(7-rows.length)+' 组</small>';$('best').innerHTML=rows.length?Math.min(...values)+'<small>ms</small>':'—';drawChart(rows);
 const descriptors=rows.filter(r=>!ReactionAnalysis.badQuality(r));comparison('groups',descriptors,r=>r.state,['清醒','一般','困倦']);comparison('sleepGroups',descriptors,r=>{const v=dailyValues(r).sleep;return v==null?null:v<7?'少于 7 h':v<9?'7 至不足 9 h':'9 h 及以上'},['少于 7 h','7 至不足 9 h','9 h 及以上']);comparison('napGroups',descriptors,r=>{const c=sleepContext(r);return !c.napKnown||c.duringNap?null:c.napState==='recent'?'午睡醒后不足 1 小时':c.napState==='after'?'午睡醒后至少 1 小时':'测试前无已完成午睡'},['测试前无已完成午睡','午睡醒后不足 1 小时','午睡醒后至少 1 小时']);$('sleepCoverage').textContent=descriptors.filter(r=>sleepContext(r).nightKnown).length+' 组描述记录能关联主睡眠。';comparison('activityGroups',descriptors,r=>r.activity);
 renderHistory(rows);loadDay();loadTestDefaults();renderSleepContext();updateBackupUI();renderImmediateResult();renderInsightInvitation();updateDailySummary();renderReview();renderHBBridge();consumeRequestedEdit();
}
const backupKey=()=> 'reaction-backup-v1:'+(cloud?.user.id||'local');
function recordFingerprint(r){const s=JSON.stringify(r);let n=2166136261;for(let i=0;i<s.length;i++)n=Math.imul(n^s.charCodeAt(i),16777619);return (n>>>0).toString(16)}
function backupMeta(){try{return JSON.parse(localStorage.getItem(backupKey())||'null')}catch{return null}}
function updateBackupUI(){const meta=backupMeta(),ids=new Set(meta?.testIds||[]),newCount=tests().filter(r=>!ids.has(r.id)).length;const when=meta?.at?new Date(meta.at).toLocaleString('zh-CN',{hour12:false}):'尚未导出';const changed=meta?.fingerprints?records.filter(r=>meta.fingerprints[r.id]!==recordFingerprint(r)).length+Object.keys(meta.fingerprints).filter(id=>!records.some(r=>r.id===id)).length:records.length;$('backupStatus').textContent='本浏览器上次导出备份：'+when+'。'+(newCount?' 此后新增 '+newCount+' 次测试。':changed?' 有记录发生修改。':'');$('backupReminder').hidden=newCount<10;$('backupReminderText').textContent=(meta?'上次导出后':'目前已')+'新增 '+newCount+' 次测试，建议现在留存一份 JSON。'}
function download(text,name,type){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500)}
function exportBackup(){const at=new Date().toISOString();download(JSON.stringify({version:2,exportedAt:at,records},null,2),'反应手记备份-'+localDate()+'.json','application/json');try{localStorage.setItem(backupKey(),JSON.stringify({at,testIds:tests().map(r=>r.id),fingerprints:Object.fromEntries(records.map(r=>[r.id,recordFingerprint(r)]))}));updateBackupUI()}catch{notify('已发起下载，但备份时间无法保存。');return}notify('已发起备份下载，请确认文件已保存。')}
function csvCell(v){let s=String(v??'');if(/^[=+\-@\t\r\n]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
$('backup').onclick=exportBackup;$('backupQuick').onclick=exportBackup;
$('csv').onclick=()=>{const lines=[['日期','测试时间','平均反应时间(ms)','关联主睡眠起床日','主睡眠时长(h)','主睡眠起床时间','午睡时长(min)','距午睡结束(min)','午睡相对测试状态','睡眠背景','原睡眠类型','原睡眠时长(h)','测试前活动','活动时长(min)','饮食情况','当日运动','精神状态','备注','来源','测试设备配置','测试前6小时咖啡因','测试状态'],...tests().sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)).map(r=>{const d=dailyValues(r),c=d.context;return [r.date,r.time,r.rt,c.nightDate,c.nightHours,c.nightWake,c.napMinutes,c.napGap,c.napState,c.label,r.sleepType,r.sleep,r.activity,r.duration,r.meal,d.exercise,r.state,r.notes,r.source,r.testSetup,r.caffeineWindow,r.quality]})];download('\ufeff'+lines.map(row=>row.map(csvCell).join(',')).join('\r\n'),'反应记录-'+localDate()+'.csv','text/csv;charset=utf-8')};

$('state').onclick=e=>{const b=e.target.closest('button');if(b)state(selectedState===b.dataset.value?'':b.dataset.value)};
$('activityChips').onclick=e=>{const b=e.target.closest('button');if(b){activity(b.dataset.value);if(b.dataset.value==='其他')$('activityCustom').focus({preventScroll:true})}};$('activityCustom').oninput=()=>{$('activity').value=$('activityCustom').value||'其他'};
function dirtyDay(){dailyDirty=true;$('dayStatus').textContent='未保存';renderSleepContext();updateDailySummary()}
$('sleep').oninput=dirtyDay;$('nightWake').oninput=dirtyDay;$('napStart').oninput=dirtyDay;$('napEnd').oninput=dirtyDay;$('napStatus').onchange=()=>{$('napFields').hidden=$('napStatus').value!=='recorded';if($('napStatus').value!=='recorded'){$('napStart').value='';$('napEnd').value=''}dirtyDay()};$('time').oninput=()=>{testTimeEdited=true;renderSleepContext()};$('exerciseChips').onclick=e=>{const b=e.target.closest('button');if(b){$('exercise').value=$('exercise').value===b.dataset.value?'':b.dataset.value;setChips('exerciseChips',$('exercise').value);dirtyDay()}};
$('date').onchange=()=>{if(dailyDirty&&!confirm('当天情况尚未保存，切换日期会放弃这次填写。继续？')){$('date').value=activeDate;return}activeDate=$('date').value;dailyDirty=false;resetForm();loadDay(true);updateDailySummary();renderHBBridge()};
$('dailyForm').onsubmit=e=>{e.preventDefault();try{const day=dayDraft();if(commit(withDay(records,day))){dailyDirty=false;render();loadDay(true);notify('当天情况已保存。')}}catch(e){notify(e.message)}};
$('entry').onsubmit=e=>{e.preventDefault();try{if(hbBridge.activeDraft&&!$('hbDraftConfirmed').checked)throw Error('请先核对回填成绩与测试时间，并勾选确认。');if(!$('date').value)throw Error('请选择记录日期。');const original=editing?records.find(r=>r.id===editing):null;const r={...original,id:editing||crypto.randomUUID(),kind:'test',date:$('date').value,time:editing||testTimeEdited?$('time').value:localTime(),rt:Number($('rt').value),state:selectedState,activity:$('activity').value||'无',duration:$('activity').value==='无'?0:$('duration').value===''?null:Number($('duration').value),meal:$('meal').value,notes:$('notes').value,source:original?.source||'Human Benchmark',testSetup:$('testSetup').value.trim(),caffeineWindow:$('caffeineWindow').value,quality:$('quality').value,recordedAt:original?.recordedAt||(!editing?new Date().toISOString():undefined),updatedAt:new Date().toISOString()};validateRecord(r);if(editing)r.dateInferred=false;let next=editing?records.map(a=>a.id===editing?r:a):[...records,r];if(dailyDirty)next=withDay(next,dayDraft());if(commit(next)){if(!editing){try{localStorage.setItem('reaction-setup-v1:'+(cloud?.user.id||'local'),$('testSetup').value.trim())}catch{}}lastResultId=r.id;dailyDirty=false;resetForm();render();loadDay(true);notify(cloud?'已保存 · 正在同步':'已保存到本机');$('rt').focus({preventScroll:true})}}catch(e){notify(e.message)}};
$('cancel').onclick=()=>{resetForm();loadDay();renderHBBridge()};$('range').onchange=render;$('chartMode').onchange=render;
$('history').onclick=onHistoryAction;
$('import').onclick=()=>$('importFile').click();$('importFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>10*1024*1024)throw Error('请选择 10MB 以下的 JSON 备份。');const data=JSON.parse((await f.text()).replace(/^\ufeff/,''));if(![1,2].includes(data.version)||!Array.isArray(data.records)||data.records.length>20000)throw Error('备份格式无效');data.records.forEach(validateRecord);const map=new Map(records.map(r=>[r.id,r]));let n=0;for(const r of data.records)if(!map.has(r.id)){map.set(r.id,r);n++}const failed=storageFailed;storageFailed=false;if(commit([...map.values()])){dailyDirty=false;render();loadDay(true);notify('已导入 '+n+' 条；相同 ID 保留当前版本。')}else storageFailed=failed}catch(e){notify('导入失败：'+e.message)}finally{$('importFile').value=''}};
function showAccount(){const own=cloud?.user.kind==='password';$('authForms').hidden=own;$('accountManage').hidden=!own;$('accountTitle').textContent=own?'账号与数据':'登录你的反应手记';$('accountIdentity').textContent=own?cloud.user.name:'';$('authMessage').textContent='';$('accountDialog').showModal()}
function setAuthMode(mode){authMode=mode;$('loginTab').setAttribute('aria-pressed',String(mode==='login'));$('registerTab').setAttribute('aria-pressed',String(mode==='register'));$('confirmField').hidden=mode!=='register';$('authConfirm').required=mode==='register';$('authPassword').autocomplete=mode==='register'?'new-password':'current-password';$('authSubmit').textContent=mode==='register'?'注册并登录':'登录';$('authMessage').textContent=''}
$('accountOpen').onclick=showAccount;$('signIn').onclick=showAccount;$('accountClose').onclick=()=>$('accountDialog').close();$('loginTab').onclick=()=>setAuthMode('login');$('registerTab').onclick=()=>setAuthMode('register');
$('authForm').onsubmit=async e=>{e.preventDefault();if(authMode==='register'&&$('authPassword').value!==$('authConfirm').value){$('authMessage').textContent='两次密码不一致。';return}$('authSubmit').disabled=true;$('authMessage').textContent='正在处理…';try{const body={email:$('authEmail').value.trim(),password:$('authPassword').value};if(authMode==='register')body.name=body.email.split('@')[0];const {response,data}=await api('/api/auth/'+(authMode==='register'?'sign-up/email':'sign-in/email'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!response.ok)throw Error(authError(response.status,data));$('authPassword').value='';$('authConfirm').value='';$('accountDialog').close();dailyDirty=false;await refreshCloud();notify('已登录独立账号。')}catch(e){$('authMessage').textContent=e.message}finally{$('authSubmit').disabled=false}};
function authError(status,data){if(status===429)return '尝试次数较多，请稍后重试。';const code=data.code||'';if(/EXIST/.test(code))return '此邮箱已注册，请切换到登录。';if(code==='INVALID_EMAIL')return '请输入有效邮箱。';if(status===401||/INVALID_PASSWORD|INVALID_EMAIL_OR_PASSWORD/.test(code))return '邮箱或密码不正确。';if(/PASSWORD/.test(code))return '密码需要 10–128 个字符。';return data.message||data.error||'账号操作失败，请稍后重试。'}
$('passwordForm').onsubmit=async e=>{e.preventDefault();try{const {response,data}=await api('/api/auth/change-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({currentPassword:$('currentPassword').value,newPassword:$('newPassword').value,revokeOtherSessions:true})});if(!response.ok)throw Error(authError(response.status,data));$('passwordForm').reset();$('authMessage').textContent='密码已更新，其他设备需要重新登录。'}catch(e){$('authMessage').textContent=e.message}};
$('legacyImport').onclick=async()=>{if(cloud?.pending.size){$('authMessage').textContent='请先等当前账号的修改同步完成。';return}try{const {response,data}=await api('/api/legacy-import',{method:'POST',headers:{'X-Journal-Action':'save'}});if(!response.ok)throw Error(data.error||'旧账号验证尚未完成');await refreshCloud();$('authMessage').textContent='已复制 '+data.imported+' 条记录，旧账号数据仍保留。'}catch(e){$('authMessage').textContent=e.message}};
$('signOut').onclick=async()=>{if(cloud?.pending.size&&!confirm('还有修改未同步，退出后会保留在本机，重新登录此账号才能继续同步。仍要退出？'))return;if(cloud?.user.kind==='chatgpt'){location.href='/signout-with-chatgpt?return_to=%2F';return}try{const {response}=await api('/api/auth/sign-out',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(!response.ok)throw Error('退出未完成');dailyDirty=false;await refreshCloud();notify('已退出独立账号。')}catch(e){notify(e.message)}};
$('reviewWindow').onchange=renderReview;
setInterval(()=>{if(!editing&&!testTimeEdited){$('time').value=localTime();renderSleepContext()}},30000);
window.addEventListener('focus',()=>{if(!editing&&!testTimeEdited){$('time').value=localTime();renderSleepContext()}});

$('testSetup').oninput=()=>{setupTouched=true;setupDefaultsNeeded=false};$('completeDay').onclick=openDailyAccordion;$('recordDetailClose').onclick=()=>$('recordDetailDialog').close();
const jump=document.querySelector?.('.help-jump');if(jump)jump.onclick=()=>{$('analysisHelp').open=true};
try{const saved=localStorage.getItem(KEY);if(saved){const data=JSON.parse(saved);if(![1,2].includes(data.version)||!Array.isArray(data.records))throw Error('格式错误');data.records.forEach(validateRecord);records=data.records}}catch{storageFailed=true;notify('本机记录读取失败，请勿清理数据，可导入备份恢复。')}
localRecords=[...records];$('date').value=localDate();activeDate=$('date').value;activity('无');resetForm();render();initializeHBBridge();


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









