import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, Outlet, useLocation, useSearchParams } from 'react-router';
import { listarChamados } from '../../api/admin';
import type { StatusChamado } from '../../api/tipos';
import { AvisoErro, Carregando, EstadoVazio } from '../../componentes/Estados';
import { dataHora } from '../../lib/formatar';
import { useValorAtrasado } from '../../lib/ganchos';
import { STATUS_CHAMADO } from '../../lib/rotulos';
import { Abas, BarraBusca, CabecalhoLista, RodapeLista } from './Cadastro';
import { useAbrirAoClicarNaLinha, useFiltrosNaUrl } from './navegacao';

const POR_PAGINA = 20;

export function AdminChamados() {
  const [parametros, setParametros] = useSearchParams();
  const { search } = useLocation();
  const alterar = useFiltrosNaUrl(parametros, setParametros);
  const abrirLinha = useAbrirAoClicarNaLinha();
  const [busca, setBusca] = useState('');
  const termo = useValorAtrasado(busca.trim());

  const status = (parametros.get('status') as StatusChamado | null) ?? undefined;
  const pagina = Number(parametros.get('pagina') ?? '1') || 1;

  const filtros = { busca: termo || undefined, status, pagina, porPagina: POR_PAGINA };
  const consulta = useQuery({
    queryKey: ['admin', 'chamados', filtros],
    queryFn: () => listarChamados(filtros),
    placeholderData: keepPreviousData,
  });
  const porStatus = consulta.data?.porStatus;

  return (
    <>
      <title>Chamados | Administração FERSA Care</title>

      <CabecalhoLista titulo="Chamados de suporte" />

      <Abas
        rotulo="Situação"
        valor={status}
        aoMudar={(valor) => alterar('status', valor)}
        opcoes={[
          { rotulo: 'Todos', contagem: porStatus && porStatus.ABERTO + porStatus.EM_ATENDIMENTO + porStatus.RESOLVIDO },
          { valor: 'ABERTO', rotulo: 'Abertos', contagem: porStatus?.ABERTO },
          { valor: 'EM_ATENDIMENTO', rotulo: 'Em atendimento', contagem: porStatus?.EM_ATENDIMENTO },
          { valor: 'RESOLVIDO', rotulo: 'Resolvidos', contagem: porStatus?.RESOLVIDO },
        ]}
      />

      <BarraBusca
        rotulo="Buscar por número, nome, contato ou assunto"
        valor={busca}
        aoMudar={(texto) => {
          setBusca(texto);
          if (pagina !== 1) alterar('pagina', undefined);
        }}
      />

      {consulta.isPending && <Carregando />}
      {consulta.isError && <AvisoErro erro={consulta.error} />}

      {consulta.data &&
        (consulta.data.total === 0 ? (
          <EstadoVazio titulo={status === 'ABERTO' ? 'Nenhum chamado aberto' : 'Nenhum chamado encontrado'}>
            Os chamados aparecem aqui quando o assistente técnico não resolve a dúvida e a pessoa pede atendimento.
          </EstadoVazio>
        ) : (
          <>
            <table className="tabela">
              <thead>
                <tr>
                  <th scope="col">Nº</th>
                  <th scope="col">Quem pediu</th>
                  <th scope="col">Assunto</th>
                  <th scope="col">Situação</th>
                  <th scope="col">Aberto em</th>
                  <th scope="col">
                    <span className="visualmente-oculto">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {consulta.data.itens.map((chamado) => {
                  const destino = `/admin/chamados/${chamado.id}${search}`;
                  return (
                    <tr key={chamado.id} {...abrirLinha(destino)}>
                      <td className="celula-principal celula-curta">
                        <Link to={destino}>#{chamado.numero}</Link>
                      </td>
                      <td data-rotulo="Quem pediu">
                        <span className="celula-titulo">
                          {chamado.nome}
                          <small>
                            {[chamado.email, chamado.telefone].filter(Boolean).join(' · ')}
                            {chamado.clienteCadastrado ? ' · cliente cadastrado' : ' · visitante'}
                          </small>
                        </span>
                      </td>
                      <td data-rotulo="Assunto" className="texto-suave celula-descricao">
                        {chamado.resumo.split('\n')[0]?.replace(/^•\s*/, '')}
                      </td>
                      <td data-rotulo="Situação">
                        <span className={`selo ${STATUS_CHAMADO[chamado.status].classe}`}>{STATUS_CHAMADO[chamado.status].rotulo}</span>
                      </td>
                      <td data-rotulo="Aberto em" className="texto-suave celula-curta">
                        {dataHora(chamado.criadoEm)}
                      </td>
                      <td className="celula-acoes">
                        <Link to={destino} aria-label={`Abrir o chamado ${chamado.numero}`}>
                          Abrir
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <RodapeLista
              total={consulta.data.total}
              nomes={['chamado', 'chamados']}
              pagina={consulta.data.pagina}
              porPagina={POR_PAGINA}
              totalPaginas={consulta.data.totalPaginas}
              aoMudar={(nova) => alterar('pagina', String(nova))}
            />
          </>
        ))}

      <Outlet />
    </>
  );
}
