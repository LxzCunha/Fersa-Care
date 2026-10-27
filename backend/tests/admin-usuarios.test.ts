import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app, criarAdmin, criarDocumento, criarUsuario, entrarComo } from './ajudantes.js';

describe('Administração de usuários', () => {
  let adminId: string;
  let admin: Awaited<ReturnType<typeof entrarComo>>;

  beforeEach(async () => {
    const pessoa = await criarAdmin();
    adminId = pessoa.id;
    admin = await entrarComo(pessoa);
  });

  it('lista com pendentes primeiro e contagem por situação', async () => {
    await criarUsuario({ status: 'ATIVO' });
    await criarUsuario({ status: 'PENDENTE', nome: 'Aguardando Aprovação' });
    await criarUsuario({ status: 'INATIVO' });

    const resposta = await admin.get('/api/admin/usuarios').expect(200);
    expect(resposta.body.itens[0].nome).toBe('Aguardando Aprovação');
    expect(resposta.body.porStatus).toEqual({ PENDENTE: 1, ATIVO: 2, INATIVO: 1 });
    expect(JSON.stringify(resposta.body)).not.toContain('senhaHash');
  });

  it('busca por nome sem acento', async () => {
    await criarUsuario({ nome: 'José Conceição' });
    const resposta = await admin.get('/api/admin/usuarios?busca=conceicao').expect(200);
    expect(resposta.body.itens).toHaveLength(1);
  });

  it('cria usuário já ativo e recusa e-mail repetido', async () => {
    const dados = {
      nome: 'Cliente Novo',
      email: 'cliente@teste.com',
      senha: 'Cliente2026',
      perfil: 'USUARIO',
      status: 'ATIVO',
    };
    await admin.post('/api/admin/usuarios').send(dados).expect(201);
    await request(app).post('/api/auth/entrar').send({ email: dados.email, senha: dados.senha }).expect(200);

    const repetido = await admin.post('/api/admin/usuarios').send(dados);
    expect(repetido.status).toBe(409);
    expect(repetido.body.erro.mensagem).toContain('e-mail');
  });

  it('redefine a senha de um usuário pela edição', async () => {
    const pessoa = await criarUsuario();
    await admin
      .put(`/api/admin/usuarios/${pessoa.id}`)
      .send({ nome: pessoa.nome, email: pessoa.email, perfil: 'USUARIO', status: 'ATIVO', novaSenha: 'Redefinida1' })
      .expect(200);
    await request(app).post('/api/auth/entrar').send({ email: pessoa.email, senha: 'Redefinida1' }).expect(200);
  });

  it('impede o admin de tirar o próprio acesso', async () => {
    const eu = (await admin.get('/api/auth/eu')).body.usuario;

    await admin
      .put(`/api/admin/usuarios/${adminId}`)
      .send({ nome: eu.nome, email: eu.email, perfil: 'USUARIO', status: 'ATIVO' })
      .expect(403);
    await admin.patch(`/api/admin/usuarios/${adminId}/status`).send({ status: 'INATIVO' }).expect(403);
    await admin.delete(`/api/admin/usuarios/${adminId}`).expect(403);
  });

  it('promove um usuário a admin e depois outro admin pode rebaixá-lo', async () => {
    const pessoa = await criarUsuario();
    await admin
      .put(`/api/admin/usuarios/${pessoa.id}`)
      .send({ nome: pessoa.nome, email: pessoa.email, perfil: 'ADMIN', status: 'ATIVO' })
      .expect(200);

    const novoAdmin = await entrarComo(pessoa);
    await novoAdmin.get('/api/admin/painel').expect(200);

    await admin
      .put(`/api/admin/usuarios/${pessoa.id}`)
      .send({ nome: pessoa.nome, email: pessoa.email, perfil: 'USUARIO', status: 'ATIVO' })
      .expect(200);
    await novoAdmin.get('/api/admin/painel').expect(403);
  });

  it('detalhe mostra os documentos restritos liberados para a pessoa', async () => {
    const pessoa = await criarUsuario();
    await criarDocumento({ titulo: 'Exclusivo', visibilidade: 'RESTRITO', liberadoPara: [pessoa.id] });

    const resposta = await admin.get(`/api/admin/usuarios/${pessoa.id}`).expect(200);
    expect(resposta.body.documentosLiberados.map((d: { titulo: string }) => d.titulo)).toEqual(['Exclusivo']);
  });

  it('excluir usuário remove também os acessos dele', async () => {
    const pessoa = await criarUsuario();
    const doc = await criarDocumento({ visibilidade: 'RESTRITO', liberadoPara: [pessoa.id] });

    await admin.delete(`/api/admin/usuarios/${pessoa.id}`).expect(204);
    const detalhe = await admin.get(`/api/admin/documentos/${doc.id}`).expect(200);
    expect(detalhe.body.usuariosComAcesso).toEqual([]);
  });
});
