import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Eye, Save, Trash } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  atualizarProduto,
  criarProduto,
  detalharProdutoAdmin,
  excluirProduto,
  listarCategoriasAdmin,
  type DadosProduto,
} from '../../api/admin';
import { ErroApi } from '../../api/cliente';
import type { ProdutoAdmin, Segmento } from '../../api/tipos';
import { Campo, CampoTexto } from '../../componentes/Campo';
import { DialogoConfirmacao } from '../../componentes/DialogoConfirmacao';
import { AvisoErro, Carregando, mensagemDeErro } from '../../componentes/Estados';
import { useNotificar } from '../../contexto/Notificacoes';
import { plural } from '../../lib/formatar';
import { escreverMedida, lerMedida } from '../../lib/medidas';
import { SEGMENTOS } from '../../lib/rotulos';
import { useRecarregarTudo } from './acoes';
import { CampoImagem } from './CampoImagem';

/** Campos de medida: digitados como texto ("16,25") e enviados como número. */
const MEDIDAS = [
  { campo: 'diametroInternoMm', rotulo: 'Ø interno', unidade: 'mm', exemplo: '25' },
  { campo: 'diametroExternoMm', rotulo: 'Ø externo', unidade: 'mm', exemplo: '52' },
  { campo: 'larguraMm', rotulo: 'Largura', unidade: 'mm', exemplo: '16,25' },
  { campo: 'pesoKg', rotulo: 'Peso', unidade: 'kg', exemplo: '0,16' },
] as const;

type CampoDeMedida = (typeof MEDIDAS)[number]['campo'];
type DadosDoFormulario = Omit<DadosProduto, CampoDeMedida | 'removerImagem'> & Record<CampoDeMedida, string>;

export function FormProduto() {
  const { id } = useParams();
  const consulta = useQuery({
    queryKey: ['admin', 'produto', id],
    queryFn: () => detalharProdutoAdmin(id!),
    enabled: Boolean(id),
  });

  if (id && consulta.isPending) return <Carregando />;
  if (id && consulta.isError) return <AvisoErro erro={consulta.error} />;
  return <FormularioProduto key={id ?? 'novo'} produto={consulta.data} />;
}

