import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { listarAuditoria } from '../../api/admin';
import type { AlvoDeAuditoria, GrupoDeAuditoria } from '../../api/tipos';
import { AvisoErro, Carregando, EstadoVazio } from '../../componentes/Estados';
import { descreverDetalhes, destinoDoAlvo, sobreAPropriaConta } from '../../lib/auditoria';
import { dataHora } from '../../lib/formatar';
import { useValorAtrasado } from '../../lib/ganchos';
import { ACOES_DE_AUDITORIA } from '../../lib/rotulos';
import { Abas, BarraBusca, CabecalhoLista, RodapeLista } from './Cadastro';
import { useFiltrosNaUrl } from './navegacao';

const POR_PAGINA = 30;

const TIPOS_DE_ALVO: Record<AlvoDeAuditoria, string> = {
  USUARIO: 'Usuário',
  DOCUMENTO: 'Documento',
  PRODUTO: 'Peça',
  CATEGORIA: 'Categoria',
  CHAMADO: 'Chamado',
};

/**
 * Trilha de auditoria (/admin/auditoria): quem entrou, quem errou a senha e
 * tudo o que foi alterado no cadastro, com data, autor e IP. Só leitura: o
 * banco recusa alterar ou apagar eventos.
 */
export function AdminAuditoria() {
  const [parametros, setParametros] = useSearchParams();
  const alterar = useFiltrosNaUrl(parametros, setParametros);
  const [busca, setBusca] = useState('');
  const termo = useValorAtrasado(busca.trim());

  const grupo = (parametros.get('grupo') as GrupoDeAuditoria | null) ?? undefined;
  const pagina = Number(parametros.get('pagina') ?? '1') || 1;

  const filtros = { busca: termo || undefined, grupo, pagina, porPagina: POR_PAGINA };
  const consulta = useQuery({
    queryKey: ['admin', 'auditoria', filtros],
    queryFn: () => listarAuditoria(filtros),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <title>Auditoria | Administração FERSA Care</title>

      <CabecalhoLista titulo="Auditoria" />
      <p className="lista-aviso">
        Logins, senhas e cada alteração feita na administração. Somente leitura: nem administradores alteram ou apagam
        estes registros.
      </p>

      <Abas
        rotulo="Tipo de evento"
        valor={grupo}
        aoMudar={(valor) => alterar('grupo', valor)}
        opcoes={[
          { rotulo: 'Tudo' },
          { valor: 'ACESSOS', rotulo: 'Acessos e senhas' },
          { valor: 'ALTERACOES', rotulo: 'Alterações' },
        ]}
      />

      <BarraBusca
        rotulo="Buscar por pessoa, registro, IP ou e-mail digitado"
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
          <EstadoVazio titulo="Nenhum evento encontrado">
            Os eventos aparecem aqui conforme as pessoas entram no portal e a equipe altera o cadastro.
          </EstadoVazio>
        ) : (
          <>
            <table className="tabela">
              <thead>
                <tr>
                  <th scope="col">Quando</th>
                  <th scope="col">Quem</th>
                  <th scope="col">Ação</th>
                  <th scope="col">Registro</th>
                  <th scope="col">Detalhes</th>
                  <th scope="col">IP</th>
                </tr>
              </thead>
              <tbody>
                {consulta.data.itens.map((evento) => {
                  const acao = ACOES_DE_AUDITORIA[evento.acao];
                  const destino = destinoDoAlvo(evento);
                  const detalhes = descreverDetalhes(evento);
                  return (
                    <tr key={evento.id}>
                      <td data-rotulo="Quando" className="texto-suave celula-curta">
                        {dataHora(evento.criadoEm)}
                      </td>
                      <td data-rotulo="Quem" className="celula-principal">
                        {evento.autor ? evento.autor.nome : <span className="texto-suave">Visitante</span>}
                      </td>
                      <td data-rotulo="Ação">
                        <span className={`selo ${acao?.classe ?? ''}`}>{acao?.rotulo ?? evento.acao}</span>
                      </td>
                      <td data-rotulo="Registro">
                        {sobreAPropriaConta(evento) ? (
                          <span className="texto-suave">Própria conta</span>
                        ) : evento.alvo ? (
                          <span className="celula-titulo">
                            {destino ? <Link to={destino}>{evento.alvo.rotulo}</Link> : evento.alvo.rotulo}
                            <small>{TIPOS_DE_ALVO[evento.alvo.tipo]}</small>
                          </span>
                        ) : (
                          <span className="texto-suave">—</span>
                        )}
                      </td>
                      <td data-rotulo="Detalhes" className="texto-suave celula-descricao">
                        {detalhes.length > 0 ? (
                          <ul className="lista-detalhes">
                            {detalhes.map((frase) => (
                              <li key={frase}>{frase}</li>
                            ))}
                          </ul>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td data-rotulo="IP" className="texto-suave celula-curta">
                        {evento.ip ?? '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <RodapeLista
              total={consulta.data.total}
              nomes={['evento', 'eventos']}
              pagina={consulta.data.pagina}
              porPagina={POR_PAGINA}
              totalPaginas={consulta.data.totalPaginas}
              aoMudar={(nova) => alterar('pagina', String(nova))}
            />
          </>
        ))}
    </>
  );
}
