'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { produtos as base, type Produto } from '@/lib';

// Lista de produtos com os preços alterados no painel (D1) aplicados por cima do catalogo.json.
// Se a API falhar, o site continua com os preços do catalogo.json.
const Ctx = createContext<Produto[]>(base);
export const useProdutos = () => useContext(Ctx);

export function DadosProvider({ children }: { children: React.ReactNode }) {
  const [precos, setPrecos] = useState<Record<string, number>>({});

  useEffect(() => {
    let vivo = true;
    fetch('/api/precos')
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => vivo && typeof d === 'object' && d && setPrecos(d as Record<string, number>))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  const lista = useMemo(() => base.map((p) => (precos[p.id] != null ? { ...p, preco: precos[p.id] } : p)), [precos]);
  return <Ctx.Provider value={lista}>{children}</Ctx.Provider>;
}
