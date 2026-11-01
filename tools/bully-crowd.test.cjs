'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),P=require('../game/social-economy.js');
const A='a'.repeat(32),B='b'.repeat(32),C='c'.repeat(32),OP='0'.repeat(32),TODAY=20000;
const wallet=()=>P.freshWallet(1000,'參與人數測試',TODAY);
const group=count=>({schema:1,day:TODAY,target:B,count,operationId:OP});
const member=(actor=A)=>({schema:1,day:TODAY,target:B,actor,operationId:OP});
const plan=(g,m,extra={})=>P.crowdPlan(g,m,{day:TODAY,actorKey:A,targetKey:B,...extra});

for(const [count,bonus] of [[2,0],[3,1],[5,1],[6,2],[8,2],[9,3],[60,20]]){
  test('第 '+count+' 位不同施放者：當張雙方額外 '+bonus+' 個百分點',()=>{
    const g=group(count-1),before=JSON.stringify(g),p=plan(g,null),a=wallet(),b=wallet();a.stock.bully=1;
    assert.deepEqual(p,{crowd:TODAY+'_'+B,crowdMember:TODAY+'_'+B+'_'+A,crowdCount:count,crowdBonus:bonus,crowdNew:true});
    const r=P.bully(a,b,{actorKey:A,targetKey:B,crowdCount:p.crowdCount});
    assert.equal(r.step,1);assert.equal(r.used,1);assert.equal(r.crowdCount,count);assert.equal(r.crowdBonus,bonus);assert.equal(r.actor.bonus,2+bonus);assert.equal(r.target.penalty,1+bonus);assert.equal(r.actor.stock.bully,0);
    assert.equal(a.stock.bully,1);assert.equal(a.bonus,0);assert.equal(b.penalty,0);assert.equal(JSON.stringify(g),before);
  });
}

test('同帳號重複使用不增加人數，仍依原連用強度及每人三張限制',()=>{
  const g=group(3),m=member(),before=JSON.stringify([g,m]);let a=wallet(),b=wallet();a.stock.bully=4;
  for(let used=0;used<3;used++){
    const p=plan(g,m);assert.equal(p.crowdCount,3);assert.equal(p.crowdBonus,1);assert.equal(p.crowdNew,false);
    const r=P.bully(a,b,{actorKey:A,targetKey:B,used,crowdCount:p.crowdCount});assert.equal(r.step,used+1);a=r.actor;b=r.target;
  }
  assert.equal(a.bonus,12);assert.equal(b.penalty,9);assert.equal(a.stock.bully,1);assert.throws(()=>P.bully(a,b,{actorKey:A,targetKey:B,used:3,crowdCount:3}),/三次/);assert.equal(JSON.stringify([g,m]),before);
});

test('六十個不同帳號各只登記一次，既有成員重試保留人數',()=>{
  let g=null;const members=new Map();
  for(let i=1;i<=60;i++){
    const key=i.toString(16).padStart(32,'0'),p=plan(g,null,{actorKey:key});assert.equal(p.crowdCount,i);assert.equal(p.crowdBonus,Math.floor(i/3));
    g=group(p.crowdCount);members.set(key,member(key));
    const again=plan(g,members.get(key),{actorKey:key});assert.equal(again.crowdCount,i);assert.equal(again.crowdNew,false);
  }
  for(const [key,m] of members){const p=plan(g,m,{actorKey:key});assert.equal(p.crowdCount,60);assert.equal(p.crowdBonus,20);}
});

test('增加第三位只影響當張，不回算前一位的加成或既有減益',()=>{
  const a=wallet(),c=wallet();a.stock.bully=1;c.stock.bully=1;
  const earlier=P.bully(a,wallet(),{actorKey:A,targetKey:B,crowdCount:2}),before=JSON.stringify(earlier);
  const next=P.bully(c,earlier.target,{actorKey:C,targetKey:B,crowdCount:3});
  assert.equal(earlier.actor.bonus,2);assert.equal(next.actor.bonus,3);assert.equal(next.target.penalty,3);assert.equal(JSON.stringify(earlier),before);
});

test('反霸凌只清現有減益，保留加成、欠款及今日不同施放者計數',()=>{
  const g=group(6),m=member(),ledgerBefore=JSON.stringify([g,m]),b=wallet(),a=wallet();
  Object.assign(b,{bonus:9,penalty:44,debt:19,usedCounters:5});b.stock.counter=1;a.stock.bully=1;
  const cleared=P.counter(b,12345);assert.equal(cleared.penalty,0);assert.equal(cleared.bonus,9);assert.equal(cleared.debt,19);assert.equal(cleared.usedCounters,6);assert.equal(cleared.bubbleAt,12345);
  const p=plan(g,m),hit=P.bully(a,cleared,{actorKey:A,targetKey:B,crowdCount:p.crowdCount});assert.equal(p.crowdCount,6);assert.equal(hit.target.penalty,3);assert.equal(hit.actor.bonus,4);assert.equal(JSON.stringify([g,m]),ledgerBefore);
});

