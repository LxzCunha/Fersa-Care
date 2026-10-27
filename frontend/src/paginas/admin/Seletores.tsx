import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { listarProdutosAdmin, listarUsuarios } from '../../api/admin';
import type { ProdutoResumo, UsuarioComAcesso } from '../../api/tipos';
import { useValorAtrasado } from '../../lib/ganchos';
import { SEGMENTOS, STATUS_USUARIO } from '../../lib/rotulos';
import '../../componentes/CampoBusca.css';

/**
 * Lista com busca e caixas de seleção. Usada para escolher as peças
 * relacionadas e as pessoas com acesso a um documento restrito.
 */
function SeletorComBusca<T extends { id: string }>({
  rotulo,
  placeholder,
  selecionados,
  aoMudar,
  resultados,
  carregando,
  textoVazio,
  rotuloFicha,
  conteudoItem,
  busca,
  aoBuscar,
}: {
  rotulo: string;
  placeholder: string;
  selecionados: T[];
  aoMudar: (itens: T[]) => void;
  resultados: T[] | undefined;
  carregando: boolean;
  textoVazio: string;
  rotuloFicha: (item: T) => string;
  conteudoItem: (item: T) => ReactNode;
  busca: string;
  aoBuscar: (texto: string) => void;
}) {
  const marcados = new Set(selecionados.map((item) => item.id));

  function alternar(item: T) {
    aoMudar(marcados.has(item.id) ? selecionados.filter((s) => s.id !== item.id) : [...selecionados, item]);
  }

  return (
    <div className="seletor">
      {selecionados.length > 0 && (
        <div className="seletor-escolhidos" aria-label={`${rotulo}: selecionados`}>
          {selecionados.map((item) => (
            <span key={item.id} className="ficha-escolhida">
              {rotuloFicha(item)}
              <button type="button" onClick={() => alternar(item)} aria-label={`Remover ${rotuloFicha(item)}`}>
                <X aria-hidden />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="busca">
        <Search className="busca-icone" aria-hidden />
        <input
          className="busca-entrada"
          type="search"
          placeholder={placeholder}
          aria-label={`Buscar ${rotulo.toLowerCase()}`}
          value={busca}
          onChange={(evento) => aoBuscar(evento.target.value)}
        />
      </div>

      <ul className="seletor-resultados" aria-label={rotulo} aria-busy={carregando}>
        {resultados?.length === 0 && <li className="seletor-vazio">{textoVazio}</li>}
        {resultados?.map((item) => (
          <li key={item.id}>
            <label>
              <input type="checkbox" checked={marcados.has(item.id)} onChange={() => alternar(item)} />
              {conteudoItem(item)}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SeletorProdutos({
  selecionados,
  aoMudar,
}: {
  selecionados: ProdutoResumo[];
  aoMudar: (produtos: ProdutoResumo[]) => void;
}) {
  const [busca, setBusca] = useState('');
  const termo = useValorAtrasado(busca.trim());
  const consulta = useQuery({
    queryKey: ['admin', 'produtos', 'seletor', termo],
    queryFn: () => listarProdutosAdmin({ busca: termo || undefined, porPagina: 30 }),
    placeholderData: keepPreviousData,
  });

  return (
    <SeletorComBusca
      rotulo="Peças relacionadas"
      placeholder="Buscar peça por código ou nome"
      selecionados={selecionados}
      aoMudar={aoMudar}
      resultados={consulta.data?.itens}
      carregando={consulta.isFetching}
      textoVazio="Nenhuma peça encontrada. Cadastre em Catálogo > Peças."
      rotuloFicha={(produto) => produto.codigo}
      busca={busca}
      aoBuscar={setBusca}
      conteudoItem={(produto) => (
        <>
          <span className="seletor-item">
            <strong className="codigo">{produto.codigo}</strong>
            <small>{produto.nome}</small>
          </span>
          <small className="texto-suave">{SEGMENTOS[produto.segmento]}</small>
        </>
      )}
    />
  );
}

export function SeletorUsuarios({
  selecionados,
  aoMudar,
}: {
  selecionados: UsuarioComAcesso[];
  aoMudar: (usuarios: UsuarioComAcesso[]) => void;
}) {
  const [busca, setBusca] = useState('');
  const termo = useValorAtrasado(busca.trim());
  const consulta = useQuery({
    queryKey: ['admin', 'usuarios', 'seletor', termo],
    queryFn: () => listarUsuarios({ busca: termo || undefined, perfil: 'USUARIO', porPagina: 30 }),
    placeholderData: keepPreviousData,
  });

  return (
    <SeletorComBusca
      rotulo="Pessoas com acesso"
      placeholder="Buscar por nome, e-mail ou empresa"
      selecionados={selecionados}
      aoMudar={aoMudar}
      resultados={consulta.data?.itens}
      carregando={consulta.isFetching}
      textoVazio="Nenhum cliente encontrado com essa busca."
      rotuloFicha={(pessoa) => pessoa.nome}
      busca={busca}
      aoBuscar={setBusca}
      conteudoItem={(pessoa) => (
        <>
          <span className="seletor-item">
            <strong>{pessoa.nome}</strong>
            <small>
              {pessoa.email}
              {pessoa.empresa ? `, ${pessoa.empresa}` : ''}
            </small>
          </span>
          {pessoa.status !== 'ATIVO' ? (
            <span className={`selo ${STATUS_USUARIO[pessoa.status].classe}`}>{STATUS_USUARIO[pessoa.status].rotulo}</span>
          ) : (
            <span />
          )}
        </>
      )}
    />
  );
}
