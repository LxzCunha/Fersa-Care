import fs from 'node:fs/promises';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../src/db/index.js';
import * as ia from '../src/lib/ia.js';
import type * as ModuloIa from '../src/lib/ia.js';
import { log } from '../src/lib/log.js';
import { chamados, documentoTrechos, type UsuarioAutenticado } from '../src/models/index.js';
import * as trechosRepository from '../src/repositories/trechos.repository.js';
import {
  aguardarFilaDeIndexacao,
  definirIndexacaoAoSalvar,
  indexarDocumento,
  indexarPendentes,
} from '../src/services/indexacao.service.js';
import { MENSAGEM_FORA_DO_AR } from '../src/services/assistente.service.js';
import { app, criarAdmin, criarDocumento, criarProduto, criarUsuario, entrarComo } from './ajudantes.js';

vi.mock('../src/lib/ia.js', async (original) => ({
  ...(await original<typeof ModuloIa>()),
  gerarEmbeddings: vi.fn(),
  conversar: vi.fn(),
  iaDisponivel: vi.fn(),
}));

/** Cada assunto ocupa uma posição do vetor: mesmo assunto fica próximo, assuntos diferentes, distantes. */
const ASSUNTOS = ['folga', 'torque', 'ruido', 'embreagem', 'comercia'];
function vetorDeTeste(texto: string): number[] {
  const simples = texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const vetor = new Array<number>(1024).fill(0);
  ASSUNTOS.forEach((assunto, indice) => {
    if (simples.includes(assunto)) vetor[indice] = 1;
  });
  vetor[1023] = 0.05; // nunca um vetor zerado
  return vetor;
}

function modeloResponde(...pedacos: string[]) {
  vi.mocked(ia.conversar).mockImplementation(async function* () {
    for (const pedaco of pedacos) {
      await Promise.resolve(); // cada pedaço chega depois, como no streaming de verdade
      yield pedaco;
    }
  });
}

interface Evento {
  tipo: string;
  [campo: string]: unknown;
}

async function perguntar(agente: ReturnType<typeof request.agent> | typeof request, pergunta: string, conversaId?: string) {
  const cliente = typeof agente === 'function' ? agente(app) : agente;
  const resposta = await cliente
    .post('/api/assistente/perguntas')
    .send({ pergunta, conversaId })
    .buffer(true)
    .parse((res, pronto) => {
      let texto = '';
      res.setEncoding('utf8');
      res.on('data', (pedaco: string) => (texto += pedaco));
      res.on('end', () => pronto(null, texto));
    });
  const eventos: Evento[] =
    resposta.status === 200
      ? String(resposta.body)
          .split('\n\n')
          .filter(Boolean)
          .map((bloco) => JSON.parse(bloco.split('\n').find((linha) => linha.startsWith('data: '))!.slice(6)) as Evento)
      : [];
  const texto = eventos.filter((evento) => evento.tipo === 'texto').map((evento) => evento.texto).join('');
  const fim = eventos.find((evento) => evento.tipo === 'fim');
  const conversa = eventos.find((evento) => evento.tipo === 'conversa')?.conversaId as string | undefined;
  return { resposta, eventos, texto, fim, conversaId: conversa };
}

/** O texto que o modelo recebeu na última chamada (fontes + pergunta). */
function contextoEnviadoAoModelo(): string {
  const chamadas = vi.mocked(ia.conversar).mock.calls;
  return chamadas.at(-1)![0].at(-1)!.content;
}

const comoUsuario = (pessoa: { id: string; nome: string; email: string; perfil: 'ADMIN' | 'USUARIO' }): UsuarioAutenticado => ({
  id: pessoa.id,
  nome: pessoa.nome,
  email: pessoa.email,
  perfil: pessoa.perfil,
});

beforeEach(() => {
  vi.mocked(ia.gerarEmbeddings).mockReset().mockImplementation((textos) => Promise.resolve(textos.map(vetorDeTeste)));
  vi.mocked(ia.conversar).mockReset();
  vi.mocked(ia.iaDisponivel).mockReset().mockResolvedValue(true);
  modeloResponde('Resposta padrão do modelo.');
  definirIndexacaoAoSalvar(false);
});

