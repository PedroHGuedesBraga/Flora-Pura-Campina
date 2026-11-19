// Worker do catálogo: API de ajustes (D1) por cima do catalogo.json; o resto vai para os arquivos estáticos (pasta out).
//
// GET    /api/ajustes            público: { "<id>": { preco?, promo?, oculto?, nome?, descricao? } } (só campos alterados)
// GET    /api/admin/ajustes      admin: linhas completas
// PUT    /api/admin/ajustes/:id  admin: { preco, promo, oculto, nome, descricao } (null = sem ajuste); troca a linha inteira
// DELETE /api/admin/ajustes/:id  admin: volta tudo ao catalogo.json
// POST   /api/cupom/validar       público: { codigo } -> { codigo, pct, usoUnico }
// POST   /api/cupom/usar          público: { codigo, cpf?, nome? } registra o uso (cupom de uso único exige CPF + nome completo)
// GET    /api/admin/cupons        admin: lista cupons com nº de usos
// PUT    /api/admin/cupons/:cod   admin: { pct, usoUnico, ativo } cria/atualiza
// DELETE /api/admin/cupons/:cod   admin: apaga o cupom (e seus usos)
// GET    /api/admin/clientes      admin: clientes (CPF + nome) e cupons que usaram
//
// /api/admin/* exige o token do Cloudflare Access (cabeçalho Cf-Access-Jwt-Assertion), conferido aqui.

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  ACCESS_TEAM_DOMAIN?: string; // ex.: meuteam.cloudflareaccess.com
  ACCESS_AUD?: string; // "Application Audience (AUD) Tag" do app no Access
  DEV_BYPASS_ACCESS?: string; // "1" só em desenvolvimento local (.dev.vars)
}

type Linha = { id: string; preco: number | null; promo: number | null; oculto: number; nome: string | null; descricao: string | null; atualizado: string };

const json = (data: unknown, status = 200, extra: HeadersInit = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...extra } });

let tabelaPronta = false;
async function garantirTabela(db: D1Database) {
  if (tabelaPronta) return;
  await db.exec(
    'CREATE TABLE IF NOT EXISTS ajustes (id TEXT PRIMARY KEY, preco REAL, promo REAL, oculto INTEGER NOT NULL DEFAULT 0, nome TEXT, descricao TEXT, atualizado TEXT NOT NULL)',
  );
  // migração única da tabela antiga `precos` (só preço) para `ajustes`
  try {
    await db.exec('INSERT OR IGNORE INTO ajustes (id, preco, atualizado) SELECT id, preco, atualizado FROM precos');
    await db.exec('DROP TABLE precos');
  } catch {
    /* tabela antiga não existe: nada a migrar */
  }
  await db.exec(
    'CREATE TABLE IF NOT EXISTS cupons (codigo TEXT PRIMARY KEY, pct INTEGER NOT NULL, uso_unico INTEGER NOT NULL DEFAULT 1, ativo INTEGER NOT NULL DEFAULT 1, criado TEXT NOT NULL)',
  );
  await db.exec('CREATE TABLE IF NOT EXISTS clientes (cpf TEXT PRIMARY KEY, nome TEXT NOT NULL, criado TEXT NOT NULL, atualizado TEXT NOT NULL)');
  await db.exec(
    'CREATE TABLE IF NOT EXISTS usos_cupom (codigo TEXT NOT NULL, cpf TEXT NOT NULL, criado TEXT NOT NULL, PRIMARY KEY (codigo, cpf))',
  );
  tabelaPronta = true;
}

// CPF: 11 dígitos com dígitos verificadores corretos
function cpfValido(c: string): boolean {
  if (!/^\d{11}$/.test(c) || /^(\d)\1{10}$/.test(c)) return false;
  for (const n of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(c[i]) * (n + 1 - i);
    if (((soma * 10) % 11) % 10 !== Number(c[n])) return false;
  }
  return true;
}
const codigoCupom = (v: unknown) => (typeof v === 'string' && /^[A-Za-z0-9_-]{2,30}$/.test(v.trim()) ? v.trim().toUpperCase() : null);

// ---- Cloudflare Access: valida o JWT (RS256) ----
const b64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
let chaves: { at: number; keys: (JsonWebKey & { kid?: string })[] } | null = null;

