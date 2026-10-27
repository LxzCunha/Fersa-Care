import { paraUsuarioDto } from '../dtos/usuarios.dto.js';
import * as documentosRepository from '../repositories/documentos.repository.js';
import * as produtosRepository from '../repositories/produtos.repository.js';
import * as usuariosRepository from '../repositories/usuarios.repository.js';
import * as visualizacoesRepository from '../repositories/visualizacoes.repository.js';

/** Números do painel do administrador. */

const FUSO = 'America/Sao_Paulo';
const DIAS_NO_GRAFICO = 14;

export async function obterPainel() {
  const trintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const resumoDocumentos = await documentosRepository.resumoParaPainel();
  const resumoUsuarios = await usuariosRepository.resumoParaPainel();
  const resumoProdutos = await produtosRepository.resumoParaPainel();
  const resumoVisualizacoes = await visualizacoesRepository.resumoDesde(trintaDiasAtras);
  const maisAcessados = await visualizacoesRepository.maisAcessadosDesde(trintaDiasAtras, 5);
  const solicitacoesPendentes = await usuariosRepository.listarPendentes(5);

  return {
    documentos: resumoDocumentos,
    usuarios: resumoUsuarios,
    produtos: resumoProdutos,
    visualizacoes30Dias: resumoVisualizacoes,
    visualizacoesPorDia: await visualizacoesPorDia(),
    maisAcessados,
    solicitacoesPendentes: solicitacoesPendentes.map(paraUsuarioDto),
  };
}

/** Aberturas de documentos por dia nos últimos 14 dias (dias sem acesso aparecem com 0). */
async function visualizacoesPorDia() {
  const linhas = await visualizacoesRepository.contarPorDia(DIAS_NO_GRAFICO, FUSO);
  const porDia = new Map(linhas.map((linha) => [linha.dia, linha.total]));

  const formatador = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }); // en-CA → AAAA-MM-DD
  const dias: { dia: string; total: number }[] = [];
  for (let i = DIAS_NO_GRAFICO - 1; i >= 0; i--) {
    const dia = formatador.format(new Date(Date.now() - i * 24 * 60 * 60 * 1000));
    dias.push({ dia, total: porDia.get(dia) ?? 0 });
  }
  return dias;
}
