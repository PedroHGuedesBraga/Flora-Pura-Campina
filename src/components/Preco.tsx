import { MOSTRAR_PRECO, brl, desconto, emPromocao, valor, type Produto } from '@/lib';

// Sem promoção: "R$ 89,90". Com promoção: "de: R$ 89,90  por: R$ 50,30  44% OFF".
export default function Preco({ p, grande = false }: { p: Produto; grande?: boolean }) {
  if (!MOSTRAR_PRECO || p.preco == null) return null;
  if (!emPromocao(p)) return <p className={`font-semibold text-flora-700 ${grande ? 'text-xl' : ''}`}>{brl(p.preco)}</p>;
  const pct = desconto(p);
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className="text-sm text-tinta-suave">
        de: <s>{brl(p.preco)}</s>
      </span>
      <span className={`font-semibold text-flora-700 ${grande ? 'text-xl' : ''}`}>por: {brl(valor(p) as number)}</span>
      {pct > 0 && <span className="rounded-full bg-mel-100 px-2 py-0.5 text-xs font-bold text-mel-600">{pct}% OFF</span>}
    </div>
  );
}
