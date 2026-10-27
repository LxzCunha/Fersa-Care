import { useQuery } from '@tanstack/react-query';
import { FileUp, Link2 } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import {
  atualizarDocumento,
  criarDocumento,
  detalharDocumentoAdmin,
  excluirDocumento,
  reindexarDocumento,
  type DadosDocumento,
} from '../../api/admin';
import { ErroApi, mensagemDeErro } from '../../api/cliente';
import type {
  DocumentoAdmin,
  Idioma,
  ProdutoResumo,
  TipoDocumento,
  UsuarioComAcesso,
  Visibilidade,
} from '../../api/tipos';
import { Campo, CampoTexto } from '../../componentes/Campo';
import { DialogoConfirmacao } from '../../componentes/DialogoConfirmacao';
import { AvisoErro, Carregando } from '../../componentes/Estados';
import { LIMITE_UPLOAD_MB } from '../../config';
import { useNotificar } from '../../contexto/Notificacoes';
import { data, dataHora, plural } from '../../lib/formatar';
import { IDIOMAS, ORDEM_DOS_TIPOS, TIPOS, VISIBILIDADES } from '../../lib/rotulos';
import { useRecarregarTudo } from './acoes';
import { CampoArquivo } from './CampoArquivo';
import { CampoImagem } from './CampoImagem';
import { Janela } from './Cadastro';
import { rolarJanelaParaTopo, useVoltarParaLista } from './navegacao';
import { SeletorProdutos, SeletorUsuarios } from './Seletores';

export function FormDocumento() {
  const { id } = useParams();
  const fechar = useVoltarParaLista('/admin/documentos');
  const consulta = useQuery({
    queryKey: ['admin', 'documento', id],
    queryFn: () => detalharDocumentoAdmin(id!),
    enabled: Boolean(id),
  });

  if (id && !consulta.data) {
    return (
      <Janela titulo="Documento" aoFechar={fechar}>
        {consulta.isError ? <AvisoErro erro={consulta.error} /> : <Carregando />}
      </Janela>
    );
  }
  return <FormularioDocumento key={id ?? 'novo'} documento={consulta.data} aoFechar={fechar} />;
}

function tituloPeloNomeDoArquivo(nome: string): string {
  const semExtensao = nome.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
  return semExtensao.charAt(0).toUpperCase() + semExtensao.slice(1);
}

