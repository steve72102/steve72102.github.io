"""Merge individually reviewed explanations without changing question IDs/answers."""
from pathlib import Path
import json,sys,copy
ROOT=Path(__file__).resolve().parents[1]
baseline=ROOT/'artifacts/clarity-bank-before.json'
if not baseline.exists():
    source=(ROOT/'game/bank.js').read_text(encoding='utf-8')
    baseline.write_text(json.dumps(json.loads(source.split('=',1)[1].strip().removesuffix(';')),ensure_ascii=False),encoding='utf-8')
original=json.loads(baseline.read_text(encoding='utf-8'))
bank=copy.deepcopy(original); lookup={q['id']:q for q in bank['questions']}
allowed={'title','focus','explanation','memory','pitfall','reviewSources','needsReview','diagrams'}
# Independently checked against the MOEX original paper, page 1 question 2.
question_corrections={'pharmaceutics-112-2-2'}
option_cleanup_id='herbal-112-2-62'
def source_urls(items):
    urls=[item if isinstance(item,str) else item.get('url','') for item in items]
    assert all(isinstance(url,str) and url.startswith('https://') for url in urls), urls
    return list(dict.fromkeys(urls))
reviewed=set(); changed=set(); entries=set(); reports=[]
for name in ['pharmaceutics','pharmacology','herbal','targeted']:
    path=ROOT/f'tools/clarity-review-{name}.json'
    if not path.exists():
        if '--preview' in sys.argv: continue
        raise SystemExit(f'Missing review: {path}')
    report=json.loads(path.read_text(encoding='utf-8')); reports.append(report)
    reviewed.update(report.get('reviewedIds',[]))
    for patch in report['entries']:
        ident=patch['id'];assert ident in lookup,ident
        assert ident not in entries, f'Duplicate patch: {ident}'
        entries.add(ident)
        q=lookup[ident]; before=copy.deepcopy(q)
        for key in allowed:
            if key in patch:q[key]=source_urls(patch[key]) if key=='reviewSources' else patch[key]
        if 'questionCorrection' in patch:
            assert ident in question_corrections, f'Unverified question correction: {ident}'
            corrected=patch['questionCorrection']
            assert isinstance(corrected,str) and corrected.startswith('0.9% NaCl'), corrected
            q['question']=corrected
        if q!=before:changed.add(ident)
assert reviewed<=lookup.keys(), 'Review contains unknown IDs'
# The source extraction appended a subject/page footer to option D.
old_option=lookup[option_cleanup_id]['options'][3]
clean_option='Strychnos castelnaei－降血糖'
assert old_option.startswith(clean_option+' 藥物分析與生藥學'), old_option
lookup[option_cleanup_id]['options'][3]=clean_option
changed.add(option_cleanup_id)
figures=json.loads((ROOT/'tools/lesson-figure-map.json').read_text(encoding='utf-8'))
for figure,config in figures.items():
    assert (ROOT/f'game/assets/lessons/{figure}.svg').exists(),figure
    for ident in config['questions']:
        q=lookup[ident]
        q['diagrams']=list(dict.fromkeys(q.get('diagrams',[])+[figure]))
        q['reviewSources']=list(dict.fromkeys(q.get('reviewSources',[])+config['sources']))
        changed.add(ident)
if '--preview' not in sys.argv:
    assert reviewed==lookup.keys(),f'Review incomplete: {len(reviewed)}/{len(lookup)}'
    for report in reports:
        assert not set(p['id'] for p in report['entries'])-set(report['reviewedIds']), 'Edits outside reviewed range'
pending=sum(bool(q.get('needsReview')) for q in lookup.values())
assert len(lookup)==len(bank['questions'])==3221
for before,after in zip(original['questions'],bank['questions']):
    for key in ['id','subject','exam','number','answer']:assert before[key]==after[key],(before['id'],key)
    if before['id']==option_cleanup_id:
        assert before['options'][:3]==after['options'][:3] and after['options'][3]==clean_option
    else: assert before['options']==after['options'],before['id']
    if before['id'] not in question_corrections: assert before['question']==after['question'],before['id']
scope=f"本次已逐題閱讀與檢視 {len(reviewed):,} 題的清晰度，修訂 {len(changed):,} 題；目前 {pending} 題因資料或答案疑義暫停加入新開關卡。對發現疑義的部分核對參考來源；清晰度檢視不代表全題庫每項醫藥事實都已完成查證。"
bank['lessonReview']={'date':'2026-10-30','reviewed':len(reviewed),'clarityEdited':len(changed),'pending':pending,'scope':scope,'previousSemanticReview':original.get('lessonReview')}
bank['version']='notes-3221-r6'
(ROOT/'game/bank.js').write_text('window.MIND_BANK = '+json.dumps(bank,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
audit={'reviewed':len(reviewed),'changed':len(changed),'pending':pending,'reviewedIds':sorted(reviewed),'changedIds':sorted(changed),'pendingIds':sorted(q['id'] for q in lookup.values() if q.get('needsReview')),'scope':scope}
(ROOT/'tools/clarity-review-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(scope)
