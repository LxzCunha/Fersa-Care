import fs from 'node:fs/promises';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { env } from '../src/config/env.js';
import { app, criarAdmin, criarCategoria, criarProduto, criarUsuario, entrarComo } from './ajudantes.js';

/** Menor PNG válido (1×1 px). */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

async function arquivosNaPasta() {
  return (await fs.readdir(env.UPLOAD_DIR)).sort();
}

describe('Categorias', () => {
  let admin: Awaited<ReturnType<typeof entrarComo>>;

  beforeEach(async () => {
    admin = await entrarComo(await criarAdmin());
  });

  it('bloqueia a gestão para visitantes (401) e usuários comuns (403)', async () => {
    await request(app).post('/api/admin/categorias').send({ nome: 'Invasão' }).expect(401);
    const usuario = await entrarComo(await criarUsuario());
    await usuario.post('/api/admin/categorias').send({ nome: 'Invasão' }).expect(403);
  });

  it('cria, edita, lista com a contagem de peças e exclui', async () => {
    const criada = await admin
      .post('/api/admin/categorias')
      .send({ nome: '  Rolamentos de Esferas ', descricao: '' })
      .expect(201);
    expect(criada.body).toMatchObject({ nome: 'Rolamentos de Esferas', descricao: null, totalProdutos: 0 });

    await criarProduto({ categoriaId: criada.body.id });
    const editada = await admin
      .put(`/api/admin/categorias/${criada.body.id}`)
      .send({ nome: 'Rolamentos rígidos de esferas', descricao: 'Uma ou duas carreiras.' })
      .expect(200);
    expect(editada.body).toMatchObject({ nome: 'Rolamentos rígidos de esferas', totalProdutos: 1 });

    const lista = await admin.get('/api/admin/categorias?busca=rigidos').expect(200);
    expect(lista.body).toHaveLength(1);

    await admin.delete(`/api/admin/categorias/${criada.body.id}`).expect(204);
    await admin.get(`/api/admin/categorias/${criada.body.id}`).expect(404);
  });

  it('recusa nome repetido, mesmo com maiúsculas diferentes', async () => {
    await criarCategoria('Rolamentos de Agulhas');
    const resposta = await admin.post('/api/admin/categorias').send({ nome: 'rolamentos de agulhas' });
    expect(resposta.status).toBe(409);
    expect(resposta.body.erro.mensagem).toBe('Já existe uma categoria com este nome.');
  });

  it('excluir a categoria mantém as peças, sem categoria', async () => {
    const categoria = await criarCategoria();
    const produto = await criarProduto({ categoriaId: categoria.id });
    await admin.delete(`/api/admin/categorias/${categoria.id}`).expect(204);

    const detalhe = await request(app).get(`/api/produtos/${produto.id}`).expect(200);
    expect(detalhe.body.categoria).toBeNull();
  });

  it('o portal lista só categorias com peças ativas', async () => {
    const comPecas = await criarCategoria('Rolamentos de Roletes Cônicos');
    const soInativas = await criarCategoria('Ferramentas Fersa');
    await criarCategoria('Outros');
    await criarProduto({ categoriaId: comPecas.id });
    await criarProduto({ categoriaId: comPecas.id });
    await criarProduto({ categoriaId: comPecas.id, ativo: false });
    await criarProduto({ categoriaId: soInativas.id, ativo: false });

    const resposta = await request(app).get('/api/categorias').expect(200);
    expect(resposta.body).toEqual([expect.objectContaining({ nome: 'Rolamentos de Roletes Cônicos', totalProdutos: 2 })]);
  });
});

