import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const evidence=JSON.parse(read('lib/evidence-sources.json')).map(s=>`<article class="evidence-source"><h4><a href="${escape(s.url)}" target="_blank" rel="noopener noreferrer">${escape(s.label)}</a></h4><p>${escape(s.cite)} · ${escape(s.kind)}</p><p>${escape(s.claim)}</p><p>适用限制：${escape(s.limit)}</p></article>`).join('');
let markup=read('lib/ui/shell.html');for(const [key,file] of [['RECORD','record'],['INSIGHTS','insights'],['SHARED','shared']])markup=markup.replace('{{'+key+'}}',read('lib/ui/'+file+'.html'));markup=markup.replace('{{EVIDENCE}}',evidence);
if(/\{\{\w+\}\}/.test(markup))throw Error('Unresolved UI template placeholder');
fs.writeFileSync(path.join(root,'lib/journal-markup.ts'),'export const journalMarkup = '+JSON.stringify(markup)+';\n'+`export type JournalView = 'record' | 'insights';
export function getJournalMarkup(view: JournalView) {
 if(view==='record')return journalMarkup;
 return journalMarkup.replace('data-view="record"','data-view="insights"').replace('data-nav="record" aria-current="page"','data-nav="record"').replace('data-nav="insights"','data-nav="insights" aria-current="page"');
}
`);
const modules=['lib/sleep-insights.mjs','lib/analysis/statistics.mjs','lib/analysis/reaction-review.mjs'].map(p=>read(p).replace(/^import .*;\r?\n/gm,'').replace('export const ','const ').replace(/\bSleep\b/g,'ReactionSleep').replace(/\bStats\b/g,'ReactionStats'));
const controllers=['client/views/record.js','client/views/history.js','client/views/insights.js','client/views/hb-draft.js','client/journal.js','client/core/sync.js'].map(read);
fs.writeFileSync(path.join(root,'public/journal.js'),modules.concat(controllers).join('\n'));
console.log('Prepared shared markup, two routes, evidence references and journal client.');

