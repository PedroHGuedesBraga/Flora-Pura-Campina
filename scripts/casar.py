import csv, os, re, unicodedata, sys
from extrair_artes import carregar
ARTE = r'C:\Users\pedro\Documents\Flora pura digitalizada\arte'
CSV = r'C:\Users\pedro\AppData\Local\Temp\claude\4deb669c9e2f3bd4\a0a0bc2c-8810-42ce-b666-00b548b4030b\scratchpad\produtos.csv'
def norm(s):
    s = unicodedata.normalize('NFD', s.lower()); s = ''.join(c for c in s if not unicodedata.combining(c))
    return re.sub(r'[^a-z0-9 ]', ' ', s)
STOP = set('de da do e a o para em com perfume eau parfum flora pura ml linha feminino masculino pour femme homme man woman'.split())
def toks(s): return {t for t in norm(s).split() if t not in STOP and len(t) > 1}
rows = list(csv.DictReader(open(CSV, encoding='utf-8')))
P = {p['slug']: p for p in carregar()}
cats = {}
for c in ('Perfume', 'Bodysplash'):
    for f in sorted(os.listdir(f'{ARTE}\{c}\site')):
        if f.endswith('.jpg'): cats[f[:-4]] = c
for slug, c in cats.items():
    p = P.get(slug)
    ref = (p['name'] + ' ' + p['sub']) if p else slug.replace('-', ' ')
    tk = toks(ref) | toks(slug.replace('-', ' '))
    sc = []
    for r in rows:
        rt = toks(r['nome'])
        if not rt: continue
        j = len(tk & rt) / len(tk | rt)
        if j > 0.2: sc.append((j, r))
    sc.sort(key=lambda x: -x[0])
    print(f"## {slug} [{c}] ← {p['name'] if p else '?'} | {p['sub'] if p else ''}")
    for j, r in sc[:3]: print(f"   {j:.2f} {r['codigo']} | {r['nome'].strip()} | {r['descricao'][:30]!r} | {r['valorVarejo']} {r['ativo']}")
