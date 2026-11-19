'use client';

import { useEffect, useMemo, useState } from 'react';
import { TIPOS, brl, produtos } from '@/lib';

type Ajuste = { id: string; preco: number | null; promo: number | null; oculto: number; nome: string | null; descricao: string | null };
type Form = { preco: string; promo: string; oculto: boolean; nome: string; descricao: string };

const fmt = (n: number | null) => (n == null ? '' : n.toFixed(2).replace('.', ','));
const num = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')));
const doAjuste = (a?: Ajuste): Form => ({ preco: fmt(a?.preco ?? null), promo: fmt(a?.promo ?? null), oculto: !!a?.oculto, nome: a?.nome ?? '', descricao: a?.descricao ?? '' });
const pctDe = (preco: number | null, promo: number | null) => (preco && promo != null && promo < preco ? Math.round((1 - promo / preco) * 100) : 0);

// A tela fica atrás do Cloudflare Access; a API confere o token de novo.
export default function Admin() {
  const [ajustes, setAjustes] = useState<Record<string, Ajuste>>({});
  const [rascunho, setRascunho] = useState<Record<string, Form>>({});
  const [aberto, setAberto] = useState<string | null>(null); // linha com texto expandido
  const [msg, setMsg] = useState<Record<string, string>>({});
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [soAlterados, setSoAlterados] = useState(false);

  useEffect(() => {
    fetch('/api/admin/ajustes', { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status === 401 ? 'Sem autorização (login do Access ausente ou não configurado).' : 'Falha ao carregar.');
        return (await r.json()) as Ajuste[];
      })
      .then((l) => setAjustes(Object.fromEntries(l.map((x) => [x.id, x]))))
      .catch((e: Error) => setErro(e.message));
  }, []);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return produtos.filter((p) => (!q || `${p.nome} ${p.codigo ?? ''}`.toLowerCase().includes(q)) && (!soAlterados || ajustes[p.id]));
  }, [busca, soAlterados, ajustes]);

  const form = (id: string) => rascunho[id] ?? doAjuste(ajustes[id]);
  const editar = (id: string, parte: Partial<Form>) => setRascunho((r) => ({ ...r, [id]: { ...form(id), ...parte } }));
  const aviso = (id: string, t: string) => setMsg((m) => ({ ...m, [id]: t }));

  async function salvar(id: string, precoBase: number | null) {
    const f = form(id);
    const preco = num(f.preco), promo = num(f.promo);
    if ([preco, promo].some((v) => v != null && (!Number.isFinite(v) || v < 0))) return aviso(id, 'Valor inválido');
    if (promo != null && (preco ?? precoBase) != null && promo >= (preco ?? (precoBase as number))) return aviso(id, 'O promocional precisa ser menor que o preço');
    const r = await fetch(`/api/admin/ajustes/${id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ preco, promo, oculto: f.oculto, nome: f.nome || null, descricao: f.descricao || null }),
    });
    if (!r.ok) return aviso(id, 'Erro ao salvar');
    const d = (await r.json()) as Partial<Ajuste> & { removido?: boolean };
    setAjustes((a) => {
      const { [id]: _, ...rest } = a;
      return d.removido ? rest : { ...rest, [id]: { id, preco: d.preco ?? null, promo: d.promo ?? null, oculto: d.oculto ? 1 : 0, nome: d.nome ?? null, descricao: d.descricao ?? null } };
    });
    setRascunho((x) => { const { [id]: _, ...rest } = x; return rest; });
    aviso(id, 'Salvo');
  }

  async function restaurar(id: string) {
    const r = await fetch(`/api/admin/ajustes/${id}`, { method: 'DELETE' });
    if (!r.ok) return aviso(id, 'Erro ao restaurar');
    setAjustes((a) => { const { [id]: _, ...rest } = a; return rest; });
    setRascunho((x) => { const { [id]: _, ...rest } = x; return rest; });
    aviso(id, 'Voltou ao original');
  }

  const campo = 'w-28 rounded-lg border border-areia-300 px-2 py-1.5 text-right outline-none focus:border-flora-500';

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="font-display text-3xl text-flora-700">Painel do catálogo</h1>
      <p className="mt-1 text-sm text-tinta-suave">
        Preço, promoção, ocultar e editar texto. Vale no site na hora (até 1 minuto de cache). “Restaurar” volta tudo ao cadastro original. Item oculto some do site, mas as imagens continuam acessíveis pelo endereço direto.
      </p>
      {erro && <p className="mt-4 rounded-xl bg-perigo-50 p-3 text-perigo-600">{erro}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou código" className="min-w-60 flex-1 rounded-xl border border-areia-300 bg-white px-3 py-2.5 outline-none focus:border-flora-500" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={soAlterados} onChange={(e) => setSoAlterados(e.target.checked)} /> Só alterados ({Object.keys(ajustes).length})
        </label>
      </div>

      <ul className="mt-4 divide-y divide-areia-200 rounded-2xl border border-areia-200 bg-white">
        {lista.map((p) => {
          const f = form(p.id);
          const sujo = rascunho[p.id] != null;
          const salvo = ajustes[p.id];
          const efetivo = num(f.preco) ?? p.preco;
          const pct = pctDe(efetivo, num(f.promo));
          return (
            <li key={p.id} className={`space-y-2 p-3 ${f.oculto ? 'bg-areia-100/60' : ''}`}>
              <div className="flex flex-wrap items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.imagem.site} alt="" className={`h-14 w-11 rounded object-cover object-top ${f.oculto ? 'opacity-40' : ''}`} />
                <div className="min-w-0 flex-1 basis-48">
                  <p className="truncate font-semibold text-flora-800">{salvo?.nome ?? p.nome}{f.oculto && <span className="ml-2 rounded bg-tinta-suave px-1.5 py-0.5 text-xs font-normal text-white">oculto</span>}</p>
                  <p className="text-xs text-tinta-suave">
                    {TIPOS[p.tipo]} · original {p.preco != null ? brl(p.preco) : 'sem preço'}
                    {salvo && <span className="ml-1 font-semibold text-mel-600">· alterado</span>}
                  </p>
                  {msg[p.id] && <p className="text-xs text-flora-600">{msg[p.id]}</p>}
                </div>
                <label className="text-xs text-tinta-suave">
                  Preço
                  <input inputMode="decimal" value={f.preco} onChange={(e) => editar(p.id, { preco: e.target.value })} placeholder={fmt(p.preco) || '0,00'} className={`${campo} block`} />
                </label>
                <label className="text-xs text-tinta-suave">
                  Promocional {pct > 0 && <b className="text-mel-600">{pct}% OFF</b>}
                  <input inputMode="decimal" value={f.promo} onChange={(e) => editar(p.id, { promo: e.target.value })} placeholder="—" className={`${campo} block`} />
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" checked={f.oculto} onChange={(e) => editar(p.id, { oculto: e.target.checked })} /> Ocultar
                </label>
                <button onClick={() => setAberto(aberto === p.id ? null : p.id)} className="rounded-lg border border-areia-300 px-3 py-1.5 text-sm text-tinta-suave hover:bg-areia-100">
                  Texto
                </button>
                <button onClick={() => salvar(p.id, p.preco)} disabled={!sujo} className="rounded-lg bg-flora-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40">
                  Salvar
                </button>
                {salvo && (
                  <button onClick={() => restaurar(p.id)} className="rounded-lg border border-areia-300 px-3 py-1.5 text-sm text-tinta-suave hover:bg-areia-100">
                    Restaurar
                  </button>
                )}
              </div>
              {aberto === p.id && (
                <div className="grid gap-2 pl-14">
                  <input value={f.nome} onChange={(e) => editar(p.id, { nome: e.target.value })} placeholder={`Nome (original: ${p.nome})`} maxLength={120} className="rounded-lg border border-areia-300 px-3 py-2 outline-none focus:border-flora-500" />
                  <textarea value={f.descricao} onChange={(e) => editar(p.id, { descricao: e.target.value })} placeholder={`Descrição (original: ${p.descricao})`} rows={3} maxLength={2000} className="rounded-lg border border-areia-300 px-3 py-2 outline-none focus:border-flora-500" />
                  <p className="text-xs text-tinta-suave">Deixe em branco para usar o texto original. A arte (imagem) não muda: o texto dentro dela continua o mesmo.</p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
