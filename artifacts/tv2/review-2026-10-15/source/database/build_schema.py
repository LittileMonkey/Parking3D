"""Reproducible export of this repository's restricted DBML syntax, not a general parser."""
import re
from pathlib import Path

root = Path(__file__).resolve().parent
source = (root/'Parking_Database_V4.dbml').read_text(encoding='utf-8')
ai_names = {'ai_plate_recognitions','occupancy_snapshots','occupancy_forecasts','assistant_documents','assistant_document_chunks'}
tables = {}
current = None
depth = 0
in_indexes = False
enums = {}
enum_name = None
for line in source.splitlines():
    s = line.strip()
    if s.startswith('Enum '):
        enum_name = re.fullmatch(r'Enum (\w+) \{',s)[1]
        enums[enum_name] = []
        continue
    if enum_name:
        if s == '}': enum_name = None
        elif s: enums[enum_name].append(s)
        continue
    if s.startswith('Table '):
        current = re.fullmatch(r'Table (\w+) \{',s)[1]
        tables[current] = {'cols': [], 'keys': []}
        depth = 1
        continue
    if current:
        if s == 'indexes {':
            depth += 1
            in_indexes = True
            continue
        if s == '}':
            depth -= 1
            in_indexes = False
            if depth == 0: current = None
            continue
        if not s or s.startswith(('Note:', '//')): continue
        if in_indexes:
            if re.fullmatch(r'\w+',s):
                tables[current]['keys'].append((s,'index'))
                continue
            m = re.fullmatch(r'\(([^)]+)\)(?: \[(unique|pk)(?:, note: .*?)?\])?',s)
            assert m, ('Unsupported index',s)
            tables[current]['keys'].append((m[1],m[2] or 'index'))
        else:
            m = re.fullmatch(r'(\w+) (\w+(?:\([^)]*\))?)(?: \[(.*)\])?',s)
            assert m, ('Unsupported column',s)
            tables[current]['cols'].append((m[1],m[2],m[3] or ''))
assert len(tables) == 47 and len(enums) == 8
refs = []
for line in source.splitlines():
    if not line.startswith('Ref:'): continue
    m = re.fullmatch(r'Ref: (\w+)\.(\([^)]*\)|\w+) > (\w+)\.(\([^)]*\)|\w+)',line)
    assert m, line
    a,ac,b,bc = m.groups()
    ac,bc = ac.strip('()'),bc.strip('()')
    for table,cols in [(a,ac),(b,bc)]:
        assert set(x.strip() for x in cols.split(',')) <= {c[0] for c in tables[table]['cols']}
    target = tuple(x.strip() for x in bc.split(','))
    unique = [tuple(x.strip() for x in cols.split(',')) for cols,k in tables[b]['keys'] if k != 'index']
    unique += [(n,) for n,t,attrs in tables[b]['cols'] if 'pk' in attrs or 'unique' in attrs]
    assert target in unique, ('FK target not unique',line)
    refs.append((a,ac,b,bc))
assert len(refs) == 90
out = ['-- Full PostgreSQL 17 schema: 42 core tables + 5 AI tables.',
       '-- Run ONCE on an EMPTY dedicated database. Never mix with EF PascalCase schema.',
       '-- Generated core from Parking_Database_V4.dbml; reviewed guards and AI DDL follow.',
       'BEGIN;', 'CREATE EXTENSION IF NOT EXISTS btree_gist;', 'SET LOCAL search_path = public, pg_catalog;']
for name,values in enums.items():
    out.append('CREATE TYPE public.'+name+' AS ENUM ('+', '.join("'"+v+"'" for v in values)+');')
for name,t in tables.items():
    if name in ai_names: continue
    cols=[]
    for n,typ,attrs in t['cols']:
        sql=f'    {n} '+('public.'+typ if typ in enums else typ)
        if 'not null' in attrs: sql+=' NOT NULL'
        if 'pk' in attrs: sql+=' PRIMARY KEY'
        if 'unique' in attrs: sql+=' UNIQUE'
        if n=='id' and typ=='uuid': sql+=' DEFAULT gen_random_uuid()'
        if n in ('created_at','updated_at') and typ=='timestamptz': sql+=' DEFAULT now()'
        cols.append(sql)
    for names,kind in t['keys']:
        if kind == 'index': continue
        cols.append('    '+('PRIMARY KEY' if kind=='pk' else 'UNIQUE')+' ('+names+')')
    out.append('CREATE TABLE public.'+name+' (\n'+',\n'.join(cols)+'\n);')
    for i,(names,kind) in enumerate(t['keys']):
        if kind == 'index': out.append(f'CREATE INDEX ix_{name}_{i} ON public.{name} ({names});')
for i,(a,ac,b,bc) in enumerate(refs,1):
    if a in ai_names: continue
    out.append(f'ALTER TABLE public.{a} ADD CONSTRAINT fk_core_{i:03} FOREIGN KEY ({ac}) REFERENCES public.{b} ({bc}) ON DELETE RESTRICT;')
out.append((root/'core_integrity.sql').read_text(encoding='utf-8'))
ai = (root/'001_ai_extension.sql').read_text(encoding='utf-8')
ai = re.sub(r'^BEGIN;\s*$', '', ai, flags=re.M)
ai = re.sub(r'^COMMIT;\s*$', '', ai, flags=re.M)
out += ['-- AI extension included in the SAME atomic schema transaction.', ai, 'COMMIT;']
(root/'Parking_Database_V4.sql').write_text('\n\n'.join(out)+'\n',encoding='utf-8')
generated = (root/'Parking_Database_V4.sql').read_text(encoding='utf-8')
assert len(re.findall(r'CREATE TABLE public\.',generated)) == 47
assert set(re.findall(r'CREATE TABLE public\.(\w+)',generated)) == set(tables)
print('Static validation OK: 47 tables, 8 enums, 90 declared references; all referenced columns and candidate keys exist.')
