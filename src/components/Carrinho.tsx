'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { MOSTRAR_PRECO, TIPOS, brl, cpfValido, desconto, elegivelCupom, emPromocao, mascaraCpf, soDigitos, valor, produtos as base, type Cupom, type Produto } from '@/lib';
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
  const todos = useProdutos();
  const total = useMemo(
    () => Object.entries(itens).reduce((a, [id, q]) => a + (todos.find((p) => p.id === id)?.oculto ? 0 : q), 0),
    [itens, todos],
  );

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

type Linha = { p: Produto; q: number };
// Desconto do cupom: só nos itens sem preço promocional (arredondado em centavos)
const descontoCupom = (linhas: Linha[], cupom: Cupom | null) =>
  cupom ? Math.round(linhas.filter(({ p }) => elegivelCupom(p)).reduce((s, { p, q }) => s + (p.preco as number) * q, 0) * cupom.pct) / 100 : 0;

function montarMensagem(linhas: Linha[], cupom: Cupom | null, cliente: { cpf: string; nome: string } | null) {
  const partes = linhas.map(({ p, q }, i) => {
    const vol = p.volumeMl ? ` ${p.volumeMl}ml` : '';
    const preco = !MOSTRAR_PRECO || p.preco == null ? '' : emPromocao(p) ? ` (de ${brl(p.preco)} por ${brl(valor(p) as number)} cada, ${desconto(p)}% OFF)` : ` (${brl(p.preco)} cada)`;
    return `${i + 1}. ${q}x ${p.nome}${vol} — ${TIPOS[p.tipo]}${preco}${p.codigo ? ` [cód. ${p.codigo}]` : ''}`;
  });
  const soma = linhas.reduce((s, { p, q }) => s + (valor(p) ?? 0) * q, 0);
  const semPreco = linhas.some(({ p }) => p.preco == null);
  const desc = descontoCupom(linhas, cupom);
  const cupomTxt = cupom && desc > 0 ? `\n\nCupom ${cupom.codigo} (${cupom.pct}% nos itens sem promoção): -${brl(desc)}` : '';
  const totalTxt = MOSTRAR_PRECO && soma > 0 ? `${cupomTxt}\n\nTotal estimado: ${brl(soma - desc)}${semPreco ? ' (+ itens sem preço informado)' : ''}` : '';
  const clienteTxt = cupom?.usoUnico && cliente ? `\n\nCliente: ${cliente.nome}\nCPF: ${mascaraCpf(cliente.cpf)}` : '';
  return `Olá! Gostaria de fazer um pedido:\n\n${partes.join('\n')}${totalTxt}${clienteTxt}`;
}

