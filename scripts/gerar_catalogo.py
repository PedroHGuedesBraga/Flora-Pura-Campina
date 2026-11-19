"""Gera data/catalogo.json (Perfumes + Body Splash) cruzando as artes com o banco da loja.
Uso: python gerar_catalogo.py <produtos.csv>   (csv exportado da tabela `produtos` do Postgres da loja)"""
import csv, json, os, re, shutil, sys
from extrair_artes import carregar

ARTE = r'C:\Users\pedro\Documents\Flora pura digitalizada\arte'
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV = sys.argv[1]

# slug da arte -> codigo do produto no banco (None = nao existe no banco)
M = {
    '1949-blue': 'FP-0691', '1949-reserva-especial': 'FP-0690', 'ambiance': '7908572200060', 'apolo': '7908572201951', 'belle': 'FP-0698',
    'dany': 'FP-0667', 'deo-colonia-cabra-arretado-130-ml': 'FP-0184', 'deo-parfum-ja-flore': 'FP-0186', 'deo-parfum-red-love': 'FP-0185',
    'deo-parfum-sky-blue': '7898612649594', 'divine-essence': '7908572205171', 'dom': '7908572200473',
    'dulce-romance-delicate-woman': '7908572203368', 'dulce-romance-pour-homme': 'FP-0702', 'especial-man': 'FP-0695', 'especial-woman': 'FP-0694',
    'flor-de-lis': 'FP-0678', 'flor-de-magnolia': 'FP-0684', 'flora-angico': '7908572204389', 'flora-bromelia': '7898612644902',
    'flora-cumaru': 'FP-0644', 'flora-flor-de-jurema': 'FP-0638', 'flora-flor-de-lima': '7898612643646', 'flora-gengibre': 'FP-0634',
    'flora-jasmim': '7908572200091', 'flora-jatoba': '7908572204372', 'flora-manjericao': 'FP-0633', 'flora-no1': '7898612647941',
    'flora-no2': '7908572203108', 'flora-pau-darco': 'FP-0642', 'flora-petit-grain': 'FP-0635', 'flora-pura-black': 'FP-0680',
    'flora-verbena-provence': '7898612643820', 'flora-vetiver': 'FP-0640', 'future-man': '57908572206505', 'future-men-classico': '57908572206505',
    'future-woman': '7898612649402', 'gardenia': '7908572201630', 'general': 'FP-0692', 'gioia': 'FP-0674', 'gold-flora': 'FP-0705',
    'helena': '7908572201579', 'hera': '7898612644537', 'heros': '7898612648573', 'lady-flora': 'FP-0706', 'lolla': 'FP-0677',
    'lorenzo': 'FP-0682', 'mellis': '7908572205188', 'new-joy': 'FP-0660', 'nina': 'FP-0681', 'perseu': 'FP-0683', 'pink': 'FP-0679',
    'rosa-da-bulgaria': 'FP-0686', 'rosa-mosqueta': 'FP-0661', 'selvagem': 'FP-0688', 'selvagem-intense': 'FP-0689', 'sultao': 'FP-0669',
    'xodo-pour-femme': '7908572201913', 'xodo-pour-homme': 'FP-0703', 'zafirah': '7898612645459', 'zelia-boaventura': 'FP-0663', 'zelia-eternity': '7908572206260',
    # colonias
    'agua-de-colonia-lavanda-200ml-vegetal-do-brasil': 'FP-0201', 'colonia-acqua-fresca-200-ml': 'FP-0195', 'colonia-alfazema-200-ml': '7898612642182',
    'colonia-bamboo-200-ml': '7898612642489', 'colonia-flor-de-laranjeira-200-ml': '7898612642526', 'colonia-jasmim-200-ml': '7898612643240',
    'colonia-patchouli-200-ml': 'FP-0193', 'colonia-verbena-200-ml': 'FP-0199', 'colonia-vetiver-200-ml': 'FP-0198',
    'colonia-frutal-banana-120ml-flora-pura': 'FP-0022', 'colonia-frutal-cereja-120ml-flora-pura': 'FP-0014', 'colonia-frutal-framboesa-120ml-flora-pura': 'FP-0015',
    'colonia-frutal-morango-120-ml': 'FP-0021', 'colonia-frutal-pitanga-120-ml': 'FP-0016', 'colonia-frutal-seriguela-120ml-flora-pura': 'FP-0020',
    'colonia-frutal-melancia-120ml-vegetal-do-brasil-linha-cheiro-de-frutas': None,
    'colonia-infantil-flora-baby-flora-pura': 'FP-0090', 'colonia-infantil-petit': '7908572204136',
    'flaconete-colonia-flora-baby-petit-5ml': None, 'flaconete-colonia-frutal-ameixa-5ml-f-p': None, 'flaconete-colonia-frutal-seriguela-5ml': None,
    # body splash
    'body-splash-aurora-essence': 'FP-0042', 'body-splash-doce-vanilla': 'FP-0039', 'body-splash-elegance-style': 'FP-0040', 'body-splash-elisia': '7908572205447',
    'body-splash-liberty-grace': '7908572204822', 'body-splash-tunisia': 'FP-0041', 'body-splash-velvet-bloom': '7908572204761',
    'body-splash-ceu-de-cores-zelinha-lab-200ml-flora-pura': '7908572206765', 'body-splash-sonho-de-infancia-zelinha-lab-200ml-flora-pura': '7908572206758',
    'body-splash-toque-secreto-midnight-pulse-flora-pura': 'FP-0037', 'body-splash-toque-secreto-rose-obsession-flora-pura': '7908572206321',
}

