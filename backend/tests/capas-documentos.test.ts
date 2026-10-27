import { loadImage } from '@napi-rs/canvas';
import fs from 'node:fs/promises';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { env } from '../src/config/env.js';
import { caminhoDoArquivo } from '../src/lib/armazenamento.js';
import { gerarCapasPendentes } from '../src/services/documentos-admin.service.js';
import { app, criarAdmin, criarDocumento, criarUsuario, entrarComo } from './ajudantes.js';

/** PDF de verdade (o seed usa o mesmo), para o pdf.js conseguir desenhar a 1ª página. */
const PDF = await fs.readFile(new URL('../seed/arquivos/ficha-tecnica-30205.pdf', import.meta.url));
const PDF_ILEGIVEL = Buffer.from('%PDF-1.4 sem conteúdo de verdade');
/** Menor PNG válido (1×1 px). */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

/** Só o cabeçalho de um MP4 (caixa "ftyp"): passa na conferência de conteúdo, mas não tem capa automática. */
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypmp42'), Buffer.alloc(16)]);

const BASE = { titulo: 'Ficha técnica 30205', tipo: 'FICHA_TECNICA', visibilidade: 'PUBLICO', origem: 'ARQUIVO' };

async function arquivosNaPasta() {
  return (await fs.readdir(env.UPLOAD_DIR)).sort();
}

const capas = async () => (await arquivosNaPasta()).filter((nome) => nome.endsWith('.webp'));

/** Espera o evento "finish" que limpa os uploads de uma requisição recusada. */
const esperarLimpeza = () => new Promise((resolver) => setTimeout(resolver, 50));