async function acessoValido(req: Request, env: Env): Promise<boolean> {
  if (env.DEV_BYPASS_ACCESS === '1') return true;
  const token = req.headers.get('Cf-Access-Jwt-Assertion');
  if (!token || !env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return false; // sem configuração = fechado
  try {
    const [h, p, s] = token.split('.');
    const header = JSON.parse(new TextDecoder().decode(b64(h)));
    const payload = JSON.parse(new TextDecoder().decode(b64(p)));
    if (header.alg !== 'RS256') return false;
    if (payload.iss !== `https://${env.ACCESS_TEAM_DOMAIN}`) return false;
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!aud.includes(env.ACCESS_AUD)) return false;
    if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) return false;
    if (!chaves || Date.now() - chaves.at > 3600_000 || !chaves.keys.some((k) => k.kid === header.kid)) {
      const r = await fetch(`https://${env.ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`);
      if (!r.ok) return false;
      chaves = { at: Date.now(), keys: ((await r.json()) as { keys: (JsonWebKey & { kid?: string })[] }).keys };
    }
    const jwk = chaves.keys.find((k) => k.kid === header.kid);
    if (!jwk) return false;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64(s), new TextEncoder().encode(`${h}.${p}`));
  } catch {
    return false;
  }
}

// ---- validação do corpo do PUT ----
function preco(v: unknown): number | null | undefined {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 100000) return undefined; // undefined = inválido
  return Math.round(v * 100) / 100;
}
function texto(v: unknown, max: number): string | null | undefined {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  if (t.length > max) return undefined;
  return t === '' ? null : t;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    if (!path.startsWith('/api/')) return env.ASSETS.fetch(req);

    await garantirTabela(env.DB);

    if (path === '/api/ajustes' && req.method === 'GET') {
      const { results } = await env.DB.prepare('SELECT id, preco, promo, oculto, nome, descricao FROM ajustes').all<Linha>();
      const out: Record<string, Record<string, unknown>> = {};
      for (const r of results) {
        const a: Record<string, unknown> = {};
        if (r.preco != null) a.preco = r.preco;
        if (r.promo != null) a.promo = r.promo;
        if (r.oculto) a.oculto = true;
        if (r.nome) a.nome = r.nome;
        if (r.descricao) a.descricao = r.descricao;
        out[r.id] = a;
      }
      return json(out, 200, { 'cache-control': 'public, max-age=60' });
    }

    if (path === '/api/cupom/validar' && req.method === 'POST') {
      const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
      const cod = codigoCupom(b?.codigo);
      const c = cod && (await env.DB.prepare('SELECT codigo, pct, uso_unico FROM cupons WHERE codigo = ?1 AND ativo = 1').bind(cod).first<{ codigo: string; pct: number; uso_unico: number }>());
      if (!c) return json({ erro: 'Cupom inválido' }, 404, { 'cache-control': 'no-store' });
      return json({ codigo: c.codigo, pct: c.pct, usoUnico: !!c.uso_unico }, 200, { 'cache-control': 'no-store' });
    }

    if (path === '/api/cupom/usar' && req.method === 'POST') {
      const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
      const cod = codigoCupom(b?.codigo);
      const c = cod && (await env.DB.prepare('SELECT codigo, pct, uso_unico FROM cupons WHERE codigo = ?1 AND ativo = 1').bind(cod).first<{ codigo: string; pct: number; uso_unico: number }>());
      if (!c) return json({ erro: 'Cupom inválido' }, 404);
      if (!c.uso_unico) return json({ ok: true, pct: c.pct });
      const cpf = typeof b?.cpf === 'string' ? b.cpf.replace(/\D/g, '') : '';
      const nome = typeof b?.nome === 'string' ? b.nome.trim().replace(/\s+/g, ' ') : '';
      if (!cpfValido(cpf)) return json({ erro: 'CPF inválido' }, 400);
      if (nome.length < 5 || nome.length > 120 || !nome.includes(' ')) return json({ erro: 'Informe o nome completo' }, 400);
      const agora = new Date().toISOString();
      const r = await env.DB.prepare('INSERT OR IGNORE INTO usos_cupom (codigo, cpf, criado) VALUES (?1, ?2, ?3)').bind(c.codigo, cpf, agora).run();
      if (!r.meta.changes) return json({ erro: 'Este CPF já usou esse cupom' }, 409);
      await env.DB.prepare(
        'INSERT INTO clientes (cpf, nome, criado, atualizado) VALUES (?1, ?2, ?3, ?3) ON CONFLICT(cpf) DO UPDATE SET nome = ?2, atualizado = ?3',
      ).bind(cpf, nome, agora).run();
      return json({ ok: true, pct: c.pct });
    }

    if (path.startsWith('/api/admin/')) {
      if (!(await acessoValido(req, env))) return json({ erro: 'não autorizado' }, 401);

      if (path === '/api/admin/ajustes' && req.method === 'GET') {
        const { results } = await env.DB.prepare('SELECT id, preco, promo, oculto, nome, descricao, atualizado FROM ajustes').all();
        return json(results, 200, { 'cache-control': 'no-store' });
      }

      if (path === '/api/admin/cupons' && req.method === 'GET') {
        const { results } = await env.DB.prepare(
          'SELECT c.codigo, c.pct, c.uso_unico, c.ativo, (SELECT COUNT(*) FROM usos_cupom u WHERE u.codigo = c.codigo) AS usos FROM cupons c ORDER BY c.criado',
        ).all();
        return json(results, 200, { 'cache-control': 'no-store' });
      }
      if (path === '/api/admin/clientes' && req.method === 'GET') {
        const { results } = await env.DB.prepare(
          "SELECT c.cpf, c.nome, c.atualizado, (SELECT group_concat(u.codigo, ', ') FROM usos_cupom u WHERE u.cpf = c.cpf) AS cupons FROM clientes c ORDER BY c.atualizado DESC",
        ).all();
        return json(results, 200, { 'cache-control': 'no-store' });
      }
      const mc = path.match(/^\/api\/admin\/cupons\/([A-Za-z0-9_-]{2,30})$/);
      if (mc && req.method === 'PUT') {
        const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
        const cod = mc[1].toUpperCase();
        const pct = b?.pct;
        if (!b || typeof pct !== 'number' || !Number.isInteger(pct) || pct < 1 || pct > 100 || typeof b.usoUnico !== 'boolean' || typeof b.ativo !== 'boolean')
          return json({ erro: 'dados inválidos' }, 400);
        await env.DB.prepare(
          'INSERT INTO cupons (codigo, pct, uso_unico, ativo, criado) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT(codigo) DO UPDATE SET pct = ?2, uso_unico = ?3, ativo = ?4',
        ).bind(cod, pct, b.usoUnico ? 1 : 0, b.ativo ? 1 : 0, new Date().toISOString()).run();
        return json({ codigo: cod, pct, uso_unico: b.usoUnico ? 1 : 0, ativo: b.ativo ? 1 : 0 });
      }
      if (mc && req.method === 'DELETE') {
        const cod = mc[1].toUpperCase();
        await env.DB.prepare('DELETE FROM usos_cupom WHERE codigo = ?1').bind(cod).run();
        await env.DB.prepare('DELETE FROM cupons WHERE codigo = ?1').bind(cod).run();
        return json({ codigo: cod, removido: true });
      }

      const m = path.match(/^\/api\/admin\/ajustes\/([a-z0-9-]{1,120})$/);
      if (m && req.method === 'PUT') {
        const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
        if (!b) return json({ erro: 'corpo inválido' }, 400);
        const p = preco(b.preco), pr = preco(b.promo), nome = texto(b.nome, 120), desc = texto(b.descricao, 2000);
        if (p === undefined || pr === undefined || nome === undefined || desc === undefined || (b.oculto !== undefined && typeof b.oculto !== 'boolean'))
          return json({ erro: 'dados inválidos' }, 400);
        const oculto = b.oculto ? 1 : 0;
        if (p === null && pr === null && !oculto && nome === null && desc === null) {
          await env.DB.prepare('DELETE FROM ajustes WHERE id = ?1').bind(m[1]).run();
          return json({ id: m[1], removido: true });
        }
        await env.DB.prepare(
          'INSERT INTO ajustes (id, preco, promo, oculto, nome, descricao, atualizado) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) ' +
            'ON CONFLICT(id) DO UPDATE SET preco = ?2, promo = ?3, oculto = ?4, nome = ?5, descricao = ?6, atualizado = ?7',
        )
          .bind(m[1], p, pr, oculto, nome, desc, new Date().toISOString())
          .run();
        return json({ id: m[1], preco: p, promo: pr, oculto: !!oculto, nome, descricao: desc });
      }
      if (m && req.method === 'DELETE') {
        await env.DB.prepare('DELETE FROM ajustes WHERE id = ?1').bind(m[1]).run();
        return json({ id: m[1], removido: true });
      }
    }

    return json({ erro: 'não encontrado' }, 404);
  },
} satisfies ExportedHandler<Env>;
