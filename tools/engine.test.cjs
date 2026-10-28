const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const E = require('../game/engine.js');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname, '../game/bank.js'), 'utf8'), context);
const bank = JSON.parse(JSON.stringify(context.window.MIND_BANK));
const qs = bank.questions;
test('question bank contains unique complete questions with single answers', () => {
  assert.equal(new Set(qs.map(q => q.id)).size, qs.length);
  for (const q of qs) {
    assert(q.question && q.explanation && q.source && q.title);
    assert.equal(q.options.length, 4);
    assert(q.options.every(x => typeof x === 'string' && x.length));
    assert(Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 3);
  }
});
test('Taipei daily rollover; daily gear cannot be claimed twice', () => {
  assert.equal(E.today(new Date('2026-10-27T15:59:59Z')), '2026-10-27');
  assert.equal(E.today(new Date('2026-10-27T16:00:00Z')), '2026-10-28');
  const s = E.fresh('2026-10-27');
  assert(E.claim(s, '2026-10-27')); assert.equal(E.claim(s, '2026-10-27'), null);
  assert(E.claim(s, '2026-10-28'));
  assert.equal(Object.values(s.inventory).reduce((a,b)=>a+b,0), 2);
});
test('five distinct correct answers earn one ticket, repeated questions cannot farm', () => {
  const s = E.fresh('2026-10-28');
  for (const q of qs.slice(0, 4)) E.reward(s, q, true, '2026-10-28');
  assert.equal(s.progress, 4); assert.equal(s.tickets, 0);
  assert.equal(E.reward(s, qs[0], true, '2026-10-28').repeated, true);
  assert.equal(s.progress, 4);
  E.reward(s, qs[4], true, '2026-10-28');
  assert.equal(s.tickets, 1); assert.equal(s.progress, 0); assert.equal(s.xp, 50);
  E.reward(s, qs[0], true, '2026-10-29'); assert.equal(s.progress, 1);
});
test('ticket progress survives midnight, mistakes enter and leave review', () => {
  const s = E.fresh('2026-10-28');
  E.reward(s, qs[0], false, '2026-10-28'); assert.deepEqual(s.wrong, [qs[0].id]);
  E.reward(s, qs[0], true, '2026-10-28'); assert.deepEqual(s.wrong, []);
  E.rollDay(s, '2026-10-29'); assert.equal(s.progress, 1); assert.deepEqual(s.rewarded, []);
});
test('equipment bonus applies only to its subject', () => {
  const s = E.fresh(); s.equipped = 'pharmacology-3'; s.inventory[s.equipped] = 1;
  assert.equal(E.reward(s, qs.find(q => q.subject === 'pharmacology'), true).xp, 16);
  assert.equal(E.reward(s, qs.find(q => q.subject === 'herbal'), true).xp, 10);
});
test('draw cannot run without ticket; exact tiers; 30th draw guaranteed; duplicates convert to XP', () => {
  const s = E.fresh(); assert.equal(E.draw(s), null); s.tickets = 35;
  for (let i = 0; i < 29; i++) assert.equal(E.draw(s, () => 0).item.tier, 0);
  assert.equal(s.pity, 29); const result = E.draw(s, () => 0);
  assert.equal(result.item.tier, 3); assert.equal(s.pity, 0); assert(result.guaranteed);
  const seq = [0.6, 0.9, 0.99];
  for (let i=0;i<3;i++) assert.equal(E.draw(s, () => seq[i]).item.tier, i+1);
  assert(s.xp > 0); assert.equal(s.tickets, 2);
});
test('answer is idempotent across refresh; session restores and finishes', () => {
  let s = E.fresh(); E.begin(s, qs.slice(0, 5), 'test', () => .5);
  const q = qs.find(q => q.id === s.session.ids[0]);
  assert(E.answer(s, q, q.answer));
  s = E.restore(JSON.parse(JSON.stringify(s)), qs);
  assert.equal(E.answer(s, q, q.answer), null); assert.equal(s.xp, 10);
  E.next(s); assert.equal(s.session.index, 1);
  for(let i=1;i<5;i++){const q2=qs.find(q=>q.id===s.session.ids[i]); E.answer(s,q2,q2.answer);E.next(s);}
  assert.equal(s.session.index, 5); assert.equal(s.tickets, 1);
  assert.deepEqual(E.restore(JSON.parse(JSON.stringify(s)),qs),s);
});
test('import validation rejects negative currency, unknown equipment/questions and malformed runs', () => {
  const base = E.fresh();
  for (const change of [ {tickets:-1}, {pity:30}, {progress:5}, {inventory:{'__evil__':1}}, {wrong:['unknown']}, {equipped:'herbal-3'}, {session:{ids:[qs[0].id],index:0,answers:[{choice:9}],label:'x'}}, {version:2}, {day:'yesterday'} ]) {
    assert.throws(()=>E.restore({...base,...change}, qs));
  }
});