function FormularioDocumento({ documento, aoFechar }: { documento?: DocumentoAdmin; aoFechar: () => void }) {
  const editando = Boolean(documento);
  const idFormulario = useId();
  const notificar = useNotificar();
  const recarregar = useRecarregarTudo();

  const [titulo, setTitulo] = useState(documento?.titulo ?? '');
  const [descricao, setDescricao] = useState(documento?.descricao ?? '');
  const [tipo, setTipo] = useState<TipoDocumento>(documento?.tipo ?? 'MANUAL');
  const [idioma, setIdioma] = useState<Idioma>(documento?.idioma ?? 'pt-BR');
  const [visibilidade, setVisibilidade] = useState<Visibilidade>(documento?.visibilidade ?? 'AUTENTICADO');
  const [publicado, setPublicado] = useState(documento?.publicado ?? true);
  const [origem, setOrigem] = useState<'ARQUIVO' | 'LINK'>(documento?.origem ?? 'ARQUIVO');
  const [urlExterna, setUrlExterna] = useState(documento?.urlExterna ?? '');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [capa, setCapa] = useState<File | null>(null);
  const [removerCapa, setRemoverCapa] = useState(false);
  const [produtos, setProdutos] = useState<ProdutoResumo[]>(documento?.produtos ?? []);
  const [usuarios, setUsuarios] = useState<UsuarioComAcesso[]>(documento?.usuariosComAcesso ?? []);

  const [alterado, setAlterado] = useState(false);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [progresso, setProgresso] = useState<number | null>(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const erroDe = (campo: string) => erro?.erroDoCampo(campo);

  function escolherArquivo(escolhido: File | null) {
    setErro(null);
    if (escolhido && escolhido.size > LIMITE_UPLOAD_MB * 1024 * 1024) {
      setErro(
        new ErroApi(413, 'ARQUIVO_MUITO_GRANDE', `O arquivo passa do limite de ${LIMITE_UPLOAD_MB} MB.`, [
          { campo: 'arquivo', mensagem: `O arquivo passa do limite de ${LIMITE_UPLOAD_MB} MB.` },
        ]),
      );
      return;
    }
    setArquivo(escolhido);
    if (escolhido && !titulo.trim()) setTitulo(tituloPeloNomeDoArquivo(escolhido.name));
    if (escolhido && !editando && escolhido.type.startsWith('video/')) setTipo('VIDEO');
  }

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);

    if (origem === 'ARQUIVO' && !arquivo && !documento?.arquivo) {
      setErro(
        new ErroApi(400, 'DADOS_INVALIDOS', 'Selecione o arquivo do documento.', [
          { campo: 'arquivo', mensagem: 'Selecione o arquivo do documento.' },
        ]),
      );
      return;
    }

    const dados: DadosDocumento = {
      titulo,
      descricao,
      tipo,
      idioma,
      visibilidade,
      publicado,
      origem,
      urlExterna: origem === 'LINK' ? urlExterna.trim() : null,
      produtoIds: produtos.map((produto) => produto.id),
      usuarioIds: visibilidade === 'RESTRITO' ? usuarios.map((pessoa) => pessoa.id) : [],
      removerCapa: removerCapa && !capa,
    };
    const arquivos = { arquivo: origem === 'ARQUIVO' ? arquivo : null, capa };

    setSalvando(true);
    setProgresso(arquivos.arquivo || arquivos.capa ? 0 : null);
    try {
      if (documento) {
        await atualizarDocumento(documento.id, dados, arquivos, setProgresso);
      } else {
        await criarDocumento(dados, arquivos, setProgresso);
      }
      await recarregar();
      notificar(editando ? 'Documento atualizado.' : 'Documento cadastrado.');
      aoFechar();
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha : new ErroApi(0, 'ERRO', mensagemDeErro(falha)));
      rolarJanelaParaTopo();
    } finally {
      setSalvando(false);
      setProgresso(null);
    }
  }

  async function excluir() {
    if (!documento) return;
    setExcluindo(true);
    try {
      await excluirDocumento(documento.id);
      await recarregar();
      notificar('Documento excluído.');
      aoFechar();
    } catch (falha) {
      notificar(mensagemDeErro(falha), 'erro');
      setExcluindo(false);
      setConfirmandoExclusao(false);
    }
  }

  const errosGerais = erro && erro.detalhes.length === 0;

  return (
    <Janela
      titulo={editando ? 'Documento' : 'Novo documento'}
      idFormulario={idFormulario}
      salvando={salvando}
      alterado={alterado}
      progresso={progresso}
      aoFechar={aoFechar}
      links={
        documento && (
          <>
            <span className="janela-nota">
              {documento.criadoPor ? `Cadastrado por ${documento.criadoPor.nome} em ` : 'Cadastrado em '}
              {data(documento.criadoEm)} · {plural(documento.totalVisualizacoes, 'abertura')}
            </span>
            {documento.publicado && <Link to={`/documentos/${documento.id}`}>Ver no portal</Link>}
            <button type="button" className="janela-link-perigo" onClick={() => setConfirmandoExclusao(true)}>
              Excluir documento
            </button>
          </>
        )
      }
    >
      <form id={idFormulario} className="cadastro" onSubmit={salvar} onChange={() => setAlterado(true)} noValidate>
        {errosGerais && <AvisoErro erro={erro} />}
        {erro && !errosGerais && <AvisoErro>Confira os campos destacados: {erro.message}</AvisoErro>}

        <CampoTexto
          id="titulo"
          rotulo="Título"
          value={titulo}
          onChange={(evento) => setTitulo(evento.target.value)}
          erro={erroDe('titulo')}
          ajuda="O título e a descrição entram na busca do portal."
          maxLength={200}
        />
        <Campo id="descricao" rotulo="Descrição" opcional erro={erroDe('descricao')}>
          {(atributos) => (
            <textarea
              className="area-texto"
              rows={3}
              placeholder="Em uma ou duas frases, o que o cliente encontra no material."
              value={descricao}
              onChange={(evento) => setDescricao(evento.target.value)}
              {...atributos}
            />
          )}
        </Campo>
        <div className="cadastro-linha">
          <Campo id="tipo" rotulo="Tipo" erro={erroDe('tipo')}>
            {(atributos) => (
              <select className="selecao" value={tipo} onChange={(e) => setTipo(e.target.value as TipoDocumento)} {...atributos}>
                {ORDEM_DOS_TIPOS.map((opcao) => (
                  <option key={opcao} value={opcao}>
                    {TIPOS[opcao].singular}
                  </option>
                ))}
              </select>
            )}
          </Campo>
          <Campo id="idioma" rotulo="Idioma" erro={erroDe('idioma')}>
            {(atributos) => (
              <select className="selecao" value={idioma} onChange={(e) => setIdioma(e.target.value as Idioma)} {...atributos}>
                {(Object.keys(IDIOMAS) as Idioma[]).map((opcao) => (
                  <option key={opcao} value={opcao}>
                    {IDIOMAS[opcao]}
                  </option>
                ))}
              </select>
            )}
          </Campo>
        </div>

        <section className="cadastro-secao" aria-labelledby={`${idFormulario}-conteudo`}>
          <h2 id={`${idFormulario}-conteudo`}>Conteúdo</h2>
          <div className="alternancia-origem" role="radiogroup" aria-label="Origem do conteúdo">
            <label>
              <input type="radio" name="origem" checked={origem === 'ARQUIVO'} onChange={() => setOrigem('ARQUIVO')} />
              <FileUp aria-hidden /> Enviar arquivo
            </label>
            <label>
              <input type="radio" name="origem" checked={origem === 'LINK'} onChange={() => setOrigem('LINK')} />
              <Link2 aria-hidden /> Usar um link
            </label>
          </div>

          {origem === 'ARQUIVO' ? (
            <CampoArquivo
              arquivo={arquivo}
              arquivoAtual={documento?.arquivo ?? null}
              aoEscolher={(escolhido) => {
                escolherArquivo(escolhido);
                setAlterado(true);
              }}
              erro={erroDe('arquivo')}
            />
          ) : (
            <CampoTexto
              id="url"
              rotulo="Link do conteúdo"
              type="url"
              inputMode="url"
              placeholder="https://"
              value={urlExterna}
              onChange={(evento) => setUrlExterna(evento.target.value)}
              erro={erroDe('urlExterna')}
              ajuda="Vídeos do YouTube e do Vimeo tocam dentro do portal; outros links abrem numa nova aba."
            />
          )}

          {documento?.capaUrl && !documento.capaPersonalizada && !capa && (
            <figure className="capa-automatica">
              <img src={documento.capaUrl} alt="" />
              <figcaption>Capa atual, gerada do arquivo. Para usar outra, escolha uma imagem abaixo.</figcaption>
            </figure>
          )}
          <CampoImagem
            objeto="capa"
            rotulo="Capa"
            dica="Opcional: sem ela, o portal usa a primeira página do PDF; vídeos e links mostram o ícone do tipo."
            urlAtual={documento?.capaPersonalizada ? documento.capaUrl : null}
            arquivo={capa}
            removerAtual={removerCapa}
            aoEscolher={(escolhida) => {
              setCapa(escolhida);
              setAlterado(true);
              if (escolhida) setRemoverCapa(false);
            }}
            aoRemoverAtual={(remover) => {
              setRemoverCapa(remover);
              setAlterado(true);
            }}
            erro={erroDe('capa')}
          />
          {documento?.indexacao && <SituacaoNoAssistente documento={documento} />}
        </section>

        <section className="cadastro-secao" aria-labelledby={`${idFormulario}-pecas`}>
          <h2 id={`${idFormulario}-pecas`}>Peças relacionadas</h2>
          <p className="cadastro-dica">O documento aparece na página de cada peça e na busca pelo código dela.</p>
          <SeletorProdutos selecionados={produtos} aoMudar={setProdutos} />
        </section>

        <section className="cadastro-secao" aria-labelledby={`${idFormulario}-acesso`}>
          <h2 id={`${idFormulario}-acesso`}>Quem pode ver</h2>
          <fieldset className="opcoes">
            <legend className="visualmente-oculto">Nível de acesso</legend>
            {(Object.keys(VISIBILIDADES) as Visibilidade[]).map((opcao) => {
              const info = VISIBILIDADES[opcao];
              const Icone = info.icone;
              return (
                <label key={opcao} className="opcao">
                  <input
                    type="radio"
                    name="visibilidade"
                    value={opcao}
                    checked={visibilidade === opcao}
                    onChange={() => setVisibilidade(opcao)}
                  />
                  <span className="opcao-titulo">
                    <Icone aria-hidden />
                    {info.rotulo}
                  </span>
                  <span className="opcao-descricao">{info.descricao}</span>
                </label>
              );
            })}
          </fieldset>

          {visibilidade === 'RESTRITO' && (
            <div className="campo">
              <span className="campo-rotulo">Pessoas com acesso</span>
              <SeletorUsuarios selecionados={usuarios} aoMudar={setUsuarios} />
              {usuarios.length === 0 ? (
                <p className="aviso aviso-atencao">Ninguém escolhido ainda: só administradores vão ver este documento.</p>
              ) : (
                <p className="campo-ajuda">{plural(usuarios.length, 'pessoa escolhida', 'pessoas escolhidas')}.</p>
              )}
            </div>
          )}
          <p className="cadastro-dica">Administradores sempre veem todos os documentos.</p>
        </section>

        <label className="caixa">
          <input type="checkbox" checked={publicado} onChange={(evento) => setPublicado(evento.target.checked)} />
          Publicado no portal
          <span className="caixa-dica">Rascunhos ficam visíveis só para administradores.</span>
        </label>
      </form>

      <DialogoConfirmacao
        aberto={confirmandoExclusao}
        titulo="Excluir este documento?"
        mensagem={`“${documento?.titulo ?? ''}” e o arquivo dele serão apagados. Clientes que salvaram o link vão ver “documento não encontrado”.`}
        textoConfirmar="Excluir documento"
        perigoso
        processando={excluindo}
        aoCancelar={() => setConfirmandoExclusao(false)}
        aoConfirmar={excluir}
      />
    </Janela>
  );
}

