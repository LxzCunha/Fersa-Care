import fs from 'node:fs/promises';
import request, { type Response } from 'supertest';
import { describe, expect, it } from 'vitest';
import { env } from '../src/config/env.js';
import { app, criarAdmin, criarUsuario, entrarComo, SENHA_PADRAO } from './ajudantes.js';

function cookieDaSessao(resposta: Response): string {
  const cabecalho = resposta.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = cabecalho?.find((valor) => valor.startsWith('fersa_sessao='));
  if (!cookie) throw new Error('A resposta não trouxe o cookie de sessão.');
  return cookie.split(';')[0]!;
}

async function entrar(email: string, senha = SENHA_PADRAO) {
  return cookieDaSessao(await request(app).post('/api/auth/entrar').send({ email, senha }).expect(200));
}

async function quemE(cookie: string): Promise<string | null> {
  const resposta = await request(app).get('/api/auth/eu').set('Cookie', cookie).expect(200);
  return (resposta.body as { usuario: { email: string } | null }).usuario?.email ?? null;
}

describe('Sessões: tokens antigos deixam de valer', () => {
  it('trocar a senha derruba os outros logins e mantém a sessão de quem trocou', async () => {
    const cliente = await criarUsuario();
    const celular = await entrar(cliente.email);
    const computador = await entrar(cliente.email);

    const troca = await request(app)
      .put('/api/auth/eu/senha')
      .set('Cookie', computador)
      .send({ senhaAtual: SENHA_PADRAO, novaSenha: 'NovaSenha123' })
      .expect(204);
    const computadorNovo = cookieDaSessao(troca);

    expect(await quemE(celular)).toBeNull();
    expect(await quemE(computador)).toBeNull();
    expect(await quemE(computadorNovo)).toBe(cliente.email);
    await entrar(cliente.email, 'NovaSenha123');
  });

  it('"sair dos outros dispositivos" encerra todas as sessões, menos a atual', async () => {
    const cliente = await criarUsuario();
    const outro = await entrar(cliente.email);
    const atual = await entrar(cliente.email);

    const resposta = await request(app).post('/api/auth/eu/encerrar-outras-sessoes').set('Cookie', atual).expect(204);

    expect(await quemE(outro)).toBeNull();
    expect(await quemE(cookieDaSessao(resposta))).toBe(cliente.email);
    await request(app).post('/api/auth/eu/encerrar-outras-sessoes').expect(401);
  });

  it('o admin redefinir a senha derruba os logins do cliente; editar outros dados, não', async () => {
    const cliente = await criarUsuario({ nome: 'Carlos' });
    const sessao = await entrar(cliente.email);
    const admin = await entrarComo(await criarAdmin());
    const base = { nome: 'Carlos Mendes', email: cliente.email, empresa: '', telefone: '', perfil: 'USUARIO', status: 'ATIVO' };

    await admin.put(`/api/admin/usuarios/${cliente.id}`).send(base).expect(200);
    expect(await quemE(sessao)).toBe(cliente.email);

    await admin.put(`/api/admin/usuarios/${cliente.id}`).send({ ...base, novaSenha: 'Redefinida123' }).expect(200);
    expect(await quemE(sessao)).toBeNull();
  });

  it('desativar derruba a sessão, e reativar não ressuscita o token antigo', async () => {
    const cliente = await criarUsuario();
    const sessao = await entrar(cliente.email);
    const admin = await entrarComo(await criarAdmin());

    await admin.patch(`/api/admin/usuarios/${cliente.id}/status`).send({ status: 'INATIVO' }).expect(200);
    await admin.patch(`/api/admin/usuarios/${cliente.id}/status`).send({ status: 'ATIVO' }).expect(200);

    expect(await quemE(sessao)).toBeNull();
    const token = sessao.replace('fersa_sessao=', '');
    const pelaApi = await request(app).get('/api/auth/eu').set('Authorization', `Bearer ${token}`).expect(200);
    expect(pelaApi.body.usuario).toBeNull();
    expect(await quemE(await entrar(cliente.email))).toBe(cliente.email);
  });

  it('cookie de sessão é httpOnly e SameSite=Lax', async () => {
    const cliente = await criarUsuario();
    const resposta = await request(app).post('/api/auth/entrar').send({ email: cliente.email, senha: SENHA_PADRAO });
    const cookie = (resposta.headers['set-cookie'] as unknown as string[])[0]!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\//);
  });
});

