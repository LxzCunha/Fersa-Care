import { useQuery } from '@tanstack/react-query';
import { Check, FilePlus, UserPlus, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { obterPainel } from '../../api/admin';
import type { Usuario } from '../../api/tipos';
import { DialogoConfirmacao } from '../../componentes/DialogoConfirmacao';
import { AvisoErro, Carregando, EstadoVazio } from '../../componentes/Estados';
import { data, numero, plural } from '../../lib/formatar';
import { TIPOS, VISIBILIDADES } from '../../lib/rotulos';
import { useAlterarStatus } from './acoes';
import { GraficoAcessos } from './GraficoAcessos';

export function Painel() {
  const consulta = useQuery({ queryKey: ['admin', 'painel'], queryFn: obterPainel });
  const alterarStatus = useAlterarStatus();
  const [recusando, setRecusando] = useState<Usuario | null>(null);

  if (consulta.isPending) return <Carregando />;
  if (consulta.isError) return <AvisoErro erro={consulta.error} />;

  const painel = consulta.data;
  const percentualVisitantes =
    painel.visualizacoes30Dias.total > 0
      ? Math.round((painel.visualizacoes30Dias.deVisitantes / painel.visualizacoes30Dias.total) * 100)
      : 0;

  return (
    <>
      <title>Painel | Administração FERSA Care</title>

      <header className="admin-cabecalho">
        <div>
          <h1>Painel</h1>
          <p>Como o portal está sendo usado e o que precisa da sua atenção.</p>
        </div>
        <div className="grupo-botoes">
          <Link to="/admin/documentos/novo" className="botao botao-principal">
            <FilePlus aria-hidden /> Cadastrar documento
          </Link>
          <Link to="/admin/usuarios/novo" className="botao botao-secundario">
            <UserPlus aria-hidden /> Cadastrar usuário
          </Link>
        </div>
      </header>

      {painel.solicitacoesPendentes.length > 0 && (
        <section className="pendentes" aria-labelledby="titulo-pendentes">
          <div className="pendentes-cabecalho">
            <h2 id="titulo-pendentes">
              {plural(painel.usuarios.pendentes, 'solicitação de acesso', 'solicitações de acesso')} para analisar
            </h2>
            <Link to="/admin/usuarios?status=PENDENTE" className="botao botao-secundario botao-pequeno">
              Ver todas
            </Link>
          </div>
          <ul>
            {painel.solicitacoesPendentes.map((pessoa) => (
              <li key={pessoa.id}>
                <span className="pendente-nome">
                  <Link to={`/admin/usuarios/${pessoa.id}`}>
                    <strong>{pessoa.nome}</strong>
                  </Link>
                  <small>
                    {pessoa.empresa ?? 'Sem empresa informada'}, {pessoa.email}, desde {data(pessoa.criadoEm)}
                  </small>
                </span>
                <span className="acoes-linha">
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
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="painel-numeros" aria-label="Resumo">
        <Link to="/admin/documentos?publicado=true" className="painel-numero">
          <span className="painel-numero-rotulo">Documentos publicados</span>
          <span className="painel-numero-valor">{numero(painel.documentos.publicados)}</span>
          <span className="painel-numero-detalhe">
            <span>
              {VISIBILIDADES.PUBLICO.rotulo}: {painel.documentos.publicos}
            </span>
            <span>Clientes: {painel.documentos.autenticados}</span>
            <span>Específicos: {painel.documentos.restritos}</span>
          </span>
        </Link>
        <Link to="/admin/documentos?publicado=false" className="painel-numero">
          <span className="painel-numero-rotulo">Rascunhos</span>
          <span className="painel-numero-valor">{numero(painel.documentos.rascunhos)}</span>
          <span className="painel-numero-detalhe">Visíveis só para administradores</span>
        </Link>
        <Link to="/admin/usuarios?status=ATIVO" className="painel-numero">
          <span className="painel-numero-rotulo">Clientes com acesso</span>
          <span className="painel-numero-valor">{numero(painel.usuarios.clientesAtivos)}</span>
          <span className="painel-numero-detalhe">
            <span>{plural(painel.usuarios.administradores, 'administrador', 'administradores')}</span>
            <span>{plural(painel.usuarios.inativos, 'inativo')}</span>
          </span>
        </Link>
        <div className="painel-numero">
          <span className="painel-numero-rotulo">Aberturas em 30 dias</span>
          <span className="painel-numero-valor">{numero(painel.visualizacoes30Dias.total)}</span>
          <span className="painel-numero-detalhe">{percentualVisitantes}% por visitantes sem login</span>
        </div>
      </section>

      <div className="painel-grade">
        <section className="painel-bloco" aria-labelledby="titulo-grafico">
          <h2 id="titulo-grafico">Aberturas de documentos por dia</h2>
          <p className="painel-bloco-sub">Últimos 14 dias. Visitas de administradores não entram na conta.</p>
          <GraficoAcessos dados={painel.visualizacoesPorDia} />
        </section>

        <section className="painel-bloco" aria-labelledby="titulo-mais-acessados">
          <h2 id="titulo-mais-acessados">Mais acessados</h2>
          <p className="painel-bloco-sub">Últimos 30 dias.</p>
          {painel.maisAcessados.length === 0 ? (
            <EstadoVazio titulo="Nenhuma abertura ainda">
              Os documentos mais procurados pelos clientes aparecem aqui.
            </EstadoVazio>
          ) : (
            <ol className="mais-acessados">
              {painel.maisAcessados.map((item) => (
                <li key={item.id}>
                  <span className="celula-titulo">
                    <Link to={`/admin/documentos/${item.id}`}>{item.titulo}</Link>
                    <small>
                      {TIPOS[item.tipo].singular}, {VISIBILIDADES[item.visibilidade].rotulo.toLowerCase()}
                    </small>
                  </span>
                  <span className="mais-acessados-valor" aria-label={plural(item.visualizacoes, 'abertura')}>
                    {numero(item.visualizacoes)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <DialogoConfirmacao
        aberto={recusando !== null}
        titulo="Recusar solicitação?"
        mensagem={`${recusando?.nome ?? ''} não vai conseguir entrar no portal. Você pode liberar o acesso depois, na lista de usuários.`}
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