test('臺灣午夜使用新群組及成員識別，舊日資料不能混入新日',()=>{
  const before=P.day(Date.parse('2026-11-01T15:59:59.999Z')),after=P.day(Date.parse('2026-11-01T16:00:00.000Z'));
  assert.equal(after,before+1);
  const g={...group(9),day:before},m={...member(),day:before},old=plan(g,m,{day:before}),fresh=plan(null,null,{day:after});
  assert.equal(old.crowdCount,9);assert.equal(fresh.crowdCount,1);assert.equal(fresh.crowdBonus,0);assert.notEqual(fresh.crowd,old.crowd);assert.notEqual(fresh.crowdMember,old.crowdMember);assert.throws(()=>plan(g,m,{day:after}),/紀錄/);
});

test('收益最低30%，加成上限及失敗皆不消耗券或修改傳入紀錄',()=>{
  const a=wallet(),b=wallet(),g=group(60),m=member();a.stock.bully=1;b.penalty=70;
  const original=JSON.stringify([a,b,g,m]);assert.throws(()=>P.bully(a,b,{actorKey:A,targetKey:B,crowdCount:60}),/上限/);assert.equal(JSON.stringify([a,b,g,m]),original);
  b.bonus=9;b.honor={region:'north',start:TODAY,until:TODAY+14};b.penalty=93;
  const clamped=P.bully(a,b,{actorKey:A,targetKey:B,crowdCount:60});assert.equal(P.factor(clamped.target),30);assert.equal(clamped.target.penalty,94);assert.equal(clamped.actor.bonus,22);
  a.bonus=9998;b.penalty=0;const upper=JSON.stringify([a,b]);assert.throws(()=>P.bully(a,b,{actorKey:A,targetKey:B,crowdCount:3}),/上限/);assert.equal(JSON.stringify([a,b]),upper);assert.equal(P.bully(a,b,{actorKey:A,targetKey:B,crowdCount:2}).actor.bonus,10000);
});

test('拒絕不安全人數、錯誤識別、未知欄位與無群組的孤兒成員',()=>{
  const a=wallet(),b=wallet();a.stock.bully=1;const before=JSON.stringify([a,b]);
  for(const count of [0,-1,1.5,'3',NaN,Infinity,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>P.bully(a,b,{actorKey:A,targetKey:B,crowdCount:count}),/人數/);
  for(const g of [[],{},group(0),group(-1),group(1.5),group(Number.MAX_SAFE_INTEGER+1),{...group(2),schema:2},{...group(2),target:C},{...group(2),day:TODAY-1},{...group(2),operationId:'not-an-id'},{...group(2),uid:'private-account'}])assert.throws(()=>plan(g,null));
  for(const m of [[],{},member(C),{...member(),schema:2},{...member(),target:C},{...member(),day:TODAY-1},{...member(),operationId:'A'.repeat(32)},{...member(),uid:'private-account'}])assert.throws(()=>plan(group(2),m));
  assert.throws(()=>plan(null,member()));assert.throws(()=>plan(null,null,{actorKey:B}));assert.throws(()=>plan(null,null,{day:-1}));assert.throws(()=>plan(null,null,{actorKey:'invalid'}));assert.equal(JSON.stringify([a,b]),before);
});

test('群組人數不能溢位；既有成員可讀取安全整數上限但效果上限仍禁止使用',()=>{
  const g=group(Number.MAX_SAFE_INTEGER),m=member(),before=JSON.stringify([g,m]);assert.throws(()=>plan(g,null),/上限/);
  const p=plan(g,m);assert.equal(p.crowdCount,Number.MAX_SAFE_INTEGER);assert(Number.isSafeInteger(p.crowdBonus));
  const a=wallet();a.stock.bully=1;assert.throws(()=>P.bully(a,wallet(),{actorKey:A,targetKey:B,crowdCount:p.crowdCount}),/上限/);assert.equal(a.stock.bully,1);assert.equal(JSON.stringify([g,m]),before);
});


test('切換目標只重置連用強度，回到原目標仍用當天人數及既有配額',()=>{
  const a=wallet();a.stock.bully=3;
  const first=P.bully(a,wallet(),{actorKey:A,targetKey:B,crowdCount:3});
  const other=P.bully(first.actor,wallet(),{actorKey:A,targetKey:C,crowdCount:6});assert.equal(other.step,1);assert.equal(other.crowdBonus,2);
  const again=P.bully(other.actor,first.target,{actorKey:A,targetKey:B,used:1,crowdCount:plan(group(3),member()).crowdCount});
  assert.equal(again.step,1);assert.equal(again.used,2);assert.equal(again.crowdCount,3);assert.equal(again.actor.bonus,10);assert.equal(again.target.penalty,4);assert.equal(again.actor.stock.bully,0);
});
