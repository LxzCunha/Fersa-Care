import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Eye, FileUp, Link2, Save, Trash } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  atualizarDocumento,
  criarDocumento,
  detalharDocumentoAdmin,
  excluirDocumento,
  type DadosDocumento,
} from '../../api/admin';
import { ErroApi } from '../../api/cliente';
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
import { AvisoErro, Carregando, mensagemDeErro } from '../../componentes/Estados';
import { LIMITE_UPLOAD_MB } from '../../config';
import { useNotificar } from '../../contexto/Notificacoes';
import { data, plural } from '../../lib/formatar';
import { IDIOMAS, ORDEM_DOS_TIPOS, TIPOS, VISIBILIDADES } from '../../lib/rotulos';
import { useRecarregarTudo } from './acoes';
import { CampoArquivo } from './CampoArquivo';
import { SeletorProdutos, SeletorUsuarios } from './Seletores';

/** Cadastro (/admin/documentos/novo) e edição (/admin/documentos/:id) de documentos. */
export function FormDocumento() {
  const { id } = useParams();
  const consulta = useQuery({
    queryKey: ['admin', 'documento', id],
    queryFn: () => detalharDocumentoAdmin(id!),
    enabled: Boolean(id),
  });

  if (id && consulta.isPending) return <Carregando />;
  if (id && consulta.isError) return <AvisoErro erro={consulta.error} />;
  return <FormularioDocumento key={id ?? 'novo'} documento={consulta.data} />;
}

/** "manual-de-montagem_v2.pdf" → "Manual de montagem v2" */
function tituloPeloNomeDoArquivo(nome: string): string {
  const semExtensao = nome.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
  return semExtensao.charAt(0).toUpperCase() + semExtensao.slice(1);
}

