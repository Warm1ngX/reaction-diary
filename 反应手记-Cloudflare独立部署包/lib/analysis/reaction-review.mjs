import {ReactionSleep as Sleep} from '../sleep-insights.mjs';
import {ReactionStats as Stats} from './statistics.mjs';
export const ReactionAnalysis=(()=>{
 const MIN_NIGHTS=20,normalize=s=>String(s||'').trim().toLowerCase(),knownCaffeine=r=>['none','yes'].includes(r.caffeineWindow);
 const badQuality=r=>['practice','interrupted','device_issue'].includes(r.quality);
 function review(records,{windowDays=28,asOf,asOfTime='23:59'}={}){
  const window=[10,28,56].includes(Number(windowDays))?Number(windowDays):28,end=asOf||new Date().toISOString().slice(0,10),start=Sleep.dateAdd(end,1-window),cutoff=Sleep.stamp(end,asOfTime);
  const rows=records.filter(r=>r.kind!=='day'&&Sleep.validDate(r.date)&&Sleep.validTime(r.time)&&Number.isFinite(r.rt)&&r.rt>0&&r.date>=start&&Sleep.stamp(r.date,r.time)<=cutoff).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
  const resolve=Sleep.resolver(records),enriched=rows.map(r=>({r,c:resolve(r)}));
  const descriptor=rows.filter(r=>!badQuality(r)&&(!r.source||r.source==='Human Benchmark'));
  const dayValues=new Map();for(const r of descriptor){if(!dayValues.has(r.date))dayValues.set(r.date,[]);dayValues.get(r.date).push(r.rt)}
  const summary=Stats.distribution([...dayValues.values()].map(Stats.median));
  const coverage={qualityExcluded:rows.filter(badQuality).length,legacyQuality:rows.filter(r=>!r.quality||r.quality==='unknown').length,missingSetup:rows.filter(r=>!normalize(r.testSetup)).length,missingCaffeine:rows.filter(r=>!knownCaffeine(r)).length,incompleteSleep:enriched.filter(v=>!v.c.nightKnown||!v.c.napKnown||v.c.duringNap||v.r.dateInferred).length,recentWake:enriched.filter(v=>v.c.napState==='recent'||(v.c.nightKnown&&v.c.nightGap<60)).length};
  const validBase=enriched.filter(({r,c})=>r.quality==='normal'&&r.source==='Human Benchmark'&&normalize(r.testSetup)&&knownCaffeine(r)&&c.nightKnown&&c.napKnown&&!c.duringNap&&!r.dateInferred&&c.nightGap>=60&&r.activity&&r.activity!=='其他');
  const eligible=validBase.filter(v=>['none','before'].includes(v.c.napState)),strata=new Map();
  for(const {r,c} of eligible){const clock=Math.floor(Number(r.time.slice(0,2))/3),awake=Math.floor(c.nightGap/120),setup=normalize(r.testSetup),key=JSON.stringify([setup,r.caffeineWindow,r.activity,clock,awake]);
   if(!strata.has(key))strata.set(key,{key,setup:r.testSetup.trim(),caffeine:r.caffeineWindow,activity:r.activity,clock,awake,nights:new Map()});const group=strata.get(key);if(!group.nights.has(c.nightDate))group.nights.set(c.nightDate,{date:c.nightDate,hours:c.nightHours,values:[]});group.nights.get(c.nightDate).values.push(r.rt);
  }
  const candidates=[...strata.values()].map(g=>({...g,units:[...g.nights.values()].sort((a,b)=>a.date.localeCompare(b.date)).map(n=>({date:n.date,hours:n.hours,day:Math.round((Date.parse(n.date+'T00:00:00Z')-Date.parse(start+'T00:00:00Z'))/86400000),rt:Stats.median(n.values),meanRT:Stats.mean(n.values),tests:n.values.length}))})).sort((a,b)=>b.units.length-a.units.length||a.key.localeCompare(b.key));
  const selected=candidates[0]||null,nights=selected?.units.length||0,result={methodVersion:'observational-v2',windowDays:window,start,end,totalTests:rows.length,descriptiveTests:descriptor.length,summary,coverage,eligibleTests:eligible.length,selectedNights:nights,targetNights:MIN_NIGHTS,selected:null,model:null,sensitivity:null,status:'few-nights',nap:null,napProgress:0,confidenceInterval:null};
  if(selected){const hours=selected.units.map(u=>u.hours);result.selected={setup:selected.setup,caffeine:selected.caffeine,activity:selected.activity,clock:selected.clock,awake:selected.awake,nights,tests:selected.units.reduce((s,u)=>s+u.tests,0),sleepMin:Math.min(...hours),sleepMax:Math.max(...hours)}}
  if(window===10)result.status='short-window';else if(nights<MIN_NIGHTS)result.status='few-nights';else if(result.selected.sleepMax-result.selected.sleepMin<1)result.status='little-sleep-variation';else{
   const fit=Stats.fitSleepDate(selected.units);if(!fit.ok)result.status=fit.reason;else{result.model={slope:fit.slope,trend:fit.trend,unadjustedSlope:fit.unadjustedSlope,correlation:fit.correlation};result.sensitivity=Stats.sensitivity(selected.units,fit);result.status='model-estimate'}
  }
  // Nap summaries remain descriptive paired observations, with no causal/clinical score.
  const naps=new Map(records.filter(r=>r.kind==='day'&&r.sleepModel===2&&r.napStatus==='recorded').map(r=>[r.date,r])),pairs=new Map();
  for(const {r,c} of validBase){const nap=naps.get(r.date);if(!nap)continue;const t=Sleep.stamp(r.date,r.time),a=Sleep.stamp(nap.date,nap.napStart),b=Sleep.stamp(nap.date,nap.napEnd);let side=null;if(t<a&&a-t<=180*60000)side='before';else if(t-b>=60*60000&&t-b<=240*60000)side='after';if(!side)continue;
   const key=JSON.stringify([r.date,c.nightDate,normalize(r.testSetup),r.caffeineWindow,r.activity]);if(!pairs.has(key))pairs.set(key,{date:r.date,setup:r.testSetup.trim(),caffeine:r.caffeineWindow,activity:r.activity,before:[],after:[]});pairs.get(key)[side].push(r.rt);
  }
  const napStrata=new Map();for(const p of pairs.values())if(p.before.length&&p.after.length){const key=JSON.stringify([normalize(p.setup),p.caffeine,p.activity]);if(!napStrata.has(key))napStrata.set(key,{key,setup:p.setup,caffeine:p.caffeine,activity:p.activity,days:new Map()});napStrata.get(key).days.set(p.date,{difference:Stats.median(p.after)-Stats.median(p.before),tests:p.before.length+p.after.length})}
  const ranked=[...napStrata.values()].sort((a,b)=>b.days.size-a.days.size||a.key.localeCompare(b.key)),best=ranked[0];result.napProgress=best?.days.size||0;if(best&&best.days.size>=3){const values=[...best.days.values()];result.nap={setup:best.setup,caffeine:best.caffeine,activity:best.activity,days:best.days.size,tests:values.reduce((s,p)=>s+p.tests,0),...Stats.distribution(values.map(p=>p.difference))}}
  return result;
 }
 return {review,normalize,badQuality};
})();
