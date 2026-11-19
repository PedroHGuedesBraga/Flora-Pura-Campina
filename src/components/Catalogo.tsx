'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { GENEROS, TIPOS, type Produto } from '@/lib';
import Preco from '@/components/Preco';
import { DadosProvider, useAjustesProntos, useProdutos } from '@/components/Dados';
import { BotaoCarrinho, CarrinhoProvider, useCarrinho } from '@/components/Carrinho';

function BotaoAdicionar({ id }: { id: string }) {
  const { itens, adicionar } = useCarrinho();
  const q = itens[id] ?? 0;
  return (
    <button onClick={() => adicionar(id)} className="w-full rounded-xl bg-flora-600 py-2 text-sm font-semibold text-white transition hover:bg-flora-700">
      {q > 0 ? `Adicionar mais (${q} no carrinho)` : 'Adicionar ao carrinho'}
    </button>
  );
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function Chip({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
        ativo ? 'border-flora-600 bg-flora-600 text-white' : 'border-areia-300 bg-white text-tinta-suave hover:border-flora-400'
      }`}
    >
      {children}
    </button>
  );
}

function Cartao({ p, abrir }: { p: Produto; abrir: () => void }) {
  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-areia-200 bg-white text-left shadow-suave transition hover:-translate-y-0.5 hover:border-flora-300">
      <button onClick={abrir} className="block flex-1 text-left">
        <div className="relative aspect-[3/4] overflow-hidden bg-areia-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.imagem.site} alt={p.nome} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
        </div>
        <div className="p-4 pb-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-mel-600">
            {TIPOS[p.tipo]}
            {p.volumeMl ? ` · ${p.volumeMl} ml` : ''}
          </p>
          <h3 className="mt-1 font-display text-lg leading-snug text-flora-800">{p.nome}</h3>
          <p className="mt-0.5 text-sm text-tinta-suave">
            {GENEROS[p.genero]}
            {p.linha ? ` · Linha ${p.linha}` : ''}
          </p>
          <div className="mt-2"><Preco p={p} /></div>
        </div>
      </button>
      <div className="p-4 pt-2">
        <BotaoAdicionar id={p.id} />
      </div>
    </div>
  );
}

function Detalhe({ p, fechar }: { p: Produto; fechar: () => void }) {
  return (
    <div className="animate-fundo fixed inset-0 z-50 flex items-end justify-center bg-tinta/60 p-0 sm:items-center sm:p-6" onClick={fechar}>
      <div className="animate-surgir max-h-[92dvh] w-full max-w-4xl overflow-auto rounded-t-2xl bg-creme sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="grid gap-0 md:grid-cols-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.imagem.site} alt={p.nome} className="w-full bg-areia-100 object-cover" />
          <div className="space-y-4 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-mel-600">{TIPOS[p.tipo]}</p>
                <h2 className="font-display text-3xl text-flora-800">{p.nome}</h2>
                <p className="text-sm text-tinta-suave">{p.subtitulo}</p>
              </div>
              <button onClick={fechar} className="rounded-full border border-areia-300 px-3 py-1 text-sm text-tinta-suave hover:bg-areia-100">
                Fechar
              </button>
            </div>
            <p className="leading-relaxed">{p.descricao}</p>
            {p.familiaOlfativa && (
              <p className="text-sm">
                <span className="font-semibold">Família olfativa:</span> {p.familiaOlfativa}
              </p>
            )}
            {p.notas.length > 0 && (
              <div className="space-y-2">
                {p.notas.map((n) => (
                  <div key={n.nivel} className="rounded-xl bg-areia-100 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-flora-700">
                      {n.nivel} <span className="font-normal normal-case text-tinta-suave">· {n.legenda}</span>
                    </p>
                    <p className="mt-1 text-sm">{n.itens.join(' · ')}</p>
                  </div>
                ))}
              </div>
            )}
            <Preco p={p} grande />
            <BotaoAdicionar id={p.id} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Catalogo() {
  return (
    <DadosProvider>
      <CarrinhoProvider>
        <Vitrine />
        <BotaoCarrinho />
      </CarrinhoProvider>
    </DadosProvider>
  );
}

function Vitrine() {
  const todos = useProdutos();
  const pronto = useAjustesProntos();
  const produtos = useMemo(() => todos.filter((p) => !p.oculto), [todos]);
  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState('');
  const [genero, setGenero] = useState('');
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const aberto = produtos.find((p) => p.id === abertoId) ?? null;

  const tipos = useMemo(() => Object.keys(TIPOS).filter((t) => produtos.some((p) => p.tipo === t)), [produtos]);
  const lista = useMemo(() => {
    const q = norm(busca);
    return produtos.filter(
      (p) =>
        (!tipo || p.tipo === tipo) &&
        (!genero || p.genero === genero) &&
        (!q || norm(`${p.nome} ${p.linha ?? ''} ${p.notas.flatMap((n) => n.itens).join(' ')}`).includes(q)),
    );
  }, [produtos, busca, tipo, genero]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="mb-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-mel-600">Catálogo</p>
        <h1 className="font-display text-4xl text-flora-700 sm:text-5xl">Flora Pura</h1>
        <p className="mt-2 text-tinta-suave">Perfumes, colônias e body splashes</p>
      </header>

      <div className="sticky top-0 z-10 -mx-4 mb-6 space-y-3 border-b border-areia-200 bg-creme/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <label className="relative block">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-tinta-suave" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, linha ou nota olfativa"
            className="w-full rounded-xl border border-areia-300 bg-white py-2.5 pl-9 pr-3 outline-none focus:border-flora-500"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Chip ativo={!tipo} onClick={() => setTipo('')}>
            Todos
          </Chip>
          {tipos.map((t) => (
            <Chip key={t} ativo={tipo === t} onClick={() => setTipo(tipo === t ? '' : t)}>
              {TIPOS[t]}
            </Chip>
          ))}
          <span className="mx-1 hidden w-px bg-areia-300 sm:block" />
          {Object.entries(GENEROS).map(([k, v]) => (
            <Chip key={k} ativo={genero === k} onClick={() => setGenero(genero === k ? '' : k)}>
              {v}
            </Chip>
          ))}
        </div>
      </div>

      <p className="mb-4 text-sm text-tinta-suave">
        {lista.length} {lista.length === 1 ? 'item' : 'itens'}
      </p>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {!pronto && Array.from({ length: 8 }, (_, i) => <div key={i} className="aspect-[3/5] animate-pulse rounded-2xl bg-areia-100" />)}
        {pronto && lista.map((p) => (
          <Cartao key={p.id} p={p} abrir={() => setAbertoId(p.id)} />
        ))}
      </div>
      {pronto && lista.length === 0 && <p className="py-20 text-center text-tinta-suave">Nada encontrado.</p>}
      {aberto && <Detalhe p={aberto} fechar={() => setAbertoId(null)} />}
    </main>
  );
}
