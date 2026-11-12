"""Split the reviewed V4 schema into independently owned databases. Never executes SQL."""
import re, json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
sql=(ROOT/'database/Parking_Database_V4.sql').read_text(encoding='utf-8')
identity={'app_users','auth_tokens','platform_user_roles','lot_staff_assignments'}
payment={'billing_accounts','billing_lines','payments','payment_attempts','payment_webhook_events','refunds'}
ai={'ai_plate_recognitions','occupancy_snapshots','occupancy_forecasts','assistant_documents','assistant_document_chunks'}
names=set(re.findall(r'CREATE TABLE public\.(\w+)',sql))
owners={n:'identity' if n in identity else 'payment' if n in payment else 'ai' if n in ai else 'parking' for n in names}
assert len(owners)==47

def statements(text):
    # Strip line comments only outside quoted strings/dollar bodies.
    i=0; start=0; quote=None; dollar=None; items=[]
    while i<len(text):
        if dollar:
            if text.startswith(dollar,i): i+=len(dollar); dollar=None
            else: i+=1
            continue
        if quote:
            if text[i]==quote:
                if i+1<len(text) and text[i+1]==quote:i+=2;continue
                quote=None
            i+=1;continue
        if text.startswith('--',i):
            end=text.find('\n',i)
            if end<0:end=len(text)
            text=text[:i]+(' '*(end-i))+text[end:];i=end;continue
        if text[i] in "'\"":quote=text[i];i+=1;continue
        m=re.match(r'\$[A-Za-z_0-9]*\$',text[i:])
        if m:dollar=m[0];i+=len(dollar);continue
        if text[i]==';':
            item=text[start:i+1].strip()
            if item:items.append(item)
            start=i+1
        i+=1
    assert not dollar and not quote
    return items

parts={s:['-- Owned database: '+s+'; run ONCE on an empty Development database.','BEGIN;','CREATE EXTENSION IF NOT EXISTS btree_gist;','SET LOCAL search_path = public, pg_catalog;'] for s in ['identity','parking','payment','ai']}
external=[]
for st in statements(sql):
    if st in ('BEGIN;','COMMIT;') or st.startswith(('CREATE EXTENSION','SET LOCAL','DO $$')):continue
    if st.startswith('CREATE TYPE '):
        for s in parts:parts[s].append(st)
        continue
    target=None
    m=re.search(r'^(?:CREATE TABLE|ALTER TABLE) public\.(\w+)',st)
    if m:target=m[1]
    if st.startswith('CREATE INDEX') or st.startswith('CREATE UNIQUE INDEX'):
        target=re.search(r'ON public\.(\w+)',st)[1]
    if st.startswith('CREATE TRIGGER') or st.startswith('CREATE CONSTRAINT TRIGGER'):
        target=re.search(r'ON public\.(\w+)',st)[1]
    if st.startswith('CREATE FUNCTION'):
        name=re.search(r'public\.(\w+)',st)[1]
        if name=='check_billing_visit':continue # Cross-service FK must be validated by Payment use case.
        if name=='reject_immutable_write':
            for s in parts:parts[s].append(st)
        else:parts['parking'].append(st)
        continue
    if 'tr_billing_same_visit' in st:continue
    assert target in owners,st[:100]
    owner=owners[target]
    references=re.findall(r'REFERENCES public\.(\w+)',st)
    if references:
        if st.startswith('ALTER TABLE') and any(owners[t]!=owner for t in references):
            external.append({'table':target,'owner':owner,'statement':st,'validation':'Service API/identity or immutable event/quote snapshot; no direct database access.'})
            continue
        if st.startswith('CREATE TABLE'):
            # AI inline FK and table-level FK can reference other owners.
            for t in references:
                if owners[t]==owner:continue
                external.append({'table':target,'owner':owner,'references':t,'validation':'External ID; service authorization/snapshot required.'})
                st=re.sub(r'^\s*FOREIGN KEY \([^)]*\) REFERENCES public\.'+t+r'\([^)]*\) ON DELETE (?:RESTRICT|CASCADE),?\s*\n','',st,flags=re.M)
                st=re.sub(r' REFERENCES public\.'+t+r'\([^)]*\) ON DELETE (?:RESTRICT|CASCADE)','',st)
    parts[owner].append(st)

audit=next(s for s in statements(sql) if s.startswith('CREATE TABLE public.audit_logs'))
immutable=next(s for s in statements(sql) if s.startswith('CREATE TRIGGER tr_audit_append_only'))
for service,out in parts.items():
    if service!='parking':out.extend([audit,immutable])
    out.append('''CREATE TABLE public.integration_outbox (
 event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_type text NOT NULL,
 aggregate_id uuid NOT NULL, payload jsonb NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now(),
 delivered_at timestamptz, attempts int NOT NULL DEFAULT 0 CHECK(attempts>=0), next_attempt_at timestamptz NOT NULL DEFAULT now(), last_error text);
 CREATE INDEX ix_outbox_pending ON public.integration_outbox(next_attempt_at,occurred_at) WHERE delivered_at IS NULL;
 CREATE TABLE public.integration_inbox (
 event_id uuid PRIMARY KEY, event_type text NOT NULL, payload_hash text NOT NULL,
 received_at timestamptz NOT NULL DEFAULT now(), outcome text NOT NULL);
 CREATE TABLE public.service_schema_versions (version int PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
 INSERT INTO public.service_schema_versions(version) VALUES(1);''')
    if service=='identity':out.append('ALTER TABLE public.lot_staff_assignments ADD COLUMN can_manage_staff_assignments boolean NOT NULL DEFAULT false;')
    if service=='payment':out.append('ALTER TABLE public.payments ADD COLUMN version int NOT NULL DEFAULT 1 CHECK(version>0);')
    if service=='parking':out.append('''CREATE TABLE public.payment_receipts (
 payment_id uuid PRIMARY KEY, booking_id uuid NOT NULL REFERENCES public.bookings(id),
 amount numeric(18,0) NOT NULL CHECK(amount>0), currency char(3) NOT NULL,
 paid_at timestamptz NOT NULL, event_id uuid NOT NULL UNIQUE);
 ALTER TABLE public.bookings ADD COLUMN version int NOT NULL DEFAULT 1 CHECK(version>0);''')
    if service=='ai':out.append('CREATE TABLE public.ai_lot_catalog (lot_id uuid PRIMARY KEY, name text NOT NULL, updated_at timestamptz NOT NULL);')
    out.append('COMMIT;')
    dest=ROOT/'database/services'/service
    dest.mkdir(parents=True,exist_ok=True)
    result='\n\n'.join(out)+'\n'
    # No cross-owner FK can survive export.
    for t in re.findall(r'REFERENCES public\.(\w+)',result):
        assert owners.get(t,service)==service,(service,t)
    (dest/'001_schema.sql').write_text(result,encoding='utf-8')
(ROOT/'database/services/ownership.json').write_text(json.dumps({'originalTables':47,'owners':dict(sorted(owners.items())),'externalReferences':external},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Generated 4 independent schemas; ownership assigned for all 47 original tables; cross-owner FKs removed with inventory.')
