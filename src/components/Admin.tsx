'use client';

import { useEffect, useMemo, useState } from 'react';
import { TIPOS, brl, produtos } from '@/lib';

type Linha = { id: string; preco: number; atualizado: string };

// A tela fica atrás do Cloudflare Access; a API confere o token de novo.
export default function Admin() {
  const [alterados, setAlterados] = useState<Record<string, Linha>>({});
  const [rascunho, setRascunho] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<Record<string, string>>({});
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');

  useEffect(() => {
    fetch('/api/admin/precos', { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status === 401 ? 'Sem autorização (login do Access ausente ou não configurado).' : 'Falha ao carregar.');
        return (await r.json()) as Linha[];
      })
      .then((l) => setAlterados(Object.fromEntries(l.map((x) => [x.id, x]))))
      .catch((e: Error) => setErro(e.message));
  }, []);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return produtos.filter((p) => !q || `${p.nome} ${p.codigo ?? ''}`.toLowerCase().includes(q));
  }, [busca]);

  const atual = (id: string, original: number | null) => alterados[id]?.preco ?? original;

  async function salvar(id: string) {
    const v = Number((rascunho[id] ?? '').replace(',', '.'));
    if (!Number.isFinite(v) || v < 0) return setMsg((m) => ({ ...m, [id]: 'Valor inválido' }));
    const r = await fetch(`/api/admin/precos/${id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ preco: v }) });
    if (!r.ok) return setMsg((m) => ({ ...m, [id]: 'Erro ao salvar' }));
    const d = (await r.json()) as { preco: number };
    setAlterados((a) => ({ ...a, [id]: { id, preco: d.preco, atualizado: new Date().toISOString() } }));
    setRascunho((x) => { const { [id]: _, ...rest } = x; return rest; });
    setMsg((m) => ({ ...m, [id]: 'Salvo' }));
  }

  async function restaurar(id: string) {
    const r = await fetch(`/api/admin/precos/${id}`, { method: 'DELETE' });
    if (!r.ok) return setMsg((m) => ({ ...m, [id]: 'Erro ao restaurar' }));
    setAlterados((a) => { const { [id]: _, ...rest } = a; return rest; });
    setMsg((m) => ({ ...m, [id]: 'Voltou ao preço original' }));
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-display text-3xl text-flora-700">Painel de preços</h1>
      <p className="mt-1 text-sm text-tinta-suave">O preço salvo aqui vale no site na hora (até 1 minuto de cache). “Restaurar” volta ao preço do sistema da loja.</p>
      {erro && <p className="mt-4 rounded-xl bg-perigo-50 p-3 text-perigo-600">{erro}</p>}
      <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou código" className="mt-4 w-full rounded-xl border border-areia-300 bg-white px-3 py-2.5 outline-none focus:border-flora-500" />

      <ul className="mt-4 divide-y divide-areia-200 rounded-2xl border border-areia-200 bg-white">
        {lista.map((p) => {
          const mudou = alterados[p.id] != null;
          return (
            <li key={p.id} className="flex flex-wrap items-center gap-3 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.imagem.site} alt="" className="h-14 w-11 rounded object-cover object-top" />
              <div className="min-w-0 flex-1 basis-48">
                <p className="truncate font-semibold text-flora-800">{p.nome}</p>
                <p className="text-xs text-tinta-suave">
                  {TIPOS[p.tipo]} · original {p.preco != null ? brl(p.preco) : 'sem preço'}
                  {mudou && <span className="ml-1 font-semibold text-mel-600">· no site: {brl(alterados[p.id].preco)}</span>}
                </p>
                {msg[p.id] && <p className="text-xs text-flora-600">{msg[p.id]}</p>}
              </div>
              <input
                inputMode="decimal"
                value={rascunho[p.id] ?? ''}
                onChange={(e) => setRascunho((r) => ({ ...r, [p.id]: e.target.value }))}
                placeholder={atual(p.id, p.preco)?.toFixed(2).replace('.', ',') ?? '0,00'}
                className="w-28 rounded-lg border border-areia-300 px-2 py-1.5 text-right outline-none focus:border-flora-500"
              />
              <button onClick={() => salvar(p.id)} disabled={!rascunho[p.id]} className="rounded-lg bg-flora-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40">
                Salvar
              </button>
              {mudou && (
                <button onClick={() => restaurar(p.id)} className="rounded-lg border border-areia-300 px-3 py-1.5 text-sm text-tinta-suave hover:bg-areia-100">
                  Restaurar
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
