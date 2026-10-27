import { CircleCheck, FileText, MessageCircle, Package, RotateCcw, Send, X } from 'lucide-react';
import { Fragment, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ErroApi } from '../api/cliente';
import type { FonteDaResposta } from '../api/tipos';
import { useAssistente, type MensagemNoChat } from '../contexto/Assistente';
import { useAutenticacao } from '../contexto/Autenticacao';
import { mensagemDeErro } from './Estados';
import './Assistente.css';

/** Perguntas de exemplo para quem abre o chat pela primeira vez. */
export const SUGESTOES = [
  'Como medir a folga axial do cubo de roda?',
  'Qual o torque de aperto da porca do cubo?',
  'Meu rolamento está fazendo ruído. O que pode ser?',
];

/**
 * Assistente técnico: a bolinha no canto inferior direito e o painel de
 * conversa. Responde só sobre peças e produtos FERSA, citando os materiais do
 * portal; quando não resolve, abre um chamado com a equipe técnica.
 */
export function Assistente() {
  const { aberto, abrir, fechar } = useAssistente();
  const bolinha = useRef<HTMLButtonElement>(null);
  const estavaAberto = useRef(aberto);

  // Ao fechar, o foco volta para a bolinha.
  useEffect(() => {
    if (estavaAberto.current && !aberto) bolinha.current?.focus();
    estavaAberto.current = aberto;
  }, [aberto]);

  return (
    <>
      {!aberto && (
        <button
          ref={bolinha}
          type="button"
          className="assistente-bolinha"
          onClick={() => abrir()}
          aria-label="Abrir o assistente técnico"
          title="Assistente técnico"
        >
          <MessageCircle aria-hidden />
        </button>
      )}
      {aberto && <PainelDoAssistente aoFechar={fechar} />}
    </>
  );
}

