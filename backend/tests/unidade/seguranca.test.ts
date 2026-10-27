import bcrypt from 'bcryptjs';
import express from 'express';
import { SignJWT, UnsecuredJWT } from 'jose';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { env } from '../../src/config/env.js';
import { EXTENSOES_DE_IMAGEM, EXTENSOES_PERMITIDAS } from '../../src/lib/armazenamento.js';
import { EXTENSOES_CONFERIDAS, inicioConfereComExtensao } from '../../src/lib/assinaturas.js';
import { camposAlterados, diferencaDeListas } from '../../src/lib/diferencas.js';
import { gerarToken, lerToken } from '../../src/lib/jwt.js';
import { hashDesatualizado } from '../../src/lib/senha.js';
import { campoSenhaNova } from '../../src/lib/validacao.js';
import { criarLimiteDeLoginPorConta } from '../../src/middlewares/limites.js';

const ID = '7d4f2a8e-1b3c-4d5e-9f60-718293a4b5c6';

describe('Conferência do conteúdo dos uploads (magic bytes)', () => {
  const bytes = (...valores: number[]) => Buffer.from(valores);
  const texto = (valor: string) => Buffer.from(valor, 'latin1');

  it('toda extensão aceita no upload tem uma conferência', () => {
    for (const extensao of [...EXTENSOES_PERMITIDAS, ...EXTENSOES_DE_IMAGEM]) {
      expect(EXTENSOES_CONFERIDAS, extensao).toContain(extensao);
    }
  });

  it.each([
    ['.pdf', texto('%PDF-1.7\n...')],
    ['.pdf', texto('\n\n%PDF-1.4 cabeçalho depois de linhas em branco')],
    ['.png', bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00)],
    ['.jpg', bytes(0xff, 0xd8, 0xff, 0xe0)],
    ['.jpeg', bytes(0xff, 0xd8, 0xff, 0xdb)],
    ['.webp', texto('RIFF\x24\x00\x00\x00WEBPVP8 ')],
    ['.mp4', Buffer.concat([bytes(0, 0, 0, 0x20), texto('ftypisom')])],
    ['.webm', bytes(0x1a, 0x45, 0xdf, 0xa3, 0x9f)],
    ['.docx', texto('PK\x03\x04\x14\x00')],
    ['.xlsx', texto('PK\x03\x04\x14\x00')],
    ['.zip', texto('PK\x05\x06')],
    ['.doc', bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1)],
    ['.txt', Buffer.from('Torque de aperto: 25 N·m', 'utf8')],
    ['.csv', texto('código;descrição\n30205;Rolamento cônico')], // Latin-1, como o Excel exporta
    ['.PDF', texto('%PDF-1.7')], // extensão em maiúsculas
  ])('aceita %s com o conteúdo certo', (extensao, inicio) => {
    expect(inicioConfereComExtensao(inicio, extensao)).toBe(true);
  });

  it.each([
    ['executável renomeado para PDF', '.pdf', texto('MZ\x90\x00\x03\x00')],
    ['PNG com extensão JPG', '.jpg', bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)],
    ['HTML com extensão PNG', '.png', texto('<html><script>alert(1)</script>')],
    ['binário com extensão TXT', '.txt', bytes(0x7f, 0x45, 0x4c, 0x46, 0x00, 0x01)],
    ['ZIP com extensão DOC', '.doc', texto('PK\x03\x04')],
    ['RIFF que não é WebP (WAV)', '.webp', texto('RIFF\x24\x00\x00\x00WAVEfmt ')],
    ['arquivo curto demais', '.png', bytes(0x89, 0x50)],
    ['extensão fora da lista', '.exe', texto('MZ')],
    ['SVG (pode carregar script)', '.svg', texto('<svg xmlns="http://www.w3.org/2000/svg">')],
  ])('recusa %s', (_caso, extensao, inicio) => {
    expect(inicioConfereComExtensao(inicio, extensao)).toBe(false);
  });
});

