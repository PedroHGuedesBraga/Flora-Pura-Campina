'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { MOSTRAR_PRECO, TIPOS, brl, produtos as base, type Produto } from '@/lib';
import { useProdutos } from '@/components/Dados';

// Número da loja (formato wa.me: DDI + DDD + número, só dígitos)
export const WHATSAPP_LOJA = '5583993786370';
const CHAVE = 'flora-carrinho-v1';

type Itens = Record<string, number>;
type Ctx = {
  itens: Itens;
  total: number;
  adicionar: (id: string) => void;
  alterar: (id: string, delta: number) => void;
  remover: (id: string) => void;
  limpar: () => void;
  aberto: boolean;
  abrir: (v: boolean) => void;
};

const CarrinhoCtx = createContext<Ctx | null>(null);
export const useCarrinho = () => {
  const c = useContext(CarrinhoCtx);
  if (!c) throw new Error('useCarrinho fora do CarrinhoProvider');
  return c;
};

export function CarrinhoProvider({ children }: { children: React.ReactNode }) {
  const [itens, setItens] = useState<Itens>({});
  const [aberto, abrir] = useState(false);
  const [pronto, setPronto] = useState(false);

  // carrega do localStorage (ignora ids que não existem mais no catálogo)
  useEffect(() => {
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE) || '{}') as Itens;
      const ok: Itens = {};
      for (const [id, q] of Object.entries(salvo)) if (base.some((p) => p.id === id) && q > 0) ok[id] = Math.min(99, Math.floor(q));
      setItens(ok);
    } catch {}
    setPronto(true);
  }, []);

  useEffect(() => {
    if (!pronto) return;
    try {
      localStorage.setItem(CHAVE, JSON.stringify(itens));
    } catch {}
  }, [itens, pronto]);

  const alterar = useCallback((id: string, delta: number) => {
    setItens((atual) => {
      const q = Math.min(99, (atual[id] ?? 0) + delta);
      const { [id]: _, ...resto } = atual;
      return q > 0 ? { ...resto, [id]: q } : resto;
    });
  }, []);
  const adicionar = useCallback((id: string) => alterar(id, 1), [alterar]);
  const remover = useCallback((id: string) => setItens(({ [id]: _, ...r }) => r), []);
  const limpar = useCallback(() => setItens({}), []);
  const total = useMemo(() => Object.values(itens).reduce((a, b) => a + b, 0), [itens]);

  return (
    <CarrinhoCtx.Provider value={{ itens, total, adicionar, alterar, remover, limpar, aberto, abrir }}>
      {children}
      <Gaveta />
    </CarrinhoCtx.Provider>
  );
}

export function BotaoCarrinho() {
  const { total, abrir } = useCarrinho();
  return (
    <button
      onClick={() => abrir(true)}
      aria-label="Abrir carrinho"
      className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-flora-600 px-5 py-3 font-semibold text-white shadow-lg transition hover:bg-flora-700"
    >
      <ShoppingBag className="size-5" />
      Carrinho
      {total > 0 && <span className="rounded-full bg-mel-400 px-2 py-0.5 text-xs font-bold text-tinta">{total}</span>}
    </button>
  );
}

function montarMensagem(linhas: { p: Produto; q: number }[]) {
  const partes = linhas.map(({ p, q }, i) => {
    const vol = p.volumeMl ? ` ${p.volumeMl}ml` : '';
    const preco = MOSTRAR_PRECO && p.preco != null ? ` (${brl(p.preco)} cada)` : '';
    return `${i + 1}. ${q}x ${p.nome}${vol} — ${TIPOS[p.tipo]}${preco}${p.codigo ? ` [cód. ${p.codigo}]` : ''}`;
  });
  const soma = linhas.reduce((s, { p, q }) => s + (p.preco ?? 0) * q, 0);
  const semPreco = linhas.some(({ p }) => p.preco == null);
  const totalTxt = MOSTRAR_PRECO && soma > 0 ? `\n\nTotal estimado: ${brl(soma)}${semPreco ? ' (+ itens sem preço informado)' : ''}` : '';
  return `Olá! Gostaria de fazer um pedido:\n\n${partes.join('\n')}${totalTxt}`;
}

function Gaveta() {
  const { itens, total, alterar, remover, limpar, aberto, abrir } = useCarrinho();
  const produtos = useProdutos();
  const linhas = useMemo(
    () => Object.entries(itens).flatMap(([id, q]) => { const p = produtos.find((x) => x.id === id); return p ? [{ p, q }] : []; }),
    [itens, produtos],
  );
  const soma = linhas.reduce((s, { p, q }) => s + (p.preco ?? 0) * q, 0);
  const link = `https://wa.me/${WHATSAPP_LOJA}?text=${encodeURIComponent(montarMensagem(linhas))}`;

  if (!aberto) return null;
  return (
    <div className="animate-fundo fixed inset-0 z-50 flex justify-end bg-tinta/60" onClick={() => abrir(false)}>
      <aside className="flex h-full w-full max-w-md flex-col bg-creme shadow-xl" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-areia-200 p-4">
          <h2 className="font-display text-2xl text-flora-800">Seu carrinho</h2>
          <button onClick={() => abrir(false)} aria-label="Fechar" className="rounded-full p-2 text-tinta-suave hover:bg-areia-100">
            <X className="size-5" />
          </button>
        </header>

        {linhas.length === 0 ? (
          <p className="flex-1 p-8 text-center text-tinta-suave">Seu carrinho está vazio.</p>
        ) : (
          <ul className="flex-1 space-y-3 overflow-auto p-4">
            {linhas.map(({ p, q }) => (
              <li key={p.id} className="flex gap-3 rounded-xl border border-areia-200 bg-white p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.imagem.site} alt="" className="h-20 w-16 shrink-0 rounded-lg object-cover object-top" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-flora-800">{p.nome}</p>
                  <p className="text-xs text-tinta-suave">
                    {TIPOS[p.tipo]}
                    {p.volumeMl ? ` · ${p.volumeMl} ml` : ''}
                  </p>
                  {MOSTRAR_PRECO && p.preco != null && <p className="text-sm font-medium text-flora-700">{brl(p.preco * q)}</p>}
                  <div className="mt-1 flex items-center gap-2">
                    <button onClick={() => alterar(p.id, -1)} aria-label="Menos" className="rounded-full border border-areia-300 p-1 hover:bg-areia-100">
                      <Minus className="size-3.5" />
                    </button>
                    <span className="w-6 text-center text-sm font-semibold">{q}</span>
                    <button onClick={() => alterar(p.id, 1)} aria-label="Mais" className="rounded-full border border-areia-300 p-1 hover:bg-areia-100">
                      <Plus className="size-3.5" />
                    </button>
                    <button onClick={() => remover(p.id)} aria-label="Remover" className="ml-auto rounded-full p-1.5 text-perigo-600 hover:bg-perigo-50">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {linhas.length > 0 && (
          <footer className="space-y-3 border-t border-areia-200 p-4">
            <div className="flex justify-between text-sm">
              <span className="text-tinta-suave">{total} {total === 1 ? 'item' : 'itens'}</span>
              {MOSTRAR_PRECO && soma > 0 && <span className="font-semibold text-flora-700">Total: {brl(soma)}</span>}
            </div>
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-xl bg-[#25d366] py-3 text-center font-semibold text-white transition hover:brightness-95"
            >
              Enviar pedido pelo WhatsApp
            </a>
            <button onClick={limpar} className="w-full text-sm text-tinta-suave underline-offset-2 hover:underline">
              Limpar carrinho
            </button>
          </footer>
        )}
      </aside>
    </div>
  );
}
