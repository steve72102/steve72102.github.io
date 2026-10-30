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
test('every question received a clarity review and pending records match the audit',()=>{
  const audit=JSON.parse(fs.readFileSync(require.resolve('./clarity-review-audit.json'),'utf8'));
  assert.equal(bank.lessonReview.reviewed,3221);assert.equal(audit.reviewed,3221);
  assert.deepEqual(new Set(audit.reviewedIds),new Set(qs.map(q=>q.id)));
  assert.equal(qs.filter(q=>q.needsReview).length,bank.lessonReview.pending);
  assert.equal(bank.lessonReview.clarityEdited,audit.changedIds.length);
  for(const id of audit.changedIds){const q=qs.find(q=>q.id===id);assert.ok(q.explanation.trim()&&q.memory.trim());}
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
  assert.deepEqual(A.BUILDINGS.map(b=>b.school),['臺大','清大','成大','清大','成大']);assert.ok(A.BUILDINGS.every(b=>/^hall-(ntu|nthu(?:-interactive)?|ncku|battle|life)\.webp$/.test(b.hall)));
});

test('target explanations define ring nitrogen without depending on shuffled questions',()=>{
  const q=qs.find(q=>q.id==='pharmacology-115-2-65');assert.match(q.explanation,/氮原子/);assert.match(q.explanation,/共用一條邊/);assert.doesNotMatch(q.explanation,/Q53|先圈共同骨架/);assert.equal(L.card(q).diagrams[0].id,'ring-nitrogen');
  const statin=qs.find(q=>q.id==='pharmacology-115-2-63');assert.doesNotMatch(statin.explanation,/Q47|合併回想/);assert.match(statin.explanation,/COOH/);
  assert.match(qs.find(q=>q.id==='pharmaceutics-112-2-2').question,/^0\.9% NaCl/);
  assert.equal(qs.find(q=>q.id==='herbal-112-2-62').options[3],'Strychnos castelnaei－降血糖');
});

test('lesson figures only resolve trusted local files with accessible text and offline assets',()=>{
  const diagrams=require('../game/lesson-diagrams.js'),sw=fs.readFileSync(require.resolve('../game/sw.js'),'utf8');
  for(const q of qs)for(const id of q.diagrams||[]){const d=diagrams.get(id);assert.ok(d,id);assert.ok(fs.existsSync(require('node:path').join(__dirname,'../game',d.src)));assert.ok(d.alt.length>25&&d.caption);assert.ok(sw.includes("'"+id+"'"));}
  const c=L.card({...qs[0],diagrams:['../../secret','https://evil.example/x.svg','__proto__','ring-nitrogen','ring-nitrogen']});assert.equal(c.diagrams.length,0);
  const safe=L.card({...qs[0],diagrams:['ring-nitrogen','ring-nitrogen']});assert.equal(safe.diagrams.length,1);
  assert.equal(diagrams.get('__proto__'),null);
});

test('pending-review cards do not present their old mnemonic as established knowledge',()=>{
  const node=(tag,attrs,...children)=>({tag,attrs,children:children.flat(Infinity)});
  const rendered=JSON.stringify(L.render({...qs[0],needsReview:true,memory:'UNVERIFIED_MNEMONIC'},node));
  assert.match(rendered,/原筆記選項（尚待確認）/);assert.match(rendered,/暫時不要背成定論/);assert.doesNotMatch(rendered,/UNVERIFIED_MNEMONIC/);
});