describe('Indexação dos documentos', () => {
  it('ficha + trechos do arquivo, com embeddings; o admin vê a situação', async () => {
    const produto = await criarProduto({ codigo: '30205' });
    const documento = await criarDocumento({
      titulo: 'Guia da folga axial',
      descricao: 'Como medir.',
      produtoIds: [produto.id],
      arquivo: { nome: 'guia.txt', conteudo: 'Meça a folga axial com relógio comparador.\n\nAperte a porca e confira de novo.' },
    });

    expect(await indexarDocumento(documento.id)).toEqual({ trechos: 2 });
    const trechos = await db.select().from(documentoTrechos).where(eq(documentoTrechos.documentoId, documento.id));
    expect(trechos.map((trecho) => trecho.conteudo).sort()).toEqual([
      'Documento: Guia da folga axial\n\nMeça a folga axial com relógio comparador.\n\nAperte a porca e confira de novo.',
      'Documento: Guia da folga axial\nTipo: Manual de montagem\nPeças relacionadas: 30205\nDescrição: Como medir.',
    ]);
    expect(trechos.every((trecho) => trecho.embedding.length === 1024)).toBe(true);

    const admin = await entrarComo(await criarAdmin());
    const detalhe = await admin.get(`/api/admin/documentos/${documento.id}`).expect(200);
    expect(detalhe.body.indexacao).toMatchObject({ situacao: 'INDEXADO', erro: null, trechos: 2 });
  });

  it('lê o texto de um PDF de verdade', async () => {
    const pdf = await fs.readFile(new URL('../seed/arquivos/ficha-tecnica-30205.pdf', import.meta.url));
    const documento = await criarDocumento({ titulo: 'Ficha 30205', arquivo: { nome: 'ficha.pdf', conteudo: pdf } });
    await indexarDocumento(documento.id);
    const trechos = await db.select().from(documentoTrechos).where(eq(documentoTrechos.documentoId, documento.id));
    expect(trechos.some((trecho) => trecho.conteudo.includes('(página 1)') && trecho.conteudo.includes('30205'))).toBe(true);
  });

  it('falha da IA fica registrada; indexar de novo limpa o erro e troca os trechos', async () => {
    const documento = await criarDocumento({ arquivo: { nome: 'a.txt', conteudo: 'Torque de aperto.' } });
    vi.mocked(ia.gerarEmbeddings).mockRejectedValueOnce(new ia.IaIndisponivel('Ollama fora do ar.'));
    await expect(indexarDocumento(documento.id)).rejects.toThrow('Ollama fora do ar.');

    const admin = await entrarComo(await criarAdmin());
    let detalhe = await admin.get(`/api/admin/documentos/${documento.id}`).expect(200);
    expect(detalhe.body.indexacao).toMatchObject({ situacao: 'FALHOU', erro: 'Ollama fora do ar.', trechos: 0 });

    await indexarDocumento(documento.id);
    await indexarDocumento(documento.id); // de novo: substitui, não duplica
    detalhe = await admin.get(`/api/admin/documentos/${documento.id}`).expect(200);
    expect(detalhe.body.indexacao).toMatchObject({ situacao: 'INDEXADO', erro: null, trechos: 2 });
  });

  it('arquivo ilegível (PDF corrompido) entra só com a ficha, sem falhar', async () => {
    const espiao = vi.spyOn(log, 'warn').mockImplementation(() => undefined);
    const documento = await criarDocumento({ titulo: 'PDF quebrado', arquivo: { nome: 'quebrado.pdf', conteudo: '%PDF-1.4 lixo' } });
    expect(await indexarDocumento(documento.id)).toEqual({ trechos: 1 });
    expect(espiao).toHaveBeenCalled();
    espiao.mockRestore();
  });

  it('documento excluído antes da vez dele na fila é ignorado', async () => {
    expect(await indexarDocumento('3f1c2a9e-8b7d-4c6e-9f00-123456789abc')).toBeUndefined();
  });

  it('salvar pelo admin põe na fila; editar marca como "na fila" de novo', async () => {
    definirIndexacaoAoSalvar(true);
    const admin = await entrarComo(await criarAdmin());
    const criado = await admin
      .post('/api/admin/documentos')
      .send({ titulo: 'Vídeo da folga', tipo: 'VIDEO', visibilidade: 'PUBLICO', origem: 'LINK', urlExterna: 'https://youtu.be/x' })
      .expect(201);
    await aguardarFilaDeIndexacao();
    let detalhe = await admin.get(`/api/admin/documentos/${criado.body.id}`).expect(200);
    expect(detalhe.body.indexacao).toMatchObject({ situacao: 'INDEXADO', trechos: 1 });

    definirIndexacaoAoSalvar(false);
    await admin
      .put(`/api/admin/documentos/${criado.body.id}`)
      .send({ titulo: 'Vídeo da folga axial', tipo: 'VIDEO', visibilidade: 'PUBLICO', origem: 'LINK', urlExterna: 'https://youtu.be/x' })
      .expect(200);
    detalhe = await admin.get(`/api/admin/documentos/${criado.body.id}`).expect(200);
    expect(detalhe.body.indexacao.situacao).toBe('NA_FILA');

    // O admin pede para indexar: vale mesmo com a indexação automática desligada.
    await admin.post(`/api/admin/documentos/${criado.body.id}/indexar`).expect(202);
    await aguardarFilaDeIndexacao();
    detalhe = await admin.get(`/api/admin/documentos/${criado.body.id}`).expect(200);
    expect(detalhe.body.indexacao.situacao).toBe('INDEXADO');
  });

  it('o comando indexa só os pendentes; com --todos, todos', async () => {
    const a = await criarDocumento({ arquivo: { nome: 'a.txt', conteudo: 'folga' } });
    await criarDocumento({ arquivo: { nome: 'b.txt', conteudo: 'torque' } });
    await indexarDocumento(a.id);
    expect((await indexarPendentes()).documentos).toBe(1);
    expect((await indexarPendentes()).documentos).toBe(0);
    expect((await indexarPendentes({ todos: true })).documentos).toBe(2);
  });
});

