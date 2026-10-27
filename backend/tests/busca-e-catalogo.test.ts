import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app, criarAdmin, criarDocumento, criarProduto, entrarComo } from './ajudantes.js';

async function titulosEncontrados(busca: string) {
  const resposta = await request(app).get('/api/documentos').query({ busca }).expect(200);
  return resposta.body.itens.map((item: { titulo: string }) => item.titulo).sort();
}

describe('Busca de documentos', () => {
  it('ignora acentos e encontra plural pelo radical', async () => {
    await criarDocumento({ titulo: 'Manutenção preventiva de rolamento' });
    await criarDocumento({ titulo: 'Outro assunto' });

    expect(await titulosEncontrados('manutencao')).toEqual(['Manutenção preventiva de rolamento']);
    expect(await titulosEncontrados('rolamentos')).toEqual(['Manutenção preventiva de rolamento']);
  });

  it('aceita pedaços de palavras em qualquer ordem', async () => {
    await criarDocumento({ titulo: 'Rolamento de rolos cônicos' });
    expect(await titulosEncontrados('conic rolam')).toEqual(['Rolamento de rolos cônicos']);
  });

  it('encontra pelo código do produto relacionado mesmo sem espaços ou com hífen', async () => {
    const produto = await criarProduto({ codigo: '32008 X' });
    await criarDocumento({ titulo: 'Guia de montagem', produtoIds: [produto.id] });

    expect(await titulosEncontrados('32008X')).toEqual(['Guia de montagem']);
    expect(await titulosEncontrados('32008-x')).toEqual(['Guia de montagem']);
  });

  it('não mostra na busca o que o visitante não pode ver', async () => {
    await criarDocumento({ titulo: 'Boletim exclusivo', visibilidade: 'AUTENTICADO' });
    expect(await titulosEncontrados('boletim')).toEqual([]);
  });

  it('trata % e _ como texto comum', async () => {
    await criarDocumento({ titulo: 'Documento qualquer' });
    expect(await titulosEncontrados('%')).toEqual([]);
    expect(await titulosEncontrados('_')).toEqual([]);
  });

  it('filtra por tipo e por segmento do produto', async () => {
    const pesado = await criarProduto({ segmento: 'PESADA' });
    await criarDocumento({ titulo: 'Vídeo pesado', tipo: 'VIDEO', produtoIds: [pesado.id] });
    await criarDocumento({ titulo: 'Manual leve', tipo: 'MANUAL' });

    const porTipo = await request(app).get('/api/documentos?tipo=VIDEO').expect(200);
    expect(porTipo.body.itens.map((d: { titulo: string }) => d.titulo)).toEqual(['Vídeo pesado']);

    const porSegmento = await request(app).get('/api/documentos?segmento=PESADA').expect(200);
    expect(porSegmento.body.itens.map((d: { titulo: string }) => d.titulo)).toEqual(['Vídeo pesado']);

    await request(app).get('/api/documentos?tipo=INEXISTENTE').expect(400);
  });

  it('pagina os resultados', async () => {
    for (let i = 0; i < 5; i++) await criarDocumento();
    const resposta = await request(app).get('/api/documentos?porPagina=2&pagina=3').expect(200);
    expect(resposta.body).toMatchObject({ total: 5, pagina: 3, porPagina: 2, totalPaginas: 3 });
    expect(resposta.body.itens).toHaveLength(1);
  });
});

describe('Catálogo de produtos', () => {
  it('busca por código sem espaços e por aplicação sem acento', async () => {
    await criarProduto({ codigo: 'FXC 2041', aplicacoes: 'Eixo dianteiro de caminhões' });
    await criarProduto({ codigo: '6205-2RS' });

    const porCodigo = await request(app).get('/api/produtos?busca=fxc2041').expect(200);
    expect(porCodigo.body.itens.map((p: { codigo: string }) => p.codigo)).toEqual(['FXC 2041']);

    const porAplicacao = await request(app).get('/api/produtos?busca=caminhoes').expect(200);
    expect(porAplicacao.body.itens.map((p: { codigo: string }) => p.codigo)).toEqual(['FXC 2041']);
  });

  it('a página do produto lista só os documentos visíveis para quem acessa', async () => {
    const produto = await criarProduto();
    await criarDocumento({ titulo: 'Público', produtoIds: [produto.id] });
    await criarDocumento({ titulo: 'Só clientes', visibilidade: 'AUTENTICADO', produtoIds: [produto.id] });

    const visitante = await request(app).get(`/api/produtos/${produto.id}`).expect(200);
    expect(visitante.body.documentos.map((d: { titulo: string }) => d.titulo)).toEqual(['Público']);

    const admin = await entrarComo(await criarAdmin());
    const comLogin = await admin.get(`/api/produtos/${produto.id}`).expect(200);
    expect(comLogin.body.documentos).toHaveLength(2);
  });

  it('produto inativo some do portal mas continua no admin', async () => {
    const admin = await entrarComo(await criarAdmin());
    const criado = await admin
      .post('/api/admin/produtos')
      .send({ codigo: 'abc 123', nome: 'Produto descontinuado', segmento: 'INDUSTRIAL', ativo: false })
      .expect(201);
    expect(criado.body.codigo).toBe('ABC 123');

    await request(app).get(`/api/produtos/${criado.body.id}`).expect(404);
    expect((await request(app).get('/api/produtos').expect(200)).body.total).toBe(0);
    expect((await admin.get('/api/admin/produtos').expect(200)).body.total).toBe(1);
  });

  it('recusa código de produto repetido', async () => {
    const admin = await entrarComo(await criarAdmin());
    await criarProduto({ codigo: '30205' });
    const resposta = await admin.post('/api/admin/produtos').send({ codigo: '30205', nome: 'Duplicado', segmento: 'LEVE' });
    expect(resposta.status).toBe(409);
  });
});

describe('Painel do administrador', () => {
  it('conta visualizações de visitantes e usuários, mas não as do admin', async () => {
    const doc = await criarDocumento({ titulo: 'Mais lido' });
    await request(app).get(`/api/documentos/${doc.id}`).expect(200);
    await request(app).get(`/api/documentos/${doc.id}`).expect(200);

    const admin = await entrarComo(await criarAdmin());
    await admin.get(`/api/documentos/${doc.id}`).expect(200);

    const painel = await admin.get('/api/admin/painel').expect(200);
    expect(painel.body.visualizacoes30Dias).toEqual({ total: 2, deVisitantes: 2 });
    expect(painel.body.maisAcessados[0]).toMatchObject({ titulo: 'Mais lido', visualizacoes: 2 });
    expect(painel.body.visualizacoesPorDia).toHaveLength(14);
    expect(painel.body.visualizacoesPorDia.at(-1).total).toBe(2);
  });
});
