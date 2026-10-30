const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=name=>JSON.parse(fs.readFileSync(path.join(__dirname,name),'utf8'));
const ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../game/bank.js'),'utf8'),ctx);
const bank=ctx.window.MIND_BANK,qs=Array.from(bank.questions),official=read('official-answer-audit.json');
const audit=read('factual-review-audit.json');

test('all three subjects have complete non-overlapping second-review dispositions',()=>{
  for(const subject of ['pharmaceutics','pharmacology','herbal']){
    const expected=new Set(qs.filter(q=>q.subject===subject).map(q=>q.id)),r=read('factual-review-'+subject+'.json');
    assert.deepEqual(new Set(r.reviewedIds),expected);assert.equal(r.reviewedIds.length,expected.size);
    const changed=new Set(r.entries.map(e=>e.id));assert.equal(changed.size,r.entries.length);
    assert.ok(r.unchangedIds.every(id=>!changed.has(id)));
    assert.deepEqual(new Set([...r.unchangedIds,...changed]),expected);
    assert.deepEqual(new Set(r.coverage.map(q=>q.id)),expected);
    assert.equal(r.coverage.length,expected.size);
    assert.ok(r.coverage.every(q=>['unchanged','patch','pending'].includes(q.disposition)));
  }
  assert.equal(audit.reviewed,3221);assert.deepEqual(new Set(audit.reviewedIds),new Set(qs.map(q=>q.id)));
});

test('every scoring key matches an independently downloaded official answer document',()=>{
  const byId=new Map(official.questions.map(q=>[q.id,q]));
  for(const q of qs){
    const key=byId.get(q.id);assert.equal(key.status,'match',q.id);assert.equal(key.officialAnswer,'ABCD'[q.answer],q.id);
    assert.equal(q.officialKey.answer,q.answer);assert.equal(q.officialKey.url,key.source);
    const doc=official.documents.find(d=>d.url===key.source);assert.ok(doc?.available,q.id);assert.match(doc.sha256,/^[a-f0-9]{64}$/);assert.equal(doc.answers.length,80);
    if(doc.answers[q.number-1]==='#')assert.match(key.amendmentNote,new RegExp('第'+q.number+'題答'+key.officialAnswer+'給分'));
    else assert.equal(doc.answers[q.number-1],key.officialAnswer);
  }
  assert.equal(new Set(qs.map(q=>q.subject+'-'+q.exam)).size,47);
  assert.equal(byId.get('pharmaceutics-111-2-68').officialAnswer,'B');
  assert.equal(bank.factualReview.officialAnswersMatched,3221);
});

test('pending content remains excluded even when its official answer is known',()=>{
  const E=require('../game/engine.js'),C=require('../game/combat.js'),D=require('../game/duel.js');
  assert.equal(D.BANK,bank.version);
  assert.deepEqual(new Set(qs.filter(q=>q.needsReview).map(q=>q.id)),new Set(audit.pendingIds));
  assert.equal(bank.factualReview.pending,audit.pendingIds.length);
  for(const subject of Object.keys(E.SUBJECTS)){
    const rows=qs.filter(q=>q.subject===subject),s=Object.assign(E.fresh(),{arena:C.fresh()});
    E.begin(s,rows,'review',()=>.85);assert.ok(s.session.ids.every(id=>!qs.find(q=>q.id===id).needsReview));
    C.begin(s,'bronze',subject,qs,()=>.85);assert.ok(s.arena.battle.ids.every(id=>!qs.find(q=>q.id===id).needsReview));
    const duel=D.create(subject,qs,()=>.85);assert.ok(duel.ids.every(id=>!qs.find(q=>q.id===id).needsReview));
  }
});