function Gaveta() {
  const { itens, total, alterar, remover, limpar, aberto, abrir } = useCarrinho();
  const produtos = useProdutos();
  const linhas = useMemo<Linha[]>(
    () => Object.entries(itens).flatMap(([id, q]) => { const p = produtos.find((x) => x.id === id); return p && !p.oculto ? [{ p, q }] : []; }),
    [itens, produtos],
  );
  const soma = linhas.reduce((s, { p, q }) => s + (valor(p) ?? 0) * q, 0);
  const [codigo, setCodigo] = useState('');
  const [cupom, setCupom] = useState<Cupom | null>(null);
  const [cpf, setCpf] = useState('');
  const [nome, setNome] = useState('');
  const [erroCupom, setErroCupom] = useState('');
  const [enviando, setEnviando] = useState(false);

  const temElegivel = linhas.some(({ p }) => elegivelCupom(p));
  const cupomAtivo = cupom && temElegivel ? cupom : null; // carrinho todo em promoção: cupom não vale
  const desc = descontoCupom(linhas, cupomAtivo);
  const cliente = cupomAtivo?.usoUnico ? { cpf: soDigitos(cpf), nome: nome.trim().replace(/\s+/g, ' ') } : null;
  const clienteOk = !cliente || (cpfValido(cliente.cpf) && cliente.nome.length >= 5 && cliente.nome.includes(' '));
  const link = `https://wa.me/${WHATSAPP_LOJA}?text=${encodeURIComponent(montarMensagem(linhas, cupomAtivo, cliente))}`;

  async function aplicar() {
    setErroCupom('');
    if (!codigo.trim()) return;
    try {
      const r = await fetch('/api/cupom/validar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ codigo }) });
      if (!r.ok) return setErroCupom('Cupom inválido');
      setCupom((await r.json()) as Cupom);
    } catch {
      setErroCupom('Não foi possível validar o cupom agora');
    }
  }
  function tirarCupom() {
    setCupom(null);
    setCodigo('');
    setErroCupom('');
  }

  // Cupom de uso único: registra o uso (CPF + nome) antes de abrir o WhatsApp
  async function enviarComCupom() {
    if (!cupomAtivo || !cliente) return;
    setErroCupom('');
    if (!cpfValido(cliente.cpf)) return setErroCupom('CPF inválido');
    if (!clienteOk) return setErroCupom('Informe o nome completo');
    setEnviando(true);
    const w = window.open('', '_blank'); // abre antes do await para o navegador não bloquear
    try {
      const r = await fetch('/api/cupom/usar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ codigo: cupomAtivo.codigo, cpf: cliente.cpf, nome: cliente.nome }),
      });
      if (!r.ok) {
        w?.close();
        const d = (await r.json().catch(() => ({}))) as { erro?: string };
        return setErroCupom(d.erro ?? 'Não foi possível usar o cupom');
      }
      if (w) w.location.href = link;
      else window.location.href = link;
    } catch {
      w?.close();
      setErroCupom('Não foi possível usar o cupom agora');
    } finally {
      setEnviando(false);
    }
  }
  const botao = 'block w-full rounded-xl bg-[#25d366] py-3 text-center font-semibold text-white transition hover:brightness-95';

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
                  {MOSTRAR_PRECO && valor(p) != null && <p className="text-sm font-medium text-flora-700">{brl((valor(p) as number) * q)}{emPromocao(p) && <span className="ml-1 text-xs text-mel-600">{desconto(p)}% OFF</span>}</p>}
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
              {MOSTRAR_PRECO && soma > 0 && <span className="font-semibold text-flora-700">Total: {brl(soma - desc)}</span>}
            </div>
            {MOSTRAR_PRECO && desc > 0 && cupomAtivo && (
              <p className="flex justify-between text-sm text-mel-600">
                <span>Cupom {cupomAtivo.codigo} ({cupomAtivo.pct}% nos itens sem promoção)</span>
                <span>-{brl(desc)}</span>
              </p>
            )}

            {cupom ? (
              <div className="space-y-2 rounded-xl border border-areia-200 bg-white p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-flora-800">Cupom {cupom.codigo} · {cupom.pct}% OFF</span>
                  <button onClick={tirarCupom} className="text-xs text-tinta-suave underline-offset-2 hover:underline">Remover</button>
                </div>
                {!temElegivel ? (
                  <p className="text-xs text-perigo-600">Seu carrinho só tem itens em promoção. O cupom vale apenas para itens sem desconto promocional.</p>
                ) : (
                  <p className="text-xs text-tinta-suave">O desconto vale somente para itens que não estão em promoção.</p>
                )}
                {cupomAtivo?.usoUnico && (
                  <div className="space-y-2">
                    <input value={cpf} onChange={(e) => setCpf(mascaraCpf(e.target.value))} inputMode="numeric" placeholder="CPF" autoComplete="off" className="w-full rounded-lg border border-areia-300 px-3 py-2 outline-none focus:border-flora-500" />
                    <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" maxLength={120} autoComplete="name" className="w-full rounded-lg border border-areia-300 px-3 py-2 outline-none focus:border-flora-500" />
                    <p className="text-xs text-gray-400">*esse cupom só pode ser usado uma vez por CPF*</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex gap-2">
                <input value={codigo} onChange={(e) => setCodigo(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && aplicar()} placeholder="Cupom de desconto" maxLength={30} className="min-w-0 flex-1 rounded-xl border border-areia-300 bg-white px-3 py-2 uppercase outline-none focus:border-flora-500" />
                <button onClick={aplicar} className="rounded-xl border border-flora-600 px-4 py-2 text-sm font-semibold text-flora-700 hover:bg-areia-100">Aplicar</button>
              </div>
            )}
            {erroCupom && <p className="text-xs text-perigo-600">{erroCupom}</p>}

            {cupomAtivo?.usoUnico ? (
              <button onClick={enviarComCupom} disabled={enviando || !clienteOk} className={`${botao} disabled:opacity-50`}>
                {enviando ? 'Enviando...' : 'Enviar pedido pelo WhatsApp'}
              </button>
            ) : (
              <a href={link} target="_blank" rel="noopener noreferrer" className={botao}>
                Enviar pedido pelo WhatsApp
              </a>
            )}
            <button onClick={limpar} className="w-full text-sm text-tinta-suave underline-offset-2 hover:underline">
              Limpar carrinho
            </button>
          </footer>
        )}
      </aside>
    </div>
  );
}
