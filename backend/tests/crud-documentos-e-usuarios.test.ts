import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app, criarAdmin, criarDocumento, criarProduto, criarUsuario, entrarComo } from './ajudantes.js';

/**
 * CRUD de documentos e usuários pela API do admin, campo a campo, e como os
 * documentos aparecem no portal (lista, detalhe, download e resumo).
 */

const UUID_INEXISTENTE = '3f1c2a9e-8b7d-4c6e-9f00-123456789abc';
const PDF = Buffer.from('%PDF-1.4 arquivo de teste');
const BASE = { titulo: 'Guia de montagem', tipo: 'MANUAL', visibilidade: 'PUBLICO', origem: 'ARQUIVO' };

let admin: Awaited<ReturnType<typeof entrarComo>>;
let adminId: string;

beforeEach(async () => {
  const pessoa = await criarAdmin();
  adminId = pessoa.id;
  admin = await entrarComo(pessoa);
});

describe('Documentos: cadastrar e ler', () => {
  it('o detalhe do admin traz autor, peças, acessos e aberturas', async () => {
    const produto = await criarProduto({ codigo: '30205' });
    const cliente = await criarUsuario({ nome: 'Juliana Prado' });
    const criado = await admin
      .post('/api/admin/documentos')
      .field('dados', JSON.stringify({ ...BASE, visibilidade: 'RESTRITO', produtoIds: [produto.id], usuarioIds: [cliente.id] }))
      .attach('arquivo', PDF, 'guia.pdf')
      .expect(201);

    expect(criado.body).toMatchObject({
      titulo: 'Guia de montagem',
      idioma: 'pt-BR',
      publicado: true,
      criadoPor: { id: adminId },
      produtos: [{ id: produto.id, codigo: '30205' }],
      usuariosComAcesso: [{ id: cliente.id, nome: 'Juliana Prado' }],
      totalVisualizacoes: 0,
    });

    // O cliente liberado abre duas vezes; o admin abre uma (não conta).
    const comAcesso = await entrarComo(cliente);
    await comAcesso.get(`/api/documentos/${criado.body.id}`).expect(200);
    await comAcesso.get(`/api/documentos/${criado.body.id}`).expect(200);
    await admin.get(`/api/documentos/${criado.body.id}`).expect(200);
    const detalhe = await admin.get(`/api/admin/documentos/${criado.body.id}`).expect(200);
    expect(detalhe.body.totalVisualizacoes).toBe(2);
  });

  it('aponta os campos inválidos', async () => {
    const resposta = await admin
      .post('/api/admin/documentos')
      .send({ titulo: 'ab', tipo: 'APOSTILA', origem: 'LINK', urlExterna: 'ftp://arquivo' })
      .expect(400);
    const campos = resposta.body.erro.detalhes.map((detalhe: { campo: string }) => detalhe.campo).sort();
    expect(campos).toEqual(['tipo', 'titulo', 'urlExterna', 'visibilidade']);
  });

  it('id inexistente → 404 no detalhe, na edição e na exclusão', async () => {
    await admin.get(`/api/admin/documentos/${UUID_INEXISTENTE}`).expect(404);
    await admin.put(`/api/admin/documentos/${UUID_INEXISTENTE}`).send({ ...BASE, origem: 'LINK', urlExterna: 'https://x.com' }).expect(404);
    await admin.delete(`/api/admin/documentos/${UUID_INEXISTENTE}`).expect(404);
  });
});

describe('Documentos: editar', () => {
  it('troca os dados sem mexer no arquivo quando nenhum novo é enviado', async () => {
    const documento = await criarDocumento({ titulo: 'Antigo' });
    const resposta = await admin
      .put(`/api/admin/documentos/${documento.id}`)
      .send({
        titulo: 'Boletim 07/2026',
        descricao: 'Torque de aperto.',
        tipo: 'BOLETIM',
        idioma: 'es',
        visibilidade: 'AUTENTICADO',
        publicado: false,
        origem: 'ARQUIVO',
      })
      .expect(200);

    expect(resposta.body).toMatchObject({
      titulo: 'Boletim 07/2026',
      descricao: 'Torque de aperto.',
      tipo: 'BOLETIM',
      idioma: 'es',
      visibilidade: 'AUTENTICADO',
      publicado: false,
      origem: 'ARQUIVO',
      arquivo: { nome: documento.arquivoNome },
    });
  });

  it('substitui a lista de peças relacionadas', async () => {
    const a = await criarProduto({ codigo: 'AAA' });
    const b = await criarProduto({ codigo: 'BBB' });
    const c = await criarProduto({ codigo: 'CCC' });
    const documento = await criarDocumento({ produtoIds: [a.id, b.id] });
    const resposta = await admin
      .put(`/api/admin/documentos/${documento.id}`)
      .send({ ...BASE, produtoIds: [c.id, b.id] })
      .expect(200);
    expect(resposta.body.produtos.map((p: { codigo: string }) => p.codigo)).toEqual(['BBB', 'CCC']);
  });

  it('o editado vai para o topo da lista (mais recentes primeiro)', async () => {
    const primeiro = await criarDocumento({ titulo: 'Primeiro' });
    await criarDocumento({ titulo: 'Segundo' });
    await admin.put(`/api/admin/documentos/${primeiro.id}`).send({ ...BASE, titulo: 'Primeiro (revisado)' }).expect(200);
    const lista = await admin.get('/api/admin/documentos').expect(200);
    expect(lista.body.itens.map((d: { titulo: string }) => d.titulo)).toEqual(['Primeiro (revisado)', 'Segundo']);
  });
});

