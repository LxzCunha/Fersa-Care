import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Eye, Save, Trash } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  atualizarCategoria,
  criarCategoria,
  detalharCategoriaAdmin,
  excluirCategoria,
  type DadosCategoria,
} from '../../api/admin';
import { ErroApi } from '../../api/cliente';
import type { Categoria } from '../../api/tipos';
import { Campo, CampoTexto } from '../../componentes/Campo';
import { DialogoConfirmacao } from '../../componentes/DialogoConfirmacao';
import { AvisoErro, Carregando, mensagemDeErro } from '../../componentes/Estados';
import { useNotificar } from '../../contexto/Notificacoes';
import { plural } from '../../lib/formatar';
import { useRecarregarTudo } from './acoes';

export function FormCategoria() {
  const { id } = useParams();
  const consulta = useQuery({
    queryKey: ['admin', 'categoria', id],
    queryFn: () => detalharCategoriaAdmin(id!),
    enabled: Boolean(id),
  });

  if (id && consulta.isPending) return <Carregando />;
  if (id && consulta.isError) return <AvisoErro erro={consulta.error} />;
  return <FormularioCategoria key={id ?? 'nova'} categoria={consulta.data} />;
}

function FormularioCategoria({ categoria }: { categoria?: Categoria }) {
  const editando = Boolean(categoria);
  const navegar = useNavigate();
  const notificar = useNotificar();
  const recarregar = useRecarregarTudo();

  const [dados, setDados] = useState<DadosCategoria>({
    nome: categoria?.nome ?? '',
    descricao: categoria?.descricao ?? '',
  });
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const erroDe = (campo: string) => erro?.erroDoCampo(campo);

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      if (categoria) await atualizarCategoria(categoria.id, dados);
      else await criarCategoria(dados);
      await recarregar();
      notificar(editando ? 'Categoria atualizada.' : 'Categoria cadastrada.');
      navegar('/admin/categorias');
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha : new ErroApi(0, 'ERRO', mensagemDeErro(falha)));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!categoria) return;
    setExcluindo(true);
    try {
      await excluirCategoria(categoria.id);
      await recarregar();
      notificar('Categoria excluída.');
      navegar('/admin/categorias');
    } catch (falha) {
      notificar(mensagemDeErro(falha), 'erro');
      setExcluindo(false);
      setConfirmandoExclusao(false);
    }
  }

  // Nome repetido (409) não vem com campo: mostramos no topo.
  const mostrarAvisoGeral = erro && (erro.detalhes.length === 0 || erro.status === 409);

  return (
    <>
      <title>{`${editando ? 'Editar' : 'Cadastrar'} categoria | Administração FERSA Care`}</title>

      <Link to="/admin/categorias" className="voltar">
        <ArrowLeft aria-hidden /> Categorias
      </Link>

      <header className="admin-cabecalho">
        <div>
          <h1>{editando ? categoria?.nome : 'Cadastrar categoria'}</h1>
          {categoria && <p>{plural(categoria.totalProdutos, 'peça nesta categoria', 'peças nesta categoria')}.</p>}
        </div>
        {categoria && categoria.totalProdutos > 0 && (
          <Link to={`/produtos?categoria=${categoria.id}`} className="botao botao-secundario">
            <Eye aria-hidden /> Ver no portal
          </Link>
        )}
      </header>

      <form className="form-admin" onSubmit={salvar} noValidate>
        {mostrarAvisoGeral && <AvisoErro erro={erro} />}

        <section className="form-bloco" aria-labelledby="bloco-categoria">
          <div className="form-bloco-titulo">
            <h2 id="bloco-categoria">Categoria</h2>
            <p>O nome aparece no catálogo, nos filtros e nos cartões das peças.</p>
          </div>
          <CampoTexto
            id="nome"
            rotulo="Nome"
            placeholder="Ex.: Rolamentos de Esferas"
            value={dados.nome}
            onChange={(e) => setDados((atuais) => ({ ...atuais, nome: e.target.value }))}
            erro={erroDe('nome')}
            maxLength={120}
          />
          <Campo
            id="descricao"
            rotulo="Descrição"
            opcional
            erro={erroDe('descricao')}
            ajuda="Aparece no topo do catálogo quando a categoria é escolhida."
          >
            {(atributos) => (
              <textarea
                className="area-texto"
                rows={3}
                value={dados.descricao}
                onChange={(e) => setDados((atuais) => ({ ...atuais, descricao: e.target.value }))}
                {...atributos}
              />
            )}
          </Campo>
        </section>

        <div className="form-rodape">
          <div className="grupo-botoes">
            <button type="submit" className="botao botao-principal" disabled={salvando}>
              <Save aria-hidden /> {salvando ? 'Salvando...' : 'Salvar categoria'}
            </button>
            <Link to="/admin/categorias" className="botao botao-fantasma">
              Cancelar
            </Link>
          </div>
          {categoria && (
            <button type="button" className="botao botao-perigo" onClick={() => setConfirmandoExclusao(true)}>
              <Trash aria-hidden /> Excluir
            </button>
          )}
        </div>
      </form>

      <DialogoConfirmacao
        aberto={confirmandoExclusao}
        titulo="Excluir esta categoria?"
        mensagem={
          categoria?.totalProdutos
            ? `${plural(categoria.totalProdutos, 'peça continua', 'peças continuam')} no catálogo, mas sem categoria. Você pode escolher outra categoria para elas depois.`
            : 'Nenhuma peça usa esta categoria.'
        }
        textoConfirmar="Excluir categoria"
        perigoso
        processando={excluindo}
        aoCancelar={() => setConfirmandoExclusao(false)}
        aoConfirmar={excluir}
      />
    </>
  );
}
