'use strict';
const fs=require('node:fs');
const path=require('node:path');
const P=require('../../game/painted-avatar.js');
const base=require('../../game/assets/painted-avatar/professor-v1/manifest.json');
const common=structuredClone(require('../../game/assets/painted-avatar/professor-crossline-common-v1/manifest.json'));
const river=structuredClone(require('../../game/assets/painted-avatar/professor-river-coat-v1/manifest.json'));
const out=path.resolve(process.argv[2]||'tools/outfit-recipe/.qa/professor-plans.json');
const previewCream=process.argv.includes('--preview-cream-shirt');
const previewIsolated=process.argv.includes('--preview-isolated-v2');
if(previewCream){
  const source=base.passes.find(pass=>pass.id==='shirt');
  for(const manifest of [common,river]){
    const target=manifest.passes.find(pass=>pass.id==='crossline-shirt');
    target.images=source.images;
    target.compactImages=source.compactImages;
  }
}
const runtime=P.createRuntime();
runtime.registerManifest({...base,outfitOnly:true});
runtime.registerOutfitManifest(common);
runtime.registerOutfitManifest(river);
const slots=P.SLOTS;
const baseline=Object.fromEntries(slots.map(slot=>[slot,common.items[slot].find(id=>id.includes('crossline-professor-common'))??common.items[slot][0]??null]));
const riverWear={...baseline,jacket:'wish-river-coat'};
const baseWear=Object.fromEntries(slots.map(slot=>[slot,base.items[slot][0]??null]));
const layouts=[
  {name:'common-full',wear:baseline},
  {name:'river-full',wear:riverWear},
  {name:'river-mixed',wear:{...riverWear,shirt:baseWear.shirt,shoes:baseWear.shoes,hat:null}},
  ...slots.map(slot=>({name:`slot-${slot}`,wear:riverWear,onlySlot:slot})),
];
const state=wear=>({appearance:{character:'professor'},rpg:{loadout:wear}});
const cells=[];
for(const layout of layouts)for(const direction of P.DIRECTIONS)for(const sheet of P.SHEETS)for(let frame=0;frame<8;frame++){
  try{
    const plan=runtime.plan(state(layout.wear),direction,sheet,{frame,tier:'art',onlySlot:layout.onlySlot});
    if(plan.visualFallbackSlots.length)throw Error('The renderer substituted an equipped item');
    for(const pass of plan.passes)if(pass.ownerSlot&&pass.itemId!==layout.wear[pass.ownerSlot])throw Error(`Wrong item in ${pass.ownerSlot}`);
    const passes=plan.passes.map(pass=>{
      if(!previewIsolated||!['crossline-shirt','crossline-pants'].includes(pass.id))return pass;
      const kind=pass.id==='crossline-shirt'?'shirt':'pants';
      return {...pass,url:`./assets/painted-avatar/professor-crossline-pending-v2/professor-${direction}-${sheet}-${kind}-isolated-v2.png`};
    });
    cells.push({layout:layout.name,direction,sheet,frame,anchor:plan.anchor,passes});
  }catch(error){cells.push({layout:layout.name,direction,sheet,frame,error:error.message});}
}
const standalone=slots.map(slot=>{
  const wear=Object.fromEntries(slots.map(name=>[name,name===slot?riverWear[name]:null]));
  return {slot,itemId:wear[slot],paintedProfile:runtime.profile(state(wear))?.id??null};
});
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,JSON.stringify({schema:1,sourceCommit:process.env.GIT_COMMIT||null,previewCream,previewIsolated,layouts,standalone,cells},null,2)+'\n');
console.log(JSON.stringify({out,layouts:layouts.length,cells:cells.length,errors:cells.filter(c=>c.error).length,standalone},null,2));