describe('Documentos: filtros do admin', () => {
  it('por tipo, por quem pode ver e pela busca no título', async () => {
    await criarDocumento({ titulo: 'Manual público' });
    await criarDocumento({ titulo: 'Vídeo exclusivo', tipo: 'VIDEO', visibilidade: 'AUTENTICADO' });
    await criarDocumento({ titulo: 'Condições restritas', tipo: 'OUTRO', visibilidade: 'RESTRITO' });

    const titulos = async (consulta: string) =>
      (await admin.get(`/api/admin/documentos?${consulta}`).expect(200)).body.itens.map((d: { titulo: string }) => d.titulo);
    expect(await titulos('tipo=VIDEO')).toEqual(['Vídeo exclusivo']);
    expect(await titulos('visibilidade=RESTRITO')).toEqual(['Condições restritas']);
    expect(await titulos('busca=manual')).toEqual(['Manual público']);
  });
});

describe('Documentos: exibição no portal', () => {
  it('o arquivo abre no navegador e, com ?download=1, é baixado', async () => {
    const documento = await criarDocumento();
    const abrir = await request(app).get(`/api/documentos/${documento.id}/arquivo`).expect(200);
    expect(abrir.headers['content-type']).toContain('application/pdf');
    expect(abrir.headers['content-disposition']).toMatch(/^inline/);
    expect(abrir.headers['cache-control']).toBe('private, no-cache');

    const baixar = await request(app).get(`/api/documentos/${documento.id}/arquivo?download=1`).expect(200);
    expect(baixar.headers['content-disposition']).toMatch(/^attachment/);
  });

  it('o resumo da página inicial conta por tipo o que cada um pode ver', async () => {
    await criarDocumento({ tipo: 'MANUAL' });
    await criarDocumento({ tipo: 'MANUAL', visibilidade: 'AUTENTICADO' });
    await criarDocumento({ tipo: 'VIDEO', visibilidade: 'AUTENTICADO' });
    await criarDocumento({ tipo: 'VIDEO', publicado: false });

    const visitante = await request(app).get('/api/documentos/resumo').expect(200);
    expect(visitante.body).toMatchObject({ totalDocumentos: 1, porTipo: { MANUAL: 1, VIDEO: 0 }, materiaisExclusivos: 2 });

    const cliente = await entrarComo(await criarUsuario());
    const logado = await cliente.get('/api/documentos/resumo').expect(200);
    expect(logado.body).toMatchObject({ totalDocumentos: 3, porTipo: { MANUAL: 2, VIDEO: 1 }, materiaisExclusivos: null });
  });

  it('a lista pública pagina e informa o total', async () => {
    for (let i = 0; i < 5; i++) await criarDocumento();
    const resposta = await request(app).get('/api/documentos?porPagina=2&pagina=3').expect(200);
    expect(resposta.body).toMatchObject({ total: 5, pagina: 3, porPagina: 2, totalPaginas: 3 });
    expect(resposta.body.itens).toHaveLength(1);
  });
});

