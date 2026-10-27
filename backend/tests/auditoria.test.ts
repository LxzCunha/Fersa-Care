import { desc, eq } from 'drizzle-orm';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { db } from '../src/db/index.js';
import { chamados, eventosDeAuditoria, type EventoDeAuditoria } from '../src/models/index.js';
import {
  app,
  criarAdmin,
  criarCategoria,
  criarDocumento,
  criarProduto,
  criarUsuario,
  entrarComo,
  SENHA_PADRAO,
} from './ajudantes.js';

async function eventos(): Promise<EventoDeAuditoria[]> {
  return db.select().from(eventosDeAuditoria).orderBy(desc(eventosDeAuditoria.criadoEm), desc(eventosDeAuditoria.id));
}

async function ultimoEvento() {
  const [evento] = await eventos();
  if (!evento) throw new Error('Nenhum evento de auditoria foi gravado.');
  return evento;
}

describe('Auditoria de acesso', () => {
  it('login certo: autor, alvo, IP e o mesmo id de requisição devolvido ao cliente', async () => {
    const cliente = await criarUsuario({ nome: 'Carlos' });
    const resposta = await request(app).post('/api/auth/entrar').send({ email: cliente.email, senha: SENHA_PADRAO }).expect(200);

    const evento = await ultimoEvento();
    expect(evento).toMatchObject({
      acao: 'LOGIN',
      autorId: cliente.id,
      autorNome: 'Carlos',
      alvoTipo: 'USUARIO',
      alvoId: cliente.id,
      requisicaoId: resposta.headers['x-request-id'],
    });
    expect(evento.ip).toBeTruthy();
  });

  it('login recusado: guarda o e-mail digitado e o motivo, nunca a senha', async () => {
    const cliente = await criarUsuario();
    const pendente = await criarUsuario({ status: 'PENDENTE' });

    await request(app).post('/api/auth/entrar').send({ email: cliente.email, senha: 'SenhaErrada1' }).expect(401);
    await request(app).post('/api/auth/entrar').send({ email: 'ninguem@teste.com', senha: 'SenhaErrada2' }).expect(401);
    await request(app).post('/api/auth/entrar').send({ email: pendente.email, senha: SENHA_PADRAO }).expect(403);

    const [dePendente, deDesconhecido, deCliente] = await eventos();
    expect(deCliente).toMatchObject({
      acao: 'LOGIN_RECUSADO',
      autorId: null,
      alvoId: cliente.id,
      detalhes: { email: cliente.email, motivo: 'CREDENCIAIS_INVALIDAS' },
    });
    expect(deDesconhecido).toMatchObject({ acao: 'LOGIN_RECUSADO', alvoId: null, detalhes: { email: 'ninguem@teste.com' } });
    expect(dePendente).toMatchObject({ detalhes: { motivo: 'CADASTRO_PENDENTE' } });
    expect(JSON.stringify(await eventos())).not.toMatch(/SenhaErrada/);
  });

  it('pedido de acesso, troca de senha e encerramento de sessões', async () => {
    await request(app)
      .post('/api/auth/solicitar-acesso')
      .send({ nome: 'Oficina Nova', email: 'nova@oficina.com', senha: 'Senha12345', empresa: 'Oficina Nova Ltda' })
      .expect(201);
    expect(await ultimoEvento()).toMatchObject({ acao: 'ACESSO_SOLICITADO', autorId: null, alvoRotulo: expect.stringContaining('nova@oficina.com') });

    const cliente = await criarUsuario();
    const sessao = await entrarComo(cliente);
    await sessao.put('/api/auth/eu/senha').send({ senhaAtual: SENHA_PADRAO, novaSenha: 'NovaSenha123' }).expect(204);
    expect(await ultimoEvento()).toMatchObject({ acao: 'SENHA_ALTERADA', autorId: cliente.id, alvoId: cliente.id, detalhes: {} });

    await sessao.post('/api/auth/eu/encerrar-outras-sessoes').expect(204);
    expect(await ultimoEvento()).toMatchObject({ acao: 'SESSOES_ENCERRADAS', autorId: cliente.id });
  });
});

