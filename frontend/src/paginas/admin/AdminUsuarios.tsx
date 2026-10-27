import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Check, Pencil, UserPlus, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { listarUsuarios } from '../../api/admin';
import type { StatusUsuario, Usuario } from '../../api/tipos';
import { DialogoConfirmacao } from '../../componentes/DialogoConfirmacao';
import { AvisoErro, Carregando, EstadoVazio } from '../../componentes/Estados';
import { Paginacao } from '../../componentes/Paginacao';
import { useAutenticacao } from '../../contexto/Autenticacao';
import { data, dataHora, numero } from '../../lib/formatar';
import { useValorAtrasado } from '../../lib/ganchos';
import { PERFIS, STATUS_USUARIO } from '../../lib/rotulos';
import { useAlterarStatus } from './acoes';

const ABAS: { status?: StatusUsuario; rotulo: string }[] = [
  { status: 'PENDENTE', rotulo: 'Aguardando aprovação' },
  { status: 'ATIVO', rotulo: 'Ativos' },
  { status: 'INATIVO', rotulo: 'Inativos' },
  { rotulo: 'Todos' },
];

export function AdminUsuarios() {
  const { usuario: eu } = useAutenticacao();
  const [parametros, setParametros] = useSearchParams();
  const [busca, setBusca] = useState('');
  const termo = useValorAtrasado(busca.trim());
  const alterarStatus = useAlterarStatus();
  const [recusando, setRecusando] = useState<Usuario | null>(null);

  const status = (parametros.get('status') as StatusUsuario | null) ?? undefined;
  const pagina = Number(parametros.get('pagina') ?? '1') || 1;

  function alterar(chave: string, valor: string | undefined) {
    const novos = new URLSearchParams(parametros);
    if (valor) novos.set(chave, valor);
    else novos.delete(chave);
    if (chave !== 'pagina') novos.delete('pagina');
    setParametros(novos, { replace: true });
  }

  const filtros = { busca: termo || undefined, status, pagina, porPagina: 20 };
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

      <header className="admin-cabecalho">
        <div>
          <h1>Usuários</h1>
          <p>Aprove solicitações de acesso, cadastre clientes e administradores.</p>
        </div>
        <Link to="/admin/usuarios/novo" className="botao botao-principal">
          <UserPlus aria-hidden /> Cadastrar usuário
        </Link>
      </header>

      <div className="chips admin-abas" role="group" aria-label="Filtrar por situação">
        {ABAS.map((aba) => {
          const quantidade = aba.status ? porStatus?.[aba.status] : totalGeral;
          return (
            <button
              key={aba.rotulo}
              type="button"
              className="chip"
              aria-pressed={status === aba.status}
              onClick={() => alterar('status', aba.status)}
            >
              {aba.rotulo}
              {quantidade !== undefined && <span className="contagem">{numero(quantidade)}</span>}
            </button>
          );
        })}
      </div>

      <div className="admin-filtros">
        <label className="campo">
          <span className="campo-rotulo">Buscar</span>
          <input
            className="entrada"
            type="search"
            placeholder="Nome, e-mail ou empresa"
            value={busca}
            onChange={(evento) => {
              setBusca(evento.target.value);
              if (pagina !== 1) alterar('pagina', undefined);
            }}
          />
        </label>
      </div>

      {consulta.isPending && <Carregando />}
      {consulta.isError && <AvisoErro erro={consulta.error} />}

      {consulta.data &&
        (consulta.data.total === 0 ? (
          <EstadoVazio titulo={status === 'PENDENTE' ? 'Nenhuma solicitação aguardando' : 'Nenhum usuário encontrado'}>
            {status === 'PENDENTE'
              ? 'Quando alguém pedir acesso pelo portal, a solicitação aparece aqui para você aprovar.'
              : 'Confira a busca ou cadastre um novo usuário.'}
          </EstadoVazio>
        ) : (
          <>
            <div className="tabela-moldura">
              <table className="tabela">
                <thead>
                  <tr>
                    <th scope="col">Pessoa</th>
                    <th scope="col">Empresa</th>
                    <th scope="col">Perfil</th>
                    <th scope="col">Situação</th>
                    <th scope="col">Último acesso</th>
                    <th scope="col">
                      <span className="visualmente-oculto">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {consulta.data.itens.map((pessoa) => (
                    <tr key={pessoa.id}>
                      <td className="celula-principal">
                        <span className="celula-titulo">
                          <Link to={`/admin/usuarios/${pessoa.id}`}>
                            {pessoa.nome}
                            {pessoa.id === eu?.id && ' (você)'}
                          </Link>
                          <small>{pessoa.email}</small>
                        </span>
                      </td>
                      <td data-rotulo="Empresa" className="texto-suave">
                        {pessoa.empresa ?? '—'}
                      </td>
                      <td data-rotulo="Perfil">
                        <span className={`selo ${pessoa.perfil === 'ADMIN' ? 'selo-admin' : 'selo-clientes'}`}>
                          {PERFIS[pessoa.perfil]}
                        </span>
                      </td>
                      <td data-rotulo="Situação">
                        <span className={`selo ${STATUS_USUARIO[pessoa.status].classe}`}>
                          {STATUS_USUARIO[pessoa.status].rotulo}
                        </span>
                      </td>
                      <td data-rotulo="Último acesso" className="texto-suave">
                        {pessoa.ultimoAcessoEm ? dataHora(pessoa.ultimoAcessoEm) : `Cadastro em ${data(pessoa.criadoEm)}`}
                      </td>
                      <td className="celula-acoes">
                        <span className="acoes-linha">
                          {pessoa.status === 'PENDENTE' && (
                            <>
                              <button
                                type="button"
                                className="botao botao-escuro botao-pequeno"
                                disabled={alterarStatus.isPending}
                                onClick={() => alterarStatus.mutate({ usuario: pessoa, status: 'ATIVO' })}
                              >
                                <Check aria-hidden /> Aprovar
                              </button>
                              <button
                                type="button"
                                className="botao botao-secundario botao-pequeno"
                                disabled={alterarStatus.isPending}
                                onClick={() => setRecusando(pessoa)}
                              >
                                <X aria-hidden /> Recusar
                              </button>
                            </>
                          )}
                          <Link
                            to={`/admin/usuarios/${pessoa.id}`}
                            className="botao botao-fantasma botao-pequeno"
                            aria-label={`Editar ${pessoa.nome}`}
                          >
                            <Pencil aria-hidden /> Editar
                          </Link>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginacao
              pagina={consulta.data.pagina}
              totalPaginas={consulta.data.totalPaginas}
              total={consulta.data.total}
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
    </>
  );
}