describe('Capas dos documentos', () => {
  let admin: Awaited<ReturnType<typeof entrarComo>>;

  beforeEach(async () => {
    admin = await entrarComo(await criarAdmin());
  });

  function cadastrar(dados: Record<string, unknown>, arquivos: { arquivo?: [Buffer, string]; capa?: [Buffer, string] }) {
    const requisicao = admin.post('/api/admin/documentos').field('dados', JSON.stringify(dados));
    if (arquivos.arquivo) requisicao.attach('arquivo', ...arquivos.arquivo);
    if (arquivos.capa) requisicao.attach('capa', ...arquivos.capa);
    return requisicao;
  }

  it('gera a capa da 1ª página do PDF e entrega em WebP, com cache público', async () => {
    const resposta = await cadastrar(BASE, { arquivo: [PDF, 'ficha.pdf'] }).expect(201);

    expect(resposta.body.capaPersonalizada).toBe(false);
    expect(resposta.body.capaUrl).toMatch(new RegExp(`^/api/documentos/${resposta.body.id}/capa\\?v=\\d+$`));
    expect(await arquivosNaPasta()).toHaveLength(2);

    const capa = await request(app).get(resposta.body.capaUrl).buffer(true).expect(200);
    expect(capa.headers['content-type']).toBe('image/webp');
    expect(capa.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    const imagem = await loadImage(capa.body as Buffer);
    expect(imagem.width).toBe(480);
    expect(imagem.height).toBeGreaterThan(imagem.width); // página em pé
  });

  it('sem capa quando não dá para gerar: o cadastro continua', async () => {
    const ilegivel = await cadastrar(BASE, { arquivo: [PDF_ILEGIVEL, 'quebrado.pdf'] }).expect(201);
    expect(ilegivel.body.capaUrl).toBeNull();
    await request(app).get(`/api/documentos/${ilegivel.body.id}/capa`).expect(404);

    const video = await cadastrar({ ...BASE, tipo: 'VIDEO' }, { arquivo: [MP4, 'video.mp4'] }).expect(201);
    expect(video.body.capaUrl).toBeNull();

    const imagem = await cadastrar(BASE, { arquivo: [PNG, 'diagrama.png'] }).expect(201);
    expect(imagem.body.capaUrl).not.toBeNull();
    expect(await capas()).toHaveLength(1);
  });

  it('capa enviada pelo admin sobrevive à troca do arquivo; removerCapa volta para a automática', async () => {
    const criado = await cadastrar(BASE, { arquivo: [PDF, 'ficha.pdf'], capa: [PNG, 'capa.png'] }).expect(201);
    expect(criado.body.capaPersonalizada).toBe(true);
    // Só a versão reduzida (WebP) da capa fica guardada, não o PNG enviado.
    const [capaEnviada] = await capas();
    expect(await arquivosNaPasta()).toHaveLength(2);

    const id = criado.body.id;
    const trocado = await admin
      .put(`/api/admin/documentos/${id}`)
      .field('dados', JSON.stringify({ ...BASE, titulo: 'Ficha técnica 30205 rev. B' }))
      .attach('arquivo', PDF, 'ficha-rev-b.pdf')
      .expect(200);
    expect(trocado.body.capaPersonalizada).toBe(true);
    expect(await capas()).toEqual([capaEnviada]);

    const removida = await admin.put(`/api/admin/documentos/${id}`).send({ ...BASE, removerCapa: true }).expect(200);
    expect(removida.body).toMatchObject({ capaPersonalizada: false, capaUrl: expect.any(String) });
    const depois = await capas();
    expect(depois).toHaveLength(1);
    expect(depois).not.toContain(capaEnviada);
  });

  it('capa automática some ao trocar o arquivo por um link; links aceitam capa enviada', async () => {
    const criado = await cadastrar(BASE, { arquivo: [PDF, 'ficha.pdf'] }).expect(201);
    const link = { ...BASE, tipo: 'VIDEO', origem: 'LINK', urlExterna: 'https://www.youtube.com/watch?v=abc' };

    const virouLink = await admin.put(`/api/admin/documentos/${criado.body.id}`).send(link).expect(200);
    expect(virouLink.body.capaUrl).toBeNull();
    expect(await arquivosNaPasta()).toEqual([]);

    const comCapa = await cadastrar(link, { capa: [PNG, 'miniatura.jpg.png'] }).expect(201);
    expect(comCapa.body).toMatchObject({ origem: 'LINK', capaPersonalizada: true, capaUrl: expect.any(String) });
    expect(await arquivosNaPasta()).toHaveLength(1);
  });

  it('a capa segue a permissão do próprio documento', async () => {
    const usuario = await criarUsuario();
    const cliente = await entrarComo(usuario);
    const capaDe = async (dados: Record<string, unknown>) =>
      (await cadastrar({ ...BASE, ...dados }, { arquivo: [PDF, 'ficha.pdf'] }).expect(201)).body.capaUrl as string;

    const paraClientes = await capaDe({ visibilidade: 'AUTENTICADO' });
    await request(app).get(paraClientes).expect(401);
    const vista = await cliente.get(paraClientes).expect(200);
    expect(vista.headers['cache-control']).toBe('private, max-age=86400');

    const restrito = await capaDe({ visibilidade: 'RESTRITO' });
    await cliente.get(restrito).expect(404);
    const liberado = await capaDe({ visibilidade: 'RESTRITO', usuarioIds: [usuario.id] });
    await cliente.get(liberado).expect(200);

    const rascunho = await capaDe({ publicado: false });
    await request(app).get(rascunho).expect(404);
    await cliente.get(rascunho).expect(404);
    await admin.get(rascunho).expect(200);
  });

  it('recusa capa que não é imagem, ilegível ou grande demais, sem deixar lixo', async () => {
    const pdfComoCapa = await cadastrar(BASE, { arquivo: [PDF, 'ficha.pdf'], capa: [PDF, 'capa.pdf'] });
    expect(pdfComoCapa.status).toBe(400);
    expect(pdfComoCapa.body.erro).toMatchObject({ codigo: 'TIPO_DE_ARQUIVO_INVALIDO', detalhes: [{ campo: 'capa' }] });

    // Extensão de imagem com outro conteúdo: barrado já no recebimento.
    const disfarcado = await cadastrar(BASE, { arquivo: [PDF, 'ficha.pdf'], capa: [Buffer.from('não é PNG'), 'capa.png'] });
    expect(disfarcado.status).toBe(400);
    expect(disfarcado.body.erro).toMatchObject({ codigo: 'CONTEUDO_NAO_CONFERE', detalhes: [{ campo: 'capa' }] });

    // Cabeçalho de PNG, mas a imagem não abre: recusado ao gerar a capa.
    const ilegivel = await cadastrar(BASE, {
      arquivo: [PDF, 'ficha.pdf'],
      capa: [Buffer.concat([PNG.subarray(0, 8), Buffer.from('resto corrompido')]), 'capa.png'],
    });
    expect(ilegivel.status).toBe(400);
    expect(ilegivel.body.erro.detalhes).toEqual([{ campo: 'capa', mensagem: expect.stringContaining('PNG') }]);

    const grande = await cadastrar(BASE, { arquivo: [PDF, 'ficha.pdf'], capa: [Buffer.alloc(6 * 1024 * 1024), 'capa.png'] });
    expect(grande.status).toBe(413);
    expect(grande.body.erro.detalhes).toEqual([{ campo: 'capa', mensagem: 'O arquivo passa do limite de 5 MB.' }]);

    await esperarLimpeza();
    expect(await arquivosNaPasta()).toEqual([]);
  });

  it('excluir o documento apaga também a capa', async () => {
    const criado = await cadastrar(BASE, { arquivo: [PDF, 'ficha.pdf'] }).expect(201);
    await admin.delete(`/api/admin/documentos/${criado.body.id}`).expect(204);
    expect(await arquivosNaPasta()).toEqual([]);
  });

  it('gera as capas pendentes dos documentos antigos sem mudar a data de atualização', async () => {
    const antigo = await criarDocumento({ titulo: 'Cadastrado antes das capas' });
    await fs.writeFile(caminhoDoArquivo(antigo.arquivoChave!), PDF);
    await criarDocumento({ titulo: 'Arquivo ilegível' });
    await criarDocumento({ titulo: 'Link', link: 'https://exemplo.com' });

    expect(await gerarCapasPendentes()).toEqual({ pendentes: 2, geradas: 1 });
    expect(await gerarCapasPendentes()).toEqual({ pendentes: 1, geradas: 0 });

    const detalhe = await request(app).get(`/api/documentos/${antigo.id}`).expect(200);
    expect(detalhe.body.capaUrl).toBe(`/api/documentos/${antigo.id}/capa?v=${antigo.atualizadoEm.getTime()}`);
  });
});