describe('Auditoria das ações do administrador', () => {
  it('documento: criação, edição (campos e acesso liberado/retirado) e exclusão', async () => {
    const adminUsuario = await criarAdmin();
    const admin = await entrarComo(adminUsuario);
    const [ana, bruno] = [await criarUsuario({ nome: 'Ana' }), await criarUsuario({ nome: 'Bruno' })];
    const base = { titulo: 'Boletim 12', tipo: 'BOLETIM', visibilidade: 'RESTRITO', origem: 'LINK', urlExterna: 'https://exemplo.com/b12' };

    const criado = await admin.post('/api/admin/documentos').send({ ...base, usuarioIds: [ana.id] }).expect(201);
    expect(await ultimoEvento()).toMatchObject({
      acao: 'DOCUMENTO_CRIADO',
      autorId: adminUsuario.id,
      alvoId: criado.body.id,
      alvoRotulo: 'Boletim 12',
      detalhes: { visibilidade: 'RESTRITO', acessoLiberadoPara: [ana.id] },
    });

    await admin
      .put(`/api/admin/documentos/${criado.body.id}`)
      .send({ ...base, titulo: 'Boletim 12 (rev. B)', usuarioIds: [bruno.id] })
      .expect(200);
    expect(await ultimoEvento()).toMatchObject({
      acao: 'DOCUMENTO_ALTERADO',
      alvoRotulo: 'Boletim 12 (rev. B)',
      detalhes: { campos: ['titulo'], acessoLiberadoPara: [bruno.id], acessoRetiradoDe: [ana.id] },
    });

    await admin.delete(`/api/admin/documentos/${criado.body.id}`).expect(204);
    expect(await ultimoEvento()).toMatchObject({ acao: 'DOCUMENTO_EXCLUIDO', alvoRotulo: 'Boletim 12 (rev. B)' });
  });

  it('edição recusada (validação) não deixa evento', async () => {
    const admin = await entrarComo(await criarAdmin());
    const documento = await criarDocumento();
    const antes = (await eventos()).length;
    await admin.put(`/api/admin/documentos/${documento.id}`).send({ titulo: '' }).expect(400);
    expect(await eventos()).toHaveLength(antes);
  });

  it('usuário: senha redefinida aparece como campo, sem valor; status com de/para; exclusão', async () => {
    const admin = await entrarComo(await criarAdmin());
    const cliente = await criarUsuario({ nome: 'Carlos' });
    const base = { nome: 'Carlos', email: cliente.email, empresa: '', telefone: '', perfil: 'USUARIO', status: 'ATIVO' };

    await admin.put(`/api/admin/usuarios/${cliente.id}`).send({ ...base, empresa: 'Auto Center', novaSenha: 'Redefinida123' }).expect(200);
    const edicao = await ultimoEvento();
    expect(edicao).toMatchObject({ acao: 'USUARIO_ALTERADO', detalhes: { campos: ['empresa', 'senha'] } });
    expect(JSON.stringify(edicao)).not.toMatch(/Redefinida123|\$2[aby]\$/);

    await admin.patch(`/api/admin/usuarios/${cliente.id}/status`).send({ status: 'INATIVO' }).expect(200);
    expect(await ultimoEvento()).toMatchObject({
      acao: 'USUARIO_STATUS_ALTERADO',
      detalhes: { status: { de: 'ATIVO', para: 'INATIVO' } },
    });

    await admin.delete(`/api/admin/usuarios/${cliente.id}`).expect(204);
    // A trilha continua legível depois da exclusão: o nome ficou guardado no evento.
    expect(await ultimoEvento()).toMatchObject({ acao: 'USUARIO_EXCLUIDO', alvoId: cliente.id, alvoRotulo: expect.stringContaining('Carlos') });
  });

  it('peça, categoria e chamado também ficam registrados', async () => {
    const admin = await entrarComo(await criarAdmin());
    const produto = await criarProduto({ codigo: '30205', nome: 'Rolamento cônico' });
    const categoria = await criarCategoria('Cônicos');
    const [chamado] = await db.insert(chamados).values({ nome: 'Rafael', email: 'rafael@x.com', resumo: '• ruído' }).returning();

    await admin
      .put(`/api/admin/produtos/${produto.id}`)
      .send({ codigo: '30205', nome: 'Rolamento cônico', segmento: 'PESADA', categoriaId: categoria.id })
      .expect(200);
    expect(await ultimoEvento()).toMatchObject({
      acao: 'PRODUTO_ALTERADO',
      alvoRotulo: '30205 · Rolamento cônico',
      detalhes: { campos: expect.arrayContaining(['segmento', 'categoriaId']) },
    });

    await admin.delete(`/api/admin/categorias/${categoria.id}`).expect(204);
    expect(await ultimoEvento()).toMatchObject({ acao: 'CATEGORIA_EXCLUIDA', alvoRotulo: 'Cônicos' });

    await admin.patch(`/api/admin/chamados/${chamado!.id}`).send({ status: 'RESOLVIDO', observacao: 'Trocado o retentor.' }).expect(200);
    expect(await ultimoEvento()).toMatchObject({
      acao: 'CHAMADO_ALTERADO',
      detalhes: { campos: ['status', 'observacao'], status: { de: 'ABERTO', para: 'RESOLVIDO' } },
    });
  });
});

