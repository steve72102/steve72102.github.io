"""Compare every current game answer with independently parsed MOEX S/M PDFs.

Downloaded evidence stays local. This script never changes the question bank.
"""
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urlsplit, parse_qs, urlencode, urlunsplit
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from pypdf import PdfReader
import hashlib, json, re, unicodedata, sys

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path('C:/Users/PC/Documents/阿摩國考/tmp')
OUT = ROOT / 'artifacts/official-answer-check'
OUT.mkdir(parents=True, exist_ok=True)
FOLDERS = {'pharmaceutics': 'pharmaceutics_study', 'pharmacology': 'pharm_study', 'herbal': 'years_study'}
NAMES = {'pharmaceutics': '藥劑', 'pharmacology': '藥理', 'herbal': '生藥'}
SOURCES_FILE = ROOT/'tools/official-answer-sources.json'
saved_sources = json.loads(SOURCES_FILE.read_text('utf8')) if SOURCES_FILE.exists() else {}
bank = json.loads((ROOT/'game/bank.js').read_text('utf8').split('=', 1)[1].strip().removesuffix(';'))

def change_type(url, kind):
    p = urlsplit(url)
    params = parse_qs(p.query)
    params['t'] = [kind]
    return urlunsplit((p.scheme, p.netloc, p.path, urlencode({k: v[0] for k, v in params.items()}), ''))

def sources(subject, exam):
    if f'{subject}-{exam}' in saved_sources:
        return saved_sources[f'{subject}-{exam}']
    folder = SOURCE/FOLDERS[subject]/exam
    meta = folder/'official_sources.json'
    if meta.exists():
        urls = json.loads(meta.read_text('utf8'))
        qurl = urls['Q']
    else:
        content = '\n'.join(p.read_text('utf8') for p in [folder/'notes.py', folder/'build_pdf.py'] if p.exists())
        urls = re.findall(r'https://wwwq\.moex\.gov\.tw/exam/wHandExamQandA_File\.ashx\?[^\s\'\"]+', content)
        qurl = next(u for u in urls if parse_qs(urlsplit(u).query).get('t') == ['Q'])
    return {kind: change_type(qurl, kind) for kind in ['Q', 'S', 'M']}

def read_answers(data, subject, exam):
    pdf = PdfReader(BytesIO(data))
    assert len(pdf.pages) == 1, 'Answer table must occupy one page'
    raw = pdf.pages[0].extract_text()
    text = unicodedata.normalize('NFKC', raw)
    assert NAMES[subject] in text, 'Wrong subject heading'
    assert re.search(r'\b'+exam.split('-')[0]+r'\s*年', text), 'Wrong year heading'
    term = '第一次' if exam.endswith('-1') else '第二次'
    assert exam.split('-')[0]+'年'+term in re.sub(r'\s+','',text), 'Wrong exam term'
    rows = []
    for line in text.splitlines():
        if re.match(r'^\s*答案\s', line):
            letters = re.findall(r'[ABCD#]', line.split('答案', 1)[1])
            if letters:
                assert len(letters) == 20, f'Unexpected row: {letters}'
                rows.append(letters)
    assert len(rows) == 4, f'Expected four 20-answer rows; got {len(rows)}'
    answers = [a for row in rows for a in row]
    return answers, text

def fetch(job):
    subject, exam, kind, url = job
    target = OUT/f'{subject}-{exam}-{kind}.pdf'
    result = {'subject':subject, 'exam':exam, 'kind':kind, 'url':url}
    try:
        with urlopen(Request(url, headers={'User-Agent':'MindQuest-educational-answer-audit/1.0'}), timeout=25) as response:
            data = response.read()
            result.update(status=response.status, bytes=len(data))
        if not data.startswith(b'%PDF-'):
            result.update(available=False, reason='Server did not return a PDF')
            return result
        answers, text = read_answers(data, subject, exam)
        target.write_bytes(data)
        target.with_suffix('.txt').write_text(text, 'utf8')
        result.update(available=True, answers=answers, sha256=hashlib.sha256(data).hexdigest(),
                      evidenceFile=str(target.relative_to(ROOT)), notes=text.split('備', 1)[-1])
    except Exception as exc:
        result.update(available=False, error=f'{type(exc).__name__}: {exc}')
    return result

packs = [(p['subject'], p['exam']) for p in bank['packs']]
assert len(packs) == len(set(packs)) == 47
source_map = {f'{s}-{e}': sources(s,e) for s,e in packs}
(OUT/'sources.json').write_text(json.dumps(source_map, ensure_ascii=False, indent=2), 'utf8')
SOURCES_FILE.write_text(json.dumps(source_map, ensure_ascii=False, indent=2)+'\n', 'utf8')
jobs = [(s,e,k,source_map[f'{s}-{e}'][k]) for s,e in packs for k in ['S','M']]
if '--reuse-downloads' in sys.argv:
    documents = json.loads((ROOT/'tools/official-answer-audit.json').read_text('utf8'))['documents']
    for doc in documents:
        if doc['available']:
            data = (ROOT/doc['evidenceFile']).read_bytes()
            assert hashlib.sha256(data).hexdigest() == doc['sha256']
            doc['answers'], doc['text'] = read_answers(data, doc['subject'], doc['exam'])
else:
    with ThreadPoolExecutor(max_workers=5) as pool:
        documents = list(pool.map(fetch, jobs))
        for doc in documents:
            print(doc['subject'], doc['exam'], doc['kind'], 'parsed' if doc['available'] else doc.get('error', doc.get('reason')), flush=True)
lookup = {(d['subject'], d['exam'], d['kind']):d for d in documents}
results = []
for q in bank['questions']:
    docs = [lookup[(q['subject'],q['exam'],k)] for k in ['M','S']]
    selected = next((d for d in docs if d['available']), None)
    result = {'id':q['id'], 'currentAnswer':'ABCD'[q['answer']]}
    if not selected or docs[0].get('error'):
        # A failed amendment request is not evidence that no amendment exists.
        result['status'] = 'unverified'
    else:
        answer = selected['answers'][q['number']-1]
        if answer == '#':
            text = (ROOT/selected['evidenceFile']).with_suffix('.txt').read_text('utf8')
            # A single explicit amended answer is different from multiple accepted answers.
            single = re.search(r'第\s*'+str(q['number'])+r'\s*題答\s*([ABCD])\s*給分', text)
            if single:
                answer = single[1]
                result['amendmentNote'] = single[0]
        result.update(officialAnswer=answer, source=selected['url'], kind=selected['kind'])
        result['status'] = 'amendment-needs-reading' if answer == '#' else 'match' if result['currentAnswer'] == answer else 'mismatch'
    results.append(result)
report = {'checkedDate':'2026-10-30', 'scope':'Official scoring keys, not independent verification of every explanation',
          'documents':documents, 'questions':results,
          'summary':{status:sum(r['status']==status for r in results) for status in ['match','mismatch','amendment-needs-reading','unverified']}}
(ROOT/'tools/official-answer-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), 'utf8')
print(json.dumps(report['summary'], ensure_ascii=False))
