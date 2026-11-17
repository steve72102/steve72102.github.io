'use strict';
const fs=require('node:fs');
const path=require('node:path');

function option(name,fallback){const i=process.argv.indexOf(name);return i<0?fallback:process.argv[i+1];}
const catalogRoot=path.resolve(option('--catalog-root',path.resolve(__dirname,'../..')));
const artRoot=path.resolve(option('--art-root',catalogRoot));
const output=option('--output',null);
const adventure=require(path.join(catalogRoot,'game/adventure.js'));
const academy=require(path.join(artRoot,'game/academy.js'));
const expected=['down','up','left','right'].flatMap(direction=>['actions','run'].flatMap(sheet=>Array.from({length:8},(_,frame)=>`${direction}/${sheet}/${frame}`)));
const roots=[catalogRoot,artRoot];
const manifests=[];
for(const root of roots){
  const dir=path.join(root,'game/assets/painted-avatar');
  if(!fs.existsSync(dir))continue;
  for(const child of fs.readdirSync(dir,{withFileTypes:true})){
    if(!child.isDirectory())continue;
    const file=path.join(dir,child.name,'manifest.json');
    if(!fs.existsSync(file))continue;
    try{manifests.push({file,root,manifest:JSON.parse(fs.readFileSync(file,'utf8'))});}catch(error){throw Error(`${file}: ${error.message}`);}
  }
}
const pairs=[];
for(const gear of adventure.GEAR)for(const character of academy.CHARACTERS){
  const candidates=manifests.filter(({manifest})=>manifest.character===character.id&&manifest.items?.[gear.slot]?.includes(gear.id)&&manifest.passes?.some(pass=>pass.ownerSlot===gear.slot&&pass.itemId===gear.id));
  const complete=candidates.find(({manifest})=>manifest.status==='complete'&&expected.every(cell=>{
    const [direction,sheet,frame]=cell.split('/');
    return manifest.coverage?.directions?.includes(direction)&&manifest.coverage?.sheets?.[sheet]?.includes(Number(frame));
  }));
  pairs.push({character:character.id,itemId:gear.id,slot:gear.slot,source:gear.source||'classic',status:complete?'declared-complete':candidates.length?'partial-or-unverified':'missing',manifest:complete?.file||candidates[0]?.file||null});
}
const counts=Object.fromEntries(['declared-complete','partial-or-unverified','missing'].map(status=>[status,pairs.filter(pair=>pair.status===status).length]));
const report={schema:1,catalogRoot,artRoot,characters:academy.CHARACTERS.length,items:adventure.GEAR.length,expectedCellsPerPair:expected.length,counts,pairs};
if(output){const dest=path.resolve(output);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,JSON.stringify(report,null,2)+'\n');}
process.stdout.write(JSON.stringify({characters:report.characters,items:report.items,expectedCellsPerPair:report.expectedCellsPerPair,counts,output:output&&path.resolve(output)})+'\n');
