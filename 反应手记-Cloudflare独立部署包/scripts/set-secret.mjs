import {spawn} from 'node:child_process';import {randomBytes} from 'node:crypto';
const child=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','secret','put','REACTION_AUTH_SECRET'],{stdio:['pipe','inherit','inherit']});
child.stdin.end(randomBytes(48).toString('hex')+'\n');child.on('error',()=>{console.error('Cannot launch Wrangler. Run npm install first.');process.exitCode=1});child.on('close',code=>{process.exitCode=code??1;if(code===0)console.log('New authentication secret stored in your Worker. The value was not printed.');});