describe('Proteção contra CSRF (origem da requisição)', () => {
  it('recusa alteração vinda de outro site, inclusive o login (login CSRF)', async () => {
    const cliente = await criarUsuario();
    const sessao = await entrar(cliente.email);

    const login = await request(app)
      .post('/api/auth/entrar')
      .set('Origin', 'https://site-malicioso.example')
      .send({ email: cliente.email, senha: SENHA_PADRAO });
    expect(login.status).toBe(403);
    expect(login.body.erro.codigo).toBe('ORIGEM_NAO_PERMITIDA');

    const perfil = await request(app)
      .put('/api/auth/eu')
      .set('Cookie', sessao)
      .set('Origin', 'https://site-malicioso.example')
      .send({ nome: 'Invadido' });
    expect(perfil.status).toBe(403);

    // Origin "null" (iframe isolado, arquivo local) também não passa.
    await request(app).post('/api/auth/sair').set('Origin', 'null').expect(403);
  });

  it('sem Origin, recusa quando o navegador diz que é de outro site (Sec-Fetch-Site)', async () => {
    await request(app).post('/api/auth/sair').set('Sec-Fetch-Site', 'cross-site').expect(403);
    await request(app).post('/api/auth/sair').set('Sec-Fetch-Site', 'same-origin').expect(204);
  });

  it('aceita a própria origem e clientes sem navegador; leitura de outro site segue', async () => {
    const cliente = await criarUsuario();
    await request(app)
      .post('/api/auth/entrar')
      .set('Host', 'portal.fersa.test')
      .set('Origin', 'http://portal.fersa.test')
      .send({ email: cliente.email, senha: SENHA_PADRAO })
      .expect(200);
    await request(app).post('/api/auth/entrar').send({ email: cliente.email, senha: SENHA_PADRAO }).expect(200);
    await request(app).get('/api/documentos').set('Origin', 'https://outro.example').expect(200);
  });
});

describe('Cabeçalhos de segurança e rastreio', () => {
  it('toda resposta traz CSP, nosniff, Permissions-Policy e um X-Request-Id', async () => {
    const resposta = await request(app).get('/api/saude').expect(200);
    expect(resposta.headers['content-security-policy']).toContain("default-src 'self'");
    expect(resposta.headers['content-security-policy']).toContain("object-src 'none'");
    expect(resposta.headers['x-content-type-options']).toBe('nosniff');
    expect(resposta.headers['referrer-policy']).toBe('no-referrer');
    expect(resposta.headers['permissions-policy']).toContain('camera=()');
    expect(resposta.headers['x-powered-by']).toBeUndefined();
    expect(resposta.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('sem proxy confiável, ignora o X-Request-Id enviado pelo cliente', async () => {
    const resposta = await request(app).get('/api/saude').set('X-Request-Id', 'escolhido-pelo-cliente');
    expect(resposta.headers['x-request-id']).not.toBe('escolhido-pelo-cliente');
  });

  it('prontidão: banco ok, assistente fora do ar → "degradado", mas pronto (200)', async () => {
    const resposta = await request(app).get('/api/saude/pronto').expect(200);
    expect(resposta.body).toMatchObject({
      status: 'degradado',
      verificacoes: { banco: 'ok', assistente: 'indisponivel' },
    });
    expect(resposta.headers['cache-control']).toBe('no-store');
  });
});

describe('Uploads: o conteúdo precisa bater com a extensão', () => {
  const dados = JSON.stringify({ titulo: 'Manual', tipo: 'MANUAL', visibilidade: 'PUBLICO', origem: 'ARQUIVO' });
  const esperarLimpeza = () => new Promise((resolver) => setTimeout(resolver, 50));

  it('recusa executável renomeado para .pdf e não deixa o arquivo no disco', async () => {
    const admin = await entrarComo(await criarAdmin());
    const resposta = await admin
      .post('/api/admin/documentos')
      .field('dados', dados)
      .attach('arquivo', Buffer.from('MZ\x90\x00\x03\x00\x00\x00', 'latin1'), 'manual.pdf');

    expect(resposta.status).toBe(400);
    expect(resposta.body.erro).toMatchObject({
      codigo: 'CONTEUDO_NAO_CONFERE',
      detalhes: [{ campo: 'arquivo', mensagem: expect.stringContaining('.pdf') }],
    });
    await esperarLimpeza();
    expect(await fs.readdir(env.UPLOAD_DIR)).toEqual([]);
  });

  it('recusa arquivo vazio', async () => {
    const admin = await entrarComo(await criarAdmin());
    const resposta = await admin.post('/api/admin/documentos').field('dados', dados).attach('arquivo', Buffer.alloc(0), 'vazio.pdf');
    expect(resposta.status).toBe(400);
    expect(resposta.body.erro).toMatchObject({ codigo: 'ARQUIVO_VAZIO', detalhes: [{ campo: 'arquivo' }] });
  });

  it('foto de peça: HTML disfarçado de PNG é recusado', async () => {
    const admin = await entrarComo(await criarAdmin());
    const resposta = await admin
      .post('/api/admin/produtos')
      .field('dados', JSON.stringify({ codigo: 'X-1', nome: 'Peça', segmento: 'LEVE' }))
      .attach('imagem', Buffer.from('<html><script>alert(1)</script></html>'), 'foto.png');
    expect(resposta.status).toBe(400);
    expect(resposta.body.erro).toMatchObject({ codigo: 'CONTEUDO_NAO_CONFERE', detalhes: [{ campo: 'imagem' }] });
  });
});