function SituacaoNoAssistente({ documento }: { documento: DocumentoAdmin }) {
  const notificar = useNotificar();
  const recarregar = useRecarregarTudo();
  const [agendando, setAgendando] = useState(false);
  const indexacao = documento.indexacao!;

  async function indexarDeNovo() {
    setAgendando(true);
    try {
      await reindexarDocumento(documento.id);
      notificar('O assistente vai ler o documento de novo em instantes.');
      await recarregar();
    } catch (falha) {
      notificar(mensagemDeErro(falha), 'erro');
    } finally {
      setAgendando(false);
    }
  }

  const texto = {
    INDEXADO: `Assistente técnico: já conhece este documento (${plural(indexacao.trechos, 'trecho')}, lido em ${dataHora(indexacao.indexadoEm)}).`,
    NA_FILA: 'Assistente técnico: na fila para ler este documento.',
    FALHOU: 'Assistente técnico: não conseguiu ler este documento.',
  }[indexacao.situacao];

  return (
    <div className="indexacao" role="status">
      <span>{texto}</span>
      <button type="button" className="link-acao" onClick={indexarDeNovo} disabled={agendando}>
        {indexacao.situacao === 'FALHOU' ? 'Tentar de novo' : 'Ler de novo'}
      </button>
      {indexacao.erro && <span className="indexacao-erro">{indexacao.erro}</span>}
    </div>
  );
}
