import fs from 'node:fs';
const original=JSON.parse(fs.readFileSync('lib/journal-markup.ts','utf8').split('\n')[0].replace('export const journalMarkup = ','').replace(/;\r?$/,''));
for(const view of ['record','insights']){
 let body=original;if(view==='insights')body=body.replace('data-view="record"','data-view="insights"').replace('data-nav="record" aria-current="page"','data-nav="record"').replace('data-nav="insights"','data-nav="insights" aria-current="page"');
 const html='<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>'+(view==='record'?'反应手记':'洞察 / 发现 | 反应手记')+'</title><link rel="stylesheet" href="/journal.css"><script src="/journal.js" defer></script></head><body>'+body+'</body></html>';
 fs.writeFileSync('public/'+(view==='record'?'index':'insights')+'.html',html);
}
console.log('Prepared two standalone pages and shared client.');

await import('./package-hb-helper.mjs');
