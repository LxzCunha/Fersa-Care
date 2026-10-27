import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BookOpen, ChevronRight, Lock, MessageCircle, Package } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { listarCategorias, resumoDaBiblioteca } from '../api/portal';
import type { Segmento } from '../api/tipos';
import { BlocoSuporte } from '../componentes/BlocoSuporte';
import { CampoBusca } from '../componentes/CampoBusca';
import { GradeDocumentos } from '../componentes/CartaoDocumento';
import { DesenhoRolamento } from '../componentes/DesenhoRolamento';
import { AvisoErro, Carregando } from '../componentes/Estados';
import { EXEMPLOS_DE_BUSCA } from '../config';
import { useAssistente } from '../contexto/Assistente';
import { useAutenticacao } from '../contexto/Autenticacao';
import { numero, plural } from '../lib/formatar';
import { ORDEM_DOS_TIPOS, SEGMENTOS, TIPOS } from '../lib/rotulos';
import { ListaCategorias } from './Categorias';
import './Inicio.css';

/** Quantas categorias aparecem na página inicial (as demais em "Ver todas"). */
const CATEGORIAS_NO_INICIO = 9;

export function Inicio() {
  const navegar = useNavigate();
  const { usuario } = useAutenticacao();
  const assistente = useAssistente();
  const resumo = useQuery({ queryKey: ['resumo-biblioteca'], queryFn: resumoDaBiblioteca });
  const categorias = useQuery({ queryKey: ['categorias'], queryFn: listarCategorias });

  function buscar(termo: string) {
    navegar(termo ? `/busca?q=${encodeURIComponent(termo)}` : '/busca');
  }

  const tiposComMaterial = ORDEM_DOS_TIPOS.filter((tipo) => (resumo.data?.porTipo[tipo] ?? 0) > 0);
  const exclusivos = resumo.data?.materiaisExclusivos ?? 0;

  return (
    <>
      <title>FERSA Care | Manuais, vídeos e suporte técnico das peças FERSA</title>

      {/* Faixa azul no lugar do vídeo de abertura do site FERSA */}
      <section className="hero">
        <div className="conteiner hero-grade">
          <div className="hero-texto">
            <p className="hero-sobretitulo">Fersa Care · Pós-venda</p>
            <h1 className="hero-titulo">Tudo sobre a sua peça FERSA, na palma da mão.</h1>
            <p className="hero-apoio">Manuais de montagem, vídeos e fichas técnicas. Busque pela referência impressa na caixa.</p>
            <CampoBusca
              variante="destaque"
              aoBuscar={buscar}
              rotulo="Buscar peças e materiais técnicos"
              placeholder="Referência, peça ou assunto..."
            />
            <div className="hero-exemplos">
              <span>Experimente:</span>
              {EXEMPLOS_DE_BUSCA.map((exemplo) => (
                <button key={exemplo} type="button" className="hero-exemplo" onClick={() => buscar(exemplo)}>
                  {exemplo}
                </button>
              ))}
            </div>
          </div>
          <DesenhoRolamento className="hero-desenho" />
        </div>
      </section>

      <div className="conteiner inicio-corpo">
        <nav className="atalhos" aria-label="Atalhos">
          <Link to="/produtos" className="atalho">
            <Package className="atalho-icone" aria-hidden />
            <span className="atalho-texto">
              <strong>Catálogo de peças</strong>
              <span>Pela referência, categoria ou medidas</span>
            </span>
            <ChevronRight className="atalho-seta" aria-hidden />
          </Link>
          <Link to="/documentos" className="atalho">
            <BookOpen className="atalho-icone" aria-hidden />
            <span className="atalho-texto">
              <strong>Manuais e vídeos</strong>
              <span>Montagem, boletins e fichas técnicas</span>
            </span>
            <ChevronRight className="atalho-seta" aria-hidden />
          </Link>
          <button type="button" className="atalho" onClick={() => assistente.abrir()}>
            <MessageCircle className="atalho-icone" aria-hidden />
            <span className="atalho-texto">
              <strong>Suporte técnico</strong>
              <span>Pergunte ao assistente técnico</span>
            </span>
            <ChevronRight className="atalho-seta" aria-hidden />
          </button>
        </nav>

        {categorias.data && categorias.data.length > 0 && (
          <section className="secao" aria-labelledby="titulo-categorias">
            <div className="secao-cabecalho">
              <h2 id="titulo-categorias" className="secao-titulo">
                Categorias
              </h2>
              <Link to="/categorias" className="link-seta">
                Ver todas as categorias <ArrowRight aria-hidden />
              </Link>
            </div>
            <ListaCategorias categorias={categorias.data.slice(0, CATEGORIAS_NO_INICIO)} />
          </section>
        )}

        <section className="secao" aria-labelledby="titulo-linhas">
          <h2 id="titulo-linhas" className="secao-titulo">
            Peças por linha
          </h2>
          <ul className="linhas">
            {(Object.keys(SEGMENTOS) as Segmento[]).map((segmento) => (
              <li key={segmento}>
                <Link to={`/produtos?segmento=${segmento}`} className="linha-link">
                  {SEGMENTOS[segmento]}
                  <ArrowRight aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {resumo.isPending && <Carregando texto="Carregando materiais..." />}
        {resumo.isError && <AvisoErro erro={resumo.error} />}

        {resumo.data && (
          <>
            {tiposComMaterial.length > 0 && (
              <section className="secao" aria-labelledby="titulo-tipos">
                <h2 id="titulo-tipos" className="secao-titulo">
                  Manuais e vídeos por tipo
                </h2>
                <ul className="tipos">
                  {tiposComMaterial.map((tipo) => {
                    const Icone = TIPOS[tipo].icone;
                    return (
                      <li key={tipo}>
                        <Link to={`/documentos?tipo=${tipo}`} className="tipo-link">
                          <Icone className="tipo-icone" aria-hidden />
                          <span>{TIPOS[tipo].plural}</span>
                          <span className="tipo-contagem" aria-label={plural(resumo.data.porTipo[tipo], 'material', 'materiais')}>
                            {numero(resumo.data.porTipo[tipo])}
                          </span>
                          <ChevronRight className="tipo-seta" aria-hidden />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {!usuario && exclusivos > 0 && (
              <section className="secao cartao-marca convite" aria-labelledby="titulo-convite">
                <Lock className="convite-icone" aria-hidden />
                <h2 id="titulo-convite">Mais {plural(exclusivos, 'material', 'materiais')} para clientes cadastrados</h2>
                <p>
                  Boletins técnicos, treinamentos e vídeos de montagem aparecem depois do login. Peça seu acesso: a equipe
                  FERSA analisa e libera o cadastro.
                </p>
                <div className="grupo-botoes">
                  <Link to="/solicitar-acesso" className="botao botao-principal">
                    Solicitar acesso
                  </Link>
                  <Link to="/entrar" className="botao botao-secundario">
                    Já tenho conta
                  </Link>
                </div>
              </section>
            )}

            {resumo.data.recentes.length > 0 && (
              <section className="secao" aria-labelledby="titulo-recentes">
                <div className="secao-cabecalho">
                  <h2 id="titulo-recentes" className="secao-titulo">
                    Atualizados recentemente
                  </h2>
                  <Link to="/documentos" className="link-seta">
                    Ver todos os {numero(resumo.data.totalDocumentos)} <ArrowRight aria-hidden />
                  </Link>
                </div>
                <GradeDocumentos documentos={resumo.data.recentes} rotulo="Documentos atualizados recentemente" />
              </section>
            )}
          </>
        )}

        <div className="secao">
          <BlocoSuporte />
        </div>
      </div>
    </>
  );
}
