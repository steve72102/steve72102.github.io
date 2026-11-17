'use strict';
const assert=require('node:assert/strict');
const P=require('../../game/painted-avatar.js');
const base=require('../../game/assets/painted-avatar/professor-v1/manifest.json');
const common=require('../../game/assets/painted-avatar/professor-crossline-common-v1/manifest.json');
const river=require('../../game/assets/painted-avatar/professor-river-coat-v1/manifest.json');
const runtime=P.createRuntime();
runtime.registerManifest({...base,outfitOnly:true});
runtime.registerOutfitManifest(common);
runtime.registerOutfitManifest(river);
const slots=P.SLOTS;
const loadout=Object.fromEntries(slots.map(slot=>[slot,common.items[slot][0]??null]));
loadout.jacket='wish-river-coat';
const state=wear=>({appearance:{character:'professor'},rpg:{loadout:wear}});
const supported=runtime.plan(state(loadout),'down','run');
assert.equal(supported.id,river.id);
assert.equal(supported.loadout.jacket,'wish-river-coat');
assert.deepEqual(supported.visualFallbackSlots,[]);
assert(supported.passes.some(pass=>pass.itemId==='wish-river-coat'));
assert(!supported.passes.some(pass=>pass.itemId===common.items.jacket[0]));
let checked=0;
for(const direction of P.DIRECTIONS)for(const sheet of P.SHEETS)for(let frame=0;frame<8;frame++){
  const plan=runtime.plan(state(loadout),direction,sheet,{frame});
  assert.equal(plan.id,river.id);
  for(const pass of plan.passes)if(pass.ownerSlot){
    assert.equal(pass.itemId,loadout[pass.ownerSlot]);
    assert(pass.url.startsWith('./assets/painted-avatar/'));
  }
  for(const slot of slots){
    const part=runtime.plan(state(loadout),direction,sheet,{frame,onlySlot:slot});
    assert(part.passes.every(pass=>pass.ownerSlot===slot&&pass.itemId===loadout[slot]));
    checked++;
  }
}
const unsupported={...loadout,shirt:'some-real-item-without-painted-art'};
assert.equal(runtime.supports(state(unsupported)),false);
assert.throws(()=>runtime.plan(state(unsupported),'down','run'),/尚無支援/);
console.log(`Professor manifest plan: PASS (${checked} slot/cell plans); unsupported item has no false painted substitute. Pixel and game visual QA pending.`);
