const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../game/engine.js'),D=require('../game/duel.js');
const q=Array.from({length:8},(_,i)=>({id:'q'+i,subject:'pharmaceutics',answer:i%4}));
const a={name:'旅人一',level:1,gearId:null},b={name:'旅人二',level:20,gearId:E.ITEMS.find(x=>x.tier===3).id};
const config={...D.create('pharmaceutics',q,()=>0.3),profile:a};
function fresh(){return D.fresh(config,a,b);}
function question(s,c0,c1){const current=q.find(x=>x.id===s.ids[s.index]);assert.ok(D.commit(s,0,'a'.repeat(64),s.index));assert.ok(D.commit(s,1,'b'.repeat(64),s.index));assert.ok(D.reveal(s,0,c0===true?current.answer:c0,s.index));assert.ok(D.reveal(s,1,c1===true?current.answer:c1,s.index));assert.ok(D.settleQuestion(s,current));}
test('match checks bank version, subject and six unique known question IDs',()=>{
  assert.equal(D.match(config,q,'pharmaceutics').ids.length,6);
  for(const bad of [{...config,bank:'old'},{...config,ids:Array(6).fill('q1')},{...config,ids:['x',...config.ids.slice(1)]},{...config,subject:'herbal'}])assert.throws(()=>D.match(bad,q,'pharmaceutics'));
});
test('profile accepts readable names and rejects HTML and forged numeric stats',()=>{
  assert.deepEqual(D.profile(a),{...a,appearance:require('../game/academy.js').fresh(),loadout:require('../game/adventure.js').loadout(),training:{},shirkTickets:0,diligenceTickets:0});
  for(const bad of [{...a,name:'<img src=x>'},{...a,level:Infinity},{...a,level:0},{...a,gearId:'fake'},{...a,name:'x'.repeat(17)}])assert.throws(()=>D.profile(bad));
});
test('both players must be ready, and ready cannot be replayed',()=>{
  const s=fresh();assert.ok(D.ready(s,0));assert.equal(s.phase,'prep');assert.equal(D.ready(s,0),false);assert.equal(D.commit(s,0,'a'.repeat(64),0),false);assert.ok(D.ready(s,1));assert.equal(s.phase,'question');
});
test('answers require both commitments; duplicate and out-of-order submissions are rejected',()=>{
  const s=fresh();D.ready(s,0);D.ready(s,1);
  assert.equal(D.reveal(s,0,0,0),false);assert.equal(D.commit(s,0,'x',0),false);assert.equal(D.commit(s,0,'a'.repeat(64),1),false);
  assert.ok(D.commit(s,0,'a'.repeat(64),0));assert.equal(D.commit(s,0,'b'.repeat(64),0),false);assert.equal(D.reveal(s,0,0,0),false);
  D.commit(s,1,'b'.repeat(64),0);assert.equal(D.reveal(s,0,4,0),false);assert.ok(D.reveal(s,0,0,0));assert.equal(D.reveal(s,0,1,0),false);
});
test('question feedback and rewards settle only once and after both answers',()=>{
  const s=fresh();D.ready(s,0);D.ready(s,1);D.commit(s,0,'a'.repeat(64),0);D.commit(s,1,'b'.repeat(64),0);D.reveal(s,0,0,0);
  assert.equal(D.settleQuestion(s,q.find(x=>x.id===s.ids[0])),false);D.reveal(s,1,0,0);
  assert.ok(D.settleQuestion(s,q.find(x=>x.id===s.ids[0])));assert.equal(D.settleQuestion(s,q.find(x=>x.id===s.ids[0])),false);assert.equal(s.answers[0].length,1);
});
test('two full rounds; lower equipment can beat a stronger opponent with knowledge',()=>{
  const s=fresh();D.ready(s,0);D.ready(s,1);
  for(let i=0;i<6;i++){
    const current=q.find(x=>x.id===s.ids[i]);question(s,true,i<3?true:(current.answer+1)%4);
    assert.equal(s.phase,'feedback');assert.equal(D.winner(s),null);D.next(s,0);assert.equal(s.index,i);D.next(s,1);
    if(i===2){assert.equal(s.phase,'prep');assert.equal(s.round,1);D.ready(s,0);D.ready(s,1);}
  }
  assert.equal(s.phase,'done');assert.equal(D.winner(s),0);assert.deepEqual(s.rounds.map(r=>r.length),[2,2]);assert.equal(D.totals(s)[0],594);assert.equal(D.next(s,0),false);
});
test('equal equipment and answers produce a draw; zero correct causes zero damage',()=>{
  const s=D.fresh(config,a,a);D.ready(s,0);D.ready(s,1);
  for(let i=0;i<6;i++){const wrong=(q.find(x=>x.id===s.ids[i]).answer+1)%4;question(s,wrong,wrong);D.next(s,0);D.next(s,1);if(i===2){D.ready(s,0);D.ready(s,1);}}
  assert.deepEqual(D.totals(s),[0,0]);assert.equal(D.winner(s),'draw');
});
test('untrusted packets reject oversized, invalid and prototype-bearing data',()=>{
  for(const raw of [null,'x'.repeat(4097),'null','[]','{}','{"v":"'+D.VERSION+'","type":"ping","__proto__":{}}',JSON.stringify({v:D.VERSION,type:'giveCoins'})])assert.throws(()=>D.packet(raw));
  assert.equal(D.packet(JSON.stringify({v:D.VERSION,type:'ping'})).type,'ping');
});
test('commitment binds question index, choice and random nonce',()=>{
  const salt='a'.repeat(32);assert.notEqual(D.commitmentText(0,0,salt),D.commitmentText(1,0,salt));assert.notEqual(D.commitmentText(0,0,salt),D.commitmentText(0,1,salt));
  assert.throws(()=>D.commitmentText(0,4,salt));assert.throws(()=>D.commitmentText(0,0,'short'));
});

