"""Apply the second content review to an immutable r6 baseline.

The game IDs and scoring keys stay stable. Text/option repairs require an
explicit accepted list produced after comparison with original exam pages.
"""
from pathlib import Path
import copy, hashlib, json

ROOT = Path(__file__).resolve().parents[1]
baseline = ROOT/'artifacts/factual-bank-before.json'
assert baseline.exists(), 'Keep an r6 bank backup at artifacts/factual-bank-before.json before applying.'
original = json.loads(baseline.read_text('utf8'))
assert original['version'] == 'notes-3221-r6'
bank = copy.deepcopy(original)
lookup = {q['id']:q for q in bank['questions']}
accepted = json.loads((ROOT/'tools/factual-review-accepted.json').read_text('utf8'))
official = json.loads((ROOT/'tools/official-answer-audit.json').read_text('utf8'))
keys = {q['id']:q for q in official['questions']}
assert set(keys) == set(lookup)
assert all(q['status']=='match' for q in keys.values())
allowed = {'title','focus','explanation','memory','pitfall','needsReview','diagrams'}
reviewed, entered, content_changed, source_changed, independently_sourced = set(), set(), set(), set(), set()
subject_summary = {}

for subject in ['pharmaceutics','pharmacology','herbal']:
    report = json.loads((ROOT/f'tools/factual-review-{subject}.json').read_text('utf8'))
    expected = {q['id'] for q in lookup.values() if q['subject']==subject}
    reviewed_ids = report['reviewedIds']
    assert len(reviewed_ids) == len(set(reviewed_ids)) and set(reviewed_ids)==expected, subject
    entries = report['entries']
    entry_ids = {e['id'] for e in entries}
    assert len(entry_ids)==len(entries) and entry_ids <= expected
    unchanged = set(report['unchangedIds'])
    assert not unchanged & entry_ids and unchanged | entry_ids == expected, subject
    reviewed.update(reviewed_ids)
    independently_sourced.update(report.get('sourceVerifiedIds',[]))
    assert set(report.get('sourceVerifiedIds',[])) <= expected
    for patch in entries:
        ident = patch['id']
        assert ident not in entered and patch.get('reason'), ident
        entered.add(ident)
        q = lookup[ident]
        before = copy.deepcopy(q)
        assert 'answerCorrection' not in patch, 'The independently verified official keys already match.'
        for field in allowed:
            if field in patch:
                q[field] = patch[field]
        for source_field, target_field in [('questionCorrection','question'),('optionsCorrection','options')]:
            if source_field in patch:
                assert ident in accepted[source_field], f'Original-page review missing: {ident} {source_field}'
                q[target_field] = patch[source_field]
        assert len(q['options'])==4 and len(set(q['options']))==4
        assert all(isinstance(q[f],str) and q[f].strip() for f in ['question','title','explanation','memory'])
        if q != before:
            content_changed.add(ident)
        if patch.get('reviewSources'):
            urls = [s if isinstance(s,str) else s['url'] for s in patch['reviewSources']]
            assert all(u.startswith('https://') for u in urls), ident
            q['reviewSources'] = list(dict.fromkeys(q.get('reviewSources',[])+urls))
            if q.get('reviewSources') != before.get('reviewSources'):
                source_changed.add(ident)
        if before.get('needsReview') and not q.get('needsReview'):
            assert patch.get('reviewSources') and ident in independently_sourced, f'Unsubstantiated release: {ident}'
    subject_summary[subject] = {'reviewed':len(expected), 'contentRevised':len(content_changed & expected),
                                'sourceChecked':len(independently_sourced & expected),
                                'officialAnswersMatched':len(expected),
                                'pending':sum(bool(lookup[i].get('needsReview')) for i in expected)}

for before, after in zip(original['questions'],bank['questions']):
    for field in ['id','subject','exam','number','answer']:
        assert before[field]==after[field], (before['id'],field)
    key = keys[after['id']]
    assert key['officialAnswer']=='ABCD'[after['answer']]
    after['officialKey'] = {'answer':after['answer'],'url':key['source']}
pending = {q['id'] for q in lookup.values() if q.get('needsReview')}
previous_pending = {q['id'] for q in original['questions'] if q.get('needsReview')}
assert reviewed==set(lookup)
scope = '逐題檢視三科題幹、選項、詳解與記憶重點；全題核對考選部最終答案。對疑點另查原始試題與專業來源；不宣稱每項醫藥事實均完成獨立查證。'
bank['factualReview'] = {'date':'2026-10-30','reviewed':len(reviewed),'contentRevised':len(content_changed),
    'officialAnswersMatched':len(keys),'sourceChecked':len(independently_sourced),'pending':len(pending),
    'resolved':len(previous_pending-pending),'newPending':len(pending-previous_pending),
    'subjects':subject_summary,'scope':scope}
bank['version']='notes-3221-r7'
(ROOT/'game/bank.js').write_text('window.MIND_BANK = '+json.dumps(bank,ensure_ascii=False,separators=(',',':'))+';\n','utf8')
audit = {**bank['factualReview'], 'baselineSha256':hashlib.sha256(baseline.read_bytes()).hexdigest(),
    'reviewedIds':sorted(reviewed),'changedIds':sorted(content_changed),'referenceEnrichedIds':sorted(source_changed),
    'sourceVerifiedIds':sorted(independently_sourced),'pendingIds':sorted(pending),
    'resolvedIds':sorted(previous_pending-pending),'newPendingIds':sorted(pending-previous_pending)}
(ROOT/'tools/factual-review-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n','utf8')
print(json.dumps(bank['factualReview'],ensure_ascii=False))
