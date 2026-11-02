#!/usr/bin/env node
/* Register only explicitly reviewed characters whose full and compact atlas
   files match their manifests. Never creates art, equipment ownership or saves. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'..'),N=require('../game/native-avatar.js'),A=require('../game/academy.js'),args=process.argv.slice(2),requested=[];let write=false;
for(let i=0;i<args.length;i++){if(args[i]==='--character')requested.push(args[++i]);else if(args[i]==='--write')write=true;else throw Error('Usage: node tools/build-native-registry.cjs [--character id ...] [--write]');}
const SHA=b=>crypto.createHash('sha256').update(b).digest('hex'),rows={...N.CAST};
for(const character of requested){
  if(character==='doctor'||!A.CHARACTERS.some(c=>c.id===character))throw Error('Use an existing non-Stage3 character id.');
  const dir=path.join(repo,'game/assets/native-avatar','pineapple-'+character),spec=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'))),compact=JSON.parse(fs.readFileSync(path.join(dir,'COMPACT.json')));
  if(spec.authoredFrameCount!==64||spec.sheets.length!==8||compact.assets.length!==8)throw Error('Incomplete atlas set: '+character);
  if(spec.assetId!=='pineapple-'+character||spec.character!==character)throw Error('Unexpected character manifest identity.');
  for(const row of spec.sheets){if(!N.DIRECTIONS.includes(row.direction)||!['run','actions'].includes(row.actionSet)||row.path!=='./assets/native-avatar/'+spec.assetId+'/'+row.direction+'-'+row.actionSet+'.webp')throw Error('Unsafe atlas path.');const data=fs.readFileSync(path.join(repo,'game',row.path));if(data.length!==row.runtimeBytes||SHA(data)!==row.runtimeSha256)throw Error('Atlas changed after review: '+row.path);}
  for(const row of compact.assets){if(!/^actor-(down|up|left|right)-(run|actions)\.webp$/.test(row.file))throw Error('Unsafe compact atlas path.');const data=fs.readFileSync(path.join(dir,row.file));if(data.length!==row.bytes||SHA(data)!==row.sha256)throw Error('Compact atlas changed: '+row.file);}
  if(!Array.isArray(spec.portraitBox)||spec.portraitBox.length!==4||!spec.portraitBox.every(Number.isFinite)||spec.portraitBox[0]<0||spec.portraitBox[1]<0||spec.portraitBox[2]<=0||spec.portraitBox[3]<=0||spec.portraitBox[0]+spec.portraitBox[2]>256||spec.portraitBox[1]+spec.portraitBox[3]>384)throw Error('Invalid portrait crop.');
  const bounds=spec.sheets.filter(s=>s.actionSet==='actions').map(s=>s.frames[0].alphaBounds),left=Math.max(0,Math.min(...bounds.map(b=>b[0]))-8),top=Math.max(0,Math.min(...bounds.map(b=>b[1]))-8),right=Math.min(256,Math.max(...bounds.map(b=>b[2]))+8),bottom=Math.min(384,Math.max(...bounds.map(b=>b[3]))+8);
  rows[character]={id:spec.assetId,previewBox:[left,top,right-left,bottom-top],portraitBox:spec.portraitBox,label:A.CHARACTERS.find(c=>c.id===character).name,compact:true};
}
const lines=Object.entries(rows).map(([id,p])=>id==='doctor'?"    doctor:Object.freeze({id:ID,previewBox:PREVIEW_BOX,portraitBox:PORTRAIT_BOX,label:'青年學者',compact:false})":'    '+JSON.stringify(id)+':Object.freeze({id:'+JSON.stringify(p.id)+',previewBox:Object.freeze('+JSON.stringify(p.previewBox)+'),portraitBox:Object.freeze('+JSON.stringify(p.portraitBox)+'),label:'+JSON.stringify(p.label)+',compact:true})');
const block='  // BEGIN GENERATED NATIVE CAST\n  const CAST=Object.freeze({\n'+lines.join(',\n')+'\n  });\n  // END GENERATED NATIVE CAST',file=path.join(repo,'game/native-avatar.js'),before=fs.readFileSync(file,'utf8'),after=before.replace(/  \/\/ BEGIN GENERATED NATIVE CAST\n[\s\S]*?  \/\/ END GENERATED NATIVE CAST/,block);
if(after===before&&!before.includes(block))throw Error('Native registry anchors are unfamiliar; no write.');
if(write&&after!==before)fs.writeFileSync(file,after);
console.log(JSON.stringify({characters:Object.keys(rows),changed:after!==before,write,previewBoxes:Object.fromEntries(Object.entries(rows).map(([id,p])=>[id,p.previewBox]))}));
