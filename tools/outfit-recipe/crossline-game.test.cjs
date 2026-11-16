'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../../game/engine.js'),C=require('../../game/combat.js'),R=require('../../game/adventure.js');
const id='style-fusion-academy-crossline-common-jacket',day='2026-11-16';
const fresh=()=>({...E.fresh(day),arena:C.fresh(day),rpg:R.fresh()});
test('new jacket uses existing coin purchase, bag, equip and save contract',()=>{
  const gear=R.gear(id);assert.equal(gear.slot,'jacket');assert.equal(gear.price,240);
  const state=fresh();state.arena.coins=239;
  const before=JSON.stringify(state);assert.equal(R.buy(state,id),false);assert.equal(JSON.stringify(state),before);
  state.arena.coins=240;assert.equal(R.buy(state,id),true);assert.equal(state.arena.coins,0);
  assert.equal(state.rpg.items[id],1);assert.equal(R.wardrobeCount(state),1);assert.equal(R.count(state),0);
  assert.equal(R.equip(state,id),true);assert.equal(state.rpg.loadout.jacket,id);
  assert.equal(R.sell(state,id),false);
  const saved=JSON.parse(JSON.stringify(state.rpg));assert.deepEqual(R.restore(saved),saved);
  assert.equal(R.unequip(state,'jacket'),true);assert.equal(state.rpg.loadout.jacket,null);
  assert.equal(R.sell(state,id),true);assert.equal(state.rpg.items[id],undefined);
});
test('old save and old gear IDs remain valid',()=>{
  const state=fresh();assert.equal(R.gear('fruit-pineapple-jacket').slot,'jacket');
  assert.equal(R.restore(JSON.parse(JSON.stringify(state.rpg))).loadout.jacket,null);
});
