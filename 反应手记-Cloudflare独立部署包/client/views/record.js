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
