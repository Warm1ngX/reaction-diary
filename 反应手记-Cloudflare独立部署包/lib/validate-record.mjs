import {ReactionSleep} from './sleep-insights.mjs';
export function validateRecord(r) {
 if(!r||typeof r!=='object'||Array.isArray(r)||typeof r.id!=='string'||!r.id||r.id.length>150)throw Error('记录 ID 无效');
 if(typeof r.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!Number.isFinite(Date.parse(r.date+'T00:00:00Z'))||new Date(r.date+'T00:00:00Z').toISOString().slice(0,10)!==r.date)throw Error('日期格式无效');
 const daily=r.kind==='day';
 if(daily&&r.id!=='day:'+r.date)throw Error('当天情况 ID 无效');
 if(!daily&&(typeof r.time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time)))throw Error('时间格式无效');
 for(const [k,min,max] of [['rt',1,10000],['sleep',0,24],['duration',0,1440]]){if(daily&&k!=='sleep')continue;if(k!=='rt'&&(r[k]===null||r[k]===undefined))continue;if(typeof r[k]!=='number'||!Number.isFinite(r[k])||r[k]<min||r[k]>max)throw Error('数值无效：'+k)}
 for(const k of ['sleepType','activity','meal','exercise','state','notes','source','updatedAt'])if(r[k]!=null&&(typeof r[k]!=='string'||r[k].length>2000))throw Error('文本字段无效：'+k);
 if(!daily){
 if(r.testSetup!=null&&(typeof r.testSetup!=='string'||r.testSetup.length>120))throw Error('测试配置名称最多 120 个字符');
 if(r.caffeineWindow!=null&&!['unknown','none','yes'].includes(r.caffeineWindow))throw Error('咖啡因记录类别无效');
 if(r.quality!=null&&!['unknown','normal','practice','interrupted','device_issue'].includes(r.quality))throw Error('测试状态类别无效');
 if(r.recordedAt!=null&&(typeof r.recordedAt!=='string'||r.recordedAt.length>40||!Number.isFinite(Date.parse(r.recordedAt))))throw Error('录入时间无效');
 }
 if(daily&&r.sleepModel!=null&&r.sleepModel!==2)throw Error('睡眠记录版本无效');
 if(daily)ReactionSleep.validateDay(r);
 if(JSON.stringify(r).length>24000)throw Error('单条记录内容过长');
 const allowed=daily?['id','kind','date','sleep','sleepType','exercise','updatedAt','sleepModel','nightHours','nightWake','napStatus','napStart','napEnd']:['id','kind','date','time','rt','sleep','sleepType','activity','duration','meal','exercise','state','notes','source','updatedAt','raw','dateInferred','sleepInherited','testSetup','caffeineWindow','quality','recordedAt'];
 return Object.fromEntries(allowed.filter(k=>Object.hasOwn(r,k)).map(k=>[k,r[k]]));
}
