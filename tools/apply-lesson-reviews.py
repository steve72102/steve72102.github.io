from pathlib import Path
import json
root=Path(__file__).resolve().parents[1]
p=root/'game/bank.js';source=p.read_text(encoding='utf-8');bank=json.loads(source[source.index('{'):].strip().rstrip(';'));qs={q['id']:q for q in bank['questions']}
entries=[]
for name in ['lesson-review-pharma.json','lesson-review-herbal.json']:
    entries.extend(json.loads((root/'tools'/name).read_text(encoding='utf-8'))['entries'])
assert len(entries)==len({e['id'] for e in entries})==90
rewritten=0
for e in entries:
    q=qs[e['id']]
    assert q['options'] and isinstance(q['answer'],int)
    q['needsReview']=e['needsReview'];q['focus']=e['focus'];q['pitfall']=e['pitfall'];q['reviewSources']=e['sources']
    if e['explanation'] and not e['needsReview']:
        q['explanation']=e['explanation'];q['memory']=e['memory'];rewritten+=1
    elif e['needsReview']:
        q['explanation']='本題的選項或資料依據仍待確認，暫不提供確定詳解。'+e['pitfall']
        q['memory']='先保留疑問，待正式依據確認後再記憶。'
bank['lessonReview']={'date':'2026-10-29','reviewed':90,'rewritten':rewritten,'pending':sum(e['needsReview'] for e in entries),'scope':'全題庫改善閱讀排版；90 題逐題複核，其中 84 題重新撰寫、6 題暫停納入新關卡。其餘原筆記未逐題完成事實查核。'}
p.write_text('window.MIND_BANK = '+json.dumps(bank,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
print(json.dumps(bank['lessonReview'],ensure_ascii=False))
