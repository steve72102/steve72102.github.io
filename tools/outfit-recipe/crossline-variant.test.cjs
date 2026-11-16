'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const P=require('../../game/painted-avatar.js');
const source=path.resolve(__dirname,'../../../../../game/assets/painted-avatar');
const pilot=path.resolve(__dirname,'../../game/assets/painted-avatar');
const read=(dir,id)=>JSON.parse(fs.readFileSync(path.join(dir,id,'manifest.json')));
const base=read(source,'doctor-v1');P.registerManifest(base);
for(const direction of P.DIRECTIONS)P.registerFrameManifest(read(source,`doctor-${direction}-v1`));
const idle=read(pilot,'doctor-crossline-common-idle-v1'),motion=read(pilot,'doctor-crossline-common-motion-v1');
for(const manifest of [idle,motion])for(const pass of manifest.passes)for(const frame of pass.frames)for(const key of ['image','compactImage']){
  const url=frame[key],parts=url.split('/'),sourceId=parts[3],name=parts[4];
  const file=path.join(sourceId===manifest.id?pilot:source,sourceId,name);
  assert.ok(fs.existsSync(file),`missing ${url}`);
  if(name.endsWith('.png')){
    const bytes=fs.readFileSync(file),w=bytes.readUInt32BE(16),h=bytes.readUInt32BE(20);
    assert.deepEqual([w,h],key==='image'?[256,384]:[96,144]);
  }
}
P.registerOutfitManifest(idle);P.registerOutfitManifest(motion);
const jacket='style-fusion-academy-crossline-common-jacket';
const old={appearance:{character:'doctor'},rpg:{loadout:Object.fromEntries(P.SLOTS.map(slot=>[slot,null]))}};
const previous=P.plan(old,'down','actions',{frame:0});assert.equal(previous.id,base.id);
let checks=0;
for(const entry of idle.loadoutCoverage.entries){
  const state={appearance:{character:'doctor'},rpg:{loadout:entry}};
  assert.equal(entry.jacket,jacket);
  for(const direction of P.DIRECTIONS)for(const sheet of P.SHEETS)for(let frame=0;frame<8;frame++){
    const p=P.plan(state,direction,sheet,{frame});
    assert.equal(p.loadout.jacket,jacket);
    assert.equal(p.passes.filter(x=>x.ownerSlot==='jacket'&&x.id==='jacket').length,1);
    assert.ok(!p.passes.some(x=>x.itemId==='fruit-pineapple-jacket'));
    assert.ok(!p.passes.some(x=>x.url.endsWith('/blank.png')||x.url.endsWith('/compact-blank.png')));
    for(const part of p.passes)if(part.ownerSlot)assert.equal(part.itemId,entry[part.ownerSlot]);
    checks++;
  }
}
assert.equal(checks,128*64);
const altered=structuredClone(motion);altered.id='doctor-crossline-invalid-v1';altered.passes[0].frames[0].image='./assets/painted-avatar/other-character-v1/illegal.png';
assert.throws(()=>P.validateManifest(altered),/本機素材/);
assert.equal(P.registerOutfitManifest(motion).id,motion.id);
const isolated=P.createRuntime();isolated.registerManifest({...base,outfitOnly:true});
for(const direction of P.DIRECTIONS)isolated.registerFrameManifest(read(source,`doctor-${direction}-v1`));
isolated.registerOutfitManifest(idle);isolated.registerOutfitManifest(motion);
assert.equal(isolated.supportsFrame(old,'down','actions',0),false);
assert.equal(isolated.supportsFrame({appearance:{character:'doctor'},rpg:{loadout:idle.loadoutCoverage.entries[0]}},'down','actions',0),true);
console.log(`PASS ${checks} new jacket loadout-frame plans; legacy doctor preserved`);
