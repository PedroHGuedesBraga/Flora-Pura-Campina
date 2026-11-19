"""Extrai os dados de arte (nome, descrição, notas...) do gerar_artes.py sem precisar de PIL."""
import sys, types, os, json
SRC = r'C:\Users\pedro\Documents\Flora pura digitalizada\arte\gerar_artes.py'
AV = r'C:\Users\Pedro\AppData\Local\Temp\claude\e2aa79b1bc5fddf9\99d38022-7902-4bc2-8979-f2f541bf1e84\scratchpad\avulsos.json'
def carregar():
    src = open(SRC, encoding='utf-8').read().split('\n')
    corte = next(i for i, l in enumerate(src) if l.startswith("_AV = "))
    code = '\n'.join(l for l in src[:corte] if not l.startswith(('from PIL', 'for d in', '    os.makedirs')))
    class _I:
        def __getattr__(s,n): return s
        def __call__(s,*a,**k): return s
        def __getitem__(s,k): return s
        def __iter__(s): return iter((0,0,0))
        def __mul__(s,o): return s
        def __int__(s): return 0
        def __index__(s): return 0
    g = {'__name__': 'x', 'Image': _I(), 'ImageFilter': _I()}
    code = code.replace('def _autocol(path):', 'def _autocol(path):\n    return (120, 90, 60)\ndef _autocol_old(path):')
    exec(code, g)
    P = g['P']
    if os.path.exists(AV):
        for a in json.load(open(AV, encoding='utf-8')):
            P.append(dict(slug=a['slug'], name=a['name'], sub=a['sub'], foot=a['foot'], fam=a['fam'], desc=a['desc'], t=[tuple(x) for x in a['t']], accent=a['accent']))
    return P
if __name__ == '__main__':
    P = carregar(); print(len(P)); print([p['slug'] for p in P][:5])
