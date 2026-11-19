'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { produtos as base, type Produto } from '@/lib';

type Ajuste = { preco?: number; promo?: number; oculto?: boolean; nome?: string; descricao?: string };

// Lista de produtos com os ajustes do painel (D1) aplicados por cima do catalogo.json.
// Itens ocultos continuam na lista (com oculto: true) para o carrinho poder removê-los; a vitrine filtra.
// Se a API falhar, o site continua com o catalogo.json.
const Ctx = createContext<Produto[]>(base);
const ProntoCtx = createContext(true);
export const useProdutos = () => useContext(Ctx);
// false até a API responder (ou falhar): evita mostrar preço antigo / item oculto por um instante
export const useAjustesProntos = () => useContext(ProntoCtx);

export function DadosProvider({ children }: { children: React.ReactNode }) {
  const [ajustes, setAjustes] = useState<Record<string, Ajuste>>({});
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch('/api/ajustes', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => vivo && typeof d === 'object' && d && setAjustes(d as Record<string, Ajuste>))
      .catch(() => {})
      .finally(() => vivo && setPronto(true));
    return () => {
      vivo = false;
    };
  }, []);

  const lista = useMemo(
    () =>
      base.map((p) => {
        const a = ajustes[p.id];
        if (!a) return p;
        return {
          ...p,
          preco: a.preco ?? p.preco,
          promo: a.promo ?? null,
          oculto: !!a.oculto,
          nome: a.nome ?? p.nome,
          descricao: a.descricao ?? p.descricao,
        };
      }),
    [ajustes],
  );
  return (
    <ProntoCtx.Provider value={pronto}>
      <Ctx.Provider value={lista}>{children}</Ctx.Provider>
    </ProntoCtx.Provider>
  );
}