describe('Token de sessão (JWT)', () => {
  const chave = new TextEncoder().encode(env.JWT_SEGREDO);
  const agora = () => Math.floor(Date.now() / 1000);

  it('ida e volta: guarda o id e a versão da sessão', async () => {
    const token = await gerarToken({ usuarioId: ID, versao: 3 });
    expect(await lerToken(token)).toEqual({ usuarioId: ID, versao: 3 });
  });

  it('o token não carrega nada além do necessário (sem e-mail, perfil ou nome)', async () => {
    const token = await gerarToken({ usuarioId: ID, versao: 0 });
    const conteudo = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString()) as Record<string, unknown>;
    expect(Object.keys(conteudo).sort()).toEqual(['aud', 'exp', 'iat', 'iss', 'sub', 'ver']);
  });

  it('recusa token sem assinatura ("alg: none")', async () => {
    const token = new UnsecuredJWT({ ver: 0 })
      .setSubject(ID)
      .setIssuer('fersa-care')
      .setAudience('fersa-care:sessao')
      .setIssuedAt()
      .setExpirationTime('1h')
      .encode();
    expect(await lerToken(token)).toBeNull();
  });

  it('recusa token assinado com outro segredo', async () => {
    const token = await new SignJWT({ ver: 0 })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(ID)
      .setIssuer('fersa-care')
      .setAudience('fersa-care:sessao')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode('outro-segredo-qualquer-com-mais-de-32-caracteres'));
    expect(await lerToken(token)).toBeNull();
  });

  it('recusa token vencido, de outro público ou sem a versão da sessão', async () => {
    const base = () =>
      new SignJWT({ ver: 0 }).setProtectedHeader({ alg: 'HS256' }).setSubject(ID).setIssuer('fersa-care').setIssuedAt();

    const vencido = await base().setAudience('fersa-care:sessao').setExpirationTime(agora() - 60).sign(chave);
    const outroPublico = await base().setAudience('fersa-care:redefinir-senha').setExpirationTime('1h').sign(chave);
    const semVersao = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(ID)
      .setIssuer('fersa-care')
      .setAudience('fersa-care:sessao')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(chave);

    expect(await lerToken(vencido)).toBeNull();
    expect(await lerToken(outroPublico)).toBeNull();
    expect(await lerToken(semVersao)).toBeNull();
    expect(await lerToken('nao.e.um.token')).toBeNull();
  });
});

describe('Senhas', () => {
  it('hash com custo menor que o atual é refeito no próximo login', () => {
    const custo4 = bcrypt.hashSync('Senha1234', 4);
    expect(hashDesatualizado(custo4, 12)).toBe(true);
    expect(hashDesatualizado(custo4, 4)).toBe(false);
  });

  it('respeita o limite de 72 bytes do bcrypt mesmo com acentos', () => {
    const comAcentos = 'çãé1'.repeat(15); // 60 caracteres, 105 bytes
    const resultado = campoSenhaNova.safeParse(comAcentos);
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.message).toContain('longa demais');
    expect(campoSenhaNova.safeParse('ação1234').success).toBe(true);
  });
});

describe('Auditoria: o que mudou', () => {
  it('lista só os campos alterados, tratando vazio, null e undefined como iguais', () => {
    const antes: { nome: string; descricao: string | null; ativo: boolean; medida: number; criadoEm: Date } = {
      nome: 'Rolamento',
      descricao: null,
      ativo: true,
      medida: 25,
      criadoEm: new Date('2026-01-01'),
    };
    expect(
      camposAlterados(antes, { nome: 'Rolamento', descricao: '', ativo: false, medida: 25, criadoEm: new Date('2026-01-01') }),
    ).toEqual(['ativo']);
    expect(camposAlterados(antes, { nome: 'Rolamento cônico', medida: 26 })).toEqual(['nome', 'medida']);
  });

  it('compara listas sem considerar a ordem', () => {
    expect(camposAlterados({ ids: ['a', 'b'] }, { ids: ['b', 'a'] })).toEqual([]);
    expect(camposAlterados({ ids: ['a', 'b'] }, { ids: ['a'] })).toEqual(['ids']);
  });

  it('diferença de listas: quem entrou e quem saiu', () => {
    expect(diferencaDeListas(['a', 'b'], ['b', 'c'])).toEqual({ incluidos: ['c'], removidos: ['a'] });
    expect(diferencaDeListas([], [])).toEqual({ incluidos: [], removidos: [] });
  });
});

describe('Limite de tentativas de login por conta', () => {
  /** App mínimo: o "login" dá certo só com a senha "certa". */
  function appDeLogin() {
    const app = express();
    app.use(express.json());
    app.post('/entrar', criarLimiteDeLoginPorConta(2), (req, res) => {
      const { senha } = req.body as { senha: string };
      res.status(senha === 'certa' ? 200 : 401).end();
    });
    return app;
  }

  it('bloqueia a conta depois de N senhas erradas, mesmo vindo de IPs diferentes', async () => {
    const app = appDeLogin();
    const tentar = (email: string, senha: string, ip: string) =>
      request(app).post('/entrar').set('X-Forwarded-For', ip).send({ email, senha });

    expect((await tentar('Vitima@Exemplo.com', 'x', '10.0.0.1')).status).toBe(401);
    expect((await tentar('vitima@exemplo.com ', 'y', '10.0.0.2')).status).toBe(401);

    const bloqueada = await tentar('vitima@exemplo.com', 'certa', '10.0.0.3');
    expect(bloqueada.status).toBe(429);
    expect(bloqueada.body).toEqual({
      erro: { codigo: 'MUITAS_TENTATIVAS', mensagem: expect.stringContaining('nesta conta') },
    });

    // Outras contas seguem normais, e o bloqueio vale também para e-mails que não existem.
    expect((await tentar('outra@exemplo.com', 'certa', '10.0.0.1')).status).toBe(200);
  });

  it('logins certos não contam para o bloqueio', async () => {
    const app = appDeLogin();
    for (let i = 0; i < 4; i++) {
      expect((await request(app).post('/entrar').send({ email: 'cliente@x.com', senha: 'certa' })).status).toBe(200);
    }
  });
});
