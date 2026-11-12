import json, re, zipfile, hashlib
from pathlib import Path
import openpyxl
from docx import Document

p = Path(__file__).parent
d = json.loads((p/'tv2-data.json').read_text(encoding='utf-8'))
assert len(d['cases']) == 64 and len({x['id'] for x in d['cases']}) == 64
policies = {x[0] for x in d['policies']}
sources = {x[0] for x in d['sources']}
for c in d['cases']:
    assert c['status'] == 'Not run' and not any(c[x] for x in ['actual','evidence','bug'])
    assert set(re.findall(r'P\d\d', c['policy'])) <= policies
    assert set(re.findall(r'S\d\d', c['source'])) <= sources
    assert all(c[x] for x in ['requirement','title','precondition','steps','expected','owner'])
w = openpyxl.load_workbook(p/'TV2_WORKBOOK.xlsx', data_only=True)
assert len(w.sheetnames) == 7
assert all(w['Test Cases'].cell(r,10).value == 'Not run' for r in range(7,71))
assert all(w['Oracle'].cell(r,11).value == 'MATCH' for r in range(6,16))
assert not [(s.title,c.coordinate) for s in w for row in s for c in row if c.data_type == 'e']
spec = (p/'TV2_SPEC_API_TEST_PLAN.md').read_text(encoding='utf-8')
assert spec.count('sequenceDiagram') == 8
assert len(re.findall(r'flowchart\s',spec)) == 8
collection = json.loads((p/'TV2_API_DRAFT.postman_collection.json').read_text(encoding='utf-8'))
assert len(collection['item']) == 8
env = json.loads((p/'TV2_DEV.postman_environment.json').read_text(encoding='utf-8'))
vals = {x['key']:x['value'] for x in env['values']}
assert vals['accessToken'] == '' and vals['baseUrl'] == 'http://127.0.0.1:0'
doc = Document(p/'TV2_GUIDE.docx')
assert 'Claim Request' not in '\n'.join(x.text for x in doc.paragraphs)
template = Path('Project Team - Sprint x Planning.docx')
assert hashlib.sha256(template.read_bytes()).hexdigest() == '22d877560a84b935c80116757a5430b660e650e57aa26ebaf1fa48b1c6935816'
files = ['START_HERE.md','TV2_GUIDE.docx','TV2_WORKBOOK.xlsx','TV2_SPEC_API_TEST_PLAN.md','TV2_API_DRAFT.postman_collection.json','TV2_DEV.postman_environment.json','TEST_FIXTURES_DRAFT.json']
with zipfile.ZipFile(p/'TV2_PARKING_HANDOFF.zip','w',zipfile.ZIP_DEFLATED) as z:
    for f in files: z.write(p/f,f)
with zipfile.ZipFile(p/'TV2_PARKING_HANDOFF.zip') as z:
    assert z.testzip() is None and len(z.namelist()) == 7
print('Verified: 64 cases; valid policy/source references; 7 sheets; 10 MATCH; no formula errors; 8 activity + 8 sequence diagrams; 8 Postman drafts; blank token; original template unchanged; ZIP integrity OK.')
