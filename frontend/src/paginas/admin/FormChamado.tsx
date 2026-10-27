import { useQuery } from '@tanstack/react-query';
import { FileText, Package } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { atualizarChamado, detalharChamado } from '../../api/admin';
import { ErroApi } from '../../api/cliente';
import type { ChamadoDetalhado, StatusChamado } from '../../api/tipos';
import { TextoFormatado } from '../../componentes/Assistente';
import { Campo } from '../../componentes/Campo';
import { AvisoErro, Carregando, mensagemDeErro } from '../../componentes/Estados';
import { useNotificar } from '../../contexto/Notificacoes';
import { dataHora } from '../../lib/formatar';
import { STATUS_CHAMADO } from '../../lib/rotulos';
import { useRecarregarTudo } from './acoes';
import { Janela, rolarJanelaParaTopo, useVoltarParaLista } from './Cadastro';

/** Chamado de suporte (/admin/chamados/:id): contato, conversa com o assistente, situação e anotação. */
export function FormChamado() {
  const { id = '' } = useParams();
  const fechar = useVoltarParaLista('/admin/chamados');
  const consulta = useQuery({ queryKey: ['admin', 'chamado', id], queryFn: () => detalharChamado(id) });

  if (!consulta.data) {
    return (
      <Janela titulo="Chamado" aoFechar={fechar}>
        {consulta.isError ? <AvisoErro erro={consulta.error} /> : <Carregando />}
      </Janela>
    );
  }
  return <FormularioChamado key={id} chamado={consulta.data} aoFechar={fechar} />;
}

function FormularioChamado({ chamado, aoFechar }: { chamado: ChamadoDetalhado; aoFechar: () => void }) {
  const idFormulario = useId();
  const notificar = useNotificar();
  const recarregar = useRecarregarTudo();
  const [status, setStatus] = useState<StatusChamado>(chamado.status);
  const [observacao, setObservacao] = useState(chamado.observacao ?? '');
  const [alterado, setAlterado] = useState(false);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      await atualizarChamado(chamado.id, { status, observacao });
      await recarregar();
      notificar(`Chamado nº ${chamado.numero} atualizado.`);
      aoFechar();
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha : new ErroApi(0, 'ERRO', mensagemDeErro(falha)));
      rolarJanelaParaTopo();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Janela
      titulo={`Chamado nº ${chamado.numero}`}
      idFormulario={idFormulario}
      salvando={salvando}
      alterado={alterado}
      aoFechar={aoFechar}
      links={
        <span className="janela-nota">
          Aberto em {dataHora(chamado.criadoEm)} · {chamado.clienteCadastrado ? 'cliente cadastrado' : 'visitante sem login'}
        </span>
      }
    >
      <form id={idFormulario} className="cadastro" onSubmit={salvar} onChange={() => setAlterado(true)} noValidate>
        {erro && <AvisoErro erro={erro} />}

        <dl className="chamado-contato">
          <div>
            <dt>Nome</dt>
            <dd>{chamado.nome}</dd>
          </div>
          <div>
            <dt>E-mail</dt>
            <dd>{chamado.email ? <a href={`mailto:${chamado.email}?subject=Chamado nº ${chamado.numero}`}>{chamado.email}</a> : '—'}</dd>
          </div>
          <div>
            <dt>Telefone</dt>
            <dd>{chamado.telefone ?? '—'}</dd>
          </div>
        </dl>

        <section className="cadastro-secao" aria-labelledby={`${idFormulario}-conversa`}>
          <h2 id={`${idFormulario}-conversa`}>Conversa com o assistente</h2>
          {chamado.conversa.length === 0 ? (
            <p className="cadastro-dica">A conversa não está mais disponível.</p>
          ) : (
            <ol className="chamado-conversa">
              {chamado.conversa.map((mensagem) => (
                <li key={mensagem.id} className={mensagem.papel === 'USUARIO' ? 'de-quem-pediu' : 'do-assistente'}>
                  <span className="chamado-autor">
                    {mensagem.papel === 'USUARIO' ? chamado.nome : 'Assistente'}
                    {mensagem.insatisfacao && <span className="selo selo-pendente">reclamou</span>}
                  </span>
                  {mensagem.papel === 'USUARIO' ? <p>{mensagem.conteudo}</p> : <TextoFormatado texto={mensagem.conteudo} />}
                  {mensagem.fontes.length > 0 && (
                    <span className="chamado-fontes">
                      {mensagem.fontes.map((fonte) => (
                        <Link
                          key={`${fonte.tipo}-${fonte.id}`}
                          to={fonte.tipo === 'PRODUTO' ? `/produtos/${fonte.id}` : `/documentos/${fonte.id}`}
                        >
                          {fonte.tipo === 'PRODUTO' ? <Package aria-hidden /> : <FileText aria-hidden />}
                          {fonte.titulo}
                        </Link>
                      ))}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="cadastro-secao" aria-labelledby={`${idFormulario}-atendimento`}>
          <h2 id={`${idFormulario}-atendimento`}>Atendimento</h2>
          <Campo id="status" rotulo="Situação">
            {(atributos) => (
              <select className="selecao" value={status} onChange={(e) => setStatus(e.target.value as StatusChamado)} {...atributos}>
                {(Object.keys(STATUS_CHAMADO) as StatusChamado[]).map((opcao) => (
                  <option key={opcao} value={opcao}>
                    {STATUS_CHAMADO[opcao].rotulo}
                  </option>
                ))}
              </select>
            )}
          </Campo>
          <Campo id="observacao" rotulo="Anotação interna" opcional ajuda="Só a equipe vê. Ex.: o que foi orientado, peça trocada, retorno combinado.">
            {(atributos) => (
              <textarea className="area-texto" rows={4} value={observacao} onChange={(e) => setObservacao(e.target.value)} {...atributos} />
            )}
          </Campo>
        </section>
      </form>
    </Janela>
  );
}
