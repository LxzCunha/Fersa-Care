import fs from 'node:fs/promises';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { env } from '../src/config/env.js';
import { app, criarAdmin, criarDocumento, criarProduto, criarUsuario, entrarComo } from './ajudantes.js';

const PDF = Buffer.from('%PDF-1.4 arquivo de teste');

async function arquivosNaPasta() {
  return (await fs.readdir(env.UPLOAD_DIR)).sort();
}

describe('Administração de documentos', () => {
  let admin: Awaited<ReturnType<typeof entrarComo>>;

  beforeEach(async () => {
    admin = await entrarComo(await criarAdmin());
  });

  it('bloqueia visitantes (401) e usuários comuns (403)', async () => {
    await request(app).get('/api/admin/documentos').expect(401);
    const usuario = await entrarComo(await criarUsuario());
    await usuario.get('/api/admin/documentos').expect(403);
    await usuario
      .post('/api/admin/documentos')
      .field('dados', JSON.stringify({ titulo: 'Invasão', tipo: 'OUTRO', visibilidade: 'PUBLICO', origem: 'ARQUIVO' }))
      .attach('arquivo', PDF, 'invasao.pdf')
      .expect(403);
    expect(await arquivosNaPasta()).toEqual([]);
  });

  it('cadastra documento com arquivo e nome acentuado', async () => {
    const produto = await criarProduto({ codigo: '30205' });
    const resposta = await admin
      .post('/api/admin/documentos')
      .field(
        'dados',
        JSON.stringify({
          titulo: 'Manual de manutenção',
          tipo: 'MANUAL',
          visibilidade: 'PUBLICO',
          origem: 'ARQUIVO',
          produtoIds: [produto.id],
        }),
      )
      .attach('arquivo', PDF, 'Manual de manutenção.pdf');

    expect(resposta.status).toBe(201);
    expect(resposta.body).toMatchObject({
      titulo: 'Manual de manutenção',
      origem: 'ARQUIVO',
      arquivo: { nome: 'Manual de manutenção.pdf', mime: 'application/pdf', tamanho: PDF.length },
      produtos: [{ codigo: '30205' }],
    });
    expect(await arquivosNaPasta()).toHaveLength(1);

    const download = await request(app).get(`/api/documentos/${resposta.body.id}/arquivo`);
    expect(download.status).toBe(200);
    expect(download.headers['content-disposition']).toContain("filename*=UTF-8''Manual%20de%20manuten%C3%A7%C3%A3o.pdf");
  });

  it('documento RESTRITO aparece só para os usuários escolhidos', async () => {
    const escolhido = await criarUsuario();
    const outro = await criarUsuario();

    const criado = await admin
      .post('/api/admin/documentos')
      .send({
        titulo: 'Tabela para distribuidores',
        tipo: 'OUTRO',
        visibilidade: 'RESTRITO',
        origem: 'LINK',
        urlExterna: 'https://exemplo.com/tabela',
        usuarioIds: [escolhido.id],
      })
      .expect(201);
    expect(criado.body.usuariosComAcesso.map((u: { id: string }) => u.id)).toEqual([escolhido.id]);

    await (await entrarComo(escolhido)).get(`/api/documentos/${criado.body.id}`).expect(200);
    await (await entrarComo(outro)).get(`/api/documentos/${criado.body.id}`).expect(404);
  });

  it('ao deixar de ser RESTRITO, a lista de usuários é limpa', async () => {
    const pessoa = await criarUsuario();
    const doc = await criarDocumento({ visibilidade: 'RESTRITO', liberadoPara: [pessoa.id] });

    const resposta = await admin
      .put(`/api/admin/documentos/${doc.id}`)
      .send({ titulo: doc.titulo, tipo: 'MANUAL', visibilidade: 'AUTENTICADO', origem: 'ARQUIVO', usuarioIds: [pessoa.id] })
      .expect(200);
    expect(resposta.body.usuariosComAcesso).toEqual([]);
    expect(resposta.body.origem).toBe('ARQUIVO'); // manteve o arquivo atual
  });

  it('trocar o arquivo apaga o antigo do disco', async () => {
    const doc = await criarDocumento();
    const [antigo] = await arquivosNaPasta();

    await admin
      .put(`/api/admin/documentos/${doc.id}`)
      .field('dados', JSON.stringify({ titulo: 'Nova versão', tipo: 'MANUAL', visibilidade: 'PUBLICO', origem: 'ARQUIVO' }))
      .attach('arquivo', PDF, 'nova-versao.pdf')
      .expect(200);

    const depois = await arquivosNaPasta();
    expect(depois).toHaveLength(1);
    expect(depois).not.toContain(antigo);
  });

  it('trocar arquivo por link apaga o arquivo e passa a redirecionar', async () => {
    const doc = await criarDocumento();
    const resposta = await admin
      .put(`/api/admin/documentos/${doc.id}`)
      .send({
        titulo: 'Agora é vídeo no YouTube',
        tipo: 'VIDEO',
        visibilidade: 'PUBLICO',
        origem: 'LINK',
        urlExterna: 'https://www.youtube.com/watch?v=abc',
      })
      .expect(200);

    expect(resposta.body).toMatchObject({ origem: 'LINK', arquivo: null });
    expect(await arquivosNaPasta()).toEqual([]);
    const abrir = await request(app).get(`/api/documentos/${doc.id}/arquivo`);
    expect(abrir.status).toBe(302);
  });

  it('recusa extensão não permitida, conteúdo ausente e arquivo + link juntos sem deixar lixo', async () => {
    const base = { titulo: 'Teste', tipo: 'OUTRO', visibilidade: 'PUBLICO' };

    const executavel = await admin
      .post('/api/admin/documentos')
      .field('dados', JSON.stringify({ ...base, origem: 'ARQUIVO' }))
      .attach('arquivo', Buffer.from('MZ'), 'programa.exe');
    expect(executavel.status).toBe(400);
    expect(executavel.body.erro.codigo).toBe('TIPO_DE_ARQUIVO_INVALIDO');

    const semArquivo = await admin.post('/api/admin/documentos').send({ ...base, origem: 'ARQUIVO' });
    expect(semArquivo.status).toBe(400);

    const semLink = await admin.post('/api/admin/documentos').send({ ...base, origem: 'LINK' });
    expect(semLink.status).toBe(400);
    expect(semLink.body.erro.detalhes).toContainEqual(expect.objectContaining({ campo: 'urlExterna' }));

    const osDois = await admin
      .post('/api/admin/documentos')
      .field('dados', JSON.stringify({ ...base, origem: 'LINK', urlExterna: 'https://exemplo.com' }))
      .attach('arquivo', PDF, 'junto.pdf');
    expect(osDois.status).toBe(400);

    // Espera o evento "finish" que limpa o upload recusado.
    await new Promise((resolver) => setTimeout(resolver, 50));
    expect(await arquivosNaPasta()).toEqual([]);
  });

  it('recusa produto inexistente', async () => {
    const resposta = await admin.post('/api/admin/documentos').send({
      titulo: 'Com produto fantasma',
      tipo: 'MANUAL',
      visibilidade: 'PUBLICO',
      origem: 'LINK',
      urlExterna: 'https://exemplo.com',
      produtoIds: ['3f1c2a9e-8b7d-4c6e-9f00-123456789abc'],
    });
    expect(resposta.status).toBe(400);
  });

  it('lista para o admin inclui rascunhos e aceita filtro de situação', async () => {
    await criarDocumento({ titulo: 'Publicado' });
    await criarDocumento({ titulo: 'Rascunho', publicado: false });

    const todos = await admin.get('/api/admin/documentos').expect(200);
    expect(todos.body.total).toBe(2);

    const rascunhos = await admin.get('/api/admin/documentos?publicado=false').expect(200);
    expect(rascunhos.body.itens.map((d: { titulo: string }) => d.titulo)).toEqual(['Rascunho']);
  });

  it('excluir remove o registro e o arquivo', async () => {
    const doc = await criarDocumento();
    await admin.delete(`/api/admin/documentos/${doc.id}`).expect(204);
    await admin.get(`/api/admin/documentos/${doc.id}`).expect(404);
    expect(await arquivosNaPasta()).toEqual([]);
  });
});