describe('Consulta da trilha (GET /api/admin/auditoria)', () => {
  it('só o administrador consulta', async () => {
    await request(app).get('/api/admin/auditoria').expect(401);
    const cliente = await entrarComo(await criarUsuario());
    await cliente.get('/api/admin/auditoria').expect(403);
  });

  it('lista os mais novos primeiro, com filtros por grupo, alvo e busca', async () => {
    const cliente = await criarUsuario({ nome: 'Carlos', email: 'carlos@oficina.com' });
    await request(app).post('/api/auth/entrar').send({ email: cliente.email, senha: 'Errada123' }).expect(401);
    const adminUsuario = await criarAdmin();
    const admin = await entrarComo(adminUsuario);
    await admin.patch(`/api/admin/usuarios/${cliente.id}/status`).send({ status: 'INATIVO' }).expect(200);

    const tudo = await admin.get('/api/admin/auditoria').expect(200);
    expect(tudo.body.itens.map((evento: { acao: string }) => evento.acao)).toEqual([
      'USUARIO_STATUS_ALTERADO',
      'LOGIN',
      'LOGIN_RECUSADO',
    ]);
    expect(tudo.body.itens[0]).toMatchObject({
      autor: { id: adminUsuario.id, nome: adminUsuario.nome },
      alvo: { tipo: 'USUARIO', id: cliente.id, rotulo: 'Carlos <carlos@oficina.com>' },
      detalhes: { status: { de: 'ATIVO', para: 'INATIVO' } },
    });
    expect(tudo.body).toMatchObject({ total: 3, pagina: 1, totalPaginas: 1 });

    const acessos = await admin.get('/api/admin/auditoria?grupo=ACESSOS').expect(200);
    expect(acessos.body.itens.map((evento: { acao: string }) => evento.acao)).toEqual(['LOGIN', 'LOGIN_RECUSADO']);
    const alteracoes = await admin.get('/api/admin/auditoria?grupo=ALTERACOES').expect(200);
    expect(alteracoes.body.total).toBe(1);

    const doCliente = await admin.get(`/api/admin/auditoria?alvoTipo=USUARIO&alvoId=${cliente.id}`).expect(200);
    expect(doCliente.body.total).toBe(2);
    const porEmail = await admin.get('/api/admin/auditoria?busca=carlos@oficina').expect(200);
    expect(porEmail.body.total).toBe(2);

    await admin.get('/api/admin/auditoria?acao=APAGAR_TUDO').expect(400);
  });
});

describe('A trilha não pode ser reescrita', () => {
  it('o banco recusa UPDATE e DELETE na tabela de auditoria', async () => {
    const cliente = await criarUsuario();
    await request(app).post('/api/auth/entrar').send({ email: cliente.email, senha: SENHA_PADRAO }).expect(200);
    const evento = await ultimoEvento();

    await expect(
      db.update(eventosDeAuditoria).set({ autorNome: 'Outra pessoa' }).where(eq(eventosDeAuditoria.id, evento.id)),
    ).rejects.toThrow();
    await expect(db.delete(eventosDeAuditoria).where(eq(eventosDeAuditoria.id, evento.id))).rejects.toThrow();
    expect(await ultimoEvento()).toEqual(evento);
  });
});
