import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app, criarAdmin, criarDocumento, criarUsuario, entrarComo, SENHA_PADRAO } from './ajudantes.js';

describe('Login', () => {
  it('entra com e-mail e senha, devolve o usuário sem o hash e grava cookie httpOnly', async () => {
    const pessoa = await criarUsuario({ email: 'maria@teste.com' });
    const resposta = await request(app)
      .post('/api/auth/entrar')
      .send({ email: '  MARIA@teste.com ', senha: SENHA_PADRAO });

    expect(resposta.status).toBe(200);
    expect(resposta.body.usuario).toMatchObject({ id: pessoa.id, email: 'maria@teste.com', perfil: 'USUARIO' });
    expect(resposta.body.usuario.senhaHash).toBeUndefined();
    expect(typeof resposta.body.token).toBe('string');

    const cookie = String(resposta.headers['set-cookie']);
    expect(cookie).toContain('fersa_sessao=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
  });

  it('recusa senha errada e e-mail inexistente com a mesma mensagem', async () => {
    await criarUsuario({ email: 'joao@teste.com' });
    const senhaErrada = await request(app).post('/api/auth/entrar').send({ email: 'joao@teste.com', senha: 'errada' });
    const emailErrado = await request(app).post('/api/auth/entrar').send({ email: 'ninguem@teste.com', senha: 'x' });

    expect(senhaErrada.status).toBe(401);
    expect(emailErrado.status).toBe(401);
    expect(senhaErrada.body.erro.mensagem).toBe(emailErrado.body.erro.mensagem);
  });

  it('bloqueia cadastro pendente e conta inativa com mensagens próprias', async () => {
    const pendente = await criarUsuario({ status: 'PENDENTE' });
    const inativo = await criarUsuario({ status: 'INATIVO' });

    const r1 = await request(app).post('/api/auth/entrar').send({ email: pendente.email, senha: SENHA_PADRAO });
    expect(r1.status).toBe(403);
    expect(r1.body.erro.codigo).toBe('CADASTRO_PENDENTE');

    const r2 = await request(app).post('/api/auth/entrar').send({ email: inativo.email, senha: SENHA_PADRAO });
    expect(r2.status).toBe(403);
    expect(r2.body.erro.codigo).toBe('CONTA_INATIVA');
  });

  it('aceita o token no cabeçalho Authorization (apps e Swagger)', async () => {
    const pessoa = await criarUsuario();
    const doc = await criarDocumento({ visibilidade: 'AUTENTICADO' });
    const login = await request(app).post('/api/auth/entrar').send({ email: pessoa.email, senha: SENHA_PADRAO });

    const resposta = await request(app)
      .get(`/api/documentos/${doc.id}`)
      .set('Authorization', `Bearer ${login.body.token}`);
    expect(resposta.status).toBe(200);
  });

  it('trata token adulterado como visitante', async () => {
    const doc = await criarDocumento({ visibilidade: 'AUTENTICADO' });
    const resposta = await request(app)
      .get(`/api/documentos/${doc.id}`)
      .set('Cookie', 'fersa_sessao=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.assinatura-falsa');
    expect(resposta.status).toBe(401);
  });

  it('sair apaga a sessão', async () => {
    const agente = await entrarComo(await criarUsuario());
    expect((await agente.get('/api/auth/eu')).body.usuario).not.toBeNull();

    await agente.post('/api/auth/sair').expect(204);
    expect((await agente.get('/api/auth/eu')).body.usuario).toBeNull();
  });
});

describe('Solicitação de acesso', () => {
  const novoCliente = {
    nome: 'Oficina do Teste',
    email: 'Oficina@Teste.com',
    senha: 'Oficina2026',
    empresa: 'Auto Center Teste',
  };

  it('cria o cadastro como PENDENTE e só libera o login depois da aprovação', async () => {
    const solicitacao = await request(app).post('/api/auth/solicitar-acesso').send(novoCliente);
    expect(solicitacao.status).toBe(201);
    expect(solicitacao.body.usuario).toMatchObject({ email: 'oficina@teste.com', status: 'PENDENTE', perfil: 'USUARIO' });

    const antes = await request(app).post('/api/auth/entrar').send({ email: novoCliente.email, senha: novoCliente.senha });
    expect(antes.status).toBe(403);

    const admin = await entrarComo(await criarAdmin());
    await admin.patch(`/api/admin/usuarios/${solicitacao.body.usuario.id}/status`).send({ status: 'ATIVO' }).expect(200);

    const depois = await request(app).post('/api/auth/entrar').send({ email: novoCliente.email, senha: novoCliente.senha });
    expect(depois.status).toBe(200);
  });

  it('não deixa escolher o perfil de administrador pelo cadastro público', async () => {
    const resposta = await request(app)
      .post('/api/auth/solicitar-acesso')
      .send({ ...novoCliente, perfil: 'ADMIN', status: 'ATIVO' });
    expect(resposta.status).toBe(201);
    expect(resposta.body.usuario).toMatchObject({ perfil: 'USUARIO', status: 'PENDENTE' });
  });

  it('recusa e-mail já cadastrado e senha fraca', async () => {
    await criarUsuario({ email: 'oficina@teste.com' });
    const duplicado = await request(app).post('/api/auth/solicitar-acesso').send(novoCliente);
    expect(duplicado.status).toBe(409);

    const fraca = await request(app)
      .post('/api/auth/solicitar-acesso')
      .send({ ...novoCliente, email: 'outro@teste.com', senha: 'abc' });
    expect(fraca.status).toBe(400);
    expect(fraca.body.erro.detalhes).toContainEqual(expect.objectContaining({ campo: 'senha' }));
  });
});

describe('Minha conta', () => {
  it('visitante recebe usuario: null em /eu', async () => {
    const resposta = await request(app).get('/api/auth/eu');
    expect(resposta.status).toBe(200);
    expect(resposta.body).toEqual({ usuario: null });
  });

  it('atualiza o próprio perfil sem conseguir mudar perfil ou situação', async () => {
    const agente = await entrarComo(await criarUsuario());
    const resposta = await agente
      .put('/api/auth/eu')
      .send({ nome: 'Nome Novo', empresa: 'Empresa Nova', telefone: '41 9999-0000', perfil: 'ADMIN' });
    expect(resposta.status).toBe(200);
    expect(resposta.body.usuario).toMatchObject({ nome: 'Nome Novo', empresa: 'Empresa Nova', perfil: 'USUARIO' });
  });

  it('troca a senha somente com a senha atual correta', async () => {
    const pessoa = await criarUsuario();
    const agente = await entrarComo(pessoa);

    await agente.put('/api/auth/eu/senha').send({ senhaAtual: 'errada', novaSenha: 'NovaSenha99' }).expect(400);
    await agente.put('/api/auth/eu/senha').send({ senhaAtual: SENHA_PADRAO, novaSenha: 'NovaSenha99' }).expect(204);

    await request(app).post('/api/auth/entrar').send({ email: pessoa.email, senha: 'NovaSenha99' }).expect(200);
  });

  it('exige login para alterar a conta', async () => {
    await request(app).put('/api/auth/eu').send({ nome: 'Fulano' }).expect(401);
  });
});
