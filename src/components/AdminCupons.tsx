'use client';

import { useEffect, useState } from 'react';
import { mascaraCpf } from '@/lib';

type Cupom = { codigo: string; pct: number; uso_unico: number; ativo: number; usos: number };
type Cliente = { cpf: string; nome: string; atualizado: string; cupons: string | null };

const campo = 'rounded-lg border border-areia-300 px-2 py-1.5 outline-none focus:border-flora-500';

// Cupons (código + % de desconto, uso único por CPF ou ilimitado) e clientes que já usaram cupom.
export default function AdminCupons() {
  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [codigo, setCodigo] = useState('');
  const [pct, setPct] = useState('');
  const [unico, setUnico] = useState(true);
  const [msg, setMsg] = useState('');

  async function carregar() {
    const [a, b] = await Promise.all([fetch('/api/admin/cupons', { cache: 'no-store' }), fetch('/api/admin/clientes', { cache: 'no-store' })]);
    if (a.ok) setCupons((await a.json()) as Cupom[]);
    if (b.ok) setClientes((await b.json()) as Cliente[]);
  }
  useEffect(() => {
    carregar().catch(() => {});
  }, []);

  async function salvar(c: string, p: number, u: boolean, ativo: boolean) {
    setMsg('');
    const r = await fetch(`/api/admin/cupons/${encodeURIComponent(c)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pct: p, usoUnico: u, ativo }),
    });
    if (!r.ok) return setMsg('Erro ao salvar (código: 2 a 30 letras/números; desconto: inteiro de 1 a 100)');
    await carregar();
  }
  async function apagar(c: string) {
    if (!confirm(`Apagar o cupom ${c}? Os registros de uso dele também são apagados.`)) return;
    await fetch(`/api/admin/cupons/${encodeURIComponent(c)}`, { method: 'DELETE' });
    await carregar();
  }

  return (
    <section className="mx-auto max-w-5xl px-4 pt-8">
      <h2 className="font-display text-2xl text-flora-700">Cupons</h2>
      <p className="mt-1 text-sm text-tinta-suave">O cupom vale só para itens sem preço promocional. “Uso único” = 1 vez por CPF (o cliente informa CPF e nome completo); senão, ilimitado.</p>

      <form
        className="mt-3 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const p = Number(pct);
          if (!codigo.trim() || !Number.isInteger(p)) return setMsg('Informe o código e o desconto (inteiro)');
          salvar(codigo.trim(), p, unico, true).then(() => { setCodigo(''); setPct(''); });
        }}
      >
        <label className="text-xs text-tinta-suave">
          Código
          <input value={codigo} onChange={(e) => setCodigo(e.target.value)} maxLength={30} placeholder="FLORA10" className={`${campo} block w-40 uppercase`} />
        </label>
        <label className="text-xs text-tinta-suave">
          Desconto (%)
          <input value={pct} onChange={(e) => setPct(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="10" className={`${campo} block w-24 text-right`} />
        </label>
        <label className="flex items-center gap-1.5 pb-2 text-sm">
          <input type="checkbox" checked={unico} onChange={(e) => setUnico(e.target.checked)} /> Uso único por CPF
        </label>
        <button className="rounded-lg bg-flora-600 px-4 py-2 text-sm font-semibold text-white">Criar / atualizar</button>
      </form>
      {msg && <p className="mt-2 text-sm text-perigo-600">{msg}</p>}

      <ul className="mt-3 divide-y divide-areia-200 rounded-2xl border border-areia-200 bg-white">
        {cupons.length === 0 && <li className="p-3 text-sm text-tinta-suave">Nenhum cupom criado.</li>}
        {cupons.map((c) => (
          <li key={c.codigo} className={`flex flex-wrap items-center gap-3 p-3 ${c.ativo ? '' : 'bg-areia-100/60 opacity-70'}`}>
            <span className="min-w-28 font-semibold text-flora-800">{c.codigo}</span>
            <span className="text-sm">{c.pct}% OFF</span>
            <span className="text-xs text-tinta-suave">{c.uso_unico ? 'uso único por CPF' : 'ilimitado'} · {c.usos} {c.usos === 1 ? 'uso' : 'usos'}</span>
            <button onClick={() => salvar(c.codigo, c.pct, !!c.uso_unico, !c.ativo)} className="ml-auto rounded-lg border border-areia-300 px-3 py-1.5 text-sm text-tinta-suave hover:bg-areia-100">
              {c.ativo ? 'Desativar' : 'Ativar'}
            </button>
            <button onClick={() => apagar(c.codigo)} className="rounded-lg border border-areia-300 px-3 py-1.5 text-sm text-perigo-600 hover:bg-perigo-50">
              Apagar
            </button>
          </li>
        ))}
      </ul>

      <h3 className="mt-6 font-display text-xl text-flora-700">Clientes ({clientes.length})</h3>
      <ul className="mt-2 divide-y divide-areia-200 rounded-2xl border border-areia-200 bg-white text-sm">
        {clientes.length === 0 && <li className="p-3 text-tinta-suave">Nenhum cliente ainda.</li>}
        {clientes.map((c) => (
          <li key={c.cpf} className="flex flex-wrap gap-x-4 p-3">
            <span className="font-semibold text-flora-800">{c.nome}</span>
            <span className="text-tinta-suave">{mascaraCpf(c.cpf)}</span>
            <span className="text-xs text-tinta-suave">cupons: {c.cupons ?? '—'}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
