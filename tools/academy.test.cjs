const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const E=require('../game/engine.js'),C=require('../game/combat.js'),A=require('../game/academy.js'),D=require('../game/duel.js');
const context={window:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../game/bank.js'),'utf8'),context);const questions=Array.from(context.window.MIND_BANK.questions);
test('older saves gain default appearance without touching progression',()=>{
  const s=E.fresh();s.xp=135;s.tickets=3;s.inventory['pharmaceutics-0']=1;s.equipped='pharmaceutics-0';
  const restored=E.restore(s,questions);restored.arena=C.restore(s.arena,questions);restored.appearance=A.restore(s.appearance);
  assert.equal(restored.xp,135);assert.equal(restored.tickets,3);assert.equal(restored.equipped,s.equipped);assert.deepEqual(restored.appearance,A.fresh());
});
test('appearance and no-pet choice roundtrip through exported JSON',()=>{
  for(const character of A.CHARACTERS)for(const pet of [...A.PETS.map(x=>x.id),null]){
    const raw={version:1,character:character.id,pet};assert.deepEqual(A.restore(JSON.parse(JSON.stringify(raw))),raw);
  }
});
test('unknown appearances, paths and wrong shape are rejected',()=>{
  for(const bad of [null,[],{},'doctor',{...A.fresh(),version:2},{...A.fresh(),character:'../../../bad'},{...A.fresh(),pet:'https://bad.test/a.png'}])assert.throws(()=>A.restore(bad));
});
test('every cosmetic choice leaves combat stats, XP, currency and equipment unchanged',()=>{
  const s=Object.assign(E.fresh(),{arena:C.fresh(),appearance:A.fresh()});s.xp=300;s.arena.coins=80;s.inventory['pharmacology-2']=1;s.equipped='pharmacology-2';
  const stats=C.stats(s,'pharmacology'), original={...s};delete original.appearance;
  for(const c of A.CHARACTERS)for(const p of [...A.PETS.map(x=>x.id),null]){
    assert.ok(A.choose(s,'character',c.id));assert.ok(A.choose(s,'pet',p));assert.deepEqual(C.stats(s,'pharmacology'),stats);
    const after={...s};delete after.appearance;assert.deepEqual(after,original);
  }
  assert.equal(A.choose(s,'level',99),false);assert.equal(A.choose(s,'character','fake'),false);
});
test('all three subject buildings route to correct pools and exam floors respect selection',()=>{
  for(const b of A.BUILDINGS.slice(0,3)){
    const all=A.pool(questions,b.id,'practice');assert.ok(all.length>0);assert.ok(all.every(q=>q.subject===b.id));
    const calc=A.pool(questions,b.id,'calculation');assert.ok(calc.every(q=>q.calculation&&q.subject===b.id));
    const exam=all[0].exam,filtered=A.pool(questions,b.id,'exam',exam);assert.ok(filtered.length>0);assert.ok(filtered.every(q=>q.subject===b.id&&q.exam===exam));
    assert.equal(A.pool(questions,b.id,'exam','missing').length,0);
  }
  assert.equal(A.pool(questions,'battle','practice').length,0);assert.equal(A.pool(questions,'pharmaceutics','unknown').length,0);
});
test('combat and life building floors point to real routes',()=>{
  assert.deepEqual(A.floors('battle').map(f=>f.id),['arena','duel']);assert.deepEqual(A.floors('life').map(f=>f.id),['shop','draw','wardrobe']);
});
test('duel profiles preserve validated cosmetics; older clients receive defaults',()=>{
  const base={name:'同學甲',level:3,gearId:null},look={version:1,character:'professor',pet:'mortar'};
  const result=D.profile({...base,appearance:look});assert.deepEqual(result.appearance,look);look.character='doctor';assert.equal(result.appearance.character,'professor');
  assert.deepEqual(D.profile(base).appearance,A.fresh());assert.throws(()=>D.profile({...base,appearance:{version:1,character:'admin',pet:null}}));
});
test('appearance is frozen per duel and does not modify damage',()=>{
  const mine={name:'同學甲',level:3,gearId:null,appearance:A.fresh()},other={...mine,name:'同學乙',appearance:{version:1,character:'professor',pet:null}};
  const config=D.create('pharmaceutics',questions,()=>.25),duel=D.fresh(config,mine,other);mine.appearance.character='doctor';
  assert.equal(duel.players[0].appearance.character,'graduate');assert.deepEqual(C.heroStats(mine.level,mine.gearId,config.subject),C.heroStats(other.level,other.gearId,config.subject));
});
