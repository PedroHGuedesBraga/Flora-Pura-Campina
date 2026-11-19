// Worker do catálogo: serve a API de preços (D1) e deixa o resto para os arquivos estáticos (pasta out).
//
// GET    /api/precos            público: { "<id>": preco, ... } (só os preços alterados no painel)
// GET    /api/admin/precos      admin: mesmo conteúdo + data da alteração
// PUT    /api/admin/precos/:id  admin: { "preco": 123.45 }
// DELETE /api/admin/precos/:id  admin: volta ao preço original do catalogo.json
//
// /api/admin/* exige o token do Cloudflare Access (cabeçalho Cf-Access-Jwt-Assertion), conferido aqui.

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  ACCESS_TEAM_DOMAIN?: string; // ex.: meuteam.cloudflareaccess.com
  ACCESS_AUD?: string; // "Application Audience (AUD) Tag" do app no Access
  DEV_BYPASS_ACCESS?: string; // "1" só em desenvolvimento local (.dev.vars)
}

const json = (data: unknown, status = 200, extra: HeadersInit = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...extra } });

let tabelaPronta = false;
async function garantirTabela(db: D1Database) {
  if (tabelaPronta) return;
  await db.exec('CREATE TABLE IF NOT EXISTS precos (id TEXT PRIMARY KEY, preco REAL NOT NULL, atualizado TEXT NOT NULL)');
  tabelaPronta = true;
}

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

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    if (!path.startsWith('/api/')) return env.ASSETS.fetch(req);

    await garantirTabela(env.DB);

    if (path === '/api/precos' && req.method === 'GET') {
      const { results } = await env.DB.prepare('SELECT id, preco FROM precos').all<{ id: string; preco: number }>();
      return json(Object.fromEntries(results.map((r) => [r.id, r.preco])), 200, { 'cache-control': 'public, max-age=60' });
    }

    if (path.startsWith('/api/admin/')) {
      if (!(await acessoValido(req, env))) return json({ erro: 'não autorizado' }, 401);

      if (path === '/api/admin/precos' && req.method === 'GET') {
        const { results } = await env.DB.prepare('SELECT id, preco, atualizado FROM precos').all();
        return json(results, 200, { 'cache-control': 'no-store' });
      }

      const m = path.match(/^\/api\/admin\/precos\/([a-z0-9-]{1,120})$/);
      if (m && req.method === 'PUT') {
        const body = (await req.json().catch(() => null)) as { preco?: unknown } | null;
        const preco = body?.preco;
        if (typeof preco !== 'number' || !Number.isFinite(preco) || preco < 0 || preco > 100000) return json({ erro: 'preço inválido' }, 400);
        const valor = Math.round(preco * 100) / 100;
        await env.DB.prepare('INSERT INTO precos (id, preco, atualizado) VALUES (?1, ?2, ?3) ON CONFLICT(id) DO UPDATE SET preco = ?2, atualizado = ?3')
          .bind(m[1], valor, new Date().toISOString())
          .run();
        return json({ id: m[1], preco: valor });
      }
      if (m && req.method === 'DELETE') {
        await env.DB.prepare('DELETE FROM precos WHERE id = ?1').bind(m[1]).run();
        return json({ id: m[1], removido: true });
      }
    }

    return json({ erro: 'não encontrado' }, 404);
  },
} satisfies ExportedHandler<Env>;
