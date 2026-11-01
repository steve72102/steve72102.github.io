'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../game/engine.js'),R=require('../game/adventure.js'),C=require('../game/combat.js'),F=require('../game/wish.js');
const fresh=(coins=10000)=>({...E.fresh('2026-11-01'),arena:{...C.fresh('2026-11-01'),coins},rpg:R.fresh()});
const buySet=(s,set)=>{for(const id of R.setIds(set))assert.equal(R.buy(s,id),true,id);};

test('six fruit collections offer 48 distinct pieces at the same accessible coin prices',()=>{
  assert.deepEqual(R.FRUIT_SETS.map(s=>s.key),['citrus','berry','pomelo','pineapple','cherry','grape']);
  const all=R.FRUIT_SETS.flatMap(R.setIds);assert.equal(all.length,48);assert.equal(new Set(all).size,48);
  for(const set of R.FRUIT_SETS){const pieces=R.setIds(set).map(R.gear);assert.deepEqual(pieces.map(g=>g.slot),Object.keys(R.SLOTS));assert.equal(pieces.reduce((n,g)=>n+g.price,0),1280);assert(pieces.every(g=>g.source==='fruit'&&g.tier===0&&(g.level||1)===1));assert(pieces.every(g=>g.text.length>15));}
  assert.deepEqual(R.setIds('missing'),[]);assert.deepEqual(R.setIds(null),[]);
});
test('a full ordinary backpack still permits buying and wearing every fruit collection at level one',()=>{
  for(const set of R.FRUIT_SETS){const s=fresh(1280);s.inventory['herbal-0']=50;const ids=R.setIds(set);assert.equal(R.equipSet(s,ids),false);buySet(s,set);assert.equal(s.arena.coins,0);assert.equal(R.wardrobeCount(s),8);assert.equal(R.count(s),50);assert.equal(s.rpg.capacity,50);assert.equal(R.equipSet(s,ids),true);assert.deepEqual(Object.values(s.rpg.loadout),ids);assert.equal(s.equipped,null);assert.deepEqual(R.restore(JSON.parse(JSON.stringify(s.rpg))),s.rpg);}
});
test('insufficient coins, unknown items and a full per-item collection do not mutate any balance or inventory',()=>{
  const id='fruit-citrus-jacket';for(const scenario of ['poor','unknown','limit']){const s=fresh(scenario==='poor'?239:1000);if(scenario==='limit')s.rpg.items[id]=100000000;const before=JSON.stringify(s);assert.equal(R.buy(s,scenario==='unknown'?'fruit-forged-jacket':id),false);assert.equal(JSON.stringify(s),before);}
});
test('buying a second copy charges its price and keeps the first equipped copy intact',()=>{
  const s=fresh(480),id='fruit-citrus-jacket';assert(R.buy(s,id));assert(R.equip(s,id));assert(R.buy(s,id));assert.equal(s.arena.coins,0);assert.equal(s.rpg.items[id],2);assert.equal(s.rpg.loadout.jacket,id);assert(R.sell(s,id));assert.equal(s.rpg.items[id],1);assert.equal(s.arena.coins,60);assert.equal(R.sell(s,id),false);assert.equal(s.rpg.loadout.jacket,id);
});
test('a missing final piece leaves the entire previous outfit and knowledge item untouched',()=>{
  const s=fresh(),knowledge=E.ITEMS[0].id;R.grant(s,'coat-dawn');R.equip(s,'coat-dawn');s.inventory[knowledge]=1;R.equip(s,knowledge);const ids=R.setIds('berry');for(const id of ids.slice(0,-1))assert(R.buy(s,id));const before=JSON.stringify(s);assert.equal(R.equipSet(s,ids),false);assert.equal(JSON.stringify(s),before);
});
test('duplicate slots, forged IDs and malformed outfit requests fail before replacing any piece',()=>{
  const s=fresh();buySet(s,'cherry');buySet(s,'pomelo');const before=JSON.stringify(s);for(const ids of [[],null,'fruit-cherry-jacket',['fruit-cherry-jacket','fruit-pomelo-jacket'],['fruit-cherry-jacket','fruit-forged-pants'],[...R.setIds('cherry'),'fruit-pomelo-hat']]){assert.equal(R.equipSet(s,ids),false);assert.equal(JSON.stringify(s),before);}
});
test('fruit and existing pieces mix without switching the character or consuming clothes',()=>{
  const s=fresh();s.appearance={version:1,character:'herbal-mentor',pet:null};buySet(s,'citrus');buySet(s,'grape');R.grant(s,'coat-star');const ids=['fruit-citrus-jacket','coat-star','fruit-grape-pants','fruit-grape-hat'];const before={items:{...s.rpg.items},appearance:{...s.appearance},coins:s.arena.coins};assert(R.equipSet(s,ids));assert.equal(s.rpg.loadout.jacket,ids[0]);assert.equal(s.rpg.loadout.cape,ids[1]);assert.equal(s.rpg.loadout.pants,ids[2]);assert.equal(s.rpg.loadout.hat,ids[3]);assert.deepEqual(s.rpg.items,before.items);assert.deepEqual(s.appearance,before.appearance);assert.equal(s.arena.coins,before.coins);
});
test('whole-outfit wear keeps knowledge hand items mutually exclusive with fashion hand items',()=>{
  const s=fresh(),knowledge=E.ITEMS[0].id;s.inventory[knowledge]=1;assert(R.equip(s,knowledge));buySet(s,'pineapple');assert(R.equipSet(s,R.setIds('pineapple')));assert.equal(s.equipped,null);assert.equal(s.rpg.loadout.handheld,'fruit-pineapple-handheld');assert(R.equipSet(s,[knowledge]));assert.equal(s.equipped,knowledge);assert.equal(s.rpg.loadout.handheld,knowledge);
});
test('existing milestone whole-outfit wear remains free and obeys the original unlock level',()=>{
  const s=fresh(0);for(const set of R.STYLE_SETS){const ids=R.setIds(set);s.xp=(set.level-2)*100;const before=JSON.stringify(s);assert.equal(R.equipSet(s,ids),false);assert.equal(JSON.stringify(s),before);s.xp=(set.level-1)*100;assert(R.equipSet(s,ids));assert.equal(R.wardrobeCount(s),0);assert.equal(s.arena.coins,0);assert.deepEqual(R.restore(JSON.parse(JSON.stringify(s.rpg))).loadout,s.rpg.loadout);}
});
test('all six colour stories have the same base combat strength and do not alter knowledge scoring',()=>{
  for(const set of R.FRUIT_SETS){const s=fresh();buySet(s,set);assert(R.equipSet(s,R.setIds(set)));assert.deepEqual(R.bonus(s.rpg.loadout,1),{attack:7,hp:22,guard:2});const stats=C.stats(s,'pharmaceutics');assert.equal(C.calculateRound(stats,{attack:20},0).damage,0);}
});
test('fruit inventory, mixed slots and existing 90-level training survive serialization without colour changes',()=>{
  const s=fresh();buySet(s,'grape');R.equipSet(s,R.setIds('grape'));s.rpg.training['fruit-grape-jacket']=3;s.rpg.equipmentLevels['fruit-grape-jacket']=90;s.rpg.notes=17;const before=JSON.stringify(s.rpg),colour=R.gear('fruit-grape-jacket').color;s.rpg=R.restore(JSON.parse(before));assert.equal(JSON.stringify(s.rpg),before);assert.equal(R.equipmentLevel(s.rpg,'fruit-grape-jacket'),90);assert.equal(R.gear('fruit-grape-jacket').color,colour);
});
test('new fruit outfits do not enter the established monster loot or fountain reward pools',()=>{
  const allowed=new Set(['coat-dawn','boots-dawn','badge-seed','coat-herb','boots-path','badge-prism','coat-star','boots-star','badge-sage']);
  for(const enemyId of ['bronze','silver','gold','diamond'])for(const day of ['2026-11-01','2026-11-02','2026-11-03']){const s=fresh();s.arena.battle={phase:'done',enemyId,subject:'pharmaceutics',day,result:{win:true,eligible:true}};const result=R.recordBattle(s);assert(allowed.has(result.id));}
  assert(F.GEAR.every(g=>!g.id.startsWith('fruit-')));assert(F.PRIZES.every(g=>!g.id.startsWith('fruit-')));assert(R.QUESTS.every(q=>allowed.has(q.item)));
});
test('quarterly catalog switches exactly at Taipei calendar boundaries without expiring items',()=>{
  assert.equal(R.SHOP_SEASONS.length,1);const season=R.SHOP_SEASONS[0];assert.equal(season.id,'2026Q4');
  for(const [day,status] of [['2026-09-30','upcoming'],['2026-10-01','active'],['2026-12-31','active'],['2027-01-01','archive']])assert.equal(R.shopSeasonStatus(season.id,day),status);
  const beforeMidnight=E.today(new Date('2026-12-31T15:59:59Z')),afterMidnight=E.today(new Date('2026-12-31T16:00:00Z'));assert.equal(beforeMidnight,'2026-12-31');assert.equal(afterMidnight,'2027-01-01');assert.equal(R.shopSeasonStatus(season.id,beforeMidnight),'active');assert.equal(R.shopSeasonStatus(season.id,afterMidnight),'archive');
  const ids=R.setIds('citrus'),s=fresh();for(const id of ids)assert(R.buy(s,id,beforeMidnight));assert(R.equipSet(s,ids));const before=JSON.stringify(s.rpg);assert.equal(R.shopSeasonStatus(season.id,afterMidnight),'archive');assert.equal(JSON.stringify(s.rpg),before);assert.deepEqual(R.setIds('citrus'),ids);assert.deepEqual(R.restore(JSON.parse(before)),s.rpg);assert(R.buy(s,ids[0],afterMidnight));assert.equal(s.rpg.items[ids[0]],2);assert.equal(s.rpg.loadout.jacket,ids[0]);
});
test('unpublished seasonal merchandise cannot be bought early and invalid calendar inputs fail explicitly',()=>{
  const s=fresh(),before=JSON.stringify(s);assert.equal(R.buy(s,'fruit-grape-jacket','2026-09-30'),false);assert.equal(JSON.stringify(s),before);assert(R.buy(s,'fruit-grape-jacket','2026-10-01'));
  for(const day of ['2026-02-30','2026-13-01','2026-1-01','2026-12-31T00:00:00Z',null,20819])assert.throws(()=>R.shopSeasonStatus('2026Q4',day),/日期/);assert.throws(()=>R.shopSeasonStatus('2027Q1','2027-01-01'),/季度/);
});
test('seasonal fruit designs keep the recorded non-repeating music selections as design metadata',()=>{
  assert.deepEqual(R.FRUIT_SETS.map(set=>set.musicKey),['afrobeat','bluegrass','ambient','funk','disco','synth-pop']);assert.equal(new Set(R.FRUIT_SETS.map(set=>set.musicKey)).size,6);
  for(const set of R.FRUIT_SETS){assert.equal(set.season,'2026Q4');assert.equal(typeof set.music,'string');assert(set.music.length>0);assert(R.setIds(set).map(R.gear).every(item=>item.season===set.season));}
});
