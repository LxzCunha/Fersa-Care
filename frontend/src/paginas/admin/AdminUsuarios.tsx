import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, Outlet, useLocation, useSearchParams } from 'react-router';
import { listarUsuarios } from '../../api/admin';
import type { StatusUsuario, Usuario } from '../../api/tipos';
import { DialogoConfirmacao } from '../../componentes/DialogoConfirmacao';
import { AvisoErro, Carregando, EstadoVazio } from '../../componentes/Estados';
import { useAutenticacao } from '../../contexto/Autenticacao';
import { data, dataHora } from '../../lib/formatar';
import { useValorAtrasado } from '../../lib/ganchos';
import { PERFIS } from '../../lib/rotulos';
import { useAlterarStatus } from './acoes';
import {
  Abas,
  BarraBusca,
  CabecalhoLista,
  Marcador,
  RodapeLista,
} from './Cadastro';
import { useAbrirAoClicarNaLinha, useFiltrosNaUrl } from './navegacao';

const POR_PAGINA = 20;

/** Lista de usuários; o cadastro abre numa janela por cima (rotas filhas no <Outlet />). */
export function AdminUsuarios() {
  const { usuario: eu } = useAutenticacao();
  const [parametros, setParametros] = useSearchParams();
  const { search } = useLocation();
  const alterar = useFiltrosNaUrl(parametros, setParametros);
  const abrirLinha = useAbrirAoClicarNaLinha();
  const [busca, setBusca] = useState('');
  const termo = useValorAtrasado(busca.trim());
  const alterarStatus = useAlterarStatus();
  const [recusando, setRecusando] = useState<Usuario | null>(null);

  const status = (parametros.get('status') as StatusUsuario | null) ?? undefined;
  const pagina = Number(parametros.get('pagina') ?? '1') || 1;

  const filtros = { busca: termo || undefined, status, pagina, porPagina: POR_PAGINA };
  const consulta = useQuery({
    queryKey: ['admin', 'usuarios', filtros],
    queryFn: () => listarUsuarios(filtros),
    placeholderData: keepPreviousData,
  });
  const porStatus = consulta.data?.porStatus;
  const totalGeral = porStatus ? porStatus.PENDENTE + porStatus.ATIVO + porStatus.INATIVO : undefined;

  return (
    <>
      <title>Usuários | Administração FERSA Care</title>

      <CabecalhoLista titulo="Usuários" novo={{ para: `/admin/usuarios/novo${search}`, rotulo: 'Cadastrar usuário' }} />

      <Abas
        rotulo="Situação"
        valor={status}
        aoMudar={(valor) => alterar('status', valor)}
        opcoes={[
          { rotulo: 'Todos', contagem: totalGeral },
          { valor: 'PENDENTE', rotulo: 'Aguardando aprovação', contagem: porStatus?.PENDENTE },
          { valor: 'ATIVO', rotulo: 'Ativos', contagem: porStatus?.ATIVO },
          { valor: 'INATIVO', rotulo: 'Inativos', contagem: porStatus?.INATIVO },
        ]}
      />

      <BarraBusca
        rotulo="Buscar por nome, e-mail ou empresa"
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
          <EstadoVazio titulo={status === 'PENDENTE' ? 'Nenhuma solicitação aguardando' : 'Nenhum usuário encontrado'}>
            {status === 'PENDENTE'
              ? 'Quando alguém pedir acesso pelo portal, a solicitação aparece aqui para você aprovar.'
              : 'Confira a busca ou cadastre um usuário no “+”.'}
          </EstadoVazio>
        ) : (
          <>
            <table className="tabela">
              <thead>
                <tr>
                  <th scope="col">Nome</th>
                  <th scope="col">E-mail</th>
                  <th scope="col">Empresa</th>
                  <th scope="col">Perfil</th>
                  <th scope="col" className="celula-centro">
                    Ativo
                  </th>
                  <th scope="col">Último acesso</th>
                  <th scope="col">
                    <span className="visualmente-oculto">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {consulta.data.itens.map((pessoa) => {
                  const destino = `/admin/usuarios/${pessoa.id}${search}`;
                  return (
                    <tr key={pessoa.id} {...abrirLinha(destino)}>
                      <td className="celula-principal">
                        <Link to={destino}>
                          {pessoa.nome}
                          {pessoa.id === eu?.id && ' (você)'}
                        </Link>
                      </td>
                      <td data-rotulo="E-mail" className="texto-suave">
                        {pessoa.email}
                      </td>
                      <td data-rotulo="Empresa" className="texto-suave">
                        {pessoa.empresa ?? '—'}
                      </td>
                      <td data-rotulo="Perfil">{PERFIS[pessoa.perfil]}</td>
                      <td data-rotulo="Ativo" className="celula-centro">
                        {pessoa.status === 'PENDENTE' ? (
                          <span className="selo selo-pendente">Aguardando</span>
                        ) : (
                          <Marcador marcado={pessoa.status === 'ATIVO'} rotulo="Ativo" />
                        )}
                      </td>
                      <td data-rotulo="Último acesso" className="texto-suave celula-curta">
                        {pessoa.ultimoAcessoEm ? dataHora(pessoa.ultimoAcessoEm) : `Cadastro em ${data(pessoa.criadoEm)}`}
                      </td>
                      <td className="celula-acoes">
                        {pessoa.status === 'PENDENTE' && (
                          <>
                            <button
                              type="button"
                              disabled={alterarStatus.isPending}
                              onClick={() => alterarStatus.mutate({ usuario: pessoa, status: 'ATIVO' })}
                            >
                              Aprovar
                            </button>
                            <button
                              type="button"
                              className="acao-perigo"
                              disabled={alterarStatus.isPending}
                              onClick={() => setRecusando(pessoa)}
                            >
                              Recusar
                            </button>
                          </>
                        )}
                        <Link to={destino} aria-label={`Editar ${pessoa.nome}`}>
                          Editar
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <RodapeLista
              total={consulta.data.total}
              nomes={['usuário', 'usuários']}
              pagina={consulta.data.pagina}
              porPagina={POR_PAGINA}
              totalPaginas={consulta.data.totalPaginas}
              aoMudar={(nova) => alterar('pagina', String(nova))}
            />
          </>
        ))}

      <DialogoConfirmacao
        aberto={recusando !== null}
        titulo="Recusar solicitação?"
        mensagem={`${recusando?.nome ?? ''} não vai conseguir entrar no portal. Você pode liberar o acesso depois, editando o usuário.`}
        textoConfirmar="Recusar acesso"
        perigoso
        processando={alterarStatus.isPending}
        aoCancelar={() => setRecusando(null)}
        aoConfirmar={() => {
          if (recusando) alterarStatus.mutate({ usuario: recusando, status: 'INATIVO' }, { onSettled: () => setRecusando(null) });
        }}
      />

      <Outlet />
    </>
  );
}
