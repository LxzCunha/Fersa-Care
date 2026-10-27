import { paraMensagemDto } from '../dtos/assistente.dto.js';
import {
  codigosCitados,
  demonstraInsatisfacao,
  pedeAtendimento,
  RECLAMACOES_PARA_ABRIR_CHAMADO,
} from '../lib/assistente/conversa.js';
import {
  fontesCitadas,
  montarMensagens,
  ROTULOS_DOS_TIPOS,
  type FonteDoContexto,
} from '../lib/assistente/instrucoes.js';
import { naoEncontrado, requisicaoInvalida } from '../lib/erros.js';
import { conversar, gerarEmbeddings, IaIndisponivel } from '../lib/ia.js';
import { log } from '../lib/log.js';
import type {
  AssistenteConversa,
  AssistenteMensagem,
  Chamado,
  FonteDaResposta,
  LinhaProduto,
  UsuarioAutenticado,
} from '../models/index.js';
import * as assistenteRepository from '../repositories/assistente.repository.js';
import * as chamadosRepository from '../repositories/chamados.repository.js';
import * as produtosRepository from '../repositories/produtos.repository.js';
import * as trechosRepository from '../repositories/trechos.repository.js';
import * as usuariosRepository from '../repositories/usuarios.repository.js';
import type { DadosAbrirChamado } from '../validators/chamados.validator.js';
import type { DadosPergunta } from '../validators/assistente.validator.js';
import { abrirChamadoDaConversa } from './chamados.service.js';

/** Trechos com distância maior que isso não têm a ver com a pergunta (cosseno, bge-m3). */
const DISTANCIA_MAXIMA = 0.62;
const TRECHOS_BUSCADOS = 10;
const DOCUMENTOS_NO_CONTEXTO = 4;
const TRECHOS_POR_DOCUMENTO = 3;

export type Encaminhamento = 'NENHUM' | 'SUGERIR_CHAMADO' | 'PEDIR_CONTATO' | 'CHAMADO_ABERTO';

export type EventoDoAssistente =
  | { tipo: 'conversa'; conversaId: string }
  | { tipo: 'texto'; texto: string }
  | {
      tipo: 'fim';
      mensagemId: string;
      fontes: FonteDaResposta[];
      encaminhamento: Encaminhamento;
      chamado: { numero: number } | null;
    };

export const MENSAGEM_FORA_DO_AR =
  'O assistente está fora do ar agora. Se precisar de ajuda, abra um chamado com a equipe técnica da FERSA.';

/** Conversa de visitante vale para quem tem o id (aleatório; só o navegador que começou conhece). */
async function conversaAcessivel(id: string, usuario: UsuarioAutenticado | undefined): Promise<AssistenteConversa> {
  const conversa = await assistenteRepository.buscarConversa(id);
  if (!conversa || (conversa.usuarioId !== null && conversa.usuarioId !== usuario?.id)) {
    throw naoEncontrado('Conversa não encontrada.');
  }
  return conversa;
}

export async function obterConversa(id: string, usuario: UsuarioAutenticado | undefined) {
  const conversa = await conversaAcessivel(id, usuario);
  const [mensagens, chamado] = await Promise.all([
    assistenteRepository.listarMensagens(conversa.id),
    chamadosRepository.buscarPorConversa(conversa.id),
  ]);
  return {
    id: conversa.id,
    mensagens: mensagens.map(paraMensagemDto),
    chamado: chamado ? { numero: chamado.numero } : null,
  };
}