db = {r['codigo'].strip(): r for r in csv.DictReader(open(CSV, encoding='utf-8'))}
P = {p['slug']: p for p in carregar()}


def genero(sub):
    s = sub.upper()
    if 'INFANTIL' in s or 'BABY' in s:
        return 'infantil'
    if re.search(r'HOMME|MASCULINO|FOR MEN', s):
        return 'masculino'
    if re.search(r'FEMME|FEMININO|WOMAN', s):
        return 'feminino'
    return 'unissex'


def linha(sub, ddesc):
    m = re.search(r'linha ([\w ]+)', ddesc or '', re.I)
    if m:
        return m.group(1).strip().title()
    if 'LINHA FLORA' in sub.upper():
        return 'Flora'
    return None


def tipo(slug, categoria):
    if categoria == 'bodysplash':
        return 'body-splash'
    if slug.startswith('flaconete'):
        return 'flaconete'
    if slug.startswith('deo-parfum'):
        return 'deo-parfum'
    if slug.startswith('deo-colonia'):
        return 'deo-colonia'
    if 'colonia' in slug:
        return 'colonia'
    return 'perfume'


out, sem = [], []
for cat, categoria in (('Perfume', 'perfume'), ('Bodysplash', 'bodysplash')):
    pasta = os.path.join(ARTE, cat, 'site')
    for f in sorted(os.listdir(pasta)):
        if not f.endswith('.jpg'):
            continue
        slug = f[:-4]
        p = P[slug]
        if slug not in M:
            raise SystemExit('sem mapeamento: ' + slug)
        r = db.get(M[slug]) if M[slug] else None
        if M[slug] and not r:
            raise SystemExit('codigo nao achado: ' + M[slug])
        sub = p['sub']
        vol = re.search(r'(\d+)\s*ML', sub.upper())
        out.append({
            'id': slug, 'nome': p['name'], 'categoria': categoria, 'tipo': tipo(slug, categoria),
            'linha': linha(sub, r['descricao'] if r else ''), 'genero': genero(sub),
            'volumeMl': int(vol.group(1)) if vol else None, 'subtitulo': sub,
            'descricao': p['desc'], 'familiaOlfativa': p.get('fam') or None,
            'intensidade': p['inten'] if p.get('cat') else None,  # so quando vem do catalogo oficial
            'destaque': p.get('badge'), 'cor': p.get('accent'),
            'notas': [{'nivel': a, 'legenda': b, 'itens': list(c)} for a, b, c in p['t']],
            'preco': round(int(r['valorVarejo']) / 100, 2) if r and r['valorVarejo'] else None,
            'disponivel': (r['ativo'] == 't') if r else None,
            'codigo': r['codigo'].strip() if r else None,
            'nomeNoSistema': r['nome'].strip() if r else None,
            'imagem': {'site': f'/produtos/{slug}.webp', 'siteJpg': f'/produtos/{slug}.jpg'},
        })
        for src, dst in ((f'{cat}\\site\\{slug}.webp', f'public\\produtos\\{slug}.webp'),
                         (f'{cat}\\site\\{slug}.jpg', f'public\\produtos\\{slug}.jpg')):
            d = os.path.join(RAIZ, dst)
            os.makedirs(os.path.dirname(d), exist_ok=True)
            shutil.copyfile(os.path.join(ARTE, src), d)
        if not r:
            sem.append(slug)

os.makedirs(os.path.join(RAIZ, 'data'), exist_ok=True)
json.dump(out, open(os.path.join(RAIZ, 'data', 'catalogo.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print(len(out), 'itens; sem produto no banco:', sem)
