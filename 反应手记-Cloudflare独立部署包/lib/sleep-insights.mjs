'use strict';
// Timing-aware sleep context and exploratory personal reviews. No diagnosis or causal inference.
export const ReactionSleep=(()=>{
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




