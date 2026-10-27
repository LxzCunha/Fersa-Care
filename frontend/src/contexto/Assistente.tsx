import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { abrirChamado, obterConversa, perguntarAoAssistente, type ContatoDoChamado } from '../api/assistente';
import { ErroApi } from '../api/cliente';
import type { Encaminhamento, FonteDaResposta } from '../api/tipos';
import { mensagemDeErro } from '../componentes/Estados';

/**
 * Estado da conversa com o assistente técnico. Fica no Layout do portal, então
 * a conversa continua enquanto a pessoa navega; o id dela fica guardado na
 * aba do navegador (sessionStorage) para sobreviver a um recarregar de página.
 */

export interface MensagemNoChat {
  id: string;
  papel: 'USUARIO' | 'ASSISTENTE';
  conteudo: string;
  fontes: FonteDaResposta[];
  /** A resposta ainda está chegando. */
  emAndamento?: boolean;
  /** A resposta falhou (o conteúdo é a mensagem de erro). */
  falhou?: boolean;
}

interface ValorAssistente {
  aberto: boolean;
  /** Abre o chat; `rascunho` já deixa um começo de pergunta no campo. */
  abrir: (opcoes?: { rascunho?: string }) => void;
  fechar: () => void;
  mensagens: MensagemNoChat[];
  carregando: boolean;
  respondendo: boolean;
  encaminhamento: Encaminhamento;
  chamado: { numero: number } | null;
  rascunho: string;
  setRascunho: (texto: string) => void;
  enviar: (pergunta: string) => Promise<void>;
  /** Abre o chamado de suporte (visitante informa o contato). Erros de campo vêm como ErroApi. */
  pedirChamado: (contato?: ContatoDoChamado) => Promise<void>;
  novaConversa: () => void;
}

const ContextoAssistente = createContext<ValorAssistente | null>(null);

export const CHAVE_CONVERSA = 'fersa-care:assistente-conversa';

function lerConversaGuardada(): string | null {
  try {
    return sessionStorage.getItem(CHAVE_CONVERSA);
  } catch {
    return null;
  }
}

function guardarConversa(id: string | null) {
  try {
    if (id) sessionStorage.setItem(CHAVE_CONVERSA, id);
    else sessionStorage.removeItem(CHAVE_CONVERSA);
  } catch {
    // Sem armazenamento: a conversa só não sobrevive a um recarregar de página.
  }
}

let proximoIdLocal = 0;
const idLocal = () => `local-${++proximoIdLocal}`;

