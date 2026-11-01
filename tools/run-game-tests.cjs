#!/usr/bin/env node
'use strict';
// Register each CommonJS test module in one node:test harness. This avoids
// subprocess permissions and runs the shared emulator fixtures sequentially.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),args=process.argv.slice(2);
const all=fs.readdirSync(__dirname).filter(n=>n.endsWith('.test.cjs')).sort();
const rules=n=>n.endsWith('-rules.test.cjs');
let files;
if(!args.length||args[0]==='--unit')files=all.filter(n=>!rules(n));
else if(args[0]==='--rules')files=all.filter(rules);
else if(args[0]==='--all')files=all;
else files=args;
if(files.some(n=>!all.includes(n))||args.some(a=>a.startsWith('--')&&!['--unit','--rules','--all'].includes(a))||args[0]?.startsWith('--')&&args.length!==1){
  console.error('Usage: node tools/run-game-tests.cjs [--unit|--rules|--all|one.test.cjs ...]');process.exit(2);
}
process.chdir(root);
console.log('Game tests:',files.length,'files; mode',args[0]||'--unit');
for(const file of files)require(path.join(__dirname,file));
