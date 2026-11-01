'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../game/engine.js'),R=require('../game/adventure.js'),C=require('../game/combat.js'),D=require('../game/duel.js');
const fresh=()=>({...E.fresh('2026-11-01'),arena:C.fresh('2026-11-01'),rpg:R.fresh()});

test('each question awards 2, 1, 0 books per Taipei day; wrong answers consume nothing',()=>{
  const s=fresh(),day='2026-11-01';
  assert.equal(R.earnNote(s,'q1',false,day),0);
  assert.equal(R.earnNote(s,'q1',true,day),2);
  assert.equal(R.earnNote(s,'q2',true,day),2);
  assert.equal(R.earnNote(s,'q1',false,day),0);
  assert.equal(R.earnNote(s,'q1',true,day),1);
  s.rpg=R.restore(JSON.parse(JSON.stringify(s.rpg)));
  assert.equal(R.earnNote(s,'q1',true,day),0);assert.equal(s.rpg.notes,5);
  const before=E.today(new Date('2026-11-01T15:59:59Z'));
  const after=E.today(new Date('2026-11-01T16:00:00Z'));
  assert.equal(before,day);assert.equal(after,'2026-11-02');
  assert.equal(R.earnNote(s,'q1',true,after),2);assert.equal(R.earnNote(s,'q1',true,after),1);
  assert.equal(R.earnNote(s,'q1',true,after),0);assert.equal(s.rpg.notes,8);
});
test('old daily book records migrate without issuing a second first-answer reward',()=>{
  const s=fresh();Object.assign(s.rpg,{notes:10,notesDay:'2026-11-01',notedIds:['q1']});delete s.rpg.noteCounts;s.rpg.version=1;
  s.rpg=R.restore(s.rpg);assert.equal(s.rpg.notes,10);
  assert.equal(R.earnNote(s,'q1',true,'2026-11-01'),1);assert.equal(R.earnNote(s,'q1',true,'2026-11-01'),0);
  assert.throws(()=>R.restore({...s.rpg,noteCounts:{q1:3}}));
  assert.throws(()=>R.restore({...s.rpg,noteCounts:{unseen:1}}));
});
test('equipment can advance every integer level 1–90 without consuming general inventory space',()=>{
  const s=fresh();s.xp=8900;s.rpg.notes=10000;R.grant(s,'coat-dawn');R.equip(s,'coat-dawn');
  const bag=R.count(s),base=C.stats(s,'pharmaceutics'),name=R.gear('coat-dawn').name;
  for(let level=1;level<90;level++){
    assert.equal(R.equipmentLevel(s.rpg,'coat-dawn'),level);
    const before=s.rpg.notes,cost=[5,15,35][Math.floor(level/30)];
    assert(R.train(s,'coat-dawn'));assert.equal(s.rpg.notes,before-cost);
    assert.equal(R.equipmentLevel(s.rpg,'coat-dawn'),level+1);
    assert.equal(C.stats(s,'pharmaceutics').attack,base.attack+Math.floor((level+1)/30));
    assert.equal(R.count(s),bag);
  }
  assert.equal(R.gear('coat-dawn').name,name);
  const finished=JSON.stringify(s);assert.equal(R.train(s,'coat-dawn'),false);assert.equal(JSON.stringify(s),finished);
  assert.deepEqual(R.restore(s.rpg),s.rpg);
  assert.throws(()=>R.restore({...s.rpg,equipmentLevels:{'coat-dawn':91}}));
  assert.throws(()=>R.restore({...s.rpg,equipmentLevels:{'coat-dawn':60}}));
});
test('training rejects unowned items, insufficient books and milestone character gates without mutation',()=>{
  const s=fresh();s.rpg.notes=10000;assert(!R.train(s,'coat-dawn'));R.grant(s,'coat-dawn');
  s.rpg.training={'coat-dawn':1};s.rpg.equipmentLevels={'coat-dawn':59};
  let before=JSON.stringify(s);assert(!R.train(s,'coat-dawn'));assert.equal(JSON.stringify(s),before);
  s.xp=1000;assert(R.train(s,'coat-dawn'));assert.equal(s.rpg.training['coat-dawn'],2);
  s.rpg.notes=0;before=JSON.stringify(s);assert(!R.train(s,'coat-dawn'));assert.equal(JSON.stringify(s),before);
});
test('fully trained equipment still cannot damage with zero correct answers and knowledge can reverse a gear gap',()=>{
  const strong=fresh();strong.xp=9900;strong.inventory['pharmaceutics-3']=1;strong.equipped='pharmaceutics-3';
  strong.rpg.loadout.handheld='pharmaceutics-3';
  for(const slot of Object.keys(R.SLOTS).filter(x=>x!=='handheld')){
    const candidates=R.GEAR.filter(g=>g.slot===slot);const best=candidates.reduce((a,b)=>b.attack>a.attack?b:a);
    if(best.source!=='milestone')R.grant(strong,best.id);assert(R.equip(strong,best.id));
  }
  for(const id of Object.values(strong.rpg.loadout)){strong.rpg.training[id]=3;strong.rpg.equipmentLevels[id]=90;}
  strong.rpg=R.restore(strong.rpg);D.profile({name:'合法高裝測試',level:100,gearId:strong.equipped,loadout:strong.rpg.loadout,training:strong.rpg.training});
  const high=C.stats(strong,'pharmaceutics'),low=C.stats(fresh(),'pharmaceutics');
  assert.equal(C.calculateRound(high,{attack:0},0,0).damage,0);
  const weakKnowledge=C.calculateRound(low,{attack:0},3,0).damage+C.calculateRound(low,{attack:0},3,3).damage;
  const strongFew=C.calculateRound(high,{attack:0},1,0).damage+C.calculateRound(high,{attack:0},1,1).damage;
  assert(weakKnowledge>strongFew,`${weakKnowledge} > ${strongFew}`);
});

test('new saves have an explicit RPG format while version one migrates without loss',()=>{const old=fresh().rpg;old.version=1;old.training={'coat-dawn':1};delete old.equipmentLevels;delete old.noteCounts;const migrated=R.restore(old);assert.equal(migrated.version,2);assert.equal(migrated.equipmentLevels['coat-dawn'],30);assert.equal(migrated.training['coat-dawn'],1);assert.throws(()=>R.restore({...migrated,version:3}));});
