import { useQuery } from '@tanstack/react-query';
import { useId, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import {
  atualizarCategoria,
  criarCategoria,
  detalharCategoriaAdmin,
  excluirCategoria,
  type DadosCategoria,
} from '../../api/admin';
import { ErroApi, mensagemDeErro } from '../../api/cliente';
import type { Categoria } from '../../api/tipos';
import { Campo, CampoTexto } from '../../componentes/Campo';
import { DialogoConfirmacao } from '../../componentes/DialogoConfirmacao';
import { AvisoErro, Carregando } from '../../componentes/Estados';
import { useNotificar } from '../../contexto/Notificacoes';
import { plural } from '../../lib/formatar';
import { useRecarregarTudo } from './acoes';
import { Janela } from './Cadastro';
import { rolarJanelaParaTopo, useVoltarParaLista } from './navegacao';

export function FormCategoria() {
  const { id } = useParams();
  const fechar = useVoltarParaLista('/admin/categorias');
  const consulta = useQuery({
    queryKey: ['admin', 'categoria', id],
    queryFn: () => detalharCategoriaAdmin(id!),
    enabled: Boolean(id),
  });

  if (id && !consulta.data) {
    return (
      <Janela titulo="Categoria" largura="estreita" aoFechar={fechar}>
        {consulta.isError ? <AvisoErro erro={consulta.error} /> : <Carregando />}
      </Janela>
    );
  }
  return <FormularioCategoria key={id ?? 'nova'} categoria={consulta.data} aoFechar={fechar} />;
}

function FormularioCategoria({ categoria, aoFechar }: { categoria?: Categoria; aoFechar: () => void }) {
  const editando = Boolean(categoria);
  const idFormulario = useId();
  const notificar = useNotificar();
  const recarregar = useRecarregarTudo();

  const [dados, setDados] = useState<DadosCategoria>({
    nome: categoria?.nome ?? '',
    descricao: categoria?.descricao ?? '',
  });
  const [alterado, setAlterado] = useState(false);
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
      aoFechar();
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha : new ErroApi(0, 'ERRO', mensagemDeErro(falha)));
      rolarJanelaParaTopo();
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
      aoFechar();
    } catch (falha) {
      notificar(mensagemDeErro(falha), 'erro');
      setExcluindo(false);
      setConfirmandoExclusao(false);
    }
  }

  // Nome repetido (409) não vem com campo: mostramos no topo.
  const mostrarAvisoGeral = erro && (erro.detalhes.length === 0 || erro.status === 409);

  return (
    <Janela
      titulo={editando ? 'Categoria' : 'Nova categoria'}
      largura="estreita"
      idFormulario={idFormulario}
      salvando={salvando}
      alterado={alterado}
      aoFechar={aoFechar}
      links={
        categoria && (
          <>
            <span className="janela-nota">{plural(categoria.totalProdutos, 'peça', 'peças')} nesta categoria</span>
            {categoria.totalProdutos > 0 && <Link to={`/produtos?categoria=${categoria.id}`}>Ver no portal</Link>}
            <button type="button" className="janela-link-perigo" onClick={() => setConfirmandoExclusao(true)}>
              Excluir categoria
            </button>
          </>
        )
      }
    >
      <form id={idFormulario} className="cadastro" onSubmit={salvar} onChange={() => setAlterado(true)} noValidate>
        {mostrarAvisoGeral && <AvisoErro erro={erro} />}

        <CampoTexto
          id="nome"
          rotulo="Nome"
          placeholder="Ex.: Rolamentos de Esferas"
          value={dados.nome}
          onChange={(e) => setDados((atuais) => ({ ...atuais, nome: e.target.value }))}
          erro={erroDe('nome')}
          ajuda="Aparece no catálogo, nos filtros e nos cartões das peças."
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
              rows={4}
              value={dados.descricao}
              onChange={(e) => setDados((atuais) => ({ ...atuais, descricao: e.target.value }))}
              {...atributos}
            />
          )}
        </Campo>
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
    </Janela>
  );
}
