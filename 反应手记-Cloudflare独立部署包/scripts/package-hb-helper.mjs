// Deterministic ZIP writer using stored entries; no extra build dependency.
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dir=path.join(root,'integrations/hb-helper');
const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));if(manifest.manifest_version!==3)throw Error('Invalid helper manifest');
const names=fs.readdirSync(dir).filter(n=>/\.(?:js|mjs|json)$/.test(n)||n==='README.md').filter(n=>fs.statSync(path.join(dir,n)).isFile()).sort();
const table=Array.from({length:256},(_,i)=>{let n=i;for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0});
function crc32(buf){let n=0xffffffff;for(const b of buf)n=table[(n^b)&255]^(n>>>8);return (n^0xffffffff)>>>0;}
const blocks=[],central=[];let offset=0;const date=((2026-1980)<<9)|(10<<5)|30;
for(const n of names){const name=Buffer.from(n),data=fs.readFileSync(path.join(dir,n)),crc=crc32(data);const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(0x800,6);local.writeUInt16LE(date,12);local.writeUInt32LE(crc,14);local.writeUInt32LE(data.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(name.length,26);blocks.push(local,name,data);
 const header=Buffer.alloc(46);header.writeUInt32LE(0x02014b50,0);header.writeUInt16LE(20,4);header.writeUInt16LE(20,6);header.writeUInt16LE(0x800,8);header.writeUInt16LE(date,14);header.writeUInt32LE(crc,16);header.writeUInt32LE(data.length,20);header.writeUInt32LE(data.length,24);header.writeUInt16LE(name.length,28);header.writeUInt32LE(offset,42);central.push(header,name);offset+=local.length+name.length+data.length;
}
const size=central.reduce((s,b)=>s+b.length,0),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(names.length,8);end.writeUInt16LE(names.length,10);end.writeUInt32LE(size,12);end.writeUInt32LE(offset,16);fs.writeFileSync(path.join(root,'public/hb-helper.zip'),Buffer.concat([...blocks,...central,end]));console.log('Packaged HB helper '+manifest.version+' ('+names.length+' files).');