describe('Usuários: editar e validar', () => {
  it('troca nome, e-mail (em minúsculas), empresa e telefone', async () => {
    const pessoa = await criarUsuario({ nome: 'Carlos' });
    const resposta = await admin
      .put(`/api/admin/usuarios/${pessoa.id}`)
      .send({
        nome: 'Carlos Mendes',
        email: ' Carlos.Mendes@Exemplo.com ',
        empresa: 'Auto Center',
        telefone: '(41) 99999-0001',
        perfil: 'USUARIO',
        status: 'ATIVO',
      })
      .expect(200);
    expect(resposta.body).toMatchObject({
      nome: 'Carlos Mendes',
      email: 'carlos.mendes@exemplo.com',
      empresa: 'Auto Center',
      telefone: '(41) 99999-0001',
    });
    expect(resposta.body).not.toHaveProperty('senhaHash');
  });

  it('não deixa usar o e-mail de outra pessoa', async () => {
    await criarUsuario({ email: 'ocupado@exemplo.com' });
    const pessoa = await criarUsuario();
    const resposta = await admin
      .put(`/api/admin/usuarios/${pessoa.id}`)
      .send({ nome: 'Outra pessoa', email: 'OCUPADO@exemplo.com', perfil: 'USUARIO', status: 'ATIVO' })
      .expect(409);
    expect(resposta.body.erro.mensagem).toBe('Já existe um cadastro com este e-mail.');
  });

  it('aponta os campos inválidos no cadastro', async () => {
    const resposta = await admin
      .post('/api/admin/usuarios')
      .send({ nome: 'Ma', email: 'sem-arroba', perfil: 'DONO', status: 'ATIVO', senha: 'fraca' })
      .expect(400);
    const detalhes: { campo: string; mensagem: string }[] = resposta.body.erro.detalhes;
    expect([...new Set(detalhes.map((detalhe) => detalhe.campo))].sort()).toEqual(['email', 'nome', 'perfil', 'senha']);
    // A senha "fraca" tem dois problemas, e os dois são informados.
    expect(detalhes.filter((detalhe) => detalhe.campo === 'senha').map((detalhe) => detalhe.mensagem)).toEqual([
      'A senha precisa ter pelo menos 8 caracteres.',
      'A senha precisa ter pelo menos um número.',
    ]);
  });

  it('id inexistente → 404', async () => {
    await admin.get(`/api/admin/usuarios/${UUID_INEXISTENTE}`).expect(404);
    await admin.delete(`/api/admin/usuarios/${UUID_INEXISTENTE}`).expect(404);
    await admin.patch(`/api/admin/usuarios/${UUID_INEXISTENTE}/status`).send({ status: 'ATIVO' }).expect(404);
  });
});

describe('Usuários: aprovação e exclusão', () => {
  it('aprovar uma solicitação libera o login', async () => {
    const pendente = await criarUsuario({ status: 'PENDENTE', email: 'novo@exemplo.com' });
    await request(app).post('/api/auth/entrar').send({ email: 'novo@exemplo.com', senha: 'Senha1234' }).expect(403);

    const resposta = await admin.patch(`/api/admin/usuarios/${pendente.id}/status`).send({ status: 'ATIVO' }).expect(200);
    expect(resposta.body.status).toBe('ATIVO');
    await request(app).post('/api/auth/entrar').send({ email: 'novo@exemplo.com', senha: 'Senha1234' }).expect(200);
  });

  it('situação inválida → 400', async () => {
    const pessoa = await criarUsuario();
    const resposta = await admin.patch(`/api/admin/usuarios/${pessoa.id}/status`).send({ status: 'BLOQUEADO' }).expect(400);
    expect(resposta.body.erro.mensagem).toBe('Situação inválida.');
  });

  it('o admin não pode excluir a própria conta', async () => {
    const resposta = await admin.delete(`/api/admin/usuarios/${adminId}`).expect(403);
    expect(resposta.body.erro.mensagem).toBe('Você não pode excluir a própria conta.');
  });

  it('filtros por situação e perfil, com paginação e contagem por situação', async () => {
    await criarUsuario({ status: 'INATIVO' });
    await criarUsuario({ status: 'PENDENTE' });
    await criarUsuario();
    await criarUsuario({ perfil: 'ADMIN' });

    const inativos = await admin.get('/api/admin/usuarios?status=INATIVO').expect(200);
    expect(inativos.body.itens).toHaveLength(1);
    expect(inativos.body.porStatus).toEqual({ PENDENTE: 1, ATIVO: 3, INATIVO: 1 });

    const admins = await admin.get('/api/admin/usuarios?perfil=ADMIN').expect(200);
    expect(admins.body.itens.every((pessoa: { perfil: string }) => pessoa.perfil === 'ADMIN')).toBe(true);
    expect(admins.body.total).toBe(2);

    const pagina = await admin.get('/api/admin/usuarios?porPagina=2&pagina=2').expect(200);
    expect(pagina.body).toMatchObject({ total: 5, pagina: 2, totalPaginas: 3 });
  });
});
