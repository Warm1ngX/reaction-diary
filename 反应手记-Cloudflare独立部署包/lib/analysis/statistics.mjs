export const ReactionStats=(()=>{
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