export async function* responder(
  dados: DadosPergunta,
  usuario: UsuarioAutenticado | undefined,
  sinal?: AbortSignal,
): AsyncGenerator<EventoDoAssistente> {
  const conversa = dados.conversaId
    ? await conversaAcessivel(dados.conversaId, usuario)
    : await assistenteRepository.criarConversa(usuario?.id ?? null);
  yield { tipo: 'conversa', conversaId: conversa.id };

  const anteriores = await assistenteRepository.listarMensagens(conversa.id);
  const insatisfeito = demonstraInsatisfacao(dados.pergunta);
  await assistenteRepository.adicionarMensagem({
    conversaId: conversa.id,
    papel: 'USUARIO',
    conteudo: dados.pergunta,
    insatisfacao: insatisfeito,
  });

  const chamado = await chamadosRepository.buscarPorConversa(conversa.id);
  const pediuAtendimento = pedeAtendimento(dados.pergunta);
  const reclamacoes = anteriores.filter((mensagem) => mensagem.insatisfacao).length + (insatisfeito ? 1 : 0);

  if (chamado && (pediuAtendimento || insatisfeito)) {
    yield* responderSemModelo(
      conversa.id,
      `O seu chamado nº ${chamado.numero} já está com a equipe técnica da FERSA, com esta conversa anexada. ` +
        'Eles vão entrar em contato. Enquanto isso, posso tentar ajudar com outra dúvida.',
      'NENHUM',
      chamado,
    );
    return;
  }

  if (!chamado && (pediuAtendimento || reclamacoes >= RECLAMACOES_PARA_ABRIR_CHAMADO)) {
    if (!usuario) {
      yield* responderSemModelo(
        conversa.id,
        'Vou abrir um chamado com a equipe técnica da FERSA, com esta conversa anexada. ' +
          'Para eles falarem com você, deixe seu nome e um e-mail ou telefone no formulário abaixo.',
        'PEDIR_CONTATO',
      );
      return;
    }
    const novo = await abrirChamadoDaConversa(conversa.id, await contatoDaConta(usuario));
    yield* responderSemModelo(conversa.id, textoDeChamadoAberto(novo), 'CHAMADO_ABERTO', novo);
    return;
  }

  try {
    const consulta = textoParaBusca(dados.pergunta, anteriores);
    const [vetor] = await gerarEmbeddings([consulta]);
    const trechos = (await trechosRepository.buscarParecidos(vetor!, usuario, TRECHOS_BUSCADOS)).filter(
      (trecho) => trecho.distancia <= DISTANCIA_MAXIMA,
    );
    const produtos = await produtosRepository.buscarAtivosPorCodigos(codigosCitados(consulta));
    const fontes = [...produtos.map(fonteDaPeca), ...fontesDosTrechos(trechos)];

    let resposta = '';
    const mensagens = montarMensagens({ pergunta: dados.pergunta, historico: anteriores, fontes });
    for await (const pedaco of conversar(mensagens, sinal)) {
      resposta += pedaco;
      yield { tipo: 'texto', texto: pedaco };
    }

    const citadas = fontesCitadas(resposta, fontes);
    const salva = await assistenteRepository.adicionarMensagem({
      conversaId: conversa.id,
      papel: 'ASSISTENTE',
      conteudo: resposta.trim(),
      fontes: citadas,
    });
    yield {
      tipo: 'fim',
      mensagemId: salva.id,
      fontes: citadas,
      // Primeira reclamação: responde de novo e já oferece o chamado.
      encaminhamento: insatisfeito ? 'SUGERIR_CHAMADO' : 'NENHUM',
      chamado: null,
    };
  } catch (erro) {
    if (!(erro instanceof IaIndisponivel)) throw erro;
    log.warn({ motivo: erro.message }, 'Assistente sem IA: respondendo com o encaminhamento ao suporte');
    yield* responderSemModelo(conversa.id, MENSAGEM_FORA_DO_AR, 'SUGERIR_CHAMADO');
  }
}

export async function abrirChamadoPeloChat(dados: DadosAbrirChamado, usuario: UsuarioAutenticado | undefined) {
  const conversa = await conversaAcessivel(dados.conversaId, usuario);

  let contato;
  if (usuario) {
    contato = await contatoDaConta(usuario);
  } else {
    const detalhes = [];
    if (!dados.nome) detalhes.push({ campo: 'nome', mensagem: 'Informe seu nome.' });
    if (!dados.email && !dados.telefone) {
      detalhes.push({ campo: 'email', mensagem: 'Informe um e-mail ou um telefone para a equipe falar com você.' });
    }
    if (detalhes.length > 0) throw requisicaoInvalida(detalhes[0]!.mensagem, detalhes);
    contato = { usuarioId: null, nome: dados.nome!, email: dados.email, telefone: dados.telefone };
  }

  const jaExistia = await chamadosRepository.buscarPorConversa(conversa.id);
  const chamado = await abrirChamadoDaConversa(conversa.id, contato);
  if (!jaExistia) {
    await assistenteRepository.adicionarMensagem({
      conversaId: conversa.id,
      papel: 'ASSISTENTE',
      conteudo: textoDeChamadoAberto(chamado),
    });
  }
  return { numero: chamado.numero, mensagem: textoDeChamadoAberto(chamado) };
}