function PainelDoAssistente({ aoFechar }: { aoFechar: () => void }) {
  const { mensagens, carregando, respondendo, encaminhamento, chamado, rascunho, setRascunho, enviar, novaConversa } =
    useAssistente();
  const idTitulo = useId();
  const campo = useRef<HTMLTextAreaElement>(null);
  const lista = useRef<HTMLDivElement>(null);

  useEffect(() => {
    campo.current?.focus();
  }, []);

  // Acompanha a resposta enquanto ela chega.
  useEffect(() => {
    lista.current?.scrollTo({ top: lista.current.scrollHeight });
  }, [mensagens, encaminhamento]);

  function aoEnviar(evento?: FormEvent) {
    evento?.preventDefault();
    if (!respondendo) void enviar(rascunho);
  }

  const mostrarPedidoDeChamado = !chamado && (encaminhamento === 'SUGERIR_CHAMADO' || encaminhamento === 'PEDIR_CONTATO');

  return (
    <section
      className="assistente-painel"
      role="dialog"
      aria-labelledby={idTitulo}
      onKeyDown={(evento) => {
        if (evento.key === 'Escape') aoFechar();
      }}
    >
      <header className="assistente-topo">
        <span className="assistente-avatar" aria-hidden>
          <MessageCircle />
        </span>
        <div className="assistente-topo-texto">
          <h2 id={idTitulo}>Assistente técnico</h2>
          <p>Responde com base nos materiais FERSA</p>
        </div>
        {mensagens.length > 0 && (
          <button type="button" className="assistente-topo-botao" onClick={novaConversa} aria-label="Nova conversa" title="Nova conversa">
            <RotateCcw aria-hidden />
          </button>
        )}
        <button type="button" className="assistente-topo-botao" onClick={aoFechar} aria-label="Fechar o assistente" title="Fechar">
          <X aria-hidden />
        </button>
      </header>

      <div className="assistente-mensagens" ref={lista} role="log" aria-live="polite" aria-busy={respondendo}>
        {carregando && <p className="assistente-aviso">Carregando a conversa...</p>}

        {!carregando && mensagens.length === 0 && (
          <div className="assistente-boas-vindas">
            <p>
              Olá! Pergunte sobre montagem, folga, torque, ruídos ou o código de uma peça. Eu procuro a resposta nos
              manuais, fichas e boletins da FERSA.
            </p>
            <ul aria-label="Sugestões de perguntas">
              {SUGESTOES.map((sugestao) => (
                <li key={sugestao}>
                  <button type="button" onClick={() => void enviar(sugestao)}>
                    {sugestao}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {mensagens.map((mensagem) => (
          <Mensagem key={mensagem.id} mensagem={mensagem} />
        ))}

        {mostrarPedidoDeChamado && <PedidoDeChamado pedirContato={encaminhamento === 'PEDIR_CONTATO'} />}
        {chamado && (
          <p className="assistente-chamado">
            <CircleCheck aria-hidden />
            Chamado nº {chamado.numero} aberto. A equipe técnica vai entrar em contato.
          </p>
        )}
      </div>

      <form className="assistente-formulario" onSubmit={aoEnviar}>
        <label className="visualmente-oculto" htmlFor={`${idTitulo}-pergunta`}>
          Sua pergunta
        </label>
        <textarea
          id={`${idTitulo}-pergunta`}
          ref={campo}
          rows={1}
          maxLength={1000}
          placeholder="Escreva sua dúvida..."
          value={rascunho}
          onChange={(evento) => setRascunho(evento.target.value)}
          onKeyDown={(evento) => {
            // Enter envia; Shift+Enter quebra a linha.
            if (evento.key === 'Enter' && !evento.shiftKey) {
              evento.preventDefault();
              aoEnviar();
            }
          }}
        />
        <button type="submit" className="assistente-enviar" disabled={respondendo || !rascunho.trim()} aria-label="Enviar pergunta">
          <Send aria-hidden />
        </button>
      </form>
      <p className="assistente-rodape">Respostas geradas por IA. Confira medidas e torques no documento citado.</p>
    </section>
  );
}

function Mensagem({ mensagem }: { mensagem: MensagemNoChat }) {
  if (mensagem.papel === 'USUARIO') {
    return <p className="assistente-mensagem assistente-mensagem-usuario">{mensagem.conteudo}</p>;
  }
  return (
    <div className={`assistente-mensagem assistente-mensagem-resposta ${mensagem.falhou ? 'falhou' : ''}`}>
      {mensagem.conteudo ? (
        <TextoFormatado texto={mensagem.conteudo} />
      ) : (
        mensagem.emAndamento && (
          <p className="assistente-digitando">
            <span className="visualmente-oculto">Procurando nos materiais...</span>
            <span aria-hidden />
            <span aria-hidden />
            <span aria-hidden />
          </p>
        )
      )}
      {mensagem.fontes.length > 0 && <Fontes fontes={mensagem.fontes} />}
    </div>
  );
}

function Fontes({ fontes }: { fontes: FonteDaResposta[] }) {
  return (
    <ul className="assistente-fontes" aria-label="Fontes">
      {fontes.map((fonte) => (
        <li key={`${fonte.tipo}-${fonte.id}`}>
          <Link to={fonte.tipo === 'PRODUTO' ? `/produtos/${fonte.id}` : `/documentos/${fonte.id}`}>
            <span className="assistente-fonte-numero">{fonte.numero}</span>
            {fonte.tipo === 'PRODUTO' ? <Package aria-hidden /> : <FileText aria-hidden />}
            {fonte.titulo}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * O texto do modelo com o mínimo de formatação: parágrafos, listas
 * (1. / - ), **negrito** e as citações [1] em destaque. Nada de HTML vindo do
 * modelo é interpretado.
 */
export function TextoFormatado({ texto }: { texto: string }) {
  const marcadorDeLista = /^\s*(\d+[.)]|[-•*])\s+/;
  const blocos: ReactNode[] = [];
  let itens: string[] = [];
  let ordenada = false;

  const fecharLista = () => {
    if (itens.length === 0) return;
    const Lista = ordenada ? 'ol' : 'ul';
    blocos.push(
      <Lista key={blocos.length}>
        {itens.map((item, indice) => (
          <li key={indice}>{formatarLinha(item)}</li>
        ))}
      </Lista>,
    );
    itens = [];
  };

  for (const paragrafo of texto.trim().split(/\n{2,}/)) {
    const linhas: string[] = [];
    for (const linha of paragrafo.split('\n')) {
      const marcador = linha.match(marcadorDeLista);
      if (marcador) {
        if (linhas.length > 0) blocos.push(<p key={blocos.length}>{juntarLinhas(linhas.splice(0))}</p>);
        if (itens.length === 0) ordenada = /\d/.test(marcador[1]!);
        itens.push(linha.replace(marcadorDeLista, ''));
      } else {
        fecharLista();
        linhas.push(linha);
      }
    }
    if (linhas.length > 0) blocos.push(<p key={blocos.length}>{juntarLinhas(linhas)}</p>);
  }
  fecharLista();
  return <>{blocos}</>;
}

function juntarLinhas(linhas: string[]): ReactNode {
  return linhas.map((linha, indice) => (
    <Fragment key={indice}>
      {indice > 0 && <br />}
      {formatarLinha(linha)}
    </Fragment>
  ));
}

function formatarLinha(linha: string): ReactNode[] {
  return linha.split(/(\*\*[^*]+\*\*|\[\d{1,2}\])/g).map((parte, indice) => {
    if (/^\*\*[^*]+\*\*$/.test(parte)) return <strong key={indice}>{parte.slice(2, -2)}</strong>;
    if (/^\[\d{1,2}\]$/.test(parte)) {
      return (
        <sup key={indice} className="assistente-citacao">
          {parte.slice(1, -1)}
        </sup>
      );
    }
    return parte;
  });
}

/**
 * Quando o assistente não resolve: com login, um botão abre o chamado com os
 * dados da conta; visitante deixa nome e e-mail ou telefone.
 */
function PedidoDeChamado({ pedirContato }: { pedirContato: boolean }) {
  const { pedirChamado } = useAssistente();
  const { usuario } = useAutenticacao();
  const id = useId();
  const [mostrarFormulario, setMostrarFormulario] = useState(pedirContato && !usuario);
  const [contato, setContato] = useState({ nome: '', email: '', telefone: '' });
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function abrirChamado(evento?: FormEvent) {
    evento?.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await pedirChamado(usuario ? {} : contato);
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha : new ErroApi(0, 'ERRO', mensagemDeErro(falha)));
    } finally {
      setEnviando(false);
    }
  }

  if (!mostrarFormulario) {
    return (
      <div className="assistente-pedido">
        <p>A resposta não resolveu? A equipe técnica da FERSA continua daqui, com esta conversa anexada.</p>
        <button
          type="button"
          className="botao botao-principal"
          disabled={enviando}
          onClick={() => (usuario ? void abrirChamado() : setMostrarFormulario(true))}
        >
          {enviando ? 'Abrindo...' : 'Abrir chamado com a equipe técnica'}
        </button>
        {erro && <p className="campo-erro">{erro.message}</p>}
      </div>
    );
  }

  const erroDe = (campo: string) => erro?.erroDoCampo(campo);
  return (
    <form className="assistente-pedido" onSubmit={abrirChamado} noValidate aria-label="Contato para o chamado">
      <p>Para a equipe técnica falar com você:</p>
      {(['nome', 'email', 'telefone'] as const).map((nomeDoCampo) => (
        <div className="campo" key={nomeDoCampo}>
          <label className="campo-rotulo" htmlFor={`${id}-${nomeDoCampo}`}>
            {{ nome: 'Nome', email: 'E-mail', telefone: 'Telefone ou WhatsApp' }[nomeDoCampo]}
          </label>
          <input
            id={`${id}-${nomeDoCampo}`}
            className="entrada"
            type={nomeDoCampo === 'email' ? 'email' : nomeDoCampo === 'telefone' ? 'tel' : 'text'}
            value={contato[nomeDoCampo]}
            onChange={(evento) => setContato((atual) => ({ ...atual, [nomeDoCampo]: evento.target.value }))}
            aria-invalid={Boolean(erroDe(nomeDoCampo))}
          />
          {erroDe(nomeDoCampo) && <span className="campo-erro">{erroDe(nomeDoCampo)}</span>}
        </div>
      ))}
      {erro && erro.detalhes.length === 0 && <p className="campo-erro">{erro.message}</p>}
      <button type="submit" className="botao botao-principal" disabled={enviando}>
        {enviando ? 'Abrindo...' : 'Abrir chamado'}
      </button>
    </form>
  );
}