function FormularioDocumento({ documento }: { documento?: DocumentoAdmin }) {
  const editando = Boolean(documento);
  const navegar = useNavigate();
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
  const [produtos, setProdutos] = useState<ProdutoResumo[]>(documento?.produtos ?? []);
  const [usuarios, setUsuarios] = useState<UsuarioComAcesso[]>(documento?.usuariosComAcesso ?? []);

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
    };
    const arquivoParaEnviar = origem === 'ARQUIVO' ? arquivo : null;

    setSalvando(true);
    setProgresso(arquivoParaEnviar ? 0 : null);
    try {
      if (documento) {
        await atualizarDocumento(documento.id, dados, arquivoParaEnviar, setProgresso);
      } else {
        await criarDocumento(dados, arquivoParaEnviar, setProgresso);
      }
      await recarregar();
      notificar(editando ? 'Documento atualizado.' : 'Documento cadastrado.');
      navegar('/admin/documentos');
    } catch (falha) {
      setErro(
        falha instanceof ErroApi ? falha : new ErroApi(0, 'ERRO', mensagemDeErro(falha)),
      );
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
      navegar('/admin/documentos');
    } catch (falha) {
      notificar(mensagemDeErro(falha), 'erro');
      setExcluindo(false);
      setConfirmandoExclusao(false);
    }
  }

  const errosGerais = erro && erro.detalhes.length === 0;

  return (
    <>
      <title>{`${editando ? 'Editar' : 'Cadastrar'} documento | Administração FERSA Care`}</title>

      <Link to="/admin/documentos" className="voltar">
        <ArrowLeft aria-hidden /> Documentos
      </Link>

      <header className="admin-cabecalho">
        <div>
          <h1>{editando ? 'Editar documento' : 'Cadastrar documento'}</h1>
          {documento && (
            <p>
              {documento.criadoPor ? `Cadastrado por ${documento.criadoPor.nome} em ` : 'Cadastrado em '}
              {data(documento.criadoEm)}. {plural(documento.totalVisualizacoes, 'abertura')} até agora.
            </p>
          )}
        </div>
        {documento && (
          <Link to={`/documentos/${documento.id}`} className="botao botao-secundario">
            <Eye aria-hidden /> Ver no portal
          </Link>
        )}
      </header>

      <form className="form-admin" onSubmit={salvar} noValidate>
        {errosGerais && <AvisoErro erro={erro} />}
        {erro && !errosGerais && (
          <AvisoErro>Confira os campos destacados: {erro.message}</AvisoErro>
        )}

        <section className="form-bloco" aria-labelledby="bloco-identificacao">
          <div className="form-bloco-titulo">
            <h2 id="bloco-identificacao">Identificação</h2>
            <p>O título e a descrição entram na busca do portal.</p>
          </div>
          <CampoTexto
            id="titulo"
            rotulo="Título"
            value={titulo}
            onChange={(evento) => setTitulo(evento.target.value)}
            erro={erroDe('titulo')}
            maxLength={200}
          />
          <Campo id="descricao" rotulo="Descrição" opcional erro={erroDe('descricao')} ajuda="Explique em uma ou duas frases o que o cliente encontra no material.">
            {(atributos) => (
              <textarea
                className="area-texto"
                rows={3}
                value={descricao}
                onChange={(evento) => setDescricao(evento.target.value)}
                {...atributos}
              />
            )}
          </Campo>
          <div className="linha-campos">
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
        </section>

        <section className="form-bloco" aria-labelledby="bloco-conteudo">
          <div className="form-bloco-titulo">
            <h2 id="bloco-conteudo">Conteúdo</h2>
            <p>Envie o arquivo ou use o link de onde o material já está (YouTube, Vimeo, SharePoint...).</p>
          </div>
          <div className="alternancia-origem" role="radiogroup" aria-label="Origem do conteúdo">
            <label>
              <input
                type="radio"
                name="origem"
                checked={origem === 'ARQUIVO'}
                onChange={() => setOrigem('ARQUIVO')}
              />
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
              aoEscolher={escolherArquivo}
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

          {progresso !== null && (
            <div className="progresso" role="status">
              <span>Enviando arquivo: {progresso}%</span>
              <div className="progresso-barra">
                <span style={{ width: `${progresso}%` }} />
              </div>
            </div>
          )}
        </section>

        <section className="form-bloco" aria-labelledby="bloco-pecas">
          <div className="form-bloco-titulo">
            <h2 id="bloco-pecas">Peças relacionadas</h2>
            <p>O documento aparece na página de cada peça e na busca pelo código dela.</p>
          </div>
          <SeletorProdutos selecionados={produtos} aoMudar={setProdutos} />
        </section>

        <section className="form-bloco" aria-labelledby="bloco-acesso">
          <div className="form-bloco-titulo">
            <h2 id="bloco-acesso">Quem pode ver</h2>
            <p>Administradores sempre veem todos os documentos.</p>
          </div>
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
        </section>

        <section className="form-bloco" aria-labelledby="bloco-publicacao">
          <div className="form-bloco-titulo">
            <h2 id="bloco-publicacao">Publicação</h2>
            <p>Rascunhos ficam visíveis só para administradores, mesmo que o nível de acesso seja público.</p>
          </div>
          <label className="alternador">
            <input type="checkbox" checked={publicado} onChange={(evento) => setPublicado(evento.target.checked)} />
            {publicado ? 'Publicado no portal' : 'Rascunho'}
          </label>
        </section>

        <div className="form-rodape">
          <div className="grupo-botoes">
            <button type="submit" className="botao botao-principal" disabled={salvando}>
              <Save aria-hidden /> {salvando ? (progresso !== null ? `Enviando ${progresso}%` : 'Salvando...') : 'Salvar documento'}
            </button>
            <Link to="/admin/documentos" className="botao botao-fantasma">
              Cancelar
            </Link>
          </div>
          {documento && (
            <button
              type="button"
              className="botao botao-perigo"
              onClick={() => setConfirmandoExclusao(true)}
              disabled={salvando}
            >
              <Trash aria-hidden /> Excluir
            </button>
          )}
        </div>
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
    </>
  );
}
