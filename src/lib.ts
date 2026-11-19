import dados from '@data/catalogo.json';

export type Nota = { nivel: string; legenda: string; itens: string[] };
export type Produto = {
  id: string;
  nome: string;
  categoria: 'perfume' | 'bodysplash';
  tipo: string;
  linha: string | null;
  genero: 'masculino' | 'feminino' | 'unissex' | 'infantil';
  volumeMl: number | null;
  subtitulo: string;
  descricao: string;
  familiaOlfativa: string | null;
  intensidade: number | null;
  destaque: string | null;
  cor: string | null;
  notas: Nota[];
  preco: number | null;
  disponivel: boolean | null;
  codigo: string | null;
  nomeNoSistema: string | null;
  imagem: { site: string; siteJpg: string };
  // vindos do painel (D1)
  promo?: number | null;
  oculto?: boolean;
};

export const produtos = dados as Produto[];

// Preço de varejo visível por padrão. Para esconder: NEXT_PUBLIC_MOSTRAR_PRECO=0.
export const MOSTRAR_PRECO = process.env.NEXT_PUBLIC_MOSTRAR_PRECO !== '0';

export const TIPOS: Record<string, string> = {
  perfume: 'Perfumes',
  colonia: 'Colônias',
  'deo-parfum': 'Deo Parfum',
  'deo-colonia': 'Deo Colônia',
  flaconete: 'Flaconetes',
  'body-splash': 'Body Splash',
};
export const GENEROS: Record<string, string> = { feminino: 'Feminino', masculino: 'Masculino', unissex: 'Unissex', infantil: 'Infantil' };

export const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Preço efetivo: promocional só vale se for menor que o preço normal.
export const emPromocao = (p: Produto) => p.preco != null && p.promo != null && p.promo < p.preco;
export const valor = (p: Produto) => (emPromocao(p) ? (p.promo as number) : p.preco);
// Percentual inteiro de desconto (sem casas decimais); 0 se arredondar para menos de 1%.
export const desconto = (p: Produto) => (emPromocao(p) ? Math.round((1 - (p.promo as number) / (p.preco as number)) * 100) : 0);

// ---- cupom ----
export type Cupom = { codigo: string; pct: number; usoUnico: boolean };
export const soDigitos = (s: string) => s.replace(/\D/g, '');
export function cpfValido(c: string): boolean {
  if (!/^\d{11}$/.test(c) || /^(\d)\1{10}$/.test(c)) return false;
  for (const n of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(c[i]) * (n + 1 - i);
    if (((soma * 10) % 11) % 10 !== Number(c[n])) return false;
  }
  return true;
}
export const mascaraCpf = (s: string) =>
  soDigitos(s).slice(0, 11).replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1-$2');
// Cupom só vale em itens SEM preço promocional.
export const elegivelCupom = (p: Produto) => p.preco != null && !emPromocao(p);