export function ProvedorAssistente({ children }: { children: ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const [mensagens, setMensagens] = useState<MensagemNoChat[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [respondendo, setRespondendo] = useState(false);
  const [encaminhamento, setEncaminhamento] = useState<Encaminhamento>('NENHUM');
  const [chamado, setChamado] = useState<{ numero: number } | null>(null);
  const [rascunho, setRascunho] = useState('');
  const conversaId = useRef<string | null>(lerConversaGuardada());
  const restaurada = useRef(false);
  const emAndamento = useRef<AbortController | null>(null);

  /** Na primeira abertura, traz de volta a conversa guardada (se ainda existir). */
  const restaurar = useCallback(async () => {
    if (restaurada.current || !conversaId.current) return;
    restaurada.current = true;
    setCarregando(true);
    try {
      const conversa = await obterConversa(conversaId.current);
      setMensagens(
        conversa.mensagens.map((mensagem) => ({
          id: mensagem.id,
          papel: mensagem.papel,
          conteudo: mensagem.conteudo,
          fontes: mensagem.fontes,
        })),
      );
      setChamado(conversa.chamado);
    } catch {
      conversaId.current = null;
      guardarConversa(null);
    } finally {
      setCarregando(false);
    }
  }, []);

  const abrir = useCallback(
    (opcoes: { rascunho?: string } = {}) => {
      setAberto(true);
      if (opcoes.rascunho) setRascunho(opcoes.rascunho);
      void restaurar();
    },
    [restaurar],
  );

  const fechar = useCallback(() => setAberto(false), []);

  const atualizarResposta = (id: string, mudar: (mensagem: MensagemNoChat) => MensagemNoChat) =>
    setMensagens((atuais) => atuais.map((mensagem) => (mensagem.id === id ? mudar(mensagem) : mensagem)));

  const enviar = useCallback(async (pergunta: string) => {
    const texto = pergunta.trim();
    if (!texto) return;
    const idResposta = idLocal();
    setMensagens((atuais) => [
      ...atuais,
      { id: idLocal(), papel: 'USUARIO', conteudo: texto, fontes: [] },
      { id: idResposta, papel: 'ASSISTENTE', conteudo: '', fontes: [], emAndamento: true },
    ]);
    setRascunho('');
    setRespondendo(true);
    setEncaminhamento('NENHUM');

    const controlador = new AbortController();
    emAndamento.current = controlador;
    try {
      await perguntarAoAssistente(
        { pergunta: texto, conversaId: conversaId.current ?? undefined },
        (evento) => {
          if (evento.tipo === 'conversa') {
            conversaId.current = evento.conversaId;
            restaurada.current = true;
            guardarConversa(evento.conversaId);
          } else if (evento.tipo === 'texto') {
            atualizarResposta(idResposta, (mensagem) => ({ ...mensagem, conteudo: mensagem.conteudo + evento.texto }));
          } else if (evento.tipo === 'fim') {
            atualizarResposta(idResposta, (mensagem) => ({ ...mensagem, fontes: evento.fontes, emAndamento: false }));
            setEncaminhamento(evento.encaminhamento);
            if (evento.chamado) setChamado(evento.chamado);
          } else if (evento.tipo === 'erro') {
            atualizarResposta(idResposta, (mensagem) => ({ ...mensagem, conteudo: evento.mensagem, falhou: true }));
          }
        },
        controlador.signal,
      );
    } catch (erro) {
      if (controlador.signal.aborted) return;
      // A conversa guardada não existe mais (ex.: saiu da conta): a próxima pergunta começa outra.
      if (erro instanceof ErroApi && erro.status === 404) {
        conversaId.current = null;
        guardarConversa(null);
      }
      atualizarResposta(idResposta, (mensagem) => ({ ...mensagem, conteudo: mensagemDeErro(erro), falhou: true }));
    } finally {
      atualizarResposta(idResposta, (mensagem) => ({ ...mensagem, emAndamento: false }));
      if (emAndamento.current === controlador) {
        emAndamento.current = null;
        setRespondendo(false);
      }
    }
  }, []);

  const pedirChamado = useCallback(async (contato: ContatoDoChamado = {}) => {
    if (!conversaId.current) return;
    const resultado = await abrirChamado(conversaId.current, contato);
    setChamado({ numero: resultado.numero });
    setEncaminhamento('CHAMADO_ABERTO');
    setMensagens((atuais) => [...atuais, { id: idLocal(), papel: 'ASSISTENTE', conteudo: resultado.mensagem, fontes: [] }]);
  }, []);

  const novaConversa = useCallback(() => {
    emAndamento.current?.abort();
    emAndamento.current = null;
    conversaId.current = null;
    guardarConversa(null);
    setMensagens([]);
    setRespondendo(false);
    setEncaminhamento('NENHUM');
    setChamado(null);
  }, []);

  const valor = useMemo<ValorAssistente>(
    () => ({
      aberto,
      abrir,
      fechar,
      mensagens,
      carregando,
      respondendo,
      encaminhamento,
      chamado,
      rascunho,
      setRascunho,
      enviar,
      pedirChamado,
      novaConversa,
    }),
    [aberto, abrir, fechar, mensagens, carregando, respondendo, encaminhamento, chamado, rascunho, enviar, pedirChamado, novaConversa],
  );

  return <ContextoAssistente value={valor}>{children}</ContextoAssistente>;
}

export function useAssistente(): ValorAssistente {
  const contexto = useContext(ContextoAssistente);
  if (!contexto) throw new Error('useAssistente precisa estar dentro de <ProvedorAssistente>.');
  return contexto;
}
