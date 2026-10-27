import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app, criarAdmin, criarCategoria, criarDocumento, criarProduto, entrarComo } from './ajudantes.js';

/**
 * CRUD completo de peças e categorias pela API do admin, campo a campo,
 * e como cada item aparece no portal (exibição pública).
 */

const UUID_INEXISTENTE = '3f1c2a9e-8b7d-4c6e-9f00-123456789abc';

let admin: Awaited<ReturnType<typeof entrarComo>>;

beforeEach(async () => {
  admin = await entrarComo(await criarAdmin());
});

describe('Peças: cadastrar', () => {
  it('grava todos os campos e devolve a peça pronta para a tela', async () => {
    const categoria = await criarCategoria('Rolamentos de Roletes Cônicos');
    const resposta = await admin
      .post('/api/admin/produtos')
      .send({
        codigo: ' 02474/20 ',
        nome: 'Rolamento de rolos cônicos (polegada)',
        segmento: 'PESADA',
        categoriaId: categoria.id,
        descricao: 'Série em polegadas.',
        aplicacoes: 'Cubo de roda de caminhões',
        diametroInternoMm: 28.58,
        diametroExternoMm: 68.26,
        larguraMm: 22.23,
        pesoKg: 0.42,
      })
      .expect(201);

    expect(resposta.body).toMatchObject({
      codigo: '02474/20',
      nome: 'Rolamento de rolos cônicos (polegada)',
      segmento: 'PESADA',
      categoria: { id: categoria.id, nome: 'Rolamentos de Roletes Cônicos' },
      descricao: 'Série em polegadas.',
      aplicacoes: 'Cubo de roda de caminhões',
      diametroInternoMm: 28.58,
      diametroExternoMm: 68.26,
      larguraMm: 22.23,
      pesoKg: 0.42,
      imagemUrl: null,
      ativo: true,
      totalDocumentos: 0,
    });
    expect(resposta.body.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('o código é salvo em maiúsculas', async () => {
    const resposta = await admin.post('/api/admin/produtos').send({ codigo: 'fxc 2041', nome: 'Cubo de roda', segmento: 'LEVE' }).expect(201);
    expect(resposta.body.codigo).toBe('FXC 2041');
  });

  it('aponta cada campo inválido de uma vez', async () => {
    const resposta = await admin
      .post('/api/admin/produtos')
      .send({ codigo: 'X', nome: 'ab', segmento: 'NAUTICO', diametroInternoMm: 0, pesoKg: -1 })
      .expect(400);
    const campos = resposta.body.erro.detalhes.map((detalhe: { campo: string }) => detalhe.campo).sort();
    expect(campos).toEqual(['codigo', 'diametroInternoMm', 'nome', 'pesoKg', 'segmento']);
  });

  it('código repetido (sem diferenciar maiúsculas) → 409', async () => {
    await criarProduto({ codigo: 'FXC 2041' });
    const resposta = await admin.post('/api/admin/produtos').send({ codigo: 'fxc 2041', nome: 'Outra', segmento: 'LEVE' }).expect(409);
    expect(resposta.body.erro.mensagem).toBe('Já existe um produto com este código.');
  });
});

describe('Peças: ler', () => {
  it('detalhe do admin conta os documentos ligados', async () => {
    const produto = await criarProduto({ codigo: '30205' });
    await criarDocumento({ produtoIds: [produto.id] });
    await criarDocumento({ produtoIds: [produto.id], publicado: false });
    const resposta = await admin.get(`/api/admin/produtos/${produto.id}`).expect(200);
    expect(resposta.body).toMatchObject({ codigo: '30205', totalDocumentos: 2 });
  });

  it('lista do admin em ordem de código, com paginação', async () => {
    for (const codigo of ['6205', '30205', 'FXC 2041', '02474']) await criarProduto({ codigo });
    const primeira = await admin.get('/api/admin/produtos?porPagina=3').expect(200);
    expect(primeira.body).toMatchObject({ total: 4, pagina: 1, porPagina: 3, totalPaginas: 2 });
    expect(primeira.body.itens.map((p: { codigo: string }) => p.codigo)).toEqual(['02474', '30205', '6205']);
    const segunda = await admin.get('/api/admin/produtos?porPagina=3&pagina=2').expect(200);
    expect(segunda.body.itens.map((p: { codigo: string }) => p.codigo)).toEqual(['FXC 2041']);
  });

  it('filtro de situação no admin', async () => {
    await criarProduto({ codigo: 'ATIVA' });
    await criarProduto({ codigo: 'INATIVA', ativo: false });
    const fora = await admin.get('/api/admin/produtos?ativo=false').expect(200);
    expect(fora.body.itens.map((p: { codigo: string }) => p.codigo)).toEqual(['INATIVA']);
    const todas = await admin.get('/api/admin/produtos').expect(200);
    expect(todas.body.total).toBe(2);
  });

  it('id inexistente → 404; id malformado → 400', async () => {
    await admin.get(`/api/admin/produtos/${UUID_INEXISTENTE}`).expect(404);
    const malformado = await admin.get('/api/admin/produtos/123').expect(400);
    expect(malformado.body.erro.detalhes).toEqual([{ campo: 'id', mensagem: 'Identificador inválido.' }]);
  });
});

describe('Peças: editar', () => {
  it('troca os campos, limpa medidas com null e muda a categoria', async () => {
    const antiga = await criarCategoria('Antiga');
    const nova = await criarCategoria('Nova');
    const produto = await criarProduto({ codigo: '30205', categoriaId: antiga.id, medidas: [25, 52, 16.25] });

    const resposta = await admin
      .put(`/api/admin/produtos/${produto.id}`)
      .send({ codigo: '30205', nome: 'Nome novo', segmento: 'AGRICOLA', categoriaId: nova.id, diametroInternoMm: 25, larguraMm: null })
      .expect(200);

    expect(resposta.body).toMatchObject({
      nome: 'Nome novo',
      segmento: 'AGRICOLA',
      categoria: { id: nova.id, nome: 'Nova' },
      diametroInternoMm: 25,
      diametroExternoMm: null,
      larguraMm: null,
    });
    expect(new Date(resposta.body.atualizadoEm).getTime()).toBeGreaterThan(produto.atualizadoEm.getTime());
  });

  it('tirar a categoria (null) deixa a peça sem categoria', async () => {
    const categoria = await criarCategoria();
    const produto = await criarProduto({ categoriaId: categoria.id });
    const resposta = await admin
      .put(`/api/admin/produtos/${produto.id}`)
      .send({ codigo: produto.codigo, nome: produto.nome, segmento: 'LEVE', categoriaId: null })
      .expect(200);
    expect(resposta.body.categoria).toBeNull();
  });

  it('não deixa usar o código de outra peça', async () => {
    await criarProduto({ codigo: '30205' });
    const outra = await criarProduto({ codigo: '30206' });
    await admin.put(`/api/admin/produtos/${outra.id}`).send({ codigo: '30205', nome: 'Outra', segmento: 'LEVE' }).expect(409);
  });

  it('peça inexistente → 404', async () => {
    await admin.put(`/api/admin/produtos/${UUID_INEXISTENTE}`).send({ codigo: '123', nome: 'Nada aqui', segmento: 'LEVE' }).expect(404);
  });
});

describe('Peças: excluir', () => {
  it('apaga a peça; os documentos continuam, sem o vínculo', async () => {
    const produto = await criarProduto();
    const documento = await criarDocumento({ produtoIds: [produto.id] });

    await admin.delete(`/api/admin/produtos/${produto.id}`).expect(204);
    await admin.get(`/api/admin/produtos/${produto.id}`).expect(404);
    const doc = await request(app).get(`/api/documentos/${documento.id}`).expect(200);
    expect(doc.body.produtos).toEqual([]);
  });

  it('peça inexistente → 404', async () => {
    await admin.delete(`/api/admin/produtos/${UUID_INEXISTENTE}`).expect(404);
  });
});

describe('Peças: exibição no portal', () => {
  it('a página pública traz a ficha, a categoria e os documentos', async () => {
    const categoria = await criarCategoria('Rolamentos de Esferas');
    const produto = await criarProduto({ codigo: '6205-2RS', categoriaId: categoria.id, medidas: [25, 52, 15] });
    await criarDocumento({ titulo: 'Ficha 6205', produtoIds: [produto.id] });

    const resposta = await request(app).get(`/api/produtos/${produto.id}`).expect(200);
    expect(resposta.body).toMatchObject({
      codigo: '6205-2RS',
      categoria: { nome: 'Rolamentos de Esferas' },
      diametroInternoMm: 25,
      diametroExternoMm: 52,
      larguraMm: 15,
      documentos: [{ titulo: 'Ficha 6205' }],
    });
    expect(resposta.body).not.toHaveProperty('totalDocumentos');
  });

  it('peça fora do catálogo: some da lista e a página dá 404', async () => {
    const produto = await criarProduto({ codigo: 'OCULTA', ativo: false });
    await criarProduto({ codigo: 'VISIVEL' });
    const lista = await request(app).get('/api/produtos').expect(200);
    expect(lista.body.itens.map((p: { codigo: string }) => p.codigo)).toEqual(['VISIVEL']);
    await request(app).get(`/api/produtos/${produto.id}`).expect(404);
  });
});

describe('Categorias: CRUD', () => {
  it('cria, detalha (com a contagem de todas as peças), edita e exclui', async () => {
    const criada = await admin
      .post('/api/admin/categorias')
      .send({ nome: '  Kits de Roda  ', descricao: '  Cubos completos.  ' })
      .expect(201);
    expect(criada.body).toMatchObject({ nome: 'Kits de Roda', descricao: 'Cubos completos.', totalProdutos: 0 });

    const id = criada.body.id;
    await criarProduto({ categoriaId: id });
    await criarProduto({ categoriaId: id, ativo: false });
    const detalhe = await admin.get(`/api/admin/categorias/${id}`).expect(200);
    expect(detalhe.body.totalProdutos).toBe(2);

    const editada = await admin.put(`/api/admin/categorias/${id}`).send({ nome: 'Kits de Roda para Turismo', descricao: '' }).expect(200);
    expect(editada.body).toMatchObject({ nome: 'Kits de Roda para Turismo', descricao: null });

    await admin.delete(`/api/admin/categorias/${id}`).expect(204);
    await admin.get(`/api/admin/categorias/${id}`).expect(404);
  });

  it('valida o nome', async () => {
    const curto = await admin.post('/api/admin/categorias').send({ nome: 'ab' }).expect(400);
    expect(curto.body.erro.detalhes).toEqual([{ campo: 'nome', mensagem: 'Informe o nome da categoria.' }]);
    const longo = await admin.post('/api/admin/categorias').send({ nome: 'x'.repeat(121) }).expect(400);
    expect(longo.body.erro.detalhes[0].campo).toBe('nome');
  });

  it('não deixa renomear para o nome de outra categoria', async () => {
    await criarCategoria('Rolamentos de Esferas');
    const outra = await criarCategoria('Rolamentos de Agulhas');
    const resposta = await admin.put(`/api/admin/categorias/${outra.id}`).send({ nome: 'ROLAMENTOS DE ESFERAS' }).expect(409);
    expect(resposta.body.erro.mensagem).toBe('Já existe uma categoria com este nome.');
  });

  it('id inexistente → 404 em detalhe, edição e exclusão', async () => {
    await admin.get(`/api/admin/categorias/${UUID_INEXISTENTE}`).expect(404);
    await admin.put(`/api/admin/categorias/${UUID_INEXISTENTE}`).send({ nome: 'Qualquer' }).expect(404);
    await admin.delete(`/api/admin/categorias/${UUID_INEXISTENTE}`).expect(404);
  });

  it('lista do admin em ordem alfabética, com busca e as categorias vazias', async () => {
    await criarCategoria('Unidades de Rolamentos');
    await criarCategoria('Kits de Roda');
    await criarCategoria('Rolamentos de Agulhas');
    const todas = await admin.get('/api/admin/categorias').expect(200);
    expect(todas.body.map((c: { nome: string }) => c.nome)).toEqual(['Kits de Roda', 'Rolamentos de Agulhas', 'Unidades de Rolamentos']);
    const busca = await admin.get('/api/admin/categorias?busca=rolamentos').expect(200);
    expect(busca.body.map((c: { nome: string }) => c.nome)).toEqual(['Rolamentos de Agulhas', 'Unidades de Rolamentos']);
  });

  it('no portal, a contagem considera só as peças do catálogo', async () => {
    const categoria = await criarCategoria('Rolamentos de Esferas');
    await criarProduto({ categoriaId: categoria.id });
    await criarProduto({ categoriaId: categoria.id });
    await criarProduto({ categoriaId: categoria.id, ativo: false });
    const resposta = await request(app).get('/api/categorias').expect(200);
    expect(resposta.body).toEqual([expect.objectContaining({ nome: 'Rolamentos de Esferas', totalProdutos: 2 })]);
  });
});