describe('Busca do assistente respeita quem pode ver cada documento', () => {
  it('matriz: visitante, cliente, cliente liberado e admin', async () => {
    const liberado = await criarUsuario({ nome: 'Liberado' });
    const outro = await criarUsuario({ nome: 'Outro' });
    const admin = await criarAdmin();
    const docs = {
      publico: await criarDocumento({ titulo: 'Folga — público', visibilidade: 'PUBLICO' }),
      clientes: await criarDocumento({ titulo: 'Folga — clientes', visibilidade: 'AUTENTICADO' }),
      restrito: await criarDocumento({ titulo: 'Folga — restrito', visibilidade: 'RESTRITO', liberadoPara: [liberado.id] }),
      rascunho: await criarDocumento({ titulo: 'Folga — rascunho', publicado: false }),
    };
    for (const documento of Object.values(docs)) await indexarDocumento(documento.id);

    const titulosPara = async (usuario: UsuarioAutenticado | undefined) =>
      [...new Set((await trechosRepository.buscarParecidos(vetorDeTeste('folga'), usuario, 20)).map((t) => t.titulo))].sort();

    expect(await titulosPara(undefined)).toEqual(['Folga — público']);
    expect(await titulosPara(comoUsuario(outro))).toEqual(['Folga — clientes', 'Folga — público']);
    expect(await titulosPara(comoUsuario(liberado))).toEqual(['Folga — clientes', 'Folga — público', 'Folga — restrito']);
    // Nem o admin recebe rascunho no assistente (não está no portal).
    expect(await titulosPara(comoUsuario(admin))).toEqual(['Folga — clientes', 'Folga — público', 'Folga — restrito']);
  });

  it('visitante perguntando sobre material exclusivo: nada dele chega ao modelo nem às fontes', async () => {
    const exclusivo = await criarDocumento({
      titulo: 'Condições comerciais',
      visibilidade: 'AUTENTICADO',
      arquivo: { nome: 'c.txt', conteudo: 'Condições comerciais secretas: desconto de 40%.' },
    });
    await indexarDocumento(exclusivo.id);
    modeloResponde('Não encontrei essa informação nos materiais do portal.');

    const { fim } = await perguntar(request, 'Quais são as condições comerciais?');
    expect(contextoEnviadoAoModelo()).not.toContain('secretas');
    expect(contextoEnviadoAoModelo()).toContain('Nenhuma fonte encontrada');
    expect(fim?.fontes).toEqual([]);
  });

  it('os trechos de outro assunto (distantes) não vão para o modelo', async () => {
    const documento = await criarDocumento({ titulo: 'Torque', arquivo: { nome: 't.txt', conteudo: 'Torque de aperto: 200 N·m.' } });
    await indexarDocumento(documento.id);
    await perguntar(request, 'Como medir a folga axial?');
    expect(contextoEnviadoAoModelo()).not.toContain('200 N·m');
  });
});

