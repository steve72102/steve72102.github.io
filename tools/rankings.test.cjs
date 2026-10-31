const test=require('node:test'),assert=require('node:assert/strict'),P=require('../game/social-economy.js'),R=require('../game/rankings.js');
const today=R.week(P.day())+3,A='a'.repeat(32);
const entry=(slot,points,achievedAt=1000)=>({week:R.week(today),slot,points,key:slot.toString(16).padStart(32,'0'),name:'旅人'+slot,achievedAt});
test('四張地區券各 1000；14 天 +15%，同類不疊加，屆滿恢復',()=>{
 let w=P.freshWallet(4000,'旅人',today);
 for(const region of Object.keys(P.REGIONS)){w=P.purchase(w,region);assert.equal(w.stock[region],1);}
 assert.equal(w.coins,0);w=P.useHonor(w,'north',today);assert.equal(P.factor(w),115);
 w=P.useHonor(w,'east',today);assert.equal(P.factor(w),115);assert.equal(P.activeHonor(w).title,'自以為東部最聰明');
 assert.equal(P.earn(w,100).cash,115);assert.equal(P.factor(P.roll(w,today+13)),115);assert.equal(P.factor(P.roll(w,today+14)),100);
 assert.equal(P.roll(w,today+14).stock.central,1);assert.equal(P.validate(JSON.parse(JSON.stringify(w))).honor.region,'east');
 assert.throws(()=>P.purchase(w,'constructor'));assert.throws(()=>P.useHonor(w,'toString',today));
});
test('冠軍 21 天 35/30/25/20%，不疊商城加成；錯誤或較低獎勵不覆蓋較高稱號',()=>{
 for(const [tier,bonus]of Object.entries(P.CROWN_BONUS)){let w=P.freshWallet(1000,'旅人',today);w=P.useHonor(P.purchase(w,'north'),'north',today);w=P.crown(w,{region:'south',tier,week:R.week(today)-7},today);assert.equal(P.factor(w),100+bonus);assert.equal(P.activeHonor(w).title,'南部最聰明');assert.equal(P.factor(P.roll(w,today+20)),100+bonus);assert.equal(P.factor(P.roll(w,today+21)),100);}
 let w=P.crown(P.freshWallet(0,'旅人',today),{region:'north',tier:'diamond',week:R.week(today)-7},today);assert.throws(()=>P.crown(w,{region:'east',tier:'bronze',week:R.week(today)-14},today));assert.throws(()=>P.crown(w,{region:'north',tier:'constructor',week:0},today));
 w.stock.east=1;assert.throws(()=>P.useHonor(w,'east',today));assert.equal(w.stock.east,1);
});
test('稱號與既有減益、反霸凌、欠款協同，最低仍為 30%',()=>{
 let w=P.crown(P.freshWallet(0,'旅人',today),{region:'central',tier:'diamond',week:R.week(today)-7},today);w.penalty=104;w.debt=20;w.stock.counter=1;
 let actor=P.freshWallet(0,'另一人',today);actor.stock.bully=1;const hit=P.bully(actor,w,{actorKey:A,targetKey:'b'.repeat(32)});assert.equal(hit.target.penalty,105);assert.equal(P.factor(hit.target),30);
 w=P.counter(hit.target);assert.equal(P.factor(w),135);assert.equal(w.debt,20);const e=P.earn(w,100);assert.deepEqual([e.gross,e.paid,e.cash],[135,20,115]);
});
test('週期依台北星期一切換，按最後積分分組，先達同分者優先',()=>{
 assert.equal(R.date(R.week(P.day(Date.parse('2026-11-01T15:59:59Z')))),'2026-10-26');
 assert.equal(R.date(R.week(P.day(Date.parse('2026-11-01T16:00:00Z')))),'2026-11-02');
 const rows=[entry(1,599),entry(2,600),entry(3,1800),entry(4,3600),entry(5,3600,999),entry(6,3600,999)];
 const best=R.leaders(rows);assert.equal(best.bronze.slot,1);assert.equal(best.silver.slot,2);assert.equal(best.gold.slot,3);assert.equal(best.diamond.slot,5);
});
test('結算必須依完整名單逐筆推進，不能跳人、提前完成或重播完成結果',()=>{
 const season=R.week(today),rows=[entry(1,100),entry(2,800),entry(3,2000),entry(4,4000),entry(5,5000),entry(6,1900)];
 let result=R.finalize(null,rows.slice(0,4),6,season);assert.equal(result.finished,false);assert.equal(result.cursor,4);assert.equal(result.leaders.diamond.slot,4);
 assert.throws(()=>R.finalize(result,[rows[5]],6,season));assert.throws(()=>R.finalize(result,[],6,season));
 result=R.finalize(result,rows.slice(4),6,season);assert.equal(result.finished,true);assert.equal(result.leaders.diamond.slot,5);assert.equal(result.leaders.gold.slot,3);
 assert.throws(()=>R.finalize(result,[],6,season));
});
