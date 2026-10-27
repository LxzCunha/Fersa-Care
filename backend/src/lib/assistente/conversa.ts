import { somenteLetrasENumeros } from '../validacao.js';

// Regras fora do modelo de IA, para serem previsíveis.

export const RECLAMACOES_PARA_ABRIR_CHAMADO = 2;

function simplificar(texto: string): string {
  return ` ${texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ')} `;
}

const SINAIS_DE_INSATISFACAO = [
  /\b(nao|n|nada) (me )?(ajud|resolv|serv|adiant|funcion|respond|esclarec)/,
  /\bnao (esta|ta|tá) (me )?(ajudando|resolvendo|funcionando|entendendo)/,
  /\bnao (entendeu|entende|e isso|era isso|foi isso|e o que eu perguntei)/,
  /\b(continua|continuo|ainda|segue) (com|sem) (o |a )?(problema|duvida|defeito|ruido|resposta)/,
  /\b(resposta|assistente|ia|robo|bot|chat)\b.{0,20}\b(inutil|ruim|errad|pessim|horrivel|nao serve)/,
  /\b(inutil|pessimo|pessima|horrivel|que droga)\b/,
  /\b(isso|essa resposta|voce|vc) (ta |esta )?errad/,
  /\bnao (consegui|consigo) (resolver|entender)/,
];

const PEDIDOS_DE_ATENDIMENTO = [
  /\b(falar|conversar|atendimento|contato|ligar) (com |para )?(um |uma |o |a )?(humano|atendente|pessoa|tecnico|especialista|suporte|engenheiro|alguem)/,
  /\b(abrir|abre|abra|quero|criar|crie|registrar|registre|preciso de) (um |uma )?(chamado|ticket|protocolo|atendimento)/,
  /\b(chamado|ticket) (de suporte|tecnico|para o suporte)/,
];

export function demonstraInsatisfacao(texto: string): boolean {
  const simples = simplificar(texto);
  return SINAIS_DE_INSATISFACAO.some((sinal) => sinal.test(simples));
}

export function pedeAtendimento(texto: string): boolean {
  const simples = simplificar(texto);
  return PEDIDOS_DE_ATENDIMENTO.some((pedido) => pedido.test(simples));
}

/** Junta também palavras vizinhas, porque códigos costumam ter espaço ("32008 X", "FXC 2041"). */
export function codigosCitados(texto: string): string[] {
  const palavras = texto.split(/[\s,;()]+/).map((palavra) => somenteLetrasENumeros(palavra).toUpperCase()).filter(Boolean);
  const candidatos = new Set<string>();
  palavras.forEach((palavra, indice) => {
    const proxima = palavras[indice + 1];
    if (/\d/.test(palavra) && palavra.length >= 3) candidatos.add(palavra);
    if (proxima && (/\d/.test(palavra) || /\d/.test(proxima))) {
      const junto = palavra + proxima;
      if (junto.length >= 4 && junto.length <= 15) candidatos.add(junto);
    }
  });
  return [...candidatos].filter((codigo) => codigo.length <= 15).slice(0, 12);
}