describe('Peças: categoria, medidas e filtros', () => {
  it('lista com a categoria, filtra por categoria e busca pelo nome dela', async () => {
    const esferas = await criarCategoria('Rolamentos de Esferas');
    const conicos = await criarCategoria('Rolamentos de Roletes Cônicos');
    await criarProduto({ codigo: '6205-2RS', categoriaId: esferas.id });
    await criarProduto({ codigo: '30205', categoriaId: conicos.id });

    const porCategoria = await request(app).get(`/api/produtos?categoriaId=${esferas.id}`).expect(200);
    expect(porCategoria.body.itens).toEqual([
      expect.objectContaining({ codigo: '6205-2RS', categoria: { id: esferas.id, nome: 'Rolamentos de Esferas' } }),
    ]);

    const porNome = await request(app).get('/api/produtos?busca=conicos').expect(200);
    expect(porNome.body.itens.map((p: { codigo: string }) => p.codigo)).toEqual(['30205']);
  });

  it('filtra por faixa de medidas (mm) e ignora peças sem a medida', async () => {
    await criarProduto({ codigo: 'P25', medidas: [25, 52, 15] });
    await criarProduto({ codigo: 'P30', medidas: [30, 62, 17.25] });
    await criarProduto({ codigo: 'P40', medidas: [40, 68, 19] });
    await criarProduto({ codigo: 'KIT' });

    const resposta = await request(app).get('/api/produtos?internoMin=26&externoMax=70&larguraMin=17').expect(200);
    expect(resposta.body.itens.map((p: { codigo: string }) => p.codigo)).toEqual(['P30', 'P40']);
    expect(resposta.body.itens[0]).toMatchObject({ diametroInternoMm: 30, diametroExternoMm: 62, larguraMm: 17.25 });

    await request(app).get('/api/produtos?internoMin=abc').expect(400);
  });

  it('recusa categoria inexistente apontando o campo', async () => {
    const admin = await entrarComo(await criarAdmin());
    const resposta = await admin.post('/api/admin/produtos').send({
      codigo: '6006',
      nome: 'Rolamento de esferas',
      segmento: 'INDUSTRIAL',
      categoriaId: '3f1c2a9e-8b7d-4c6e-9f00-123456789abc',
    });
    expect(resposta.status).toBe(400);
    expect(resposta.body.erro.detalhes).toEqual([expect.objectContaining({ campo: 'categoriaId' })]);
  });
});

describe('Foto da peça', () => {
  let admin: Awaited<ReturnType<typeof entrarComo>>;
  const dados = { codigo: '30205', nome: 'Rolamento de rolos cônicos', segmento: 'LEVE', diametroInternoMm: 25 };

  beforeEach(async () => {
    admin = await entrarComo(await criarAdmin());
  });

  it('cadastra com foto, entrega a imagem e a troca apaga a antiga', async () => {
    const criado = await admin
      .post('/api/admin/produtos')
      .field('dados', JSON.stringify(dados))
      .attach('imagem', PNG, 'foto.png')
      .expect(201);
    expect(criado.body.imagemUrl).toMatch(new RegExp(`^/api/produtos/${criado.body.id}/imagem\\?v=\\d+$`));
    expect(criado.body).not.toHaveProperty('imagemChave');
    const [primeira] = await arquivosNaPasta();

    const imagem = await request(app).get(criado.body.imagemUrl).expect(200);
    expect(imagem.headers['content-type']).toBe('image/png');
    expect(imagem.headers['cache-control']).toContain('public');

    await admin
      .put(`/api/admin/produtos/${criado.body.id}`)
      .field('dados', JSON.stringify(dados))
      .attach('imagem', PNG, 'nova.png')
      .expect(200);
    const depois = await arquivosNaPasta();
    expect(depois).toHaveLength(1);
    expect(depois[0]).not.toBe(primeira);

    // Editar sem foto nova mantém a atual; removerImagem apaga.
    await admin.put(`/api/admin/produtos/${criado.body.id}`).send(dados).expect(200);
    expect(await arquivosNaPasta()).toEqual(depois);
    const semFoto = await admin
      .put(`/api/admin/produtos/${criado.body.id}`)
      .send({ ...dados, removerImagem: true })
      .expect(200);
    expect(semFoto.body.imagemUrl).toBeNull();
    expect(await arquivosNaPasta()).toEqual([]);
  });

  it('recusa arquivo que não é imagem e não deixa lixo na pasta', async () => {
    const resposta = await admin
      .post('/api/admin/produtos')
      .field('dados', JSON.stringify(dados))
      .attach('imagem', Buffer.from('%PDF-1.4'), 'catalogo.pdf');
    expect(resposta.status).toBe(400);
    expect(resposta.body.erro.codigo).toBe('TIPO_DE_ARQUIVO_INVALIDO');
    expect(await arquivosNaPasta()).toEqual([]);
  });

  it('foto de peça fora do catálogo só aparece para o admin', async () => {
    const criado = await admin
      .post('/api/admin/produtos')
      .field('dados', JSON.stringify({ ...dados, ativo: false }))
      .attach('imagem', PNG, 'foto.png')
      .expect(201);

    await request(app).get(`/api/produtos/${criado.body.id}/imagem`).expect(404);
    const doAdmin = await admin.get(`/api/produtos/${criado.body.id}/imagem`).expect(200);
    expect(doAdmin.headers['cache-control']).toBe('private, no-cache');
  });

  it('excluir a peça apaga a foto do disco', async () => {
    const criado = await admin
      .post('/api/admin/produtos')
      .field('dados', JSON.stringify(dados))
      .attach('imagem', PNG, 'foto.png')
      .expect(201);
    await admin.delete(`/api/admin/produtos/${criado.body.id}`).expect(204);
    expect(await arquivosNaPasta()).toEqual([]);
  });
});