function withCoupons(){return D.fresh(config,{...a,shirkTickets:6,diligenceTickets:2},{...a,name:'旅人二',shirkTickets:6,diligenceTickets:2});}
test('delegated copy and original score separately in either hidden order; wrong extras score zero',()=>{
  for(const order of [0,1])for(const ownCorrect of [false,true])for(const extraCorrect of [false,true]){
    const s=withCoupons();D.ready(s,0);D.ready(s,1);assert(D.pass(s,0,order));assert.equal(D.pass(s,1,order),false);
    assert.equal(D.taskCount(s,0),0);assert.equal(D.taskCount(s,1),2);
    const correct=q.find(x=>x.id===s.ids[0]).answer,wrong=(correct+1)%4,list=[];
    list[order]=ownCorrect?correct:wrong;list[1-order]=extraCorrect?correct:wrong;
    question(s,[],list);assert.equal(s.answers[0][0].correct,extraCorrect);assert.equal(s.answers[1][0].correct,ownCorrect);
    assert.equal(D.diligenceBonus(s,1).correct,Number(extraCorrect));
    assert.equal(D.diligenceBonus(s,1).damage,extraCorrect?84:0);
    assert.equal(D.diligenceBonus(s,0).damage,0);
  }
});
test('three transfers each round, six total; extra answers required, passbacks and replays rejected',()=>{
  const s=withCoupons();D.ready(s,0);D.ready(s,1);
  for(let i=0;i<6;i++){
    assert(D.pass(s,0,i%2));assert.equal(D.pass(s,0,0),false);assert.equal(D.pass(s,1,0),false);
    assert.equal(s.passUsed[0],i%3+1);const correct=q.find(x=>x.id===s.ids[i]).answer;
    question(s,[],[correct,correct]);D.next(s,0);D.next(s,1);if(i===2){assert.equal(s.passUsed[0],0);D.ready(s,0);D.ready(s,1);}
  }
  assert.equal(s.passTotal[0],6);assert.equal(D.totals(s)[0],D.totals(s)[1]);
  const empty=fresh();D.ready(empty,0);D.ready(empty,1);assert.equal(D.canPass(empty,0),false);
  const bad=withCoupons();D.ready(bad,0);D.ready(bad,1);D.pass(bad,0,0);D.commit(bad,0,'a'.repeat(64),0);D.commit(bad,1,'b'.repeat(64),0);
  assert.equal(D.reveal(bad,0,1,0),false);assert.equal(D.reveal(bad,1,[0],0),false);assert.equal(D.reveal(bad,1,[0,1,2],0),false);
});
test('diligence counts only correct extras from both rounds, once at final submission, retains opponent score',()=>{
  const s=withCoupons();D.ready(s,0);D.ready(s,1);assert.equal(D.canDiligence(s,1),false);
  for(let i=0;i<6;i++){
    const correct=q.find(x=>x.id===s.ids[i]).answer,wrong=(correct+1)%4;D.pass(s,0,0);question(s,[],[correct,i===0||i===3?correct:wrong]);
    if(i<5){D.next(s,0);D.next(s,1);if(i===2){D.ready(s,0);D.ready(s,1);}}
  }
  const before=D.totals(s);assert.equal(D.diligenceBonus(s,1).correct,2);assert.equal(D.diligenceBonus(s,1).damage,168);
  assert(D.activateDiligence(s,1));assert.equal(D.activateDiligence(s,1),false);
  assert.deepEqual(D.totals(s),[before[0],before[1]+168]);D.next(s,1);assert.equal(D.canDiligence(s,1),false);D.next(s,0);
  assert.equal(s.phase,'done');assert.equal(D.activateDiligence(s,0),false);
});
test('all wrong extras cannot activate diligence and give zero bonus even when original answers are correct',()=>{
  const s=withCoupons();D.ready(s,0);D.ready(s,1);
  for(let i=0;i<6;i++){const correct=q.find(x=>x.id===s.ids[i]).answer;D.pass(s,0,1);question(s,[],[(correct+1)%4,correct]);if(i<5){D.next(s,0);D.next(s,1);if(i===2){D.ready(s,0);D.ready(s,1);}}}
  assert.deepEqual(D.diligenceBonus(s,1),{correct:0,damage:0});assert.equal(D.canDiligence(s,1),false);assert.equal(D.activateDiligence(s,1),false);
  assert.deepEqual(D.totals(s),[0,594]);
});
