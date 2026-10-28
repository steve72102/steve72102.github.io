const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../game/engine.js'),C=require('../game/combat.js');
const qs=Array.from({length:12},(_,i)=>({id:'q'+i,subject:'pharmaceutics',answer:i%4}));
const day='2026-10-28';
test('supply study cards explain answer references and keep full negative-question context',()=>{
 const q={title:'理解條件',question:'下列何者錯誤？',options:['完整內容一','完整內容二','錯誤敘述的完整內容','完整內容四'],answer:2,explanation:'本題選C，所以C錯。選項A正確；B把條件換成另一種情況。',memory:'C 先辨識條件→C錯'};
 const card=C.studyCard(q);
 assert.equal(card.question,q.question);assert.equal(card.answer,q.options[2]);
 assert(card.explanation.includes('本題選「錯誤敘述的完整內容」'));
 assert(card.explanation.includes('所以「錯誤敘述的完整內容」錯'));
 assert(card.explanation.includes('選項「完整內容一」正確'));
 assert(card.explanation.includes('「完整內容二」把條件換成另一種情況'));
 assert(!card.memory.startsWith('C '));assert(card.memory.includes('→「錯誤敘述的完整內容」錯'));
 assert.deepEqual(card.options,q.options);assert.equal(q.memory,'C 先辨識條件→C錯');
});
test('supply formatting preserves scientific abbreviations, receptor labels and variables',()=>{
 const text='AUC、BCS、DNA、Vitamin D、維生素 A、D2 受體；C0=濃度。C是濃度；D為劑量。選AUC而不是其他指標。';
 for(const memory of ['AUC 與 BCS','B細胞與T細胞','D2 訊號','C0=初始濃度']) {
  const q={title:'學科名詞',question:'保留完整題目',options:['一','二','三','四'],answer:memory[0]==='B'?1:memory[0]==='D'?3:2,explanation:text,memory};
  const card=C.studyCard(q);assert.equal(card.explanation,text);assert.equal(card.memory,memory);
 }
});
test('numeric answer mnemonic loses option prefix without losing its calculation',()=>{
 const card=C.studyCard({title:'計算',question:'數值為何？',options:['1','2','7.52','8'],answer:2,explanation:'計算得7.52，選C。',memory:'C7.52μg/mL；7.5/[1−e^(−1.034×6)]'});
 assert.equal(card.memory,'7.52μg/mL；7.5/[1−e^(−1.034×6)]');assert(card.explanation.includes('選「7.52」'));
});
function player(){const s=E.fresh(day);s.arena=C.fresh(day);return s;}
function restore(s){const raw=JSON.parse(JSON.stringify(s)),out=E.restore(raw,qs);out.arena=C.restore(raw.arena,qs);return out;}
function run(s,mask,enemy='diamond',finishDay=day,startDay=day){
 assert(C.begin(s,enemy,'pharmaceutics',qs,()=>.3,startDay));
 for(let round=0;round<2;round++){
  assert(C.startRound(s.arena));
  for(let i=0;i<3;i++){const q=qs.find(q=>q.id===s.arena.battle.ids[round*3+i]);assert(C.answer(s,q,mask[round*3+i]?q.answer:(q.answer+1)%4,finishDay));assert(C.next(s,finishDay));}
  if(round===0){assert.equal(s.arena.battle.phase,'recap');assert(C.advance(s.arena));}
 }
 return s.arena.battle.result;
}
test('Lv1 without equipment can defeat the strongest enemy with knowledge',()=>{
 const s=player(),r=run(s,[1,1,1,1,1,1]);
 assert(r.win);assert.equal(r.damage,594);assert.equal(r.hp,39);assert.equal(r.correct,6);assert.equal(r.points,500);assert.equal(s.arena.battle.rounds.length,2);assert.equal(s.arena.coins,78);
 const before=JSON.stringify(s);assert.equal(C.next(s,day),false);assert.equal(JSON.stringify(s),before);
});
test('equipment and level increase power but zero correct answers means zero damage',()=>{
 const weak=C.heroStats(1,null,'pharmaceutics'),strong=C.heroStats(1,'pharmaceutics-3','pharmaceutics'),high=C.heroStats(20,'pharmaceutics-3','pharmaceutics');
 assert(strong.attack>weak.attack&&strong.hp>weak.hp);assert(high.attack>strong.attack);assert.equal(C.heroStats(99,'pharmaceutics-3','pharmaceutics').attack,high.attack);
 const s=player();s.xp=1900;s.equipped='pharmaceutics-3';s.inventory[s.equipped]=1;
 const r=run(s,[0,0,0,0,0,0]);assert.equal(r.damage,0);assert.equal(r.win,false);assert.equal(r.earnedCoins,0);
});
test('two full rounds are required even when first round already exceeds enemy endurance',()=>{
 const s=player();C.begin(s,'bronze','pharmaceutics',qs,()=>.2,day);C.startRound(s.arena);
 for(let i=0;i<3;i++){const q=qs.find(q=>q.id===s.arena.battle.ids[i]);C.answer(s,q,q.answer,day);C.next(s,day);}
 assert.equal(s.arena.battle.phase,'recap');assert(C.totals(s.arena.battle).damage>=160);assert.equal(s.arena.battle.result,null);assert.equal(C.score(s.arena),0);assert.equal(s.arena.coins,0);
});
test('supply is charged once per round, persists across reload, cannot be used after round starts',()=>{
 let s=player();s.arena.supplies=2;C.begin(s,'silver','pharmaceutics',qs,()=>.2,day);
 assert(C.useSupply(s.arena));assert.equal(s.arena.supplies,1);s=restore(s);assert(C.useSupply(s.arena));assert.equal(s.arena.supplies,1);
 C.startRound(s.arena);assert.equal(C.useSupply(s.arena),false);
 for(let i=0;i<3;i++){const q=qs.find(q=>q.id===s.arena.battle.ids[i]);C.answer(s,q,q.answer,day);C.next(s,day);}
 C.advance(s.arena);assert(C.useSupply(s.arena));assert.equal(s.arena.supplies,0);assert.deepEqual(s.arena.battle.prepared,[true,true]);
});
test('combat cannot be restarted or advanced illegally; submission is idempotent across reload',()=>{
 let s=player();C.begin(s,'bronze','pharmaceutics',qs,()=>.1,day);
 assert.equal(C.begin(s,'silver','pharmaceutics',qs,()=>.1,day),false);
 assert.equal(C.next(s,day),false);C.startRound(s.arena);
 const q=qs.find(q=>q.id===s.arena.battle.ids[0]);assert(C.answer(s,q,q.answer,day));s=restore(s);
 assert.equal(C.answer(s,q,q.answer,day),null);assert.equal(s.xp,10);assert.equal(C.advance(s.arena),false);
});
test('daily currency and equipment can be claimed separately without duplicate coin grants',()=>{
 const s=player();E.claim(s,day);assert.equal(C.claimCoins(s.arena,day),80);assert.equal(C.claimCoins(s.arena,day),0);
 assert.equal(C.claimCoins(s.arena,'2026-10-29'),80);assert.equal(s.arena.coins,160);
});
test('coin shop purchases exact quantities, rejects insufficient funds and unknown items',()=>{
 const s=player();s.arena.coins=100;assert(C.buy(s,'supply-3'));assert.equal(s.arena.coins,0);assert.equal(s.arena.supplies,3);
 assert.equal(C.buy(s,'supply-1'),false);assert.equal(C.buy(s,'bogus'),false);assert.equal(s.arena.coins,0);
 s.arena.coins=120;assert(C.buy(s,'wish-1'));assert.equal(s.tickets,1);assert.equal(s.arena.coins,0);
});
test('daily best points award only the improvement, with no repeat farming',()=>{
 const s=player();const first=run(s,[1,0,0,1,0,0],'bronze');assert.equal(first.points,40);assert.equal(first.earnedCoins,6);
 const equal=run(s,[1,0,0,1,0,0],'bronze');assert.equal(equal.earnedPoints,0);assert.equal(equal.earnedCoins,0);
 const better=run(s,[1,1,1,1,1,1],'bronze');assert.equal(better.points,280);assert.equal(better.earnedPoints,240);assert.equal(better.earnedCoins,27);assert.equal(C.score(s.arena),280);assert.equal(s.arena.coins,33);
 const after=run(s,[0,0,0,0,0,0],'bronze');assert.equal(after.earnedPoints,0);assert.equal(C.score(s.arena),280);
});
test('Taipei Monday boundaries, season reset, history and one-time reward',()=>{
 assert.equal(C.weekId(E.today(new Date('2026-11-01T15:59:59Z'))),'2026-10-26');
 assert.equal(C.weekId(E.today(new Date('2026-11-01T16:00:00Z'))),'2026-11-02');
 assert.equal(C.weekId('2027-01-01'),'2026-12-28');
 const s=player();run(s,[1,1,1,1,1,1]);const coins=s.arena.coins;
 assert(C.rollWeek(s.arena,'2026-11-02'));assert.equal(s.arena.coins,coins+60);assert.equal(C.score(s.arena),0);assert.equal(s.arena.history[0].points,500);
 assert.equal(C.rollWeek(s.arena,'2026-11-03'),false);assert.equal(C.rollWeek(s.arena,day),false);assert.equal(s.arena.coins,coins+60);
 assert.deepEqual(restore(s),s);
});
test('a previous-week unfinished battle cannot score in the next season',()=>{
 const s=player(),r=run(s,[1,1,1,1,1,1],'diamond','2026-11-02',day);
 assert.equal(r.eligible,false);assert.equal(r.earnedPoints,0);assert.equal(r.earnedCoins,0);assert.equal(C.score(s.arena),0);assert(r.win);assert.deepEqual(restore(s),s);
});
test('restore old saves adds zeroed new systems while preserving old progress',()=>{
 const old=E.fresh(day);old.xp=543;old.tickets=9;old.inventory['herbal-3']=1;old.equipped='herbal-3';
 const s=restore(old);assert.equal(s.xp,543);assert.equal(s.tickets,9);assert.equal(s.equipped,'herbal-3');assert.equal(s.arena.coins,0);assert.equal(s.arena.battle,null);
});
test('battle restore validates money, supply state, answers, records and exact phases',()=>{
 const s=player();run(s,[1,1,1,1,1,1]);assert.deepEqual(restore(s),s);
 const changes=[a=>a.coins=-1,a=>a.supplies=1.5,a=>a.week.id='2026-02-30',a=>a.week.records['2026-10-28:diamond'].points=999,a=>a.battle.phase='prep',a=>a.battle.prepared=[true],a=>a.battle.ids[0]='unknown',a=>a.battle.answers[0].correct=false,a=>a.battle.result.earnedCoins=999];
 for(const change of changes){const raw=JSON.parse(JSON.stringify(s.arena));change(raw);assert.throws(()=>C.restore(raw,qs));}
});