async function* responderSemModelo(
  conversaId: string,
  texto: string,
  encaminhamento: Encaminhamento,
  chamado?: Chamado,
): AsyncGenerator<EventoDoAssistente> {
  const salva = await assistenteRepository.adicionarMensagem({ conversaId, papel: 'ASSISTENTE', conteudo: texto });
  yield { tipo: 'texto', texto };
  yield {
    tipo: 'fim',
    mensagemId: salva.id,
    fontes: [],
    encaminhamento,
    chamado: chamado ? { numero: chamado.numero } : null,
  };
}

function textoDeChamadoAberto(chamado: Chamado): string {
  const contato = [chamado.email, chamado.telefone].filter(Boolean).join(' ou ');
  return (
    `Abri o chamado nº ${chamado.numero} com a equipe técnica da FERSA, com esta conversa anexada. ` +
    `Eles vão entrar em contato${contato ? ` pelo ${contato}` : ''}.`
  );
}

async function contatoDaConta(usuario: UsuarioAutenticado) {
  const conta = await usuariosRepository.buscarPorId(usuario.id);
  return { usuarioId: usuario.id, nome: usuario.nome, email: usuario.email, telefone: conta?.telefone ?? null };
}

/** Perguntas curtas de continuação ("e o torque?") levam junto a anterior, senão a busca perde a peça. */
export function textoParaBusca(pergunta: string, anteriores: Pick<AssistenteMensagem, 'papel' | 'conteudo'>[]): string {
  const ultimaPergunta = anteriores.filter((mensagem) => mensagem.papel === 'USUARIO').at(-1)?.conteudo;
  return pergunta.length < 60 && ultimaPergunta ? `${ultimaPergunta}\n${pergunta}` : pergunta;
}

function fontesDosTrechos(
  trechos: Awaited<ReturnType<typeof trechosRepository.buscarParecidos>>,
): FonteDoContexto[] {
  const porDocumento = new Map<string, FonteDoContexto>();
  for (const trecho of trechos) {
    const existente = porDocumento.get(trecho.documentoId);
    if (existente) {
      if (existente.conteudos.length < TRECHOS_POR_DOCUMENTO) existente.conteudos.push(trecho.conteudo);
      continue;
    }
    if (porDocumento.size >= DOCUMENTOS_NO_CONTEXTO) continue;
    porDocumento.set(trecho.documentoId, {
      fonte: { tipo: 'DOCUMENTO', id: trecho.documentoId, titulo: trecho.titulo },
      descricao: `Documento "${trecho.titulo}" (${ROTULOS_DOS_TIPOS[trecho.tipo]})`,
      conteudos: [trecho.conteudo],
    });
  }
  return [...porDocumento.values()];
}

const numeroBr = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 });

function fonteDaPeca(produto: LinhaProduto): FonteDoContexto {
  const medida = (rotulo: string, valor: number | null, unidade: string) =>
    valor === null ? null : `${rotulo}: ${numeroBr.format(valor)} ${unidade}`;
  const ficha = [
    `Código: ${produto.codigo}`,
    `Nome: ${produto.nome}`,
    produto.categoria ? `Categoria: ${produto.categoria.nome}` : null,
    medida('Diâmetro interno', produto.diametroInternoMm, 'mm'),
    medida('Diâmetro externo', produto.diametroExternoMm, 'mm'),
    medida('Largura', produto.larguraMm, 'mm'),
    medida('Peso', produto.pesoKg, 'kg'),
    produto.aplicacoes ? `Aplicações: ${produto.aplicacoes}` : null,
    produto.descricao ? `Descrição: ${produto.descricao}` : null,
  ].filter(Boolean);
  return {
    fonte: { tipo: 'PRODUTO', id: produto.id, titulo: `Peça ${produto.codigo}` },
    descricao: `Peça ${produto.codigo} do catálogo FERSA`,
    conteudos: [ficha.join('\n')],
  };
}