function FormularioProduto({ produto }: { produto?: ProdutoAdmin }) {
  const editando = Boolean(produto);
  const navegar = useNavigate();
  const notificar = useNotificar();
  const recarregar = useRecarregarTudo();
  const categorias = useQuery({ queryKey: ['admin', 'categorias', ''], queryFn: () => listarCategoriasAdmin() });

  const [dados, setDados] = useState<DadosDoFormulario>({
    codigo: produto?.codigo ?? '',
    nome: produto?.nome ?? '',
    segmento: produto?.segmento ?? 'LEVE',
    categoriaId: produto?.categoria?.id ?? null,
    descricao: produto?.descricao ?? '',
    aplicacoes: produto?.aplicacoes ?? '',
    diametroInternoMm: escreverMedida(produto?.diametroInternoMm),
    diametroExternoMm: escreverMedida(produto?.diametroExternoMm),
    larguraMm: escreverMedida(produto?.larguraMm),
    pesoKg: escreverMedida(produto?.pesoKg),
    ativo: produto?.ativo ?? true,
  });
  const [imagem, setImagem] = useState<File | null>(null);
  const [removerImagem, setRemoverImagem] = useState(false);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [errosDeMedida, setErrosDeMedida] = useState<Partial<Record<CampoDeMedida, string>>>({});
  const [salvando, setSalvando] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const erroDe = (campo: string) => erro?.erroDoCampo(campo);
  const atualizar = <C extends keyof DadosDoFormulario>(campo: C, valor: DadosDoFormulario[C]) =>
    setDados((atuais) => ({ ...atuais, [campo]: valor }));

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);

    // Medidas digitadas: vazio = não se aplica; texto que não é número = erro no campo.
    const invalidas = Object.fromEntries(
      MEDIDAS.filter(({ campo }) => dados[campo].trim() !== '' && lerMedida(dados[campo]) === null).map(
        ({ campo, exemplo }) => [campo, `Informe só o número, ex.: ${exemplo}.`],
      ),
    );
    setErrosDeMedida(invalidas);
    if (Object.keys(invalidas).length > 0) return;

    const envio: DadosProduto = {
      ...dados,
      diametroInternoMm: lerMedida(dados.diametroInternoMm),
      diametroExternoMm: lerMedida(dados.diametroExternoMm),
      larguraMm: lerMedida(dados.larguraMm),
      pesoKg: lerMedida(dados.pesoKg),
      removerImagem,
    };

    setSalvando(true);
    try {
      if (produto) await atualizarProduto(produto.id, envio, imagem);
      else await criarProduto(envio, imagem);
      await recarregar();
      notificar(editando ? 'Peça atualizada.' : 'Peça cadastrada.');
      navegar('/admin/produtos');
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha : new ErroApi(0, 'ERRO', mensagemDeErro(falha)));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!produto) return;
    setExcluindo(true);
    try {
      await excluirProduto(produto.id);
      await recarregar();
      notificar('Peça excluída.');
      navegar('/admin/produtos');
    } catch (falha) {
      notificar(mensagemDeErro(falha), 'erro');
      setExcluindo(false);
      setConfirmandoExclusao(false);
    }
  }

  const mostrarAvisoGeral = erro && (erro.detalhes.length === 0 || erro.status === 409);

  return (
    <>
      <title>{`${editando ? 'Editar' : 'Cadastrar'} peça | Administração FERSA Care`}</title>

      <Link to="/admin/produtos" className="voltar">
        <ArrowLeft aria-hidden /> Peças
      </Link>

      <header className="admin-cabecalho">
        <div>
          <h1>{editando ? <span className="codigo">{produto?.codigo}</span> : 'Cadastrar peça'}</h1>
          {produto && <p>{plural(produto.totalDocumentos, 'documento ligado', 'documentos ligados')} a esta peça.</p>}
        </div>
        {produto?.ativo && (
          <Link to={`/produtos/${produto.id}`} className="botao botao-secundario">
            <Eye aria-hidden /> Ver no portal
          </Link>
        )}
      </header>

      <form className="form-admin" onSubmit={salvar} noValidate>
        {mostrarAvisoGeral && <AvisoErro erro={erro} />}

        <section className="form-bloco" aria-labelledby="bloco-produto">
          <div className="form-bloco-titulo">
            <h2 id="bloco-produto">Identificação da peça</h2>
            <p>O código é o que vem impresso na caixa; a busca ignora espaços e hífens.</p>
          </div>
          <div className="linha-campos">
            <CampoTexto
              id="codigo"
              rotulo="Código (referência)"
              value={dados.codigo}
              onChange={(e) => atualizar('codigo', e.target.value)}
              erro={erroDe('codigo')}
              autoCapitalize="characters"
              maxLength={40}
            />
            <Campo id="segmento" rotulo="Linha" erro={erroDe('segmento')}>
              {(atributos) => (
                <select
                  className="selecao"
                  value={dados.segmento}
                  onChange={(e) => atualizar('segmento', e.target.value as Segmento)}
                  {...atributos}
                >
                  {(Object.keys(SEGMENTOS) as Segmento[]).map((opcao) => (
                    <option key={opcao} value={opcao}>
                      {SEGMENTOS[opcao]}
                    </option>
                  ))}
                </select>
              )}
            </Campo>
          </div>
          <CampoTexto
            id="nome"
            rotulo="Nome"
            placeholder="Ex.: Rolamento de rolos cônicos"
            value={dados.nome}
            onChange={(e) => atualizar('nome', e.target.value)}
            erro={erroDe('nome')}
          />
          <Campo
            id="categoriaId"
            rotulo="Categoria"
            opcional
            erro={erroDe('categoriaId')}
            ajuda={
              <>
                Agrupa a peça no catálogo. <Link to="/admin/categorias">Gerenciar categorias</Link>
              </>
            }
          >
            {(atributos) => (
              <select
                className="selecao"
                value={dados.categoriaId ?? ''}
                onChange={(e) => atualizar('categoriaId', e.target.value || null)}
                {...atributos}
              >
                <option value="">Sem categoria</option>
                {categorias.data?.map((categoria) => (
                  <option key={categoria.id} value={categoria.id}>
                    {categoria.nome}
                  </option>
                ))}
              </select>
            )}
          </Campo>
        </section>

        <section className="form-bloco" aria-labelledby="bloco-foto">
          <div className="form-bloco-titulo">
            <h2 id="bloco-foto">Foto</h2>
            <p>Aparece nos cartões do catálogo e na página da peça. Sem foto, o portal mostra um desenho de rolamento.</p>
          </div>
          <CampoImagem
            urlAtual={produto?.imagemUrl ?? null}
            arquivo={imagem}
            removerAtual={removerImagem}
            aoEscolher={(arquivo) => {
              setImagem(arquivo);
              if (arquivo) setRemoverImagem(false);
            }}
            aoRemoverAtual={setRemoverImagem}
          />
        </section>

        <section className="form-bloco" aria-labelledby="bloco-medidas">
          <div className="form-bloco-titulo">
            <h2 id="bloco-medidas">Medidas principais</h2>
            <p>Aparecem na ficha da peça e nos filtros do catálogo. Deixe em branco o que não se aplica (kits, ferramentas).</p>
          </div>
          <div className="linha-campos linha-medidas">
            {MEDIDAS.map(({ campo, rotulo, unidade, exemplo }) => (
              <Campo key={campo} id={campo} rotulo={`${rotulo} (${unidade})`} erro={errosDeMedida[campo] ?? erroDe(campo)}>
                {(atributos) => (
                  <input
                    className="entrada"
                    inputMode="decimal"
                    placeholder={`Ex.: ${exemplo}`}
                    value={dados[campo]}
                    onChange={(e) => atualizar(campo, e.target.value)}
                    {...atributos}
                  />
                )}
              </Campo>
            ))}
          </div>
        </section>

        <section className="form-bloco" aria-labelledby="bloco-aplicacao">
          <div className="form-bloco-titulo">
            <h2 id="bloco-aplicacao">Aplicação e descrição</h2>
            <p>Veículos e máquinas citados aqui também são encontrados pela busca.</p>
          </div>
          <Campo id="aplicacoes" rotulo="Aplicações" opcional erro={erroDe('aplicacoes')}>
            {(atributos) => (
              <textarea
                className="area-texto"
                rows={3}
                placeholder="Ex.: Cubo de roda traseiro de utilitários leves"
                value={dados.aplicacoes}
                onChange={(e) => atualizar('aplicacoes', e.target.value)}
                {...atributos}
              />
            )}
          </Campo>
          <Campo id="descricao" rotulo="Descrição" opcional erro={erroDe('descricao')}>
            {(atributos) => (
              <textarea
                className="area-texto"
                rows={3}
                value={dados.descricao}
                onChange={(e) => atualizar('descricao', e.target.value)}
                {...atributos}
              />
            )}
          </Campo>
          <label className="alternador">
            <input type="checkbox" checked={dados.ativo} onChange={(e) => atualizar('ativo', e.target.checked)} />
            {dados.ativo ? 'Aparece no catálogo do portal' : 'Fora do catálogo (oculta no portal)'}
          </label>
        </section>

        <div className="form-rodape">
          <div className="grupo-botoes">
            <button type="submit" className="botao botao-principal" disabled={salvando}>
              <Save aria-hidden /> {salvando ? 'Salvando...' : 'Salvar peça'}
            </button>
            <Link to="/admin/produtos" className="botao botao-fantasma">
              Cancelar
            </Link>
          </div>
          {produto && (
            <button type="button" className="botao botao-perigo" onClick={() => setConfirmandoExclusao(true)}>
              <Trash aria-hidden /> Excluir
            </button>
          )}
        </div>
      </form>

      <DialogoConfirmacao
        aberto={confirmandoExclusao}
        titulo="Excluir esta peça?"
        mensagem={`${produto?.codigo ?? ''} sai do catálogo e a foto é apagada. ${
          produto?.totalDocumentos
            ? `${plural(produto.totalDocumentos, 'documento continua', 'documentos continuam')} no portal, sem o vínculo com a peça.`
            : ''
        } Para só esconder do portal, desmarque “Aparece no catálogo”.`}
        textoConfirmar="Excluir peça"
        perigoso
        processando={excluindo}
        aoCancelar={() => setConfirmandoExclusao(false)}
        aoConfirmar={excluir}
      />
    </>
  );
}
