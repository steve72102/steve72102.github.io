const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const L=require('../game/lesson.js'),E=require('../game/engine.js'),C=require('../game/combat.js'),D=require('../game/duel.js'),A=require('../game/academy.js');
const ctx={window:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../game/bank.js'),'utf8'),ctx);const bank=ctx.window.MIND_BANK,qs=Array.from(bank.questions);
test('all 3221 explanations render full answer content and readable paragraphs',()=>{
  assert.equal(qs.length,3221);
  for(const q of qs){const c=L.card(q);assert.equal(c.answer,q.options[q.answer]);assert.ok(c.paragraphs.length);assert.ok(c.memory);assert.ok(!c.paragraphs.join('').includes('AI新擬'));assert.equal(c.options.length,4);}
});
test('scientific symbols and numeric decimals survive paragraph formatting',()=>{
  const input='① k=0.02554 day⁻¹，AUC、BCS、D2、維生素 D。\n② t½=27.1 天。';
  assert.deepEqual(L.paragraphs(input),['① k=0.02554 day⁻¹，AUC、BCS、D2、維生素 D。','② t½=27.1 天。']);
});
test('negative wording keeps the wrong statement tied to the question',()=>{
  const c=L.card({title:'辨識題意',question:'何者不正確？',options:['受體','錯誤敘述','BCS','D2'],answer:1,explanation:'選B。AUC不變。',memory:'B 錯誤敘述'});
  assert.ok(c.negative);assert.match(c.pitfall,/不一定是正確/);assert.match(c.paragraphs.join(''),/「錯誤敘述」/);assert.match(c.paragraphs.join(''),/AUC/);
});
test('90 semantic reviews yield 84 rewritten and six flagged records',()=>{
  const reviewed=qs.filter(q=>q.focus);assert.equal(reviewed.length,90);assert.equal(reviewed.filter(q=>q.needsReview).length,6);assert.equal(bank.lessonReview.rewritten,84);
  assert.ok(reviewed.filter(q=>!q.needsReview).every(q=>q.explanation.length>=90&&q.memory&&q.pitfall));
});
test('new solo, building, monster and duel draws omit pending-review questions',()=>{
  for(const subject of Object.keys(E.SUBJECTS)){
    const set=qs.filter(q=>q.subject===subject),s=Object.assign(E.fresh(),{arena:C.fresh()});
    E.begin(s,set,'test',()=>.2);assert.ok(s.session.ids.every(id=>!qs.find(q=>q.id===id).needsReview));
    assert.ok(C.begin(s,'bronze',subject,qs,()=>.2));assert.ok(s.arena.battle.ids.every(id=>!qs.find(q=>q.id===id).needsReview));
    const conf=D.create(subject,qs,()=>.2);assert.ok(conf.ids.every(id=>!qs.find(q=>q.id===id).needsReview));
    assert.ok(A.pool(qs,subject,'practice').every(q=>!q.needsReview));
  }
  const s=E.fresh();assert.equal(E.begin(s,qs.filter(q=>q.needsReview),'pending'),false);assert.equal(s.session,null);
});
test('incoming duel cannot reintroduce a pending question',()=>{
  const conf=D.create('herbal',qs,()=>.2);conf.ids[0]=qs.find(q=>q.needsReview&&q.subject==='herbal').id;conf.profile={name:'測試',level:1,gearId:null};assert.throws(()=>D.match(conf,qs,'herbal'));
});
test('old save question IDs remain recoverable after content review',()=>{
  const s=E.fresh();s.wrong=qs.filter(q=>q.needsReview).map(q=>q.id);assert.deepEqual(E.restore(s,qs).wrong,s.wrong);
});
test('each building has exactly one university style and local art',()=>{
  assert.deepEqual(A.BUILDINGS.map(b=>b.school),['臺大','清大','成大','清大','成大']);assert.ok(A.BUILDINGS.every(b=>/^hall-(ntu|nthu|ncku|battle|life)\.webp$/.test(b.hall)));
});