describe('Perguntas ao assistente', () => {
  it('responde aos pedaços, com as fontes citadas e a conversa guardada', async () => {
    const documento = await criarDocumento({
      titulo: 'Guia da folga axial',
      arquivo: { nome: 'g.txt', conteudo: 'A folga axial deve ficar entre 0,02 e 0,05 mm.' },
    });
    await indexarDocumento(documento.id);
    modeloResponde('A folga axial ', 'deve ficar entre 0,02 e 0,05 mm [1].');

    const { resposta, eventos, texto, fim, conversaId } = await perguntar(request, 'Qual a folga axial do cubo?');
    expect(resposta.headers['content-type']).toContain('text/event-stream');
    expect(eventos.map((evento) => evento.tipo)).toEqual(['conversa', 'texto', 'texto', 'fim']);
    expect(texto).toBe('A folga axial deve ficar entre 0,02 e 0,05 mm [1].');
    expect(fim).toMatchObject({
      fontes: [{ tipo: 'DOCUMENTO', id: documento.id, titulo: 'Guia da folga axial', numero: 1 }],
      encaminhamento: 'NENHUM',
      chamado: null,
    });
    expect(contextoEnviadoAoModelo()).toContain('[1] Documento "Guia da folga axial" (Manual de montagem)');

    const conversa = await request(app).get(`/api/assistente/conversas/${conversaId}`).expect(200);
    expect(conversa.body.mensagens.map((m: { papel: string; conteudo: string }) => [m.papel, m.conteudo])).toEqual([
      ['USUARIO', 'Qual a folga axial do cubo?'],
      ['ASSISTENTE', 'A folga axial deve ficar entre 0,02 e 0,05 mm [1].'],
    ]);
  });

  it('fonte que o modelo não citou não aparece', async () => {
    const documento = await criarDocumento({ arquivo: { nome: 'g.txt', conteudo: 'Ruído no rolamento.' } });
    await indexarDocumento(documento.id);
    modeloResponde('Posso ajudar só com peças, produtos e dúvidas técnicas da FERSA.');
    const { fim } = await perguntar(request, 'O que é ruído? Me passa uma receita de bolo.');
    expect(fim?.fontes).toEqual([]);
  });

  it('peça citada pelo código entra com a ficha do catálogo', async () => {
    await criarProduto({ codigo: '32008 X', nome: 'Rolamento de rolos cônicos', medidas: [40, 68, 19] });
    await criarProduto({ codigo: 'FORA', ativo: false });
    modeloResponde('O 32008 X tem Ø interno de 40 mm [1].');

    const { fim } = await perguntar(request, 'Qual o diâmetro interno do 32008x?');
    const contexto = contextoEnviadoAoModelo();
    expect(contexto).toContain('[1] Peça 32008 X do catálogo FERSA');
    expect(contexto).toContain('Diâmetro interno: 40 mm');
    expect(contexto).toContain('Diâmetro externo: 68 mm');
    expect(fim?.fontes).toEqual([expect.objectContaining({ tipo: 'PRODUTO', titulo: 'Peça 32008 X' })]);
  });

  it('continua a conversa: o histórico vai para o modelo', async () => {
    modeloResponde('Primeira resposta.');
    const primeira = await perguntar(request, 'Como montar o rolamento do cubo de roda dianteiro?');
    modeloResponde('Segunda resposta.');
    await perguntar(request, 'e o torque?', primeira.conversaId);

    const mensagens = vi.mocked(ia.conversar).mock.calls.at(-1)![0];
    expect(mensagens.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user']);
    expect(mensagens[1]?.content).toBe('Como montar o rolamento do cubo de roda dianteiro?');
    // A busca usa as duas perguntas juntas (a segunda sozinha não diz de qual peça é).
    expect(vi.mocked(ia.gerarEmbeddings).mock.calls.at(-1)![0]).toEqual([
      'Como montar o rolamento do cubo de roda dianteiro?\ne o torque?',
    ]);
  });

  it('Ollama fora do ar: avisa e oferece o chamado', async () => {
    vi.mocked(ia.gerarEmbeddings).mockRejectedValue(new ia.IaIndisponivel('sem conexão'));
    const espiao = vi.spyOn(log, 'warn').mockImplementation(() => undefined);
    const { texto, fim } = await perguntar(request, 'Qual a folga axial?');
    expect(espiao).toHaveBeenCalledWith({ motivo: 'sem conexão' }, expect.stringContaining('Assistente sem IA'));
    espiao.mockRestore();
    expect(texto).toBe(MENSAGEM_FORA_DO_AR);
    expect(fim).toMatchObject({ encaminhamento: 'SUGERIR_CHAMADO' });
  });

  it('pergunta vazia ou longa demais → 400; conversa que não existe → 404 (antes do streaming)', async () => {
    const vazia = await request(app).post('/api/assistente/perguntas').send({ pergunta: ' ' }).expect(400);
    expect(vazia.body.erro.detalhes[0].campo).toBe('pergunta');
    await request(app).post('/api/assistente/perguntas').send({ pergunta: 'x'.repeat(1001) }).expect(400);
    const inexistente = await request(app)
      .post('/api/assistente/perguntas')
      .send({ pergunta: 'Oi', conversaId: '3f1c2a9e-8b7d-4c6e-9f00-123456789abc' })
      .expect(404);
    expect(inexistente.headers['content-type']).toContain('application/json');
  });

  it('conversa de um cliente: só ele continua e lê; a de visitante, quem tem o id', async () => {
    const dono = await entrarComo(await criarUsuario());
    const intruso = await entrarComo(await criarUsuario());
    const { conversaId } = await perguntar(dono, 'Como medir a folga?');
    await intruso.get(`/api/assistente/conversas/${conversaId}`).expect(404);
    await request(app).get(`/api/assistente/conversas/${conversaId}`).expect(404);
    const tentativa = await perguntar(intruso, 'quero ver', conversaId);
    expect(tentativa.resposta.status).toBe(404);
    await dono.get(`/api/assistente/conversas/${conversaId}`).expect(200);

    const visitante = await perguntar(request, 'Como medir a folga?');
    await request(app).get(`/api/assistente/conversas/${visitante.conversaId}`).expect(200);
  });
});

describe('Encaminhamento ao suporte técnico', () => {
  it('cliente: na 1ª reclamação o assistente tenta de novo e sugere; na 2ª abre o chamado sozinho', async () => {
    const cliente = await criarUsuario({ nome: 'Carlos Mendes', email: 'carlos@exemplo.com' });
    const agente = await entrarComo(cliente);
    const inicio = await perguntar(agente, 'Meu cubo de roda faz ruído depois da troca do rolamento.');

    modeloResponde('Confira o torque da porca do cubo.');
    const primeira = await perguntar(agente, 'Não ajudou, continua com o ruído.', inicio.conversaId);
    expect(primeira.fim).toMatchObject({ encaminhamento: 'SUGERIR_CHAMADO', chamado: null });
    const chamadasAoModelo = vi.mocked(ia.conversar).mock.calls.length;

    const segunda = await perguntar(agente, 'Você não está ajudando.', inicio.conversaId);
    expect(vi.mocked(ia.conversar).mock.calls.length).toBe(chamadasAoModelo); // nem chama o modelo
    expect(segunda.fim).toMatchObject({ encaminhamento: 'CHAMADO_ABERTO', chamado: { numero: 1 } });
    expect(segunda.texto).toContain('Abri o chamado nº 1');
    expect(segunda.texto).toContain('carlos@exemplo.com');

    const [chamado] = await db.select().from(chamados);
    expect(chamado).toMatchObject({ numero: 1, usuarioId: cliente.id, nome: 'Carlos Mendes', email: 'carlos@exemplo.com', status: 'ABERTO' });
    expect(chamado!.resumo).toBe(
      '• Meu cubo de roda faz ruído depois da troca do rolamento.\n• Não ajudou, continua com o ruído.\n• Você não está ajudando.',
    );

    const terceira = await perguntar(agente, 'não resolveu nada', inicio.conversaId);
    expect(terceira.texto).toContain('chamado nº 1 já está com a equipe');
    expect(await db.select().from(chamados)).toHaveLength(1);
  });

  it('visitante pede um atendente: o chat pede o contato e o chamado sai pelo formulário', async () => {
    const { fim, conversaId, texto } = await perguntar(request, 'Quero falar com um atendente');
    expect(fim).toMatchObject({ encaminhamento: 'PEDIR_CONTATO' });
    expect(texto).toContain('deixe seu nome e um e-mail ou telefone');
    expect(vi.mocked(ia.conversar)).not.toHaveBeenCalled();

    const semContato = await request(app).post('/api/assistente/chamados').send({ conversaId }).expect(400);
    expect(semContato.body.erro.detalhes.map((d: { campo: string }) => d.campo)).toEqual(['nome', 'email']);

    const criado = await request(app)
      .post('/api/assistente/chamados')
      .send({ conversaId, nome: 'Rafael Souza', telefone: '(41) 99999-0003' })
      .expect(201);
    expect(criado.body).toMatchObject({ numero: 1 });
    expect(criado.body.mensagem).toContain('pelo (41) 99999-0003');

    const conversa = await request(app).get(`/api/assistente/conversas/${conversaId}`).expect(200);
    expect(conversa.body.chamado).toEqual({ numero: 1 });
    expect(conversa.body.mensagens.at(-1).conteudo).toContain('Abri o chamado nº 1');

    await request(app).post('/api/assistente/chamados').send({ conversaId, nome: 'Rafael', email: 'r@x.com' }).expect(201);
    expect(await db.select().from(chamados)).toHaveLength(1);
  });

  it('cliente logado pelo botão "Abrir chamado": usa os dados da conta', async () => {
    const agente = await entrarComo(await criarUsuario({ nome: 'Juliana', email: 'juliana@exemplo.com' }));
    const { conversaId } = await perguntar(agente, 'Rolamento esquentando no trator.');
    const criado = await agente.post('/api/assistente/chamados').send({ conversaId }).expect(201);
    expect(criado.body.numero).toBe(1);
    const [chamado] = await db.select().from(chamados);
    expect(chamado).toMatchObject({ nome: 'Juliana', email: 'juliana@exemplo.com', resumo: '• Rolamento esquentando no trator.' });
  });
});

describe('Chamados na administração', () => {
  async function abrirChamado(nome: string, pergunta: string) {
    const { conversaId } = await perguntar(request, pergunta);
    await request(app).post('/api/assistente/chamados').send({ conversaId, nome, email: `${nome.toLowerCase()}@x.com` }).expect(201);
  }

  it('só o admin acessa', async () => {
    await request(app).get('/api/admin/chamados').expect(401);
    const cliente = await entrarComo(await criarUsuario());
    await cliente.get('/api/admin/chamados').expect(403);
  });

  it('lista os mais novos primeiro, com contagem por situação, filtro e busca (inclusive pelo número)', async () => {
    await abrirChamado('Ana', 'Ruído no cubo dianteiro');
    await abrirChamado('Bruno', 'Torque do 30205');
    const admin = await entrarComo(await criarAdmin());

    const lista = await admin.get('/api/admin/chamados').expect(200);
    expect(lista.body).toMatchObject({ total: 2, porStatus: { ABERTO: 2, EM_ATENDIMENTO: 0, RESOLVIDO: 0 } });
    expect(lista.body.itens.map((c: { nome: string }) => c.nome)).toEqual(['Bruno', 'Ana']);
    expect(lista.body.itens[0]).toMatchObject({ numero: 2, status: 'ABERTO', clienteCadastrado: false, resumo: '• Torque do 30205' });

    const busca = await admin.get('/api/admin/chamados?busca=ruido').expect(200);
    expect(busca.body.itens.map((c: { nome: string }) => c.nome)).toEqual(['Ana']);
    const porNumero = await admin.get('/api/admin/chamados?busca=%232').expect(200);
    expect(porNumero.body.itens.map((c: { nome: string }) => c.nome)).toEqual(['Bruno']);
  });

  it('detalhe traz a conversa; o admin muda a situação e anota', async () => {
    await abrirChamado('Ana', 'Ruído no cubo dianteiro');
    const admin = await entrarComo(await criarAdmin());
    const [{ id }] = (await admin.get('/api/admin/chamados').expect(200)).body.itens;

    const detalhe = await admin.get(`/api/admin/chamados/${id}`).expect(200);
    expect(detalhe.body.conversa.map((m: { papel: string }) => m.papel)).toEqual(['USUARIO', 'ASSISTENTE', 'ASSISTENTE']);

    const atualizado = await admin
      .patch(`/api/admin/chamados/${id}`)
      .send({ status: 'RESOLVIDO', observacao: 'Orientado a trocar o retentor.' })
      .expect(200);
    expect(atualizado.body).toMatchObject({ status: 'RESOLVIDO', observacao: 'Orientado a trocar o retentor.' });

    const filtrada = await admin.get('/api/admin/chamados?status=ABERTO').expect(200);
    expect(filtrada.body.total).toBe(0);
    await admin.patch(`/api/admin/chamados/${id}`).send({ status: 'FECHADO' }).expect(400);
    await admin.get('/api/admin/chamados/3f1c2a9e-8b7d-4c6e-9f00-123456789abc').expect(404);
  });
});
