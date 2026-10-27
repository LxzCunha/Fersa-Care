import { useQuery } from '@tanstack/react-query';
import { useId, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import {
  atualizarProduto,
  criarProduto,
  detalharProdutoAdmin,
  excluirProduto,
  listarCategoriasAdmin,
  type DadosProduto,
} from '../../api/admin';
import { ErroApi, mensagemDeErro } from '../../api/cliente';
import type { ProdutoAdmin, Segmento } from '../../api/tipos';
import { Campo, CampoTexto } from '../../componentes/Campo';
import { DialogoConfirmacao } from '../../componentes/DialogoConfirmacao';
import { AvisoErro, Carregando } from '../../componentes/Estados';
import { useNotificar } from '../../contexto/Notificacoes';
import { plural } from '../../lib/formatar';
import { escreverMedida, lerMedida } from '../../lib/medidas';
import { SEGMENTOS } from '../../lib/rotulos';
import { useRecarregarTudo } from './acoes';
import { CampoImagem } from './CampoImagem';
import { Janela } from './Cadastro';
import { rolarJanelaParaTopo, useVoltarParaLista } from './navegacao';

/** Campos de medida: digitados como texto ("16,25") e enviados como número. */
const MEDIDAS = [
  { campo: 'diametroInternoMm', rotulo: 'Ø interno', unidade: 'mm', exemplo: '25' },
  { campo: 'diametroExternoMm', rotulo: 'Ø externo', unidade: 'mm', exemplo: '52' },
  { campo: 'larguraMm', rotulo: 'Largura', unidade: 'mm', exemplo: '16,25' },
  { campo: 'pesoKg', rotulo: 'Peso', unidade: 'kg', exemplo: '0,16' },
] as const;

type CampoDeMedida = (typeof MEDIDAS)[number]['campo'];
type DadosDoFormulario = Omit<DadosProduto, CampoDeMedida | 'removerImagem'> & Record<CampoDeMedida, string>;

/** Cadastro (/admin/produtos/novo) e edição (/admin/produtos/:id) de peças, numa janela sobre a lista. */
export function FormProduto() {
  const { id } = useParams();
  const fechar = useVoltarParaLista('/admin/produtos');
  const consulta = useQuery({
    queryKey: ['admin', 'produto', id],
    queryFn: () => detalharProdutoAdmin(id!),
    enabled: Boolean(id),
  });

  if (id && !consulta.data) {
    return (
      <Janela titulo="Peça" aoFechar={fechar}>
        {consulta.isError ? <AvisoErro erro={consulta.error} /> : <Carregando />}
      </Janela>
    );
  }
  return <FormularioProduto key={id ?? 'novo'} produto={consulta.data} aoFechar={fechar} />;
}

function FormularioProduto({ produto, aoFechar }: { produto?: ProdutoAdmin; aoFechar: () => void }) {
  const editando = Boolean(produto);
  const idFormulario = useId();
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
  const [alterado, setAlterado] = useState(false);
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
      aoFechar();
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha : new ErroApi(0, 'ERRO', mensagemDeErro(falha)));
      rolarJanelaParaTopo();
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
      aoFechar();
    } catch (falha) {
      notificar(mensagemDeErro(falha), 'erro');
      setExcluindo(false);
      setConfirmandoExclusao(false);
    }
  }

  const mostrarAvisoGeral = erro && (erro.detalhes.length === 0 || erro.status === 409);

  return (
    <Janela
      titulo={editando ? 'Peça' : 'Nova peça'}
      idFormulario={idFormulario}
      salvando={salvando}
      alterado={alterado}
      aoFechar={aoFechar}
      links={
        produto && (
          <>
            <span className="janela-nota">
              {plural(produto.totalDocumentos, 'documento ligado', 'documentos ligados')} a esta peça
            </span>
            {produto.ativo && <Link to={`/produtos/${produto.id}`}>Ver no portal</Link>}
            <button type="button" className="janela-link-perigo" onClick={() => setConfirmandoExclusao(true)}>
              Excluir peça
            </button>
          </>
        )
      }
    >
      <form id={idFormulario} className="cadastro" onSubmit={salvar} onChange={() => setAlterado(true)} noValidate>
        {mostrarAvisoGeral && <AvisoErro erro={erro} />}

        <div className="cadastro-linha">
          <CampoTexto
            id="codigo"
            rotulo="Código"
            value={dados.codigo}
            onChange={(e) => atualizar('codigo', e.target.value)}
            erro={erroDe('codigo')}
            ajuda="Como vem impresso na caixa. A busca ignora espaços e hífens."
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
        <div className="cadastro-linha">
          <CampoTexto
            id="nome"
            rotulo="Nome"
            placeholder="Ex.: Rolamento de rolos cônicos"
            value={dados.nome}
            onChange={(e) => atualizar('nome', e.target.value)}
            erro={erroDe('nome')}
          />
          <Campo id="categoriaId" rotulo="Categoria" opcional erro={erroDe('categoriaId')}>
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
        </div>

        <section className="cadastro-secao" aria-labelledby={`${idFormulario}-medidas`}>
          <h2 id={`${idFormulario}-medidas`}>Medidas</h2>
          <div className="cadastro-linha cadastro-linha-medidas">
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
          <p className="cadastro-dica">Deixe em branco o que não se aplica (kits, ferramentas).</p>
        </section>

        <section className="cadastro-secao" aria-labelledby={`${idFormulario}-foto`}>
          <h2 id={`${idFormulario}-foto`}>Foto</h2>
          <CampoImagem
            objeto="foto"
            rotulo="Foto da peça"
            dica="Fundo branco ou transparente fica melhor no catálogo."
            urlAtual={produto?.imagemUrl ?? null}
            arquivo={imagem}
            removerAtual={removerImagem}
            aoEscolher={(arquivo) => {
              setImagem(arquivo);
              setAlterado(true);
              if (arquivo) setRemoverImagem(false);
            }}
            aoRemoverAtual={(remover) => {
              setRemoverImagem(remover);
              setAlterado(true);
            }}
            erro={erroDe('imagem')}
          />
        </section>

        <section className="cadastro-secao" aria-labelledby={`${idFormulario}-aplicacao`}>
          <h2 id={`${idFormulario}-aplicacao`}>Aplicação e descrição</h2>
          <Campo
            id="aplicacoes"
            rotulo="Aplicações"
            opcional
            erro={erroDe('aplicacoes')}
            ajuda="Veículos e máquinas citados aqui também são encontrados pela busca."
          >
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
                rows={4}
                value={dados.descricao}
                onChange={(e) => atualizar('descricao', e.target.value)}
                {...atributos}
              />
            )}
          </Campo>
        </section>

        <label className="caixa">
          <input type="checkbox" checked={dados.ativo} onChange={(e) => atualizar('ativo', e.target.checked)} />
          Aparece no catálogo do portal
        </label>
      </form>

      <DialogoConfirmacao
        aberto={confirmandoExclusao}
        titulo="Excluir esta peça?"
        mensagem={`${produto?.codigo ?? ''} sai do catálogo e a foto é apagada. ${
          produto?.totalDocumentos
            ? `${plural(produto.totalDocumentos, 'documento continua', 'documentos continuam')} no portal, sem o vínculo com a peça.`
            : ''
        } Para só esconder do portal, desmarque “Aparece no catálogo do portal”.`}
        textoConfirmar="Excluir peça"
        perigoso
        processando={excluindo}
        aoCancelar={() => setConfirmandoExclusao(false)}
        aoConfirmar={excluir}
      />
    </Janela>
  );
}
